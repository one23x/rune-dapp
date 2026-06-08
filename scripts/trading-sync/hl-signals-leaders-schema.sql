-- hl-signals-leaders-schema.sql — HL 跟单信号流 + leader 榜的 Supabase 缓存表。
-- 由生产机 trading-sync(pm2 单实例)从引擎 RDS trading.hl_copy_signals / trading.hl_leaders
-- 全量幂等 upsert(见 sync.mjs 新增的两个 SPEC)。
-- 目的:dapp 的 useHlSignals / useHlLeaders 改读 Supabase,不再每 30s 实时代理打引擎
-- (撞每日 API cap)。与现有 trading_* 表口径一致:public schema、anon 可读、RLS using(true)。
-- 幂等:create table / add column if not exists,可重复 apply。

-- ── HL 跟单信号(leader 开/平仓 fills)。PK=id(引擎侧 uuid)。 ──
create table if not exists public.trading_hl_copy_signals (
  id               uuid        not null,
  leader_address   text,
  coin             text,
  side             text,                 -- 'LONG' / 'SHORT'(引擎侧已归一)
  is_close         boolean,
  px               numeric,
  sz               numeric,
  notional_usd     numeric,
  leader_sz_after  numeric,
  fill_hash        text,
  happened_at      timestamptz,
  network          text,                 -- 'mainnet' / 'testnet'
  created_at       timestamptz,
  synced_at        timestamptz not null default now(),
  primary key (id)
);
alter table public.trading_hl_copy_signals add column if not exists leader_address  text;
alter table public.trading_hl_copy_signals add column if not exists coin            text;
alter table public.trading_hl_copy_signals add column if not exists side            text;
alter table public.trading_hl_copy_signals add column if not exists is_close        boolean;
alter table public.trading_hl_copy_signals add column if not exists px              numeric;
alter table public.trading_hl_copy_signals add column if not exists sz              numeric;
alter table public.trading_hl_copy_signals add column if not exists notional_usd    numeric;
alter table public.trading_hl_copy_signals add column if not exists leader_sz_after numeric;
alter table public.trading_hl_copy_signals add column if not exists fill_hash       text;
alter table public.trading_hl_copy_signals add column if not exists happened_at     timestamptz;
alter table public.trading_hl_copy_signals add column if not exists network         text;
alter table public.trading_hl_copy_signals add column if not exists created_at      timestamptz;
alter table public.trading_hl_copy_signals add column if not exists synced_at       timestamptz not null default now();

-- 前端按 network + happened_at desc 过滤取最近 N 条 → 复合索引。
create index if not exists idx_hl_copy_signals_net_time
  on public.trading_hl_copy_signals (network, happened_at desc);
-- 按 leader 过滤(策略详情页 scoped feed)。
create index if not exists idx_hl_copy_signals_leader
  on public.trading_hl_copy_signals (network, leader_address, happened_at desc);

grant select on public.trading_hl_copy_signals to anon, authenticated;
alter table public.trading_hl_copy_signals enable row level security;
do $$ begin
  create policy trading_hl_copy_signals_read on public.trading_hl_copy_signals for select using (true);
exception when duplicate_object then null; end $$;

-- ── HL leader 榜。PK=(address, network)(同一地址主/测网各一行)。 ──
create table if not exists public.trading_hl_leaders (
  address          text        not null,
  network          text        not null,
  label            text,
  active           boolean,
  score            numeric,
  median_holding_s integer,
  is_hft           boolean,
  last_fill_time   numeric,
  created_at       timestamptz,
  updated_at       timestamptz,
  synced_at        timestamptz not null default now(),
  primary key (address, network)
);
alter table public.trading_hl_leaders add column if not exists label            text;
alter table public.trading_hl_leaders add column if not exists active           boolean;
alter table public.trading_hl_leaders add column if not exists score            numeric;
alter table public.trading_hl_leaders add column if not exists median_holding_s integer;
alter table public.trading_hl_leaders add column if not exists is_hft           boolean;
alter table public.trading_hl_leaders add column if not exists last_fill_time   numeric;
alter table public.trading_hl_leaders add column if not exists created_at       timestamptz;
alter table public.trading_hl_leaders add column if not exists updated_at       timestamptz;
alter table public.trading_hl_leaders add column if not exists synced_at        timestamptz not null default now();

create index if not exists idx_hl_leaders_net_active_score
  on public.trading_hl_leaders (network, active, score desc);

grant select on public.trading_hl_leaders to anon, authenticated;
alter table public.trading_hl_leaders enable row level security;
do $$ begin
  create policy trading_hl_leaders_read on public.trading_hl_leaders for select using (true);
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
