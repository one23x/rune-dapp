import React, { useState } from 'react';
import { 
  Check, 
  ChevronRight, 
  Settings, 
  TrendingUp,
  Activity,
  Zap,
  CheckCircle2,
  Users,
  Wallet
} from 'lucide-react';

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
      color: "bg-blue-500/20 text-blue-400",
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
      color: "bg-emerald-500/20 text-emerald-400",
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
      color: "bg-rose-500/20 text-rose-400",
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
      color: "bg-amber-500/20 text-amber-400",
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
    <div className="min-h-screen bg-[#0d0b08] text-zinc-300 font-sans overflow-x-hidden selection:bg-[#f59e0b]/30">
      <div className="max-w-[390px] mx-auto bg-[#0d0b08] min-h-screen relative shadow-2xl border-x border-white/5 pb-24">
        
        {/* Header Section */}
        <header className="px-4 pt-5 pb-4 relative overflow-hidden bg-gradient-to-b from-[#f59e0b]/8 to-transparent border-b border-white/5">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#f59e0b]/40 to-transparent"></div>
          <div className="absolute -top-12 right-0 w-40 h-40 bg-[#f59e0b]/8 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight leading-tight">跟单策略</h1>
              <p className="text-[11px] text-zinc-500 mt-0.5">配置跟单参数并选择策略</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
              </div>
              <span className="text-[11px] font-medium text-[#10b981]">Engine Live</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">账户净值</p>
              <p className="text-sm font-semibold text-white">$12,450</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">未实现盈亏</p>
              <p className="text-sm font-semibold text-[#10b981]">+$450</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">跟单中</p>
              <p className="text-sm font-semibold text-white">2</p>
            </div>
          </div>
        </header>

        {/* Configuration Section */}
        <div className="p-4 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">参数配置</h2>
          </div>

          <div className="space-y-4">
            {/* Allocation */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">跟单比例 (仓位占比)</span>
                <span className="text-xs font-mono text-[#f59e0b]">{allocation}</span>
              </div>
              <div className="flex gap-2">
                {['5%', '10%', '25%', '50%'].map(val => (
                  <button
                    key={val}
                    onClick={() => setAllocation(val)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                      allocation === val 
                        ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]' 
                        : 'bg-[#15120d] border-white/5 text-zinc-400 hover:bg-white/[0.04]'
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
                <span className="text-xs text-zinc-400">杠杆倍数</span>
                <span className="text-xs font-mono text-[#f59e0b]">{leverage}</span>
              </div>
              <div className="flex gap-2">
                {['2x', '3x', '5x', '10x'].map(val => (
                  <button
                    key={val}
                    onClick={() => setLeverage(val)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                      leverage === val 
                        ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]' 
                        : 'bg-[#15120d] border-white/5 text-zinc-400 hover:bg-white/[0.04]'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* TP / SL */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <span className="text-xs text-zinc-400">止盈 %</span>
                <div className="flex gap-1 bg-[#15120d] border border-white/5 rounded-lg p-1">
                  {['20%', '50%', '100%'].map(val => (
                    <button
                      key={val}
                      onClick={() => setTakeProfit(val)}
                      className={`flex-1 py-1.5 text-[10px] font-medium rounded transition-all ${
                        takeProfit === val ? 'bg-[#2a261c] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-zinc-400">止损 %</span>
                <div className="flex gap-1 bg-[#15120d] border border-white/5 rounded-lg p-1">
                  {['10%', '20%', '50%'].map(val => (
                    <button
                      key={val}
                      onClick={() => setStopLoss(val)}
                      className={`flex-1 py-1.5 text-[10px] font-medium rounded transition-all ${
                        stopLoss === val ? 'bg-[#2a261c] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-white/5 my-2"></div>

        {/* Strategy Selection Section */}
        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-white">选择策略</h2>
            </div>
            <span className="text-[10px] text-zinc-500 bg-white/5 px-2 py-0.5 rounded">可多选</span>
          </div>

          <div className="space-y-3">
            {traders.map(trader => {
              const isSelected = selectedTraders.includes(trader.id);
              return (
                <div 
                  key={trader.id}
                  onClick={() => toggleTrader(trader.id)}
                  className={`bg-[#15120d] rounded-xl p-4 cursor-pointer transition-all border ${
                    isSelected 
                      ? 'border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                      : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${trader.color}`}>
                        {trader.initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white">{trader.name}</span>
                          <CheckCircle2 className="w-3 h-3 text-[#10b981]" />
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 flex gap-2">
                          <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {trader.followers}</span>
                          <span className="flex items-center gap-0.5"><Wallet className="w-3 h-3" /> AUM: {trader.aum}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                      isSelected ? 'bg-[#f59e0b] border-[#f59e0b] text-black' : 'border-white/10 text-transparent'
                    }`}>
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase">ROI (30d)</p>
                      <p className="text-xs font-bold text-[#10b981]">{trader.roi}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase">胜率</p>
                      <p className="text-xs font-bold text-white">{trader.winRate}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase">最大回撤</p>
                      <p className="text-xs font-bold text-[#ef4444]">{trader.drawdown}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky Bottom Action */}
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-8 bg-gradient-to-t from-[#0d0b08] via-[#0d0b08] to-transparent pointer-events-none">
          <div className="max-w-[390px] mx-auto pointer-events-auto">
            <button 
              disabled={selectedTraders.length === 0}
              className={`w-full relative overflow-hidden rounded-xl font-bold text-sm py-4 flex items-center justify-center gap-2 transition-all ${
                selectedTraders.length > 0 
                  ? 'bg-[#f59e0b] text-black shadow-[0_0_20px_rgba(245,158,11,0.35)] active:scale-[0.98]' 
                  : 'bg-white/10 text-zinc-500 cursor-not-allowed'
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