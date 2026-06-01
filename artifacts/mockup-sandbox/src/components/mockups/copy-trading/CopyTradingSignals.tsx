import React, { useState } from "react";
import { 
  Check, 
  TrendingUp, 
  Brain, 
  Shield, 
  BarChart2, 
  Zap, 
  Trophy, 
  CheckCircle2
} from "lucide-react";

export function CopyTradingSignals() {
  const [followed, setFollowed] = useState<Record<string, boolean>>({
    'CryptoLeader Alpha': true,
    'NewsArb Pro': true,
  });

  const toggleFollow = (name: string) => {
    setFollowed(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="min-h-screen bg-[#0d0b08] text-zinc-300 font-sans overflow-x-hidden pb-8">
      {/* Section 1 */}
      <section className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-2">
            <h2 className="text-lg font-bold text-white tracking-wide">跟单交易员信号</h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-[#15120d] px-2 py-1 rounded-full border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Updated 2min ago
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {[
            { name: "CryptoLeader Alpha", initials: "CA", color: "bg-blue-500/20 text-blue-400", dir: "BUY", dirColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", q: "Bitcoin > $150K by 2026?", score: "87%", time: "3m", cat: "Crypto", initFollow: true },
            { name: "AI Oracle Bot", initials: "AO", color: "bg-purple-500/20 text-purple-400", dir: "SELL", dirColor: "bg-red-500/10 text-red-500 border-red-500/20", q: "Fed rate cut before July?", score: "72%", time: "11m", cat: "Macro", initFollow: false },
            { name: "NewsArb Pro", initials: "NP", color: "bg-emerald-500/20 text-emerald-400", dir: "BUY", dirColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", q: "Ethereum ETF AUM > $10B?", score: "91%", time: "28m", cat: "Crypto", initFollow: true },
            { name: "DeFi Maximalist", initials: "DM", color: "bg-amber-500/20 text-amber-400", dir: "BUY", dirColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", q: "Solana flips ETH in DEX vol?", score: "64%", time: "1h", cat: "DeFi", initFollow: false },
          ].map((s, i) => (
            <div key={i} className="bg-[#15120d] border border-white/5 rounded-xl p-3 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.color}`}>
                    {s.initials}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-white truncate">{s.name}</span>
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.dirColor}`}>
                        {s.dir}
                      </span>
                      <span className="text-xs text-zinc-400 truncate">{s.q}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-sm font-bold text-amber-500">{s.score}</span>
                  <span className="text-[10px] text-zinc-500">{s.time}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[10px] font-medium text-zinc-500 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                  #{s.cat}
                </span>
                {followed[s.name] ? (
                  <button 
                    onClick={() => toggleFollow(s.name)}
                    className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20"
                  >
                    <Check className="w-3 h-3" /> 已复制
                  </button>
                ) : (
                  <button 
                    onClick={() => toggleFollow(s.name)}
                    className="text-[10px] font-bold text-black bg-amber-500 hover:bg-amber-400 transition-colors px-3 py-1 rounded-md"
                  >
                    跟单
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 */}
      <section className="px-4 py-4">
        <div className="flex items-center gap-2 mb-4 border-l-2 border-amber-500 pl-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <h2 className="text-lg font-bold text-white tracking-wide">智能决策</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: TrendingUp, iconColor: "text-emerald-500", title: "动量突破", desc: "BTC链上资金流入连续3日正向，看涨信号强烈", score: 82 },
            { icon: BarChart2, iconColor: "text-blue-500", title: "情绪指标", desc: "市场恐慌指数降至38，历史底部区间", score: 76 },
            { icon: Shield, iconColor: "text-amber-500", title: "风险预警", desc: "ETH期权隐含波动率上升，注意仓位风险", score: 68 },
            { icon: Zap, iconColor: "text-purple-500", title: "套利机会", desc: "Polymarket vs Kalshi价差扩大，跨平台套利窗口", score: 91 },
          ].map((d, i) => (
            <div key={i} className="bg-[#15120d] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <d.icon className={`w-3.5 h-3.5 ${d.iconColor}`} />
                  <span className="text-xs font-bold text-white">{d.title}</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight mb-3 line-clamp-2">{d.desc}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">胜率</span>
                  <span className="font-bold text-amber-500">{d.score}%</span>
                </div>
                <div className="h-1 w-full bg-black/50 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${d.score}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 */}
      <section className="px-4 py-4">
        <div className="flex items-center justify-between mb-4 border-l-2 border-amber-500 pl-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="text-lg font-bold text-white tracking-wide">持仓评分榜</h2>
          </div>
          <span className="text-[10px] text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">本周排行</span>
        </div>

        <div className="flex flex-col gap-2">
          {[
            { rank: 1, name: "CryptoLeader Alpha", initials: "CA", color: "bg-blue-500/20 text-blue-400", score: "9.8", pnl: "+34.2%", width: "98%" },
            { rank: 2, name: "NewsArb Pro", initials: "NP", color: "bg-emerald-500/20 text-emerald-400", score: "9.4", pnl: "+28.7%", width: "94%" },
            { rank: 3, name: "AI Oracle Bot", initials: "AO", color: "bg-purple-500/20 text-purple-400", score: "8.9", pnl: "+21.3%", width: "89%" },
            { rank: 4, name: "DeFi Maximalist", initials: "DM", color: "bg-amber-500/20 text-amber-400", score: "8.2", pnl: "+15.8%", width: "82%" },
            { rank: 5, name: "Momentum Trader", initials: "MT", color: "bg-rose-500/20 text-rose-400", score: "7.6", pnl: "+9.4%", width: "76%" },
          ].map((l, i) => (
            <div 
              key={i} 
              className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                l.rank === 1 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-[#15120d] border-white/5'
              }`}
            >
              <div className={`w-5 text-center text-sm font-bold ${
                l.rank === 1 ? 'text-amber-500' : 
                l.rank === 2 ? 'text-zinc-300' : 
                l.rank === 3 ? 'text-amber-700' : 'text-zinc-500'
              }`}>
                {l.rank === 1 ? '🥇' : l.rank}
              </div>
              
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${l.color}`}>
                  {l.initials}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="text-xs font-medium text-white truncate">{l.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1 flex-1 bg-black/50 rounded-full overflow-hidden max-w-[80px]">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: l.width }} />
                    </div>
                    <span className="text-[10px] font-bold text-amber-500">{l.score}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-sm font-bold text-emerald-500 shrink-0">
                {l.pnl}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
