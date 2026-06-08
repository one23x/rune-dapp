-- pm-positions-from-fills.sql — 从 trading_polymarket_fills 推导 PM 持仓写回 trading_positions。
-- 背景:引擎源表 trading.positions 自 2026-05-27 起为空(新引擎 PM 用 deriveDepositWallet
--   不再落该表),sync 每 2min upsert 0 行(no-op,不删),导致 5-27 后 PM 买入只有 fills、
--   无持仓快照 → 前端"当前持仓 0"。本函数按 fills 聚合净份额/均价/已实现,upsert 回
--   trading_positions(PK user_id,market_id,token_id);现有读该表的视图/rollup/admin 自动生效。
--   只增不改 legacy(无 fills 的老行不动);sync 的 0 行 upsert 不会覆盖本函数写的行。
create or replace function public.pm_rebuild_positions_from_fills()
returns int language plpgsql security definer set search_path=public as $func$
declare n int;
begin
  insert into trading_positions as t
    (user_id, token_id, market_id, net_shares, avg_entry_price, realized_pnl_usd,
     total_bought_usd, total_sold_usd, last_fill_at, updated_at, synced_at)
  select d.user_id, d.token_id, d.market_id, d.net_shares,
     case when d.buy_sh>0 then d.buy_usd/d.buy_sh else 0 end,
     d.sold_usd - d.sold_sh * (case when d.buy_sh>0 then d.buy_usd/d.buy_sh else 0 end),
     d.buy_usd, d.sold_usd, d.last_fill, d.last_fill, now()
  from (
    select user_id, token_id, coalesce(nullif(market_id,''),'') as market_id,
      sum(case when upper(side)='BUY' then size_shares else -size_shares end) net_shares,
      sum(case when upper(side)='BUY' then size_shares else 0 end) buy_sh,
      sum(case when upper(side)='BUY' then notional_usd else 0 end) buy_usd,
      sum(case when upper(side)='SELL' then size_shares else 0 end) sold_sh,
      sum(case when upper(side)='SELL' then notional_usd else 0 end) sold_usd,
      max(matched_at) last_fill
    from trading_polymarket_fills where user_id is not null
    group by user_id, token_id, coalesce(nullif(market_id,''),'')
  ) d
  on conflict (user_id, market_id, token_id) do update set
     net_shares=excluded.net_shares, avg_entry_price=excluded.avg_entry_price,
     realized_pnl_usd=excluded.realized_pnl_usd, total_bought_usd=excluded.total_bought_usd,
     total_sold_usd=excluded.total_sold_usd, last_fill_at=excluded.last_fill_at,
     updated_at=excluded.updated_at, synced_at=now();
  get diagnostics n = row_count;
  return n;
end $func$;

-- 调度:加入每10分钟 rollup 链(订单→持仓→统计),前端从 Supabase 读显示。
-- select cron.alter_job(1, command => 'select public.pm_rebuild_positions_from_fills(); select public.trading_refresh_trade_records(); select public.trading_rollup_daily();');
-- 注意:fills 净额推导不含 PM 结算赎回 → 已结算市场的仓会残留显示,待接 Polymarket data-api/链上赎回检测后修正。
