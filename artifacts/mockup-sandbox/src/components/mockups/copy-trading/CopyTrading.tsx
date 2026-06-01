import React, { useState } from 'react';
import { 
  ArrowDown, 
  ArrowUp, 
  Activity, 
  TrendingUp, 
  Copy, 
  BarChart2, 
  Wallet,
  Zap,
  ChevronRight,
  TrendingDown,
  Clock
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
        <header className="px-4 py-6 relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-[#f59e0b]/10 to-transparent">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#f59e0b]/50 to-transparent opacity-50"></div>
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
                </div>
                <span className="text-xs font-medium text-[#10b981] uppercase tracking-wider">Account Active</span>
              </div>
              <h1 className="text-lg font-semibold text-white tracking-tight">One-Agents Engine</h1>
              <p className="text-xs text-zinc-500">Smart Copy-Trading</p>
            </div>
            
            <div className="flex gap-2">
              <button className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
                <ArrowDown size={14} className="text-[#f59e0b]" />
              </button>
              <button className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
                <ArrowUp size={14} className="text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Balance Overview */}
          <div className="mb-6">
            <p className="text-sm text-zinc-400 mb-1">pUSD Balance</p>
            <h2 className="text-4xl font-light text-[#f59e0b] tracking-tight">$12,450<span className="text-2xl text-[#f59e0b]/60">.00</span></h2>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Open Pos</p>
              <p className="text-sm font-medium text-white">3</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Notional</p>
              <p className="text-sm font-medium text-white">$8,200</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Win Rate</p>
              <p className="text-sm font-medium text-[#10b981]">68%</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Signals</p>
              <p className="text-sm font-medium text-white">14</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Realized PnL</p>
              <p className="text-sm font-medium text-[#10b981]">+$1,240</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Trades</p>
              <p className="text-sm font-medium text-white">47</p>
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

        {/* Funds Section */}
        <div className="p-4 pb-10">
          <h3 className="text-sm font-semibold text-white mb-3">Funds</h3>
          <div className="bg-gradient-to-br from-[#15120d] to-[#0d0b08] border border-white/10 rounded-xl p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#f59e0b]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <Wallet size={16} className="text-zinc-400" />
              <span className="text-sm text-zinc-300">Available Balance</span>
            </div>
            
            <div className="mb-6 relative z-10">
              <span className="text-2xl font-semibold text-white tracking-tight">$12,450.00</span>
              <span className="text-sm text-zinc-500 ml-2">pUSD</span>
            </div>
            
            <div className="flex gap-3 mb-4 relative z-10">
              <button className="flex-1 bg-[#f59e0b] hover:bg-[#f59e0b]/90 text-black font-semibold text-sm py-2.5 rounded-lg flex justify-center items-center gap-2 transition-colors">
                <ArrowDown size={16} /> Deposit
              </button>
              <button className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-sm py-2.5 rounded-lg flex justify-center items-center gap-2 transition-colors">
                <ArrowUp size={16} /> Withdraw
              </button>
            </div>
            
            <div className="flex items-start gap-2 text-[10px] text-zinc-500 relative z-10 border-t border-white/5 pt-3">
              <Activity size={12} className="shrink-0 mt-0.5" />
              <p>Funds deposited via Polymarket pUSD on Polygon network. Withdrawals are processed instantly.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default CopyTrading;