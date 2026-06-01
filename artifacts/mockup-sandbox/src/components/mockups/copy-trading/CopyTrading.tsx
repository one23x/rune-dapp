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
  Layers,
  ArrowRight
} from 'lucide-react';
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

export function CopyTrading() {
  const [activeTab, setActiveTab] = useState('Overview');
  
  const tabs = ['Overview', 'Auto-Copy', 'Signals', 'Positions', 'Earnings', 'History', 'Funds'];

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
    <div className="min-h-screen bg-[#070605] text-[#f5f5f5] font-sans overflow-x-hidden selection:bg-amber-500/30 relative pb-10">
      <div className="noise-overlay" />
      
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[50%] rounded-full opacity-[0.35] blur-[120px]"
          style={{ background: 'var(--orb-1)' }}
          animate={{ x: [0, 40, -10, 0], y: [0, -20, 30, 0], scale: [1, 1.05, 0.95, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute top-[30%] -right-[20%] w-[70%] h-[60%] rounded-full opacity-[0.25] blur-[140px]"
          style={{ background: 'var(--orb-2)' }}
          animate={{ x: [0, -30, 20, 0], y: [0, 40, -10, 0], scale: [1, 1.1, 0.9, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute -bottom-[20%] left-[10%] w-[50%] h-[40%] rounded-full opacity-[0.3] blur-[100px]"
          style={{ background: 'var(--orb-3)' }}
          animate={{ x: [0, 20, -30, 0], y: [0, -10, 40, 0], scale: [1, 0.95, 1.05, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="max-w-[390px] mx-auto min-h-screen relative z-10 shadow-[0_0_80px_rgba(0,0,0,0.8)] border-x border-white/[0.02]">
        
        {/* Header */}
        <header className="px-6 pt-14 pb-6 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-black/40 backdrop-blur-xl border border-amber-500/20 flex items-center justify-center shadow-lg">
                  <Layers className="text-amber-400" size={20} strokeWidth={1.5} />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3">
                  <div className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: 'pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
                  <div className="absolute inset-0 bg-emerald-400 rounded-full border-[1.5px] border-[#070605]"></div>
                </div>
              </div>
              <div>
                <h1 className="text-[22px] font-medium tracking-wide text-white/95">One-Agents</h1>
                <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500/70 font-semibold mt-0.5">Engine Active</p>
              </div>
            </div>
          </div>
        </header>

        <main className="px-6 space-y-6 relative z-10">
          {/* Balance Hero Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="refined-glass p-6 relative overflow-hidden"
          >
            <div className="shimmer-sweep opacity-50"></div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-white/50 tracking-wider uppercase font-medium">pUSD Balance</p>
            </div>
            <div className="text-[42px] font-light text-white tracking-tight mb-8">
              <AnimatedNumber value={12450.00} prefix="$" decimals={2} />
            </div>

            <div className="flex gap-3 mb-6 relative z-10">
              <button className="flex-1 py-3.5 rounded-xl refined-gold-btn font-semibold text-[13px] flex items-center justify-center gap-2">
                <ArrowDown size={16} strokeWidth={2} />
                <span>充值</span>
              </button>
              <button className="flex-1 rounded-xl bg-white/5 border border-white/10 text-white/90 font-medium text-[13px] py-3.5 flex items-center justify-center gap-2 hover:bg-white/10 active:scale-[0.98] transition-all backdrop-blur-md">
                <ArrowUp size={16} strokeWidth={2} />
                <span>提现</span>
              </button>
            </div>

            <button className="w-full relative z-10 rounded-xl bg-black/40 border border-amber-500/15 py-3.5 px-4 flex items-center justify-between group active:scale-[0.98] transition-all hover:bg-black/60 hover:border-amber-500/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/5 flex items-center justify-center border border-amber-500/20">
                  <Plus size={14} className="text-amber-400" strokeWidth={2} />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-medium text-amber-50/90 leading-tight">开通交易账户</p>
                  <p className="text-[10px] text-amber-500/50 leading-tight mt-1 tracking-wide">激活 One-Agents 智能跟单引擎</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-amber-500/50 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </button>
          </motion.div>

          {/* Stats Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '持仓', val: '3' },
                { label: '名义价值', val: '$8,200' },
                { label: '胜率', val: '68%', highlight: 'text-emerald-400 emerald-glow' },
                { label: '信号', val: '14' },
                { label: '已实现盈亏', val: '+$1,240', highlight: 'text-emerald-400 emerald-glow' },
                { label: '交易次数', val: '47' }
              ].map((stat, i) => (
                <div key={i} className="refined-glass-card p-3 flex flex-col items-center justify-center text-center">
                  <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1.5">{stat.label}</p>
                  <p className={`text-[15px] font-medium ${stat.highlight || 'text-white/90'}`}>{stat.val}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Tab Navigation */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-x-auto scrollbar-hide py-1 -mx-6 px-6"
          >
            <div className="flex gap-2 min-w-max pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full text-[13px] transition-all ${
                    activeTab === tab
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium'
                      : 'bg-transparent text-white/40 font-normal hover:text-white/70'
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
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[14px] font-medium text-white/80 tracking-wide">Active Positions</h3>
              <button className="text-[11px] uppercase tracking-widest text-amber-500/60 hover:text-amber-400 transition-colors">
                View All
              </button>
            </div>

            <div className="space-y-3">
              {positions.map((pos) => (
                <div key={pos.id} className="refined-glass-card p-4 relative overflow-hidden group">
                  <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${pos.side === 'BUY' ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}></div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-[13px] font-medium text-white/85 leading-relaxed pr-4">{pos.question}</h4>
                    <span className={`text-[9px] font-bold px-2 py-1 rounded tracking-wider ${
                      pos.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {pos.side}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Price</p>
                      <p className="text-[12px] font-medium text-white/80">{pos.price}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Size</p>
                      <p className="text-[12px] font-medium text-white/80">{pos.size}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Notional</p>
                      <p className="text-[12px] font-medium text-white/80">{pos.notional}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Status</p>
                      <p className="text-[12px] font-medium text-amber-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 gold-glow"></span>
                        Live
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-white/[0.04]">
                    <span className="text-[11px] text-white/40 uppercase tracking-widest">Unrealized PnL</span>
                    <span className={`text-[14px] font-medium ${pos.isPositive ? 'text-emerald-400 emerald-glow' : 'text-red-400 red-glow'} flex items-center gap-1.5`}>
                      {pos.pnl}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="pt-4 pb-6"
          >
            <div className="flex items-center justify-center gap-2 text-[10px] text-white/30 uppercase tracking-widest">
              <Wallet size={12} className="opacity-50" />
              <span>Polygon pUSD · 即时到账</span>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

export default CopyTrading;