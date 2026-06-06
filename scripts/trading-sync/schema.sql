-- rune-dapp Supabase serving schema for trading data synced FROM us-east RDS rune-prod-pg (trading schema).
-- Additive only: trading_* prefix, never touches existing rune_*/ai_* tables. Idempotent (IF NOT EXISTS / OR REPLACE).
-- Run once against the rune-dapp Supabase (db.mefjuecwawmjfmeofnck) before the first sync.

-- ── 交易账户 ─────────────────────────────────────────────────────────────────
create table if not exists public.trading_users (
  id                  uuid primary key,
  smart_wallet_address text,
  engine_eoa_address  text,
  status              text,
  project_id          uuid,
  created_at          timestamptz,
  updated_at          timestamptz,
  synced_at           timestamptz default now()
);
create index if not exists trading_users_wallet_idx on public.trading_users (lower(smart_wallet_address));

-- ── Polymarket 持仓/平仓(无单一主键 → 合成键 user_id+market_id+token_id)──────
create table if not exists public.trading_positions (
  user_id            uuid not null,
  project_id         uuid,
  token_id           text not null default '',
  market_id          text not null default '',
  net_shares         numeric,
  avg_entry_price    numeric,
  realized_pnl_usd   numeric,
  total_bought_usd   numeric,
  total_sold_usd     numeric,
  last_fill_at       timestamptz,
  settlement_status  text,
  redeem_proceeds_usd numeric,
  updated_at         timestamptz,
  synced_at          timestamptz default now(),
  primary key (user_id, market_id, token_id)
);

-- ── HL 持仓 ──────────────────────────────────────────────────────────────────
create table if not exists public.trading_hl_positions (
  id              uuid primary key,
  subscription_id uuid,
  coin            text,
  size_base       numeric,
  avg_entry_px    numeric,
  last_signal_id  uuid,
  updated_at      timestamptz,
  synced_at       timestamptz default now()
);

-- ── 订单/交易(去 raw_request/raw_response 大 jsonb)──────────────────────────
create table if not exists public.trading_orders (
  id            uuid primary key,
  user_id       uuid,
  venue         text,
  venue_order_id text,
  market_id     text,
  token_id      text,
  side          smallint,
  price         numeric,
  size          numeric,
  filled_size   numeric,
  status        text,
  created_at    timestamptz,
  updated_at    timestamptz,
  project_id    uuid,
  synced_at     timestamptz default now()
);
create index if not exists trading_orders_user_idx on public.trading_orders (user_id);

-- ── 信号交易(含 pnl）────────────────────────────────────────────────────────
create table if not exists public.trading_signal_trades (
  id             uuid primary key,
  source         text,
  market_id      text,
  token_id       text,
  action         text,
  side           smallint,
  limit_price    numeric,
  notional_usd   numeric,
  strength       numeric,
  issued_at      timestamptz,
  pnl_usd        numeric,
  closed_at      timestamptz,
  created_at     timestamptz,
  origin_kind    text,
  origin_user_id uuid,
  synced_at      timestamptz default now()
);

-- ── 成交(去 raw jsonb）──────────────────────────────────────────────────────
create table if not exists public.trading_polymarket_fills (
  id           text primary key,
  user_id      uuid,
  project_id   uuid,
  market_id    text,
  token_id     text,
  side         text,
  size_shares  numeric,
  price        numeric,
  notional_usd numeric,
  fee_rate_bps integer,
  matched_at   timestamptz,
  order_id     uuid,
  created_at   timestamptz,
  synced_at    timestamptz default now()
);
create index if not exists trading_fills_user_idx on public.trading_polymarket_fills (user_id);
create index if not exists trading_fills_matched_idx on public.trading_polymarket_fills (matched_at);

-- ── 跟单订阅(Polymarket / HL）───────────────────────────────────────────────
create table if not exists public.trading_copy_subscriptions (
  id             uuid primary key,
  project_id     uuid,
  user_id        uuid,
  leader_wallet  text,
  status         text,
  notional_ratio numeric,
  notional_cap_usd numeric,
  daily_cap_usd  numeric,
  today_used_usd numeric,
  created_at     timestamptz,
  updated_at     timestamptz,
  synced_at      timestamptz default now()
);
create table if not exists public.trading_hl_copy_subscriptions (
  id               uuid primary key,
  project_id       uuid,
  user_id          uuid,
  leader_address   text,
  follower_address text,
  notional_ratio   numeric,
  notional_cap_usd numeric,
  daily_cap_usd    numeric,
  today_used_usd   numeric,
  max_leverage     integer,
  status           text,
  network          text,
  take_profit_pct  numeric,
  created_at       timestamptz,
  updated_at       timestamptz,
  synced_at        timestamptz default now()
);

-- ══ 统计 view(Supabase 为准,dapp 从这读)═══════════════════════════════════

-- 每账户累计统计:已实现 pnl、开/平仓数、订单/成交笔数、总名义额、最近活动
create or replace view public.v_user_trading_stats as
select
  u.id                                   as user_id,
  u.smart_wallet_address,
  u.engine_eoa_address,
  u.status,
  coalesce(p.open_positions, 0)          as open_positions,
  coalesce(p.closed_positions, 0)        as closed_positions,
  coalesce(p.realized_pnl_usd, 0)        as realized_pnl_usd,
  coalesce(p.total_bought_usd, 0)        as total_bought_usd,
  coalesce(p.total_sold_usd, 0)          as total_sold_usd,
  coalesce(o.orders_count, 0)            as orders_count,
  coalesce(f.fills_count, 0)             as fills_count,
  coalesce(f.fills_notional_usd, 0)      as fills_notional_usd,
  greatest(u.updated_at, p.last_activity, o.last_activity, f.last_activity) as last_activity
from public.trading_users u
left join (
  select user_id,
    count(*) filter (where net_shares is distinct from 0
      and coalesce(settlement_status,'') not in ('closed','redeemed','settled','resolved')) as open_positions,
    count(*) filter (where net_shares = 0
      or coalesce(settlement_status,'') in ('closed','redeemed','settled','resolved'))      as closed_positions,
    sum(realized_pnl_usd) as realized_pnl_usd,
    sum(total_bought_usd) as total_bought_usd,
    sum(total_sold_usd)   as total_sold_usd,
    max(last_fill_at)     as last_activity
  from public.trading_positions group by user_id
) p on p.user_id = u.id
left join (
  select user_id, count(*) as orders_count, max(created_at) as last_activity
  from public.trading_orders group by user_id
) o on o.user_id = u.id
left join (
  select user_id, count(*) as fills_count, sum(notional_usd) as fills_notional_usd, max(matched_at) as last_activity
  from public.trading_polymarket_fills group by user_id
) f on f.user_id = u.id;

-- 每账户每日统计(按成交日聚合:笔数 / 名义额 / 份额)
create or replace view public.v_user_daily_stats as
select
  user_id,
  (matched_at at time zone 'UTC')::date as day,
  count(*)             as fills_count,
  sum(notional_usd)    as notional_usd,
  sum(size_shares)     as shares
from public.trading_polymarket_fills
where matched_at is not null
group by user_id, (matched_at at time zone 'UTC')::date;

-- 开仓(Polymarket net_shares≠0 未结算 + HL size≠0),含钱包归属
create or replace view public.v_open_positions as
select p.user_id, u.smart_wallet_address, 'polymarket'::text as venue,
  p.market_id, p.token_id, p.net_shares, p.avg_entry_price,
  p.total_bought_usd, p.total_sold_usd, p.realized_pnl_usd, p.last_fill_at, p.updated_at
from public.trading_positions p
join public.trading_users u on u.id = p.user_id
where p.net_shares is distinct from 0
  and coalesce(p.settlement_status,'') not in ('closed','redeemed','settled','resolved')
union all
select s.user_id, u.smart_wallet_address, 'hyperliquid'::text as venue,
  hp.coin as market_id, null as token_id, hp.size_base as net_shares, hp.avg_entry_px as avg_entry_price,
  null, null, null, null, hp.updated_at
from public.trading_hl_positions hp
left join public.trading_hl_copy_subscriptions s on s.id = hp.subscription_id
left join public.trading_users u on u.id = s.user_id
where hp.size_base is distinct from 0;

-- 平仓(Polymarket net_shares=0 或已结算)
create or replace view public.v_closed_positions as
select p.user_id, u.smart_wallet_address, p.market_id, p.token_id,
  p.realized_pnl_usd, p.total_bought_usd, p.total_sold_usd, p.settlement_status,
  p.redeem_proceeds_usd, p.last_fill_at, p.updated_at
from public.trading_positions p
join public.trading_users u on u.id = p.user_id
where p.net_shares = 0
   or coalesce(p.settlement_status,'') in ('closed','redeemed','settled','resolved');
