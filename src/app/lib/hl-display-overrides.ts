/**
 * HL 显示覆盖层 — 让 HL 区块显示的所有统计/持仓/历史都可以在 Supabase 手动调控。
 *
 * 真实数据仍来自引擎 `useHlAccount`(/v1/hl/account);本层把三张 Supabase 表叠上去:
 *   trading_hl_overrides          统计数字覆盖(非 null 字段替换真实值)
 *   trading_hl_manual_positions   手动持仓(add 追加 / replace 替换同币种 / hide 隐藏)
 *   trading_trade_records         手动成交记录(source='manual', venue='hl_<network>')→ 并入历史
 *
 * 用 `useHlAccountAdjusted` 替换 `useHlAccount` 调用点即可 — 返回对象保持
 * react-query 的 isLoading/isError/refetch 语义,data 为调控后的 HlAccount。
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@app/lib/supabase-client";
import { useHlAccount } from "@app/lib/engine-hooks";
import type { HlAccount, HlFillRow, HlNetwork, HlPosition } from "@app/lib/engine";
import { sideIsShort } from "@app/lib/engine";

interface HlOverrideRow {
  wallet: string;
  network: string;
  account_value_usd: number | null;
  withdrawable_usd: number | null;
  unrealized_pnl_usd: number | null;
  today_pnl_usd: number | null;
  follow_count: number | null;
}

interface HlManualPosRow {
  id: string;
  coin: string;
  size: number;
  entry_px: number | null;
  mark_px: number | null;
  unrealized_pnl_usd: number | null;
  leverage: number | null;
  mode: "add" | "replace" | "hide";
}

interface ManualRecordRow {
  record_id: string;
  symbol: string | null;
  side: string | null;
  price: number | null;
  size: number | null;
  realized_pnl_usd: number | null;
  record_type: string;
  happened_at: string | null;
}

function useHlOverrides(wallet: string | undefined, network: HlNetwork) {
  return useQuery<HlOverrideRow | null>({
    queryKey: ["stats", "hl-overrides", wallet?.toLowerCase(), network],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_hl_overrides")
        .select("*")
        .ilike("wallet", wallet!)
        .eq("network", network)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as HlOverrideRow | null;
    },
    enabled: !!wallet,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

function useHlManualPositions(wallet: string | undefined, network: HlNetwork) {
  return useQuery<HlManualPosRow[]>({
    queryKey: ["stats", "hl-manual-pos", wallet?.toLowerCase(), network],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_hl_manual_positions")
        .select("*")
        .ilike("wallet", wallet!)
        .eq("network", network)
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as HlManualPosRow[];
    },
    enabled: !!wallet,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

function useHlManualRecords(wallet: string | undefined, network: HlNetwork) {
  return useQuery<ManualRecordRow[]>({
    queryKey: ["stats", "hl-manual-records", wallet?.toLowerCase(), network],
    queryFn: async () => {
      // 与统计层同口径:trading_record_hidden 里的记录视同不存在(admin「隐藏」)。
      const [recRes, hidRes] = await Promise.all([
        supabase
          .from("trading_trade_records")
          .select("record_id,symbol,side,price,size,realized_pnl_usd,record_type,happened_at")
          .ilike("wallet", wallet!)
          .eq("venue", `hl_${network}`)
          .eq("source", "manual")
          .order("happened_at", { ascending: false })
          .limit(100),
        supabase.from("trading_record_hidden").select("record_id"),
      ]);
      if (recRes.error) throw recRes.error;
      const hidden = new Set((hidRes.data ?? []).map((r: { record_id: string }) => r.record_id));
      return ((recRes.data ?? []) as ManualRecordRow[]).filter((r) => !hidden.has(r.record_id));
    },
    enabled: !!wallet,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

const n = (v: unknown): number => Number(v ?? 0);

function manualToPosition(m: HlManualPosRow): HlPosition {
  const size = n(m.size);
  const entry = m.entry_px == null ? null : n(m.entry_px);
  const mark = m.mark_px == null ? entry : n(m.mark_px);
  const upnl = m.unrealized_pnl_usd != null
    ? n(m.unrealized_pnl_usd)
    : size * (n(mark) - n(entry));
  return {
    coin: m.coin,
    size: Math.abs(size),
    side: size >= 0 ? "LONG" : "SHORT",
    entryPx: entry,
    positionValue: Math.abs(size) * n(mark ?? entry),
    upnl,
    leverage: m.leverage == null ? null : n(m.leverage),
  };
}

function manualToFill(r: ManualRecordRow): HlFillRow {
  const sz = n(r.size);
  const isLong = !sideIsShort(r.side); // 原判定漏小写 'buy' → 误判 short;统一用 sideIsShort
  const isClose = r.record_type === "close" || /close/i.test(r.side ?? "");
  return {
    coin: r.symbol ?? "—",
    dir: isClose ? (isLong ? "Close Short" : "Close Long") : (isLong ? "Open Long" : "Open Short"),
    side: isLong ? "BUY" : "SELL",
    sz: Math.abs(sz),
    px: n(r.price),
    closedPnl: n(r.realized_pnl_usd),
    isClose,
    time: r.happened_at ? new Date(r.happened_at).getTime() : 0,
    hash: null,
  };
}

/** 把覆盖/手动数据叠到真实 HlAccount 上。 */
export function applyHlAdjustments(
  acct: HlAccount | undefined,
  ov: HlOverrideRow | null | undefined,
  manualPos: HlManualPosRow[] | undefined,
  manualRecords: ManualRecordRow[] | undefined,
): HlAccount | undefined {
  if (!acct) return acct;
  const out: HlAccount = { ...acct };

  // ── 统计覆盖(非 null 才替换)──
  if (ov) {
    if (ov.account_value_usd != null) out.accountValue = n(ov.account_value_usd);
    if (ov.withdrawable_usd != null) out.withdrawable = n(ov.withdrawable_usd);
    if (ov.unrealized_pnl_usd != null) out.unrealizedPnl = n(ov.unrealized_pnl_usd);
    if (ov.today_pnl_usd != null) out.todayPnl = n(ov.today_pnl_usd);
  }

  // ── 持仓:hide 隐藏 / replace 替换同币种 / add 追加 ──
  if (manualPos && manualPos.length > 0) {
    const hide = new Set(manualPos.filter((m) => m.mode === "hide").map((m) => m.coin));
    const replace = new Map(manualPos.filter((m) => m.mode === "replace").map((m) => [m.coin, m]));
    let positions = (acct.positions ?? []).filter((p) => !hide.has(p.coin) && !replace.has(p.coin));
    positions = positions.concat(
      manualPos.filter((m) => m.mode === "replace" || m.mode === "add").map(manualToPosition),
    );
    out.positions = positions;
    // 统计若未显式覆盖,跟随手动持仓重算浮盈合计(保持卡片与持仓一致)
    if (!ov || ov.unrealized_pnl_usd == null) {
      out.unrealizedPnl = positions.reduce((s, p) => s + n(p.upnl), 0);
    }
  }

  // ── 历史:手动成交并入,按时间排序 ──
  if (manualRecords && manualRecords.length > 0) {
    const fills = [...(acct.recentFills ?? []), ...manualRecords.map(manualToFill)];
    fills.sort((a, b) => b.time - a.time);
    out.recentFills = fills;
  }

  return out;
}

/**
 * useHlAccount 的可调控版本 — 同形状返回。`wallet` 是用户连接的 smart wallet
 * (覆盖表按它索引);`address` 是 HL 账户地址(引擎托管 EOA / master)。
 */
export function useHlAccountAdjusted(
  address: string | undefined,
  network: HlNetwork,
  wallet: string | undefined,
) {
  const acctQ = useHlAccount(address, network);
  const ovQ = useHlOverrides(wallet, network);
  const posQ = useHlManualPositions(wallet, network);
  const recQ = useHlManualRecords(wallet, network);

  const data = useMemo(
    () => applyHlAdjustments(acctQ.data, ovQ.data, posQ.data, recQ.data),
    [acctQ.data, ovQ.data, posQ.data, recQ.data],
  );

  // 引擎查询失败但存在覆盖数据时,合成一个全手动的账户视图(覆盖优先于报错)。
  const fallback = useMemo<HlAccount | undefined>(() => {
    if (acctQ.data || !wallet) return undefined;
    const hasManual = !!ovQ.data || (posQ.data?.length ?? 0) > 0 || (recQ.data?.length ?? 0) > 0;
    if (!hasManual) return undefined;
    const base: HlAccount = {
      network, address: address ?? "", funded: true,
      accountValue: 0, withdrawable: 0, margin: 0, unrealizedPnl: 0, realizedPnl: 0,
      todayPnl: 0, positions: [], recentFills: [],
    };
    return applyHlAdjustments(base, ovQ.data, posQ.data, recQ.data);
  }, [acctQ.data, ovQ.data, posQ.data, recQ.data, wallet, address, network]);

  return {
    ...acctQ,
    data: data ?? fallback,
    isError: acctQ.isError && !fallback,
  };
}
