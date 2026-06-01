import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Copy, User, TrendingUp, Coins, Flame, Layers, 
  Wallet, Share2, Server, ArrowLeftRight, Bell, Settings, ChevronRight
} from 'lucide-react';
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

// --- Main Page Component ---

export function Profile() {
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
        
        {/* Header */}
        <header className="px-5 pt-12 pb-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                <User className="text-white/80" size={24} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg font-bold tracking-tight text-white drop-shadow-md">0x7A3...4F9c</h1>
                <button className="text-white/50 hover:text-white/90 transition-colors">
                  <Copy size={14} />
                </button>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300">
                <Server size={10} />
                <span className="text-[10px] font-bold tracking-wider">SUPER</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="px-5 space-y-4 relative z-10">
          
          {/* Total Earnings Hero Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, type: "spring" }}
            className="glass-panel-strong p-5 relative overflow-hidden"
          >
            <div className="shimmer-sweep"></div>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-amber-400" />
                <h3 className="text-white/90 text-sm font-medium">总收益 / Total Earnings</h3>
              </div>
              <div className="flex gap-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">USDT</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-500/30 text-orange-300">FIRE</span>
              </div>
            </div>
            
            <div className="text-4xl font-bold text-white tracking-tight mb-4 drop-shadow-md">
              <AnimatedNumber value={12548.50} prefix="$" decimals={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/20 border border-white/10 rounded-xl p-3 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-white/70">质押收益 / Staking</span>
                  <span className="text-[8px] bg-white/10 px-1 py-0.5 rounded text-white/50">预发布</span>
                </div>
                <div className="text-lg font-bold text-emerald-400 mb-1">
                  <AnimatedNumber value={0} prefix="$" decimals={2} />
                </div>
                <div className="text-[9px] text-white/40">USDT 65% / FIRE 35%</div>
              </div>

              <div className="bg-black/20 border border-white/10 rounded-xl p-3 relative overflow-hidden group hover:border-amber-500/30 transition-colors">
                <div className="text-xs text-white/70 mb-2">推广收益 / Referral</div>
                <div className="text-lg font-bold text-white mb-1">
                  <AnimatedNumber value={12548.50} prefix="$" decimals={2} />
                </div>
                <div className="text-[9px] text-white/40">USDT 已发放</div>
              </div>
            </div>
          </motion.div>

          {/* Copy-Trading Summary Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, type: "spring" }}
            className="glass-panel p-5 relative overflow-hidden"
          >
            <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-amber-500/20 blur-3xl rounded-full pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-amber-400" />
                <h3 className="text-white/90 text-sm font-medium">跟单 / Copy-Trading</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" style={{ animation: 'pulse-ring 2s infinite' }}></div>
                <span className="text-[10px] text-emerald-400 font-medium tracking-wider">LIVE</span>
              </div>
            </div>

            <div className="flex justify-between items-end mb-4 relative z-10">
              <div>
                <div className="text-xs text-white/50 mb-1">HL 账户价值 / HL Account</div>
                <div className="text-2xl font-bold text-white"><AnimatedNumber value={4250.75} prefix="$" decimals={2} /></div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/50 mb-1">pUSD 余额</div>
                <div className="text-sm font-medium text-white/90"><AnimatedNumber value={1200.00} prefix="$" decimals={2} /></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10 relative z-10">
              <div className="text-center">
                <div className="text-sm font-bold text-emerald-400">+$845.20</div>
                <div className="text-[9px] text-white/40 mt-1 uppercase">Realized PnL</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-white">68%</div>
                <div className="text-[9px] text-white/40 mt-1 uppercase">Win Rate</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-white">124</div>
                <div className="text-[9px] text-white/40 mt-1 uppercase">Trades</div>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-center text-white/50 relative z-10">
              当前跟单数: <span className="text-white">12</span> / Follows
            </div>
          </motion.div>

          {/* Referral CTA Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, type: "spring" }}
            className="glass-panel p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <User size={16} className="text-amber-400" />
              <h3 className="text-white/90 text-sm font-medium">邀请好友 / Invite friends</h3>
            </div>
            <p className="text-xs text-white/60 mb-4 leading-relaxed">
              邀请好友购买节点或参与金库，获取高额推荐奖励。
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 flex items-center justify-between overflow-hidden">
                <span className="text-xs text-white/40 truncate mr-2">rune.com/ref/0x7A3...</span>
                <button className="text-white/80 hover:text-white transition-colors shrink-0">
                  <Copy size={14} />
                </button>
              </div>
              <button className="px-4 py-2 rounded-lg bg-[#f59e0b] text-black font-medium text-xs glass-button flex items-center justify-center">
                <Share2 size={14} />
              </button>
            </div>
          </motion.div>

          {/* Settings Menu List */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, type: "spring" }}
            className="glass-panel overflow-hidden"
          >
            <div className="flex flex-col">
              <button className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:bg-white/20 transition-colors">
                    <Server size={14} />
                  </div>
                  <span className="text-sm text-white/90 font-medium">我的节点 / Nodes</span>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
              </button>
              
              <button className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:bg-white/20 transition-colors">
                    <Layers size={14} />
                  </div>
                  <span className="text-sm text-white/90 font-medium">我的金库持仓 / Vault Positions</span>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
              </button>

              <button className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:bg-white/20 transition-colors">
                    <ArrowLeftRight size={14} />
                  </div>
                  <span className="text-sm text-white/90 font-medium">兑换 / Swap</span>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
              </button>

              <button className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:bg-white/20 transition-colors relative">
                    <Bell size={14} />
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                  </div>
                  <span className="text-sm text-white/90 font-medium">通知 / Notifications</span>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
              </button>

              <button className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:bg-white/20 transition-colors">
                    <Settings size={14} />
                  </div>
                  <span className="text-sm text-white/90 font-medium">设置 / Settings</span>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
              </button>
            </div>
          </motion.div>

        </main>
      </div>
    </div>
  );
}

export default Profile;