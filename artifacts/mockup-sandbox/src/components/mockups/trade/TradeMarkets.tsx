import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Flame,
  TrendingUp,
  Clock,
  Zap,
  Users,
  ShieldCheck,
  ChevronRight,
  BarChart2,
} from "lucide-react";
import { Input } from "../../ui/input";
import "../rune-glass/_group.css";

// --- Helper Components ---

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }: { value: number, prefix?: string, suffix?: string, decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1500;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

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
    <div className="min-h-screen bg-[#0c0a07] text-white font-sans overflow-x-hidden selection:bg-amber-500/30 relative">
      
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[50%] rounded-full opacity-60 blur-[100px]"
          style={{ background: 'var(--orb-1)' }}
          animate={{
            x: [0, 50, -20, 0],
            y: [0, -30, 40, 0],
            scale: [1, 1.1, 0.9, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute top-[20%] -right-[20%] w-[70%] h-[60%] rounded-full opacity-50 blur-[120px]"
          style={{ background: 'var(--orb-2)' }}
          animate={{
            x: [0, -40, 30, 0],
            y: [0, 50, -20, 0],
            scale: [1, 1.2, 0.8, 1]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute -bottom-[10%] left-[10%] w-[50%] h-[40%] rounded-full opacity-60 blur-[90px]"
          style={{ background: 'var(--orb-3)' }}
          animate={{
            x: [0, 30, -40, 0],
            y: [0, -20, 50, 0],
            scale: [1, 0.9, 1.1, 1]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="max-w-[390px] mx-auto min-h-screen relative z-10 shadow-2xl border-x border-white/5 backdrop-blur-[2px] pb-10">
        
        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-20 bg-[#0c0a07]/80 backdrop-blur-xl border-b border-white/10 pb-3 pt-6 px-5 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">
              Prediction Markets
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-white/60 font-mono bg-white/5 px-2 py-1 rounded-full border border-white/10">
              <div className="relative w-1.5 h-1.5">
                <div className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
                <div className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50"></div>
              </div>
              <span>24 Live</span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Search markets..."
              className="w-full bg-black/40 border-white/10 focus-visible:ring-[#f59e0b]/50 pl-9 text-sm text-white/90 placeholder:text-white/40 h-10 rounded-xl backdrop-blur-sm"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-[#f59e0b] text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <main className="px-5 pt-5 space-y-6">
          {/* ── SMART COPY-TRADING HERO CARD ── */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, type: "spring" }}
            className="glass-panel-strong p-5 relative overflow-hidden"
          >
            <div className="shimmer-sweep"></div>
            
            {/* Background glow blobs */}
            <div className="absolute -top-8 -right-8 w-36 h-36 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 -left-4 w-24 h-24 bg-amber-600/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              {/* Badge */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/30 rounded-full px-2.5 py-1">
                  <Zap size={11} className="text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                    Smart Copy-Trading
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  <div className="relative w-1.5 h-1.5">
                    <div className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
                    <div className="absolute inset-0 bg-emerald-400 rounded-full"></div>
                  </div>
                  已激活
                </div>
              </div>

              {/* Headline */}
              <h2 className="text-[22px] font-bold text-white leading-tight tracking-tight mb-2 drop-shadow-sm">
                让 AI 帮你<br />
                <span className="text-amber-400">
                  自动跟单预测市场
                </span>
              </h2>
              <p className="text-xs text-white/60 mb-5 leading-relaxed">
                One-Agents 引擎实时复制顶级交易员策略，自动执行 YES / NO 仓位
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Users size={10} className="text-white/40" />
                    <span className="text-[9px] text-white/50 uppercase tracking-wide">跟随者</span>
                  </div>
                  <p className="text-sm font-bold text-white"><AnimatedNumber value={2847} /></p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <BarChart2 size={10} className="text-white/40" />
                    <span className="text-[9px] text-white/50 uppercase tracking-wide">胜率</span>
                  </div>
                  <p className="text-sm font-bold text-emerald-400"><AnimatedNumber value={68.4} decimals={1} suffix="%" /></p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp size={10} className="text-white/40" />
                    <span className="text-[9px] text-white/50 uppercase tracking-wide">月收益</span>
                  </div>
                  <p className="text-sm font-bold text-amber-400">+<AnimatedNumber value={24.1} decimals={1} suffix="%" /></p>
                </div>
              </div>

              {/* CTA button */}
              <button className="w-full py-3.5 rounded-xl gold-button font-bold text-sm flex items-center justify-center gap-2">
                <Zap size={16} className="fill-black/20" />
                <span>进入智能跟单</span>
                <ChevronRight size={16} />
              </button>

              {/* Trust line */}
              <div className="flex items-center justify-center gap-1.5 mt-4">
                <ShieldCheck size={12} className="text-white/40" />
                <span className="text-[10px] text-white/50">资金托管在 Polymarket · Polygon 网络</span>
              </div>
            </div>
          </motion.div>

          {/* ── HOT MARKETS SECTION ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Flame size={14} className="text-amber-400" />
                </div>
                <span className="text-sm font-bold text-white tracking-wide">热门市场</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-white/50 font-mono bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                <TrendingUp size={12} />
                <span>8 AI · 12 News</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence>
                {filtered.map((market, i) => (
                  <motion.div
                    key={market.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="glass-panel p-3.5 relative overflow-hidden flex flex-col min-h-[160px]"
                  >
                    {market.isHot && (
                      <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/20 blur-2xl rounded-full" />
                    )}

                    <div className="space-y-2 mb-3 relative z-10 flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider bg-black/30 px-1.5 py-0.5 rounded">
                          {market.category}
                        </span>
                        {market.isHot && <Flame size={12} className="text-amber-400" />}
                      </div>
                      <h3 className="text-[13px] font-medium leading-snug line-clamp-3 text-white/90 drop-shadow-sm">
                        {market.question}
                      </h3>
                    </div>

                    <div className="space-y-3 relative z-10 mt-auto">
                      {/* Probability bar */}
                      <div className="h-1.5 w-full bg-red-500/20 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                          style={{ width: `${market.yesProb}%` }}
                        />
                        <div
                          className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                          style={{ width: `${100 - market.yesProb}%` }}
                        />
                      </div>

                      {/* YES / NO chips */}
                      <div className="flex gap-1.5">
                        <button className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-1.5 flex flex-col items-center justify-center hover:bg-emerald-500/20 transition-colors">
                          <span className="text-[9px] text-emerald-400/70 font-medium leading-none mb-1">YES</span>
                          <span className="text-xs font-bold text-emerald-400">{market.yesProb}¢</span>
                        </button>
                        <button className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg py-1.5 flex flex-col items-center justify-center hover:bg-red-500/20 transition-colors">
                          <span className="text-[9px] text-red-400/70 font-medium leading-none mb-1">NO</span>
                          <span className="text-xs font-bold text-red-400">{100 - market.yesProb}¢</span>
                        </button>
                      </div>

                      {/* Footer */}
                      <div className="flex justify-between items-center text-[9px] text-white/40 pt-1 border-t border-white/5">
                        <span className="font-mono">{market.volume}</span>
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          <span>{market.endDate}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
