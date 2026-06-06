/**
 * Supabase-backed node gating (Phase 1).
 *
 * The 开户 gate used to depend solely on the backend `GET /v1/node/status`
 * (engine proxy). This hook moves the *UX decision* — "should we show the open
 * -account UI / what limits badge" — onto the same Supabase node tables the rest
 * of the RUNE dashboard already reads (`rune_purchases`, `trading_auth_codes`),
 * with the backend status call kept as a fallback (see `useNodeGate`).
 *
 * ⚠ SECURITY BOUNDARY — this is **UX/display only**, NOT enforcement. The real
 * open-account + exposure-cap enforcement stays on the backend untouched
 * (engine `users.onboard` rejects non-node wallets with 403 node_required;
 * copy-executor enforces the exposure cap). Even if a client forged this gate to
 * show the open-account button, the backend onboard still refuses non-holders.
 *
 * Data flow (resolve):
 *   1) rune_purchases (authoritative on-chain node ownership) — anon-readable.
 *      Highest tier = smallest node_id (101 highest). → level + per-market cap
 *      (= that tier's node price).
 *   2) else trading_auth_codes redeemed by this wallet (not revoked / expired) →
 *      hl_cap_usd / pm_cap_usd / hl_min / pm_min from the code.
 *      ⚠ RLS: anon currently sees 0 rows (default-deny, no read policy). A
 *      read-only policy must be added manually (out of this Phase's scope) for
 *      this path to surface; until then it falls through to source:"none" and
 *      the backend redeem path (useRedeemCode) remains the way to unlock.
 *   3) else source:"none" / isNode:false → gate (buy node / enter auth code).
 *
 * Wallet casing: rune_purchases.user is all-lowercase and
 * trading_auth_codes.redeemed_by_wallet is written lowercased by the Phase-0
 * sync, so we lowercase via `w()` and use equality (index-friendly, no ilike).
 */

import { useQuery } from "@tanstack/react-query";
import { runeChain } from "../../lib/thirdweb/chains";
import type { NodeLimits } from "./engine";
import { supabase, w } from "./supabase-client";
import { NODE_ID_TO_LEVEL, NODE_ID_TO_PRICE } from "./data-rune";

export type SupaGateSource = "purchase" | "authcode" | "none";

export interface SupaGate {
  /** Where the decision came from. "none" = no node and no usable auth code. */
  source: SupaGateSource;
  /** Has a node OR a redeemed auth code → may open an account (UX-level). */
  isNode: boolean;
  /** 0 = none; 1–5 = node/auth tier. */
  level: number;
  /** Per-market cap (USD). null when source="none". */
  hlCap: number | null;
  pmCap: number | null;
  /** Per-market min (USD). Only auth codes carry these; purchase path = null. */
  hlMin: number | null;
  pmMin: number | null;
  /** Back-compat shape the old NodeBadge reads (per-trade / daily / …). */
  limits: NodeLimits | null;
  /** isNode === true. */
  canOpen: boolean;
}

/**
 * Per-level display defaults for the fields NodeBadge shows that the new
 * per-market cap model doesn't carry (max trades/day, max leverage). These are
 * **pure UX** — the backend is the source of truth for real enforcement.
 */
const LEVEL_DISPLAY: Record<number, { maxTradesPerDay: number; maxLeverage: number }> = {
  1: { maxTradesPerDay: 10,  maxLeverage: 3 },
  2: { maxTradesPerDay: 20,  maxLeverage: 5 },
  3: { maxTradesPerDay: 40,  maxLeverage: 10 },
  4: { maxTradesPerDay: 80,  maxLeverage: 15 },
  5: { maxTradesPerDay: 200, maxLeverage: 20 },
};

/**
 * Map a (level, per-market cap) into the legacy NodeLimits shape NodeBadge
 * destructures. perTradeUsd / dailyUsd come from the cap; the count/leverage
 * fields use the per-level display defaults above. Display-only.
 */
export function deriveLimits(level: number, capUsd: number | null): NodeLimits | null {
  if (!level || level <= 0) return null;
  const cap = capUsd ?? 0;
  const disp = LEVEL_DISPLAY[level] ?? { maxTradesPerDay: 0, maxLeverage: 0 };
  return {
    perTradeUsd: cap,
    dailyUsd: cap,
    maxTradesPerDay: disp.maxTradesPerDay,
    maxLeverage: disp.maxLeverage,
  };
}

const NO_GATE: SupaGate = {
  source: "none",
  isNode: false,
  level: 0,
  hlCap: null,
  pmCap: null,
  hlMin: null,
  pmMin: null,
  limits: null,
  canOpen: false,
};

/**
 * Resolve the Supabase gate for a wallet. Throws on any Supabase transport / RLS
 * error so react-query enters `isError` → `useNodeGate` falls back to the
 * backend node-status (gate never bricks). A clean "no node + no code" result is
 * the resolved `source:"none"` value, NOT an error.
 */
async function resolveSupaGate(address: string): Promise<SupaGate> {
  const addr = w(address);

  // 1) Node ownership (authoritative) — rune_purchases.
  const { data: purchases, error: purErr } = await supabase
    .from("rune_purchases")
    .select("node_id")
    .eq("user", addr)
    .eq("chain_id", runeChain.id);
  if (purErr) throw purErr;

  if (purchases && purchases.length > 0) {
    // Highest tier = smallest node_id (101 highest).
    const bestNodeId = purchases.reduce(
      (min, r) => Math.min(min, r.node_id as number),
      Number.POSITIVE_INFINITY,
    );
    const level = NODE_ID_TO_LEVEL[bestNodeId] ?? 0;
    const price = NODE_ID_TO_PRICE[bestNodeId] ?? null;
    return {
      source: "purchase",
      isNode: true,
      level,
      hlCap: price,
      pmCap: price,
      hlMin: null,
      pmMin: null,
      limits: deriveLimits(level, price),
      canOpen: true,
    };
  }

  // 2) Redeemed auth code — **rune_auth_codes**(授权码唯一真表:374 条,
  //    redeem_auth_code RPC 写 assigned_to,anon 有只读 policy)。
  //    ⚠ 旧版读 trading_auth_codes 是错的 —— 那是张 0 行的空镜像,导致
  //    「验证成功但 gate 永不放行」(2026-06-06 修复)。
  const { data: codes, error: codeErr } = await supabase
    .from("rune_auth_codes")
    .select("node_id, hl_cap_usd, pm_cap_usd, hl_min_usd, pm_min_usd")
    .eq("assigned_to", addr);
  if (codeErr) throw codeErr;

  const valid = codes ?? [];

  if (valid.length > 0) {
    const lvlOf = (c: (typeof valid)[number]): number =>
      NODE_ID_TO_LEVEL[c.node_id as number] ?? 0;
    const best = valid.reduce((a, b) => (lvlOf(b) > lvlOf(a) ? b : a));
    const level = lvlOf(best);
    const hlCap = (best.hl_cap_usd as number | null) ?? null;
    const pmCap = (best.pm_cap_usd as number | null) ?? null;
    return {
      source: "authcode",
      isNode: true,
      level,
      hlCap,
      pmCap,
      hlMin: (best.hl_min_usd as number | null) ?? null,
      pmMin: (best.pm_min_usd as number | null) ?? null,
      // NodeBadge shows a single cap — prefer hlCap, fall back to pmCap.
      limits: deriveLimits(level, hlCap ?? pmCap),
      canOpen: true,
    };
  }

  // 3) No node + no usable code → gate.
  return NO_GATE;
}

/**
 * react-query hook over `resolveSupaGate`. `enabled` is gated by the caller
 * (only when gating source = supabase and a wallet is connected). `retry:false`
 * so a transport/RLS error surfaces immediately as `isError` → backend fallback.
 */
export function useSupabaseNodeGate(wallet: string | undefined, enabled: boolean) {
  return useQuery<SupaGate>({
    queryKey: ["rune", "node-gate", runeChain.id, w(wallet)],
    queryFn: () => resolveSupaGate(wallet!),
    enabled: enabled && !!wallet,
    staleTime: 30_000,
    retry: false,
  });
}
