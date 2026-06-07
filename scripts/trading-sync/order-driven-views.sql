-- order-driven-views.sql — 配合 order-driven-stats.sql 的视图改造。
-- real_* 改指向 sync_*(纯真实);展示列直接用主列(show=sync+manual),去掉 coalesce(manual_*) 字段覆盖;
-- is_overridden 改为「show ≠ sync」(有复制/manual 单导致展示≠真实),不再看废弃的 manual_* 字段。
-- 跑在 mefjuecwawmjfmeofnck。幂等。列名/顺序/类型与原视图一致(create or replace 要求)。

-- ── v_wallet_daily_history ─────────────────────────────────────────────────
create or replace view public.v_wallet_daily_history as
select u.smart_wallet_address as wallet,
  u.engine_eoa_address,
  u.status as account_status,
  d.user_id, d.venue, d.day,
  d.position_value_usd,                                            -- show(主列)
  round(100 * d.position_value_usd
    / nullif(sum(d.position_value_usd) over (partition by d.user_id, d.day), 0), 2) as position_share_pct,
  d.position_cost_usd,
  d.day_pnl_usd,
  round(100 * d.day_pnl_usd / nullif(d.position_cost_usd, 0), 2) as day_pnl_pct,
  d.realized_pnl_day_usd,
  round(100 * d.realized_pnl_day_usd / nullif(d.position_cost_usd, 0), 2) as realized_day_pct,
  d.unrealized_pnl_usd,
  round(100 * d.unrealized_pnl_usd / nullif(d.position_cost_usd, 0), 2) as unrealized_pct,
  d.realized_pnl_cum_usd,
  sum(d.day_pnl_usd) over (partition by d.user_id, d.venue, date_trunc('month', d.day::timestamptz) order by d.day) as mtd_pnl_usd,
  round(100 * sum(d.day_pnl_usd) over (partition by d.user_id, d.venue, date_trunc('month', d.day::timestamptz) order by d.day)
    / nullif(first_value(d.position_cost_usd) over (partition by d.user_id, d.venue, date_trunc('month', d.day::timestamptz) order by d.day), 0), 2) as mtd_pnl_pct,
  d.unrealized_pnl_usd as mtd_unrealized_pnl_usd,
  round(100 * d.unrealized_pnl_usd / nullif(d.position_cost_usd, 0), 2) as mtd_unrealized_pct,
  d.open_positions, d.closed_today, d.fills_today, d.fills_notional_today_usd, d.hl_today_used_usd, d.snapped_at,
  -- real = 纯真实(sync,只 source=sync 真实成交)
  d.sync_position_value_usd   as real_position_value_usd,
  d.sync_day_pnl_usd          as real_day_pnl_usd,
  d.sync_realized_pnl_day_usd as real_realized_pnl_day_usd,
  d.sync_unrealized_pnl_usd   as real_unrealized_pnl_usd,
  (d.position_value_usd is distinct from d.sync_position_value_usd
   or d.day_pnl_usd is distinct from d.sync_day_pnl_usd
   or d.realized_pnl_day_usd is distinct from d.sync_realized_pnl_day_usd
   or d.unrealized_pnl_usd is distinct from d.sync_unrealized_pnl_usd) as is_overridden,
  d.manual_note
from trading_acct_daily d
join trading_users u on u.id = d.user_id;

-- ── v_admin_trading_accounts ───────────────────────────────────────────────
create or replace view public.v_admin_trading_accounts as
with sgt as (select (now() at time zone 'Asia/Singapore')::date as today),
hl_addr as (
  select s.user_id, s.network, max(s.follower_address) as follower_address,
    count(*) filter (where s.status = 'active') as active_subs
  from trading_hl_copy_subscriptions s where s.user_id is not null
  group by s.user_id, s.network
),
mtd as (   -- show = 主列;real = sync_*
  select d.user_id, d.venue,
    sum(d.day_pnl_usd)              as adj_mtd_day_pnl,
    sum(d.realized_pnl_day_usd)     as adj_mtd_realized,
    sum(d.sync_day_pnl_usd)         as real_mtd_day_pnl,
    sum(d.sync_realized_pnl_day_usd) as real_mtd_realized
  from trading_acct_daily d, sgt
  where d.day >= date_trunc('month', sgt.today::timestamptz)::date and d.day <= sgt.today
  group by d.user_id, d.venue
),
today as (select d.* from trading_acct_daily d, sgt where d.day = sgt.today),
venues(venue) as (values ('polymarket'), ('hl_mainnet'), ('hl_testnet'))
select ob.wallet, ob.level, ob.sources, ob.entitled_at, ob.hl_cap_usd, ob.pm_cap_usd,
  ob.user_id, ob.account_status, ob.hl_mode, ob.account_created_at,
  ob.smart_wallet_address, ob.engine_eoa_address,
  tu.hl_master_address, tu.hl_agent_address,
  ham.follower_address as hl_mainnet_address, hat.follower_address as hl_testnet_address,
  coalesce(ham.active_subs, 0::bigint) as hl_mainnet_active_subs,
  coalesce(hat.active_subs, 0::bigint) as hl_testnet_active_subs,
  v.venue,
  case when v.venue = 'polymarket' then ob.pm_cap_usd else ob.hl_cap_usd end as venue_cap_usd,
  -- 展示值(show = 主列)
  coalesce(d.position_value_usd, 0::numeric)   as position_value_usd,
  coalesce(d.open_positions, 0)                as open_positions,
  coalesce(d.position_cost_usd, 0::numeric)    as position_cost_usd,
  coalesce(d.unrealized_pnl_usd, 0::numeric)   as unrealized_pnl_usd,
  coalesce(d.realized_pnl_day_usd, 0::numeric) as realized_pnl_day_usd,
  coalesce(d.day_pnl_usd, 0::numeric)          as day_pnl_usd,
  coalesce(m.adj_mtd_realized, 0::numeric)     as realized_pnl_mtd_usd,
  coalesce(m.adj_mtd_day_pnl, 0::numeric)      as day_pnl_mtd_usd,
  coalesce(d.realized_pnl_cum_usd, 0::numeric) as realized_pnl_total_usd,
  -- real = 纯真实(sync)
  coalesce(d.sync_position_value_usd, 0::numeric)   as real_position_value_usd,
  coalesce(d.sync_unrealized_pnl_usd, 0::numeric)   as real_unrealized_pnl_usd,
  coalesce(d.sync_realized_pnl_day_usd, 0::numeric) as real_realized_pnl_day_usd,
  coalesce(d.sync_day_pnl_usd, 0::numeric)          as real_day_pnl_usd,
  coalesce(m.real_mtd_realized, 0::numeric)         as real_realized_pnl_mtd_usd,
  coalesce(m.real_mtd_day_pnl, 0::numeric)          as real_day_pnl_mtd_usd,
  coalesce(d.sync_realized_pnl_cum_usd, 0::numeric) as real_realized_pnl_total_usd,
  -- %(show 口径)
  round(100 * coalesce(d.unrealized_pnl_usd, 0::numeric) / nullif(coalesce(d.position_cost_usd, 0::numeric), 0::numeric), 2) as unrealized_pct,
  round(100 * coalesce(d.realized_pnl_day_usd, 0::numeric) / nullif(coalesce(d.position_cost_usd, 0::numeric), 0::numeric), 2) as realized_day_pct,
  round(100 * coalesce(m.adj_mtd_realized, 0::numeric) / nullif(coalesce(d.position_cost_usd, 0::numeric), 0::numeric), 2) as realized_mtd_pct,
  round(100 * coalesce(d.realized_pnl_cum_usd, 0::numeric)
    / nullif(coalesce(case when v.venue = 'polymarket' then ob.pm_cap_usd else ob.hl_cap_usd end,
                      nullif(d.position_cost_usd, 0::numeric)), 0::numeric), 2) as realized_total_pct,
  round(100 * coalesce(d.position_value_usd, 0::numeric)
    / nullif(sum(coalesce(d.position_value_usd, 0::numeric)) over (partition by ob.wallet), 0::numeric), 2) as position_share_pct,
  -- 调整痕迹:show ≠ sync(有复制/manual 单)
  (coalesce(d.position_value_usd,0) is distinct from coalesce(d.sync_position_value_usd,0)
   or coalesce(d.day_pnl_usd,0) is distinct from coalesce(d.sync_day_pnl_usd,0)
   or coalesce(d.realized_pnl_day_usd,0) is distinct from coalesce(d.sync_realized_pnl_day_usd,0)
   or coalesce(d.unrealized_pnl_usd,0) is distinct from coalesce(d.sync_unrealized_pnl_usd,0)) as is_overridden,
  d.manual_note, d.hl_today_used_usd, d.snapped_at
from v_admin_onboard_requests ob
cross join venues v
left join trading_users tu on tu.id = ob.user_id
left join hl_addr ham on ham.user_id = ob.user_id and ham.network = 'mainnet'
left join hl_addr hat on hat.user_id = ob.user_id and hat.network = 'testnet'
left join today d on d.user_id = ob.user_id and d.venue = v.venue
left join mtd m on m.user_id = ob.user_id and m.venue = v.venue;

grant select on public.v_wallet_daily_history, public.v_admin_trading_accounts to anon, authenticated;
