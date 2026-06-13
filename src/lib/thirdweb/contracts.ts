import { getContract, type ThirdwebContract } from "thirdweb";
import { thirdwebClient } from "./client";
import { runeChain, runeChainKey, arbitrum } from "./chains";
import { getRuneAddresses, ARB_NODE_DROP_ADDRESS } from "./addresses";
import { usdtAbi } from "./abis/usdt";
import nodePresellAbi from "./abis/node-presell.json";

const addr = getRuneAddresses(runeChainKey);

/**
 * Pre-built USDT contract handle. Using the `abi` option pins the typing —
 * `useReadContract(prepareContractCall(…))` downstream gets correct argument
 * and return types for free.
 */
export const usdtContract: ThirdwebContract = getContract({
  client: thirdwebClient,
  chain: runeChain,
  address: addr.usdt,
  abi: usdtAbi as any,
});

/**
 * NodePresell contract handle (BSC mainnet `0xF327…` per addresses.ts).
 * This is the legacy presell contract the QuickNode indexer subscribes to:
 * `nodePresell(uint256)` emits `EventNodePresell`, which the indexer writes
 * into `rune_purchases` so the dapp/admin see the buy with no manual backfill.
 * Methods are resolved from string signatures at call sites (thirdweb v5),
 * so no abi is pinned here.
 */
export const nodePresellContract: ThirdwebContract = getContract({
  client: thirdwebClient,
  chain: runeChain,
  address: addr.nodePresell,
  // Pin the official ABI so thirdweb decodes custom errors (ErrorNoBind /
  // ErrorReferrerNoNode / ErrorPurchased / …) into readable names instead of
  // raw 4-byte selectors. See nodeErrorMessage() in app/pages/nodes.tsx.
  abi: nodePresellAbi as any,
});

/**
 * Community contract handle (referral tree). `referrerOf(address)` returns the
 * caller's upstream referrer; the top of the tree resolves to COMMUNITY_ROOT.
 * Referenced by use-community.ts (useReferrerOf) — was accidentally dropped in
 * the "prune dead code" pass, which crashed node-overview (COMMUNITY_ROOT
 * undefined → .toLowerCase() throw) and broke referral display/binding.
 */
export const communityContract: ThirdwebContract = getContract({
  client: thirdwebClient,
  chain: runeChain,
  address: addr.community,
});

/** Top of the referral tree — `referrerOf` returns this for root accounts. */
export const COMMUNITY_ROOT = "0x0000000000000000000000000000000000000001" as const;

/** Node IDs from the spec — 101/201/301/401/501. The 501 (initial / 1000 U)
 *  tier was added at the BSC mainnet deployment per runeapi 3 §4.1. */
export const NODE_IDS = [101, 201, 301, 401, 501] as const;
export type NodeId = typeof NODE_IDS[number];

/** Human-friendly meta — backend also owns these labels, duplicated here
 *  only for UI (tier color + display name) not for business logic.
 *  `priceUsdt` mirrors the on-chain payAmount in whole USDT — used for
 *  tree badges that show "held tier + price" at a glance. If the
 *  contract ever re-tunes prices the source of truth is
 *  `NodePresell.getNodeConfigs`, so treat this as a display shortcut.
 *
 *  `rgb` is the Tailwind-400 shade of each tier expressed as a raw
 *  "r, g, b" triple so CSS custom properties can mix it into shadows
 *  and glows without string parsing (`rgba(var(--tier-rgb), 0.3)`).
 *  Keep it in sync with `color` — they're both pointing at the same
 *  tailwind shade, just expressed differently. */
// On-chain the nodeId → price/directRate mapping is fixed
// (101 = 50k / 15%, 201 = 10k / 12%, 301 = 5k / 10%, 401 = 2.5k / 8%,
//  501 = 1k / 5%). 101 is the apex purchase tier 联创节点·符主 (purple);
// 501 is the entry tier 初级节点·符胚 (slate). Symbol 符胚 moved from
// 401 to 501 with the 1,000-U tier addition; 401 is now 符源.
export const NODE_META: Record<NodeId, { level: string; nameCn: string; nameEn: string; color: string; rgb: string; priceUsdt: number }> = {
  101: { level: "founder",  nameCn: "符主", nameEn: "FOUNDER",  color: "text-purple-400", rgb: "192, 132, 252", priceUsdt: 50000 },
  201: { level: "super",    nameCn: "符魂", nameEn: "SUPER",    color: "text-amber-400",  rgb: "251, 191, 36",  priceUsdt: 10000 },
  301: { level: "advanced", nameCn: "符印", nameEn: "ADVANCED", color: "text-green-400",  rgb: "52, 211, 153",  priceUsdt:  5000 },
  401: { level: "mid",      nameCn: "符源", nameEn: "MID",      color: "text-blue-400",   rgb: "96, 165, 250",  priceUsdt:  2500 },
  501: { level: "initial",  nameCn: "符胚", nameEn: "INITIAL",  color: "text-slate-300",  rgb: "203, 213, 225", priceUsdt:  1000 },
};

// ─── Arbitrum 节点购买(thirdweb Edition Drop / DropERC1155)────────────────────
// 与 BSC NodePresell 独立并存:Arbitrum One 上的 DropERC1155,thirdweb v5 ClaimButton
// (ERC1155) claim,USDC(Arb) 结算,PayModal 跨链支付(USDT@BSC 自动桥成 USDC@Arb)。
// 价格/限量为展示快照,真实余量从链上 getActiveClaimCondition 读。
export const arbNodeDropContract: ThirdwebContract = getContract({
  client: thirdwebClient,
  chain: arbitrum,
  address: ARB_NODE_DROP_ADDRESS,
});

export interface ArbNodeTier {
  tokenId: bigint;
  /** 站点节点语义编号(101-501);token5=601 体验档。display 用,故 number。 */
  tier: number;
  level: string;
  nameCn: string;
  nameEn: string;
  color: string;
  rgb: string;
  /** 展示用价格(USDC,整数)。真实价格以链上 claim condition 为准。 */
  priceUsdc: number;
  /** 展示用限量。真实余量以链上 supplyClaimed/maxClaimableSupply 为准。 */
  maxSupply: number;
  /** 每钱包限购。 */
  perWallet: number;
}

export const ARB_NODE_TIERS: readonly ArbNodeTier[] = [
  { tokenId: 0n, tier: 101, level: "founder",  nameCn: "符主", nameEn: "FOUNDER",  color: "text-purple-400", rgb: "192, 132, 252", priceUsdc: 50000, maxSupply:   20, perWallet: 1 },
  { tokenId: 1n, tier: 201, level: "super",    nameCn: "符魂", nameEn: "SUPER",    color: "text-amber-400",  rgb: "251, 191, 36",  priceUsdc: 10000, maxSupply:  200, perWallet: 1 },
  { tokenId: 2n, tier: 301, level: "advanced", nameCn: "符印", nameEn: "ADVANCED", color: "text-green-400",  rgb: "52, 211, 153",  priceUsdc:  5000, maxSupply:  400, perWallet: 1 },
  { tokenId: 3n, tier: 401, level: "mid",      nameCn: "符源", nameEn: "MID",      color: "text-blue-400",   rgb: "96, 165, 250",  priceUsdc:  2500, maxSupply:  800, perWallet: 1 },
  { tokenId: 4n, tier: 501, level: "initial",  nameCn: "符胚", nameEn: "INITIAL",  color: "text-slate-300",  rgb: "203, 213, 225", priceUsdc:  1000, maxSupply: 1000, perWallet: 1 },
  { tokenId: 5n, tier: 601, level: "entry",    nameCn: "符引", nameEn: "ENTRY",    color: "text-zinc-400",   rgb: "161, 161, 170", priceUsdc:    10, maxSupply: 5000, perWallet: 1 },
] as const;
