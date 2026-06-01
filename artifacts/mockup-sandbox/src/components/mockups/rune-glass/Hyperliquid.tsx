import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Zap,
  Users,
  ShieldCheck,
  ChevronRight,
  BarChart2,
  TrendingUp,
  Layers,
  ExternalLink,
  Flame,
} from "lucide-react";
import "./_group.css";

// --- Helper: animated count-up number ---
function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1500;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if ((increment >= 0 && start >= end) || (increment < 0 && start <= end)) {
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

// --- Helper: gold sparkline ---
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const w = 96;
  const h = 34;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / range) * h;
    return [x, y];
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const stroke = "#f59e0b";
  const gradId = `spark-${positive ? "up" : "dn"}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" style={{ opacity: positive ? 1 : 0.55 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Vault {
  id: string;
  name: string;
  nameEn: string;
  tag: string;
  leader: string;
  apr: number;
  tvl: number;
  pnl30d: number;
  followers: number;
  commission: number;
  spark: number[];
  hot?: boolean;
}

const VAULTS: Vault[] = [
  {
    id: "alpha",
    name: "金库 A · Alpha",
    nameEn: "Vault A · Alpha",
    tag: "做市",
    leader: "0xc179...e0c8",
    apr: 63.42,
    tvl: 24_800_000,
    pnl30d: 1_840_000,
    followers: 12840,
    commission: 10,
    spark: [12, 14, 13, 16, 18, 17, 21, 23, 22, 26, 28, 31],
    hot: true,
  },
  {
    id: "hlp",
    name: "HLP · 协议金库",
    nameEn: "HLP · Protocol Vault",
    tag: "协议",
    leader: "0x0000...ffff",
    apr: 28.74,
    tvl: 182_400_000,
    pnl30d: 4_120_000,
    followers: 38210,
    commission: 0,
    spark: [40, 42, 41, 44, 46, 48, 47, 50, 53, 55, 58, 61],
    hot: true,
  },
  {
    id: "sigma",
    name: "金库 C · Sigma",
    nameEn: "Vault C · Sigma",
    tag: "高频",
    leader: "0x9a4f...12b7",
    apr: 88.91,
    tvl: 6_700_000,
    pnl30d: 740_000,
    followers: 3180,
    commission: 12,
    spark: [6, 7, 6.5, 8, 9, 11, 10, 12, 14, 13, 16, 19],
    hot: true,
  },
  {
    id: "beta",
    name: "金库 B · Beta",
    nameEn: "Vault B · Beta",
    tag: "趋势",
    leader: "0xd6e5...5b42",
    apr: 41.16,
    tvl: 12_300_000,
    pnl30d: 920_000,
    followers: 6420,
    commission: 10,
    spark: [20, 19, 21, 20, 22, 24, 23, 25, 24, 26, 28, 27],
  },
  {
    id: "delta",
    name: "金库 D · Delta",
    nameEn: "Vault D · Delta",
    tag: "对冲",
    leader: "0x3f81...aa09",
    apr: -7.42,
    tvl: 3_200_000,
    pnl30d: -120_000,
    followers: 1240,
    commission: 8,
    spark: [18, 17, 18, 16, 17, 15, 16, 14, 15, 13, 14, 13],
  },
];

const CATEGORIES = ["全部", "做市", "趋势", "协议", "高频", "对冲"];

function fmtUsd(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

export function Hyperliquid() {
  const [activeCategory, setActiveCategory] = useState("全部");

  const filtered = activeCategory === "全部" ? VAULTS : VAULTS.filter((v) => v.tag === activeCategory);

  const totalTvl = VAULTS.reduce((s, v) => s + v.tvl, 0);

  return (
    <div className="min-h-screen bg-[#0c0a07] text-white font-sans overflow-x-hidden selection:bg-amber-500/30 relative">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[50%] rounded-full opacity-60 blur-[100px]"
          style={{ background: "var(--orb-1)" }}
          animate={{ x: [0, 50, -20, 0], y: [0, -30, 40, 0], scale: [1, 1.1, 0.9, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-[20%] -right-[20%] w-[70%] h-[60%] rounded-full opacity-50 blur-[120px]"
          style={{ background: "var(--orb-2)" }}
          animate={{ x: [0, -40, 30, 0], y: [0, 50, -20, 0], scale: [1, 1.2, 0.8, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-[10%] left-[10%] w-[50%] h-[40%] rounded-full opacity-60 blur-[90px]"
          style={{ background: "var(--orb-3)" }}
          animate={{ x: [0, 30, -40, 0], y: [0, -20, 50, 0], scale: [1, 0.9, 1.1, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="max-w-[390px] mx-auto min-h-screen relative z-10 shadow-2xl border-x border-white/5 backdrop-blur-[2px] pb-10">
        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-20 bg-[#0c0a07]/80 backdrop-blur-xl border-b border-white/10 pb-3 pt-6 px-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg border border-amber-500/30 bg-black flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.25)]">
                <span className="text-[13px] font-black text-amber-400 tracking-tighter">HL</span>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white leading-none drop-shadow-md">Hyperliquid 跟单</h1>
                <span className="text-[10px] text-white/45 tracking-wide">链上永续金库 · 智能合约跟单</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-white/60 font-mono bg-white/5 px-2 py-1 rounded-full border border-white/10">
              <div className="relative w-1.5 h-1.5">
                <div className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}></div>
                <div className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50"></div>
              </div>
              <span>实时</span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              placeholder="搜索金库 / 管理员地址..."
              className="w-full bg-black/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/50 pl-9 pr-3 text-sm text-white/90 placeholder:text-white/40 h-10 rounded-xl backdrop-blur-sm"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-[#f59e0b] text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <main className="px-5 pt-5 space-y-6">
          {/* ── SMART CONTRACT COPY-TRADING HERO CARD ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, type: "spring" }}
            className="glass-panel-strong p-5 relative overflow-hidden"
          >
            <div className="shimmer-sweep"></div>

            <div className="absolute -top-8 -right-8 w-36 h-36 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 -left-4 w-24 h-24 bg-amber-600/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              {/* Badge */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/30 rounded-full px-2.5 py-1">
                  <Zap size={11} className="text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">智能合约跟单</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  <div className="relative w-1.5 h-1.5">
                    <div className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}></div>
                    <div className="absolute inset-0 bg-emerald-400 rounded-full"></div>
                  </div>
                  链上执行
                </div>
              </div>

              {/* Headline */}
              <h2 className="text-[22px] font-bold text-white leading-tight tracking-tight mb-2 drop-shadow-sm">
                让 AI 帮你
                <br />
                <span className="text-amber-400">自动跟单 Hyperliquid 金库</span>
              </h2>
              <p className="text-xs text-white/60 mb-5 leading-relaxed">
                One-Agents 引擎实时复制顶级金库的永续合约仓位，通过智能合约链上自动执行
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Layers size={10} className="text-white/40" />
                    <span className="text-[9px] text-white/50 uppercase tracking-wide">总锁仓</span>
                  </div>
                  <p className="text-sm font-bold text-white"><AnimatedNumber value={totalTvl / 1e6} prefix="$" decimals={1} suffix="M" /></p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <BarChart2 size={10} className="text-white/40" />
                    <span className="text-[9px] text-white/50 uppercase tracking-wide">平均年化</span>
                  </div>
                  <p className="text-sm font-bold text-emerald-400">+<AnimatedNumber value={54.7} decimals={1} suffix="%" /></p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Users size={10} className="text-white/40" />
                    <span className="text-[9px] text-white/50 uppercase tracking-wide">跟随者</span>
                  </div>
                  <p className="text-sm font-bold text-amber-400"><AnimatedNumber value={61890} /></p>
                </div>
              </div>

              {/* CTA button */}
              <button className="w-full py-3.5 rounded-xl bg-[#f59e0b] text-black font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-transform active:scale-[0.98]">
                <Zap size={16} className="fill-black/20" />
                <span>进入智能跟单</span>
                <ChevronRight size={16} />
              </button>

              {/* Trust line */}
              <div className="flex items-center justify-center gap-1.5 mt-4">
                <ShieldCheck size={12} className="text-white/40" />
                <span className="text-[10px] text-white/50">资金链上托管 · Hyperliquid L1 永续合约</span>
              </div>
            </div>
          </motion.div>

          {/* ── VAULTS SECTION ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Layers size={14} className="text-amber-400" />
                </div>
                <span className="text-sm font-bold text-white tracking-wide">精选金库</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-white/50 font-mono bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                <TrendingUp size={12} />
                <span>{filtered.length} 个金库</span>
              </div>
            </div>

            <div className="space-y-3">
              <AnimatePresence>
                {filtered.map((v, i) => {
                  const up = v.apr >= 0;
                  return (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.35, delay: i * 0.06, type: "spring" }}
                      className="glass-panel p-4 relative overflow-hidden"
                    >
                      {v.hot && <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/15 blur-2xl rounded-full pointer-events-none" />}

                      {/* Top row: identity + APR */}
                      <div className="relative z-10 flex items-start justify-between mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-[15px] font-bold text-white tracking-tight truncate">{v.name}</h3>
                            {v.hot && <Flame size={13} className="text-amber-400 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-amber-300/90 uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">{v.tag}</span>
                            <div className="flex items-center gap-1 text-[10px] text-white/40 font-mono">
                              <span>{v.leader}</span>
                              <ExternalLink size={9} className="text-amber-400/60" />
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <div className={`text-xl font-bold leading-none ${up ? "text-emerald-400" : "text-red-400"}`}>
                            {up ? "+" : ""}<AnimatedNumber value={v.apr} decimals={1} suffix="%" />
                          </div>
                          <span className="text-[9px] text-white/40 uppercase tracking-wide">年化 APR</span>
                        </div>
                      </div>

                      {/* Sparkline + stats */}
                      <div className="relative z-10 flex items-end justify-between gap-3 mb-3.5">
                        <div className="grid grid-cols-3 gap-3 flex-1">
                          <div>
                            <div className="text-[9px] text-white/40 uppercase tracking-wide mb-0.5">总锁仓</div>
                            <div className="text-xs font-bold text-white font-mono">{fmtUsd(v.tvl)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-white/40 uppercase tracking-wide mb-0.5">30D 盈亏</div>
                            <div className={`text-xs font-bold font-mono ${v.pnl30d >= 0 ? "text-emerald-400" : "text-red-400"}`}>{v.pnl30d >= 0 ? "+" : ""}{fmtUsd(v.pnl30d)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-white/40 uppercase tracking-wide mb-0.5">跟随者</div>
                            <div className="text-xs font-bold text-white font-mono">{v.followers.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="shrink-0 opacity-90">
                          <Sparkline data={v.spark} positive={up} />
                        </div>
                      </div>

                      {/* Footer: commission + CTA */}
                      <div className="relative z-10 flex items-center justify-between gap-3 pt-3 border-t border-white/5">
                        <span className="text-[10px] text-white/45">管理费 <span className="text-white/70 font-mono">{v.commission}%</span></span>
                        {v.hot ? (
                          <button className="flex items-center gap-1.5 bg-[#f59e0b] text-black font-bold text-xs px-4 py-2 rounded-lg shadow-[0_0_14px_rgba(245,158,11,0.3)] transition-transform active:scale-[0.97]">
                            <Zap size={13} className="fill-black/20" />
                            跟单
                            <ChevronRight size={13} />
                          </button>
                        ) : (
                          <button className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs px-4 py-2 rounded-lg hover:bg-amber-500/20 transition-colors">
                            跟单
                            <ChevronRight size={13} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="text-center text-[11px] text-white/35 pt-1">
              数据对标 Hyperliquid 公开金库 · 每 2 分钟同步
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Hyperliquid;
