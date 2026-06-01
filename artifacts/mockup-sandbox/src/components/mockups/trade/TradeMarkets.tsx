import React, { useState } from "react";
import {
  Search,
  Flame,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Zap,
  Users,
  ShieldCheck,
  ChevronRight,
  BarChart2,
} from "lucide-react";
import { Input } from "../../ui/input";

interface Market {
  id: string;
  question: string;
  yesProb: number;
  volume: string;
  endDate: string;
  isHot: boolean;
  category: string;
}

const MARKETS: Market[] = [
  {
    id: "1",
    question: "Will Bitcoin exceed $150K by 2026?",
    yesProb: 42,
    volume: "$12.4M",
    endDate: "Dec 31",
    isHot: true,
    category: "Crypto",
  },
  {
    id: "2",
    question: "Will Fed cut rates before July?",
    yesProb: 61,
    volume: "$8.2M",
    endDate: "Jun 30",
    isHot: true,
    category: "News",
  },
  {
    id: "3",
    question: "Will AI tokens hit $500B market cap?",
    yesProb: 38,
    volume: "$4.1M",
    endDate: "Dec 31",
    isHot: false,
    category: "AI",
  },
  {
    id: "4",
    question: "Ethereum ETF approved by May?",
    yesProb: 88,
    volume: "$22.1M",
    endDate: "May 31",
    isHot: true,
    category: "Crypto",
  },
  {
    id: "5",
    question: "Will Solana flip Ethereum in market cap?",
    yesProb: 12,
    volume: "$1.8M",
    endDate: "Dec 31",
    isHot: false,
    category: "Crypto",
  },
  {
    id: "6",
    question: "US Election winner to be pro-crypto?",
    yesProb: 74,
    volume: "$15.6M",
    endDate: "Nov 5",
    isHot: true,
    category: "News",
  },
];

const CATEGORIES = ["All", "Crypto", "AI", "News", "My Bets"];

export function TradeMarkets() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered =
    activeCategory === "All"
      ? MARKETS
      : MARKETS.filter((m) => m.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#0c0a07] text-white overflow-y-auto w-full max-w-[390px] mx-auto relative shadow-2xl overflow-x-hidden font-sans pb-8">

      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-20 bg-[#0c0a07]/95 backdrop-blur-md border-b border-[#f59e0b]/15 pb-3 pt-4 px-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Prediction Markets
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>24 Live</span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search markets..."
            className="w-full bg-[#161411] border-[#f59e0b]/20 focus-visible:ring-[#f59e0b]/50 pl-9 text-sm text-zinc-200 placeholder:text-zinc-500 h-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeCategory === cat
                  ? "bg-[#f59e0b] text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                  : "bg-[#161411] text-zinc-400 border border-white/5 hover:bg-white/8"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── SMART COPY-TRADING HERO CARD ── */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative rounded-2xl overflow-hidden border border-[#f59e0b]/25 bg-gradient-to-br from-[#1a1408] via-[#161100] to-[#0c0a07]"
          style={{ boxShadow: "0 0 40px rgba(245,158,11,0.08), inset 0 1px 0 rgba(245,158,11,0.15)" }}>

          {/* Background glow blobs */}
          <div className="absolute -top-8 -right-8 w-36 h-36 bg-[#f59e0b]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 -left-4 w-24 h-24 bg-amber-600/10 rounded-full blur-2xl pointer-events-none" />
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#f59e0b]/60 to-transparent" />

          <div className="relative z-10 p-5">
            {/* Badge */}
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
            <button className="w-full relative overflow-hidden rounded-xl bg-[#f59e0b] text-black font-bold text-sm py-3 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ boxShadow: "0 4px 20px rgba(245,158,11,0.35)" }}>
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
              <Zap size={15} strokeWidth={2.5} className="relative z-10" />
              <span className="relative z-10">进入智能跟单</span>
              <ChevronRight size={15} strokeWidth={2.5} className="relative z-10 ml-0.5" />
            </button>

            {/* Trust line */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <ShieldCheck size={11} className="text-zinc-500" />
              <span className="text-[10px] text-zinc-500">资金托管在 Polymarket · Polygon 网络</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── HOT MARKETS SECTION ── */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#f59e0b]" />
            <span className="text-sm font-semibold text-white">热门市场</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
            <TrendingUp className="w-3 h-3" />
            <span>8 AI · 12 News</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((market) => (
            <div
              key={market.id}
              className="bg-gradient-to-b from-[#161411] to-[#0c0a07] border border-[#f59e0b]/10 rounded-xl p-3 relative overflow-hidden flex flex-col justify-between min-h-[160px]"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              {market.isHot && (
                <div className="absolute -top-8 -right-8 w-20 h-20 bg-[#f59e0b]/15 blur-2xl rounded-full" />
              )}

              <div className="space-y-1.5 mb-3 relative z-10">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">
                    {market.category}
                  </span>
                  {market.isHot && <Flame className="w-3 h-3 text-[#f59e0b]" />}
                </div>
                <h3 className="text-[13px] font-semibold leading-snug line-clamp-2 text-zinc-100">
                  {market.question}
                </h3>
              </div>

              <div className="space-y-2.5 mt-auto relative z-10">
                {/* Probability bar */}
                <div className="h-1 w-full bg-red-500/15 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                    style={{ width: `${market.yesProb}%` }}
                  />
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${100 - market.yesProb}%` }}
                  />
                </div>

                {/* YES / NO chips */}
                <div className="flex gap-1.5">
                  <button className="flex-1 bg-green-500/10 border border-green-500/20 rounded-md py-1.5 flex flex-col items-center justify-center">
                    <span className="text-[9px] text-green-500/60 font-medium leading-none mb-0.5">YES</span>
                    <span className="text-xs font-bold text-green-400">{market.yesProb}¢</span>
                  </button>
                  <button className="flex-1 bg-red-500/10 border border-red-500/20 rounded-md py-1.5 flex flex-col items-center justify-center">
                    <span className="text-[9px] text-red-500/60 font-medium leading-none mb-0.5">NO</span>
                    <span className="text-xs font-bold text-red-400">{100 - market.yesProb}¢</span>
                  </button>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center text-[9px] text-zinc-600">
                  <span className="font-mono">{market.volume}</span>
                  <div className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{market.endDate}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
