-- order-driven-stats.sql — 统计架构转向「订单驱动」:real=纯真实(source=sync),show=真实+复制(sync+manual)。
-- 跑在 rune-dapp 主网 Supabase(mefjuecwawmjfmeofnck)。幂等,可重复执行。
--
-- 背景(审计结论):旧 rollup 把 source='manual'(breakeven/复制单)全额算进了 real 列,
--   "real vs show" 是假对照;且 acct_daily.manual_* 字段级覆盖与订单驱动两套机制在个别账户打架。
-- 新规(已与 Alps 确认):
--   · real_*  = 只聚合 source='sync' 的真实成交(纯真实业绩)
--   · show(主列)= sync + manual(admin 复制/breakeven 生成的单 + manual add/replace 持仓)
--   · 废弃 acct_daily.manual_* 字段覆盖;admin 只能「复制订单」影响 show,不能直接改数字
--   · 余额仍走 trading_*_overrides(账户层,非订单)
--   · breakeven 生成器 wallet 修为 smart_wallet_address(旧版误写 hl_master)

-- ── ① acct_daily 加 sync_*(纯真实)列;主列继续作为 show ───────────────────────
alter table public.trading_acct_daily add column if not exists sync_position_value_usd   numeric not null default 0;
alter table public.trading_acct_daily add column if not exists sync_unrealized_pnl_usd    numeric not null default 0;
alter table public.trading_acct_daily add column if not exists sync_realized_pnl_day_usd  numeric not null default 0;
alter table public.trading_acct_daily add column if not exists sync_day_pnl_usd           numeric not null default 0;
alter table public.trading_acct_daily add column if not exists sync_realized_pnl_cum_usd  numeric not null default 0;

-- ── ② rollup v5:双轨(sync 纯真实 / 主列=show=sync+manual,show 持仓并入 manual add)──
create or replace function public.trading_rollup_daily(p_day date default null, p_tz text default 'Asia/Singapore')
returns void language plpgsql security definer set search_path = public as $function$
declare
  v_day   date := coalesce(p_day, (now() at time zone p_tz)::date);
  v_start timestamptz := (v_day::timestamp) at time zone p_tz;
  v_end   timestamptz := ((v_day + 1)::timestamp) at time zone p_tz;
begin
  -- ════════════════════ Polymarket ════════════════════
  with pm_mark as (
    select coalesce(m.symbol, lf.token_id) as token_id, coalesce(m.px, lf.px) as px
    from (select distinct on (token_id) token_id, price as px
          from trading_polymarket_fills where matched_at < v_end
          order by token_id, matched_at desc) lf
    full join (select symbol, px from trading_mark_prices where venue = 'polymarket') m
      on m.symbol = lf.token_id
  ),
  -- 真实持仓估值(sync)
  pos as (
    select p.user_id,
      sum(case when p.net_shares is distinct from 0
               and coalesce(p.settlement_status,'') not in ('closed','redeemed','settled','resolved')
          then p.net_shares * coalesce(mk.px, p.avg_entry_price, 0) else 0 end) as value_usd,
      sum(case when p.net_shares is distinct from 0
               and coalesce(p.settlement_status,'') not in ('closed','redeemed','settled','resolved')
          then p.net_shares * coalesce(p.avg_entry_price, 0) else 0 end)        as cost_usd,
      count(*) filter (where p.net_shares is distinct from 0
               and coalesce(p.settlement_status,'') not in ('closed','redeemed','settled','resolved')) as open_cnt,
      count(*) filter (where (p.net_shares = 0
               or coalesce(p.settlement_status,'') in ('closed','redeemed','settled','resolved'))
               and p.updated_at >= v_start and p.updated_at < v_end)            as closed_today,
      sum(coalesce(p.realized_pnl_usd, 0))                                      as realized_cum
    from trading_positions p
    left join pm_mark mk on mk.token_id = p.token_id
    group by p.user_id
  ),
  -- 复制/手动 PM 持仓(add/replace,active)→ 只进 show 的持仓估值
  pm_mpos as (
    select tu.id as user_id,
      sum(abs(coalesce(mp.size,0)) * coalesce(mp.mark_px, mp.entry_px, 0)) as value_usd,
      sum(coalesce(mp.unrealized_pnl_usd,
                   mp.size * (coalesce(mp.mark_px, mp.entry_px, 0) - coalesce(mp.entry_px, 0)))) as unrealized
    from trading_pm_manual_positions mp
    join trading_users tu on lower(tu.smart_wallet_address) = lower(mp.wallet)
    where mp.active and mp.mode in ('add','replace')
    group by tu.id
  ),
  -- 复制/手动 PM 平仓订单(realized)→ 只进 show
  pm_manual as (
    select r.user_id,
      sum(coalesce(r.realized_pnl_usd, 0)) filter (where r.happened_at < v_end)        as manual_cum,
      sum(coalesce(r.realized_pnl_usd, 0)) filter (where r.happened_at < v_start)      as manual_cum_b4,
      count(*) filter (where r.record_type = 'position_closed'
               and r.happened_at >= v_start and r.happened_at < v_end)                 as manual_closed_today
    from trading_trade_records r
    where r.venue = 'polymarket' and r.source = 'manual'
      and r.record_type <> 'position_snapshot' and r.user_id is not null
      and not exists (select 1 from trading_record_hidden h where h.record_id = r.record_id)
    group by r.user_id
  ),
  fl as (
    select user_id, count(*) as fills_cnt, sum(coalesce(notional_usd,0)) as fills_notional
    from trading_polymarket_fills
    where matched_at >= v_start and matched_at < v_end
    group by user_id
  ),
  pm as (
    select coalesce(pos.user_id, fl.user_id, mn.user_id, mpos.user_id) as user_id,
      -- sync(纯真实)
      coalesce(pos.value_usd, 0)  as sync_value,
      coalesce(pos.cost_usd, 0)   as cost_usd,
      coalesce(pos.value_usd, 0) - coalesce(pos.cost_usd, 0) as sync_unreal,
      coalesce(pos.realized_cum, 0) as sync_realized_cum,
      -- show(真实 + 复制)
      coalesce(pos.value_usd, 0) + coalesce(mpos.value_usd, 0) as show_value,
      (coalesce(pos.value_usd, 0) - coalesce(pos.cost_usd, 0)) + coalesce(mpos.unrealized, 0) as show_unreal,
      coalesce(pos.realized_cum, 0) + coalesce(mn.manual_cum, 0)    as show_realized_cum,
      coalesce(pos.realized_cum, 0) + coalesce(mn.manual_cum_b4, 0) as show_realized_cum_b4,
      coalesce(pos.open_cnt, 0)   as open_cnt,
      coalesce(pos.closed_today, 0) + coalesce(mn.manual_closed_today, 0) as closed_today,
      coalesce(fl.fills_cnt, 0)   as fills_cnt,
      coalesce(fl.fills_notional, 0) as fills_notional
    from pos
    full join fl on fl.user_id = pos.user_id
    full join pm_manual mn on mn.user_id = coalesce(pos.user_id, fl.user_id)
    full join pm_mpos mpos on mpos.user_id = coalesce(pos.user_id, fl.user_id, mn.user_id)
  )
  insert into trading_acct_daily as t
    (user_id, venue, day, position_value_usd, position_cost_usd, unrealized_pnl_usd,
     realized_pnl_cum_usd, realized_pnl_day_usd, day_pnl_usd,
     sync_position_value_usd, sync_unrealized_pnl_usd, sync_realized_pnl_cum_usd,
     sync_realized_pnl_day_usd, sync_day_pnl_usd,
     open_positions, closed_today, fills_today, fills_notional_today_usd, snapped_at)
  select pm.user_id, 'polymarket', v_day,
    pm.show_value, pm.cost_usd, pm.show_unreal,
    pm.show_realized_cum,
    pm.show_realized_cum - coalesce(prev.realized_pnl_cum_usd, pm.show_realized_cum_b4),
    (pm.show_realized_cum - coalesce(prev.realized_pnl_cum_usd, pm.show_realized_cum_b4))
      + (pm.show_unreal - coalesce(prev.unrealized_pnl_usd, pm.show_unreal)),
    pm.sync_value, pm.sync_unreal, pm.sync_realized_cum,
    pm.sync_realized_cum - coalesce(prev.sync_realized_pnl_cum_usd, pm.sync_realized_cum),
    (pm.sync_realized_cum - coalesce(prev.sync_realized_pnl_cum_usd, pm.sync_realized_cum))
      + (pm.sync_unreal - coalesce(prev.sync_unrealized_pnl_usd, pm.sync_unreal)),
    pm.open_cnt, pm.closed_today, pm.fills_cnt, pm.fills_notional, now()
  from pm
  left join lateral (
    select realized_pnl_cum_usd, unrealized_pnl_usd, sync_realized_pnl_cum_usd, sync_unrealized_pnl_usd
    from trading_acct_daily d
    where d.user_id = pm.user_id and d.venue = 'polymarket' and d.day < v_day
    order by d.day desc limit 1
  ) prev on true
  on conflict (user_id, venue, day) do update set
    position_value_usd = excluded.position_value_usd,
    position_cost_usd  = excluded.position_cost_usd,
    unrealized_pnl_usd = excluded.unrealized_pnl_usd,
    realized_pnl_cum_usd = excluded.realized_pnl_cum_usd,
    realized_pnl_day_usd = excluded.realized_pnl_day_usd,
    day_pnl_usd        = excluded.day_pnl_usd,
    sync_position_value_usd  = excluded.sync_position_value_usd,
    sync_unrealized_pnl_usd  = excluded.sync_unrealized_pnl_usd,
    sync_realized_pnl_cum_usd = excluded.sync_realized_pnl_cum_usd,
    sync_realized_pnl_day_usd = excluded.sync_realized_pnl_day_usd,
    sync_day_pnl_usd   = excluded.sync_day_pnl_usd,
    open_positions     = excluded.open_positions,
    closed_today       = excluded.closed_today,
    fills_today        = excluded.fills_today,
    fills_notional_today_usd = excluded.fills_notional_today_usd,
    snapped_at         = now();

  -- ════════════════════ Hyperliquid ════════════════════
  with hl_sub as (
    select distinct s.user_id, s.network from trading_hl_copy_subscriptions s where s.user_id is not null
  ),
  used as (
    select s.user_id, s.network, sum(coalesce(s.today_used_usd, 0)) as today_used
    from trading_hl_copy_subscriptions s where s.user_id is not null
    group by s.user_id, s.network
  ),
  hl_pos as (
    select distinct on (s.user_id, s.network, hp.coin)
      s.user_id, s.network, hp.coin, hp.size_base, hp.avg_entry_px, hp.updated_at
    from trading_hl_copy_subscriptions s
    join trading_hl_positions hp on hp.subscription_id = s.id
    where s.user_id is not null
    order by s.user_id, s.network, hp.coin, hp.updated_at desc
  ),
  -- 复制/手动 HL 持仓(add/replace,active)→ 只进 show 的持仓估值
  hl_mpos as (
    select tu.id as user_id, mp.network,
      sum(abs(coalesce(mp.size,0)) * coalesce(mp.mark_px, mp.entry_px, 0)) as value_usd,
      sum(coalesce(mp.unrealized_pnl_usd,
                   mp.size * (coalesce(mp.mark_px, mp.entry_px, 0) - coalesce(mp.entry_px, 0)))) as unrealized
    from trading_hl_manual_positions mp
    join trading_users tu on lower(tu.smart_wallet_address) = lower(mp.wallet)
    where mp.active and mp.mode in ('add','replace')
    group by tu.id, mp.network
  ),
  -- 平仓/实现盈亏:show=全部非snapshot非hidden;sync=仅 source='sync'
  recs_all as (
    select r.user_id, r.venue, count(*) as closed_cnt, sum(coalesce(r.realized_pnl_usd, 0)) as realized_day
    from trading_trade_records r
    where r.venue like 'hl\_%' escape '\' and r.record_type <> 'position_snapshot'
      and r.happened_at >= v_start and r.happened_at < v_end
      and not exists (select 1 from trading_record_hidden h where h.record_id = r.record_id)
    group by r.user_id, r.venue
  ),
  recs_sync as (
    select r.user_id, r.venue, sum(coalesce(r.realized_pnl_usd, 0)) as realized_day
    from trading_trade_records r
    where r.venue like 'hl\_%' escape '\' and r.record_type <> 'position_snapshot'
      and r.source = 'sync'
      and r.happened_at >= v_start and r.happened_at < v_end
      and not exists (select 1 from trading_record_hidden h where h.record_id = r.record_id)
    group by r.user_id, r.venue
  ),
  hl as (
    select b.user_id, ('hl_' || b.network) as venue, b.network,
      coalesce(sum(abs(coalesce(p.size_base,0)) * coalesce(mk.px, p.avg_entry_px, 0)), 0) as value_usd,
      coalesce(sum(abs(coalesce(p.size_base,0)) * coalesce(p.avg_entry_px, 0)), 0)        as cost_usd,
      coalesce(sum(coalesce(p.size_base,0) * (coalesce(mk.px, p.avg_entry_px, 0) - coalesce(p.avg_entry_px, 0))), 0) as unrealized,
      count(p.coin) filter (where p.size_base is distinct from 0)                          as open_cnt,
      max(coalesce(u2.today_used, 0))                                                      as today_used
    from hl_sub b
    left join hl_pos p on p.user_id = b.user_id and p.network = b.network
    left join trading_mark_prices mk on mk.venue = 'hl_' || b.network and mk.symbol = p.coin
    left join used u2 on u2.user_id = b.user_id and u2.network = b.network
    group by b.user_id, b.network
  )
  insert into trading_acct_daily as t
    (user_id, venue, day, position_value_usd, position_cost_usd, unrealized_pnl_usd,
     realized_pnl_cum_usd, realized_pnl_day_usd, day_pnl_usd,
     sync_position_value_usd, sync_unrealized_pnl_usd, sync_realized_pnl_cum_usd,
     sync_realized_pnl_day_usd, sync_day_pnl_usd,
     open_positions, closed_today, fills_today, fills_notional_today_usd, hl_today_used_usd, snapped_at)
  select hl.user_id, hl.venue, v_day,
    -- show:真实持仓 + 复制持仓
    coalesce(hl.value_usd,0) + coalesce(mp.value_usd, 0),
    coalesce(hl.cost_usd,0),
    coalesce(hl.unrealized,0) + coalesce(mp.unrealized, 0),
    coalesce(prev.realized_pnl_cum_usd, 0) + coalesce(ra.realized_day, 0),
    coalesce(ra.realized_day, 0),
    coalesce(ra.realized_day, 0)
      + ((coalesce(hl.unrealized,0) + coalesce(mp.unrealized,0))
         - coalesce(prev.unrealized_pnl_usd, coalesce(hl.unrealized,0) + coalesce(mp.unrealized,0))),
    -- sync:纯真实
    coalesce(hl.value_usd,0), coalesce(hl.unrealized,0),
    coalesce(prev.sync_realized_pnl_cum_usd, 0) + coalesce(rs.realized_day, 0),
    coalesce(rs.realized_day, 0),
    coalesce(rs.realized_day, 0)
      + (coalesce(hl.unrealized,0) - coalesce(prev.sync_unrealized_pnl_usd, coalesce(hl.unrealized,0))),
    coalesce(hl.open_cnt,0), coalesce(ra.closed_cnt,0), 0, 0, hl.today_used, now()
  from hl
  left join recs_all ra on ra.user_id = hl.user_id and ra.venue = hl.venue
  left join recs_sync rs on rs.user_id = hl.user_id and rs.venue = hl.venue
  left join hl_mpos mp on mp.user_id = hl.user_id and mp.network = hl.network
  left join lateral (
    select realized_pnl_cum_usd, unrealized_pnl_usd, sync_realized_pnl_cum_usd, sync_unrealized_pnl_usd
    from trading_acct_daily d
    where d.user_id = hl.user_id and d.venue = hl.venue and d.day < v_day
    order by d.day desc limit 1
  ) prev on true
  on conflict (user_id, venue, day) do update set
    position_value_usd = excluded.position_value_usd,
    position_cost_usd  = excluded.position_cost_usd,
    unrealized_pnl_usd = excluded.unrealized_pnl_usd,
    realized_pnl_cum_usd = excluded.realized_pnl_cum_usd,
    realized_pnl_day_usd = excluded.realized_pnl_day_usd,
    day_pnl_usd        = excluded.day_pnl_usd,
    sync_position_value_usd  = excluded.sync_position_value_usd,
    sync_unrealized_pnl_usd  = excluded.sync_unrealized_pnl_usd,
    sync_realized_pnl_cum_usd = excluded.sync_realized_pnl_cum_usd,
    sync_realized_pnl_day_usd = excluded.sync_realized_pnl_day_usd,
    sync_day_pnl_usd   = excluded.sync_day_pnl_usd,
    open_positions     = excluded.open_positions,
    closed_today       = excluded.closed_today,
    hl_today_used_usd  = excluded.hl_today_used_usd,
    snapped_at         = now();
end $function$;

-- ── ③ breakeven 生成器:wallet 修为 smart_wallet_address(旧版误写 hl_master)──────
create or replace function public.rune_gen_daily_breakeven(p_day date default null, p_tz text default 'Asia/Singapore')
returns int language plpgsql security definer set search_path = public as $function$
declare
  v_day date := coalesce(p_day, (now() at time zone p_tz)::date);
  acct record; n int; i int; cap numeric; target numeric; part numeric; remaining numeric;
  mk record; side text; ins int := 0; t_at timestamptz;
begin
  for acct in
    select distinct s.user_id, s.network, ('hl_' || s.network) as venue,
           u.smart_wallet_address as wallet   -- 修复:smart 优先(旧版 coalesce(hl_master,smart) 写错地址)
    from trading_hl_copy_subscriptions s
    join trading_users u on u.id = s.user_id
    where s.user_id is not null and u.smart_wallet_address is not null
  loop
    select coalesce(max(c.hl_cap_usd), 1000) into cap
    from rune_auth_codes c where lower(c.assigned_to) = lower(acct.wallet);
    cap := coalesce(cap, 1000);
    target := round((cap * (0.003 + random() * 0.002))::numeric, 2);
    n := 3 + floor(random() * 4)::int;
    remaining := target;
    for i in 1..n loop
      select symbol, px into mk from trading_mark_prices
       where venue = acct.venue and px > 0 and symbol not like '#%' order by random() limit 1;
      if mk.symbol is null then
        select symbol, px into mk from trading_mark_prices
         where venue like 'hl\_%' escape '\' and px > 0 and symbol not like '#%' order by random() limit 1;
      end if;
      exit when mk.symbol is null;
      if i < n then part := round((remaining * (random() * 1.0 - 0.4))::numeric, 2); remaining := remaining - part;
      else part := round(remaining::numeric, 2); end if;
      side := case when random() < 0.5 then 'sell' else 'buy' end;
      t_at := (v_day::timestamp at time zone p_tz)
              + make_interval(hours => 9 + floor(random()*12)::int, mins => floor(random()*60)::int, secs => floor(random()*60)::int);
      insert into trading_trade_records
        (record_id, source, venue, record_type, user_id, wallet, market_id, symbol,
         side, price, size, notional_usd, realized_pnl_usd, happened_at, created_at)
      values
        ('bkev-' || acct.user_id || '-' || acct.venue || '-' || v_day || '-' || i,
         'manual', acct.venue, 'position_closed', acct.user_id, lower(acct.wallet),
         mk.symbol, mk.symbol, side, mk.px,
         round(((40 + random() * 260) / mk.px)::numeric, 6),
         round((40 + random() * 260)::numeric, 2),
         part, t_at, now())
      on conflict (record_id) do nothing;
      ins := ins + 1;
    end loop;
  end loop;
  return ins;
end $function$;
