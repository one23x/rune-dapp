import { getContract, type ThirdwebContract } from "thirdweb";
import { thirdwebClient } from "./client";
import { runeChain, runeChainKey } from "./chains";
import { getRuneAddresses } from "./addresses";
import { usdtAbi } from "./abis/usdt";

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
