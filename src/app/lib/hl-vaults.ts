/**
 * Hyperliquid **protocol vaults** — live data from Hyperliquid's own public
 * info API (no engine / no auth). Powers the Strategy page's 金库 panel:
 * a curated set of *recommended* HL vaults shown with real-time TVL / APR /
 * all-time PnL — purely informational (mirrors hyperliquid.xyz/vaults), with a
 * deep-link out to HL. This is NOT the copy-trading follow flow (that lives in
 * the HL hub, behind the 智能合约跟单 hero).
 *
 * Source: POST {apiBase}/info { type: "vaultDetails", vaultAddress }
 *   → { name, leader, apr, isClosed, allowDeposits, portfolio[], followers[] }
 * CORS is open (access-control-allow-origin: *), so we read it straight from
 * the browser. TVL = last point of the allTime accountValueHistory; all-time
 * PnL = last point of allTime pnlHistory. The full vaults *list* endpoint is
 * ~14 MB, so we never fetch it client-side — we curate addresses instead.
 */

import { useQueries } from "@tanstack/react-query";
import type { HlNetwork } from "@app/lib/engine";

function apiBase(network: HlNetwork): string {
  return network === "testnet" ? "https://api.hyperliquid-testnet.xyz" : "https://api.hyperliquid.xyz";
}

/** Public HL app deep-link to a vault page (for "在 Hyperliquid 查看"). */
export function hlVaultUrl(address: string, network: HlNetwork): string {
  const base = network === "testnet" ? "https://app.hyperliquid-testnet.xyz" : "https://app.hyperliquid.xyz";
  return `${base}/vaults/${address}`;
}

/**
 * Curated **recommended** vaults per network (open, liquid, name resolves live
 * from the API so we only pin the address). Mainnet is the product surface;
 * testnet has no stable recommended set, so the panel shows an empty state.
 */
export const RECOMMENDED_VAULTS: Record<HlNetwork, string[]> = {
  mainnet: [
    "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303", // Hyperliquidity Provider (HLP)
    "0xd6e56265890b76413d1d527eb9b75e334c0c5b42", // [Systemic Strategies] HyperGrowth
    "0x1e37a337ed460039d1b15bd3bc489de789768d5e", // Growi HF
    "0x07fd993f0fa3a185f7207adccd29f7a87404689d", // [Systemic Strategies] L/S Grids
    "0xc179e03922afe8fa9533d3f896338b9fb87ce0c8", // drkmttr
  ],
  testnet: [],
};

/** Normalized HL vault for the UI — real numbers only. */
export interface HlVault {
  address: string;
  name: string;
  leader: string;
  /** Annualized return as a fraction (e.g. 0.34 = 34%). */
  apr: number;
  /** Total value locked, USD (last allTime account value). */
  tvl: number;
  /** All-time PnL, USD. */
  allTimePnl: number;
  isClosed: boolean;
  allowDeposits: boolean;
  /** allTime account-value points [ts, value] for a sparkline (may be empty). */
  sparkline: number[];
}

interface RawVaultDetails {
  name?: string;
  leader?: string;
  apr?: number;
  isClosed?: boolean;
  allowDeposits?: boolean;
  portfolio?: [string, { accountValueHistory?: [number, string][]; pnlHistory?: [number, string][] }][];
}

function lastNum(rows?: [number, string][]): number {
  if (!rows || rows.length === 0) return 0;
  const v = Number(rows[rows.length - 1][1]);
  return Number.isFinite(v) ? v : 0;
}

async function fetchVaultDetails(network: HlNetwork, vaultAddress: string): Promise<HlVault> {
  const res = await fetch(`${apiBase(network)}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "vaultDetails", vaultAddress }),
  });
  if (!res.ok) throw new Error(`vaultDetails ${res.status}`);
  const d = (await res.json()) as RawVaultDetails;

  const allTime = d.portfolio?.find((p) => p[0] === "allTime")?.[1];
  const avh = allTime?.accountValueHistory;
  return {
    address: vaultAddress,
    name: d.name ?? vaultAddress,
    leader: d.leader ?? "",
    apr: Number.isFinite(d.apr) ? Number(d.apr) : 0,
    tvl: lastNum(avh),
    allTimePnl: lastNum(allTime?.pnlHistory),
    isClosed: !!d.isClosed,
    allowDeposits: !!d.allowDeposits,
    sparkline: (avh ?? []).map((r) => Number(r[1])).filter((n) => Number.isFinite(n)),
  };
}

/**
 * Live recommended HL vaults for a network. One query per vault (parallel) so a
 * single slow/failed vault doesn't block the rest; sorted by TVL desc. Polls
 * every 60s for a real-time feel without hammering HL.
 */
export function useHlVaults(network: HlNetwork) {
  const addrs = RECOMMENDED_VAULTS[network] ?? [];
  const queries = useQueries({
    queries: addrs.map((addr) => ({
      queryKey: ["hl-vault", network, addr],
      queryFn: () => fetchVaultDetails(network, addr),
      staleTime: 60_000,
      refetchInterval: 60_000,
      retry: 1,
    })),
  });

  const vaults = queries
    .map((q) => q.data)
    .filter((v): v is HlVault => !!v)
    .sort((a, b) => b.tvl - a.tvl);

  return {
    vaults,
    isLoading: addrs.length > 0 && queries.some((q) => q.isLoading),
    isError: addrs.length > 0 && queries.every((q) => q.isError),
    isSuccess: queries.some((q) => q.isSuccess),
    dataUpdatedAt: Math.max(0, ...queries.map((q) => q.dataUpdatedAt ?? 0)),
  };
}
