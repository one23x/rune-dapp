import { useState, useMemo } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useActiveAccount } from "thirdweb/react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  getAiPredictions, fetchPolymarkets, getNewsPredictions,
  getPredictionBets, placePredictionBet,
} from "@app/lib/api";
import { queryClient } from "@app/lib/queryClient";
import { formatCompact } from "@app/lib/constants";
import {
  Search, Globe, Brain, Newspaper, TrendingUp, TrendingDown,
  ExternalLink, BarChart3, Clock, Trophy, Minus, Sparkles,
  ChevronDown, Flame, Star, AlertCircle, Wallet, RefreshCw,
  Users, BarChart2, ShieldCheck, Zap, ChevronRight,
} from "lucide-react";
import { useToast } from "@app/hooks/use-toast";
import { Link } from "wouter";
import type { AiPrediction, PredictionBet } from "@app-shared/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type Category = "all" | "crypto" | "ai" | "news" | "mybets";
type SortKey = "volume" | "ending" | "newest";

interface PolymarketMarket {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  endDate?: string;
  image?: string;
  category: string;
  slug: string;
}

interface NewsPred {
  id: string;
  headline: string;
  asset: string;
  prediction: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  reasoning: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  source: string;
  url: string;
  publishedAt: string;
}

interface UnifiedMarket {
  id: string;
  source: "polymarket" | "ai" | "news";
  question: string;
  volume: number;
  endDate?: string;
  image?: string;
  slug?: string;
  yesPrice?: number;
  noPrice?: number;
  aiPred?: AiPrediction;
  newsPred?: NewsPred;
}

// ─── Seed Data (shown when APIs return empty) ─────────────────────────────────

function daysFromNow(d: number) { return new Date(Date.now() + d * 86400000).toISOString(); }
function hoursAgo(h: number) { return new Date(Date.now() - h * 3600000).toISOString(); }

const SEED_POLYMARKETS: PolymarketMarket[] = [
  { id: "pm-1", question: "Will Bitcoin exceed $150,000 by end of 2026?", yesPrice: 0.42, noPrice: 0.58, volume: 2840000, liquidity: 890000, endDate: daysFromNow(180), category: "crypto", slug: "btc-150k-2026" },
  { id: "pm-2", question: "Will Ethereum ETF see $10B inflows in Q2 2026?", yesPrice: 0.35, noPrice: 0.65, volume: 1520000, liquidity: 450000, endDate: daysFromNow(60), category: "crypto", slug: "eth-etf-q2" },
  { id: "pm-3", question: "Will Solana flip Ethereum in daily transactions?", yesPrice: 0.28, noPrice: 0.72, volume: 980000, liquidity: 320000, endDate: daysFromNow(90), category: "crypto", slug: "sol-flip-eth" },
  { id: "pm-4", question: "Will the Fed cut rates before July 2026?", yesPrice: 0.61, noPrice: 0.39, volume: 4200000, liquidity: 1200000, endDate: daysFromNow(75), category: "politics", slug: "fed-rate-cut-2026" },
  { id: "pm-5", question: "Will AI tokens market cap exceed $500B?", yesPrice: 0.38, noPrice: 0.62, volume: 1100000, liquidity: 380000, endDate: daysFromNow(120), category: "crypto", slug: "ai-tokens-500b" },
  { id: "pm-6", question: "Will BNB reach $1,000 in 2026?", yesPrice: 0.22, noPrice: 0.78, volume: 750000, liquidity: 210000, endDate: daysFromNow(200), category: "crypto", slug: "bnb-1000" },
  { id: "pm-7", question: "Will there be a major CEX bankruptcy in 2026?", yesPrice: 0.15, noPrice: 0.85, volume: 620000, liquidity: 180000, endDate: daysFromNow(270), category: "crypto", slug: "cex-bankruptcy" },
  { id: "pm-8", question: "Will Dogecoin reach $1 before 2027?", yesPrice: 0.08, noPrice: 0.92, volume: 3100000, liquidity: 950000, endDate: daysFromNow(300), category: "crypto", slug: "doge-1-dollar" },
  { id: "pm-9", question: "Will Bitcoin dominance drop below 40%?", yesPrice: 0.18, noPrice: 0.82, volume: 1850000, liquidity: 520000, endDate: daysFromNow(150), category: "crypto", slug: "btc-dominance-40" },
  { id: "pm-10", question: "Will US approve a Solana ETF in 2026?", yesPrice: 0.45, noPrice: 0.55, volume: 2100000, liquidity: 680000, endDate: daysFromNow(100), category: "crypto", slug: "sol-etf-2026" },
  { id: "pm-11", question: "Will total crypto market cap reach $10T?", yesPrice: 0.32, noPrice: 0.68, volume: 3500000, liquidity: 1100000, endDate: daysFromNow(240), category: "crypto", slug: "crypto-10t" },
  { id: "pm-12", question: "Will China lift crypto trading ban by 2027?", yesPrice: 0.12, noPrice: 0.88, volume: 890000, liquidity: 250000, endDate: daysFromNow(365), category: "politics", slug: "china-crypto-ban" },
  { id: "pm-13", question: "Will XRP win full SEC lawsuit by Q3 2026?", yesPrice: 0.55, noPrice: 0.45, volume: 1650000, liquidity: 480000, endDate: daysFromNow(85), category: "crypto", slug: "xrp-sec-q3" },
  { id: "pm-14", question: "Will Layer 2 TVL exceed Ethereum L1?", yesPrice: 0.48, noPrice: 0.52, volume: 720000, liquidity: 210000, endDate: daysFromNow(160), category: "crypto", slug: "l2-tvl-exceed" },
  { id: "pm-15", question: "Will a CBDC launch in a G7 country by 2026?", yesPrice: 0.25, noPrice: 0.75, volume: 580000, liquidity: 160000, endDate: daysFromNow(200), category: "politics", slug: "g7-cbdc" },
];

const SEED_AI_PREDICTIONS: AiPrediction[] = [
  { id: "ai-1", asset: "BTC", prediction: "BULLISH", confidence: "78", targetPrice: "108500", currentPrice: "102300", fearGreedIndex: 68, fearGreedLabel: "Greed", reasoning: "Strong EMA alignment with increasing volume. MACD histogram expanding bullish. Support at $98K holding firm.", timeframe: "4H", expiresAt: daysFromNow(1), createdAt: hoursAgo(1) },
  { id: "ai-2", asset: "ETH", prediction: "BULLISH", confidence: "72", targetPrice: "4200", currentPrice: "3850", fearGreedIndex: 65, fearGreedLabel: "Greed", reasoning: "ETH/BTC ratio recovering. Blob fees increasing indicating L2 adoption. RSI momentum positive at 58.", timeframe: "4H", expiresAt: daysFromNow(1), createdAt: hoursAgo(2) },
  { id: "ai-3", asset: "SOL", prediction: "BULLISH", confidence: "81", targetPrice: "195", currentPrice: "172", fearGreedIndex: 72, fearGreedLabel: "Greed", reasoning: "Solana DEX volume hitting ATH. Firedancer upgrade sentiment positive. Breakout from descending triangle.", timeframe: "1H", expiresAt: daysFromNow(1), createdAt: hoursAgo(1) },
  { id: "ai-4", asset: "BNB", prediction: "NEUTRAL", confidence: "55", targetPrice: "620", currentPrice: "608", fearGreedIndex: 52, fearGreedLabel: "Neutral", reasoning: "Consolidating near $600 support. Low volatility environment. Waiting for BTC direction confirmation.", timeframe: "4H", expiresAt: daysFromNow(1), createdAt: hoursAgo(3) },
  { id: "ai-5", asset: "DOGE", prediction: "BEARISH", confidence: "64", targetPrice: "0.135", currentPrice: "0.158", fearGreedIndex: 45, fearGreedLabel: "Fear", reasoning: "Meme coin momentum fading. Whale wallets distributing. RSI bearish divergence on daily chart.", timeframe: "1D", expiresAt: daysFromNow(2), createdAt: hoursAgo(4) },
  { id: "ai-6", asset: "XRP", prediction: "BULLISH", confidence: "69", targetPrice: "2.85", currentPrice: "2.52", fearGreedIndex: 60, fearGreedLabel: "Greed", reasoning: "SEC lawsuit progress favorable. Cross-border payment partnerships expanding. Bollinger squeeze imminent.", timeframe: "4H", expiresAt: daysFromNow(1), createdAt: hoursAgo(2) },
  { id: "ai-7", asset: "ADA", prediction: "BEARISH", confidence: "62", targetPrice: "0.42", currentPrice: "0.48", fearGreedIndex: 38, fearGreedLabel: "Fear", reasoning: "Development activity declining. TVL flat. Price below 200 EMA. Possible retest of $0.40 support.", timeframe: "1D", expiresAt: daysFromNow(2), createdAt: hoursAgo(5) },
  { id: "ai-8", asset: "AVAX", prediction: "BULLISH", confidence: "74", targetPrice: "42", currentPrice: "36.5", fearGreedIndex: 58, fearGreedLabel: "Neutral", reasoning: "Subnet adoption accelerating. Gaming ecosystem growing. Price breaking above 50-day MA with volume.", timeframe: "4H", expiresAt: daysFromNow(1), createdAt: hoursAgo(1) },
  { id: "ai-9", asset: "LINK", prediction: "BULLISH", confidence: "76", targetPrice: "22", currentPrice: "18.9", fearGreedIndex: 62, fearGreedLabel: "Greed", reasoning: "CCIP adoption expanding rapidly. Staking TVL increasing. Technical pattern: cup and handle forming.", timeframe: "1D", expiresAt: daysFromNow(3), createdAt: hoursAgo(6) },
  { id: "ai-10", asset: "DOT", prediction: "NEUTRAL", confidence: "52", targetPrice: "7.5", currentPrice: "7.2", fearGreedIndex: 44, fearGreedLabel: "Fear", reasoning: "Parachain auctions slowing. Range-bound between $6.8-$7.8. Awaiting catalyst for directional move.", timeframe: "4H", expiresAt: daysFromNow(1), createdAt: hoursAgo(3) },
];

const SEED_NEWS: NewsPred[] = [
  { id: "n-1", headline: "BlackRock Bitcoin ETF sees record $1.2B daily inflow", asset: "BTC", prediction: "BULLISH", confidence: 82, reasoning: "Massive institutional demand signals sustained buying pressure. Likely to push BTC above key resistance levels.", impact: "HIGH", source: "Bloomberg", url: "#", publishedAt: hoursAgo(1) },
  { id: "n-2", headline: "SEC delays Ethereum options decision to Q3 2026", asset: "ETH", prediction: "BEARISH", confidence: 58, reasoning: "Regulatory delay dampens short-term sentiment. May cause temporary pullback as traders adjust positions.", impact: "MEDIUM", source: "Reuters", url: "#", publishedAt: hoursAgo(2) },
  { id: "n-3", headline: "Solana processes 100M transactions in 24 hours — new record", asset: "SOL", prediction: "BULLISH", confidence: 75, reasoning: "Network performance milestone validates scalability thesis. Likely to attract more DeFi and gaming projects.", impact: "HIGH", source: "CoinDesk", url: "#", publishedAt: hoursAgo(3) },
  { id: "n-4", headline: "Major crypto exchange announces $500M insurance fund", asset: "CRYPTO", prediction: "BULLISH", confidence: 65, reasoning: "Increased security measures boost institutional confidence. Positive for overall market sentiment.", impact: "MEDIUM", source: "The Block", url: "#", publishedAt: hoursAgo(4) },
  { id: "n-5", headline: "EU MiCA regulation fully enforced — compliance deadline hits", asset: "CRYPTO", prediction: "BEARISH", confidence: 60, reasoning: "Strict compliance requirements may cause small exchanges to exit EU. Short-term friction for market access.", impact: "HIGH", source: "Financial Times", url: "#", publishedAt: hoursAgo(5) },
  { id: "n-6", headline: "Chainlink CCIP integrated by 5 major banks for cross-chain", asset: "LINK", prediction: "BULLISH", confidence: 78, reasoning: "Enterprise adoption of Chainlink infrastructure validates long-term thesis. Strong fundamental catalyst.", impact: "HIGH", source: "Decrypt", url: "#", publishedAt: hoursAgo(2) },
  { id: "n-7", headline: "Whale alert: $400M BTC moved from exchange to cold storage", asset: "BTC", prediction: "BULLISH", confidence: 70, reasoning: "Large withdrawal from exchanges reduces sell-side liquidity. Historically precedes upward price moves.", impact: "MEDIUM", source: "CryptoQuant", url: "#", publishedAt: hoursAgo(6) },
  { id: "n-8", headline: "Dogecoin foundation announces smart contract upgrade", asset: "DOGE", prediction: "BULLISH", confidence: 62, reasoning: "Smart contract capability could expand DOGE utility beyond meme status. Watch for developer adoption.", impact: "LOW", source: "CoinTelegraph", url: "#", publishedAt: hoursAgo(7) },
  { id: "n-9", headline: "US Treasury proposes new stablecoin reporting requirements", asset: "CRYPTO", prediction: "BEARISH", confidence: 55, reasoning: "Additional compliance burden on stablecoin issuers. May slow DeFi growth temporarily.", impact: "MEDIUM", source: "WSJ", url: "#", publishedAt: hoursAgo(8) },
  { id: "n-10", headline: "Avalanche subnet adopted by major gaming studio for Web3 game", asset: "AVAX", prediction: "BULLISH", confidence: 72, reasoning: "AAA gaming adoption strengthens Avalanche ecosystem. Expected to drive TVL and user growth.", impact: "MEDIUM", source: "GameFi News", url: "#", publishedAt: hoursAgo(3) },
  { id: "n-11", headline: "BNB Chain burns $200M in quarterly token burn", asset: "BNB", prediction: "BULLISH", confidence: 68, reasoning: "Deflationary mechanism reduces supply. Historically bullish for BNB price action.", impact: "MEDIUM", source: "Binance Blog", url: "#", publishedAt: hoursAgo(9) },
  { id: "n-12", headline: "Federal Reserve signals potential rate pause through 2026", asset: "BTC", prediction: "NEUTRAL", confidence: 52, reasoning: "Uncertainty in macro direction. Risk assets could go either way depending on economic data.", impact: "HIGH", source: "CNBC", url: "#", publishedAt: hoursAgo(10) },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function endingLabel(dateStr: string | undefined, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return t("trade.ended");
  if (days === 0) return t("trade.endsToday");
  if (days === 1) return t("trade.endsTomorrow");
  return t("trade.endsOn", { date: new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProbBar({ yes, no }: { yes: number; no: number }) {
  const yPct = Math.round(yes * 100);
  const nPct = Math.round(no * 100);
  return (
    <div className="flex h-1 rounded-full overflow-hidden gap-px">
      <div className="bg-emerald-500 transition-all duration-500 rounded-l-full" style={{ width: `${yPct}%` }} />
      <div className="bg-red-500 transition-all duration-500 rounded-r-full" style={{ width: `${nPct}%` }} />
    </div>
  );
}

function VolBadge({ volume }: { volume: number }) {
  if (!volume) return null;
  return (
    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
      <BarChart3 className="h-2.5 w-2.5" />
      {formatCompact(volume)}
    </span>
  );
}

// ─── Market Card: Polymarket ──────────────────────────────────────────────────

function PolyCard({
  market, hasBet, onBetYes, onBetNo,
}: {
  market: PolymarketMarket;
  hasBet: boolean;
  onBetYes: () => void;
  onBetNo: () => void;
}) {
  const { t } = useTranslation();
  const yPct = (market.yesPrice * 100).toFixed(0);
  const nPct = (market.noPrice * 100).toFixed(0);
  const end = endingLabel(market.endDate, t);
  const isHot = market.volume > 500_000;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: "linear-gradient(145deg, rgba(28,20,12,0.95), rgba(18,14,6,0.98))",
        border: "1px solid rgba(212,168,50,0.40)",
        boxShadow: "0 8px 24px -10px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,168,50,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {market.image && (
        <div className="h-28 overflow-hidden relative">
          <img src={market.image} alt="" className="w-full h-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(18,14,6,0.98)]" />
          {isHot && (
            <Badge className="absolute top-2 left-2 text-[10px] bg-orange-500/90 text-white border-0 no-default-hover-elevate no-default-active-elevate">
              <Flame className="h-2.5 w-2.5 mr-0.5" /> {t("trade.hotMarket")}
            </Badge>
          )}
          {hasBet && (
            <Badge className="absolute top-2 right-2 text-[10px] bg-amber-500/90 text-black border-0 no-default-hover-elevate no-default-active-elevate">
              <Trophy className="h-2.5 w-2.5 mr-0.5" /> {t("trade.enteredBadge")}
            </Badge>
          )}
        </div>
      )}

      <div className="p-3">
        {!market.image && hasBet && (
          <div className="flex justify-end mb-1">
            <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30 no-default-hover-elevate no-default-active-elevate">
              <Trophy className="h-2.5 w-2.5 mr-0.5" /> {t("trade.enteredBadge")}
            </Badge>
          </div>
        )}

        <div className="flex items-start justify-between gap-2 mb-2.5 min-h-[36px]">
          <p className="text-[13px] font-semibold leading-snug text-foreground/90 flex-1 line-clamp-2">
            {market.question}
          </p>
        </div>

        <ProbBar yes={market.yesPrice} no={market.noPrice} />

        <div className="flex gap-2 mt-2.5">
          <button
            className="flex-1 rounded-lg py-2 px-2 text-center transition-all active:scale-[0.97] hover:opacity-90"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}
            onClick={onBetYes}
          >
            <div className="text-[11px] text-emerald-400 font-medium">{t("trade.yes")}</div>
            <div className="text-sm font-bold text-emerald-400">{yPct}%</div>
          </button>
          <button
            className="flex-1 rounded-lg py-2 px-2 text-center transition-all active:scale-[0.97] hover:opacity-90"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
            onClick={onBetNo}
          >
            <div className="text-[11px] text-red-400 font-medium">{t("trade.no")}</div>
            <div className="text-sm font-bold text-red-400">{nPct}%</div>
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <VolBadge volume={market.volume} />
            {end && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" /> {end}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Market Card: AI Prediction ───────────────────────────────────────────────

function AiCard({
  pred, hasBet, onBetBull, onBetBear,
}: {
  pred: AiPrediction;
  hasBet: boolean;
  onBetBull: () => void;
  onBetBear: () => void;
}) {
  const { t } = useTranslation();
  const isBullish = pred.prediction === "BULLISH";
  const isBearish = pred.prediction === "BEARISH";
  const confidence = Number(pred.confidence || 0);
  const current = Number(pred.currentPrice || 0);
  const target = Number(pred.targetPrice || 0);
  const pct = current > 0 ? ((target - current) / current * 100) : 0;
  const bullConf = isBullish ? confidence : (100 - confidence);
  const bearConf = isBearish ? confidence : (100 - confidence);
  const bullOdds = bullConf > 0 ? Math.max(1.1, 100 / bullConf).toFixed(2) : "2.00";
  const bearOdds = bearConf > 0 ? Math.max(1.1, 100 / bearConf).toFixed(2) : "2.00";

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: "linear-gradient(145deg, rgba(28,20,12,0.95), rgba(18,14,6,0.98))",
        border: `1px solid ${isBullish ? "rgba(34,197,94,0.45)" : isBearish ? "rgba(239,68,68,0.45)" : "rgba(234,179,8,0.45)"}`,
        boxShadow: "0 8px 24px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center ${
                isBullish ? "bg-emerald-500/15" : isBearish ? "bg-red-500/15" : "bg-yellow-500/15"
              }`}
            >
              {isBullish ? <TrendingUp className="h-4 w-4 text-emerald-400" /> :
               isBearish ? <TrendingDown className="h-4 w-4 text-red-400" /> :
               <Minus className="h-4 w-4 text-yellow-400" />}
            </div>
            <div>
              <div className="text-sm font-bold">{pred.asset}/USDT</div>
              <div className="text-[11px] text-muted-foreground">{pred.timeframe} · F&G: {pred.fearGreedIndex}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {hasBet && (
              <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30 no-default-hover-elevate no-default-active-elevate">
                <Trophy className="h-2.5 w-2.5 mr-0.5" /> {t("trade.inBadge")}
              </Badge>
            )}
            <Badge
              className={`text-[10px] no-default-hover-elevate no-default-active-elevate border ${
                isBullish ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
                isBearish ? "bg-red-500/15 text-red-400 border-red-500/25" :
                "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
              }`}
            >
              {pred.prediction} {confidence}%
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-2.5 rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">{t("trade.currentPrice")}</div>
            <div className="text-[12px] font-bold tabular-nums">${current > 0 ? current.toLocaleString() : "--"}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">{t("trade.targetLabel")}</div>
            <div className={`text-[12px] font-bold tabular-nums ${isBullish ? "text-emerald-400" : isBearish ? "text-red-400" : ""}`}>
              ${target > 0 ? target.toLocaleString() : "--"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">{t("trade.changeLabel")}</div>
            <div className={`text-[12px] font-bold tabular-nums ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
            </div>
          </div>
        </div>

        {pred.reasoning && (
          <div className="mb-2.5 rounded-lg p-2" style={{ background: "rgba(212,168,50,0.05)", border: "1px solid rgba(212,168,50,0.1)" }}>
            <div className="flex items-center gap-1 mb-0.5">
              <Sparkles className="h-2.5 w-2.5 text-primary" />
              <span className="text-[10px] text-muted-foreground font-medium">{t("trade.aiAnalysisLabel")}</span>
            </div>
            <p className="text-[11px] text-foreground/65 leading-snug line-clamp-2">{pred.reasoning}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="flex-1 rounded-lg py-1.5 px-2 text-center transition-all active:scale-[0.97]"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}
            onClick={onBetBull}
          >
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="text-[12px] font-bold text-emerald-400">{t("trade.bull")}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">{bullOdds}x</div>
          </button>
          <button
            className="flex-1 rounded-lg py-1.5 px-2 text-center transition-all active:scale-[0.97]"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
            onClick={onBetBear}
          >
            <div className="flex items-center justify-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-400" />
              <span className="text-[12px] font-bold text-red-400">{t("trade.bear")}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">{bearOdds}x</div>
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Market Card: News Prediction ─────────────────────────────────────────────

function NewsCard({
  news, hasBet, onBetBull, onBetBear,
}: {
  news: NewsPred;
  hasBet: boolean;
  onBetBull: () => void;
  onBetBear: () => void;
}) {
  const { t } = useTranslation();
  const isBullish = news.prediction === "BULLISH";
  const isBearish = news.prediction === "BEARISH";
  const bullOdds = isBullish
    ? Math.max(1.2, 100 / news.confidence).toFixed(2)
    : (100 / Math.max(1, 100 - news.confidence)).toFixed(2);
  const bearOdds = isBearish
    ? Math.max(1.2, 100 / news.confidence).toFixed(2)
    : (100 / Math.max(1, 100 - news.confidence)).toFixed(2);
  const impactClass = news.impact === "HIGH"
    ? "bg-red-500/15 text-red-400 border-red-500/25"
    : news.impact === "MEDIUM"
      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
      : "bg-muted/30 text-muted-foreground border-border";

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: "linear-gradient(145deg, rgba(28,20,12,0.95), rgba(18,14,6,0.98))",
        border: "1px solid rgba(212,168,50,0.38)",
        boxShadow: "0 8px 24px -10px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,168,50,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-[13px] font-semibold leading-snug text-foreground/90 flex-1 line-clamp-2">
            {news.headline}
          </p>
          <a href={news.url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 p-1 rounded text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <Badge className={`text-[10px] no-default-hover-elevate no-default-active-elevate border ${impactClass}`}>
            {news.impact}
          </Badge>
          <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
            {news.asset}
          </Badge>
          <span className="text-[11px] text-muted-foreground">{news.source} · {timeAgo(news.publishedAt)}</span>
          {hasBet && (
            <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30 no-default-hover-elevate no-default-active-elevate ml-auto">
              <Trophy className="h-2.5 w-2.5 mr-0.5" /> {t("trade.enteredBadge")}
            </Badge>
          )}
        </div>

        {news.reasoning && (
          <p className="text-[11px] text-foreground/55 leading-snug mb-2 line-clamp-2">{news.reasoning}</p>
        )}

        <div className="flex gap-2">
          <button
            className="flex-1 rounded-lg py-1.5 px-2 text-center transition-all active:scale-[0.97]"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}
            onClick={onBetBull}
          >
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="text-[12px] font-bold text-emerald-400">{t("trade.bullish")}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">{bullOdds}x</div>
          </button>
          <button
            className="flex-1 rounded-lg py-1.5 px-2 text-center transition-all active:scale-[0.97]"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
            onClick={onBetBear}
          >
            <div className="flex items-center justify-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-400" />
              <span className="text-[12px] font-bold text-red-400">{t("trade.bearish")}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">{bearOdds}x</div>
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Bet Dialog ───────────────────────────────────────────────────────────────

interface BetTarget {
  marketId: string;
  question: string;
  marketType: string;
  choices: { label: string; odds: number; color: string }[];
}

// Minimum / maximum stake guardrails for the prediction bet form. Kept
// conservative — purely client-side validation so a malformed amount can
// never reach the (future) submit path.
const MIN_STAKE = 1;
const MAX_STAKE = 1_000_000;

// Normalize free-text amount input: digits + a single decimal point, no
// leading-zero noise, capped to 2 decimal places. Mirrors the light
// sanitization already used elsewhere in the app.
function sanitizeAmount(raw: string): string {
  let v = raw.replace(/[^0-9.]/g, "");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    // strip any further dots after the first
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    const [intPart, decPart] = v.split(".");
    v = intPart + "." + (decPart ?? "").slice(0, 2);
  }
  return v;
}

function BetDialog({
  open, onOpenChange, target, walletAddr,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: BetTarget | null;
  walletAddr: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [choice, setChoice] = useState("");
  const [amount, setAmount] = useState("");

  const amountNum = Number(amount);
  const amountValid = !!amount && Number.isFinite(amountNum) && amountNum >= MIN_STAKE && amountNum <= MAX_STAKE;
  const canSubmit = !!target && !!choice && amountValid && !!walletAddr;

  const betMutation = useMutation({
    mutationFn: async () => {
      if (!target || !choice) throw new Error(t("trade.missingFieldsError"));
      if (!amountValid) throw new Error(t("trade.missingFieldsError"));
      const ch = target.choices.find(c => c.label === choice);
      await placePredictionBet(
        walletAddr, target.marketId, target.marketType,
        target.question, choice, ch?.odds ?? 0, amountNum,
      );
    },
    onSuccess: () => {
      toast({ title: t("trade.betPlacedSuccess"), description: t("trade.betPlacedSuccessDesc") });
      queryClient.invalidateQueries({ queryKey: ["prediction-bets"] });
      onOpenChange(false);
      setChoice(""); setAmount("");
    },
    onError: (e: any) => {
      toast({ title: t("common.error"), description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const selectedOdds = target?.choices.find(c => c.label === choice)?.odds ?? 0;
  const payout = selectedOdds > 0 && amountValid ? (amountNum / selectedOdds).toFixed(2) : "--";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(43,74%,58%), hsl(38,70%,46%))" }}>
              <Wallet className="h-4 w-4 text-black" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold">{t("trade.placePrediction")}</DialogTitle>
              <DialogDescription className="text-[12px]">{t("trade.enterPosition")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {target && (
          <div className="space-y-3">
            <p className="text-[13px] text-foreground/80 leading-snug line-clamp-2 rounded-md p-2"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {target.question}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {target.choices.map((c) => (
                <button
                  key={c.label}
                  onClick={() => setChoice(c.label)}
                  className={`rounded-lg py-2.5 px-3 text-center transition-all ${
                    choice === c.label ? "ring-2 ring-primary scale-[1.02]" : "opacity-70"
                  }`}
                  style={{
                    background: c.color === "emerald" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    border: `1px solid ${c.color === "emerald" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                  }}
                >
                  <div className={`text-sm font-bold ${c.color === "emerald" ? "text-emerald-400" : "text-red-400"}`}>
                    {c.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.odds > 0 ? `${(1 / c.odds).toFixed(2)}x` : "--"}
                  </div>
                </button>
              ))}
            </div>

            <div>
              <label className="text-[12px] text-muted-foreground mb-1 block">{t("trade.amountUsdc")}</label>
              <Input
                value={amount}
                onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
                inputMode="decimal"
                placeholder="0.00"
                className="bg-background/50 border-border text-sm"
              />
              {amount && !amountValid && (
                <p className="text-[11px] text-red-400 mt-1">
                  {t("trade.amountRange", { min: MIN_STAKE, max: formatCompact(MAX_STAKE) })}
                </p>
              )}
              <div className="flex gap-1.5 mt-1.5">
                {["10", "25", "50", "100"].map((v) => (
                  <button key={v} onClick={() => setAmount(v)}
                    className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            {choice && amountValid && (
              <div className="rounded-lg p-2.5 space-y-1"
                style={{ background: "rgba(212,168,50,0.06)", border: "1px solid rgba(212,168,50,0.12)" }}>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">{t("trade.potentialPayoutLabel")}</span>
                  <span className="font-bold text-primary">${payout}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">{t("trade.oddsLabel")}</span>
                  <span className="text-foreground">{selectedOdds > 0 ? `${(1 / selectedOdds).toFixed(2)}x` : "--"}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            size="sm"
            disabled={!canSubmit || betMutation.isPending}
            onClick={() => betMutation.mutate()}
            style={{ background: "linear-gradient(135deg, hsl(43,74%,58%), hsl(38,70%,46%))", color: "#0a0704" }}
          >
            {betMutation.isPending ? t("trade.placing") : t("trade.confirmBet")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ polyCount, aiCount, newsCount, betsCount }: {
  polyCount: number; aiCount: number; newsCount: number; betsCount: number;
}) {
  const { t } = useTranslation();
  const total = polyCount + aiCount + newsCount;
  return (
    <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground px-4 lg:px-0">
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse inline-block" />
        {t("trade.marketsLive", { count: total })}
      </span>
      <span>·</span>
      <span>{t("trade.positionsOpen", { count: betsCount })}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CATEGORIES: { id: Category; labelKey: string; icon: React.ElementType }[] = [
  { id: "all", labelKey: "trade.catAll", icon: Star },
  { id: "crypto", labelKey: "trade.catCrypto", icon: Globe },
  { id: "ai", labelKey: "trade.catAiSignals", icon: Brain },
  { id: "news", labelKey: "trade.catNews", icon: Newspaper },
  { id: "mybets", labelKey: "trade.catMyBets", icon: Trophy },
];

const SORTS: { key: SortKey; labelKey: string }[] = [
  { key: "volume", labelKey: "trade.sortVolume" },
  { key: "ending", labelKey: "trade.sortEndingSoon" },
  { key: "newest", labelKey: "trade.sortNewest" },
];

export default function Trade() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const walletAddr = account?.address || "";

  const [category, setCategory] = useState<Category>("all");
  const [sort, setSort] = useState<SortKey>("volume");
  const [search, setSearch] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [betTarget, setBetTarget] = useState<BetTarget | null>(null);
  const [betOpen, setBetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);

  // Polymarket is the only genuinely-live source (proxied 3rd-party API), so it
  // gets a gentle background refresh. `fetchPolymarkets` already swallows its
  // own errors and returns [] on failure, so we keep the previous page of data
  // visible across refreshes instead of flashing empty.
  const {
    data: polymarkets = [], isLoading: polyLoading, isFetching: polyFetching, refetch: refetchPoly,
  } = useQuery<PolymarketMarket[]>({
    queryKey: ["polymarket-markets"],
    queryFn: fetchPolymarkets,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: 1,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  // AI / news predictions are effectively static per session (and the legacy
  // /api/* routes 404 in production, falling back to seed data). Fetch once on
  // mount with a single retry — no polling, to avoid hammering a dead route.
  const { data: aiPredictions = [], isLoading: aiLoading } = useQuery<AiPrediction[]>({
    queryKey: ["ai-predictions"],
    queryFn: getAiPredictions,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
    retryDelay: 1500,
  });

  const { data: newsPredictions = [], isLoading: newsLoading } = useQuery<NewsPred[]>({
    queryKey: ["news-predictions"],
    queryFn: getNewsPredictions,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
    retryDelay: 1500,
  });

  const { data: myBets = [] } = useQuery<PredictionBet[]>({
    queryKey: ["prediction-bets", walletAddr],
    queryFn: () => getPredictionBets(walletAddr),
    enabled: !!walletAddr,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const betIds = useMemo(() => new Set(myBets.map((b: PredictionBet) => b.marketId)), [myBets]);

  const { toast } = useToast();

  const openBet = (_target: BetTarget) => {
    toast({ title: t("common.comingSoon") });
  };

  // First-paint skeleton: only while every source is still on its initial
  // fetch (no data yet). Once any source settles we render — seed data
  // backfills the rest, so the list never flashes empty. (Previously this used
  // `&&` on three booleans which already hid the skeleton as soon as the
  // fastest query resolved; we keep that intent but make it explicit.)
  const isLoading = polyLoading && aiLoading && newsLoading;

  // Use seed data as fallback when APIs return empty
  const polyData = polymarkets.length > 0 ? polymarkets : SEED_POLYMARKETS;
  const aiData = aiPredictions.length > 0 ? aiPredictions : SEED_AI_PREDICTIONS;
  const newsData = (newsPredictions as NewsPred[]).length > 0 ? (newsPredictions as NewsPred[]) : SEED_NEWS;

  // Build unified filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    const polyItems = polyData
      .filter(() => category === "all" || category === "crypto")
      .filter(m => !q || m.question.toLowerCase().includes(q))
      .map(m => ({ source: "polymarket" as const, id: m.id, data: m }));

    const aiItems = aiData
      .filter(() => category === "all" || category === "ai")
      .filter(p => !q || p.asset?.toLowerCase().includes(q))
      .map(p => ({ source: "ai" as const, id: `ai-${p.asset}`, data: p }));

    const newsItems = newsData
      .filter(() => category === "all" || category === "news")
      .filter(n => !q || n.headline?.toLowerCase().includes(q) || n.asset?.toLowerCase().includes(q))
      .map(n => ({ source: "news" as const, id: n.id, data: n }));

    const myBetItems = category === "mybets" ? [
      ...polyItems.filter(i => betIds.has(i.id)),
      ...aiItems.filter(i => betIds.has(i.id)),
      ...newsItems.filter(i => betIds.has(i.id)),
    ] : [...polyItems, ...aiItems, ...newsItems];

    if (sort === "volume") {
      return myBetItems.sort((a, b) => {
        const va = a.source === "polymarket" ? (a.data as PolymarketMarket).volume : 0;
        const vb = b.source === "polymarket" ? (b.data as PolymarketMarket).volume : 0;
        return vb - va;
      });
    }
    if (sort === "ending") {
      return myBetItems.sort((a, b) => {
        const ea = a.source === "polymarket" ? new Date((a.data as PolymarketMarket).endDate || "9999").getTime() : 9999999999999;
        const eb = b.source === "polymarket" ? new Date((b.data as PolymarketMarket).endDate || "9999").getTime() : 9999999999999;
        return ea - eb;
      });
    }
    return myBetItems;
  }, [polyData, aiData, newsData, category, search, sort, betIds]);

  const currentSortLabelKey = SORTS.find(s => s.key === sort)?.labelKey ?? "trade.sortVolume";

  return (
    <div className="pb-24 lg:pb-8">
      {/* ── Header ─────────────────────────────────── */}
      <div className="sticky top-0 z-30 px-4 lg:px-6 pt-3 pb-2"
        style={{ background: "hsla(20,15%,4%,0.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(212,168,50,0.08)" }}>

        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground">{t("trade.predictionMarkets")}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Manual refresh — re-pulls the live Polymarket feed. Spins while
                a fetch is in flight; disabled to prevent rapid re-clicks. */}
            <button
              onClick={() => { if (!polyFetching) refetchPoly(); }}
              disabled={polyFetching}
              aria-label={t("common.retry")}
              className="flex items-center justify-center h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${polyFetching ? "animate-spin" : ""}`} />
            </button>
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen(v => !v)}
                aria-label={t("trade.sortBy", "Sort markets")}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                className="flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <span>{t(currentSortLabelKey)}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 rounded-md shadow-xl z-50 overflow-hidden"
                  style={{ background: "hsl(22,20%,8%)", border: "1px solid rgba(212,168,50,0.15)", minWidth: 130 }}>
                  {SORTS.map(s => (
                    <button
                      key={s.key}
                      onClick={() => { setSort(s.key); setSortOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${
                        sort === s.key ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                      }`}
                    >
                      {t(s.labelKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2.5">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("trade.searchMarkets")}
            className="pl-8 h-8 text-[13px] bg-background/50 border-border"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.id); setVisibleCount(8); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium whitespace-nowrap transition-all shrink-0 ${
                  isActive ? "text-black" : "text-muted-foreground hover:text-foreground"
                }`}
                style={isActive ? {
                  background: "linear-gradient(135deg, hsl(43,74%,58%), hsl(38,70%,46%))",
                  boxShadow: "0 0 10px rgba(212,168,50,0.25)",
                } : {
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Icon className="h-3 w-3" />
                {t(cat.labelKey)}
                {cat.id === "mybets" && myBets.length > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${isActive ? "bg-black/20" : "bg-primary/20 text-primary"}`}>
                    {myBets.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────── */}
      <div className="mt-2 mb-1">
        <StatsBar
          polyCount={polyData.length}
          aiCount={aiData.length}
          newsCount={newsData.length}
          betsCount={myBets.length}
        />
      </div>

      {/* ── No wallet warning ───────────────────────── */}
      {!walletAddr && (
        <div className="mx-4 lg:mx-6 mt-3 rounded-lg p-3 flex items-center gap-2"
          style={{ background: "rgba(212,168,50,0.06)", border: "1px solid rgba(212,168,50,0.15)" }}>
          <AlertCircle className="h-4 w-4 text-primary shrink-0" />
          <span className="text-[12px] text-foreground/70">{t("trade.connectWalletBet")}</span>
        </div>
      )}

      {/* ── Smart Copy-Trading hero card ────────────── */}
      <div className="px-4 lg:px-6 mt-3">
        <div className="relative rounded-2xl overflow-hidden border border-[#f59e0b]/25 bg-gradient-to-br from-[#1a1408] via-[#161100] to-[#0c0a07]"
          style={{ boxShadow: "0 0 40px rgba(245,158,11,0.08), inset 0 1px 0 rgba(245,158,11,0.15)" }}>

          {/* Background glow blobs */}
          <div className="absolute -top-8 -right-8 w-36 h-36 bg-[#f59e0b]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 -left-4 w-24 h-24 bg-amber-600/10 rounded-full blur-2xl pointer-events-none" />
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#f59e0b]/60 to-transparent" />

          <div className="relative z-10 p-5">
            {/* Badge row */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 bg-[#f59e0b]/12 border border-[#f59e0b]/25 rounded-full px-2.5 py-1">
                <Zap size={11} className="text-[#f59e0b]" />
                <span className="text-[10px] font-semibold text-[#f59e0b] uppercase tracking-wider">
                  Smart Copy-Trading
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#10b981] font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                已激活
              </div>
            </div>

            {/* Headline */}
            <h2 className="text-[22px] font-bold text-white leading-tight tracking-tight mb-1">
              让 AI 帮你<br />
              <span className="bg-gradient-to-r from-[#f59e0b] via-amber-300 to-[#f59e0b] bg-clip-text text-transparent">
                自动跟单预测市场
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              One-Agents 引擎实时复制顶级交易员策略，自动执行 YES / NO 仓位
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-black/20 rounded-xl p-2.5 border border-white/5">
                <div className="flex items-center gap-1 mb-1">
                  <Users size={10} className="text-zinc-500" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wide">跟随者</span>
                </div>
                <p className="text-sm font-bold text-white">2,847</p>
              </div>
              <div className="bg-black/20 rounded-xl p-2.5 border border-white/5">
                <div className="flex items-center gap-1 mb-1">
                  <BarChart2 size={10} className="text-zinc-500" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wide">胜率</span>
                </div>
                <p className="text-sm font-bold text-[#10b981]">68.4%</p>
              </div>
              <div className="bg-black/20 rounded-xl p-2.5 border border-white/5">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp size={10} className="text-zinc-500" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wide">月收益</span>
                </div>
                <p className="text-sm font-bold text-[#f59e0b]">+24.1%</p>
              </div>
            </div>

            {/* CTA button */}
            <Link href="/copy-trading">
              <button className="w-full relative overflow-hidden rounded-xl bg-[#f59e0b] text-black font-bold text-sm py-3 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                style={{ boxShadow: "0 4px 20px rgba(245,158,11,0.35)" }}>
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <Zap size={15} strokeWidth={2.5} className="relative z-10" />
                <span className="relative z-10">进入智能跟单</span>
                <ChevronRight size={15} strokeWidth={2.5} className="relative z-10 ml-0.5" />
              </button>
            </Link>

            {/* Trust line */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <ShieldCheck size={11} className="text-zinc-500" />
              <span className="text-[10px] text-zinc-500">资金托管在 Polymarket · Polygon 网络</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Market list ─────────────────────────────── */}
      <div className="px-4 lg:px-6 mt-3 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3" onClick={() => sortOpen && setSortOpen(false)}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("trade.noMarketsFound")}</p>
            {search && (
              <button onClick={() => setSearch("")}
                className="mt-2 text-[12px] text-primary underline underline-offset-2">
                {t("trade.clearSearch")}
              </button>
            )}
          </div>
        ) : (
          <>
          {filtered.slice(0, visibleCount).map(item => {
            if (item.source === "polymarket") {
              const m = item.data as PolymarketMarket;
              return (
                <PolyCard
                  key={item.id}
                  market={m}
                  hasBet={betIds.has(m.id)}
                  onBetYes={() => openBet({
                    marketId: m.id, question: m.question, marketType: "polymarket",
                    choices: [
                      { label: "Yes", odds: m.yesPrice, color: "emerald" },
                      { label: "No", odds: m.noPrice, color: "red" },
                    ],
                  })}
                  onBetNo={() => openBet({
                    marketId: m.id, question: m.question, marketType: "polymarket",
                    choices: [
                      { label: "Yes", odds: m.yesPrice, color: "emerald" },
                      { label: "No", odds: m.noPrice, color: "red" },
                    ],
                  })}
                />
              );
            }
            if (item.source === "ai") {
              const p = item.data as AiPrediction;
              const isBullish = p.prediction === "BULLISH";
              const isBearish = p.prediction === "BEARISH";
              const confidence = Number(p.confidence || 0);
              const bullConf = isBullish ? confidence : (100 - confidence);
              const bearConf = isBearish ? confidence : (100 - confidence);
              return (
                <AiCard
                  key={item.id}
                  pred={p}
                  hasBet={betIds.has(item.id)}
                  onBetBull={() => openBet({
                    marketId: item.id,
                    question: `${p.asset} will go UP within ${p.timeframe}`,
                    marketType: "ai",
                    choices: [
                      { label: "Bullish", odds: bullConf / 100, color: "emerald" },
                      { label: "Bearish", odds: bearConf / 100, color: "red" },
                    ],
                  })}
                  onBetBear={() => openBet({
                    marketId: item.id,
                    question: `${p.asset} will go DOWN within ${p.timeframe}`,
                    marketType: "ai",
                    choices: [
                      { label: "Bullish", odds: bullConf / 100, color: "emerald" },
                      { label: "Bearish", odds: bearConf / 100, color: "red" },
                    ],
                  })}
                />
              );
            }
            if (item.source === "news") {
              const n = item.data as NewsPred;
              const isBullish = n.prediction === "BULLISH";
              const isBearish = n.prediction === "BEARISH";
              const bullOdds = isBullish
                ? Math.max(1.2, 100 / n.confidence) / 100
                : Math.max(0.01, (100 - n.confidence)) / 100;
              const bearOdds = isBearish
                ? Math.max(1.2, 100 / n.confidence) / 100
                : Math.max(0.01, (100 - n.confidence)) / 100;
              return (
                <NewsCard
                  key={item.id}
                  news={n}
                  hasBet={betIds.has(n.id)}
                  onBetBull={() => openBet({
                    marketId: n.id,
                    question: `${n.asset}: ${n.headline}`,
                    marketType: "news",
                    choices: [
                      { label: "Bullish", odds: bullOdds, color: "emerald" },
                      { label: "Bearish", odds: bearOdds, color: "red" },
                    ],
                  })}
                  onBetBear={() => openBet({
                    marketId: n.id,
                    question: `${n.asset}: ${n.headline}`,
                    marketType: "news",
                    choices: [
                      { label: "Bullish", odds: bullOdds, color: "emerald" },
                      { label: "Bearish", odds: bearOdds, color: "red" },
                    ],
                  })}
                />
              );
            }
            return null;
          })}
          {visibleCount < filtered.length && (
            <button
              onClick={() => setVisibleCount(c => c + 8)}
              className="w-full py-3 rounded-xl text-[13px] font-bold text-primary transition-all active:scale-[0.98] lg:col-span-2 xl:col-span-3"
              style={{ background: "rgba(212,168,50,0.06)", border: "1px solid rgba(212,168,50,0.15)" }}
            >
              {t("trade.loadMore", { remaining: filtered.length - visibleCount })}
            </button>
          )}
          {visibleCount >= filtered.length && filtered.length > 0 && (
            <div className="text-center py-3 text-[11px] text-muted-foreground/40 lg:col-span-2 xl:col-span-3">
              {t("trade.allMarketsShown", { count: filtered.length })}
            </div>
          )}
          </>
        )}
      </div>

      <BetDialog
        open={betOpen}
        onOpenChange={setBetOpen}
        target={betTarget}
        walletAddr={walletAddr}
      />
    </div>
  );
}
