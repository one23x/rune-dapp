import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Settings, 
  Activity,
  Zap,
  CheckCircle2,
  Users,
  Wallet,
  Layers
} from 'lucide-react';
import '../rune-glass/_group.css';

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

export function CopyTradingStrategy() {
  const [allocation, setAllocation] = useState('10%');
  const [leverage, setLeverage] = useState('5x');
  const [takeProfit, setTakeProfit] = useState('50%');
  const [stopLoss, setStopLoss] = useState('20%');
  
  const [selectedTraders, setSelectedTraders] = useState<number[]>([]);

  const traders = [
    {
      id: 1,
      name: "CryptoLeader Alpha",
      initials: "CA",
      color: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
      roi: "+342.5%",
      winRate: "68%",
      drawdown: "-12.4%",
      followers: "1,240",
      aum: "$2.4M"
    },
    {
      id: 2,
      name: "NewsArb Pro",
      initials: "NP",
      color: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
      roi: "+287.1%",
      winRate: "74%",
      drawdown: "-8.2%",
      followers: "892",
      aum: "$1.8M"
    },
    {
      id: 3,
      name: "Momentum Trader",
      initials: "MT",
      color: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
      roi: "+156.8%",
      winRate: "61%",
      drawdown: "-18.5%",
      followers: "3,450",
      aum: "$5.2M"
    },
    {
      id: 4,
      name: "DeFi Maximalist",
      initials: "DM",
      color: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
      roi: "+210.4%",
      winRate: "58%",
      drawdown: "-15.1%",
      followers: "2,100",
      aum: "$3.1M"
    }
  ];

  const toggleTrader = (id: number) => {
    setSelectedTraders(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[#0c0a07] text-white font-sans overflow-x-hidden selection:bg-amber-500/30 relative pb-24">
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
        
        {/* Header Section */}
        <header className="px-5 pt-12 pb-6 relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                  <Activity className="text-amber-400" size={20} />
                </div>
                {/* Live Pulse Dot */}
                <div className="absolute -top-1 -right-1 w-3 h-3">
                  <div className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
                  <div className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50"></div>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">跟单策略</h1>
                <p className="text-xs text-white/70">配置跟单参数并选择策略</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-medium text-emerald-300">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
              <span>Engine Live</span>
            </div>
          </div>

          {/* Stats Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, type: "spring" }}
            className="glass-panel-strong p-4 relative overflow-hidden"
          >
            <div className="shimmer-sweep"></div>
            <div className="grid grid-cols-3 gap-2 relative z-10">
              <div>
                <p className="text-[10px] text-white/60 uppercase tracking-wider mb-1">账户净值</p>
                <p className="text-sm font-bold text-white"><AnimatedNumber value={12450} prefix="$" decimals={0} /></p>
              </div>
              <div>
                <p className="text-[10px] text-white/60 uppercase tracking-wider mb-1">未实现盈亏</p>
                <p className="text-sm font-bold text-emerald-400">+<AnimatedNumber value={450} prefix="$" decimals={0} /></p>
              </div>
              <div>
                <p className="text-[10px] text-white/60 uppercase tracking-wider mb-1">跟单中</p>
                <p className="text-sm font-bold text-white"><AnimatedNumber value={2} decimals={0} /></p>
              </div>
            </div>
          </motion.div>
        </header>

        <main className="px-5 space-y-6 relative z-10 pb-10">
          {/* Configuration Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, type: "spring" }}
            className="glass-panel p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Settings size={16} className="text-amber-400" />
              <h2 className="text-sm font-medium text-white/90">参数配置</h2>
            </div>

            <div className="space-y-5">
              {/* Allocation */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/70">跟单比例 (仓位占比)</span>
                  <span className="text-xs font-mono font-bold text-amber-400">{allocation}</span>
                </div>
                <div className="flex gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
                  {['5%', '10%', '25%', '50%'].map(val => (
                    <button
                      key={val}
                      onClick={() => setAllocation(val)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                        allocation === val 
                          ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                          : 'text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Leverage */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/70">杠杆倍数</span>
                  <span className="text-xs font-mono font-bold text-amber-400">{leverage}</span>
                </div>
                <div className="flex gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
                  {['2x', '3x', '5x', '10x'].map(val => (
                    <button
                      key={val}
                      onClick={() => setLeverage(val)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                        leverage === val 
                          ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                          : 'text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* TP / SL */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs text-white/70">止盈 %</span>
                  <div className="flex gap-1 bg-black/20 border border-white/5 rounded-xl p-1">
                    {['20%', '50%', '100%'].map(val => (
                      <button
                        key={val}
                        onClick={() => setTakeProfit(val)}
                        className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-all ${
                          takeProfit === val ? 'bg-white/20 text-white shadow-sm' : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs text-white/70">止损 %</span>
                  <div className="flex gap-1 bg-black/20 border border-white/5 rounded-xl p-1">
                    {['10%', '20%', '50%'].map(val => (
                      <button
                        key={val}
                        onClick={() => setStopLoss(val)}
                        className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-all ${
                          stopLoss === val ? 'bg-white/20 text-white shadow-sm' : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Strategy Selection Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, type: "spring" }}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-amber-400" />
                <h2 className="text-sm font-medium text-white/90">选择策略</h2>
              </div>
              <span className="text-[10px] text-white/50 bg-white/10 px-2 py-0.5 rounded border border-white/10">可多选</span>
            </div>

            <div className="space-y-3">
              {traders.map(trader => {
                const isSelected = selectedTraders.includes(trader.id);
                return (
                  <div 
                    key={trader.id}
                    onClick={() => toggleTrader(trader.id)}
                    className={`glass-panel p-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-[rgba(36,28,14,0.7)]' 
                        : 'hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${trader.color}`}>
                          {trader.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white">{trader.name}</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div className="text-[10px] text-white/50 mt-1 flex gap-2.5">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {trader.followers}</span>
                            <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> AUM: {trader.aum}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                        isSelected ? 'bg-amber-500 border-amber-500 text-black' : 'border-white/20 text-transparent'
                      }`}>
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
                      <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                        <p className="text-[9px] text-white/50 uppercase mb-0.5">ROI (30d)</p>
                        <p className="text-xs font-bold text-emerald-400">{trader.roi}</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                        <p className="text-[9px] text-white/50 uppercase mb-0.5">胜率</p>
                        <p className="text-xs font-bold text-white">{trader.winRate}</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                        <p className="text-[9px] text-white/50 uppercase mb-0.5">最大回撤</p>
                        <p className="text-xs font-bold text-red-400">{trader.drawdown}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </main>

        {/* Sticky Bottom Action */}
        <div className="fixed bottom-0 left-0 right-0 z-50 p-5 pb-8 bg-gradient-to-t from-[#0c0a07] via-[#0c0a07]/90 to-transparent pointer-events-none">
          <div className="max-w-[390px] mx-auto pointer-events-auto">
            <button 
              disabled={selectedTraders.length === 0}
              className={`w-full relative overflow-hidden rounded-xl font-bold text-sm py-4 flex items-center justify-center gap-2 transition-all ${
                selectedTraders.length > 0 
                  ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.35)] active:scale-[0.98]' 
                  : 'glass-panel text-white/50 cursor-not-allowed border-white/10 bg-black/40'
              }`}
            >
              {selectedTraders.length > 0 && <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>}
              <Zap size={16} strokeWidth={2.5} />
              <span>
                {selectedTraders.length > 0 ? `开启跟单 · 已选 ${selectedTraders.length}` : '请选择至少一个策略'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default CopyTradingStrategy;