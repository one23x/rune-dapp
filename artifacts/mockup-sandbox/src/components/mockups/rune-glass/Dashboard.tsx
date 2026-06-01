import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { 
  BarChart3, Activity, Globe, TrendingUp, TrendingDown, Minus, 
  Sparkles, Zap, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import {
  ComposedChart, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Bar
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

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"];

const basePrice = 92450.50;
interface ChartPoint {
  time: string;
  price: number | null;
  forecastPrice: number | null;
  isForecast: boolean;
}
const chartData: ChartPoint[] = Array.from({ length: 40 }).map((_, i): ChartPoint => {
  const isForecast = i >= 30;
  const t = i * 0.5;
  const noise = Math.sin(t * 3) * 50 + Math.cos(t * 7) * 20;
  
  if (!isForecast) {
    const val = basePrice - 1000 + i * 35 + noise;
    return {
      time: `10-${String((i % 24) + 1).padStart(2, '0')}:00`,
      price: val,
      forecastPrice: null,
      isForecast: false,
    };
  } else {
    const prevVal = basePrice - 1000 + 29 * 35 + Math.sin(29 * 0.5 * 3) * 50 + Math.cos(29 * 0.5 * 7) * 20;
    const progress = (i - 30) / 10;
    const target = 96000;
    const val = prevVal + (target - prevVal) * progress + noise * 1.5;
    return {
      time: `10-${String((i % 24) + 1).padStart(2, '0')}:00`,
      price: null,
      forecastPrice: val,
      isForecast: true,
    };
  }
});

// Link last historical to first forecast to make line continuous
const lastReal = chartData[29];
chartData[29] = { ...lastReal, forecastPrice: lastReal.price };

const AI_MODELS = [
  { name: "GPT-4o", direction: "BULLISH", conf: 85, price: 92450.5, target: 96000, reason: "Strong accumulation patterns on 1H timeframe." },
  { name: "DeepSeek", direction: "BULLISH", conf: 78, price: 92450.5, target: 95500, reason: "Options OI indicates bullish breakout." },
  { name: "Llama 3.1", direction: "NEUTRAL", conf: 55, price: 92450.5, target: 92500, reason: "Market approaching key resistance level." },
  { name: "Gemini", direction: "BEARISH", conf: 62, price: 92450.5, target: 89000, reason: "Short-term momentum waning." },
  { name: "Grok", direction: "BULLISH", conf: 81, price: 92450.5, target: 96500, reason: "High volume breakout expected soon." },
];

const FUTURES_OI = [
  { exchange: "Binance", value: 3450000000, max: 3500000000 },
  { exchange: "Bybit", value: 2150000000, max: 3500000000 },
  { exchange: "OKX", value: 1850000000, max: 3500000000 },
  { exchange: "Bitget", value: 950000000, max: 3500000000 },
  { exchange: "dYdX", value: 450000000, max: 3500000000 },
  { exchange: "HyperLiquid", value: 380000000, max: 3500000000 },
  { exchange: "Gate.io", value: 210000000, max: 3500000000 },
  { exchange: "MEXC", value: 150000000, max: 3500000000 },
];

const TRENDING = [
  { symbol: "SOL", price: 145.2, change: 12.5 },
  { symbol: "WIF", price: 2.45, change: 25.4 },
  { symbol: "PEPE", price: 0.000012, change: -5.2 },
  { symbol: "BOME", price: 0.012, change: 18.1 },
  { symbol: "ORDI", price: 0.008, change: 9.4 },
];

const CROSS_EXCHANGE = [
  { exchange: "Binance", price: 92450.50, change: 2.4 },
  { exchange: "Bybit", price: 92455.00, change: 2.41 },
  { exchange: "OKX", price: 92448.20, change: 2.38 },
  { exchange: "Coinbase", price: 92460.10, change: 2.42 },
  { exchange: "Kraken", price: 92452.30, change: 2.39 },
  { exchange: "Bitstamp", price: 92445.80, change: 2.35 },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function Dashboard() {
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1H");
  const [selectedModel, setSelectedModel] = useState("GPT-4o");
  const [oiExpanded, setOiExpanded] = useState(false);
  const [epExpanded, setEpExpanded] = useState(false);

  const formatCompact = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
  };

  const TT = {
    contentStyle: {
      background: "rgba(12,10,7,0.9)", 
      border: "1px solid rgba(245, 158, 11, 0.3)",
      backdropFilter: "blur(12px)",
      borderRadius: 8, 
      fontSize: 12,
      color: "white"
    },
    itemStyle: { color: "rgba(255,255,255,0.9)" },
    labelStyle: { color: "rgba(255,255,255,0.5)", marginBottom: 4 },
    cursor: { stroke: "rgba(245, 158, 11, 0.2)", strokeWidth: 1, strokeDasharray: "3 3" }
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

      <div className="max-w-[390px] mx-auto min-h-screen relative shadow-2xl border-x border-white/5 backdrop-blur-[2px] pb-12 flex flex-col">
        
        {/* Header Section */}
        <div className="pt-12 px-5 pb-4 relative z-10">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-amber-400">₿</span>
                </div>
                <span className="text-xs text-white/60">BTC/USDT</span>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
                  <AnimatedNumber value={92450.50} prefix="$" decimals={2} />
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <TrendingUp size={10} className="mr-0.5" />
                  +2.40%
                </span>
              </div>
            </div>
            
            <button className="shrink-0 w-10 h-10 rounded-xl glass-button flex items-center justify-center text-amber-400 hover:text-amber-300 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <BarChart3 size={20} />
            </button>
          </div>

          {/* Chart Card */}
          <div className="glass-panel-strong overflow-hidden relative">
            <div className="shimmer-sweep"></div>
            <div className="p-3 border-b border-white/10 flex justify-between items-center relative z-10">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-white">AI 预测走势 <span className="text-[10px] font-normal text-white/50">Forecast</span></span>
              </div>
              <div className="flex gap-1 bg-black/40 p-0.5 rounded border border-white/10">
                {['1H', '4H', '1D', '1W'].map(tf => (
                  <button 
                    key={tf} 
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
                      selectedTimeframe === tf ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="relative z-10 p-2 border-b border-white/5">
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ animation: 'pulse-ring 2s infinite' }}></span>
                {selectedModel} Target: $96,000.00
              </div>
            </div>

            <div className="h-[220px] w-full pt-4 pb-2 pr-2 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={30} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} domain={['dataMin - 1000', 'dataMax + 1000']} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                  <Tooltip {...TT} labelFormatter={() => ''} formatter={(val: number) => [`$${val.toFixed(2)}`, 'Price']} />
                  <Area type="monotone" dataKey="price" stroke="#ffffff" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="forecastPrice" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorForecast)" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Asset Tabs */}
        <div className="px-5 mb-5 relative z-10">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5">
            {ASSETS.map(asset => (
              <button
                key={asset}
                onClick={() => setSelectedAsset(asset)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  selectedAsset === asset
                    ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Sections */}
        <motion.main 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="px-5 space-y-4 relative z-10 flex-1"
        >
          {/* AI Model Carousel */}
          <motion.section variants={itemVariants}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Zap size={14} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white">AI 多模型预测 <span className="text-[10px] text-white/50 font-normal">AI Forecast</span></h3>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-4 -mx-5 px-5 snap-x">
              {AI_MODELS.map((model) => {
                const isBull = model.direction === 'BULLISH';
                const isBear = model.direction === 'BEARISH';
                const dirColor = isBull ? 'text-emerald-400' : isBear ? 'text-red-400' : 'text-amber-400';
                const dirBg = isBull ? 'bg-emerald-500/10 border-emerald-500/20' : isBear ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20';
                const isActive = selectedModel === model.name;

                return (
                  <button 
                    key={model.name}
                    onClick={() => setSelectedModel(model.name)}
                    className={`shrink-0 w-64 snap-center text-left transition-all duration-300 ${isActive ? 'glass-panel-strong ring-1 ring-amber-500/50 scale-[1.02]' : 'glass-panel opacity-70 hover:opacity-100'}`}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-sm font-bold text-white mb-1">{model.name}</div>
                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${dirBg} ${dirColor}`}>
                            {isBull ? <TrendingUp size={10} /> : isBear ? <TrendingDown size={10} /> : <Minus size={10} />}
                            {model.direction}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-white">{model.conf}%</div>
                          <div className="text-[8px] text-white/40 uppercase tracking-wider">Confidence</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mb-3 text-xs">
                        <div>
                          <div className="text-white/40 text-[9px] mb-0.5">Current</div>
                          <div className="font-mono text-white/80">${model.price.toLocaleString()}</div>
                        </div>
                        <div className="text-white/20">→</div>
                        <div className="text-right">
                          <div className="text-white/40 text-[9px] mb-0.5">Target</div>
                          <div className={`font-mono font-bold ${dirColor}`}>${model.target.toLocaleString()}</div>
                        </div>
                      </div>
                      
                      <div className="pt-3 border-t border-white/10">
                        <p className="text-[10px] text-white/60 leading-relaxed line-clamp-2">
                          <Sparkles size={10} className="inline mr-1 text-amber-400/70" />
                          {model.reason}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.section>

          {/* Futures Open Interest */}
          <motion.section variants={itemVariants} className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-4">
              <Layers size={14} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white">合约持仓量 <span className="text-[10px] text-white/50 font-normal">Futures OI</span></h3>
            </div>
            
            <div className="space-y-3">
              {(oiExpanded ? FUTURES_OI : FUTURES_OI.slice(0, 4)).map((item, idx) => {
                const max = FUTURES_OI[0].max;
                const pct = (item.value / max) * 100;
                
                return (
                  <div key={item.exchange} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-white/80">{item.exchange}</span>
                      <span className="font-mono text-amber-400">${formatCompact(item.value)}</span>
                    </div>
                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        transition={{ duration: 1, delay: idx * 0.1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full relative"
                      >
                        <div className="absolute top-0 right-0 bottom-0 w-4 bg-gradient-to-r from-transparent to-white/50 blur-[2px]"></div>
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button 
              onClick={() => setOiExpanded(!oiExpanded)}
              className="w-full mt-4 py-2 border border-white/10 rounded-lg text-[10px] font-medium text-white/60 hover:text-white/90 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
            >
              {oiExpanded ? (
                <>收起 / Collapse <ChevronUp size={12} /></>
              ) : (
                <>展开更多 / Expand More <ChevronDown size={12} /></>
              )}
            </button>
          </motion.section>

          {/* Trending Feed */}
          <motion.section variants={itemVariants} className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={14} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white">热门 <span className="text-[10px] text-white/50 font-normal">Trending</span></h3>
            </div>
            
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TRENDING.map(coin => {
                const isPos = coin.change >= 0;
                return (
                  <div key={coin.symbol} className="bg-black/30 border border-white/5 rounded-lg p-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-bold text-white">{coin.symbol}</div>
                      <div className="font-mono text-[10px] text-white/60">${coin.price.toString().length > 6 ? coin.price.toFixed(6) : coin.price}</div>
                    </div>
                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {isPos ? '+' : ''}{coin.change}%
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* Cross-Exchange Prices */}
          <motion.section variants={itemVariants} className="glass-panel p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={14} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white">跨交易所价格 <span className="text-[10px] text-white/50 font-normal">Cross-Exchange</span></h3>
            </div>
            
            <div className="space-y-0.5">
              <div className="flex justify-between items-center py-2 text-[9px] uppercase tracking-wider text-white/40 border-b border-white/10 mb-1">
                <span>Exchange</span>
                <div className="flex gap-6">
                  <span className="w-16 text-right">Price</span>
                  <span className="w-12 text-right">24h%</span>
                </div>
              </div>
              
              {(epExpanded ? CROSS_EXCHANGE : CROSS_EXCHANGE.slice(0, 3)).map((item) => {
                const isPos = item.change >= 0;
                return (
                  <div key={item.exchange} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
                    <span className="text-xs font-medium text-white/90">{item.exchange}</span>
                    <div className="flex gap-6 font-mono text-xs">
                      <span className="w-16 text-right text-white">${item.price.toFixed(2)}</span>
                      <span className={`w-12 text-right ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPos ? '+' : ''}{item.change.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button 
              onClick={() => setEpExpanded(!epExpanded)}
              className="w-full mt-3 py-2 border border-white/10 rounded-lg text-[10px] font-medium text-white/60 hover:text-white/90 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
            >
              {epExpanded ? (
                <>收起 / Collapse <ChevronUp size={12} /></>
              ) : (
                <>展开更多 / Expand More <ChevronDown size={12} /></>
              )}
            </button>
          </motion.section>

        </motion.main>

        {/* Floating CTA */}
        <div className="px-5 pt-4 pb-8 relative z-20 mt-auto">
          <button className="w-full py-4 rounded-xl bg-[#f59e0b] text-black font-bold text-sm glass-button shadow-[0_0_30px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2">
            <BarChart3 size={16} />
            前往分析 / Go to Analysis
          </button>
        </div>

      </div>
    </div>
  );
}
