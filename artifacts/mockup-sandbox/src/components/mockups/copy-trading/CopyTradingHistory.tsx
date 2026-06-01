import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ArrowLeft } from "lucide-react";
import "../rune-glass/_group.css";
import "./_refined.css";

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
    }
  ];

  return (
    <div className="min-h-screen bg-[#070605] text-[#f5f5f5] font-sans overflow-x-hidden selection:bg-amber-500/30 relative">
      <div className="noise-overlay" />
      
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[50%] rounded-full opacity-[0.3] blur-[120px]"
          style={{ background: 'var(--orb-1)' }}
        />
        <motion.div 
          className="absolute top-[30%] -right-[20%] w-[70%] h-[60%] rounded-full opacity-[0.2] blur-[140px]"
          style={{ background: 'var(--orb-2)' }}
        />
      </div>

      <div className="max-w-[390px] mx-auto min-h-screen relative z-10 shadow-[0_0_80px_rgba(0,0,0,0.8)] border-x border-white/[0.02] pb-10">
        
        {/* Header Navigation */}
        <header className="px-6 pt-12 pb-4 flex items-center gap-4 relative z-10">
          <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-[17px] font-medium tracking-wide">Trading History</h1>
        </header>

        {/* Hero Summary */}
        <div className="px-6 py-4 relative z-10">
          <div className="refined-glass p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Total PnL</p>
              <div className="text-[26px] font-light text-emerald-400 emerald-glow">
                <AnimatedNumber value={3240} prefix="+$" />
              </div>
            </div>
            <div className="h-10 w-[1px] bg-white/10 mx-4"></div>
            <div className="flex gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Trades</p>
                <p className="text-[15px] font-medium text-white/90"><AnimatedNumber value={47} /></p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Win Rate</p>
                <p className="text-[15px] font-medium text-emerald-400"><AnimatedNumber value={68} suffix="%" /></p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-2 flex justify-between items-center relative z-10">
          <div className="flex bg-black/40 border border-white/5 rounded-full p-1 backdrop-blur-md">
            {["ALL", "BUY", "SELL"].map((s) => (
              <button
                key={s}
                onClick={() => setSideFilter(s)}
                className={`px-3.5 py-1.5 rounded-full text-[11px] tracking-wide font-medium transition-all ${
                  sideFilter === s 
                    ? "bg-white/10 text-white shadow-sm" 
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium tracking-wide text-white/50 hover:text-white/80 transition-colors uppercase">
            Filter <ChevronDown size={14} />
          </button>
        </div>

        {/* Order List */}
        <div className="px-6 py-4 space-y-3 relative z-10">
          {orders.map((order, i) => {
            const isWin = order.result === "WON";
            const isBuy = order.side === "BUY";
            
            return (
              <motion.div 
                key={order.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="refined-glass-card p-4 relative"
              >
                <div className="flex justify-between items-start mb-4 gap-4">
                  <h3 className="text-white/90 font-medium text-[13px] leading-relaxed flex-1">
                    {order.question}
                  </h3>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[9px] tracking-wider font-bold ${
                      isBuy ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {order.side}
                    </span>
                    <span className="text-[10px] text-white/30">{order.settledDate}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-white/[0.04]">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Entry</p>
                      <p className="text-[12px] font-medium text-white/70">{order.entryPrice}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Size</p>
                      <p className="text-[12px] font-medium text-white/70">{order.size}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`text-[15px] font-medium ${isWin ? "text-emerald-400 emerald-glow" : "text-red-400 red-glow"}`}>
                      {order.pnl}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="py-8 flex flex-col items-center justify-center gap-3 relative z-10">
          <span className="text-[10px] uppercase tracking-widest text-white/30">Showing 8 of 47 trades</span>
          <button className="text-[11px] uppercase tracking-widest text-amber-500/60 hover:text-amber-400 transition-colors">
            Load More
          </button>
        </div>
      </div>
    </div>
  );
}

export default CopyTradingHistory;