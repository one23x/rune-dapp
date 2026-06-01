import React, { useState } from 'react';
import { 
  Lock, Zap, TrendingUp, ChevronRight, Check, ShoppingCart, Crown, Shield, Sparkles, 
  ToggleLeft, ToggleRight, ArrowRight, Settings, ChevronDown 
} from 'lucide-react';

export function CopyTradingStrategy() {
  const [autoCopy, setAutoCopy] = useState(true);
  const [aiFilter, setAiFilter] = useState(true);

  return (
    <div className="min-h-screen bg-[#0d0b08] text-zinc-300 font-sans overflow-x-hidden pb-10">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Strategy & Tiers</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your membership, limits, and AI decisions.</p>
        </div>

        {/* 1. Current Status Card */}
        <section>
          <div className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-black to-black p-6 overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-amber-500/5 blur-[100px] rounded-full pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-xs font-medium">
                  <Crown className="w-3.5 h-3.5" />
                  Pro 会员
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  L2 策略包激活中
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-zinc-400">今日跟单</span>
                    <span className="text-sm font-medium text-white">8 / <span className="text-zinc-500">15 次</span></span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-400 w-[53%] rounded-full"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-zinc-400">AI 决策剩余</span>
                    <span className="text-sm font-medium text-amber-400">23 / <span className="text-amber-700">50 次</span></span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-[46%] rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                <button className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center transition-colors">
                  升级会员 <ArrowRight className="w-3 h-3 ml-1" />
                </button>
                <button className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center transition-colors">
                  购买决策包 <ArrowRight className="w-3 h-3 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. 策略包选择 */}
        <section className="space-y-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-white">策略包</h2>
            <span className="text-xs text-zinc-500">选择并激活</span>
          </div>

          <div className="space-y-3">
            {/* L1 */}
            <div className="flex items-center p-4 rounded-xl border border-white/5 bg-white/5 opacity-70 transition-all">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold mr-4">
                L1
              </div>
              <div className="flex-1">
                <div className="text-lg font-medium text-white">$100<span className="text-xs text-zinc-500 ml-1">/日</span></div>
                <div className="text-xs text-zinc-500">$2,000 /月</div>
              </div>
              <div className="text-xs text-zinc-500">已解锁</div>
            </div>

            {/* L2 Active */}
            <div className="flex items-center p-4 rounded-xl border border-amber-500/40 bg-amber-500/5 transition-all shadow-[0_0_20px_rgba(245,158,11,0.05)]">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold mr-4">
                L2
              </div>
              <div className="flex-1">
                <div className="text-lg font-medium text-amber-500">$200<span className="text-xs text-amber-500/50 ml-1">/日</span></div>
                <div className="text-xs text-amber-500/70">$5,000 /月</div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs">
                <Check className="w-3 h-3" /> 激活中
              </div>
            </div>

            {/* L3 Locked */}
            <div className="flex items-center p-4 rounded-xl border border-white/5 bg-black/40 transition-all">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold mr-4 opacity-50">
                L3
              </div>
              <div className="flex-1 opacity-50">
                <div className="text-lg font-medium text-white">$500<span className="text-xs text-zinc-500 ml-1">/日</span></div>
                <div className="text-xs text-zinc-500">$10,000 /月</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center text-xs text-zinc-500">
                  <Lock className="w-3 h-3 mr-1" /> 需要 Elite
                </div>
                <button className="text-[10px] px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors">
                  用积分临时升级 ↗
                </button>
              </div>
            </div>

            {/* L4 Locked */}
            <div className="flex items-center p-4 rounded-xl border border-white/5 bg-black/40 transition-all">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 font-bold mr-4 opacity-50">
                L4
              </div>
              <div className="flex-1 opacity-50">
                <div className="text-lg font-medium text-white">$1,000<span className="text-xs text-zinc-500 ml-1">/日</span></div>
                <div className="text-xs text-zinc-500">$100,000 /月</div>
              </div>
              <div className="flex items-center text-xs text-zinc-500">
                <Lock className="w-3 h-3 mr-1" /> 需要 机构
              </div>
            </div>

            {/* L5 Locked */}
            <div className="flex items-center p-4 rounded-xl border border-white/5 bg-black/40 transition-all">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 font-bold mr-4 opacity-50">
                L5
              </div>
              <div className="flex-1 opacity-50">
                <div className="text-lg font-medium text-white">$2,000<span className="text-xs text-zinc-500 ml-1">/日</span></div>
                <div className="text-xs text-zinc-500">$200,000 /月</div>
              </div>
              <div className="flex items-center text-xs text-zinc-500">
                <Lock className="w-3 h-3 mr-1" /> 需要 机构
              </div>
            </div>
          </div>
        </section>

        {/* 3. AI 决策包 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white flex items-center">
              AI 决策包 <Zap className="w-4 h-4 ml-1.5 text-amber-400" />
            </h2>
            <span className="text-xs text-zinc-500">提升跟单可信度</span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/5 text-sm text-zinc-400 leading-relaxed">
            <p className="mb-3">AI 决策引擎会分析每条跟单信号，自动跳过低可信度订单，让你的跟单更稳定。决策次数越多，过滤越精准。</p>
            <div className="font-mono text-xs flex flex-wrap items-center gap-2 text-zinc-500 bg-black/50 p-2 rounded-lg border border-white/5">
              <span className="text-zinc-300">[信号源 12条]</span> 
              <ArrowRight className="w-3 h-3" /> 
              <span className="text-red-400">[AI过滤 ✕3跳过]</span> 
              <ArrowRight className="w-3 h-3" /> 
              <span className="text-green-400">[执行 9条]</span> 
              <ArrowRight className="w-3 h-3" /> 
              <span className="text-amber-400">可信度 ↑87%</span>
            </div>
          </div>

          <div className="flex flex-col items-center py-6 border-b border-white/5">
            <div className="relative w-32 h-32 mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle 
                  cx="50" cy="50" r="45" 
                  fill="none" 
                  stroke="rgba(255,255,255,0.05)" 
                  strokeWidth="8"
                />
                <circle 
                  cx="50" cy="50" r="45" 
                  fill="none" 
                  stroke="#f59e0b" 
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * 23) / 50}
                  className="drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white tracking-tighter">23<span className="text-sm text-zinc-500 font-normal">/50</span></span>
              </div>
            </div>
            <div className="text-sm font-medium text-zinc-300 mb-1">本月决策剩余</div>
            <div className="text-xs text-amber-500/70 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              已过滤 4 条低质量信号 · 节省 $180
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium text-white">购买决策包</h3>
              <span className="text-xs text-zinc-400 font-mono">我的积分: <span className="text-amber-400">680 pts</span></span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col hover:border-white/10 transition-colors">
                <div className="text-zinc-400 text-xs mb-1">基础包</div>
                <div className="text-xl font-bold text-white mb-4">+50 <span className="text-xs text-zinc-500 font-normal">次</span></div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-300">200 积分</span>
                  <button className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors">购买</button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/5 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                  🔥 推荐
                </div>
                <div className="text-amber-500/70 text-xs mb-1">标准包</div>
                <div className="text-xl font-bold text-amber-400 mb-4">+150 <span className="text-xs text-amber-500/50 font-normal">次</span></div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-xs font-mono text-amber-400">500 积分</span>
                  <button className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs rounded-lg transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]">购买</button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col relative overflow-hidden hover:border-white/10 transition-colors">
                <div className="absolute top-0 right-0 bg-zinc-700 text-zinc-300 text-[10px] font-medium px-2 py-0.5 rounded-bl-lg flex items-center">
                  <Zap className="w-3 h-3 mr-0.5" /> 最优惠
                </div>
                <div className="text-zinc-400 text-xs mb-1">高级包</div>
                <div className="text-xl font-bold text-white mb-4">+500 <span className="text-xs text-zinc-500 font-normal">次</span></div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-300">1,500 积分</span>
                  <button className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors">购买</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. 跟单配置 */}
        <section className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Settings className="w-4 h-4 mr-2 text-zinc-400" />
              跟单配置
            </h2>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="text-sm font-medium text-white">自动跟单模式</div>
              <button onClick={() => setAutoCopy(!autoCopy)} className="focus:outline-none">
                {autoCopy ? <ToggleRight className="w-8 h-8 text-amber-500" /> : <ToggleLeft className="w-8 h-8 text-zinc-600" />}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="text-sm font-medium text-white">AI 过滤开启</div>
              <button onClick={() => setAiFilter(!aiFilter)} className="focus:outline-none">
                {aiFilter ? <ToggleRight className="w-8 h-8 text-amber-500" /> : <ToggleLeft className="w-8 h-8 text-zinc-600" />}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="text-sm font-medium text-white">最低可信度阈值</div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black rounded-lg border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                <span className="text-sm font-medium text-amber-400">70%</span>
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="text-sm font-medium text-white">当前跟单交易员</div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-400">3 位</span>
                <button className="text-xs text-amber-500 hover:text-amber-400 flex items-center transition-colors">
                  管理 ↗
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 5. 会员等级对比 */}
        <section className="pt-4 border-t border-white/5">
          <div className="mb-4">
            <button className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-white/5 text-sm text-zinc-400 hover:text-zinc-300 transition-colors">
              <span>查看完整会员权益对比</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr>
                  <th className="py-3 px-4 font-normal text-zinc-500 border-b border-white/5 w-1/5"></th>
                  <th className="py-3 px-4 font-medium text-zinc-400 border-b border-white/5 w-1/5 text-center">Free</th>
                  <th className="py-3 px-4 font-medium text-amber-500 border-b border-amber-500/30 bg-amber-500/5 rounded-t-lg w-1/5 text-center">Pro</th>
                  <th className="py-3 px-4 font-medium text-zinc-400 border-b border-white/5 w-1/5 text-center">Elite</th>
                  <th className="py-3 px-4 font-medium text-zinc-400 border-b border-white/5 w-1/5 text-center">机构</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr>
                  <td className="py-3 px-4 border-b border-white/5 text-zinc-400">日跟单次</td>
                  <td className="py-3 px-4 border-b border-white/5 text-center">3</td>
                  <td className="py-3 px-4 border-b border-amber-500/10 bg-amber-500/5 text-amber-400 text-center font-medium">15</td>
                  <td className="py-3 px-4 border-b border-white/5 text-center">50</td>
                  <td className="py-3 px-4 border-b border-white/5 text-center">无限</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 border-b border-white/5 text-zinc-400">AI决策</td>
                  <td className="py-3 px-4 border-b border-white/5 text-center">5</td>
                  <td className="py-3 px-4 border-b border-amber-500/10 bg-amber-500/5 text-amber-400 text-center font-medium">50</td>
                  <td className="py-3 px-4 border-b border-white/5 text-center">200</td>
                  <td className="py-3 px-4 border-b border-white/5 text-center">无限</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 border-b border-white/5 text-zinc-400">策略包</td>
                  <td className="py-3 px-4 border-b border-white/5 text-center text-zinc-500">L1</td>
                  <td className="py-3 px-4 border-b border-amber-500/10 bg-amber-500/5 text-amber-400 text-center font-medium">L2</td>
                  <td className="py-3 px-4 border-b border-white/5 text-center text-indigo-400">L3</td>
                  <td className="py-3 px-4 border-b border-white/5 text-center text-red-400">L5</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-zinc-400">月上限</td>
                  <td className="py-3 px-4 text-center text-zinc-500">$2K</td>
                  <td className="py-3 px-4 bg-amber-500/5 text-amber-400 text-center font-medium rounded-b-lg border-b border-amber-500/30">$5K</td>
                  <td className="py-3 px-4 text-center">$10K</td>
                  <td className="py-3 px-4 text-center">$200K</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
