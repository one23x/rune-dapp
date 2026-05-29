/**
 * React-Query hooks over the One-Agents Engine client (`engine.ts`).
 *
 * Follows the app's existing @tanstack/react-query usage (see queryClient.ts:
 * staleTime Infinity, no auto-refetch, no retry). Hooks are `enabled`-gated on
 * the identifier so a missing wallet / userId simply stays idle instead of
 * firing a doomed request. Feature pages can override `staleTime` / `enabled`
 * per call site as they get built out.
 */

import { useQuery } from "@tanstack/react-query";
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

/** Resolve the Engine user for a connected smart wallet (null = not onboarded). */
export function useEngineUser(wallet: string | undefined) {
  return useQuery({
    queryKey: ["engine", "user", wallet?.toLowerCase()],
    queryFn: () => users.findOrNull(wallet!),
    enabled: !!wallet,
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
