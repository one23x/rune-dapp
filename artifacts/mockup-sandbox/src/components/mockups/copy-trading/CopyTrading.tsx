import React, { useState } from 'react';
import { 
  ArrowDown, 
  ArrowUp, 
  Activity, 
  TrendingUp, 
  BarChart2, 
  Wallet,
  Zap,
  ChevronRight,
  TrendingDown,
  Plus,
  Sparkles
} from 'lucide-react';

export function CopyTrading() {
  const [activeTab, setActiveTab] = useState('Overview');
  
  const tabs = ['Overview', 'Auto-Copy', 'Signals', 'Positions', 'Earnings', 'History', 'Funds'];

  // Mock data for positions
  const positions = [
    {
      id: 1,
      question: "Will Bitcoin exceed $150K by 2026?",
      side: "BUY",
      price: "$0.65",
      size: "1,000",
      notional: "$650.00",
      status: "Live",
      pnl: "+$124.50",
      isPositive: true
    },
    {
      id: 2,
      question: "Ethereum ETF to surpass $10B AUM in Q3?",
      side: "SELL",
      price: "$0.32",
      size: "2,500",
      notional: "$800.00",
      status: "Live",
      pnl: "-$32.00",
      isPositive: false
    },
    {
      id: 3,
      question: "Solana to flip Ethereum in DEX volume this month?",
      side: "BUY",
      price: "$0.18",
      size: "5,000",
      notional: "$900.00",
      status: "Live",
      pnl: "+$45.20",
      isPositive: true
    }
  ];

  return (
    <div className="min-h-screen bg-[#0d0b08] text-zinc-300 font-sans overflow-x-hidden selection:bg-[#f59e0b]/30">
      <div className="max-w-[390px] mx-auto bg-[#0d0b08] min-h-screen relative shadow-2xl border-x border-white/5">
        
        {/* Header Section */}
        <header className="px-4 pt-5 pb-4 relative overflow-hidden bg-gradient-to-b from-[#f59e0b]/8 to-transparent border-b border-white/5">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#f59e0b]/40 to-transparent"></div>
          <div className="absolute -top-12 right-0 w-40 h-40 bg-[#f59e0b]/8 rounded-full blur-3xl pointer-events-none"></div>

          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight leading-tight">One-Agents Engine</h1>
              <p className="text-[11px] text-zinc-500">Smart Copy-Trading</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
              </div>
              <span className="text-[11px] font-medium text-[#10b981]">Active</span>
            </div>
          </div>

          {/* Balance */}
          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-0.5">pUSD Balance</p>
            <h2 className="text-3xl font-light text-[#f59e0b] tracking-tight">$12,450<span className="text-xl text-[#f59e0b]/50">.00</span></h2>
          </div>

          {/* ── PRIMARY ACTION BUTTONS ── */}
          <div className="flex gap-2 mb-4">
            {/* Deposit — gold, most prominent */}
            <button className="flex-1 relative overflow-hidden rounded-xl bg-[#f59e0b] text-black font-bold text-sm py-3 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.35)] active:scale-[0.98] transition-transform">
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
              <ArrowDown size={16} strokeWidth={2.5} />
              <span>充值</span>
            </button>
            {/* Withdraw */}
            <button className="flex-1 rounded-xl bg-white/6 border border-white/12 text-white font-semibold text-sm py-3 flex items-center justify-center gap-2 hover:bg-white/10 active:scale-[0.98] transition-all">
              <ArrowUp size={16} strokeWidth={2.5} />
              <span>提现</span>
            </button>
          </div>

          {/* ── OPEN TRADING ACCOUNT CTA ── */}
          <button className="w-full relative overflow-hidden rounded-xl border border-[#f59e0b]/30 bg-gradient-to-r from-[#f59e0b]/10 to-[#f59e0b]/5 py-3 px-4 flex items-center justify-between group active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/15 flex items-center justify-center shrink-0">
                <Plus size={16} className="text-[#f59e0b]" strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-[#f59e0b] leading-tight">开通交易账户</p>
                <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">激活 One-Agents 智能跟单引擎</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles size={12} className="text-[#f59e0b]/60" />
              <ChevronRight size={16} className="text-[#f59e0b]/60 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">持仓</p>
              <p className="text-sm font-semibold text-white">3</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">名义价值</p>
              <p className="text-sm font-semibold text-white">$8,200</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">胜率</p>
              <p className="text-sm font-semibold text-[#10b981]">68%</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">信号</p>
              <p className="text-sm font-semibold text-white">14</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">已实现盈亏</p>
              <p className="text-sm font-semibold text-[#10b981]">+$1,240</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">交易次数</p>
              <p className="text-sm font-semibold text-white">47</p>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="px-4 py-4 border-b border-white/5 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20'
                    : 'bg-transparent text-zinc-400 border border-transparent hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Active Positions */}
        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-white">Active Positions</h3>
            <button className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
              View All <ChevronRight size={12} />
            </button>
          </div>

          <div className="space-y-3">
            {positions.map((pos) => (
              <div key={pos.id} className="bg-[#15120d] border border-white/5 rounded-xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${pos.side === 'BUY' ? 'bg-[#10b981]' : 'bg-[#ef4444]'} opacity-50`}></div>
                
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-sm font-medium text-zinc-200 leading-snug pr-4">{pos.question}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    pos.side === 'BUY' ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#ef4444]/10 text-[#ef4444]'
                  }`}>
                    {pos.side}
                  </span>
                </div>
                
                <div className="grid grid-cols-4 gap-2 mb-3 pb-3 border-b border-white/5">
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase">Price</p>
                    <p className="text-xs text-zinc-300">{pos.price}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase">Size</p>
                    <p className="text-xs text-zinc-300">{pos.size}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase">Notional</p>
                    <p className="text-xs text-zinc-300">{pos.notional}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase">Status</p>
                    <p className="text-xs text-zinc-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] inline-block"></span>
                      {pos.status}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Unrealized PnL</span>
                  <span className={`text-sm font-medium ${pos.isPositive ? 'text-[#10b981]' : 'text-[#ef4444]'} flex items-center gap-1`}>
                    {pos.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {pos.pnl}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 pt-2">
          <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center gap-3 bg-[#15120d] border border-white/5 rounded-xl p-3 hover:bg-white/[0.02] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center">
                <Zap size={16} className="text-[#f59e0b]" />
              </div>
              <span className="text-sm font-medium text-zinc-300">Auto-Copy</span>
            </button>
            <button className="flex items-center gap-3 bg-[#15120d] border border-white/5 rounded-xl p-3 hover:bg-white/[0.02] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Activity size={16} className="text-indigo-400" />
              </div>
              <span className="text-sm font-medium text-zinc-300">Signals</span>
            </button>
            <button className="flex items-center gap-3 bg-[#15120d] border border-white/5 rounded-xl p-3 hover:bg-white/[0.02] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                <BarChart2 size={16} className="text-[#10b981]" />
              </div>
              <span className="text-sm font-medium text-zinc-300">Positions</span>
            </button>
            <button className="flex items-center gap-3 bg-[#15120d] border border-white/5 rounded-xl p-3 hover:bg-white/[0.02] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Activity size={16} className="text-sky-400" />
              </div>
              <span className="text-sm font-medium text-zinc-300">Hyperliquid</span>
            </button>
          </div>
        </div>

        {/* Funds info footer */}
        <div className="px-4 pb-10 pt-2">
          <div className="flex items-center gap-2 text-[10px] text-zinc-600 border border-white/4 rounded-lg px-3 py-2.5 bg-white/[0.01]">
            <Wallet size={11} className="shrink-0 text-zinc-500" />
            <span>充值/提现通过 Polygon 网络 pUSD · 即时到账</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default CopyTrading;