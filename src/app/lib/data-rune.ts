import { useQuery } from "@tanstack/react-query";
import { useActiveAccount } from "thirdweb/react";
import { runeChain } from "../../lib/thirdweb/chains";
import { supabase, w } from "./supabase-client";

/**
 * Adapter layer between TAICLAW pages and the RUNE on-chain event tables
 * (`rune_purchases` / `rune_referrers` / `rune_members`). TAICLAW pages
 * expect richer shapes (NodeOverview, NodeMembership with milestones,
 * status, daily rates, etc.) — RUNE only stores the on-chain facts. This
 * file translates between the two so pages can keep their original UI
 * with minimal edits.
 *
 * Strategy: shape a NodeMembership-compatible object out of each
 * rune_purchases row + sensible defaults for fields RUNE doesn't track.
 *
 * Single source: connected wallet from thirdweb's useActiveAccount.
 */

/** RUNE node tier IDs ↔ display labels. Authoritative mapping lives in
 *  `src/lib/thirdweb/contracts.ts NODE_META` — DO NOT edit one without
 *  the other. 101 is the highest tier (FOUNDER, $50K), 501 is the
 *  entry tier (INITIAL, $1K). Earlier code in this file had this
 *  mapping reversed, which made the vault stats and node panels
 *  read every wallet's purchase as the wrong tier. */
const NODE_ID_TO_TIER: Record<number, string> = {
  101: "FOUNDER",
  201: "SUPER",
  301: "ADVANCED",
  401: "MID",
  501: "INITIAL",
};

/** Node tier ID → USD price. Exported so the node-gating hook
 *  (`node-gate-supabase.ts`) derives a holder's per-market cap from the
 *  highest tier they own without duplicating the constant. */
export const NODE_ID_TO_PRICE: Record<number, number> = {
  101: 50000,
  201: 10000,
  301:  5000,
  401:  2500,
  501:  1000,
};

/** Node tier ID → trading level (1–5). `level = (601 - nodeId) / 100`
 *  (101→5 highest … 501→1 entry). Mirror of NODE_ID_TO_PRICE keys; lives
 *  here so the gate hook shares one source of truth. */
export const NODE_ID_TO_LEVEL: Record<number, number> = {
  101: 5,
  201: 4,
  301: 3,
  401: 2,
  501: 1,
};

/** Minimal NodeMembership shape — matches what TAICLAW pages destructure. */
export interface NodeMembershipRune {
  id: string;            // tx hash works as a stable id
  nodeType: string;      // BASIC / STANDARD / ADVANCED / SUPER / FOUNDER
  price: string;
  status: "ACTIVE";      // RUNE doesn't track PENDING_MILESTONES — once on chain, active
  txHash: string;
  paidAt: string;        // ISO
  // Fields TAICLAW expects but RUNE doesn't track. Defaulted to safe zeros.
  paymentMode: "FULL";
  depositAmount: "0";
  milestoneStage: 0;
  totalMilestones: 0;
  earningsCapacity: "0";
  contributionAmount: "0";
  frozenAmount: "0";
  dailyRate: "0";
  lockedEarnings: "0";
  releasedEarnings: "0";
  availableBalance: "0";
  earningsPaused: false;
  destroyedEarnings: "0";
  frozenUnlocked: false;
}

/** Per-wallet purchases. Rows are direct on-chain `EventNodePresell` records
 *  shaped to match TAICLAW's NodeMembership consumer. */
export function useNodeMembershipsRune() {
  const account = useActiveAccount();
  const address = account?.address;
  return useQuery<NodeMembershipRune[]>({
    queryKey: ["rune", "purchases", runeChain.id, w(address)],
    enabled: !!address,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rune_purchases")
        .select("user, node_id, amount, paid_at, tx_hash")
        .eq("user", w(address))
        .eq("chain_id", runeChain.id)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row): NodeMembershipRune => ({
        id: row.tx_hash,
        nodeType: NODE_ID_TO_TIER[row.node_id] ?? "BASIC",
        price: String(NODE_ID_TO_PRICE[row.node_id] ?? 0),
        status: "ACTIVE",
        txHash: row.tx_hash,
        paidAt: row.paid_at,
        paymentMode: "FULL",
        depositAmount: "0",
        milestoneStage: 0,
        totalMilestones: 0,
        earningsCapacity: "0",
        contributionAmount: "0",
        frozenAmount: "0",
        dailyRate: "0",
        lockedEarnings: "0",
        releasedEarnings: "0",
        availableBalance: "0",
        earningsPaused: false,
        destroyedEarnings: "0",
        frozenUnlocked: false,
      }));
    },
  });
}

/** Aggregate on-chain node deposits into the 35/45/20 split that the vault +
 *  market pages render. Pulled directly from `rune_purchases`; price comes
 *  from the tier table (NodePresell sells fixed-price tiers, so per-tier count
 *  × unit price is the authoritative deposit total — no need to convert raw
 *  numeric(78,0) wei amounts). */
export interface PoolStatsRune {
  totalDepositUsdt: number;
  totalMembers: number;
  totalNodes: number;
  /** count + total USDT for each tier (BASIC / STANDARD / ADVANCED / SUPER / FOUNDER). */
  tiers: Record<string, { count: number; totalUsdt: number; unitPrice: number }>;
  /** 35% — RUNE / USDT LP pool. */
  runeLp: number;
  /** 20% — strategic reserve. */
  reserve: number;
  /** 45% — AI quant / managed trading pool (rendered on /app/market). */
  managedPool: number;
}

export function usePoolStatsRune() {
  return useQuery<PoolStatsRune>({
    queryKey: ["rune", "pool-stats", runeChain.id],
    queryFn: async () => {
      const [purchasesRes, membersRes] = await Promise.all([
        supabase.from("rune_purchases").select("node_id").eq("chain_id", runeChain.id),
        supabase.from("rune_members").select("*", { count: "exact", head: true }).eq("chain_id", runeChain.id),
      ]);
      const rows = purchasesRes.data ?? [];
      const tiers: PoolStatsRune["tiers"] = {};
      for (const tier of Object.values(NODE_ID_TO_TIER)) {
        tiers[tier] = { count: 0, totalUsdt: 0, unitPrice: 0 };
      }
      for (const row of rows) {
        const tier = NODE_ID_TO_TIER[row.node_id] ?? "BASIC";
        const price = NODE_ID_TO_PRICE[row.node_id] ?? 0;
        tiers[tier].count += 1;
        tiers[tier].totalUsdt += price;
        tiers[tier].unitPrice = price;
      }
      const totalDepositUsdt = Object.values(tiers).reduce((s, t) => s + t.totalUsdt, 0);
      return {
        totalDepositUsdt,
        totalMembers: membersRes.count ?? 0,
        totalNodes: rows.length,
        tiers,
        runeLp: totalDepositUsdt * 0.35,
        reserve: totalDepositUsdt * 0.20,
        managedPool: totalDepositUsdt * 0.45,
      };
    },
    refetchInterval: 60_000,
  });
}

/** Network-wide member + node counts. Read directly off the event tables
 *  — `rune_members` is one row per registered wallet, `rune_purchases`
 *  is one row per node sold. */
export function useGlobalStatsRune() {
  return useQuery<{ totalMembers: number; activeMembers: number; totalNodes: number }>({
    queryKey: ["rune", "global-stats", runeChain.id],
    queryFn: async () => {
      const [members, purchases] = await Promise.all([
        supabase.from("rune_members").select("*", { count: "exact", head: true }).eq("chain_id", runeChain.id),
        supabase.from("rune_purchases").select("*", { count: "exact", head: true }).eq("chain_id", runeChain.id),
      ]);
      return {
        totalMembers: members.count ?? 0,
        activeMembers: members.count ?? 0, // RUNE has no "inactive" — bound = active
        totalNodes: purchases.count ?? 0,
      };
    },
  });
}

/** Direct downline of the connected wallet — pulled from `rune_referrers`
 *  where `referrer = me`. Each downline can be cross-joined to
 *  `rune_purchases` to surface their tier (used to count direct FOUNDER
 *  / SUPER referrals for Genesis qualification). */
export interface DownlineRow {
  user: string;            // downline wallet
  boundAt: string;
  nodeType: string | null; // null if downline hasn't bought a node
}

export function useDownlineRune() {
  const account = useActiveAccount();
  const address = account?.address;
  return useQuery<DownlineRow[]>({
    queryKey: ["rune", "downline", runeChain.id, w(address)],
    enabled: !!address,
    queryFn: async () => {
      const { data: refs, error: refErr } = await supabase
        .from("rune_referrers")
        .select("user, bound_at")
        .eq("referrer", w(address))
        .eq("chain_id", runeChain.id)
        .order("bound_at", { ascending: false });
      if (refErr) throw refErr;
      const downlineUsers = (refs ?? []).map((r) => r.user);
      if (downlineUsers.length === 0) return [];

      const { data: purchases, error: purErr } = await supabase
        .from("rune_purchases")
        .select("user, node_id")
        .eq("chain_id", runeChain.id)
        .in("user", downlineUsers);
      if (purErr) throw purErr;
      const purchaseMap = new Map<string, number>(
        (purchases ?? []).map((p) => [p.user, p.node_id]),
      );

      return (refs ?? []).map((r) => ({
        user: r.user,
        boundAt: r.bound_at,
        nodeType: purchaseMap.has(r.user)
          ? (NODE_ID_TO_TIER[purchaseMap.get(r.user)!] ?? null)
          : null,
      }));
    },
  });
}

/** Aggregate the wallet's downline into the team-stats shape TAICLAW pages
 *  expect (direct count, total team size, sum invested, own-node tier). */
export function useTeamStatsRune() {
  const account = useActiveAccount();
  const address = account?.address;
  const { data: downline = [] } = useDownlineRune();
  const { data: memberships = [] } = useNodeMembershipsRune();

  return useQuery({
    queryKey: ["rune", "team-stats", w(address), downline.length, memberships.length],
    enabled: !!address,
    queryFn: async () => {
      const directCount = downline.length;
      const directUsdt = downline.reduce((sum, d) => {
        const tier = d.nodeType;
        const price = tier
          ? Object.values(NODE_ID_TO_PRICE).find((p, idx) => Object.keys(NODE_ID_TO_TIER)[idx] && NODE_ID_TO_TIER[Number(Object.keys(NODE_ID_TO_TIER)[idx])] === tier) ?? 0
          : 0;
        return sum + price;
      }, 0);
      return {
        directCount,
        teamSize: directCount, // shallow — RUNE doesn't index multi-level depth here
        directUsdt,
        teamUsdt: directUsdt,
        ownNode: memberships[0] ? { nodeTier: memberships[0].nodeType } : null,
        referrals: downline.map((d) => ({ nodeType: d.nodeType ?? undefined })),
      };
    },
  });
}

/** TAICLAW-style NodeOverview: a wrapper around the wallet's memberships +
 *  any global aggregates the page wants. */
export function useNodeOverviewRune() {
  const { data: memberships = [], isLoading } = useNodeMembershipsRune();
  return {
    data: { nodes: memberships } as { nodes: NodeMembershipRune[] },
    isLoading,
  };
}

/** RUNE doesn't use auth codes — any string passes for now. */
export async function validateAuthCodeRune(_code: string): Promise<boolean> {
  return true;
}
