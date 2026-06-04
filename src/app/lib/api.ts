// Convert snake_case DB rows to camelCase for frontend
function toCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (typeof obj !== "object") return obj;
  const out: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camelKey] = toCamel(obj[key]);
  }
  return out;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

export async function apiPost(path: string, body: any) {
  return apiFetch(path, { method: "POST", body: JSON.stringify(body) });
}

// ── Helper: proxy external API calls through our Supabase `api-proxy` edge
//    function (replaces the old api-server `/api/proxy` route — we no longer
//    run one). Edge function does the CORS-bypassing outbound fetch.
import { invokeFn } from "@app/lib/supabase-client";
import { ENGINE_BASE } from "@app/lib/engine";
async function proxyFetch(url: string): Promise<any> {
  return invokeFn<any>("api-proxy", { url });
}

// ── MA price ──────────────────────────────────────────────────────────────────
export async function getMaPrice(): Promise<{ price: number; source: string }> {
  return apiFetch("/api/ma-price");
}

// ── Profiles ──────────────────────────────────────────────────────────────────
export async function getProfile(walletAddress: string) {
  return apiFetch(`/api/profile/${encodeURIComponent(walletAddress)}`);
}

export async function getProfileByRefCode(refCode: string) {
  return apiFetch(`/api/profile-by-refcode/${encodeURIComponent(refCode)}`);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function authWallet(walletAddress: string, refCode?: string, placementCode?: string) {
  return apiPost("/api/auth-wallet", { walletAddress, refCode, placementCode });
}

// ── Vault ─────────────────────────────────────────────────────────────────────
export async function getVaultPositions(walletAddress: string) {
  return apiFetch(`/api/vault-positions/${encodeURIComponent(walletAddress)}`);
}

export async function getVaultRewards(walletAddress: string) {
  return apiFetch(`/api/vault-rewards/${encodeURIComponent(walletAddress)}`);
}

export async function vaultDeposit(walletAddress: string, planType: string, amount: number, txHash?: string) {
  return apiPost("/api/vault-deposit", { walletAddress, planType, depositAmount: amount, txHash });
}

export async function vaultWithdraw(walletAddress: string, position_id: string) {
  return apiPost("/api/vault-withdraw", { walletAddress, positionId: position_id });
}

export async function getVaultOverview() {
  return apiFetch("/api/vault-overview");
}

// ── Transactions ──────────────────────────────────────────────────────────────
export async function getTransactions(walletAddress: string, type?: string) {
  const url = type
    ? `/api/transactions/${encodeURIComponent(walletAddress)}?type=${encodeURIComponent(type)}`
    : `/api/transactions/${encodeURIComponent(walletAddress)}`;
  return apiFetch(url);
}

// ── Trade Bets ────────────────────────────────────────────────────────────────
export async function placeTradeBet(
  walletAddress: string,
  asset: string,
  direction: string,
  amount: number,
  duration: string,
  entryPrice?: number
) {
  return apiPost("/api/place-trade-bet", { walletAddress, asset, direction, amount, duration: duration || "1min", entryPrice });
}

export async function getTradeStats(walletAddress: string) {
  return apiFetch(`/api/trade-stats/${encodeURIComponent(walletAddress)}`);
}

// ── Strategies ────────────────────────────────────────────────────────────────
export async function getStrategies() {
  return apiFetch("/api/strategies");
}

export async function getStrategyOverview() {
  return apiFetch("/api/strategy-overview");
}

export async function subscribeStrategy(walletAddress: string, strategyId: string, amount: number) {
  return apiPost("/api/subscribe-strategy", { walletAddress, strategyId, capital: amount });
}

export async function getSubscriptions(walletAddress: string) {
  return apiFetch(`/api/subscriptions/${encodeURIComponent(walletAddress)}`);
}

// ── Hedge / Insurance ─────────────────────────────────────────────────────────
export async function getHedgePositions(walletAddress: string) {
  return apiFetch(`/api/hedge-positions/${encodeURIComponent(walletAddress)}`);
}

export async function getHedgePurchases(walletAddress: string) {
  return apiFetch(`/api/hedge-purchases/${encodeURIComponent(walletAddress)}`);
}

export async function purchaseHedge(walletAddress: string, amount: number) {
  return apiPost("/api/purchase-hedge", { walletAddress, hedgeAmount: amount });
}

export async function getInsurancePool() {
  return apiFetch("/api/insurance-pool");
}

// ── VIP ───────────────────────────────────────────────────────────────────────
export async function subscribeVip(walletAddress: string, txHash?: string, planLabel?: string) {
  return apiPost("/api/subscribe-vip", { walletAddress, txHash, planLabel: planLabel || "monthly" });
}

export async function activateVipTrial(walletAddress: string) {
  return apiPost("/api/subscribe-vip", { walletAddress, txHash: null, planLabel: "trial" });
}

// ── Nodes ─────────────────────────────────────────────────────────────────────
export async function getNodeMembership(walletAddress: string) {
  return apiFetch(`/api/node-membership/${encodeURIComponent(walletAddress)}`);
}

export async function getNodeMemberships(walletAddress: string) {
  return apiFetch(`/api/node-memberships/${encodeURIComponent(walletAddress)}`);
}

export async function getNodeOverview(walletAddress: string) {
  return apiFetch(`/api/node-overview/${encodeURIComponent(walletAddress)}`);
}

export async function purchaseNode(walletAddress: string, nodeType: string, txHash?: string, paymentMode?: string, authCode?: string) {
  return apiPost("/api/purchase-node", { walletAddress, nodeType, txHash, paymentMode, authCode });
}

export async function validateAuthCode(code: string): Promise<boolean> {
  const result = await apiFetch(`/api/validate-auth-code/${encodeURIComponent(code)}`);
  return result?.valid === true;
}

export async function checkNodeMilestones(walletAddress: string) {
  return apiPost("/api/check-node-milestones", { walletAddress });
}

export async function getNodeMilestoneRequirements(walletAddress: string) {
  return apiFetch(`/api/node-milestone-requirements/${encodeURIComponent(walletAddress)}`);
}

export async function getNodeEarningsRecords(walletAddress: string) {
  return apiFetch(`/api/node-earnings/${encodeURIComponent(walletAddress)}`);
}

// ── Prediction Bets ───────────────────────────────────────────────────────────
export async function getPredictionBets(walletAddress: string) {
  return apiFetch(`/api/prediction-bets/${encodeURIComponent(walletAddress)}`);
}

export async function placePredictionBet(
  walletAddress: string,
  marketId: string,
  marketType: string,
  question: string,
  choice: string,
  odds: number,
  amount: number
) {
  return apiPost("/api/place-prediction-bet", { walletAddress, marketId, marketType, question, choice, odds, amount });
}

// ── AI Predictions ────────────────────────────────────────────────────────────
export async function getAiPredictions() {
  return apiFetch("/api/ai-predictions");
}

export async function getAiPrediction(asset: string, timeframe: string, lang?: string) {
  return apiPost("/api/ai-prediction", { asset, timeframe, lang: lang || "en" });
}

export async function getAiForecast(asset: string, timeframe: string, lang?: string) {
  return apiPost("/api/ai-forecast", { asset, timeframe, lang: lang || "en" });
}

// AI forecast lives on the Supabase `ai-forecast-multi` edge function — it
// holds the OpenAI / Cloudflare AI Gateway / OpenRouter keys and runs the
// 5-model fan-out + technical-indicator pipeline. Frontend just invokes.
export async function getAiForecastMulti(asset: string, timeframe: string, lang?: string) {
  return invokeFn<any>("ai-forecast-multi", { asset, timeframe, lang: lang || "en" });
}

export async function getAiForecastSingle(asset: string, timeframe: string, model: string, lang?: string) {
  return invokeFn<any>("ai-forecast-multi", { asset, timeframe, model, lang: lang || "en" });
}

// Default basket of assets surfaced as AI prediction cards on the Trade page.
const AI_FORECAST_ASSETS = ["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP"] as const;

/**
 * Real AI predictions for the Trade page, sourced from the live Supabase
 * `ai-forecast-multi` edge function (which runs the OpenAI/AI-Gateway model
 * fan-out + technical-indicator pipeline) — NOT the dead `/api/ai-predictions`
 * route. We fan out over a small asset basket and normalize each consensus
 * result into the `AiPrediction` card shape. The edge fn's exact field names
 * vary by model, so the mapper is defensive: it accepts several aliases and
 * returns `null` for any asset whose response can't be mapped, so the caller
 * can transparently fall back to clearly-badged sample data rather than render
 * a fabricated card.
 */
export async function getAiPredictionsReal(timeframe = "4H", lang?: string): Promise<any[]> {
  const results = await Promise.allSettled(
    AI_FORECAST_ASSETS.map((asset) => getAiForecastMulti(asset, timeframe, lang)),
  );
  const out: any[] = [];
  results.forEach((r, i) => {
    if (r.status !== "fulfilled" || !r.value) return;
    const mapped = normalizeForecastToPrediction(AI_FORECAST_ASSETS[i], timeframe, r.value);
    if (mapped) out.push(mapped);
  });
  return out;
}

function pickNum(...vals: any[]): number | null {
  for (const v of vals) {
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickStr(...vals: any[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

// Normalize a single `ai-forecast-multi` response (whatever its shape) into an
// `AiPrediction`. Returns null when the essentials (a direction) are missing.
function normalizeForecastToPrediction(asset: string, timeframe: string, raw: any): any | null {
  // The consensus may live at the top level or under common wrapper keys.
  const c = raw?.consensus ?? raw?.forecast ?? raw?.result ?? raw?.data ?? raw;
  if (!c || typeof c !== "object") return null;

  const dirRaw = String(
    c.prediction ?? c.direction ?? c.signal ?? c.side ?? c.sentiment ?? "",
  ).toUpperCase();
  let prediction: "BULLISH" | "BEARISH" | "NEUTRAL";
  if (dirRaw.includes("BULL") || dirRaw === "LONG" || dirRaw === "UP" || dirRaw === "BUY") prediction = "BULLISH";
  else if (dirRaw.includes("BEAR") || dirRaw === "SHORT" || dirRaw === "DOWN" || dirRaw === "SELL") prediction = "BEARISH";
  else if (dirRaw.includes("NEUTRAL") || dirRaw === "HOLD") prediction = "NEUTRAL";
  else return null; // no usable direction → don't fabricate

  const confRaw = pickNum(c.confidence, c.conf, c.score, c.probability);
  const confidence = confRaw == null ? null : (confRaw <= 1 ? Math.round(confRaw * 100) : Math.round(confRaw));
  const current = pickNum(c.currentPrice, c.current_price, c.price, c.spot);
  const target = pickNum(c.targetPrice, c.target_price, c.target);
  const fgi = pickNum(c.fearGreedIndex, c.fear_greed_index, c.fgi);
  const fgiLabel = pickStr(c.fearGreedLabel, c.fear_greed_label) ?? (fgi != null ? getFgiLabel(fgi) : null);
  const reasoning = pickStr(c.reasoning, c.rationale, c.analysis, c.summary, c.message);

  return {
    id: `ai-real-${asset}`,
    asset,
    prediction,
    confidence: confidence == null ? null : String(confidence),
    targetPrice: target == null ? null : String(target),
    currentPrice: current == null ? null : String(current),
    fearGreedIndex: fgi,
    fearGreedLabel: fgiLabel,
    reasoning,
    timeframe: pickStr(c.timeframe) ?? timeframe,
    expiresAt: null,
    createdAt: pickStr(c.createdAt, c.created_at) ?? new Date().toISOString(),
  };
}

export const AI_MODEL_LABELS = ["GPT-4o", "DeepSeek", "Llama 3.1", "Gemini", "Grok"] as const;

export async function getAiFearGreed() {
  return apiFetch("/api/ai-fear-greed");
}

/**
 * Real crypto-news predictions for the Trade page, sourced from the live engine
 * route `GET /v1/sentiment/news` via the same-origin `/engine` proxy (which
 * injects the project API key server-side — see functions/engine/[[path]].ts,
 * `v1` is allowlisted). That route returns recent `market_sentiment` rows where
 * source='news-cryptopanic' (headline/url/source/asset/sentiment/publishedAt).
 *
 * We map each row into the Trade page's `NewsPred` card shape. If the feed is
 * gated off (CRYPTOPANIC_ENABLED=false) or hasn't ingested yet, the engine
 * honestly returns an empty array → we return [] and the caller falls back to
 * clearly-badged sample data rather than rendering fabricated headlines.
 */
export async function getNewsPredictions(): Promise<any[]> {
  try {
    const url = `${ENGINE_BASE.replace(/\/+$/, "")}/v1/sentiment/news?limit=30`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    const rows: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    return rows
      .map((r) => normalizeNewsRow(r))
      .filter((n): n is NonNullable<typeof n> => n !== null);
  } catch {
    return [];
  }
}

// Map one `/v1/sentiment/news` row → the Trade page `NewsPred` card shape.
// Returns null when there's no real headline (so we never render an empty card).
function normalizeNewsRow(r: any): any | null {
  const headline = pickStr(r?.headline, r?.title);
  if (!headline) return null;
  const sentRaw = String(r?.sentiment ?? r?.classification ?? "").toUpperCase();
  const prediction: "BULLISH" | "BEARISH" | "NEUTRAL" =
    sentRaw.includes("BULL") ? "BULLISH" : sentRaw.includes("BEAR") ? "BEARISH" : "NEUTRAL";
  const impRaw = String(r?.impact ?? "").toUpperCase();
  const impact: "HIGH" | "MEDIUM" | "LOW" =
    impRaw === "HIGH" ? "HIGH" : impRaw === "LOW" ? "LOW" : "MEDIUM";
  const conf = pickNum(r?.confidence);
  const realUrl = pickStr(r?.url);
  return {
    id: String(r?.id ?? `news-${headline.slice(0, 24)}`),
    headline,
    asset: pickStr(r?.asset, r?.symbol, r?.scope) ?? "CRYPTO",
    prediction,
    confidence: conf == null ? 50 : conf <= 1 ? Math.round(conf * 100) : Math.round(conf),
    reasoning: pickStr(r?.reasoning, r?.summary) ?? "",
    impact,
    source: pickStr(r?.source, r?.publisher, r?.domain) ?? "",
    url: realUrl && /^https?:\/\//i.test(realUrl) ? realUrl : "#",
    publishedAt: pickStr(r?.publishedAt, r?.published_at, r?.ts) ?? new Date().toISOString(),
  };
}

// ── Referral & Rank ───────────────────────────────────────────────────────────
export async function getReferralTree(walletAddress: string) {
  return apiFetch(`/api/referral-tree/${encodeURIComponent(walletAddress)}`);
}

export async function getRankStatus(walletAddress: string) {
  return apiFetch(`/api/rank-status/${encodeURIComponent(walletAddress)}`);
}

export async function getUserTeamStats(walletAddress: string) {
  return apiFetch(`/api/team-stats/${encodeURIComponent(walletAddress)}`);
}

export async function checkRankPromotion(walletAddress: string) {
  return apiPost("/api/check-rank-promotion", { walletAddress });
}

// ── Commissions ───────────────────────────────────────────────────────────────
export async function getCommissionRecords(walletAddress: string) {
  return apiFetch(`/api/commissions/${encodeURIComponent(walletAddress)}`);
}

// ── Earnings Release ──────────────────────────────────────────────────────────
export async function requestEarningsRelease(walletAddress: string, releaseDays: number, amount: number, sourceType: "VAULT" | "NODE" = "VAULT") {
  return apiPost("/api/request-earnings-release", { walletAddress, releaseDays, amount, sourceType });
}

export async function getEarningsReleases(walletAddress: string) {
  return apiFetch(`/api/earnings-releases/${encodeURIComponent(walletAddress)}`);
}

// ── Daily Settlement (admin) ──────────────────────────────────────────────────
export async function runDailySettlement() {
  return apiPost("/api/admin/daily-settlement", {});
}

// ─────────────────────────────────────────────
// C) Direct external API calls (public, no keys)
// ─────────────────────────────────────────────

const COIN_MAP: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", DOGE: "dogecoin", SOL: "solana",
};

async function getBinancePrice(symbol: string): Promise<number> {
  try {
    const pair = symbol === "DOGE" ? "DOGEUSDT" : `${symbol}USDT`;
    const res = await fetch(`https://api.binance.us/api/v3/ticker/price?symbol=${pair}`);
    if (res.ok) {
      const data = await res.json();
      return parseFloat(data.price) || 0;
    }
  } catch {}
  return 0;
}

async function getBinanceKlines(symbol: string, days: number): Promise<[number, number][]> {
  try {
    const pair = symbol === "DOGE" ? "DOGEUSDT" : `${symbol}USDT`;
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;
    const res = await fetch(
      `https://api.binance.us/api/v3/klines?symbol=${pair}&interval=1d&startTime=${startTime}&endTime=${endTime}&limit=${days + 1}`
    );
    if (res.ok) {
      const data = await res.json();
      return (data as any[]).map((k: any) => [k[0], parseFloat(k[4])]);
    }
  } catch {}
  return [];
}

export async function fetchExchangeDepth(symbol: string) {
  const pair = `${symbol.toUpperCase()}USDT`;
  const [depthRes, tickerRes] = await Promise.all([
    fetch(`https://api.binance.us/api/v3/depth?symbol=${pair}&limit=20`),
    fetch(`https://api.binance.us/api/v3/ticker/24hr?symbol=${pair}`),
  ]);

  const depth = depthRes.ok ? await depthRes.json() : { bids: [], asks: [] };
  const ticker = tickerRes.ok ? await tickerRes.json() : {};

  const bidsTotal = (depth.bids || []).reduce((s: number, b: [string, string]) => s + parseFloat(b[0]) * parseFloat(b[1]), 0);
  const asksTotal = (depth.asks || []).reduce((s: number, a: [string, string]) => s + parseFloat(a[0]) * parseFloat(a[1]), 0);
  const total = bidsTotal + asksTotal || 1;
  const baseBuy = (bidsTotal / total) * 100;
  const priceChange = parseFloat(ticker.priceChangePercent || "0");

  const exchangeNames = [
    "Binance", "OKX", "Bybit", "Bitget", "Kraken",
    "Coinbase", "Gate", "MEXC", "CoinEx", "LBank",
    "Hyperliquid", "Bitmex", "Crypto.com", "Bitunix",
    "KuCoin", "Huobi",
  ];
  const exchanges = exchangeNames.map((name, i) => {
    const seed = (symbol.charCodeAt(0) * 31 + i * 17) % 100;
    const variance = ((seed - 50) / 50) * 6;
    const buy = Math.max(20, Math.min(80, baseBuy + variance));
    const sell = 100 - buy;
    return {
      name,
      buyPercent: parseFloat(buy.toFixed(1)),
      sellPercent: parseFloat(sell.toFixed(1)),
    };
  });

  let fgi = 50;
  fgi += (baseBuy - 50) * 0.6;
  fgi += Math.max(-15, Math.min(15, priceChange * 3));
  fgi = Math.max(0, Math.min(100, Math.round(fgi)));
  const fgiLabel = fgi <= 25 ? "Extreme Fear" : fgi <= 45 ? "Fear" : fgi <= 55 ? "Neutral" : fgi <= 75 ? "Greed" : "Extreme Greed";

  return {
    symbol: symbol.toUpperCase(),
    price: parseFloat(ticker.lastPrice || "0"),
    change24h: priceChange,
    buyPercent: parseFloat(baseBuy.toFixed(1)),
    sellPercent: parseFloat((100 - baseBuy).toFixed(1)),
    buyVolume: bidsTotal,
    sellVolume: asksTotal,
    fearGreedIndex: fgi,
    fearGreedLabel: fgiLabel,
    exchanges,
  };
}

export async function fetchPolymarkets() {
  try {
    const markets = await proxyFetch(
      "https://gamma-api.polymarket.com/markets?closed=false&limit=20&order=volume24hr&ascending=false&tag=crypto"
    );
    return (markets || [])
      .filter((m: any) => m.active && !m.closed)
      .slice(0, 15)
      .map((m: any) => {
        let prices: string[] = [];
        try {
          prices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices || [];
        } catch { prices = []; }
        const yesRaw = parseFloat(prices[0] || m.bestAsk || "0.5");
        const noRaw = parseFloat(prices[1] || m.bestBid || "0.5");
        // CLOB outcome token IDs — REQUIRED to place a real CLOB order. Gamma
        // returns this as a JSON-string array `[yesTokenId, noTokenId]`, ordered
        // to match `outcomes: ["Yes","No"]`. Thread it through so the Trade page
        // can submit a real Polymarket bet (engine placeOrder needs tokenId).
        let clobTokenIds: string[] = [];
        try {
          clobTokenIds = typeof m.clobTokenIds === "string"
            ? JSON.parse(m.clobTokenIds)
            : (Array.isArray(m.clobTokenIds) ? m.clobTokenIds : []);
        } catch { clobTokenIds = []; }
        return {
          id: m.id || m.conditionId,
          conditionId: m.conditionId,
          question: m.question,
          yesPrice: isNaN(yesRaw) ? 0.5 : yesRaw,
          noPrice: isNaN(noRaw) ? 0.5 : noRaw,
          yesTokenId: clobTokenIds[0],
          noTokenId: clobTokenIds[1],
          tickSize: parseFloat(m.orderPriceMinTickSize || "0") || undefined,
          minOrderSize: parseFloat(m.orderMinSize || "0") || undefined,
          acceptingOrders: m.acceptingOrders !== false && m.enableOrderBook !== false,
          volume: parseFloat(m.volume24hr || m.volume || "0") || 0,
          liquidity: parseFloat(m.liquidity || "0") || 0,
          endDate: m.endDate || m.expirationDate,
          image: m.image,
          category: "crypto",
          slug: m.slug || m.conditionId || m.id,
        };
      });
  } catch {
    return [];
  }
}

function getFgiLabel(v: number): string {
  if (v <= 25) return "Extreme Fear";
  if (v <= 45) return "Fear";
  if (v <= 55) return "Neutral";
  if (v <= 75) return "Greed";
  return "Extreme Greed";
}

function addToBuckets(buckets: any, v: number) {
  if (v <= 25) buckets.extremeFear++;
  else if (v <= 45) buckets.fear++;
  else if (v <= 55) buckets.neutral++;
  else if (v <= 75) buckets.greed++;
  else buckets.extremeGreed++;
}

export async function fetchFearGreedHistory(coin: string) {
  const symbol = (coin || "BTC").toUpperCase();
  const coinId = COIN_MAP[symbol] || "bitcoin";

  const fngRes = await fetch("https://api.alternative.me/fng/?limit=90");
  const fngData = await fngRes.json();
  const fgiEntries = fngData.data || [];

  if (symbol === "BTC") {
    const buckets = { extremeFear: 0, fear: 0, neutral: 0, greed: 0, extremeGreed: 0 };
    for (const entry of fgiEntries) addToBuckets(buckets, parseInt(entry.value));
    const current = fgiEntries[0]
      ? { value: parseInt(fgiEntries[0].value), label: fgiEntries[0].value_classification }
      : { value: 50, label: "Neutral" };
    const chartData: { date: string; fgi: number; btcPrice: number }[] = [];
    const reversed = [...fgiEntries].reverse();
    for (const entry of reversed) {
      const ts = parseInt(entry.timestamp) * 1000;
      chartData.push({ date: new Date(ts).toISOString().split("T")[0], fgi: parseInt(entry.value), btcPrice: 0 });
    }
    return { current, buckets, totalDays: fgiEntries.length, chartData, lastUpdated: new Date().toISOString() };
  }

  let coinPrices: [number, number][] = [];
  let coinVolumes: [number, number][] = [];
  try {
    const coinData = await proxyFetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=90&interval=daily`
    );
    coinPrices = (coinData.prices as [number, number][]) || [];
    coinVolumes = (coinData.total_volumes as [number, number][]) || [];
  } catch {}

  const buckets = { extremeFear: 0, fear: 0, neutral: 0, greed: 0, extremeGreed: 0 };
  const chartData: { date: string; fgi: number; btcPrice: number }[] = [];

  if (coinPrices.length >= 2) {
    const dailyScores: { date: string; score: number; price: number }[] = [];
    for (let i = 1; i < coinPrices.length; i++) {
      const [ts, price] = coinPrices[i];
      const prevPrice = coinPrices[i - 1][1];
      const dateStr = new Date(ts).toISOString().split("T")[0];
      const priceChange1d = ((price - prevPrice) / prevPrice) * 100;
      const lookback7 = Math.max(0, i - 7);
      const momentum7d = ((price - coinPrices[lookback7][1]) / coinPrices[lookback7][1]) * 100;
      const lookback14 = Math.max(0, i - 14);
      const priceSlice = coinPrices.slice(lookback14, i + 1).map(p => p[1]);
      const mean = priceSlice.reduce((a, b) => a + b, 0) / priceSlice.length;
      const variance = priceSlice.reduce((a, b) => a + (b - mean) ** 2, 0) / priceSlice.length;
      const volatility = Math.sqrt(variance) / mean * 100;
      let volChange = 0;
      if (coinVolumes.length > i && i > 0) {
        const vol = coinVolumes[i][1];
        const prevVol = coinVolumes[Math.max(0, i - 1)][1];
        volChange = prevVol > 0 ? ((vol - prevVol) / prevVol) * 100 : 0;
      }
      let score = 50;
      score += Math.max(-20, Math.min(20, momentum7d * 2.5));
      score += Math.max(-10, Math.min(10, priceChange1d * 3));
      score -= Math.max(0, Math.min(15, (volatility - 3) * 3));
      score += Math.max(-5, Math.min(5, volChange * 0.05));
      score = Math.max(0, Math.min(100, Math.round(score)));
      dailyScores.push({ date: dateStr, score, price });
    }
    for (const ds of dailyScores) {
      addToBuckets(buckets, ds.score);
      chartData.push({ date: ds.date, fgi: ds.score, btcPrice: ds.price });
    }
    const latest = dailyScores[dailyScores.length - 1];
    return { current: { value: latest.score, label: getFgiLabel(latest.score) }, buckets, totalDays: dailyScores.length, chartData, lastUpdated: new Date().toISOString() };
  }

  const baseFgi = fgiEntries[0] ? parseInt(fgiEntries[0].value) : 50;
  const coinOffsets: Record<string, number> = { ETH: -3, SOL: 8, BNB: 2, DOGE: 12 };
  const offset = coinOffsets[symbol] || 0;
  const adjusted = Math.max(0, Math.min(100, baseFgi + offset));
  const reversed = [...fgiEntries].reverse();
  for (const entry of reversed) {
    const rawVal = parseInt(entry.value);
    const coinVal = Math.max(0, Math.min(100, rawVal + offset));
    const ts = parseInt(entry.timestamp) * 1000;
    addToBuckets(buckets, coinVal);
    chartData.push({ date: new Date(ts).toISOString().split("T")[0], fgi: coinVal, btcPrice: 0 });
  }
  return { current: { value: adjusted, label: getFgiLabel(adjusted) }, buckets, totalDays: fgiEntries.length, chartData, lastUpdated: new Date().toISOString() };
}

export async function fetchMarketCalendar(coin: string) {
  const symbol = (coin || "BTC").toUpperCase();
  const coinId = COIN_MAP[symbol] || "bitcoin";

  let prices: [number, number][] = [];
  let currentPrice = 0;

  try {
    const data = await proxyFetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30&interval=daily`
    );
    prices = data.prices as [number, number][];
    currentPrice = prices[prices.length - 1]?.[1] || 0;
  } catch {}

  if (prices.length < 2) {
    prices = await getBinanceKlines(symbol, 30);
    if (prices.length > 0) currentPrice = prices[prices.length - 1][1];
  }

  if (currentPrice === 0) currentPrice = await getBinancePrice(symbol);

  const dailyChanges: { date: string; day: number; change: number }[] = [];
  for (let i = 1; i < prices.length; i++) {
    const [ts, price] = prices[i];
    const prevPrice = prices[i - 1][1];
    if (prevPrice === 0) continue;
    const change = ((price - prevPrice) / prevPrice) * 100;
    const d = new Date(ts);
    dailyChanges.push({
      date: d.toISOString().split("T")[0],
      day: d.getDate(),
      change: parseFloat(change.toFixed(2)),
    });
  }

  return { dailyChanges, currentPrice };
}

export async function fetchSentiment() {
  const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "DOGEUSDT"];
  const symbolToName: Record<string, { name: string; symbol: string; id: string }> = {
    BTCUSDT: { name: "Bitcoin", symbol: "BTC", id: "bitcoin" },
    ETHUSDT: { name: "Ethereum", symbol: "ETH", id: "ethereum" },
    SOLUSDT: { name: "Solana", symbol: "SOL", id: "solana" },
    BNBUSDT: { name: "BNB", symbol: "BNB", id: "binancecoin" },
    DOGEUSDT: { name: "Dogecoin", symbol: "DOGE", id: "dogecoin" },
  };

  const [binanceRes, coingeckoCoins] = await Promise.all([
    fetch("https://api.binance.us/api/v3/ticker/24hr"),
    proxyFetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,binancecoin,dogecoin,solana&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d").catch(() => []),
  ]);

  let binanceTickers: any[] = [];
  try { binanceTickers = await binanceRes.json(); } catch {}

  const coingeckoMap = new Map<string, any>();
  if (Array.isArray(coingeckoCoins)) {
    for (const c of coingeckoCoins) coingeckoMap.set(c.id, c);
  }

  const sentiment = symbols.map((pair) => {
    const meta = symbolToName[pair];
    const cgCoin = coingeckoMap.get(meta.id);
    const bnTicker = Array.isArray(binanceTickers) ? binanceTickers.find((t: any) => t.symbol === pair) : null;
    const bnVolume = bnTicker ? parseFloat(bnTicker.quoteVolume || "0") : 0;
    const bnChange = bnTicker ? parseFloat(bnTicker.priceChangePercent || "0") : 0;
    const bnPrice = bnTicker ? parseFloat(bnTicker.lastPrice || "0") : 0;
    const cgVol = cgCoin?.total_volume || 0;
    const cgChange = cgCoin?.price_change_percentage_24h || 0;
    const totalVolume = bnVolume + cgVol;
    const avgChange = bnTicker ? (bnChange + cgChange) / 2 : cgChange;
    const netFlowRaw = totalVolume * (avgChange / 100) * 0.15;
    return {
      id: meta.id, symbol: meta.symbol, name: meta.name,
      image: cgCoin?.image || "",
      price: bnPrice || cgCoin?.current_price || 0,
      change24h: avgChange,
      change7d: cgCoin?.price_change_percentage_7d_in_currency || 0,
      marketCap: cgCoin?.market_cap || 0,
      volume: totalVolume,
      netFlow: parseFloat(netFlowRaw.toFixed(0)),
      binanceVolume: bnVolume,
      exchanges: bnTicker ? ["Binance", "CoinGecko Aggregated"] : ["CoinGecko Aggregated"],
    };
  });

  sentiment.sort((a, b) => Math.abs(b.netFlow) - Math.abs(a.netFlow));
  return { coins: sentiment, totalNetInflow: sentiment.reduce((s, c) => s + c.netFlow, 0) };
}

export async function fetchFuturesOI() {
  const pairs = [
    { symbol: "BTCUSDT", label: "BTC" },
    { symbol: "ETHUSDT", label: "ETH" },
    { symbol: "SOLUSDT", label: "SOL" },
  ];
  const exchanges = [
    { name: "Binance", weight: 0.38 },
    { name: "OKX", weight: 0.22 },
    { name: "Bybit", weight: 0.18 },
    { name: "Bitget", weight: 0.12 },
    { name: "Gate", weight: 0.10 },
  ];

  const tickerRes = await fetch("https://api.binance.us/api/v3/ticker/24hr");
  let allTickers: any[] = [];
  try { allTickers = await tickerRes.json(); } catch {}

  const results: any[] = [];
  let totalOI = 0;

  for (const pair of pairs) {
    const ticker = Array.isArray(allTickers) ? allTickers.find((t: any) => t.symbol === pair.symbol) : null;
    const price = ticker ? parseFloat(ticker.lastPrice || "0") : 0;
    const volume = ticker ? parseFloat(ticker.quoteVolume || "0") : 0;
    const priceChange = ticker ? parseFloat(ticker.priceChangePercent || "0") : 0;

    for (const ex of exchanges) {
      const oiBase = volume * ex.weight * 0.4;
      const jitter = 1 + (Math.random() * 0.06 - 0.03);
      const oiValue = oiBase * jitter;
      totalOI += oiValue;
      results.push({
        pair: pair.symbol, symbol: pair.label, exchange: ex.name,
        openInterestValue: oiValue,
        openInterest: price > 0 ? Math.round(oiValue / price) : 0,
        price, priceChange24h: priceChange,
      });
    }
  }

  return { positions: results, totalOI };
}

export async function fetchExchangePrices() {
  const coins = [
    { symbol: "BTC", binancePair: "BTCUSDT", krakenPair: "XXBTZUSD", coinbaseId: "BTC", cgId: "bitcoin" },
    { symbol: "ETH", binancePair: "ETHUSDT", krakenPair: "XETHZUSD", coinbaseId: "ETH", cgId: "ethereum" },
    { symbol: "SOL", binancePair: "SOLUSDT", krakenPair: "SOLUSD", coinbaseId: "SOL", cgId: "solana" },
    { symbol: "BNB", binancePair: "BNBUSDT", krakenPair: null as string | null, coinbaseId: null as string | null, cgId: "binancecoin" },
    { symbol: "DOGE", binancePair: "DOGEUSDT", krakenPair: "XDGUSD", coinbaseId: "DOGE", cgId: "dogecoin" },
  ];

  const exchangeNames = [
    "Binance", "OKX", "Bybit", "Bitget", "Kraken",
    "Coinbase", "Gate", "MEXC", "CoinEx", "LBank",
    "Hyperliquid", "Bitmex", "Crypto.com", "Bitunix",
    "KuCoin", "Huobi",
  ];

  const coinbaseSymbols = coins.map(c => c.symbol);
  const [bnTickersRaw, krakenRaw, cgRaw, ...coinbaseResults] = await Promise.all([
    fetch("https://api.binance.us/api/v3/ticker/24hr").then(r => r.json()).catch(() => []),
    fetch("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,XETHZUSD,SOLUSD,XDGUSD").then(r => r.json()).catch(() => null),
    proxyFetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,dogecoin&vs_currencies=usd").catch(() => null),
    ...coinbaseSymbols.map(sym =>
      fetch(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`).then(r => r.json()).catch(() => null)
    ),
  ]);

  const bnTickers = Array.isArray(bnTickersRaw) ? bnTickersRaw : [];
  const krakenResult = krakenRaw?.result || {};
  const coinbasePrices: Record<string, number> = {};
  coinbaseSymbols.forEach((sym, i) => {
    const amt = coinbaseResults[i]?.data?.amount;
    if (amt) coinbasePrices[sym] = parseFloat(amt);
  });

  const allCoinsData: any[] = [];
  for (const coin of coins) {
    const bnTicker = bnTickers.find((t: any) => t.symbol === coin.binancePair);
    const bnPrice = bnTicker ? parseFloat(bnTicker.lastPrice || "0") : 0;
    const bnChange = bnTicker ? parseFloat(bnTicker.priceChangePercent || "0") : 0;
    let krakenPrice = 0;
    if (coin.krakenPair && krakenResult[coin.krakenPair]) {
      krakenPrice = parseFloat(krakenResult[coin.krakenPair].c?.[0] || "0");
    }
    const cbPrice = coinbasePrices[coin.symbol] || 0;
    const cgPrice = cgRaw?.[coin.cgId]?.usd || 0;
    const basePrice = bnPrice || krakenPrice || cbPrice || cgPrice || 0;
    if (basePrice === 0) continue;

    const realPrices: Record<string, number> = {};
    if (bnPrice > 0) realPrices["Binance"] = bnPrice;
    if (krakenPrice > 0) realPrices["Kraken"] = krakenPrice;
    if (cbPrice > 0) realPrices["Coinbase"] = cbPrice;
    if (cgPrice > 0) realPrices["CoinGecko"] = cgPrice;

    const spreadFactor = basePrice * 0.0003;
    const rows = exchangeNames.map((exName) => {
      const realP = realPrices[exName];
      const spread = (Math.random() * 2 - 1) * spreadFactor;
      const price = realP || (basePrice + spread);
      const change = bnChange + (Math.random() * 0.4 - 0.2);
      return {
        exchange: exName, pair: `${coin.symbol}/USDT`, symbol: coin.symbol,
        price: parseFloat(price.toFixed(coin.symbol === "DOGE" ? 5 : 2)),
        change24h: parseFloat(change.toFixed(2)),
        isReal: !!realP,
      };
    });
    allCoinsData.push({ symbol: coin.symbol, basePrice, baseChange: bnChange, exchanges: rows });
  }
  return allCoinsData;
}

// ── AI Fear & Greed (server-side) ─────────────────────────────────────────────
export async function fetchAiFearGreed() {
  return apiFetch("/api/ai-fear-greed");
}
