import React, { useState } from "react";
import { Search, Flame, ArrowUpRight, TrendingUp, Clock } from "lucide-react";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";

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
    category: "Crypto"
  },
  {
    id: "2",
    question: "Will Fed cut rates before July?",
    yesProb: 61,
    volume: "$8.2M",
    endDate: "Jun 30",
    isHot: true,
    category: "News"
  },
  {
    id: "3",
    question: "Will AI tokens hit $500B market cap?",
    yesProb: 38,
    volume: "$4.1M",
    endDate: "Dec 31",
    isHot: false,
    category: "AI"
  },
  {
    id: "4",
    question: "Ethereum ETF approved by May?",
    yesProb: 88,
    volume: "$22.1M",
    endDate: "May 31",
    isHot: true,
    category: "Crypto"
  },
  {
    id: "5",
    question: "Will Solana flip Ethereum in market cap?",
    yesProb: 12,
    volume: "$1.8M",
    endDate: "Dec 31",
    isHot: false,
    category: "Crypto"
  },
  {
    id: "6",
    question: "US Election winner to be pro-crypto?",
    yesProb: 74,
    volume: "$15.6M",
    endDate: "Nov 5",
    isHot: true,
    category: "News"
  }
];

const CATEGORIES = ["All", "Crypto", "AI", "News", "My Bets"];

export function TradeMarkets() {
  const [activeCategory, setActiveCategory] = useState("All");

  return (
    <div className="min-h-screen bg-[#0c0a07] text-white overflow-y-auto w-full max-w-[390px] mx-auto relative shadow-2xl overflow-x-hidden font-sans">
      
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0c0a07]/90 backdrop-blur-md border-b border-[#f59e0b]/20 pb-3 pt-4 px-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Prediction Markets</h1>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input 
            placeholder="Search markets..." 
            className="w-full bg-[#161411] border-[#f59e0b]/20 focus-visible:ring-[#f59e0b]/50 pl-9 text-sm text-zinc-200 placeholder:text-zinc-500 h-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all snap-start ${
                activeCategory === cat 
                  ? "bg-[#f59e0b] text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]" 
                  : "bg-[#161411] text-zinc-400 border border-white/5 hover:bg-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Live Stats */}
      <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-[#161411] to-transparent border-b border-white/5">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span>24 Markets · 8 AI · 12 News</span>
        </div>
        <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
      </div>

      {/* Grid */}
      <div className="p-4 grid grid-cols-2 gap-3 pb-24">
        {MARKETS.map(market => (
          <div 
            key={market.id} 
            className="bg-gradient-to-b from-[#161411] to-[#0c0a07] border border-[#f59e0b]/10 rounded-xl p-3 relative overflow-hidden flex flex-col justify-between"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
          >
            {/* Glow effect for hot items */}
            {market.isHot && (
              <div className="absolute -top-10 -right-10 w-20 h-20 bg-[#f59e0b]/20 blur-2xl rounded-full" />
            )}

            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{market.category}</span>
                {market.isHot && <Flame className="w-3.5 h-3.5 text-[#f59e0b]" />}
              </div>
              <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-zinc-100">
                {market.question}
              </h3>
            </div>

            <div className="space-y-3 mt-auto">
              {/* Probability Bar */}
              <div className="h-1.5 w-full bg-red-500/20 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" 
                  style={{ width: `${market.yesProb}%` }} 
                />
                <div 
                  className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" 
                  style={{ width: `${100 - market.yesProb}%` }} 
                />
              </div>

              {/* Price Chips */}
              <div className="flex gap-2">
                <button className="flex-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-md py-1.5 flex flex-col items-center justify-center transition-colors">
                  <span className="text-[10px] text-green-500/70 font-medium">YES</span>
                  <span className="text-xs font-bold text-green-400">{market.yesProb}¢</span>
                </button>
                <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md py-1.5 flex flex-col items-center justify-center transition-colors">
                  <span className="text-[10px] text-red-500/70 font-medium">NO</span>
                  <span className="text-xs font-bold text-red-400">{100 - market.yesProb}¢</span>
                </button>
              </div>

              {/* Footer details */}
              <div className="flex justify-between items-center text-[10px] text-zinc-500">
                <span className="font-mono">{market.volume} Vol</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{market.endDate}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 max-w-[390px] mx-auto bg-gradient-to-t from-[#0c0a07] via-[#0c0a07]/90 to-transparent pt-12 pb-6 z-30 pointer-events-none">
        <div className="pointer-events-auto rounded-xl p-[1px] bg-gradient-to-r from-[#f59e0b] via-amber-300 to-[#f59e0b] shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <button className="w-full bg-[#161411] hover:bg-[#1a1814] transition-colors rounded-[11px] p-3 flex items-center justify-between group">
            <div className="flex flex-col items-start text-left">
              <span className="text-sm font-bold bg-gradient-to-r from-amber-200 to-[#f59e0b] bg-clip-text text-transparent flex items-center gap-1.5">
                Smart Copy-Trading
                <Flame className="w-3.5 h-3.5 text-[#f59e0b]" />
              </span>
              <span className="text-[11px] text-zinc-400">Copy top prediction traders automatically</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#f59e0b]/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#f59e0b]/20 transition-all">
              <ArrowUpRight className="w-4 h-4 text-[#f59e0b]" />
            </div>
          </button>
        </div>
      </div>
      
    </div>
  );
}
