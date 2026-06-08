-- PM 账户状态表:存代理钱包 + pUSD 余额 + 持仓市值(data-api 同步写入)。
create table if not exists public.trading_pm_account_state (
  user_id uuid primary key,
  wallet text,                 -- 智能钱包(连接钱包)
  proxy_wallet text,           -- Polymarket 代理钱包(持仓/份额实际持有地址)
  balance_usd numeric,         -- pUSD 现金余额
  positions_value_usd numeric, -- data-api 持仓市值合计
  as_of timestamptz not null default now()
);
alter table public.trading_pm_account_state enable row level security;
do $$ begin
  if not exists (select 1 from pg_policy where polrelid='public.trading_pm_account_state'::regclass and polname='pm_acct_read')
  then create policy pm_acct_read on public.trading_pm_account_state for select using (true); end if;
end $$;
grant select on public.trading_pm_account_state to anon, authenticated;
