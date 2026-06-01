import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, ExternalLink, Wallet, TrendingUp, TrendingDown, 
  BarChart2, Activity, Info
} from 'lucide-react';
import {
  ComposedChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import './_group.css';

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

// --- Mock Data ---

const chartCandles = Array.from({ length: 30 }).map((_, i) => {
  const base = 80 + i * 0.5 + Math.sin(i * 0.5) * 5;
  const isUp = Math.random() > 0.4;
  const open = base + (Math.random() - 0.5) * 2;
  const close = open + (isUp ? 1 : -1) * Math.random() * 3;
  const high = Math.max(open, close) + Math.random() * 2;
  const low = Math.min(open, close) - Math.random() * 2;
  return {
    date: `10-${String(i + 1).padStart(2, '0')}`,
    open, close, high, low,
    volume: Math.random() * 1000000 + 500000,
    isUp
  };
});

const equityChart = Array.from({ length: 30 }).map((_, i) => {
  return {
    date: `10-${String(i + 1).padStart(2, '0')}`,
    equity: 20000000 + i * 150000 + Math.sin(i * 0.3) * 500000 + Math.random() * 200000
  };
});

const pnlChart = Array.from({ length: 30 }).map((_, i) => {
  return {
    date: `10-${String(i + 1).padStart(2, '0')}`,
    pnl: i < 5 ? -100000 + i * 20000 : 50000 + i * 250000 + Math.random() * 300000
  };
});

// --- Main Page Component ---

export default function Hyperliquid() {
  const [activeVault, setActiveVault] = useState('alpha');
  const [interval, setIntervalVal] = useState('1D');

  const currentPrice = chartCandles[chartCandles.length - 1].close;
  const prevPrice = chartCandles[chartCandles.length - 2].close;
  const priceChange = ((currentPrice - prevPrice) / prevPrice) * 100;

  const TT = {
    contentStyle: {
      background: "rgba(0,0,0,0.8)", 
      border: "1px solid rgba(245, 158, 11, 0.3)",
      backdropFilter: "blur(12px)",
      borderRadius: 8, 
      fontSize: 12,
      color: "white"
    },
    itemStyle: { color: "rgba(255,255,255,0.8)" },
    labelStyle: { color: "rgba(255,255,255,0.5)", marginBottom: 4 },
    cursor: { fill: "rgba(245, 158, 11, 0.1)" }
  };

  return (
    <div className="min-h-screen bg-[#0c0a07] text-white font-sans overflow-x-hidden selection:bg-amber-500/30 relative">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[50%] rounded-full opacity-60 blur-[100px]"
          style={{ background: 'var(--orb-1)' }}
          animate={{ x: [0, 50, -20, 0], y: [0, -30, 40, 0], scale: [1, 1.1, 0.9, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute top-[20%] -right-[20%] w-[70%] h-[60%] rounded-full opacity-50 blur-[120px]"
          style={{ background: 'var(--orb-2)' }}
          animate={{ x: [0, -40, 30, 0], y: [0, 50, -20, 0], scale: [1, 1.2, 0.8, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute -bottom-[10%] left-[10%] w-[50%] h-[40%] rounded-full opacity-60 blur-[90px]"
          style={{ background: 'var(--orb-3)' }}
          animate={{ x: [0, 30, -40, 0], y: [0, -20, 50, 0], scale: [1, 0.9, 1.1, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="max-w-[390px] mx-auto min-h-screen relative shadow-2xl border-x border-white/5 backdrop-blur-[2px] pb-12">
        
        {/* Header Row */}
        <header className="px-5 pt-12 pb-4 flex items-center justify-between relative z-10">
          <button className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 transition-colors">
            <ArrowLeft size={14} />
            <span><span className="opacity-70">返回项目库 ·</span> Back to Projects</span>
          </button>
          
          <div className="flex p-0.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
            <button 
              onClick={() => setActiveVault('alpha')}
              className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${
                activeVault === 'alpha' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]' : 'text-white/50 hover:text-white/80'
              }`}
            >
              金库 A · Alpha
            </button>
            <button 
              onClick={() => setActiveVault('beta')}
              className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${
                activeVault === 'beta' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]' : 'text-white/50 hover:text-white/80'
              }`}
            >
              金库 B · Beta
            </button>
          </div>
        </header>

        <main className="px-5 space-y-5 relative z-10">
          {/* Hero Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, type: "spring" }}
            className="glass-panel-strong p-5 relative overflow-hidden">
            <div className="shimmer-sweep"></div>
            
            <div className="flex items-start gap-4 mb-5 relative z-10">
              <div className="w-14 h-14 rounded-xl bg-black border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex items-center justify-center shrink-0">
                <span className="text-xl font-black text-amber-400 tracking-tighter">HL</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-400/80 block mb-1">
                  <span className="opacity-80">金库实时数据 ·</span> Live Vault Intelligence
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white leading-tight mb-0.5">
                  {activeVault === 'alpha' ? '金库 A · Alpha' : '金库 B · Beta'}
                </h1>
                <p className="text-[10px] text-white/50 mb-2">
                  Hyperliquid Vault<span className="opacity-70"> · 链上永续合约做市金库</span>
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-md px-2 py-1">
                    <Wallet size={10} className="text-white/40" />
                    <span className="font-mono text-[10px] text-white/60">0xc179...e0c8</span>
                    <ExternalLink size={10} className="text-amber-400/70" />
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    运行中 / Active
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/10 relative z-10">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-white/50 mb-1">TVL<span className="opacity-60 hidden sm:inline"> / 总锁仓</span></div>
                <div className="text-sm font-bold text-white"><AnimatedNumber value={24.8} prefix="$" suffix="M" decimals={1} /></div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-white/50 mb-1">APR<span className="opacity-60 hidden sm:inline"> / 年化</span></div>
                <div className="text-sm font-bold text-emerald-400">+<AnimatedNumber value={63.42} suffix="%" decimals={2} /></div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-white/50 mb-1">Total PnL</div>
                <div className="text-sm font-bold text-amber-400">+<AnimatedNumber value={8.4} prefix="$" suffix="M" decimals={1} /></div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-white/50 mb-1">Followers</div>
                <div className="text-sm font-bold text-white"><AnimatedNumber value={12840} /></div>
              </div>
            </div>
          </motion.div>

          {/* PnL Summary Cards */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, type: "spring" }}
            className="grid grid-cols-2 gap-2">
            {[
              { title: "今日盈亏", titleEn: "Day PnL", val: 42500, up: true },
              { title: "本周盈亏", titleEn: "Week PnL", val: -12400, up: false },
              { title: "本月盈亏", titleEn: "Month PnL", val: 345000, up: true },
              { title: "历史盈亏", titleEn: "All-Time", val: 8400000, up: true }
            ].map((item, idx) => (
              <div key={idx} className={`p-3 rounded-xl border bg-black/20 backdrop-blur-sm ${item.up ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                <div className="text-[9px] uppercase text-white/50 mb-1">{item.titleEn} <span className="opacity-70">· {item.title}</span></div>
                <div className={`text-sm font-bold font-mono mb-1 ${item.up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {item.up ? '+' : '-'}${Math.abs(item.val).toLocaleString()}
                </div>
                <div className={`flex items-center gap-1 text-[9px] ${item.up ? 'text-emerald-500' : 'text-red-500'}`}>
                  {item.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  <span>{item.up ? '盈利' : '亏损'}</span>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Market Intelligence */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
            className="space-y-4">
            
            <div className="flex items-center gap-2 border-l-[3px] border-amber-500 pl-3 py-0.5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500/60 mb-0.5">市场数据</div>
                <h2 className="text-base font-bold text-white leading-none">Market Intelligence</h2>
              </div>
            </div>

            {/* HYPE Chart */}
            <div className="glass-panel overflow-hidden border-t-2 border-t-amber-500/50">
              <div className="p-4 border-b border-white/10 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart2 size={14} className="text-amber-400" />
                    <span className="text-sm font-bold text-white">HYPE 价格走势</span>
                    <span className="text-[10px] text-white/50 ml-1">Price Chart</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-mono font-bold text-white">${currentPrice.toFixed(2)}</span>
                    <span className={`text-[10px] font-mono ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 bg-black/40 p-0.5 rounded border border-white/10">
                  {['1H', '4H', '1D', '1W'].map(opt => (
                    <button key={opt} onClick={() => setIntervalVal(opt)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
                        interval === opt ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white/70'
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[200px] w-full pt-4 pb-1 pr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartCandles} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={30} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={v => `$${v.toFixed(0)}`} />
                    <Tooltip {...TT} labelFormatter={() => ''} formatter={(val: number) => [`$${val.toFixed(2)}`, 'Close']} />
                    <Area type="monotone" dataKey="close" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorClose)" />
                    <Bar dataKey="volume" fill="#f59e0b" opacity={0.15} yAxisId="vol" />
                    <YAxis yAxisId="vol" hide domain={[0, 'dataMax * 4']} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Vault Equity */}
              <div className="glass-panel overflow-hidden border-t-2 border-t-amber-500/30">
                <div className="p-3 border-b border-white/5 flex items-center gap-1.5">
                  <Activity size={12} className="text-amber-400/80" />
                  <span className="text-xs font-bold text-white">金库规模走势 <span className="text-[9px] text-white/50 font-normal">Vault Equity</span></span>
                </div>
                <div className="h-[140px] w-full pt-3 pb-1 pr-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={equityChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={30} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1e6).toFixed(0)}M`} />
                      <Tooltip {...TT} labelFormatter={() => ''} formatter={(val: number) => [`$${(val/1e6).toFixed(2)}M`, 'Equity']} />
                      <Area type="monotone" dataKey="equity" stroke="#fbbf24" strokeWidth={2} fillOpacity={1} fill="url(#colorEq)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* All-Time PnL */}
              <div className="glass-panel overflow-hidden border-t-2 border-t-amber-500/30">
                <div className="p-3 border-b border-white/5 flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-amber-400/80" />
                  <span className="text-xs font-bold text-white">历史累计盈亏 <span className="text-[9px] text-white/50 font-normal">All-Time PnL</span></span>
                </div>
                <div className="h-[140px] w-full pt-3 pb-1 pr-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pnlChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={30} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1e6).toFixed(1)}M`} />
                      <Tooltip {...TT} labelFormatter={() => ''} formatter={(val: number) => [`$${(val/1e6).toFixed(2)}M`, 'PnL']} />
                      <Area type="monotone" dataKey="pnl" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorPnl)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Vault Details */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3, type: "spring" }}
            className="space-y-3">
            <div className="flex items-center gap-2 border-l-[3px] border-amber-500 pl-3 py-0.5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500/60 mb-0.5">基本信息</div>
                <h2 className="text-base font-bold text-white leading-none">Vault Details</h2>
              </div>
            </div>

            <div className="glass-panel p-4">
              <div className="space-y-3">
                {[
                  { labelZh: "合约地址", labelEn: "Vault Address", val: "0xc179...e0c8", isLink: true, isMono: true },
                  { labelZh: "管理员", labelEn: "Leader", val: "0x8a92...3b1f", isLink: true, isMono: true },
                  { labelZh: "管理员份额", labelEn: "Leader Fraction", val: "15.00%", isGold: true },
                  { labelZh: "管理员佣金", labelEn: "Commission", val: "10.00%", isGold: true },
                  { labelZh: "年化收益率", labelEn: "APR", val: "+63.42%", isGreen: true },
                  { labelZh: "接受存款", labelEn: "Allow Deposits", val: "是 / Yes" },
                  { labelZh: "跟单人数", labelEn: "Followers", val: "12,840" },
                  { labelZh: "今日盈亏", labelEn: "Day PnL", val: "+$42,500.00", isGreen: true },
                  { labelZh: "历史累计盈亏", labelEn: "All-Time PnL", val: "+$8,400,000.00", isGreen: true },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0 last:pb-0">
                    <span className="text-[10px] text-white/50">{row.labelEn} <span className="opacity-60 hidden xs:inline">· {row.labelZh}</span></span>
                    <div className={`flex items-center gap-1.5 text-xs ${
                      row.isGold ? 'text-amber-400 font-bold' : 
                      row.isGreen ? 'text-emerald-400 font-bold' : 
                      row.isMono ? 'font-mono text-white/80' : 'text-white'
                    }`}>
                      {row.val}
                      {row.isLink && <ExternalLink size={10} className="text-amber-400/50" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Description & Footer Note */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4, type: "spring" }}
            className="space-y-4 pt-2">
            <div className="glass-panel p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info size={14} className="text-amber-400" />
                <h3 className="text-xs font-bold text-white">项目简介 <span className="text-[10px] font-normal text-white/50">Description</span></h3>
              </div>
              <p className="text-[11px] leading-relaxed text-white/60">
                此金库策略专注于 Hyperliquid 链上永续合约的高频做市与套利。通过算法自动捕捉市场微小价差，提供深度流动性的同时获取稳定收益。策略风险经过严格控制，支持随时提取资金。
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[9px] text-white/40">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" style={{ animation: 'pulse-ring 2s infinite' }}></div>
              <span>数据实时同步自 HyperLiquid 公开 API · 每 2 分钟自动刷新</span>
            </div>
            
            <div className="pb-6">
              <button className="w-full py-3.5 rounded-xl bg-[#f59e0b] text-black font-bold text-sm glass-button shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center gap-2">
                参与跟单做市
              </button>
            </div>
          </motion.div>

        </main>
      </div>
    </div>
  );
}
