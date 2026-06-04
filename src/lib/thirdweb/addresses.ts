import type { RuneChainKey } from "./chains";

/**
 * Per-chain RUNE deployment map. Mainnet addresses come from the
 * runeapi 3 integration doc; the env override remains so staging
 * deployments can point at a re-deployed proxy without a rebuild.
 */
export interface RuneAddresses {
  usdt: `0x${string}`;
  community: `0x${string}`;
  nodePresell: `0x${string}`;
}

const testnet: RuneAddresses = {
  usdt:        "0xa87cC1e59598CD0C33bBe38746a81279BFfea0B8",
  community:   "0x42a06ac2208E9F8e25673BA0F6c44bc56fD2aa62",
  nodePresell: "0x6a30f26338742670637f47dfC04600B4d1eF1E9a",
};

const MAINNET_COMMUNITY    = "0xe6f1d4B5ea4B5a025e1E45C9E3d83F31201B6C9c";
const MAINNET_NODE_PRESELL = "0xF32747E7c120BB6333Ac83F25192c089e8d9b62E";

const mainnet: RuneAddresses = {
  usdt:        "0x55d398326f99059fF775485246999027B3197955",
  community:   ((import.meta.env.VITE_RUNE_COMMUNITY_MAINNET as string | undefined) || MAINNET_COMMUNITY) as `0x${string}`,
  nodePresell: ((import.meta.env.VITE_RUNE_NODE_PRESELL_MAINNET as string | undefined) || MAINNET_NODE_PRESELL) as `0x${string}`,
};

export function getRuneAddresses(chainKey: RuneChainKey): RuneAddresses {
  return chainKey === "bsc_mainnet" ? mainnet : testnet;
}

// ─── Arbitrum 节点购买(与 BSC NodePresell 并存,独立常量,勿塞进上面的二选一)──
//
// 链上 thirdweb Edition Drop (DropERC1155) 已部署在 Arbitrum One (chainId 42161),
// 支付币种 = Arbitrum 原生 USDC(6 位)。地址做成 env 可覆盖,默认 = 真实部署地址,
// 换一套部署不必重新构建。claim conditions(价格/限量/每钱包)已在链上配好,
// 5 档 = token id 0–4,前端直接 read。
export const ARB_NODE_DROP_ADDRESS = ((import.meta.env.VITE_ARB_NODE_DROP as string | undefined)
  || "0x9D296E2A959a3f584500913f19a0Dc2dfC7307a1") as `0x${string}`;

/** Arbitrum 原生 USDC(6 位)—— Edition Drop 的 claim 收款币种。 */
export const ARB_USDC_ADDRESS = ((import.meta.env.VITE_ARB_USDC as string | undefined)
  || "0xaf88d065e77c8cC2239327C5EDb3A432268e5831") as `0x${string}`;
