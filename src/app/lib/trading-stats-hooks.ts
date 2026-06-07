/**
 * React-Query hooks over the NEW Supabase trading-stats layer
 * (scripts/trading-sync/stats-schema.sql) — the views the frontend reads
 * instead of the raw synced trading_* tables or engine endpoints:
 *
 *   v_trade_records        交易记录(venue: polymarket / hl_mainnet / hl_testnet)
 *   v_wallet_daily_history 按钱包·历史每日(金额 + 百分比 + 当月累计)
 *   v_wallet_open_positions 按钱包·当前持仓明细
 *   v_wallet_today_closed  按钱包·当日平仓/成交
 *   v_wallet_today_stats   按钱包·当日统计
 *   v_loss_monitor_today   当日浮亏/实现亏损账户监控(全账户)
 *
 * Wallet matching is case-insensitive (`ilike`) — DB stores checksummed
 * smart_wallet_address while thirdweb may hand back any casing.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@app/lib/supabase-client";

export type StatsVenue = "polymarket" | "hl_mainnet" | "hl_testnet";

export interface TradeRecord {
  record_id: string;
  source: "sync" | "manual";
  venue: StatsVenue;
  record_type: string; // fill | position_snapshot | order…
  user_id: string | null;
  wallet: string | null;
  market_id: string | null;
  symbol: string | null;
  side: string | null;
  price: number | null;
  size: number | null;
  notional_usd: number | null;
  realized_pnl_usd: number | null;
  happened_at: string | null;
  /** 链上 tx hash —— 有值才渲染「查看链上记录」直达 explorer tx 详情页;手动行可复用真实订单的 hash。 */
  tx_hash: string | null;
}

export interface WalletDailyRow {
  wallet: string;
  venue: StatsVenue;
  day: string;
  position_value_usd: number;
  position_share_pct: number | null;
  position_cost_usd: number;
  day_pnl_usd: number;
  day_pnl_pct: number | null;
  realized_pnl_day_usd: number;
  realized_day_pct: number | null;
  unrealized_pnl_usd: number;
  unrealized_pct: number | null;
  realized_pnl_cum_usd: number;
  mtd_pnl_usd: number;
  mtd_pnl_pct: number | null;
  mtd_unrealized_pnl_usd: number;
  mtd_unrealized_pct: number | null;
  open_positions: number;
  closed_today: number;
  fills_today: number;
}

export interface OpenPositionRow {
  venue: StatsVenue;
  wallet: string;
  market_id: string | null;
  symbol: string | null;
  size: number | null;
  entry_px: number | null;
  mark_px: number | null;
  position_value_usd: number | null;
  position_cost_usd: number | null;
  unrealized_pnl_usd: number | null;
  updated_at: string | null;
  /** 仅 admin 手动持仓行有值;直达 explorer tx 详情页(不去地址列表页防穿帮)。 */
  tx_hash: string | null;
  /** admin 手动行标记(视图尾列)。dapp 的「平仓」按钮只给真实行 —— 手动行
   *  没有引擎仓位可平,平它只能走 admin 调控台。 */
  is_manual?: boolean | null;
}

export interface TodayClosedRow {
  venue: StatsVenue;
  record_type: string;
  wallet: string;
  market_id: string | null;
  symbol: string | null;
  side: string | null;
  price: number | null;
  size: number | null;
  notional_usd: number | null;
  realized_pnl_usd: number | null;
  happened_at: string | null;
  /** 有值才渲染链上详情链接(explorer/tx/<hash>);无值不显示链接。 */
  tx_hash: string | null;
}

export interface LossMonitorRow {
  wallet: string;
  venue: StatsVenue;
  day: string;
  is_unrealized_loss: boolean;
  is_realized_loss: boolean;
  unrealized_pnl_usd: number;
  unrealized_pct: number | null;
  realized_pnl_day_usd: number;
  realized_day_pct: number | null;
  day_pnl_usd: number;
  day_pnl_pct: number | null;
  position_value_usd: number;
  open_positions: number;
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** 交易记录(可按 venue 过滤;不传 venue = 全部三类)。 */
export function useTradeRecords(wallet: string | undefined, venue?: StatsVenue, limit = 100) {
  return useQuery<TradeRecord[]>({
    queryKey: ["stats", "trade-records", wallet?.toLowerCase(), venue ?? "all", limit],
    queryFn: async () => {
      let q = supabase
        .from("v_trade_records")
        .select("*")
        .ilike("wallet", wallet!)
        .order("happened_at", { ascending: false })
        .limit(limit);
      if (venue) q = q.eq("venue", venue);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TradeRecord[];
    },
    enabled: !!wallet,
    staleTime: 60_000,
  });
}

/** 按钱包的历史每日数据(全 venue,新→旧)。 */
export function useWalletDailyHistory(wallet: string | undefined, limit = 90) {
  return useQuery<WalletDailyRow[]>({
    queryKey: ["stats", "daily-history", wallet?.toLowerCase(), limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_wallet_daily_history")
        .select("*")
        .ilike("wallet", wallet!)
        .order("day", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as WalletDailyRow[];
    },
    enabled: !!wallet,
    staleTime: 60_000,
  });
}

/** 按钱包的当前持仓明细(PM + HL 主/测网)。 */
export function useWalletOpenPositions(wallet: string | undefined) {
  return useQuery<OpenPositionRow[]>({
    queryKey: ["stats", "open-positions", wallet?.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_wallet_open_positions")
        .select("*")
        .ilike("wallet", wallet!)
        .order("position_value_usd", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OpenPositionRow[];
    },
    enabled: !!wallet,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** 按钱包的当日平仓/成交记录。 */
export function useWalletTodayClosed(wallet: string | undefined) {
  return useQuery<TodayClosedRow[]>({
    queryKey: ["stats", "today-closed", wallet?.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_wallet_today_closed")
        .select("*")
        .ilike("wallet", wallet!)
        .order("happened_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TodayClosedRow[];
    },
    enabled: !!wallet,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** 按钱包的当日统计(每 venue 一行)。 */
export function useWalletTodayStats(wallet: string | undefined) {
  return useQuery<WalletDailyRow[]>({
    queryKey: ["stats", "today-stats", wallet?.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_wallet_today_stats")
        .select("*")
        .ilike("wallet", wallet!);
      if (error) throw error;
      return (data ?? []) as WalletDailyRow[];
    },
    enabled: !!wallet,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** 亏损监控(全账户,不限当前钱包):当日浮亏 或 当日实现亏损。 */
export function useLossMonitorToday() {
  return useQuery<LossMonitorRow[]>({
    queryKey: ["stats", "loss-monitor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_loss_monitor_today")
        .select("*");
      if (error) throw error;
      return (data ?? []) as LossMonitorRow[];
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export const fmtPct = (v: number | null | undefined): string =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`;

export const numOrZero = (v: unknown): number => Number(v ?? 0);

export { num };
