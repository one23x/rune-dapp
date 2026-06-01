import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Sparkles,
  Layers
} from 'lucide-react';
import "../rune-glass/_group.css";

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
    <div className="min-h-screen bg-[#0c0a07] text-white font-sans overflow-x-hidden selection:bg-amber-500/30 relative pb-10">
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

      <div className="max-w-[390px] mx-auto min-h-screen relative z-10 shadow-2xl border-x border-white/5 backdrop-blur-[2px]">
        
        {/* Header */}
        <header className="px-5 pt-12 pb-4 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                  <Layers className="text-white" size={20} />
                </div>
                {/* Live Pulse Dot */}
                <div className="absolute -top-1 -right-1 w-3 h-3">
                  <div className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
                  <div className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50"></div>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">One-Agents Engine</h1>
                <p className="text-xs text-white/70">Smart Copy-Trading</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-emerald-400 tracking-wide">ACTIVE</span>
            </div>
          </div>
        </header>

        <main className="px-5 space-y-5 relative z-10">
          {/* Balance Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, type: "spring" }}
            className="glass-panel-strong p-5 relative overflow-hidden"
          >
            <div className="shimmer-sweep"></div>
            <p className="text-xs text-white/70 mb-1">pUSD Balance</p>
            <div className="text-4xl font-bold text-white tracking-tight mb-5 drop-shadow-md">
              <AnimatedNumber value={12450.00} prefix="$" decimals={2} />
            </div>

            {/* ── PRIMARY ACTION BUTTONS ── */}
            <div className="flex gap-2 mb-4 relative z-10">
              {/* Deposit — gold, most prominent */}
              <button className="flex-1 py-3 rounded-xl bg-[#f59e0b] text-black font-bold text-sm glass-button shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center gap-2">
                <ArrowDown size={16} strokeWidth={2.5} />
                <span>充值</span>
              </button>
              {/* Withdraw */}
              <button className="flex-1 rounded-xl bg-white/10 border border-white/20 text-white font-semibold text-sm py-3 flex items-center justify-center gap-2 hover:bg-white/20 active:scale-[0.98] transition-all backdrop-blur-md">
                <ArrowUp size={16} strokeWidth={2.5} />
                <span>提现</span>
              </button>
            </div>

            {/* ── OPEN TRADING ACCOUNT CTA ── */}
            <button className="w-full relative z-10 overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-amber-500/5 py-3 px-4 flex items-center justify-between group active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Plus size={16} className="text-amber-400" strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-amber-400 leading-tight">开通交易账户</p>
                  <p className="text-[10px] text-white/60 leading-tight mt-0.5">激活 One-Agents 智能跟单引擎</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles size={12} className="text-amber-400/80" />
                <ChevronRight size={16} className="text-amber-400/80 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </motion.div>

          {/* Stats Grid Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, type: "spring" }}
            className="glass-panel p-4"
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-black/20 border border-white/10 rounded-lg p-2.5">
                <p className="text-[9px] text-white/50 uppercase tracking-wider mb-1">持仓</p>
                <p className="text-sm font-bold text-white">3</p>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-lg p-2.5">
                <p className="text-[9px] text-white/50 uppercase tracking-wider mb-1">名义价值</p>
                <p className="text-sm font-bold text-white">$8,200</p>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-lg p-2.5">
                <p className="text-[9px] text-white/50 uppercase tracking-wider mb-1">胜率</p>
                <p className="text-sm font-bold text-emerald-400">68%</p>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-lg p-2.5">
                <p className="text-[9px] text-white/50 uppercase tracking-wider mb-1">信号</p>
                <p className="text-sm font-bold text-white">14</p>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-lg p-2.5">
                <p className="text-[9px] text-white/50 uppercase tracking-wider mb-1">已实现盈亏</p>
                <p className="text-sm font-bold text-emerald-400">+$1,240</p>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-lg p-2.5">
                <p className="text-[9px] text-white/50 uppercase tracking-wider mb-1">交易次数</p>
                <p className="text-sm font-bold text-white">47</p>
              </div>
            </div>
          </motion.div>

          {/* Tab Navigation */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, type: "spring" }}
            className="overflow-x-auto scrollbar-hide py-1 -mx-5 px-5"
          >
            <div className="flex gap-2 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Active Positions */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, type: "spring" }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-white/90">Active Positions</h3>
              <button className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1 transition-colors">
                View All <ChevronRight size={12} />
              </button>
            </div>

            <div className="space-y-3">
              {positions.map((pos) => (
                <div key={pos.id} className="glass-panel p-4 relative overflow-hidden group">
                  <div className={`absolute top-0 left-0 w-1 h-full ${pos.side === 'BUY' ? 'bg-emerald-400' : 'bg-red-500'} opacity-80`}></div>
                  
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-sm font-medium text-white/90 leading-snug pr-4">{pos.question}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      pos.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {pos.side}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 mb-3 pb-3 border-b border-white/10">
                    <div>
                      <p className="text-[9px] text-white/50 uppercase">Price</p>
                      <p className="text-xs font-medium text-white/80">{pos.price}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/50 uppercase">Size</p>
                      <p className="text-xs font-medium text-white/80">{pos.size}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/50 uppercase">Notional</p>
                      <p className="text-xs font-medium text-white/80">{pos.notional}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/50 uppercase">Status</p>
                      <p className="text-xs font-medium text-white/80 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shadow-[0_0_5px_rgba(245,158,11,0.5)]"></span>
                        {pos.status}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/60">Unrealized PnL</span>
                    <span className={`text-sm font-bold ${pos.isPositive ? 'text-emerald-400' : 'text-red-400'} flex items-center gap-1`}>
                      {pos.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {pos.pnl}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4, type: "spring" }}
            className="pt-2"
          >
            <h3 className="text-sm font-medium text-white/90 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center gap-3 glass-panel p-3 hover:bg-white/10 transition-colors border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                  <Zap size={16} className="text-amber-400" />
                </div>
                <span className="text-sm font-medium text-white/80">Auto-Copy</span>
              </button>
              <button className="flex items-center gap-3 glass-panel p-3 hover:bg-white/10 transition-colors border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <Activity size={16} className="text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-white/80">Signals</span>
              </button>
              <button className="flex items-center gap-3 glass-panel p-3 hover:bg-white/10 transition-colors border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                  <BarChart2 size={16} className="text-amber-400" />
                </div>
                <span className="text-sm font-medium text-white/80">Positions</span>
              </button>
              <button className="flex items-center gap-3 glass-panel p-3 hover:bg-white/10 transition-colors border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <Activity size={16} className="text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-white/80">Hyperliquid</span>
              </button>
            </div>
          </motion.div>

          {/* Funds info footer */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5, type: "spring" }}
            className="pb-6 pt-2"
          >
            <div className="flex items-center gap-2 text-[10px] text-white/50 border border-white/10 rounded-lg px-3 py-2.5 bg-black/20 backdrop-blur-md">
              <Wallet size={12} className="shrink-0 text-white/40" />
              <span>充值/提现通过 Polygon 网络 pUSD · 即时到账</span>
            </div>
          </motion.div>

        </main>
      </div>
    </div>
  );
}

export default CopyTrading;