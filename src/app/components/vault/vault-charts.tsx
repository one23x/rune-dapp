import { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  ReferenceLine,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, BarChart2, Target, Zap, Rocket, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePoolStatsRune } from "@app/lib/data-rune";

const AMBER  = "hsl(38 95% 55%)";
const AMBER_LITE = "hsl(45 100% 70%)";
const BLUE   = "hsl(217 76% 58%)";
const TEAL   = "hsl(173 70% 55%)";
const TEAL_LITE = "hsl(178 90% 68%)";
const CYAN   = "hsl(189 95% 65%)";
const PINK   = "hsl(330 90% 70%)";

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(target * ease);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

function AnimCount({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const v = useCountUp(value);
  return <>{prefix}{v.toFixed(decimals)}{suffix}</>;
}

const CustomTooltipAlloc = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 text-xs glass-panel shadow-lg">
      <div className="font-bold" style={{ color: d.color }}>{d.name}</div>
      <div className="text-white/60 mt-0.5">{d.pct}%</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Pool growth narrative — pre-launch fundraise → launch → post-launch flywheel
// ─────────────────────────────────────────────────────────────────────────────
//
// Storyline encoded in this dataset (illustrative — drives the chart visual,
// not on-chain numbers):
//
//   Pre-launch (募集期):
//     35% of every node-purchase USDT goes straight into the底池.
//     At 100% fundraise (8M USDT) → 2.8M USDT pairs with 100M RUNE
//     and the token launches at $0.028.
//
//   Post-launch (上线后):
//     Every new USDT inflow does TWO things in lockstep —
//       • 17.5% buys RUNE on the open market   → drives price ↑
//       • 17.5% pairs as USDT into the LP      → thickens depth
//     So bars get taller (deeper liquidity) AND the price line climbs
//     (buybacks against a fixed circulating supply).
//
// `usdtSide` and `runeSideUsdt` are both denominated in USDT so the stacked
// bar reads as "total LP TVL". `runePrice` is on a secondary axis.
const POOL_GROWTH = [
  { stage: "募集 25%",   phase: "pre",    usdtSide: 700,    runeSideUsdt: 700,    runePrice: 0.028 },
  { stage: "募集 60%",   phase: "pre",    usdtSide: 1680,   runeSideUsdt: 1680,   runePrice: 0.028 },
  { stage: "100% 上线",  phase: "launch", usdtSide: 2800,   runeSideUsdt: 2800,   runePrice: 0.028 },
  { stage: "上线 +1",    phase: "post",   usdtSide: 2975,   runeSideUsdt: 3060,   runePrice: 0.0301 },
  { stage: "上线 +2",    phase: "post",   usdtSide: 3238,   runeSideUsdt: 3450,   runePrice: 0.0335 },
  { stage: "上线 +3",    phase: "post",   usdtSide: 3588,   runeSideUsdt: 4000,   runePrice: 0.0376 },
  { stage: "上线 +4",    phase: "post",   usdtSide: 4025,   runeSideUsdt: 4720,   runePrice: 0.0425 },
  { stage: "上线 +5",    phase: "post",   usdtSide: 4550,   runeSideUsdt: 5610,   runePrice: 0.0481 },
  { stage: "上线 +6",    phase: "post",   usdtSide: 5163,   runeSideUsdt: 6680,   runePrice: 0.0552 },
];

const PoolGrowthTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const tvl = (row.usdtSide ?? 0) + (row.runeSideUsdt ?? 0);
  const phaseLabel =
    row.phase === "pre"    ? "募集期 Pre-launch"   :
    row.phase === "launch" ? "上线 Launch"         :
                             "上线后 Post-launch";
  return (
    <div className="rounded-xl px-3 py-2.5 text-[11px] bg-popover/95 backdrop-blur-md border border-amber-400/30 shadow-[0_8px_24px_rgba(0,0,0,0.4),0_0_18px_rgba(251,191,36,0.18)]">
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: row.phase === "post" ? CYAN : AMBER }}>
        {label} · {phaseLabel}
      </div>
      <div className="space-y-0.5 tabular-nums">
        <div className="flex justify-between gap-4"><span className="text-teal-300">USDT 侧</span><span className="font-bold">${(row.usdtSide).toLocaleString()}K</span></div>
        <div className="flex justify-between gap-4"><span className="text-amber-300">RUNE 侧</span><span className="font-bold">${(row.runeSideUsdt).toLocaleString()}K</span></div>
        <div className="flex justify-between gap-4 pt-1 mt-1 border-t border-white/10"><span className="text-white/80 font-semibold">TVL</span><span className="font-bold text-amber-200">${tvl.toLocaleString()}K</span></div>
        <div className="flex justify-between gap-4"><span className="text-pink-300">RUNE 价</span><span className="font-bold text-pink-200">${row.runePrice.toFixed(4)}</span></div>
      </div>
    </div>
  );
};

/**
 * Glossy 3D bar shape. Pulls a vertical gradient + top white-bevel highlight
 * + a subtle baseline shadow band so the bar reads as an extruded solid
 * instead of a flat fill. `fillId` references one of the <linearGradient>s
 * declared in the parent <ComposedChart>'s <defs>.
 */
function GlossyBar(props: any) {
  const { x, y, width, height, fillId, highlightColor } = props;
  if (!width || !height || height <= 0) return null;
  const r = Math.min(6, width / 2);
  return (
    <g>
      <defs>
        <clipPath id={`clip-${fillId}-${x}-${y}`}>
          <rect x={x} y={y} width={width} height={height} rx={r} ry={r} />
        </clipPath>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={`url(#${fillId})`} />
      {/* Top bevel highlight */}
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={Math.min(6, height * 0.35)}
        rx={r - 1}
        ry={r - 1}
        fill={highlightColor}
        opacity={0.55}
        clipPath={`url(#clip-${fillId}-${x}-${y})`}
      />
      {/* Inner-side shadow (right edge) for "extruded" feel */}
      <rect x={x + width - 2} y={y} width={2} height={height} fill="rgba(0,0,0,0.22)" clipPath={`url(#clip-${fillId}-${x}-${y})`} />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VaultRecruitment — exported so vault.tsx can pin it to the very top of the
// pool tab (above VaultLpPool). Was previously buried inside VaultCharts.
// ─────────────────────────────────────────────────────────────────────────────
export function VaultRecruitment() {
  const { t } = useTranslation();
  const { data } = usePoolStatsRune();

  const TOTAL_FUNDRAISE_TARGET_USDT = 8_000_000;
  const LP_TARGET_USDT = 2_800_000;
  const raisedUsdt = data?.totalDepositUsdt ?? 0;
  const lpDepositedUsdt = data?.runeLp ?? 0;
  const nodeProgress = Math.min((raisedUsdt / TOTAL_FUNDRAISE_TARGET_USDT) * 100, 100);
  const lpProgress = Math.min((lpDepositedUsdt / LP_TARGET_USDT) * 100, 100);

  // ── ICO-style sale rounds. Each round = 2M USDT of cumulative inflow.
  // Once a round fills, the badge + bar advance to the next. Six rounds
  // total — the headline component on this card, more prominent than the
  // 8M / 2.8M bars below it.
  const ROUND_NAMES: readonly { num: number; name: string; nameEn: string }[] = [
    { num: 1, name: "符胚", nameEn: "EMBRYO"   },
    { num: 2, name: "符源", nameEn: "ORIGIN"   },
    { num: 3, name: "符印", nameEn: "SEAL"     },
    { num: 4, name: "符魂", nameEn: "SOUL"     },
    { num: 5, name: "符将", nameEn: "MARSHAL"  },
    { num: 6, name: "符主", nameEn: "SOVEREIGN"},
  ] as const;
  const ROUND_TARGET_USDT = 2_000_000;
  const roundIndex = Math.min(
    Math.floor(raisedUsdt / ROUND_TARGET_USDT),
    ROUND_NAMES.length - 1,
  );
  const currentRound = ROUND_NAMES[roundIndex];
  const allRoundsDone = raisedUsdt >= ROUND_NAMES.length * ROUND_TARGET_USDT;
  const inRoundUsdt = allRoundsDone
    ? ROUND_TARGET_USDT
    : raisedUsdt - roundIndex * ROUND_TARGET_USDT;
  const roundProgress = Math.min((inRoundUsdt / ROUND_TARGET_USDT) * 100, 100);

  return (
    <div className="glass-panel-strong relative overflow-hidden">
      <div className="shimmer-sweep" />
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-amber-400/25 blur-[60px]" />
      <div className="pointer-events-none absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-orange-500/15 blur-[50px]" />
      {/* Top accent glow line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />

      <div className="relative p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-400/40 to-amber-700/20 ring-1 ring-amber-400/55 shadow-[0_3px_10px_rgba(251,191,36,0.4)]">
                <Rocket className="h-3.5 w-3.5 text-amber-200" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100">
                {t("vault.charts.nodeRecruitment", "节点招募进度")}
              </span>
            </div>
            <div className="text-[11px] font-bold tabular-nums text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
              {nodeProgress.toFixed(1)}%
            </div>
          </div>

          {/* Headline: current ICO-style round (2M USDT each, 6 total).
              Sits above the 8M / 2.8M bars and is visually the most
              prominent thing in this card: chunkier bar, gold→pink glow,
              round number badge + name pill, animated count. */}
          <div className="rounded-xl border border-amber-400/35 bg-gradient-to-br from-amber-500/[0.07] via-pink-500/[0.04] to-transparent p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-300/40 via-amber-500/30 to-pink-500/30 ring-1 ring-amber-300/55 shadow-[0_0_14px_rgba(251,191,36,0.55)] shrink-0">
                  <Flame className="h-3.5 w-3.5 text-amber-100 drop-shadow-[0_0_6px_rgba(255,140,0,0.7)]" />
                </div>
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.22em] px-2 py-0.5 rounded-md bg-black/40 border border-amber-300/35 text-amber-200 tabular-nums shrink-0"
                    data-testid="round-badge"
                  >
                    {allRoundsDone
                      ? t("vault.charts.roundDone", "全部完成")
                      : `${t("vault.charts.roundPrefix", "第")} ${String(currentRound.num).padStart(2, "0")} ${t("vault.charts.roundSuffix", "轮")}`}
                  </span>
                  <span
                    className="text-base sm:text-lg font-bold leading-none truncate bg-gradient-to-r from-amber-200 via-amber-100 to-pink-200 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                    data-testid="round-name"
                  >
                    {currentRound.name}
                    <span className="text-[10px] font-mono text-amber-300/70 ml-1.5 align-middle">· {currentRound.nameEn}</span>
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-widest text-amber-300/80 leading-none">
                  {t("vault.charts.roundTarget", "目标")}
                </div>
                <div className="text-xs font-bold tabular-nums text-amber-100 mt-0.5">2.0M USDT</div>
              </div>
            </div>

            <div className="relative h-4 rounded-full overflow-hidden bg-black/55 ring-1 ring-amber-400/30 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(roundProgress, 2)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{
                  background: `linear-gradient(90deg, ${AMBER} 0%, ${AMBER_LITE} 45%, ${PINK} 100%)`,
                  boxShadow: `0 0 18px ${AMBER}, 0 0 28px ${PINK}, inset 0 1px 0 rgba(255,255,255,0.55)`,
                }}
              />
              {/* Step ticks — six even segments for the 6-round series so
                  the viewer reads "round 2 of 6 visually" at a glance. */}
              <div className="absolute inset-y-0 left-0 right-0 pointer-events-none flex">
                {Array.from({ length: ROUND_NAMES.length - 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 border-r border-white/10 last:border-r-0"
                  />
                ))}
              </div>
              <motion.div
                className="absolute inset-y-0 w-1/3 pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)" }}
                animate={{ x: ["-120%", "320%"] }}
                transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }}
              />
            </div>

            <div className="mt-2 flex items-center justify-end text-[11px] gap-2 flex-wrap">
              <span className="text-amber-100 font-bold tabular-nums drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" data-testid="round-percent">
                {roundProgress.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Overall fundraise bar — 8M USDT goal */}
          <div>
            <div className="relative h-3 rounded-full overflow-hidden bg-black/40 ring-1 ring-amber-500/20">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(nodeProgress, 1.5)}%` }}
                transition={{ duration: 1.4, ease: "easeOut" }}
                style={{
                  background: `linear-gradient(90deg, ${AMBER} 0%, ${AMBER_LITE} 100%)`,
                  boxShadow: `0 0 14px ${AMBER}, inset 0 1px 0 rgba(255,255,255,0.45)`,
                }}
              />
              {/* Sweeping shimmer */}
              <motion.div
                className="absolute inset-y-0 w-1/3 pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.30), transparent)" }}
                animate={{ x: ["-120%", "320%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px]">
              <span className="text-white/60">
                {t("vault.charts.fundraiseTarget", "募集目标")} · 8M USDT
              </span>
              <span className="text-amber-300 tabular-nums font-bold">{nodeProgress.toFixed(1)}%</span>
            </div>
          </div>

          {/* LP injection target — 2.8M USDT (35% of fundraise) */}
          <div>
            <div className="relative h-2.5 rounded-full overflow-hidden bg-black/40 ring-1 ring-cyan-400/20">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(lpProgress, 1.5)}%` }}
                transition={{ duration: 1.4, ease: "easeOut", delay: 0.18 }}
                style={{
                  background: `linear-gradient(90deg, ${TEAL} 0%, ${CYAN} 100%)`,
                  boxShadow: `0 0 12px ${CYAN}, inset 0 1px 0 rgba(255,255,255,0.45)`,
                }}
              />
              <motion.div
                className="absolute inset-y-0 w-1/3 pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)" }}
                animate={{ x: ["-120%", "320%"] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.1, delay: 0.5 }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px]">
              <span className="text-white/60">
                {t("vault.charts.lpInjectTarget", "LP 注入目标")} · 2.8M USDT
              </span>
              <span className="text-cyan-300 tabular-nums font-bold">
                {lpProgress.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-amber-200/70 pt-0.5">
            <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{t("vault.charts.launchOnFullRecruitment", "100% 募集即上线")}</span>
            <span className="flex items-center gap-1 text-amber-300"><Target className="h-3 w-3" />100M RUNE @ $0.028</span>
          </div>
      </div>
    </div>
  );
}

/**
 * Vault analytics — KPI strip + allocation donut + pool-growth narrative.
 * Recruitment progress lives in `<VaultRecruitment />` and is rendered
 * separately at the top of the pool tab. Annual-yield curve was removed
 * per spec — the new pool-growth chart already encodes the value story.
 */
export function VaultCharts() {
  const { t } = useTranslation();
  const { data } = usePoolStatsRune();

  const motherUsdt  = data?.runeLp ?? 0;
  const reserveUsdt = data?.reserve ?? 0;
  const tradingUsdt = data?.managedPool ?? 0;

  const allocData = [
    { name: t("vault.charts.runeLp"),      value: motherUsdt,  color: AMBER, pct: "35" },
    { name: t("vault.charts.managedPool"), value: tradingUsdt, color: BLUE,  pct: "45" },
    { name: t("vault.charts.reserve"),     value: reserveUsdt, color: TEAL,  pct: "20" },
  ];

  const LABEL_STYLE = { fontSize: 10, fill: "hsl(215 28% 75%)" };

  return (
    <div className="px-4 lg:px-6 space-y-3">
      {/* Section title */}
      <div className="flex items-center gap-2 pt-1">
        <div className="h-5 w-5 rounded flex items-center justify-center bg-blue-500/15 ring-1 ring-blue-500/25">
          <BarChart2 className="h-3 w-3 text-blue-400" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
          {t("vault.charts.protocolAnalytics")}
        </span>
      </div>

      {/* KPI row — deposit/pool totals hidden; only the yield estimate stays */}
      <div className="grid grid-cols-1 gap-2">
        {[
          { icon: TrendingUp, color: TEAL,   label: t("vault.charts.annualEst"),     val: 8,           prefix: "",  suffix: "%", dec: 0 },
        ].map(({ icon: Icon, color, label, val, prefix, suffix, dec }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-panel px-3 py-3 text-center"
          >
            <Icon className="h-4 w-4 mx-auto mb-1" style={{ color }} />
            <div className="text-sm font-bold tabular-nums" style={{ color }}>
              <AnimCount value={val} prefix={prefix} suffix={suffix} decimals={dec} />
            </div>
            <div className="text-[10px] text-white/60 mt-0.5">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Allocation donut + legend */}
      <div className="glass-panel">
        <div className="p-4">
          <div className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-3">
            {t("vault.charts.allocation")}
          </div>
          <div className="flex items-center gap-4">
            <div style={{ width: 110, height: 110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                    animationBegin={0}
                    animationDuration={900}
                  >
                    {allocData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltipAlloc />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {allocData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-white/60">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 rounded-full overflow-hidden bg-white/10">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${d.pct}%`, background: d.color }} />
                    </div>
                    <span className="font-bold tabular-nums w-10 text-right" style={{ color: d.color }}>{d.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pool growth narrative ─────────────────────────────────────────── */}
      <div className="glass-panel relative overflow-hidden">
        {/* Ambient color glows */}
        <div className="pointer-events-none absolute -top-20 -left-10 h-56 w-56 rounded-full bg-amber-400/20 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-16 -right-8 h-48 w-48 rounded-full bg-cyan-400/14 blur-[70px]" />
        {/* Animated diagonal scan light */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(115deg, transparent 38%, rgba(251,191,36,0.07) 50%, transparent 62%)",
            backgroundSize: "200% 100%",
            mixBlendMode: "screen",
          }}
          animate={{ backgroundPosition: ["180% 0%", "-60% 0%"] }}
          transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
        />

        <div className="relative p-4 pb-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md flex items-center justify-center bg-gradient-to-br from-amber-400/35 to-cyan-500/25 ring-1 ring-amber-300/45 shadow-[0_2px_8px_rgba(251,191,36,0.4)]">
                <Flame className="h-3.5 w-3.5 text-amber-200" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100">
                {t("vault.charts.poolGrowth", "底池增长 · 上线前后")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40">35% 注入</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/40">17.5% × 2 飞轮</span>
            </div>
          </div>

          {/* Chart */}
          <div style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={POOL_GROWTH} margin={{ top: 12, right: 12, left: -8, bottom: 4 }} barCategoryGap="22%">
                <defs>
                  {/* USDT side — teal/cyan glow gradient */}
                  <linearGradient id="grad-usdt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={TEAL_LITE} stopOpacity={1} />
                    <stop offset="55%"  stopColor={TEAL}      stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(180 70% 28%)" stopOpacity={1} />
                  </linearGradient>
                  {/* RUNE side — molten amber gradient */}
                  <linearGradient id="grad-rune" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={AMBER_LITE} stopOpacity={1} />
                    <stop offset="55%"  stopColor={AMBER}      stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(28 90% 32%)" stopOpacity={1} />
                  </linearGradient>
                  {/* Drop-shadow filter for the price line */}
                  <filter id="priceGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <CartesianGrid vertical={false} stroke="hsl(215 25% 30% / 0.45)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="stage"
                  tick={{ ...LABEL_STYLE, fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-22}
                  textAnchor="end"
                  height={42}
                />
                <YAxis
                  yAxisId="left"
                  tick={LABEL_STYLE}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={(v) => `${v / 1000}M`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ ...LABEL_STYLE, fill: PINK }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                  tickFormatter={(v) => `$${v.toFixed(3)}`}
                  domain={[0.024, "auto"]}
                />
                <Tooltip content={<PoolGrowthTooltip />} cursor={{ fill: "rgba(251,191,36,0.06)" }} />

                {/* Launch event marker */}
                <ReferenceLine
                  yAxisId="left"
                  x="100% 上线"
                  stroke={AMBER_LITE}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  label={{
                    value: "LAUNCH",
                    position: "top",
                    fill: AMBER_LITE,
                    fontSize: 9,
                    fontWeight: 700,
                    offset: 6,
                  }}
                />

                {/* Stacked TVL bars: USDT side (bottom) + RUNE side (top) */}
                <Bar
                  yAxisId="left"
                  dataKey="usdtSide"
                  name="USDT 侧"
                  stackId="tvl"
                  fill="url(#grad-usdt)"
                  shape={(p: any) => <GlossyBar {...p} fillId="grad-usdt" highlightColor={TEAL_LITE} />}
                  animationDuration={1100}
                />
                <Bar
                  yAxisId="left"
                  dataKey="runeSideUsdt"
                  name="RUNE 侧"
                  stackId="tvl"
                  fill="url(#grad-rune)"
                  shape={(p: any) => <GlossyBar {...p} fillId="grad-rune" highlightColor={AMBER_LITE} />}
                  animationDuration={1300}
                />

                {/* RUNE price line — secondary axis */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="runePrice"
                  name="RUNE 价"
                  stroke={PINK}
                  strokeWidth={2.5}
                  filter="url(#priceGlow)"
                  dot={{ r: 3, fill: "#fff", stroke: PINK, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: PINK, stroke: "#fff", strokeWidth: 2 }}
                  animationDuration={1500}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend + flywheel caption */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] justify-center">
            <span className="flex items-center gap-1 text-teal-200">
              <span className="h-2 w-3 rounded-sm" style={{ background: `linear-gradient(180deg, ${TEAL_LITE}, ${TEAL})`, boxShadow: `0 0 6px ${TEAL}` }} />
              {t("vault.charts.legendUsdtSide", "USDT 侧")}
            </span>
            <span className="flex items-center gap-1 text-amber-200">
              <span className="h-2 w-3 rounded-sm" style={{ background: `linear-gradient(180deg, ${AMBER_LITE}, ${AMBER})`, boxShadow: `0 0 6px ${AMBER}` }} />
              {t("vault.charts.legendRuneSide", "RUNE 侧")}
            </span>
            <span className="flex items-center gap-1 text-pink-200">
              <span className="h-0.5 w-4 rounded-full" style={{ background: PINK, boxShadow: `0 0 8px ${PINK}` }} />
              {t("vault.charts.legendRunePrice", "RUNE 价")}
            </span>
          </div>
          <div className="text-[10px] text-white/60 leading-snug text-center mt-1.5 px-2">
            {t(
              "vault.charts.poolGrowthCaption",
              "上线前 35% 募集资金 → 100M RUNE 启动底池；上线后每笔入金 17.5% 回购 + 17.5% USDT 配对，价格上涨 × 底池加厚的双轮飞轮。"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
