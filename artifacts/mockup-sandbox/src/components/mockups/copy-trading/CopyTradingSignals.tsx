import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Check, 
  TrendingUp, 
  Brain, 
  Shield, 
  BarChart2, 
  Zap, 
  Trophy, 
  CheckCircle2,
  Clock
} from "lucide-react";
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

export function CopyTradingSignals() {
  const [followed, setFollowed] = useState<Record<string, boolean>>({
    'CryptoLeader Alpha': true,
    'NewsArb Pro': true,
  });

  const toggleFollow = (name: string) => {
    setFollowed(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="min-h-screen bg-[#0c0a07] text-white font-sans overflow-x-hidden selection:bg-amber-500/30 relative pb-10">
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
        
        {/* Section 1: Signals */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, type: "spring" }}
          className="px-4 pt-12 pb-4 relative z-10"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg relative">
                <Zap className="text-amber-400" size={20} />
                {/* Live Pulse Dot */}
                <div className="absolute -top-1 -right-1 w-3 h-3">
                  <div className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
                  <div className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50"></div>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-md">跟单交易员信号</h2>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/60 bg-white/10 px-2 py-1 rounded-full border border-white/10 backdrop-blur-md">
              <Clock size={10} />
              Updated 2min ago
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {[
              { name: "CryptoLeader Alpha", initials: "CA", color: "bg-amber-500/20 text-amber-400 border border-amber-500/30", dir: "BUY", dirColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", q: "Bitcoin > $150K by 2026?", score: "87%", time: "3m", cat: "Crypto", initFollow: true },
              { name: "AI Oracle Bot", initials: "AO", color: "bg-orange-500/20 text-orange-400 border border-orange-500/30", dir: "SELL", dirColor: "bg-red-500/20 text-red-400 border-red-500/30", q: "Fed rate cut before July?", score: "72%", time: "11m", cat: "Macro", initFollow: false },
              { name: "NewsArb Pro", initials: "NP", color: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30", dir: "BUY", dirColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", q: "Ethereum ETF AUM > $10B?", score: "91%", time: "28m", cat: "Crypto", initFollow: true },
              { name: "DeFi Maximalist", initials: "DM", color: "bg-white/10 text-white/80 border border-white/20", dir: "BUY", dirColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", q: "Solana flips ETH in DEX vol?", score: "64%", time: "1h", cat: "DeFi", initFollow: false },
            ].map((s, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                key={i} 
                className="glass-panel p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${s.color}`}>
                      {s.initials}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white/90 truncate">{s.name}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.dirColor}`}>
                          {s.dir}
                        </span>
                        <span className="text-xs text-white/60 truncate">{s.q}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-lg font-bold text-amber-400 drop-shadow-md">{s.score}</span>
                    <span className="text-[10px] text-white/40">{s.time}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-1">
                  <span className="text-[10px] font-medium text-white/50 bg-black/30 px-2 py-0.5 rounded-full border border-white/5">
                    #{s.cat}
                  </span>
                  {followed[s.name] ? (
                    <button 
                      onClick={() => toggleFollow(s.name)}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                    >
                      <Check className="w-3 h-3" /> 已复制
                    </button>
                  ) : (
                    <button 
                      onClick={() => toggleFollow(s.name)}
                      className="text-[11px] font-bold text-black bg-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all px-4 py-1.5 rounded-lg"
                    >
                      跟单
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Section 2: Smart Decisions */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, type: "spring" }}
          className="px-4 py-4 relative z-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">智能决策</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: TrendingUp, iconColor: "text-emerald-400", title: "动量突破", desc: "BTC链上资金流入连续3日正向，看涨信号强烈", score: 82 },
              { icon: BarChart2, iconColor: "text-amber-400", title: "情绪指标", desc: "市场恐慌指数降至38，历史底部区间", score: 76 },
              { icon: Shield, iconColor: "text-orange-400", title: "风险预警", desc: "ETH期权隐含波动率上升，注意仓位风险", score: 68 },
              { icon: Zap, iconColor: "text-white/80", title: "套利机会", desc: "Polymarket vs Kalshi价差扩大，跨平台套利窗口", score: 91 },
            ].map((d, i) => (
              <div key={i} className="glass-panel p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-white/10 p-1.5 rounded-md border border-white/5">
                      <d.icon className={`w-3.5 h-3.5 ${d.iconColor}`} />
                    </div>
                    <span className="text-xs font-bold text-white/90">{d.title}</span>
                  </div>
                  <p className="text-[10px] text-white/60 leading-relaxed mb-4 line-clamp-2">{d.desc}</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/50">胜率</span>
                    <span className="font-bold text-amber-400">{d.score}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${d.score}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Section 3: Leaderboard */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, type: "spring" }}
          className="px-4 py-4 relative z-10"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white tracking-wide">持仓评分榜</h2>
            </div>
            <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">本周排行</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {[
              { rank: 1, name: "CryptoLeader Alpha", initials: "CA", color: "bg-amber-500/20 text-amber-400 border border-amber-500/30", score: "9.8", pnl: "+34.2%", width: "98%" },
              { rank: 2, name: "NewsArb Pro", initials: "NP", color: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30", score: "9.4", pnl: "+28.7%", width: "94%" },
              { rank: 3, name: "AI Oracle Bot", initials: "AO", color: "bg-orange-500/20 text-orange-400 border border-orange-500/30", score: "8.9", pnl: "+21.3%", width: "89%" },
              { rank: 4, name: "DeFi Maximalist", initials: "DM", color: "bg-white/10 text-white/80 border border-white/20", score: "8.2", pnl: "+15.8%", width: "82%" },
              { rank: 5, name: "Momentum Trader", initials: "MT", color: "bg-red-500/20 text-red-400 border border-red-500/30", score: "7.6", pnl: "+9.4%", width: "76%" },
            ].map((l, i) => (
              <div 
                key={i} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  l.rank === 1 ? 'glass-panel-strong shadow-[0_0_15px_rgba(245,158,11,0.15)] relative overflow-hidden' : 'glass-panel'
                }`}
              >
                {l.rank === 1 && <div className="shimmer-sweep opacity-50"></div>}
                
                <div className={`w-6 text-center text-sm font-black italic relative z-10 ${
                  l.rank === 1 ? 'text-amber-400 text-base drop-shadow-md' : 
                  l.rank === 2 ? 'text-white/80' : 
                  l.rank === 3 ? 'text-orange-400' : 'text-white/40'
                }`}>
                  {l.rank}
                </div>
                
                <div className="flex items-center gap-3 flex-1 min-w-0 relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${l.color}`}>
                    {l.initials}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="text-sm font-bold text-white/90 truncate">{l.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1.5 flex-1 bg-black/40 rounded-full overflow-hidden max-w-[100px] border border-white/5">
                        <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full" style={{ width: l.width }} />
                      </div>
                      <span className="text-[10px] font-bold text-amber-400">{l.score}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm font-bold text-emerald-400 shrink-0 relative z-10 drop-shadow-sm">
                  {l.pnl}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}

export default CopyTradingSignals;
