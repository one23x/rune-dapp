/**
 * Supabase 同步层读取 —— 给 engine-hooks 的「账户/余额/信号」热点 hook 用,
 * 把每 30s 实时打引擎 API 的流量挪到生产机每 2min 同步出来的 Supabase 表上,
 * 大幅降低引擎每项目每日 API 配额消耗。
 *
 * 设计原则(与 NORMS「两库模型」一致):**同步表优先,引擎兜底**。
 * 这里只提供「从同步表拼出引擎同形状对象」的纯函数 + 取数函数;hook 层在
 * 同步表无数据时回退到 engine.ts 的实时调用,保证未覆盖账户不白屏。
 *
 * 数据源(均由生产机 pm2 任务每 ~2min 刷新):
 *   trading_hl_account_state   PK(wallet, network)   HL 现金:净值/可提/保证金/总名义
 *   trading_pm_account_state   PK(user_id)           PM pUSD 余额 + proxy_wallet
 *   v_wallet_open_positions    按连接钱包             当前持仓(PM + HL 主/测网)
 *   trading_hl_copy_signals    PK(id)                HL leader 开/平仓信号流
 *   trading_hl_leaders         PK(address, network)  HL leader 榜
 */

import { supabase } from "@app/lib/supabase-client";
import type {
  HlAccount,
  HlLeader,
  HlNetwork,
  HlPosition,
  HlSignal,
} from "@app/lib/engine";

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ── HL 账户(trading_hl_account_state + v_wallet_open_positions) ───────────────

interface HlAccountStateRow {
  wallet: string;
  network: string;
  account_value_usd: number | null;
  withdrawable_usd: number | null;
  margin_used_usd: number | null;
  total_ntl_pos_usd: number | null;
  as_of: string | null;
}

interface OpenPosRow {
  venue: string;
  symbol: string | null;
  size: number | null;
  entry_px: number | null;
  mark_px: number | null;
  position_value_usd: number | null;
  unrealized_pnl_usd: number | null;
  leverage?: number | null;
}

function openPosToHlPosition(r: OpenPosRow): HlPosition {
  const size = num(r.size);
  const entry = numOrNull(r.entry_px);
  const mark = r.mark_px == null ? entry : num(r.mark_px);
  const upnl =
    r.unrealized_pnl_usd != null
      ? num(r.unrealized_pnl_usd)
      : size * (num(mark) - num(entry));
  const posVal =
    r.position_value_usd != null
      ? Math.abs(num(r.position_value_usd))
      : Math.abs(size) * num(mark ?? entry);
  return {
    coin: r.symbol ?? "—",
    size: Math.abs(size),
    side: size >= 0 ? "LONG" : "SHORT",
    entryPx: entry,
    positionValue: posVal,
    upnl,
    leverage: r.leverage == null ? null : num(r.leverage),
  };
}

/**
 * 从同步表拼一个引擎 `HlAccount` 同形状对象;同步表无该 HL 账户行 → 返回 null
 * (hook 据此回退引擎实时调用)。`address` = HL 账户地址(custodial 托管 EOA /
 * agent master);positions 从 v_wallet_open_positions 按 venue=hl_<network> 取,
 * 用 address 在 {wallet, login_wallet, engine_eoa_address} 任一匹配(大小写不敏感)。
 */
export async function fetchHlAccountFromSync(
  address: string,
  network: HlNetwork,
): Promise<HlAccount | null> {
  const venue = `hl_${network}`;
  const orFilter = `wallet.ilike.${address},login_wallet.ilike.${address},engine_eoa_address.ilike.${address}`;

  const [stateRes, posRes] = await Promise.all([
    supabase
      .from("trading_hl_account_state")
      .select("*")
      .ilike("wallet", address)
      .eq("network", network)
      .maybeSingle(),
    supabase
      .from("v_wallet_open_positions")
      .select(
        "venue,symbol,size,entry_px,mark_px,position_value_usd,unrealized_pnl_usd,leverage",
      )
      .or(orFilter)
      .eq("venue", venue),
  ]);

  if (stateRes.error) throw stateRes.error;
  // 持仓视图取数失败不致命(可能 RLS/视图临时问题)→ 当作无持仓继续。
  const posRows = (posRes.error ? [] : (posRes.data ?? [])) as OpenPosRow[];
  const state = (stateRes.data ?? null) as HlAccountStateRow | null;

  // 该账户既无现金状态行、也无持仓 → 同步层未覆盖,交给引擎兜底。
  if (!state && posRows.length === 0) return null;

  const positions = posRows.map(openPosToHlPosition);
  const unrealized = positions.reduce((s, p) => s + num(p.upnl), 0);
  const accountValue = num(state?.account_value_usd);
  const withdrawable = num(state?.withdrawable_usd);
  const marginUsed = num(state?.margin_used_usd);

  return {
    network,
    address,
    funded: accountValue > 0 || positions.length > 0,
    accountValue,
    withdrawable,
    margin: marginUsed,
    marginUsed,
    unrealizedPnl: unrealized,
    realizedPnl: 0, // 同步层无,展示层不强依赖(覆盖层/历史另算)。
    positions,
    // recentFills 走覆盖层手动行;同步层不提供真实 fills(保持 undefined,
    // 不抹掉 hl-display-overrides 的 manualRecords 注入)。
  };
}

// ── PM pUSD 余额(trading_pm_account_state) ───────────────────────────────────

interface PmAccountStateRow {
  user_id: string;
  balance_usd: number | null;
  proxy_wallet: string | null;
  positions_value_usd: number | null;
  as_of: string | null;
}

/** 引擎 pusd-balance 同形状:{ smartWallet, balanceUsd, ... }。无行 → null(回退引擎)。 */
export async function fetchPusdBalanceFromSync(
  userId: string,
): Promise<{ smartWallet: string | null; balanceUsd: number; positionsValueUsd: number } | null> {
  const { data, error } = await supabase
    .from("trading_pm_account_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? null) as PmAccountStateRow | null;
  if (!row) return null;
  return {
    smartWallet: row.proxy_wallet,
    balanceUsd: num(row.balance_usd),
    positionsValueUsd: num(row.positions_value_usd),
  };
}

// ── HL 信号流(trading_hl_copy_signals) ───────────────────────────────────────

interface HlSignalRow {
  id: string;
  leader_address: string | null;
  coin: string | null;
  side: string | null;
  is_close: boolean | null;
  px: number | null;
  sz: number | null;
  notional_usd: number | null;
  leader_sz_after: number | null;
  happened_at: string | null;
}

function signalRowToHlSignal(r: HlSignalRow): HlSignal {
  return {
    id: r.id,
    leaderAddress: r.leader_address ?? "",
    coin: r.coin ?? "—",
    side: (r.side ?? "").toUpperCase() === "SHORT" ? "SHORT" : "LONG",
    isClose: !!r.is_close,
    px: num(r.px),
    sz: num(r.sz),
    notionalUsd: num(r.notional_usd),
    leaderSzAfter: numOrNull(r.leader_sz_after),
    happenedAt: r.happened_at ?? "",
  };
}

/** 引擎 signals() 同形状:{ network, signals }。无行 → null(回退引擎)。 */
export async function fetchHlSignalsFromSync(
  network: HlNetwork,
  opts?: { limit?: number; leader?: string },
): Promise<{ network: HlNetwork; signals: HlSignal[] } | null> {
  let q = supabase
    .from("trading_hl_copy_signals")
    .select(
      "id,leader_address,coin,side,is_close,px,sz,notional_usd,leader_sz_after,happened_at",
    )
    .eq("network", network)
    .order("happened_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.leader) q = q.ilike("leader_address", opts.leader);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as HlSignalRow[];
  if (rows.length === 0) return null;
  return { network, signals: rows.map(signalRowToHlSignal) };
}

// ── HL leader 榜(trading_hl_leaders) ─────────────────────────────────────────

interface HlLeaderRow {
  address: string;
  label: string | null;
  active: boolean | null;
  network: string;
  score: number | null;
  median_holding_s: number | null;
  is_hft: boolean | null;
}

function leaderRowToHlLeader(r: HlLeaderRow): HlLeader {
  return {
    address: r.address,
    label: r.label,
    active: !!r.active,
    network: (r.network === "testnet" ? "testnet" : "mainnet") as HlNetwork,
    score: numOrNull(r.score),
    medianHoldingS: r.median_holding_s == null ? null : num(r.median_holding_s),
    isHft: r.is_hft,
  };
}

/** 引擎 leaders() 同形状:{ network, leaders }。无行 → null(回退引擎)。 */
export async function fetchHlLeadersFromSync(
  network: HlNetwork,
): Promise<{ network: HlNetwork; leaders: HlLeader[] } | null> {
  const { data, error } = await supabase
    .from("trading_hl_leaders")
    .select("address,label,active,network,score,median_holding_s,is_hft")
    .eq("network", network)
    .eq("active", true)
    .order("score", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const rows = (data ?? []) as HlLeaderRow[];
  if (rows.length === 0) return null;
  return { network, leaders: rows.map(leaderRowToHlLeader) };
}
