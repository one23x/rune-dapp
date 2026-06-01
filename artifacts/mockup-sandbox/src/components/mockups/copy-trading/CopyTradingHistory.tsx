import React, { useState } from "react";
import { ChevronDown, Filter, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

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
    <div className="min-h-screen bg-[#0d0b08] text-zinc-300 font-sans overflow-x-hidden w-full max-w-[390px] mx-auto border-x border-[#221f18] relative">
      {/* Sticky Summary Bar */}
      <div className="sticky top-0 z-20 bg-[#15130f]/90 backdrop-blur-md border-b border-[#221f18] px-4 py-3 flex justify-between items-center text-xs">
        <div className="flex flex-col">
          <span className="text-zinc-500">Trades</span>
          <span className="font-mono text-zinc-200">47</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-zinc-500">Win Rate</span>
          <span className="font-mono text-zinc-200">68%</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-zinc-500">Total PnL</span>
          <span className="font-mono text-[#10b981]">+$3,240</span>
        </div>
      </div>

      {/* Filter Row */}
      <div className="px-4 py-4 space-y-3 border-b border-[#221f18]/50">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1a1813] border border-[#332f26] text-xs font-medium whitespace-nowrap text-zinc-300 hover:bg-[#221f18] transition-colors">
            {dateFilter} <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>
          
          <div className="flex rounded-full bg-[#1a1813] border border-[#332f26] p-0.5">
            {["ALL", "BUY", "SELL"].map((s) => (
              <button
                key={s}
                onClick={() => setSideFilter(s)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                  sideFilter === s 
                    ? "bg-[#2a261c] text-white shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-300"
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
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]"
                  : "bg-[#12100c] border-[#221f18] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Order List */}
      <div className="p-3 space-y-3">
        {orders.map((order) => {
          const isWin = order.result === "WON";
          const isBuy = order.side === "BUY";
          
          return (
            <div 
              key={order.id}
              className={`bg-[#12100c] rounded-lg border border-[#221f18] overflow-hidden relative shadow-sm`}
            >
              {/* Left edge indicator */}
              <div 
                className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  isWin ? "bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                }`} 
              />
              
              <div className="pl-3 pr-3 py-3">
                {/* Top row */}
                <div className="flex justify-between items-start mb-3 gap-2">
                  <h3 className="text-zinc-200 font-medium text-sm leading-tight truncate flex-1">
                    {order.question}
                  </h3>
                  <span 
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isBuy ? "bg-[#10b981]/10 text-[#10b981]" : "bg-[#ef4444]/10 text-[#ef4444]"
                    }`}
                  >
                    {order.side}
                  </span>
                </div>
                
                {/* Middle row: Stats */}
                <div className="grid grid-cols-4 gap-1 mb-4 bg-[#0d0b08] p-2 rounded border border-[#1a1813]">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">Entry</span>
                    <span className="font-mono text-xs text-zinc-300">{order.entryPrice}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">Exit</span>
                    <span className="font-mono text-xs text-zinc-300">{order.exitPrice}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">Size</span>
                    <span className="font-mono text-xs text-zinc-300">{order.size}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">Value</span>
                    <span className="font-mono text-xs text-zinc-300">{order.notional}</span>
                  </div>
                </div>
                
                {/* Bottom row */}
                <div className="flex justify-between items-center border-t border-[#1a1813] pt-3 mt-1">
                  <span className="text-xs text-zinc-500">{order.settledDate}</span>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {isWin ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#ef4444]" />
                      )}
                      <span className={`text-[11px] font-bold ${isWin ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                        {order.result}
                      </span>
                    </div>
                    
                    <span className={`font-mono text-sm font-semibold ${isWin ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                      {order.pnl}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Hint */}
      <div className="py-8 pb-12 flex flex-col items-center justify-center gap-2">
        <span className="text-xs text-zinc-500">Showing 8 of 47 trades</span>
        <button className="text-xs text-[#f59e0b] hover:text-[#fcd34d] flex items-center gap-1 transition-colors">
          Load more <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
