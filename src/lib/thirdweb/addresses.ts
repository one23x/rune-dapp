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
