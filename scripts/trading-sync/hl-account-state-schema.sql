-- hl-account-state-schema.sql — Hyperliquid 账户现金状态(净值/可用/保证金)缓存表。
-- 由生产机 hl-account-state.mjs(pm2 单实例,直接打 HL 公共 info API,不经引擎)定期 upsert。
-- 目的:admin 读余额走 Supabase,不再实时代理打引擎、撞每日 1 万次 cap。
-- 与现有 trading_* 表口径一致:public schema、grant select to anon/authenticated。
-- 幂等:全部 add column if not exists / create table if not exists,可重复 apply。

create table if not exists public.trading_hl_account_state (
  wallet              text        not null,            -- 该用户的 HL 账户地址,小写存
  network             text        not null,            -- 'mainnet' / 'testnet'
  account_value_usd   numeric,                          -- marginSummary.accountValue(净值)
  withdrawable_usd    numeric,                          -- 顶层 withdrawable(可提/可用)
  margin_used_usd     numeric,                          -- marginSummary.totalMarginUsed
  total_ntl_pos_usd   numeric,                          -- marginSummary.totalNtlPos(可选)
  as_of               timestamptz not null default now(),
  primary key (wallet, network)
);

-- 既有表演进幂等保险(若表已存在但缺列时补齐)
alter table public.trading_hl_account_state add column if not exists account_value_usd numeric;
alter table public.trading_hl_account_state add column if not exists withdrawable_usd  numeric;
alter table public.trading_hl_account_state add column if not exists margin_used_usd   numeric;
alter table public.trading_hl_account_state add column if not exists total_ntl_pos_usd numeric;
alter table public.trading_hl_account_state add column if not exists as_of timestamptz not null default now();

grant select on public.trading_hl_account_state to anon, authenticated;

-- RLS:表 RLS enabled,需显式 select policy 否则 anon publishable key 读不到。
-- 与现有 trading_* 层 anon 可读同口径(只读 using(true))。余额属敏感数据,但沿用既有架构口径。
alter table public.trading_hl_account_state enable row level security;
do $$ begin
  create policy trading_hl_account_state_read on public.trading_hl_account_state for select using (true);
exception when duplicate_object then null; end $$;

-- 改动后让 PostgREST 重载 schema/policy 缓存。
notify pgrst, 'reload schema';
