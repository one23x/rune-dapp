/**
 * React-Query hooks over the NEW Supabase trading-stats layer
 * (scripts/trading-sync/stats-schema.sql) — the views the frontend reads
 * instead of the raw synced trading_* tables or engine endpoints:
 *
 *   v_trade_records          交易记录(venue: polymarket / hl_mainnet / hl_testnet)
 *   v_wallet_daily_history   按钱包·历史每日(金额 + 百分比 + 当月累计)
 *   v_wallet_open_positions  按钱包·当前持仓明细
 *   v_wallet_today_closed    按钱包·当日平仓/成交
 *   v_wallet_today_stats     按钱包·当日统计
 *   v_wallet_account_summary 按 (wallet, venue)·账户汇总(净值/保证金/可用,admin 覆盖优先)
 *   v_loss_monitor_today     当日浮亏/实现亏损账户监控(全账户)
 *
 * ⚠ 归属匹配(根因修复):会员**连接登录钱包**(master)≠ 引擎派生的 smart_wallet,
 * 而这些视图的 `wallet` 列 = smart_wallet → 只按 `wallet` 匹配会全空。视图末尾已补
 * `login_wallet`(= trading_users.hl_master_address,会员登录钱包)与 `engine_eoa_address`,
 * 因此按连接钱包查 = 对 {wallet, login_wallet, engine_eoa_address} 任一做大小写不敏感
 * 等值匹配(PostgREST `.or()` + `ilike.<addr>`,地址是完整 0x hex → 即等值忽略大小写)。
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
  /** 杠杆(真实/手动行有值;PM custodial=NULL)。仅有值才渲染杠杆徽章。视图尾列。 */
  leverage?: number | null;
  /** 会员登录钱包(= trading_users.hl_master_address);视图尾列,用于按连接钱包匹配。 */
  login_wallet?: string | null;
  /** 引擎托管 EOA 地址;视图尾列,用于按连接钱包匹配。 */
  engine_eoa_address?: string | null;
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

/** 按 (wallet, venue) 聚合的账户汇总。admin 覆盖优先 —— account_value_usd 未设 = NULL,
 *  前端必须回退引擎实时现金;available/margin_ratio 同理。视图 v_wallet_account_summary。 */
export interface WalletAccountSummaryRow {
  wallet: string;
  /** 会员登录钱包(= trading_users.hl_master_address)。 */
  login_wallet: string | null;
  engine_eoa_address: string | null;
  venue: StatsVenue;
  /** admin 余额覆盖值;未设 = NULL → 前端回退引擎实时现金。 */
  account_value_usd: number | null;
  position_value_usd: number | null;
  unrealized_pnl_usd: number | null;
  /** Σ(名义/leverage)。 */
  margin_used_usd: number | null;
  /** account_value − margin;account_value 为空 → NULL,回退引擎可提。 */
  available_usd: number | null;
  margin_ratio_pct: number | null;
}

/** 按连接钱包匹配 {wallet, login_wallet, engine_eoa_address} 任一(大小写不敏感等值)。
 *  地址是完整 0x hex,直接 `ilike.<addr>` = 等值忽略大小写;**不要**加 `*` 通配。
 *  PostgREST `.or()` 取单一字符串、逗号分隔条件;0x+hex 不含逗号/特殊字符,安全。 */
const walletOrFilter = (w: string): string =>
  `wallet.ilike.${w},login_wallet.ilike.${w},engine_eoa_address.ilike.${w}`;

/** 交易记录(可按 venue 过滤;不传 venue = 全部三类)。 */
export function useTradeRecords(wallet: string | undefined, venue?: StatsVenue, limit = 100) {
  return useQuery<TradeRecord[]>({
    queryKey: ["stats", "trade-records", wallet?.toLowerCase(), venue ?? "all", limit],
    queryFn: async () => {
      let q = supabase
        .from("v_trade_records")
        .select("*")
        .or(walletOrFilter(wallet!))
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
        .or(walletOrFilter(wallet!))
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
        .or(walletOrFilter(wallet!))
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
        .or(walletOrFilter(wallet!))
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
        .or(walletOrFilter(wallet!));
      if (error) throw error;
      return (data ?? []) as WalletDailyRow[];
    },
    enabled: !!wallet,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** 按 (wallet, venue) 的账户汇总(净值/保证金/可用/保证金率)。
 *  admin 覆盖优先:account_value_usd / available_usd / margin_ratio_pct 为 NULL 时,
 *  调用方必须回退引擎实时现金(acct.accountValue / acct.withdrawable / acct.marginUsed)。 */
export function useWalletAccountSummary(wallet: string | undefined) {
  return useQuery<WalletAccountSummaryRow[]>({
    queryKey: ["stats", "account-summary", wallet?.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_wallet_account_summary")
        .select("*")
        .or(walletOrFilter(wallet!));
      if (error) throw error;
      return (data ?? []) as WalletAccountSummaryRow[];
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
