import React from 'react';
import { Power, Activity, Settings, Plus, Pencil, Pause, Play, ShieldAlert, ShieldCheck, Shield } from 'lucide-react';

export function CopyTradingStrategy() {
  return (
    <div className="min-h-screen bg-[#0d0b08] text-zinc-300 font-sans overflow-x-hidden pb-8 px-4 pt-6 max-w-[390px] mx-auto">
      
      {/* 1. Engine Status Banner */}
      <div className="relative rounded-2xl p-[1px] bg-gradient-to-r from-amber-500/40 via-amber-700/20 to-[#1c1812] mb-6">
        <div className="absolute inset-0 bg-amber-500/10 blur-xl rounded-2xl"></div>
        <div className="relative bg-[#13100a] rounded-2xl p-4 flex items-center justify-between shadow-lg border border-amber-900/30">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500" />
              <h2 className="text-zinc-100 font-semibold text-lg">One-Agents 引擎</h2>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                <span className="text-emerald-400 text-[10px] font-medium tracking-wide">运行中</span>
              </div>
            </div>
            <p className="text-zinc-500 text-sm flex items-center gap-1">
              跟单中 <span className="w-1 h-1 rounded-full bg-zinc-700"></span> 3 个活跃策略
            </p>
          </div>
          <div className="flex flex-col items-end justify-center">
            {/* Custom Toggle Switch */}
            <div className="w-12 h-6 bg-amber-500/20 rounded-full relative cursor-pointer border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              <div className="absolute right-1 top-1 w-4 h-4 bg-amber-500 rounded-full shadow-sm"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Strategy Configuration Cards */}
      <div className="space-y-4 mb-6">
        
        {/* Card A */}
        <div className="bg-[#13100a] border border-white/5 rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] rounded-full pointer-events-none"></div>
          
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-[#0d0b08]">
                CL
              </div>
              <div>
                <h3 className="text-zinc-100 font-medium leading-tight">Crypto Leader Alpha</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md border border-amber-400/20 font-medium">
                    胜率 71%
                  </span>
                  <span className="text-[10px] text-zinc-500">高频趋势</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]"></div>
              <span className="text-emerald-400 text-[10px] font-medium">跟单中</span>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-zinc-400">分配资金</span>
                <span className="text-amber-400 font-medium">$3,000 pUSD</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 w-[60%] rounded-full relative">
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/30"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">风险等级</span>
              <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md text-xs border border-amber-400/20">
                <Shield className="w-3 h-3" />
                中等
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 bg-black/20 p-2.5 rounded-xl border border-white/5">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500">Copied Trades</span>
              <span className="text-zinc-200 font-medium text-sm">24</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500">Avg PnL</span>
              <span className="text-emerald-400 font-medium text-sm">+8.2%</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-300 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 border border-white/5">
              <Pencil className="w-4 h-4" />
              编辑参数
            </button>
            <button className="flex-1 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 border border-white/5">
              <Pause className="w-4 h-4" />
              暂停
            </button>
          </div>
        </div>

        {/* Card B */}
        <div className="bg-[#13100a] border border-white/5 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-[#0d0b08]">
                AI
              </div>
              <div>
                <h3 className="text-zinc-100 font-medium leading-tight">AI Signals Bot</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md border border-amber-400/20 font-medium">
                    胜率 64%
                  </span>
                  <span className="text-[10px] text-zinc-500">量化网格</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]"></div>
              <span className="text-emerald-400 text-[10px] font-medium">跟单中</span>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-zinc-400">分配资金</span>
                <span className="text-amber-400 font-medium">$2,000 pUSD</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 w-[40%] rounded-full relative">
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/30"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">风险等级</span>
              <div className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md text-xs border border-emerald-400/20">
                <ShieldCheck className="w-3 h-3" />
                保守
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 bg-black/20 p-2.5 rounded-xl border border-white/5">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500">Copied Trades</span>
              <span className="text-zinc-200 font-medium text-sm">18</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500">Avg PnL</span>
              <span className="text-emerald-400 font-medium text-sm">+5.4%</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-300 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 border border-white/5">
              <Pencil className="w-4 h-4" />
              编辑参数
            </button>
            <button className="flex-1 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 border border-white/5">
              <Pause className="w-4 h-4" />
              暂停
            </button>
          </div>
        </div>

        {/* Card C - Paused */}
        <div className="bg-[#13100a]/60 border border-white/5 rounded-2xl p-4 relative overflow-hidden opacity-80 mix-blend-luminosity hover:mix-blend-normal hover:opacity-100 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-[#0d0b08] grayscale">
                NA
              </div>
              <div>
                <h3 className="text-zinc-300 font-medium leading-tight">News Arbitrage</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 rounded-md border border-white/5 font-medium">
                    胜率 58%
                  </span>
                  <span className="text-[10px] text-zinc-500">事件驱动</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded-full border border-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500"></div>
              <span className="text-zinc-400 text-[10px] font-medium">已暂停</span>
            </div>
          </div>

          <div className="space-y-3 mb-4 grayscale">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-zinc-500">分配资金</span>
                <span className="text-zinc-400 font-medium">$1,500 pUSD</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-600 w-[30%] rounded-full"></div>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">风险等级</span>
              <div className="flex items-center gap-1 text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-md text-xs border border-rose-400/20">
                <ShieldAlert className="w-3 h-3" />
                积极
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 bg-black/20 p-2.5 rounded-xl border border-white/5 grayscale">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-600">Copied Trades</span>
              <span className="text-zinc-400 font-medium text-sm">5</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-600">Avg PnL</span>
              <span className="text-emerald-500/50 font-medium text-sm">+2.1%</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-300 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 border border-white/5">
              <Pencil className="w-4 h-4" />
              编辑参数
            </button>
            <button className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 border border-amber-500/20">
              <Play className="w-4 h-4 fill-current" />
              恢复
            </button>
          </div>
        </div>

      </div>

      {/* 3. Add Strategy Button */}
      <button className="w-full border-2 border-dashed border-amber-500/20 hover:border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 rounded-2xl py-4 flex items-center justify-center gap-2 font-medium transition-all mb-8 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
        <Plus className="w-5 h-5" />
        添加新策略
      </button>

      {/* 4. Global Risk Settings */}
      <div className="bg-[#13100a] border border-white/5 rounded-2xl overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 bg-white/[0.02]">
          <Settings className="w-4 h-4 text-zinc-400" />
          <h3 className="text-zinc-200 font-medium text-sm">风控设置</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between group">
            <span className="text-zinc-400 text-sm">Max single trade</span>
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <span className="text-amber-400 font-mono text-sm">$500 pUSD</span>
              <Pencil className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 transition-colors" />
            </div>
          </div>
          <div className="flex items-center justify-between group">
            <span className="text-zinc-400 text-sm">Daily loss limit</span>
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <span className="text-amber-400 font-mono text-sm">$800 pUSD</span>
              <Pencil className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 transition-colors" />
            </div>
          </div>
          <div className="flex items-center justify-between group">
            <span className="text-zinc-400 text-sm">Stop-copy drawdown</span>
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <span className="text-amber-400 font-mono text-sm">15%</span>
              <Pencil className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 transition-colors" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom note */}
      <div className="text-center px-4 pb-4">
        <p className="text-[11px] text-zinc-600 flex items-center justify-center gap-1.5">
          策略由 One-Agents 引擎自动执行
          <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
          Polymarket pUSD 结算
        </p>
      </div>

    </div>
  );
}
