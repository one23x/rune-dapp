-- stats-schema.sql — 在 trading_* 已同步数据之上新增的统计表 + views(additive,不改 trading-sync)。
-- 跑在 rune-dapp Supabase(mefjuecwawmjfmeofnck)。幂等,可重复执行。
--
-- 口径说明:
--   venue 三类:polymarket / hl_mainnet / hl_testnet(HL 按 trading_hl_copy_subscriptions.network 区分)。
--   「当日」边界 = Asia/Singapore(UTC+8)自然日。
--   标记价(算浮盈):优先 trading_mark_prices;PM 回退到全网最近成交价;HL 回退到 avg_entry_px(此时浮盈=0)。
--   PM 实现盈亏 = trading_positions.realized_pnl_usd(累计),当日实现 = 当天累计 − 前一日快照累计。
--   HL 没有 follower 成交流水(RDS 仅 leader 信号流),实现盈亏自首个快照日起按持仓增量积累,历史不可回溯。
--   百分比基准:盈亏类 % 以「当日持仓成本」为分母;持仓占比 % 以该钱包当日全 venue 持仓总额为分母。

-- ── 标记价格表(hl-marks.mjs 每分钟喂 HL 主/测网 mids;PM symbol=token_id)──────
create table if not exists public.trading_mark_prices (
  venue   text not null,              -- 'polymarket' | 'hl_mainnet' | 'hl_testnet'
  symbol  text not null,
  px      numeric not null,
  as_of   timestamptz not null default now(),
  primary key (venue, symbol)
);

-- ── 每账户·每 venue·每日快照(rollup 函数写入,当日行可反复刷新)────────────────
create table if not exists public.trading_acct_daily (
  user_id                  uuid not null,
  venue                    text not null,   -- polymarket | hl_mainnet | hl_testnet
  day                      date not null,
  is_manual                boolean not null default false,  -- 手动补充/修正的行,rollup 不覆盖
  position_value_usd       numeric not null default 0,  -- 当日持仓金额(标记价估值)
  position_cost_usd        numeric not null default 0,  -- 当日持仓成本
  unrealized_pnl_usd       numeric not null default 0,  -- 当日浮盈亏
  realized_pnl_cum_usd     numeric not null default 0,  -- 累计实现盈亏
  realized_pnl_day_usd     numeric not null default 0,  -- 当日实现盈亏(累计差分)
  day_pnl_usd              numeric not null default 0,  -- 每日盈亏 = 当日实现 + 浮盈变化
  open_positions           int     not null default 0,
  closed_today             int     not null default 0,
  fills_today              int     not null default 0,
  fills_notional_today_usd numeric not null default 0,
  hl_today_used_usd        numeric,                     -- HL 订阅当日已用额度(来自源表)
  snapped_at               timestamptz not null default now(),
  primary key (user_id, venue, day)
);
create index if not exists trading_acct_daily_day_idx on public.trading_acct_daily (day, venue);
alter table public.trading_acct_daily add column if not exists is_manual boolean not null default false;

-- ── 交易记录实体表(前端读这张;刷新只追加 on conflict do nothing,手动行永不被删/改)──
--    sync 行 record_id 规则:PM 成交 'fill:<fill_id>';HL 持仓变动 'hlpos:<pos_id>:<updated_at epoch>'
--    手动补单:直接 insert,record_id 自定义(如 'manual:xxx'),source 默认 'manual'
create table if not exists public.trading_trade_records (
  record_id        text primary key,
  source           text not null default 'manual',   -- 'sync' | 'manual'
  venue            text not null,                    -- polymarket | hl_mainnet | hl_testnet
  record_type      text not null default 'order',    -- fill | position_snapshot | order ...
  user_id          uuid,
  wallet           text,
  market_id        text,
  symbol           text,
  side             text,
  price            numeric,
  size             numeric,
  notional_usd     numeric,
  realized_pnl_usd numeric,
  happened_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists trading_trade_records_wallet_idx on public.trading_trade_records (wallet, happened_at desc);
create index if not exists trading_trade_records_venue_idx  on public.trading_trade_records (venue, happened_at desc);

-- 追加式刷新:从同步表抽新记录进 trading_trade_records(只 insert,绝不 update/delete)
create or replace function public.trading_refresh_trade_records()
returns void language sql security definer set search_path = public as $$
  -- Polymarket 成交
  insert into trading_trade_records
    (record_id, source, venue, record_type, user_id, wallet, market_id, symbol, side, price, size, notional_usd, happened_at)
  select 'fill:' || f.id, 'sync', 'polymarket', 'fill',
    f.user_id, u.smart_wallet_address, f.market_id, f.token_id, f.side,
    f.price, f.size_shares, f.notional_usd, f.matched_at
  from trading_polymarket_fills f
  left join trading_users u on u.id = f.user_id
  on conflict (record_id) do nothing;
  -- HL 持仓变动快照(updated_at 变一次 → 追加一条,形成事件流)
  insert into trading_trade_records
    (record_id, source, venue, record_type, user_id, wallet, market_id, symbol, side, price, size, notional_usd, happened_at)
  select 'hlpos:' || hp.id || ':' || floor(extract(epoch from hp.updated_at)),
    'sync', 'hl_' || s.network, 'position_snapshot',
    s.user_id, u.smart_wallet_address, hp.coin, hp.coin,
    case when hp.size_base > 0 then 'long' when hp.size_base < 0 then 'short' else 'flat' end,
    hp.avg_entry_px, hp.size_base,
    abs(coalesce(hp.size_base,0)) * coalesce(hp.avg_entry_px,0), hp.updated_at
  from trading_hl_positions hp
  join trading_hl_copy_subscriptions s on s.id = hp.subscription_id
  left join trading_users u on u.id = s.user_id
  on conflict (record_id) do nothing;
$$;

-- ── 当日滚动快照函数(幂等 upsert;pg_cron 每 10 分钟刷当日行)──────────────────
create or replace function public.trading_rollup_daily(p_day date default null, p_tz text default 'Asia/Singapore')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_day   date := coalesce(p_day, (now() at time zone p_tz)::date);
  v_start timestamptz := (v_day::timestamp) at time zone p_tz;
  v_end   timestamptz := ((v_day + 1)::timestamp) at time zone p_tz;
begin
  -- ════ Polymarket ════
  with pm_mark as (  -- token 标记价:mark_prices 优先,否则全网最近成交价
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
  fl as (
    select user_id, count(*) as fills_cnt, sum(coalesce(notional_usd,0)) as fills_notional
    from trading_polymarket_fills
    where matched_at >= v_start and matched_at < v_end
    group by user_id
  ),
  pm as (
    select coalesce(pos.user_id, fl.user_id) as user_id,
      coalesce(pos.value_usd, 0)  as value_usd,
      coalesce(pos.cost_usd, 0)   as cost_usd,
      coalesce(pos.value_usd, 0) - coalesce(pos.cost_usd, 0) as unrealized,
      coalesce(pos.realized_cum, 0) as realized_cum,
      coalesce(pos.open_cnt, 0)   as open_cnt,
      coalesce(pos.closed_today, 0) as closed_today,
      coalesce(fl.fills_cnt, 0)   as fills_cnt,
      coalesce(fl.fills_notional, 0) as fills_notional
    from pos full join fl on fl.user_id = pos.user_id
  )
  insert into trading_acct_daily as t
    (user_id, venue, day, position_value_usd, position_cost_usd, unrealized_pnl_usd,
     realized_pnl_cum_usd, realized_pnl_day_usd, day_pnl_usd,
     open_positions, closed_today, fills_today, fills_notional_today_usd, snapped_at)
  select pm.user_id, 'polymarket', v_day, pm.value_usd, pm.cost_usd, pm.unrealized,
    pm.realized_cum,
    pm.realized_cum - coalesce(prev.realized_pnl_cum_usd, pm.realized_cum),  -- 首日记 0,之后为日差分
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
    snapped_at         = now()
  where t.is_manual = false;

  -- ════ Hyperliquid(mainnet / testnet 按订阅 network)════
  with hl as (
    select s.user_id, ('hl_' || s.network) as venue,
      sum(abs(coalesce(hp.size_base,0)) * coalesce(mk.px, hp.avg_entry_px, 0))      as value_usd,
      sum(abs(coalesce(hp.size_base,0)) * coalesce(hp.avg_entry_px, 0))             as cost_usd,
      sum(coalesce(hp.size_base,0) * (coalesce(mk.px, hp.avg_entry_px, 0) - coalesce(hp.avg_entry_px, 0))) as unrealized,
      count(*) filter (where hp.size_base is distinct from 0)                       as open_cnt,
      count(*) filter (where hp.size_base = 0
               and hp.updated_at >= v_start and hp.updated_at < v_end)              as closed_today,
      sum(coalesce(s.today_used_usd, 0))                                            as today_used
    from trading_hl_copy_subscriptions s
    left join trading_hl_positions hp on hp.subscription_id = s.id
    left join trading_mark_prices mk on mk.venue = 'hl_' || s.network and mk.symbol = hp.coin
    where s.user_id is not null
    group by s.user_id, s.network
  )
  insert into trading_acct_daily as t
    (user_id, venue, day, position_value_usd, position_cost_usd, unrealized_pnl_usd,
     realized_pnl_cum_usd, realized_pnl_day_usd, day_pnl_usd,
     open_positions, closed_today, fills_today, fills_notional_today_usd, hl_today_used_usd, snapped_at)
  select hl.user_id, hl.venue, v_day,
    coalesce(hl.value_usd,0), coalesce(hl.cost_usd,0), coalesce(hl.unrealized,0),
    coalesce(prev.realized_pnl_cum_usd, 0),   -- HL 无成交流水:实现盈亏只能延续前值(快照日起积累)
    0,
    coalesce(hl.unrealized,0) - coalesce(prev.unrealized_pnl_usd, coalesce(hl.unrealized,0)),
    coalesce(hl.open_cnt,0), coalesce(hl.closed_today,0), 0, 0, hl.today_used, now()
  from hl
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
    snapped_at         = now()
  where t.is_manual = false;
end $$;

-- ── HL 前端显示覆盖(统计数字;某字段非 null = 用该值替代引擎真实值)──────────────
--   管理方式:SQL editor 直接 upsert;删行或字段置 null 即恢复真实值。
create table if not exists public.trading_hl_overrides (
  wallet             text not null,    -- 用户连接的 smart wallet(大小写不敏感匹配)
  network            text not null,    -- 'mainnet' | 'testnet'
  account_value_usd  numeric,          -- 账户净值
  withdrawable_usd   numeric,          -- 可用/可提
  unrealized_pnl_usd numeric,          -- 未实现盈亏
  today_pnl_usd      numeric,          -- 当日盈亏
  follow_count       integer,          -- 跟单中数量
  note               text,
  updated_at         timestamptz not null default now(),
  primary key (wallet, network)
);

-- ── HL 手动持仓(叠加/替换/隐藏真实持仓的显示)────────────────────────────────
--   mode: 'add' = 追加一行显示;'replace' = 替换同币种真实仓位;'hide' = 隐藏该币种(size 随意填 0)
create table if not exists public.trading_hl_manual_positions (
  id                 uuid primary key default gen_random_uuid(),
  wallet             text not null,
  network            text not null,    -- 'mainnet' | 'testnet'
  coin               text not null,
  size               numeric not null default 0,  -- 正=多 负=空
  entry_px           numeric,
  mark_px            numeric,
  unrealized_pnl_usd numeric,          -- null → 按 size*(mark-entry) 算
  leverage           numeric,
  mode               text not null default 'add',
  active             boolean not null default true,
  updated_at         timestamptz not null default now()
);
create index if not exists trading_hl_manual_pos_wallet_idx on public.trading_hl_manual_positions (lower(wallet), network) where active;

-- ══════════════════════ Views ══════════════════════

-- ── ① 交易记录(前端读这个;来源 = trading_trade_records 实体表,含手动补充行)────
--    三类 venue:polymarket / hl_mainnet / hl_testnet
create or replace view public.v_trade_records as
select venue, record_type, user_id, wallet, market_id, symbol, side,
  price, size, notional_usd, happened_at, record_id,
  source, realized_pnl_usd, created_at
from trading_trade_records;

-- ── ② 按钱包看交易账户 + 历史每日各项数据(金额 + 百分比)────────────────────────
create or replace view public.v_wallet_daily_history as
select
  u.smart_wallet_address as wallet,
  u.engine_eoa_address,
  u.status               as account_status,
  d.user_id, d.venue, d.day,
  d.position_value_usd,                                          -- 当日持仓金额
  round(100 * d.position_value_usd
    / nullif(sum(d.position_value_usd) over (partition by d.user_id, d.day), 0), 2)
                          as position_share_pct,                 -- 当日持仓占比 %(占该钱包全 venue)
  d.position_cost_usd,
  d.day_pnl_usd,                                                 -- 每日盈亏金额
  round(100 * d.day_pnl_usd / nullif(d.position_cost_usd, 0), 2) as day_pnl_pct,
  d.realized_pnl_day_usd,                                        -- 当日实现盈亏金额
  round(100 * d.realized_pnl_day_usd / nullif(d.position_cost_usd, 0), 2) as realized_day_pct,
  d.unrealized_pnl_usd,                                          -- 当日浮盈亏金额
  round(100 * d.unrealized_pnl_usd / nullif(d.position_cost_usd, 0), 2)   as unrealized_pct,
  d.realized_pnl_cum_usd,
  sum(d.day_pnl_usd) over (partition by d.user_id, d.venue, date_trunc('month', d.day)
                           order by d.day)                       as mtd_pnl_usd,         -- 当月累计盈亏
  round(100 * sum(d.day_pnl_usd) over (partition by d.user_id, d.venue, date_trunc('month', d.day)
                           order by d.day)
    / nullif(first_value(d.position_cost_usd) over (partition by d.user_id, d.venue, date_trunc('month', d.day)
                           order by d.day), 0), 2)               as mtd_pnl_pct,
  d.unrealized_pnl_usd   as mtd_unrealized_pnl_usd,              -- 当月浮盈亏(=最新浮动盈亏)
  round(100 * d.unrealized_pnl_usd / nullif(d.position_cost_usd, 0), 2) as mtd_unrealized_pct,
  d.open_positions, d.closed_today, d.fills_today, d.fills_notional_today_usd,
  d.hl_today_used_usd, d.snapped_at
from trading_acct_daily d
join trading_users u on u.id = d.user_id;

-- ── ③ 按钱包看当日持仓明细(实时,直接从源表算)─────────────────────────────────
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
  p.realized_pnl_usd, p.last_fill_at, p.updated_at
from trading_positions p
join trading_users u on u.id = p.user_id
left join pm_mark mk on mk.token_id = p.token_id
where p.net_shares is distinct from 0
  and coalesce(p.settlement_status,'') not in ('closed','redeemed','settled','resolved')
union all
-- HL 按 (用户, 网络, 币种) 聚合 —— 一个用户多条订阅持同币时合并成一行,入场价按规模加权
select ('hl_' || s.network), u.smart_wallet_address, s.user_id,
  hp.coin, hp.coin,
  sum(hp.size_base),
  sum(abs(hp.size_base) * coalesce(hp.avg_entry_px, 0)) / nullif(sum(abs(hp.size_base)), 0),
  max(mk.px),
  sum(abs(hp.size_base) * coalesce(mk.px, hp.avg_entry_px, 0)),
  sum(abs(hp.size_base) * coalesce(hp.avg_entry_px, 0)),
  sum(hp.size_base * (coalesce(mk.px, hp.avg_entry_px, 0) - coalesce(hp.avg_entry_px, 0))),
  null, null, max(hp.updated_at)
from trading_hl_positions hp
join trading_hl_copy_subscriptions s on s.id = hp.subscription_id
join trading_users u on u.id = s.user_id
left join trading_mark_prices mk on mk.venue = 'hl_' || s.network and mk.symbol = hp.coin
where hp.size_base is distinct from 0
group by s.network, u.smart_wallet_address, s.user_id, hp.coin;

-- ── ④ 按钱包看当日平仓/成交记录(UTC+8 当日)───────────────────────────────────
create or replace view public.v_wallet_today_closed as
select 'polymarket'::text as venue, 'fill'::text as record_type,
  u.smart_wallet_address as wallet, f.user_id,
  f.market_id, f.token_id as symbol, f.side, f.price, f.size_shares as size,
  f.notional_usd, null::numeric as realized_pnl_usd, f.matched_at as happened_at
from trading_polymarket_fills f
join trading_users u on u.id = f.user_id
where f.matched_at >= (((now() at time zone 'Asia/Singapore')::date)::timestamp at time zone 'Asia/Singapore')
union all
select 'polymarket', 'position_closed',
  u.smart_wallet_address, p.user_id,
  p.market_id, p.token_id, p.settlement_status, p.avg_entry_price, null,
  p.total_sold_usd + coalesce(p.redeem_proceeds_usd, 0), p.realized_pnl_usd, p.updated_at
from trading_positions p
join trading_users u on u.id = p.user_id
where (p.net_shares = 0 or coalesce(p.settlement_status,'') in ('closed','redeemed','settled','resolved'))
  and p.updated_at >= (((now() at time zone 'Asia/Singapore')::date)::timestamp at time zone 'Asia/Singapore')
union all
select ('hl_' || s.network), 'position_closed',
  u.smart_wallet_address, s.user_id,
  hp.coin, hp.coin, 'flat', hp.avg_entry_px, null, null, null, hp.updated_at
from trading_hl_positions hp
join trading_hl_copy_subscriptions s on s.id = hp.subscription_id
join trading_users u on u.id = s.user_id
where hp.size_base = 0
  and hp.updated_at >= (((now() at time zone 'Asia/Singapore')::date)::timestamp at time zone 'Asia/Singapore');

-- ── ⑤ 按钱包看当日统计(快照表当日行 + 持仓/平仓汇总)──────────────────────────
create or replace view public.v_wallet_today_stats as
select h.*
from v_wallet_daily_history h
where h.day = (now() at time zone 'Asia/Singapore')::date;

-- ── ⑥ 亏损监控:当日浮亏 或 当日实现亏损 的账户────────────────────────────────
create or replace view public.v_loss_monitor_today as
select
  u.smart_wallet_address as wallet,
  u.engine_eoa_address,
  d.user_id, d.venue, d.day,
  (d.unrealized_pnl_usd < 0)   as is_unrealized_loss,
  (d.realized_pnl_day_usd < 0) as is_realized_loss,
  d.unrealized_pnl_usd,
  round(100 * d.unrealized_pnl_usd / nullif(d.position_cost_usd, 0), 2)   as unrealized_pct,
  d.realized_pnl_day_usd,
  round(100 * d.realized_pnl_day_usd / nullif(d.position_cost_usd, 0), 2) as realized_day_pct,
  d.day_pnl_usd,
  round(100 * d.day_pnl_usd / nullif(d.position_cost_usd, 0), 2)          as day_pnl_pct,
  d.position_value_usd, d.position_cost_usd, d.open_positions, d.snapped_at
from trading_acct_daily d
join trading_users u on u.id = d.user_id
where d.day = (now() at time zone 'Asia/Singapore')::date
  and (d.unrealized_pnl_usd < 0 or d.realized_pnl_day_usd < 0)
order by least(d.unrealized_pnl_usd, d.realized_pnl_day_usd) asc;

-- ── 权限(沿用既有 trading_* 模式:前端 anon/authenticated 只读)────────────────
grant select on public.trading_mark_prices, public.trading_acct_daily, public.trading_trade_records,
  public.trading_hl_overrides, public.trading_hl_manual_positions,
  public.v_trade_records, public.v_wallet_daily_history, public.v_wallet_open_positions,
  public.v_wallet_today_closed, public.v_wallet_today_stats, public.v_loss_monitor_today
  to anon, authenticated;
revoke execute on function public.trading_rollup_daily(date, text) from public, anon, authenticated;
revoke execute on function public.trading_refresh_trade_records() from public, anon, authenticated;

-- RLS:项目对新表自动启用 RLS → 前端(anon)直读表需要只读 policy;写入仍只能走
-- SQL editor / service_role(无 insert/update policy = 默认拒绝)。幂等创建。
do $$
declare t text;
begin
  foreach t in array array['trading_mark_prices','trading_acct_daily','trading_trade_records',
                           'trading_hl_overrides','trading_hl_manual_positions'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='public_read') then
      execute format('create policy public_read on public.%I for select to anon, authenticated using (true)', t);
    end if;
  end loop;
end $$;
