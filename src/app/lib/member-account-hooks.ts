/**
 * 会员虚拟账本读层(2026-06-09 架构转向)——
 * 会员看到的余额 / 权益 / 盈亏 / 可提 **全部** 来自公司维护的虚拟账本视图
 * `v_member_account`(Supabase mainnet mefjuecwawmjfmeofnck),与真实链上交易账户解耦。
 *
 * 设计:scripts/trading-sync/member-ledger-*.sql。**每会员 × 每市场一行**,venue ∈
 *   polymarket | hl_mainnet | hl_testnet
 * 字段:deposits_total / withdrawals_total / realized_pnl / unrealized_pnl /
 *       margin_used / open_positions / equity / available / withdrawable。
 *   - equity      = 充值 − 提现 + 已实现 + 浮盈(会员看到的「账户净值」)
 *   - available   = equity − 保证金(可用)
 *   - withdrawable= 充值 − 提现 + 已实现 − 保证金(**不含浮盈** → 可提)
 *
 * ⚠ 归属匹配:视图只暴露 `wallet`(= trading_users.smart_wallet_address)与 `user_id`,
 *   没有 login_wallet。会员**连接登录钱包**可能是 master(≠ smart_wallet),直接按
 *   wallet 查会全空。故先用连接钱包在 `trading_users` 解析 user_id
 *   (smart_wallet_address OR hl_master_address 任一,大小写不敏感),再按 user_id 取
 *   视图三市场行。无表/无行/解析不到 → 安静返回空(穿帮风险:某 venue 无账本行时,
 *   调用方用 numOrZero 兜底显示 0,而非报错)。
 *
 * 用法:`const acct = useMemberAccount(wallet); const hl = acct.byVenue("hl_mainnet");`
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@app/lib/supabase-client";
import type { StatsVenue } from "@app/lib/trading-stats-hooks";

export type MemberVenue = StatsVenue; // "polymarket" | "hl_mainnet" | "hl_testnet"

/** v_member_account 一行(每会员 × 每市场)。数值列均可能为 string(numeric)→ 用 num() 归一。 */
export interface MemberAccountRow {
  user_id: string;
  wallet: string | null;
  status: string | null;
  venue: MemberVenue;
  deposits_total: number;
  withdrawals_total: number;
  realized_pnl: number;
  unrealized_pnl: number;
  margin_used: number;
  open_positions: number;
  /** 会员看到的「账户净值」。 */
  equity: number;
  /** 可用(净值 − 保证金)。 */
  available: number;
  /** 可提(不含浮盈)。 */
  withdrawable: number;
}

const num = (v: unknown): number => Number(v ?? 0);

function normalize(r: Record<string, unknown>): MemberAccountRow {
  return {
    user_id: String(r.user_id ?? ""),
    wallet: (r.wallet as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    venue: r.venue as MemberVenue,
    deposits_total: num(r.deposits_total),
    withdrawals_total: num(r.withdrawals_total),
    realized_pnl: num(r.realized_pnl),
    unrealized_pnl: num(r.unrealized_pnl),
    margin_used: num(r.margin_used),
    open_positions: num(r.open_positions),
    equity: num(r.equity),
    available: Math.max(0, num(r.available)),
    // 可提钳到 ≥0:真实账户高杠杆时保证金>现金会算出负可提,会员端绝不能显示负数(穿帮)。
    withdrawable: Math.max(0, num(r.withdrawable)),
  };
}

export interface MemberAccount {
  /** 三市场行(已 normalize)。某 venue 无行 = 视图未生成(无流水且无持仓)。 */
  rows: MemberAccountRow[];
  /** 按 venue 取一行;无则 undefined(调用方用 numOrZero / ?? 0 兜底)。 */
  byVenue: (v: MemberVenue) => MemberAccountRow | undefined;
  /** 解析出的会员 user_id(连接钱包匹配不到 trading_users 时为 undefined)。 */
  userId: string | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * 读会员虚拟账本(三市场)。`wallet` = 会员连接的登录钱包。
 * 两步:① trading_users 解析 user_id(smart_wallet OR hl_master 任一) ② v_member_account 按 user_id 取行。
 */
export function useMemberAccount(wallet: string | undefined): MemberAccount {
  const w = wallet?.toLowerCase();

  // ① 解析 user_id —— 连接钱包可能是 smart_wallet 或 hl_master,任一匹配。
  const userQ = useQuery<string | null>({
    queryKey: ["member-account", "user", w],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_users")
        .select("id,smart_wallet_address,hl_master_address")
        .or(`smart_wallet_address.ilike.${wallet},hl_master_address.ilike.${wallet}`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.id as string | undefined) ?? null;
    },
    enabled: !!wallet,
    staleTime: 300_000, // user_id↔wallet 映射稳定,缓存久一点
    retry: false,
  });

  const userId = userQ.data ?? undefined;

  // ② 取该会员三市场账本行。
  const rowsQ = useQuery<MemberAccountRow[]>({
    queryKey: ["member-account", "rows", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_member_account")
        .select("*")
        .eq("user_id", userId!);
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(normalize);
    },
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  return useMemo<MemberAccount>(() => {
    const rows = rowsQ.data ?? [];
    return {
      rows,
      byVenue: (v: MemberVenue) => rows.find((r) => r.venue === v),
      userId,
      isLoading: userQ.isLoading || (!!userId && rowsQ.isLoading),
      isError: userQ.isError || rowsQ.isError,
      refetch: () => { void userQ.refetch(); void rowsQ.refetch(); },
    };
  }, [rowsQ.data, rowsQ.isLoading, rowsQ.isError, userQ.isLoading, userQ.isError, userId]);
}

/** 单市场快捷读(内部仍走 useMemberAccount,React-Query 去重)。 */
export function useMemberAccountVenue(wallet: string | undefined, venue: MemberVenue) {
  const acct = useMemberAccount(wallet);
  const row = acct.byVenue(venue);
  return { row, isLoading: acct.isLoading, isError: acct.isError, refetch: acct.refetch };
}
