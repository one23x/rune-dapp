/**
 * React-Query hooks over the One-Agents Engine client (`engine.ts`).
 *
 * Follows the app's existing @tanstack/react-query usage (see queryClient.ts:
 * staleTime Infinity, no auto-refetch, no retry). Hooks are `enabled`-gated on
 * the identifier so a missing wallet / userId simply stays idle instead of
 * firing a doomed request. Feature pages can override `staleTime` / `enabled`
 * per call site as they get built out.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  users,
  funding,
  trading,
  strategies,
  copySubscriptions,
  signals,
  hyperliquid,
  type HlNetwork,
} from "@app/lib/engine";

/**
 * Resolve the Engine user for a connected wallet — **auto-onboard on first sight**.
 *
 * 之前:findOrNull 对未开户钱包返回 null → userId/engineEoaAddress 都拿不到 →
 *   充值弹窗地址空白、跟单/持仓页空白("充值地址生成不出来")。
 * 现在:未开户(null)就自动开户(每个连接的钱包 = 一个交易子账户;onboard 在引擎侧
 *   是幂等 find-or-create),保证 userId + 托管 EOA + 充值地址**恒存在**,地址直接显示给客户。
 * onboard 响应是 { userId, engineEoaAddress, ... }(没有 id)→ 归一成带 `id` 的用户对象,
 * 让所有读 `data.id` 的调用方继续可用。
 */
export function useEngineUser(wallet: string | undefined) {
  return useQuery({
    queryKey: ["engine", "user", wallet?.toLowerCase()],
    queryFn: async () => {
      const existing = await users.findOrNull(wallet!);
      if (existing) return existing;
      const onboarded = (await users.onboard(wallet!)) as Record<string, unknown>;
      return { ...onboarded, id: onboarded.id ?? onboarded.userId };
    },
    enabled: !!wallet,
    retry: false,
  });
}

/** Hot Polymarket markets — `{ data: [...] }`. Refreshes on a short interval. */
export function useHotMarkets() {
  return useQuery({
    queryKey: ["engine", "hot-markets"],
    queryFn: () => signals.hotMarkets(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/** Top leaderboard traders by window. */
export function useLeaders(window: "1d" | "7d" | "30d" = "7d") {
  return useQuery({
    queryKey: ["engine", "leaders", window],
    queryFn: () => signals.leadersTop(window),
    staleTime: 60_000,
  });
}

/** Latest leader-consensus signals feed. */
export function useLeaderSignals() {
  return useQuery({
    queryKey: ["engine", "leader-signals"],
    queryFn: () => signals.leaderSignalsLatest(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

/** A user's strategies. */
export function useStrategies(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "strategies", userId],
    queryFn: () => strategies.list(userId!),
    enabled: !!userId,
  });
}

/** A user's leader-wallet copy subscriptions. */
export function useCopySubs(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "copy-subs", userId],
    queryFn: () => copySubscriptions.list(userId!),
    enabled: !!userId,
  });
}

/** A user's local Polymarket order history. */
export function useOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "orders", userId],
    queryFn: () => trading.polymarket.orders(userId!),
    enabled: !!userId,
  });
}

/** A user's live open Polymarket orders. */
export function useOpenOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "open-orders", userId],
    queryFn: () => trading.polymarket.openOrders(userId!),
    enabled: !!userId,
    refetchInterval: 15_000,
  });
}

/** A user's pUSD collateral balance. */
export function usePusdBalance(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "pusd-balance", userId],
    queryFn: () => funding.pusdBalance(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ─── Hyperliquid copy-trading (network-keyed) ────────────────────────────────

/** Ranked HL leaders for a network. */
export function useHlLeaders(network: HlNetwork) {
  return useQuery({
    queryKey: ["engine", "hl", "leaders", network],
    queryFn: () => hyperliquid.leaders(network),
    staleTime: 60_000,
  });
}

/** Recent HL leader signals (open/close fills); optionally scoped to one leader. */
export function useHlSignals(
  network: HlNetwork,
  opts?: { limit?: number; leader?: string },
) {
  return useQuery({
    queryKey: ["engine", "hl", "signals", network, opts?.limit ?? null, opts?.leader ?? null],
    queryFn: () => hyperliquid.signals(network, opts),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

/** A user/follower's HL account state + open positions (direct HL info API). */
export function useHlAccount(address: string | undefined, network: HlNetwork) {
  return useQuery({
    queryKey: ["engine", "hl", "account", network, address?.toLowerCase()],
    queryFn: () => hyperliquid.account(address!, network),
    enabled: !!address,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: false,
  });
}

/** A user's HL copy subscriptions (+ mirrored positions). */
export function useHlSubs(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "hl", "subs", userId],
    queryFn: () => hyperliquid.subscriptions(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** F17 — AI 跟单决策流(决策卡)。每个信号经 AI 判断+调参的审计。 */
export function useHlCopyDecisions(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "hl", "copy-decisions", userId],
    queryFn: () => hyperliquid.copyDecisions(userId!),
    enabled: !!userId,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

/**
 * Manage an existing HL copy subscription: pause / resume (PATCH) + cancel (DELETE).
 * Routes are live (hl-read.ts :588 / :616). Invalidates the subs query on success so the
 * ActiveSubs list reflects the new state immediately.
 */
export function useHlSubMutations(userId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["engine", "hl", "subs", userId] });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
      hyperliquid.subscriptionPatch(userId!, id, { status }),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: ({ id }: { id: string }) => hyperliquid.subscriptionDelete(userId!, id),
    onSuccess: invalidate,
  });

  return {
    pause: (id: string) => setStatus.mutateAsync({ id, status: "paused" }),
    resume: (id: string) => setStatus.mutateAsync({ id, status: "active" }),
    cancel: (id: string) => cancel.mutateAsync({ id }),
    isPending: setStatus.isPending || cancel.isPending,
  };
}
