import { defineChain, type Chain } from "thirdweb/chains";

export type RuneChainKey = "bsc_mainnet" | "bsc_testnet";

/**
 * Pick the active chain from VITE_RUNE_CHAIN. Defaults to BSC mainnet —
 * the presale contracts are live on chainId 56 (see runeapi 3 doc). Set
 * VITE_RUNE_CHAIN=bsc_testnet to point at the testnet deployment.
 */
export function resolveRuneChainKey(): RuneChainKey {
  const v = (import.meta.env.VITE_RUNE_CHAIN as string | undefined)?.toLowerCase() ?? "bsc_mainnet";
  return v === "bsc_testnet" || v === "testnet" ? "bsc_testnet" : "bsc_mainnet";
}

/**
 * Explicit chain definitions with reliable public RPCs. Using `defineChain`
 * from thirdweb lets us override the default RPC — the stock thirdweb/chains
 * exports route through thirdweb's own RPC infrastructure, which on BSC
 * testnet lags real block production enough that `waitForReceipt` routinely
 * times out after 100 blocks even when the tx has long since confirmed.
 *
 * publicnode.com and nodereal.io are both free, rate-limit-generous, and
 * track the chain head near real-time for BSC.
 */
/* RPC URLs are env-overridable so a single deploy can swap to a paid
 * provider (Ankr / QuickNode HTTPS) without rebuilding. The default
 * picks a public RPC that has empirically held up under our load.
 *
 * publicnode.com sometimes drops connections under sustained polling
 * (`ERR_CONNECTION_CLOSED` from BSC traders' regions); when that
 * happens, set VITE_BSC_TESTNET_RPC=https://bsc-testnet.bnbchain.org or
 * a QuickNode endpoint to recover.
 */
export const bscMainnet: Chain = defineChain({
  id: 56,
  name: "BNB Smart Chain",
  rpc: (import.meta.env.VITE_BSC_MAINNET_RPC as string | undefined)
    ?? "https://bsc-dataseed.binance.org",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  blockExplorers: [{ name: "BscScan", url: "https://bscscan.com", apiUrl: "https://api.bscscan.com/api" }],
});

export const bscTestnetReliable: Chain = defineChain({
  id: 97,
  name: "BNB Smart Chain Testnet",
  // BSC's official `bsc-testnet.bnbchain.org` is more stable than the
  // publicnode mirror that's been throwing ERR_CONNECTION_CLOSED.
  rpc: (import.meta.env.VITE_BSC_TESTNET_RPC as string | undefined)
    ?? "https://bsc-testnet.bnbchain.org",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  blockExplorers: [{ name: "BscScan", url: "https://testnet.bscscan.com", apiUrl: "https://api-testnet.bscscan.com/api" }],
  testnet: true,
});

// ─── 交易链:Polymarket = pUSD@Polygon;Hyperliquid = USDC@Arbitrum(主网) /
//     Arbitrum Sepolia(测试网 gas)。加进 supportedChains 让钱包能切到这些链充值/提现。
export const polygon: Chain = defineChain({
  id: 137,
  name: "Polygon",
  rpc: (import.meta.env.VITE_POLYGON_RPC as string | undefined) ?? "https://polygon-rpc.com",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  blockExplorers: [{ name: "PolygonScan", url: "https://polygonscan.com", apiUrl: "https://api.polygonscan.com/api" }],
});

export const arbitrum: Chain = defineChain({
  id: 42161,
  name: "Arbitrum One",
  rpc: (import.meta.env.VITE_ARBITRUM_RPC as string | undefined) ?? "https://arb1.arbitrum.io/rpc",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  blockExplorers: [{ name: "Arbiscan", url: "https://arbiscan.io", apiUrl: "https://api.arbiscan.io/api" }],
});

export const arbitrumSepolia: Chain = defineChain({
  id: 421614,
  name: "Arbitrum Sepolia",
  rpc: (import.meta.env.VITE_ARBITRUM_SEPOLIA_RPC as string | undefined) ?? "https://sepolia-rollup.arbitrum.io/rpc",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  blockExplorers: [{ name: "Arbiscan", url: "https://sepolia.arbiscan.io" }],
  testnet: true,
});

export const runeChainKey: RuneChainKey = resolveRuneChainKey();

export const runeChain: Chain = runeChainKey === "bsc_mainnet" ? bscMainnet : bscTestnetReliable;

/**
 * Chains the ConnectButton offers for switching. BSC (presale/RUNE) + the
 * trading chains: Polygon (Polymarket pUSD), Arbitrum (HL USDC mainnet),
 * Arbitrum Sepolia (HL testnet). Active chain still starts at `runeChain`.
 */
export const supportedChains: Chain[] = [
  bscMainnet,
  bscTestnetReliable,
  polygon,
  arbitrum,
  arbitrumSepolia,
];
