import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Layers, Lock, Flame, Info, TrendingUp, ChevronRight, Check } from 'lucide-react';
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

function PoolTab() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, type: "spring" }}
      className="space-y-4"
    >
      {/* TVL Hero Card */}
      <div className="glass-panel-strong p-5 relative overflow-hidden">
        <div className="shimmer-sweep"></div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-white/80 text-sm font-medium">金库净值 (TVL)</h3>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">
            <TrendingUp size={12} />
            <span>+12.4%</span>
          </div>
        </div>
        <div className="text-4xl font-bold text-white tracking-tight mb-1">
          <AnimatedNumber value={2450890.50} prefix="$" decimals={2} />
        </div>
        <div className="text-xs text-white/60">
          基于当前资金池深度计算
        </div>
      </div>

      {/* Progress Card */}
      <div className="glass-panel p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-white/90 text-sm font-medium">募资进度</h3>
          <span className="text-white font-bold text-sm">85%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3 relative">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "85%" }}
            transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 relative"
          >
            <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/50 blur-sm"></div>
          </motion.div>
        </div>
        <div className="flex justify-between text-xs text-white/60">
          <span>当前: $2.45M</span>
          <span>目标: $3M 触发启动</span>
        </div>
      </div>

      {/* Composition Card */}
      <div className="glass-panel p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white/90 text-sm font-medium">资产分布</h3>
          <span className="text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">APR 18.5%</span>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-xs">U</div>
              <div>
                <div className="text-sm font-medium text-white">USDT</div>
                <div className="text-xs text-white/50">Tether USD</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-white">65%</div>
              <div className="text-xs text-white/50">$1,593,078</div>
            </div>
          </div>
          
          <div className="h-[1px] bg-white/10"></div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 font-bold text-xs">R</div>
              <div>
                <div className="text-sm font-medium text-white">RUNE</div>
                <div className="text-xs text-white/50">Rune Token</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-white">35%</div>
              <div className="text-xs text-white/50">$857,812</div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10 flex items-start gap-2">
          <Info size={14} className="text-white/40 mt-0.5 shrink-0" />
          <p className="text-xs text-white/50 leading-relaxed">
            总入金 × 45% = 交易金库。剩余部分将注入流动性池以支持稳定兑换。
          </p>
        </div>
      </div>

      {/* Chart Card */}
      <div className="glass-panel p-5">
        <h3 className="text-white/90 text-sm font-medium mb-4">月度表现 (预计)</h3>
        
        <div className="h-32 flex items-end gap-1.5 relative">
          {/* Mock chart bars */}
          {[20, 25, 22, 28, 35, 32, 38, 42, 40, 45, 43, 48].map((val, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end group">
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${val}%`, opacity: 1 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="w-full bg-amber-400/30 rounded-t-sm group-hover:bg-amber-400/60 transition-colors relative"
              >
              </motion.div>
            </div>
          ))}
          
          {/* Mock line draw-in */}
          <motion.svg 
            className="absolute inset-0 w-full h-full drop-shadow-md"
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
          >
            <motion.path 
              d="M0,80 L8,75 L16,78 L25,72 L33,65 L41,68 L50,62 L58,58 L66,60 L75,55 L83,57 L92,52 L100,50" 
              fill="none" 
              stroke="#f59e0b" 
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
            />
          </motion.svg>
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-white/40">
          <span>1月</span>
          <span>6月</span>
          <span>12月</span>
        </div>
      </div>
    </motion.div>
  );
}

function LockTab() {
  const [selectedPeriod, setSelectedPeriod] = useState(90);
  const periods = [30, 90, 180, 365];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, type: "spring" }}
      className="space-y-4"
    >
      <div className="glass-panel p-5">
        <h3 className="text-white/90 text-sm font-medium mb-4">锁定 RUNE 获得收益</h3>
        
        <div className="bg-black/20 border border-white/10 rounded-xl p-4 mb-4">
          <div className="text-xs text-white/50 mb-1">输入数量</div>
          <div className="flex items-center justify-between">
            <input 
              type="text" 
              placeholder="0.00" 
              className="bg-transparent border-none text-2xl font-bold text-white outline-none w-1/2 placeholder:text-white/20"
            />
            <div className="flex items-center gap-2">
              <span className="text-white font-medium text-sm">RUNE</span>
              <button className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/80 hover:bg-white/20 transition-colors">MAX</button>
            </div>
          </div>
          <div className="text-xs text-white/40 mt-1">余额: 1,240.50 RUNE</div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-white/60 mb-2">选择锁定期</div>
          <div className="grid grid-cols-4 gap-2">
            {periods.map(p => (
              <button 
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                  selectedPeriod === p 
                    ? 'bg-[#f59e0b] text-black shadow-[0_0_15px_rgba(245,158,11,0.45)]' 
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                {p} 天
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 mb-5">
          <div className="text-sm text-white/80">预计 APR</div>
          <div className="text-lg font-bold text-emerald-400">
            {selectedPeriod === 30 ? '12.5%' : selectedPeriod === 90 ? '24.0%' : selectedPeriod === 180 ? '38.5%' : '55.0%'}
          </div>
        </div>

        <button className="w-full py-3.5 rounded-xl gold-button font-bold text-sm">
          确认锁仓
        </button>
      </div>

      <div className="glass-panel p-5 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/20 blur-3xl rounded-full"></div>
        <div className="flex items-center gap-2 mb-3">
          <Flame size={16} className="text-amber-400" />
          <h3 className="text-white/90 text-sm font-medium">预计收益结构</h3>
          <span className="text-[9px] bg-white/10 border border-white/10 px-1.5 py-0.5 rounded text-white/50 ml-auto">预发布</span>
        </div>
        
        <div className="flex h-4 rounded-full overflow-hidden mb-3">
          <div className="w-[65%] bg-emerald-400"></div>
          <div className="w-[35%] bg-orange-400"></div>
        </div>
        
        <div className="flex justify-between text-xs font-medium">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            USDT 65%
          </div>
          <div className="flex items-center gap-1.5 text-orange-400">
            <div className="w-2 h-2 rounded-full bg-orange-400"></div>
            FIRE 35%
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BurnTab() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, type: "spring" }}
      className="space-y-4"
    >
      <div className="glass-panel-strong p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center gap-3 mb-4 relative z-10">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
            <Flame size={20} className="text-orange-400" />
          </div>
          <div>
            <h3 className="text-white/80 text-sm font-medium">累计销毁 (FIRE)</h3>
            <div className="text-2xl font-bold text-white tracking-tight">
              <AnimatedNumber value={845200} decimals={0} />
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="bg-black/20 border border-white/10 rounded-lg p-3">
            <div className="text-xs text-white/50 mb-1">当前销毁率</div>
            <div className="text-sm font-bold text-white">4.2% / 月</div>
          </div>
          <div className="bg-black/20 border border-white/10 rounded-lg p-3">
            <div className="text-xs text-white/50 mb-1">流通量减少</div>
            <div className="text-sm font-bold text-emerald-400">-12.5%</div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-5">
        <h3 className="text-white/90 text-sm font-medium mb-4">销毁机制</h3>
        
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="mt-0.5 flex flex-col items-center">
              <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs">1</div>
              <div className="w-0.5 h-full bg-white/10 my-1"></div>
            </div>
            <div className="pb-3">
              <div className="text-sm font-medium text-white">协议回购</div>
              <div className="text-xs text-white/60 mt-1">金库产生的部分收益将用于在公开市场回购 FIRE 代币。</div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="mt-0.5 flex flex-col items-center">
              <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs">2</div>
              <div className="w-0.5 h-full bg-white/10 my-1"></div>
            </div>
            <div className="pb-3">
              <div className="text-sm font-medium text-white">永久销毁</div>
              <div className="text-xs text-white/60 mt-1">回购的代币将被发送至黑洞地址，永久退出流通，形成通缩效应。</div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="mt-0.5 flex flex-col items-center">
              <div className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-xs text-orange-400"><Check size={10} /></div>
            </div>
            <div>
              <div className="text-sm font-medium text-orange-400">价值提升</div>
              <div className="text-xs text-white/60 mt-1">随着流通量减少，剩余代币的价值捕获能力将持续增强。</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Main Page Component ---

export function Vault() {
  const [activeTab, setActiveTab] = useState<'pool' | 'lock' | 'burn'>('pool');

  return (
    <div className="min-h-screen bg-[#0c0a07] text-white font-sans overflow-x-hidden selection:bg-amber-500/30 relative">
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
          <div className="flex items-center justify-between">
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
                <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">金库</h1>
                <p className="text-xs text-white/70">协议流动性与收益中心</p>
              </div>
            </div>
            
            <a href="#" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white/90 hover:bg-white/20 transition-colors backdrop-blur-md">
              查看分析
              <ExternalLink size={12} className="opacity-70" />
            </a>
          </div>
        </header>

        {/* Tab Switcher */}
        <div className="px-5 mb-6 relative z-10">
          <div className="flex p-1 rounded-xl bg-black/20 backdrop-blur-md border border-white/10 relative">
            <div 
              className="absolute inset-y-1 rounded-lg bg-white/20 shadow-sm border border-white/20 transition-all duration-300 ease-out"
              style={{
                width: 'calc(33.333% - 5px)',
                left: activeTab === 'pool' ? '4px' : activeTab === 'lock' ? 'calc(33.333% + 1px)' : 'calc(66.666% - 2px)'
              }}
            ></div>
            
            <button 
              onClick={() => setActiveTab('pool')}
              className={`flex-1 py-2 text-xs font-medium z-10 transition-colors ${activeTab === 'pool' ? 'text-white' : 'text-white/60 hover:text-white/80'}`}
            >
              资金池
            </button>
            <button 
              onClick={() => setActiveTab('lock')}
              className={`flex-1 py-2 text-xs font-medium z-10 transition-colors ${activeTab === 'lock' ? 'text-white' : 'text-white/60 hover:text-white/80'}`}
            >
              锁仓
            </button>
            <button 
              onClick={() => setActiveTab('burn')}
              className={`flex-1 py-2 text-xs font-medium z-10 transition-colors ${activeTab === 'burn' ? 'text-white' : 'text-white/60 hover:text-white/80'}`}
            >
              销毁
            </button>
          </div>
        </div>

        {/* Content Area */}
        <main className="px-5 pb-10 relative z-10">
          <AnimatePresence mode="wait">
            {activeTab === 'pool' && <PoolTab key="pool" />}
            {activeTab === 'lock' && <LockTab key="lock" />}
            {activeTab === 'burn' && <BurnTab key="burn" />}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default Vault;