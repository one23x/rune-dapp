import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Filter, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
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

export function CopyTradingHistory() {
  const [dateFilter, setDateFilter] = useState("All Time");
  const [sideFilter, setSideFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const orders = [
    {
      id: 1,
      question: "Will Bitcoin exceed $100K in Q1?",
      side: "BUY",
      entryPrice: "$0.42",
      exitPrice: "$0.91",
      size: "1000",
      notional: "$910",
      settledDate: "May 28",
      result: "WON",
      pnl: "+$490",
    },
    {
      id: 2,
      question: "US Election pro-crypto winner?",
      side: "BUY",
      entryPrice: "$0.61",
      exitPrice: "$0.74",
      size: "2000",
      notional: "$1,480",
      settledDate: "May 26",
      result: "WON",
      pnl: "+$260",
    },
    {
      id: 3,
      question: "Fed rate cut before April?",
      side: "SELL",
      entryPrice: "$0.55",
      exitPrice: "$0.78",
      size: "1500",
      notional: "$1,170",
      settledDate: "May 25",
      result: "LOST",
      pnl: "-$345",
    },
    {
      id: 4,
      question: "Ethereum ETF AUM > $5B?",
      side: "BUY",
      entryPrice: "$0.38",
      exitPrice: "$0.88",
      size: "2500",
      notional: "$2,200",
      settledDate: "May 21",
      result: "WON",
      pnl: "+$1,250",
    },
    {
      id: 5,
      question: "AI tokens $300B market cap?",
      side: "SELL",
      entryPrice: "$0.72",
      exitPrice: "$0.25",
      size: "1000",
      notional: "$250",
      settledDate: "May 18",
      result: "WON",
      pnl: "+$470",
    },
    {
      id: 6,
      question: "Solana DEX volume record?",
      side: "BUY",
      entryPrice: "$0.21",
      exitPrice: "$0.09",
      size: "3000",
      notional: "$270",
      settledDate: "May 15",
      result: "LOST",
      pnl: "-$360",
    },
    {
      id: 7,
      question: "DOGE revival above $0.50?",
      side: "SELL",
      entryPrice: "$0.68",
      exitPrice: "$0.81",
      size: "800",
      notional: "$648",
      settledDate: "May 12",
      result: "LOST",
      pnl: "-$104",
    },
    {
      id: 8,
      question: "BTC dominance > 55%?",
      side: "BUY",
      entryPrice: "$0.55",
      exitPrice: "$0.89",
      size: "1200",
      notional: "$1,068",
      settledDate: "May 10",
      result: "WON",
      pnl: "+$408",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0c0a07] text-white font-sans overflow-x-hidden selection:bg-amber-500/30 relative">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
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

      <div className="max-w-[390px] mx-auto min-h-screen relative shadow-2xl border-x border-white/5 backdrop-blur-[2px]">
        
        {/* Sticky Summary Bar */}
        <div className="sticky top-0 z-20 glass-panel-strong rounded-none border-t-0 border-x-0 border-b border-white/10 px-4 py-3 flex justify-between items-center text-xs">
          <div className="flex flex-col">
            <span className="text-white/60">Trades</span>
            <span className="font-mono text-white/90">
              <AnimatedNumber value={47} />
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-white/60">Win Rate</span>
            <span className="font-mono text-white/90">
              <AnimatedNumber value={68} suffix="%" />
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-white/60">Total PnL</span>
            <span className="font-mono text-emerald-400">
              <AnimatedNumber value={3240} prefix="+$" />
            </span>
          </div>
        </div>

        {/* Filter Row */}
        <div className="px-4 py-4 space-y-3 relative z-10">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/20 border border-white/10 text-xs font-medium whitespace-nowrap text-white/80 hover:bg-white/10 transition-colors backdrop-blur-md">
              {dateFilter} <ChevronDown className="w-3 h-3 text-white/50" />
            </button>
            
            <div className="flex rounded-full bg-black/20 border border-white/10 p-0.5 backdrop-blur-md">
              {["ALL", "BUY", "SELL"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSideFilter(s)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                    sideFilter === s 
                      ? "bg-white/20 text-white shadow-sm" 
                      : "text-white/60 hover:text-white/90"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {["ALL", "Won", "Lost", "Pending"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap backdrop-blur-md ${
                  statusFilter === s
                    ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                    : "bg-black/20 border border-white/10 text-white/60 hover:text-white/90"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Order List */}
        <div className="p-3 space-y-3 relative z-10">
          {orders.map((order, i) => {
            const isWin = order.result === "WON";
            const isBuy = order.side === "BUY";
            
            return (
              <motion.div 
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05, type: "spring" }}
                className={`glass-panel overflow-hidden relative`}
              >
                {/* Left edge indicator */}
                <div 
                  className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                    isWin ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  }`} 
                />
                
                <div className="pl-4 pr-3 py-3">
                  {/* Top row */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <h3 className="text-white/90 font-medium text-sm leading-tight flex-1">
                      {order.question}
                    </h3>
                    <span 
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isBuy ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {order.side}
                    </span>
                  </div>
                  
                  {/* Middle row: Stats */}
                  <div className="grid grid-cols-4 gap-1 mb-4 bg-black/20 p-2 rounded-lg border border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-white/50 uppercase tracking-wider mb-0.5">Entry</span>
                      <span className="font-mono text-xs text-white/90">{order.entryPrice}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-white/50 uppercase tracking-wider mb-0.5">Exit</span>
                      <span className="font-mono text-xs text-white/90">{order.exitPrice}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-white/50 uppercase tracking-wider mb-0.5">Size</span>
                      <span className="font-mono text-xs text-white/90">{order.size}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-white/50 uppercase tracking-wider mb-0.5">Value</span>
                      <span className="font-mono text-xs text-white/90">{order.notional}</span>
                    </div>
                  </div>
                  
                  {/* Bottom row */}
                  <div className="flex justify-between items-center border-t border-white/10 pt-3 mt-1">
                    <span className="text-xs text-white/50">{order.settledDate}</span>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        {isWin ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className={`text-[11px] font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                          {order.result}
                        </span>
                      </div>
                      
                      <span className={`font-mono text-sm font-bold drop-shadow-md ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                        {order.pnl}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Pagination Hint */}
        <div className="py-8 pb-12 flex flex-col items-center justify-center gap-2 relative z-10">
          <span className="text-xs text-white/50">Showing 8 of 47 trades</span>
          <button className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors font-medium">
            Load more <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
