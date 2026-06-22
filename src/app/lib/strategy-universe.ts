/**
 * 三大策略市场 ↔ HL 币种宇宙(前后端共享的单一事实源)。
 *
 * 用途:
 *  1) 「真约束交易」—— 账户选定一个策略市场后,其全部 HL 订阅的 allowed_coins 设成该市场宇宙;
 *     copy-executor(matchOne)按 allowed_coins 白名单过滤 → 只交易该板块的币(用户决策 2026-06-20)。
 *  2) 信号分类 —— 把交易员信号/看板按 coinSector() 打板块标签、可筛选。
 *
 * 约定:
 *  - equity-swing 用 HL HIP-3 永续符号(带 dex 前缀,如 `xyz:NVDA`、`idx:IDX0`、商品 `xyz:CL`)。
 *  - 币名统一大写比较;HL 的 k 前缀小数币(kPEPE/kBONK)按其上市符号收录。
 *  - 后端 applyStrategyMarket 直接复用本文件导出的 UNIVERSE(经由构建产物 / 复制常量),保持一致。
 */

export type StrategyMarket = "crypto-trend" | "equity-swing" | "meme-momentum";

export const STRATEGY_MARKETS: StrategyMarket[] = ["crypto-trend", "equity-swing", "meme-momentum"];

/** 各市场允许交易的 HL 币种白名单(= 订阅 allowed_coins 的来源)。 */
export const STRATEGY_UNIVERSE: Record<StrategyMarket, string[]> = {
  // 主流 + 大市值山寨永续(剔除 meme 与股票);覆盖绝大多数趋势型 leader 的实际交易币。
  "crypto-trend": [
    "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "HYPE", "LINK", "SUI",
    "LTC", "BCH", "DOT", "NEAR", "APT", "ARB", "OP", "INJ", "TIA", "SEI",
    "ATOM", "UNI", "AAVE", "MKR", "LDO", "RUNE", "FIL", "ETC", "XLM", "ALGO",
    "ICP", "IMX", "STX", "ENA", "ENS", "JUP", "PYTH", "WLD", "ZEC", "CRV",
    "DYDX", "GMX", "ORDI", "TAO", "KAS", "JTO", "STRK", "EIGEN",
  ],
  // HL HIP-3 股票 + 商品永续(dex 前缀符号,取自近 7 天真实信号)。
  "equity-swing": [
    "xyz:NVDA", "xyz:AAPL", "xyz:TSLA", "xyz:MSFT", "xyz:META", "xyz:AMZN",
    "xyz:GOOGL", "xyz:AMD", "xyz:MU", "xyz:PLTR", "xyz:HIMS", "xyz:NBIS",
    "xyz:WDC", "xyz:SNDK", "xyz:IBM", "xyz:CBRS", "xyz:DRAM", "xyz:SPCX",
    "xyz:MRVL", "xyz:SILVER", "xyz:CL", "xyz:BRENTOIL",
    "idx:IDX0", "idx:IDX2",
  ],
  // Meme 动量(含 HL k 前缀小数币)。
  "meme-momentum": [
    "DOGE", "WIF", "kPEPE", "kBONK", "PENGU", "TRUMP", "FARTCOIN", "SPX",
    "POPCAT", "MEW", "BOME", "MOODENG", "PNUT", "GOAT", "NEIRO", "TURBO",
    "BRETT", "MELANIA", "kSHIB", "kFLOKI", "WLFI",
  ],
};

/** 市场展示元信息(图标 emoji / i18n key 走 strategyName.*)。 */
export const STRATEGY_MARKET_META: Record<StrategyMarket, { emoji: string; accent: string }> = {
  "crypto-trend": { emoji: "₿", accent: "amber" },
  "equity-swing": { emoji: "📈", accent: "sky" },
  "meme-momentum": { emoji: "🐸", accent: "fuchsia" },
};

const _coinToSector = (() => {
  const m = new Map<string, StrategyMarket>();
  for (const mk of STRATEGY_MARKETS) for (const c of STRATEGY_UNIVERSE[mk]) m.set(c.toUpperCase(), mk);
  return m;
})();

/** 把一个 HL coin 归类到策略市场;股票/商品按 dex 前缀兜底归 equity-swing;未知 → null。 */
export function coinSector(coin: string): StrategyMarket | null {
  if (!coin) return null;
  const exact = _coinToSector.get(coin.toUpperCase());
  if (exact) return exact;
  // 兜底:任何带已知 HIP-3 股票/指数 dex 前缀的币都归美股板块。
  if (/^(xyz|idx):/i.test(coin)) return "equity-swing";
  return null;
}

/** 某 coin 是否属于给定市场(用于前端筛选/标签)。 */
export function inMarket(coin: string, market: StrategyMarket): boolean {
  return coinSector(coin) === market;
}
