-- admin-accounts-schema.sql — admin-panel「交易账户」页数据层(additive,叠在 stats-schema.sql 之上)。
-- 跑在 rune-dapp Supabase(mefjuecwawmjfmeofnck)。幂等,可重复执行。
--
-- 提供:
--   ① trading_pm_manual_positions / trading_record_hidden / trading_pm_overrides 的 RLS
--      (stats-schema 的 RLS loop 没包含前两张;pm_overrides 本文件新建)
--   ② v_wallet_open_positions 尾部追加 is_manual / manual_mode / manual_id 列
--      + PM 手动持仓并入(与 HL 手动行同构;尾部加列不破坏既有消费方)
--   ③ v_admin_trading_accounts — admin 页一行一 (entitled 钱包 × venue):
--      地址簿(PM smart wallet / engine EOA / HL master / 主测网 follower)
--      + 双轨统计:调整后(coalesce(manual_*, 真实))与 real_* 真实对照,
--      日/月/总 已实现+未实现盈亏,全部带 %(口径延续 stats-schema:
--      日/月 % 分母 = 当日持仓成本;总 % 分母 = 授权码充值额度 cap,缺省回退成本)
--   ④ admin_trading_recalc() RPC — admin 改完 overlay 数据后立即刷新统计
--      (refresh_trade_records + rollup_daily 的带权限校验 wrapper;否则要等 10 分钟 pg_cron)

-- ── ① PM 余额/统计覆盖表(对齐 trading_hl_overrides 语义:非 null 字段替换真实值)──
create table if not exists public.trading_pm_overrides (
  wallet             text primary key,  -- 用户连接的 smart wallet(大小写不敏感匹配)
  balance_usd        numeric,           -- pUSD 余额覆盖(真实值 = 链上 balanceOf)
  unrealized_pnl_usd numeric,
  today_pnl_usd      numeric,
  note               text,
  updated_at         timestamptz not null default now()
);

-- ── RLS(public_read + admin_write,与 stats-schema 同模式)─────────────────────
do $$
declare t text;
begin
  foreach t in array array['trading_pm_manual_positions','trading_record_hidden','trading_pm_overrides'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='public_read') then
      execute format('create policy public_read on public.%I for select to anon, authenticated using (true)', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='admin_write') then
      execute format($p$create policy admin_write on public.%I for all to authenticated
        using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
        with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))$p$, t);
    end if;
  end loop;
end $$;
grant select on public.trading_pm_manual_positions, public.trading_record_hidden, public.trading_pm_overrides
  to anon, authenticated;
grant insert, update, delete on public.trading_pm_manual_positions, public.trading_record_hidden,
  public.trading_pm_overrides, public.trading_hl_manual_positions, public.trading_hl_overrides,
  public.trading_acct_daily, public.trading_trade_records
  to authenticated;   -- 行级仍由 admin_write policy 把关

-- ── ② v_wallet_open_positions:全量重建(= 2026-06-07 线上定义 + 尾部 3 列 + PM 手动分支)──
create or replace view public.v_wallet_open_positions as
with pm_mark as (
  select coalesce(m.symbol, lf.token_id) as token_id, coalesce(m.px, lf.px) as px
  from (select distinct on (token_id) token_id, price as px
        from trading_polymarket_fills order by token_id, matched_at desc) lf
  full join (select symbol, px from trading_mark_prices where venue = 'polymarket') m
    on m.symbol = lf.token_id
)
select 'polymarket'::text as venue, u.smart_wallet_address as wallet, p.user_id,
  p.market_id, p.token_id as symbol,
  p.net_shares as size, p.avg_entry_price as entry_px, mk.px as mark_px,
  p.net_shares * coalesce(mk.px, p.avg_entry_price, 0)                    as position_value_usd,
  p.net_shares * coalesce(p.avg_entry_price, 0)                           as position_cost_usd,
  p.net_shares * (coalesce(mk.px, p.avg_entry_price, 0) - coalesce(p.avg_entry_price, 0)) as unrealized_pnl_usd,
  p.realized_pnl_usd, p.last_fill_at, p.updated_at,
  null::text as tx_hash,
  false as is_manual, null::text as manual_mode, null::uuid as manual_id
from trading_positions p
join trading_users u on u.id = p.user_id
left join pm_mark mk on mk.token_id = p.token_id
where p.net_shares is distinct from 0
  and coalesce(p.settlement_status,'') not in ('closed','redeemed','settled','resolved')
union all
select ('hl_' || hp.network), u.smart_wallet_address, hp.user_id,
  hp.coin, hp.coin,
  hp.size_base,
  hp.avg_entry_px,
  mk.px,
  abs(hp.size_base) * coalesce(mk.px, hp.avg_entry_px, 0),
  abs(hp.size_base) * coalesce(hp.avg_entry_px, 0),
  hp.size_base * (coalesce(mk.px, hp.avg_entry_px, 0) - coalesce(hp.avg_entry_px, 0)),
  null::numeric, null::timestamptz, hp.updated_at,
  null::text,
  false, null::text, null::uuid
from (
  select distinct on (s.user_id, s.network, p.coin)
    s.user_id, s.network, p.coin, p.size_base, p.avg_entry_px, p.updated_at
  from trading_hl_positions p
  join trading_hl_copy_subscriptions s on s.id = p.subscription_id
  where s.user_id is not null
  order by s.user_id, s.network, p.coin, p.updated_at desc
) hp
join trading_users u on u.id = hp.user_id
left join trading_mark_prices mk on mk.venue = 'hl_' || hp.network and mk.symbol = hp.coin
where hp.size_base is distinct from 0
union all
select ('hl_' || mp.network), mp.wallet, null::uuid,
  mp.coin, mp.coin,
  mp.size, mp.entry_px, coalesce(mp.mark_px, mp.entry_px),
  abs(mp.size) * coalesce(mp.mark_px, mp.entry_px, 0),
  abs(mp.size) * coalesce(mp.entry_px, 0),
  coalesce(mp.unrealized_pnl_usd, mp.size * (coalesce(mp.mark_px, mp.entry_px, 0) - coalesce(mp.entry_px, 0))),
  null::numeric, null::timestamptz, mp.updated_at,
  mp.tx_hash,
  true, mp.mode, mp.id
from trading_hl_manual_positions mp
where mp.active and mp.mode in ('add','replace')
union all
-- PM 手动持仓(与 HL 同构;market_id 用真实 PM market,symbol 用 token/标题缩写)
select 'polymarket', mp.wallet, null::uuid,
  mp.market_id, coalesce(mp.token_id, mp.title, mp.market_id),
  mp.size, mp.entry_px, coalesce(mp.mark_px, mp.entry_px),
  abs(mp.size) * coalesce(mp.mark_px, mp.entry_px, 0),
  abs(mp.size) * coalesce(mp.entry_px, 0),
  coalesce(mp.unrealized_pnl_usd, mp.size * (coalesce(mp.mark_px, mp.entry_px, 0) - coalesce(mp.entry_px, 0))),
  null::numeric, null::timestamptz, mp.updated_at,
  null::text,
  true, mp.mode, mp.id
from trading_pm_manual_positions mp
where mp.active and mp.mode in ('add','replace');

-- ── ③ admin 交易账户总览(一行 = entitled 钱包 × venue;page 按钱包分组渲染)────────
create or replace view public.v_admin_trading_accounts as
with sgt as (select (now() at time zone 'Asia/Singapore')::date as today),
hl_addr as (   -- 每用户每网络的 HL 账户地址 + 活跃订阅数
  select s.user_id, s.network,
    max(s.follower_address)                          as follower_address,
    count(*) filter (where s.status = 'active')      as active_subs
  from trading_hl_copy_subscriptions s
  where s.user_id is not null
  group by s.user_id, s.network
),
mtd as (       -- 本月累计(调整后 = coalesce(manual,真实) 按日求和;真实并列)
  select d.user_id, d.venue,
    sum(coalesce(d.manual_day_pnl_usd, d.day_pnl_usd))                   as adj_mtd_day_pnl,
    sum(coalesce(d.manual_realized_pnl_day_usd, d.realized_pnl_day_usd)) as adj_mtd_realized,
    sum(d.day_pnl_usd)                                                   as real_mtd_day_pnl,
    sum(d.realized_pnl_day_usd)                                          as real_mtd_realized
  from trading_acct_daily d, sgt
  where d.day >= date_trunc('month', sgt.today)::date and d.day <= sgt.today
  group by d.user_id, d.venue
),
adj_delta as ( -- 历史所有 manual 日实现覆盖相对真实的偏移 → 调整后总实现 = 真实累计 + Δ
  select d.user_id, d.venue,
    sum(d.manual_realized_pnl_day_usd - d.realized_pnl_day_usd)
      filter (where d.manual_realized_pnl_day_usd is not null)           as realized_delta
  from trading_acct_daily d
  group by d.user_id, d.venue
),
today as (
  select d.* from trading_acct_daily d, sgt where d.day = sgt.today
),
venues(venue) as (values ('polymarket'), ('hl_mainnet'), ('hl_testnet'))
select
  ob.wallet, ob.level, ob.sources, ob.entitled_at,
  ob.hl_cap_usd, ob.pm_cap_usd,
  ob.user_id, ob.account_status, ob.hl_mode, ob.account_created_at,
  ob.smart_wallet_address, ob.engine_eoa_address,
  tu.hl_master_address, tu.hl_agent_address,
  ham.follower_address as hl_mainnet_address,
  hat.follower_address as hl_testnet_address,
  coalesce(ham.active_subs, 0) as hl_mainnet_active_subs,
  coalesce(hat.active_subs, 0) as hl_testnet_active_subs,
  v.venue,
  -- venue 对应的充值额度(总盈亏 % 的分母;缺省回退当日成本)
  case when v.venue = 'polymarket' then ob.pm_cap_usd else ob.hl_cap_usd end as venue_cap_usd,
  -- ── 调整后(展示值)──
  coalesce(d.manual_position_value_usd, d.position_value_usd, 0) as position_value_usd,
  coalesce(d.open_positions, 0)                                  as open_positions,
  coalesce(d.position_cost_usd, 0)                               as position_cost_usd,
  coalesce(d.manual_unrealized_pnl_usd, d.unrealized_pnl_usd, 0) as unrealized_pnl_usd,
  coalesce(d.manual_realized_pnl_day_usd, d.realized_pnl_day_usd, 0) as realized_pnl_day_usd,
  coalesce(d.manual_day_pnl_usd, d.day_pnl_usd, 0)               as day_pnl_usd,
  coalesce(m.adj_mtd_realized, 0)                                as realized_pnl_mtd_usd,
  coalesce(m.adj_mtd_day_pnl, 0)                                 as day_pnl_mtd_usd,
  coalesce(d.realized_pnl_cum_usd, 0) + coalesce(ad.realized_delta, 0) as realized_pnl_total_usd,
  -- ── 真实(rollup 计算值,对照)──
  coalesce(d.position_value_usd, 0)     as real_position_value_usd,
  coalesce(d.unrealized_pnl_usd, 0)     as real_unrealized_pnl_usd,
  coalesce(d.realized_pnl_day_usd, 0)   as real_realized_pnl_day_usd,
  coalesce(d.day_pnl_usd, 0)            as real_day_pnl_usd,
  coalesce(m.real_mtd_realized, 0)      as real_realized_pnl_mtd_usd,
  coalesce(m.real_mtd_day_pnl, 0)       as real_day_pnl_mtd_usd,
  coalesce(d.realized_pnl_cum_usd, 0)   as real_realized_pnl_total_usd,
  -- ── %(调整后口径;真实 % 由前端用 real_* / 同分母自算,避免列爆炸)──
  round(100 * coalesce(d.manual_unrealized_pnl_usd, d.unrealized_pnl_usd, 0)
    / nullif(coalesce(d.position_cost_usd, 0), 0), 2)            as unrealized_pct,
  round(100 * coalesce(d.manual_realized_pnl_day_usd, d.realized_pnl_day_usd, 0)
    / nullif(coalesce(d.position_cost_usd, 0), 0), 2)            as realized_day_pct,
  round(100 * coalesce(m.adj_mtd_realized, 0)
    / nullif(coalesce(d.position_cost_usd, 0), 0), 2)            as realized_mtd_pct,
  round(100 * (coalesce(d.realized_pnl_cum_usd, 0) + coalesce(ad.realized_delta, 0))
    / nullif(coalesce(case when v.venue = 'polymarket' then ob.pm_cap_usd else ob.hl_cap_usd end,
                      nullif(d.position_cost_usd, 0)), 0), 2)    as realized_total_pct,
  -- 该 venue 持仓金额占该钱包全 venue 之比
  round(100 * coalesce(d.manual_position_value_usd, d.position_value_usd, 0)
    / nullif(sum(coalesce(d.manual_position_value_usd, d.position_value_usd, 0))
               over (partition by ob.wallet), 0), 2)             as position_share_pct,
  -- ── 调整痕迹(admin 双轨展示用)──
  (d.manual_position_value_usd is not null or d.manual_day_pnl_usd is not null
   or d.manual_realized_pnl_day_usd is not null or d.manual_unrealized_pnl_usd is not null) as is_overridden,
  d.manual_note,
  d.hl_today_used_usd, d.snapped_at
from v_admin_onboard_requests ob
cross join venues v
left join trading_users tu on tu.id = ob.user_id
left join hl_addr ham on ham.user_id = ob.user_id and ham.network = 'mainnet'
left join hl_addr hat on hat.user_id = ob.user_id and hat.network = 'testnet'
left join today d on d.user_id = ob.user_id and d.venue = v.venue
left join mtd m on m.user_id = ob.user_id and m.venue = v.venue
left join adj_delta ad on ad.user_id = ob.user_id and ad.venue = v.venue;

grant select on public.v_wallet_open_positions, public.v_admin_trading_accounts to anon, authenticated;

-- ── ④ 统计即时刷新 RPC(admin 专用;改完 overlay/补单后调,免等 10 分钟 cron)────────
create or replace function public.admin_trading_recalc()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    raise exception 'admin_trading_recalc: not an admin';
  end if;
  perform trading_refresh_trade_records();
  perform trading_rollup_daily();
end $$;
revoke execute on function public.admin_trading_recalc() from public, anon;
grant execute on function public.admin_trading_recalc() to authenticated;

-- ── ⑤ trading_rollup_daily v3:PM 手动订单并入实现盈亏 ───────────────────────────
--   HL 的实现盈亏本就由 trade_records 非 snapshot 行驱动(含手动单);PM 之前只看
--   trading_positions.realized_pnl_usd,admin 手动补的 PM 平仓单不联动 → 此版把
--   source='manual' 的 PM 记录累计进 realized_cum(日差分公式自动得出当日值)。
--   仅改 PM 段;HL 段与 2026-06-06 版一致。
create or replace function public.trading_rollup_daily(p_day date default null, p_tz text default 'Asia/Singapore')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_day   date := coalesce(p_day, (now() at time zone p_tz)::date);
  v_start timestamptz := (v_day::timestamp) at time zone p_tz;
  v_end   timestamptz := ((v_day + 1)::timestamp) at time zone p_tz;
begin
  -- ════ Polymarket ════
  with pm_mark as (
    select coalesce(m.symbol, lf.token_id) as token_id, coalesce(m.px, lf.px) as px
    from (select distinct on (token_id) token_id, price as px
          from trading_polymarket_fills where matched_at < v_end
          order by token_id, matched_at desc) lf
    full join (select symbol, px from trading_mark_prices where venue = 'polymarket') m
      on m.symbol = lf.token_id
  ),
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
  -- admin 手动 PM 记录:累计实现盈亏 + 当日平仓笔数(被隐藏的记录视同不存在)
  pm_manual as (
    select r.user_id,
      sum(coalesce(r.realized_pnl_usd, 0)) filter (where r.happened_at < v_end)        as manual_cum,
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
    select coalesce(pos.user_id, fl.user_id, mn.user_id) as user_id,
      coalesce(pos.value_usd, 0)  as value_usd,
      coalesce(pos.cost_usd, 0)   as cost_usd,
      coalesce(pos.value_usd, 0) - coalesce(pos.cost_usd, 0) as unrealized,
      coalesce(pos.realized_cum, 0) + coalesce(mn.manual_cum, 0) as realized_cum,
      coalesce(pos.open_cnt, 0)   as open_cnt,
      coalesce(pos.closed_today, 0) + coalesce(mn.manual_closed_today, 0) as closed_today,
      coalesce(fl.fills_cnt, 0)   as fills_cnt,
      coalesce(fl.fills_notional, 0) as fills_notional
    from pos
    full join fl on fl.user_id = pos.user_id
    full join pm_manual mn on mn.user_id = coalesce(pos.user_id, fl.user_id)
  )
  insert into trading_acct_daily as t
    (user_id, venue, day, position_value_usd, position_cost_usd, unrealized_pnl_usd,
     realized_pnl_cum_usd, realized_pnl_day_usd, day_pnl_usd,
     open_positions, closed_today, fills_today, fills_notional_today_usd, snapped_at)
  select pm.user_id, 'polymarket', v_day, pm.value_usd, pm.cost_usd, pm.unrealized,
    pm.realized_cum,
    pm.realized_cum - coalesce(prev.realized_pnl_cum_usd, pm.realized_cum),
    (pm.realized_cum - coalesce(prev.realized_pnl_cum_usd, pm.realized_cum))
      + (pm.unrealized - coalesce(prev.unrealized_pnl_usd, pm.unrealized)),
    pm.open_cnt, pm.closed_today, pm.fills_cnt, pm.fills_notional, now()
  from pm
  left join lateral (
    select realized_pnl_cum_usd, unrealized_pnl_usd from trading_acct_daily d
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
    open_positions     = excluded.open_positions,
    closed_today       = excluded.closed_today,
    fills_today        = excluded.fills_today,
    fills_notional_today_usd = excluded.fills_notional_today_usd,
    snapped_at         = now();

  -- ════ Hyperliquid ════(与 2026-06-06 版一致:估值按最新行去重,平仓/实现由 trade_records 驱动)
  with hl_sub as (
    select distinct s.user_id, s.network
    from trading_hl_copy_subscriptions s where s.user_id is not null
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
  recs as (
    select r.user_id, r.venue,
      count(*) as closed_cnt,
      sum(coalesce(r.realized_pnl_usd, 0)) as realized_day
    from trading_trade_records r
    where r.venue like 'hl\_%' escape '\'
      and r.record_type <> 'position_snapshot'
      and r.happened_at >= v_start and r.happened_at < v_end
      and not exists (select 1 from trading_record_hidden h where h.record_id = r.record_id)
    group by r.user_id, r.venue
  ),
  hl as (
    select b.user_id, ('hl_' || b.network) as venue,
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
     open_positions, closed_today, fills_today, fills_notional_today_usd, hl_today_used_usd, snapped_at)
  select hl.user_id, hl.venue, v_day,
    coalesce(hl.value_usd,0), coalesce(hl.cost_usd,0), coalesce(hl.unrealized,0),
    coalesce(prev.realized_pnl_cum_usd, 0) + coalesce(r.realized_day, 0),
    coalesce(r.realized_day, 0),
    coalesce(r.realized_day, 0)
      + (coalesce(hl.unrealized,0) - coalesce(prev.unrealized_pnl_usd, coalesce(hl.unrealized,0))),
    coalesce(hl.open_cnt,0), coalesce(r.closed_cnt,0), 0, 0, hl.today_used, now()
  from hl
  left join recs r on r.user_id = hl.user_id and r.venue = hl.venue
  left join lateral (
    select realized_pnl_cum_usd, unrealized_pnl_usd from trading_acct_daily d
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
    open_positions     = excluded.open_positions,
    closed_today       = excluded.closed_today,
    hl_today_used_usd  = excluded.hl_today_used_usd,
    snapped_at         = now();
end $$;

-- ── ⑥ v_trade_records:排除被隐藏的记录(admin「隐藏订单」= 展示+统计一并消失)────
create or replace view public.v_trade_records as
select venue, record_type, user_id, wallet, market_id, symbol, side,
  price, size, notional_usd, happened_at, record_id,
  source, realized_pnl_usd, created_at, tx_hash
from trading_trade_records r
where not (record_type = 'position_snapshot'
           and coalesce(size, 0) = 0 and coalesce(notional_usd, 0) = 0)
  and not exists (select 1 from trading_record_hidden h where h.record_id = r.record_id);
