import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CountUp from "react-countup";
import {
  useGetRuneOverview,
  useCalculateRuneReturns,
  useCalculateRuneBurnStake,
  RuneCalculatorInputNodeLevel,
} from "@/lib/queries";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // still used by calculator section below
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft, BarChart2, Coins, Flame, TrendingUp,
  Layers, BadgeCheck, ChevronRight, PieChart as PieIcon,
  Activity,
} from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/language-context";

/**
 * Bilingual render helper — zh/zh-TW render "LOCAL · ENG" together,
 * en renders English only, ko/ja/th/vi render only their native label.
 */
function useBi() {
  const { t, language } = useLanguage();
  const isEn = language === "en";
  const isZh = language === "zh" || language === "zh-TW";
  return {
    t,
    language,
    isEn,
    isZh,
    /** localized label, optionally suffixed with " · <ENG>" for zh/zh-TW */
    bi: (key: string, en: string) => {
      if (isEn) return en;
      if (isZh) return `${t(key)} · ${en}`;
      return t(key);
    },
  };
}

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  pioneer:  "hsl(217,80%,58%)",
  builder:  "hsl(142,70%,45%)",
  guardian: "hsl(38,92%,50%)",
  strategic:"hsl(280,70%,60%)",
  mother:   "hsl(217,80%,65%)",
  sub:      "hsl(30,90%,58%)",
  usdt:     "hsl(142,65%,50%)",
  grid:     "hsl(217,30%,18%)",
  muted:    "hsl(217,20%,40%)",
};

const PIE_COLORS = [
  "hsl(217,80%,58%)", "hsl(142,70%,45%)", "hsl(38,92%,50%)", "hsl(280,70%,60%)",
];

const NODE_BG: Record<string, string> = {
  pioneer:  "from-blue-950/60 to-blue-900/20 border-blue-800/40",
  builder:  "from-green-950/60 to-green-900/20 border-green-800/40",
  guardian: "from-amber-950/60 to-amber-900/20 border-amber-800/40",
  strategic:"from-purple-950/60 to-purple-900/20 border-purple-800/40",
};
const NODE_RING: Record<string, string> = {
  pioneer:  "ring-blue-500/60",
  builder:  "ring-green-500/60",
  guardian: "ring-amber-500/60",
  strategic:"ring-purple-500/60",
};

// ─── Chart tooltip style ──────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: { background: "hsl(230,30%,8%)", border: "1px solid hsl(217,30%,22%)", borderRadius: 8, fontSize: 12 },
  labelStyle:   { color: "hsl(217,20%,70%)", marginBottom: 4 },
  cursor:       { fill: "hsl(217,80%,58%,0.06)" },
};

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ─── Sub-component: Section Header ───────────────────────────────────────────
function SectionTitle({ icon: Icon, i18nKey, en }: { icon: React.ElementType; i18nKey: string; en: string }) {
  const { t, isEn, isZh } = useBi();
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
      <Icon className="h-4 w-4 text-primary" />
      {isEn ? en : t(i18nKey)}
      {isZh && <> · <span className="text-muted-foreground/60">{en}</span></>}
    </h2>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TechChartCard — high-tech "HUD" wrapper for each analytical chart.
   Adds:
     • Hexa-corner brackets that pulse on mount
     • Animated top accent (gradient sweep)
     • Hover-reveal radial glow
     • Diagonal scan line (slow loop)
     • Live "STREAM" indicator
══════════════════════════════════════════════════════════════════════════════ */
interface TechChartCardProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  accent?: string;            // tailwind color class fragment (e.g. "primary", "amber-500")
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

function TechChartCard({
  icon: Icon, title, subtitle,
  accent = "primary", delay = 0,
  className = "", children,
}: TechChartCardProps) {

  // map accent token → resolved hsl color + tailwind text class
  // (using explicit hsl ensures boxShadow / radial-gradient render consistently)
  const accentMap: Record<string, { hsl: string; cls: string }> = {
    primary:    { hsl: "hsl(38, 92%, 58%)",  cls: "text-amber-400" },
    "amber-500":{ hsl: "hsl(38, 92%, 58%)",  cls: "text-amber-400" },
    "orange-500":{ hsl: "hsl(24, 92%, 58%)", cls: "text-orange-400" },
    "chart-1":  { hsl: "hsl(199, 89%, 60%)", cls: "text-sky-400"   },
  };
  const { hsl: accentColor, cls: accentColorClass } = accentMap[accent] ?? accentMap.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={`group relative rounded-xl border border-border/50 bg-gradient-to-br from-card/85 via-card/70 to-card/40 backdrop-blur-md overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.35)] ${className}`}
    >
      {/* Top accent gradient sweep */}
      <motion.div
        className="absolute left-0 right-0 top-0 h-[2px] pointer-events-none z-20 origin-left"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accentColor} 30%, ${accentColor} 70%, transparent 100%)`,
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 0.85 }}
        transition={{ duration: 1.0, delay: delay + 0.15, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Subtle holographic radial glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-700"
        style={{
          background: `radial-gradient(600px circle at 50% 0%, ${accentColor.replace("hsl(", "hsla(").replace(")", ", 0.07)")}, transparent 45%)`,
        }}
      />

      {/* Diagonal scan line — slow infinite loop */}
      <motion.div
        className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none z-10"
        style={{
          background: "linear-gradient(115deg, transparent 0%, transparent 35%, rgba(255,255,255,0.025) 50%, transparent 65%, transparent 100%)",
        }}
        animate={{ x: ["0%", "400%"] }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear", delay: delay + 1.5 }}
      />

      {/* HUD corner brackets — 4 corners (steady, no pulse flicker) */}
      {[
        { pos: "top-2 left-2",     border: "border-t border-l", corner: "rounded-tl" },
        { pos: "top-2 right-2",    border: "border-t border-r", corner: "rounded-tr" },
        { pos: "bottom-2 left-2",  border: "border-b border-l", corner: "rounded-bl" },
        { pos: "bottom-2 right-2", border: "border-b border-r", corner: "rounded-br" },
      ].map((c, i) => (
        <motion.span
          key={i}
          className={`absolute ${c.pos} w-3 h-3 ${c.border} ${c.corner} pointer-events-none`}
          style={{ borderColor: accentColor, opacity: 0.55 }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.55, scale: 1 }}
          transition={{ duration: 0.5, delay: delay + 0.35 + i * 0.04, ease: "easeOut" }}
        />
      ))}

      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/30">
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon plate — soft tinted background, even ambient halo behind it */}
          <div className="relative shrink-0">
            {/* Soft halo behind icon (steady, not flickering) */}
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                background: `radial-gradient(closest-side, ${accentColor.replace("hsl(", "hsla(").replace(")", ", 0.45)")}, transparent 75%)`,
                filter: "blur(8px)",
              }}
              animate={{ opacity: [0.45, 0.75, 0.45] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay }}
            />
            <div
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${accentColorClass}`}
              style={{
                background: `linear-gradient(135deg, ${accentColor.replace("hsl(", "hsla(").replace(")", ", 0.18)")} 0%, ${accentColor.replace("hsl(", "hsla(").replace(")", ", 0.04)")} 100%)`,
                border: `1px solid ${accentColor.replace("hsl(", "hsla(").replace(")", ", 0.35)")}`,
                boxShadow: `inset 0 1px 0 0 ${accentColor.replace("hsl(", "hsla(").replace(")", ", 0.18)")}, 0 0 0 1px ${accentColor.replace("hsl(", "hsla(").replace(")", ", 0.06)")}`,
              }}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground tracking-tight leading-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-tight tracking-wide font-mono tabular-nums">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Live data indicator — symmetric breathing */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full"
              style={{ background: accentColor }}
              animate={{ opacity: [0.5, 0, 0.5], scale: [1, 2.6, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative inline-flex h-full w-full rounded-full" style={{ background: accentColor }} />
          </span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 font-medium hidden sm:inline">
            LIVE
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="relative z-20 px-3 pt-4 pb-3">
        {children}
      </div>
    </motion.div>
  );
}

// Fallback English labels for the 6 RUNE price stages (backend only sends labelCn).
const STAGE_EN_LABELS = ["① Launch", "② Batch 2", "③ Batch 3", "④ Batch 4", "⑤ Target (Low)", "⑥ Target (High)"];

// ─── Main page ────────────────────────────────────────────────────────────────
// Four product tracks per 2026-04-29 user clarification:
//   • calc — node ROI calculator
//   • node — reference tables (airdrop, trading dividend, weights)
//   • pkg  — USDT → buy RUNE → activate 套餐 (deposit). Daily 0.5-0.9% ×
//     bonus, 65% USDT direct + 35% auto-buy sub-token. Principal returns.
//   • dual — USDT → buy RUNE → permanently burn → daily 1.0-1.5% sub
//     yield → auto-stake → AI monthly dividend + IDO. Tab now labelled
//     "销毁质押". Principal NOT returnable.
type V2Tab = "calc" | "node" | "pkg" | "dual";

// (no extra mode types — pkg and dual are each single-mode tabs)

export default function Rune() {
  const { t, bi, isEn, isZh } = useBi();
  const { data: overview, isLoading } = useGetRuneOverview();

  /** Pick the locale-appropriate stage label. zh/zh-TW get the backend's
   * labelCn; every other locale gets the English fallback list. */
  const stageLabel = (s: { labelCn: string }, i: number) =>
    isZh ? s.labelCn : (STAGE_EN_LABELS[i] ?? s.labelCn);

  /** Pick the locale-appropriate node tier name. zh/zh-TW get nameCn,
   * every other locale gets nameEn. */
  const nodeName = (n: { nameCn: string; nameEn: string }) => (isZh ? n.nameCn : n.nameEn);

  // Default to `initial` — the smallest tier. The earlier `pioneer` value
  // refers to the legacy 4-tier schema; the current 5-tier enum (initial/
  // mid/advanced/super/founder) doesn't include it, so reading `.pioneer`
  // at runtime returned undefined → the calculator silently POSTed
  // `nodeLevel: undefined` and got a 400 from the server.
  const [nodeLevel, setNodeLevel]   = useState<RuneCalculatorInputNodeLevel>(RuneCalculatorInputNodeLevel.initial);
  const [seats,     setSeats]       = useState(1);
  const [durationDays, setDurationDays] = useState(180);
  const [priceStageIndex, setPriceStageIndex] = useState(3);
  const [trendScale, setTrendScale] = useState<"log" | "linear">("log");
  // Dynamic price simulation chart — pick mother or sub view (toggle).
  const [simTokenView, setSimTokenView] = useState<"mother" | "sub">("mother");
  const calcMutation = useCalculateRuneReturns();
  const burnCalcMutation = useCalculateRuneBurnStake();
  const [burnTokens, setBurnTokens] = useState(1000);
  const [burnDays, setBurnDays] = useState(360);
  const [burnPanelOpen, setBurnPanelOpen] = useState(true);  // open by default in Staking tab

  // v2: top-level tab — splits the original "all-in-one" page into 4 lenses.
  const [v2Tab, setV2Tab]   = useState<V2Tab>("calc");

  // Auto-recalc summary tab whenever node/duration/stage changes (250ms debounce).
  // Removes the manual "Calculate" click — KPIs update live as user drags
  // sliders / picks stages. seats is hardcoded to 1 (single-seat purchase).
  useEffect(() => {
    if (!nodeLevel) return;
    const t = setTimeout(() => {
      calcMutation.mutate({ data: { nodeLevel, seats: 1, durationDays, priceStageIndex } });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeLevel, durationDays, priceStageIndex]);

  // Trading-dividend inputs — replaces my made-up turnover/AI-share knobs
  // with the formula from 节点招募计划.md §权益3:
  //   • 母币买入滑点 2%  / 子币买入滑点 2%
  //   • 母币卖出盈利税 5% / 子币卖出盈利税 3%
  //   • 母币每日烧 0.2% × 1% 给节点池 / 子币 0.1% × 2% 给节点池
  // Doc doesn't say buy:sell ratio, so we assume 50/50 (slippage taxes
  // only the buy half; profit tax only the sell half).
  const [motherDailyVolume, setMotherDailyVolume] = useState(1_000_000);  // USDT / day
  const [subDailyVolume,    setSubDailyVolume]    = useState(500_000);    // USDT / day
  const [avgSellProfitPct,  setAvgSellProfitPct]  = useState(20);          // % — sell-side profit ratio

  // ── Dynamic mother-token price simulation (replaces doc's static 80-120×) ──
  //   Day 0: LP = 280万 USDT × 1亿 RUNE (launch price $0.028)
  //   TLP USDT side ramps linearly to 3500万 by day 180 (节点招募 §权益2 cap),
  //     then plateaus.
  //   LP RUNE drains daily from (a) protocol auto-burn 0.2% (b) user
  //     burn-stake (configurable monthly %).
  //   price(d) = LP_USDT(d) / LP_RUNE(d)
  // Activity-driven simulation. Two ground-truth inputs:
  //   • monthlyActiveUsers — # users opening a 套餐 each month
  //   • avgPackageUsdt     — avg USDT per package
  // From these we derive everything:
  //   1. dailyInflowUsdt  = users × pkg / 30  (TLP USDT growth)
  //   2. dailyAmmDrain    = swap_out via constant-product AMM math
  //                         (when a user buys mother to burn-stake, USDT
  //                         enters LP and RUNE leaves LP — that's the
  //                         "burn rate" component, no longer a free knob)
  //   3. dailyProtocolBurn = LP_RUNE × 0.2%/day (protocol auto-burn)
  // Stage milestones (TLP 280→700→1750→3500万) emerge from these — they're
  // not pinned to specific days anymore. Heavier user activity → faster
  // milestones AND thinner LP RUNE at each milestone (price climbs faster).
  const [monthlyActiveUsers, setMonthlyActiveUsers] = useState<number>(1500);   // # active burn-stakers / mo
  const [avgPackageUsdt,     setAvgPackageUsdt]     = useState<number>(3600);   // USDT / package, mid-tier default
  const TARGET_TLP_WAN = 3500;
  const LAUNCH_TLP_WAN = 280;
  const LAUNCH_LP_RUNE = 1e8;
  const DAILY_PROTOCOL_BURN = 0.002;
  const TOTAL_NODE_WEIGHT = 2880;
  // Reference math: 1500 users × $3600 / mo = 540万 USDT/mo ≈ 18万/day,
  // which reaches the §权益2 cap (TLP 3500万) in ~180 days. Slow scenario
  // 300 users × $1200 → 36万/mo → ~16 months; aggressive 5000 × $5000 →
  // 2500万/mo → ~38 days.
  const SIM_HORIZON_DAYS = 540;

  // ── 质押 (pkg) tab — USDT 套餐 calculator ───────────────────────────────
  // User deposits USDT; protocol auto-buys RUNE and activates 套餐.
  // Daily yield 0.5-0.9% × duration bonus (per 模型制度.md §叁):
  //   30d   0.3-0.5% / no bonus
  //   90d   0.5-0.7% / no bonus
  //   180d  0.5-0.9% / +10%
  //   360d  0.5-0.9% / +20%
  //   540d  0.5-0.9% / +30%
  // Yield split: 65% USDT直发 (静态) + 35% 自动买子币 (动态).
  // Sub-token valued at launch price $0.038 per user's choice (no dynamic
  // sub-side model yet).
  const [pkgUsdt, setPkgUsdt] = useState(1000);
  const [pkgDays, setPkgDays] = useState<30 | 90 | 180 | 360 | 540>(540);
  const [pkgRatePct, setPkgRatePct] = useState(0.7); // base daily rate, slider midpoint
  const PKG_SUB_LAUNCH_PRICE = 0.038;

  // ── 双币联动 (dual) tab — burn-stake mother → sub-token → AI + IDO ──
  // Client-side calc, no backend.
  const [stakeUsdt,        setStakeUsdt]        = useState(1000);    // USDT principal
  const [stakeDays,        setStakeDays]        = useState(360);     // duration
  const [stakeStage,       setStakeStage]       = useState(3);       // price stage (Stage 4 default)
  const [stakeDailyPct,    setStakeDailyPct]    = useState(0.7);     // 套餐 daily, 0.3-0.9 + bonus
  const [stakeBonusPct,    setStakeBonusPct]    = useState(20);      // long-lock bonus
  const [aiPoolMonthly,    setAiPoolMonthly]    = useState(1_000_000);  // 100万U total monthly AI pool
  const [globalSubStaked,  setGlobalSubStaked]  = useState(100_000);    // assumed total sub-stake
  const [idosPerMonth,     setIdosPerMonth]     = useState(1.5);
  const [idoAvgMultiplier, setIdoAvgMultiplier] = useState(50);
  const [idoAllocFactor,   setIdoAllocFactor]   = useState(0.003);   // your sub-stake × this = USDT allocation per IDO. Calibrated against doc PART V: 6.27M IDO gain @ 540d/10000U → ~$4,738/IDO ÷ 1.44M avg sub-stake ≈ 0.0033.

  // Auto-default the burn-stake price stage to one matching the projection
  // window — short windows shouldn't price sub at far-future stages.
  //   30d  → Stage 1 (TLP 700万)
  //   90d  → Stage 2 (TLP 1750万)
  //   180d → Stage 3 (TLP 3500万) — TLP cap day
  //   360d → Stage 4 (~18mo extrapolation)
  //   540d+→ Stage 5 (24mo target / peak)
  // Fires on burnDays change; user can still manually override after.
  useEffect(() => {
    const next = burnDays <= 30  ? 1
              : burnDays <= 90  ? 2
              : burnDays <= 180 ? 3
              : burnDays <= 360 ? 4
              :                   5;
    setStakeStage(next);
  }, [burnDays]);

  const selectedNode         = overview?.nodes?.find(n => n.level === nodeLevel);
  const selectedStagePreview = overview?.priceStages?.[priceStageIndex];

  // ── Derived chart data ────────────────────────────────────────────────────
  // Placeholder — re-declared below after dynamicMotherPriceByStage so
  // the chart can pull dynamic mother prices and update with the slider.

  // Placeholder — declared again below after dynamicMotherPriceByStage.

  const monthSuffix = isEn ? "mo" : t("mr.rune.input.months");
  // Sub-token deflation curve — follows the activity sliders so the chart
  // reacts to changes in monthlyActiveUsers / avgPackageUsdt instead of
  // sitting on a flat protocol baseline.
  // Drivers (per 核心机制.md §贰 + 资金流向 §二):
  //   - protocol 0.1%/day baseline burn
  //   - IDO² locks FIRE → 100% burned (scales with activity → IDO count)
  //   - C2C sell-tax 3% sub burn (scales with activity)
  // Aggregate effective daily sub-burn = base × (1 + activity factor),
  // where the factor is bounded so it doesn't run away at extreme inputs.
  const deflationData = useMemo(() => {
    const total          = overview?.subToken?.totalSupply ?? 13_100_000;
    const baseRate       = overview?.subToken?.dailyBurnRate ?? 0.001;
    const dailyInflowU   = (monthlyActiveUsers * avgPackageUsdt) / 30;
    // 540万/mo (default scenario) → activity factor ~1, so net daily burn
    // doubles. 1500万/mo → factor ~3. Capped at 5× for visual sanity.
    const activityFactor = Math.min(dailyInflowU / 180_000, 5);
    const effectiveRate  = baseRate * (1 + activityFactor);
    const months         = [0,1,2,3,4,5,6,9,12,15,18,21,24];
    return months.map(m => ({
      month: `${m}${monthSuffix}`,
      circulating: Math.round(total * Math.pow(1 - effectiveRate, m * 30)),
      burned:      Math.round(total - total * Math.pow(1 - effectiveRate, m * 30)),
    }));
  }, [overview, monthSuffix, monthlyActiveUsers, avgPackageUsdt]);

  // Day-stepped AMM simulation. No closed-form: each day we apply
  //   1. user buy: USDT in, RUNE out via constant-product math
  //   2. protocol auto-burn: 0.2% of remaining LP RUNE
  // until the TLP cap (3500万) is reached, after which buy-stake stops
  // generating airdrop releases (assumption) so inflow halts; only the
  // protocol auto-burn keeps grinding LP RUNE down past that point.
  const fullSimulation = useMemo(() => {
    const dailyInflowUsdt = (monthlyActiveUsers * avgPackageUsdt) / 30;
    const TARGET_TLP_USDT = TARGET_TLP_WAN * 10000;
    let tlpUsdt = LAUNCH_TLP_WAN * 10000;
    let lpRune  = LAUNCH_LP_RUNE;
    const out: Array<{ day: number; tlpUsdt: number; lpRune: number }> = [];
    for (let d = 0; d <= SIM_HORIZON_DAYS; d++) {
      out.push({ day: d, tlpUsdt, lpRune });
      // Cap inflow to remaining headroom under TARGET cap.
      const remainingCap = Math.max(0, TARGET_TLP_USDT - tlpUsdt);
      const actualInflow = Math.min(dailyInflowUsdt, remainingCap);
      // Constant-product AMM: x·y = k. Add P USDT, RUNE leaving = lpRune·P/(tlpUsdt+P).
      const swapOut = actualInflow > 0 && tlpUsdt > 0
        ? (actualInflow * lpRune) / (tlpUsdt + actualInflow)
        : 0;
      const burnOut = lpRune * DAILY_PROTOCOL_BURN;
      tlpUsdt += actualInflow;
      lpRune  = Math.max(1, lpRune - swapOut - burnOut);
    }
    return out;
  }, [monthlyActiveUsers, avgPackageUsdt]);

  // Sub-token price as a function of TLP. Calibrated piecewise:
  //   - TLP < 500万U  : sub not launched → 0
  //   - TLP = 500万   : launch at $0.038 (per 模型制度 §壹)
  //   - 500万 → 1000万 : linear ramp $0.038 → $2 (smooth transition into
  //                     the doc's quadratic regime)
  //   - TLP ≥ 1000万   : $2 × (tlp_万 / 1000)² calibrated to doc PART V
  //                     ($2 / $18 / $50 / $200 at 1000/3000/5000/10000万)
  const SUB_LAUNCH_PRICE     = 0.038;
  const SUB_LAUNCH_TLP_USDT  = 500 * 10_000;
  const SUB_REGIME2_TLP_USDT = 1000 * 10_000;
  const subPriceAtTlp = (tlpUsdt: number): number => {
    if (tlpUsdt < SUB_LAUNCH_TLP_USDT) return 0;
    if (tlpUsdt < SUB_REGIME2_TLP_USDT) {
      const t = (tlpUsdt - SUB_LAUNCH_TLP_USDT) / (SUB_REGIME2_TLP_USDT - SUB_LAUNCH_TLP_USDT);
      return SUB_LAUNCH_PRICE + (2 - SUB_LAUNCH_PRICE) * t;
    }
    const tlpWan = tlpUsdt / 10_000;
    return 2 * Math.pow(tlpWan / 1000, 2);
  };

  // Sample every 10 days for chart density readable on mobile.
  const priceSimulation = useMemo(() =>
    fullSimulation
      .filter((_, i) => i % 10 === 0)
      .map(s => ({
        day:    s.day,
        tlp:    s.tlpUsdt / 10000,                                   // 万 USDT
        lpRune: Math.round(s.lpRune),
        price:  s.lpRune > 0 ? Math.round((s.tlpUsdt / s.lpRune) * 1e6) / 1e6 : 0,
        subPrice: Math.round(subPriceAtTlp(s.tlpUsdt) * 1e4) / 1e4,
      })),
    [fullSimulation]);

  /** Return the day TLP first reaches/exceeds the target. SIM_HORIZON_DAYS if not. */
  const dayWhenTlpReaches = (targetWan: number): number => {
    const target = targetWan * 10000;
    const found  = fullSimulation.find(s => s.tlpUsdt >= target);
    return found ? found.day : SIM_HORIZON_DAYS;
  };

  /** LP RUNE on a specific simulation day. */
  const lpRuneAt = (d: number): number =>
    fullSimulation[Math.min(d, SIM_HORIZON_DAYS)]?.lpRune ?? LAUNCH_LP_RUNE;

  /** TLP USDT (in 万) on a specific simulation day. */
  const tlpAt = (d: number): number =>
    (fullSimulation[Math.min(d, SIM_HORIZON_DAYS)]?.tlpUsdt ?? 0) / 10000;

  // Milestones — when each TLP target is reached, plus state at that day.
  const priceMilestones = useMemo(() => {
    return [
      { tlpTarget: 700,  label: "TLP 700万"   },
      { tlpTarget: 1750, label: "TLP 1750万"  },
      { tlpTarget: 3500, label: "TLP 3500万"  },
    ].map(({ tlpTarget, label }) => {
      const day      = dayWhenTlpReaches(tlpTarget);
      const lpRune   = lpRuneAt(day);
      const tlp      = tlpAt(day);
      const price    = lpRune > 0 ? (tlp * 10000) / lpRune : 0;
      const subPrice = subPriceAtTlp(tlp * 10000);
      return { day, label, data: { tlp, lpRune: Math.round(lpRune), price, subPrice } };
    });
  }, [fullSimulation]);

  // Dynamic mother-token target price per stage (six stages from the API).
  //   0: launch   — day 0
  //   1: TLP 700万  — day from sim
  //   2: TLP 1750万 — day from sim
  //   3: TLP 3500万 — day from sim
  //   4: 18-month post-cap extrapolation (TLP plateau, auto-burn ongoing)
  //   5: 24-month post-cap extrapolation
  const dynamicMotherPriceByStage = useMemo(() => {
    const stageTlp: Record<number, number> = {
      0: LAUNCH_TLP_WAN,
      1: 700,
      2: 1750,
      3: TARGET_TLP_WAN,
    };
    const out: Record<number, number> = {};
    for (const [idx, tlp] of Object.entries(stageTlp)) {
      const d  = dayWhenTlpReaches(tlp);
      const lp = lpRuneAt(d);
      const t  = tlpAt(d);
      out[Number(idx)] = lp > 0 ? (t * 10000) / lp : 0;
    }
    // Post-cap days — sim only runs to SIM_HORIZON_DAYS=540, so for stage
    // 5 (720d) extrapolate from the final state via auto-burn only.
    const finalState = fullSimulation[fullSimulation.length - 1];
    if (finalState) {
      for (const [idx, day] of [[4, 540], [5, 720]] as const) {
        const extraDays = Math.max(0, day - finalState.day);
        const lpRune = finalState.lpRune * Math.pow(1 - DAILY_PROTOCOL_BURN, extraDays);
        out[idx] = lpRune > 0 ? finalState.tlpUsdt / lpRune : 0;
      }
    }
    return out;
  }, [fullSimulation]);

  /** Returns the dynamic price for a stage, falling back to the API
   *  static motherPrice if the stage index isn't in the dynamic map. */
  const motherPriceForStage = (idx: number, fallback: number): number =>
    dynamicMotherPriceByStage[idx] ?? fallback;

  /** Format a price with sensible decimals (more for cents, fewer for $$). */
  const fmtPrice = (p: number): string =>
    p < 0.01 ? p.toFixed(4) : p < 1 ? p.toFixed(3) : p.toFixed(2);

  // Node comparison data — total returns per tier across all 6 stages,
  // priced via dynamic mother price so it reacts to both sliders.
  const nodeCompareData = useMemo(() => {
    const stages = overview?.priceStages ?? [];
    const nodes  = overview?.nodes       ?? [];
    return stages.map((stage, i) => {
      const dynPrice = motherPriceForStage(i, stage.motherPrice);
      const row: Record<string, string | number> = { label: stageLabel(stage, i) };
      nodes.forEach(n => {
        const motherVal  = n.motherTokensPerSeat * dynPrice;
        // Airdrop is mother-token (§六), so it prices off motherPrice too.
        const airdropVal = n.airdropPerSeat      * dynPrice;
        const usdtVal    = n.dailyUsdt * 180;
        row[n.level]     = Math.round(motherVal + airdropVal + usdtVal);
      });
      return row;
    });
  }, [overview, isEn, dynamicMotherPriceByStage]);

  // Six-stage trend chart data — uses dynamic mother prices so the curve
  // reacts to the burn-stake slider above. Sub-token retains static doc
  // targets (no dynamic model for sub-token yet).
  const priceStageChartData = useMemo(() => {
    const launchPrice = overview?.motherToken?.launchPrice ?? 0.028;
    return (overview?.priceStages ?? []).map((s, i) => {
      const dynMother = motherPriceForStage(i, s.motherPrice);
      return {
        label:  stageLabel(s, i),
        mother: Math.round(dynMother * 1e4) / 1e4,
        sub:    s.subPrice,
        mult:   launchPrice > 0 ? Math.round((dynMother / launchPrice) * 100) / 100 : s.multiplier,
      };
    });
  }, [overview, isEn, dynamicMotherPriceByStage]);

  const fundAllocData = useMemo(() => {
    const f = overview?.fundraising;
    if (!f) return [];
    // zh / zh-TW see the Chinese label; all other locales (en, ko, ja, th, vi) fall through to English.
    return [
      { name: isZh ? "TLP流动池" : "TLP Pool",     value: f.tlpPool    },
      { name: isZh ? "运营资金"   : "Operations",   value: f.operations },
      { name: isZh ? "国库资金"   : "Treasury",     value: f.treasury   },
      { name: isZh ? "子TOKEN LP" : "Sub-Token LP", value: f.subTokenLP },
    ];
  }, [overview, isZh]);

  // Re-price the calculator results using the dynamic mother price
  // (drives both sliders). Backend uses static priceStages.motherPrice;
  // we scale mother + airdrop by dynamic/static ratio. USDT income and
  // sub-token value are unaffected (not mother-priced).
  const dynamicCalc = useMemo(() => {
    if (!calcMutation.data) return null;
    const staticPrice  = overview?.priceStages?.[priceStageIndex]?.motherPrice ?? 0;
    const dynamicPrice = motherPriceForStage(priceStageIndex, staticPrice);
    const ratio = staticPrice > 0 ? dynamicPrice / staticPrice : 1;
    const d = calcMutation.data;
    const motherTokenValue  = d.motherTokenValue  * ratio;
    const airdropTokenValue = d.airdropTokenValue * ratio;
    const usdt              = d.totalUsdtIncome;
    const sub               = d.subTokenValue ?? 0;
    const totalAssets       = motherTokenValue + airdropTokenValue + usdt + sub;
    const investment        = d.investment;
    const roi               = investment > 0 ? (totalAssets / investment) * 100 : 0;
    const roiMultiplier     = investment > 0 ? totalAssets / investment : 0;
    return {
      ...d,
      motherTokenValue,
      airdropTokenValue,
      totalAssets,
      totalAssetsLow:  (d.totalAssetsLow  ?? 0) * ratio,
      totalAssetsHigh: (d.totalAssetsHigh ?? 0) * ratio,
      roi,
      roiMultiplier,
      ratio,
      dynamicPrice,
      staticPrice,
    };
  }, [calcMutation.data, priceStageIndex, dynamicMotherPriceByStage, overview]);

  const resultPieData = dynamicCalc ? [
    { name: isEn ? "Mother Token Value" : t("mr.rune.kpi.motherValue"),  value: dynamicCalc.motherTokenValue  },
    { name: isEn ? "Mother Airdrop"     : t("mr.rune.kpi.airdropValue"), value: dynamicCalc.airdropTokenValue },
    { name: isEn ? "Sub-Token (35% dyn)" : "子币 (动态35%)",            value: dynamicCalc.subTokenValue ?? 0 },
    { name: isEn ? "USDT Income (65% static)" : t("mr.rune.kpi.usdtIncome"), value: dynamicCalc.totalUsdtIncome },
  ] : [];

  // mother (gold) / mother-airdrop (gold variant) / sub-token (orange) / USDT (green-blue)
  const RESULT_COLORS = [C.mother, "#fbbf24", C.sub, C.usdt];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 py-8 space-y-10">

      {/* Back link */}
      <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />{bi("mr.detail.back", "Back to Projects")}
      </Link>

      {/* ── Header Banner ── */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 backdrop-blur-md px-6 py-8 md:px-10 shadow-[0_8px_40px_rgba(0,0,0,0.45)]">

        {/* Backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-28 -right-28 w-72 h-72 bg-primary/14 rounded-full blur-[90px] pointer-events-none animate-orb-drift" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-chart-2/8 rounded-full blur-[60px] pointer-events-none animate-float-y" />

        {/* Scan line */}
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-scan-line pointer-events-none" style={{ top: 0 }} />

        {/* Corner accents */}
        <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-primary/45 rounded-tl pointer-events-none" />
        <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-primary/45 rounded-tr pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-primary/45 rounded-bl pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-primary/45 rounded-br pointer-events-none" />

        <div className="relative z-10">
          {/* Logo + title */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-primary/25 shadow-[0_0_24px_rgba(251,191,36,0.25)] shrink-0 bg-black">
              <img src="/rune-logo.png" alt="RUNE Protocol" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="mb-1 leading-tight">
                {!isEn && (
                  <span className="block text-[11px] font-semibold tracking-[0.22em] text-primary/70">
                    {t("mr.rune.deepAnalysis")}
                  </span>
                )}
                <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/50 mt-0.5">
                  Deep Node Analysis
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
                RUNE Protocol
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {t("mr.rune.heroTagline").split(/\s*·\s*/).map((part, idx) => (
                  <span key={idx} className="inline-flex items-center text-xs sm:text-sm text-muted-foreground tracking-wide">
                    {idx > 0 && <span className="mr-2 text-primary/40">·</span>}
                    {part}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-border/30">
            {[
              { labelEn: "USDT APY",    i18nKey: "mr.rune.stat.apy",         end: 170.82, decimals: 2, prefix: "",  suffix: "%", highlight: true,  shimmer: true  },
              { labelEn: "TVL",         i18nKey: "mr.rune.stat.tvl",         end: 312,    decimals: 0, prefix: "$", suffix: "M", highlight: true,  shimmer: false },
              { labelEn: "Node Tiers",  i18nKey: "mr.rune.stat.nodeTiers",   end: 5,      decimals: 0, prefix: "",  suffix: "",  highlight: false, shimmer: false },
              { labelEn: "Price Stages",i18nKey: "mr.rune.stat.priceStages", end: 6,      decimals: 0, prefix: "",  suffix: "",  highlight: false, shimmer: false },
            ].map(({ labelEn, i18nKey, end, decimals, prefix, suffix, highlight, shimmer }, i) => (
              <motion.div
                key={labelEn}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-1"
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/55 font-medium">{labelEn}</div>
                <div className={`text-2xl leading-none ${shimmer ? "num-shimmer" : highlight ? "num-gold" : "num text-foreground"}`}>
                  <CountUp end={end} decimals={decimals} duration={1.4} prefix={prefix} suffix={suffix} separator="," preserveValue />
                </div>
                {!isEn && <div className="text-[11px] text-muted-foreground/70">{t(i18nKey)}</div>}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ═══ SHARED — protocol-level data dashboards (always visible above tabs).
          Token info / 6-stage price curve / fund allocation pie / sub-token deflation. */}

      {/* ── Token Info — 3D raised buttons ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4"><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-36 rounded-2xl" /></div>
      ) : (overview?.motherToken && overview?.subToken) ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {([
            {
              kind: "mother" as const,
              labelKey: "mr.rune.token.mother",
              labelEn: "Mother Token",
              symbol: overview.motherToken.symbol,
              tintVars: "[--token-tint:217_80%_58%] [--token-border:217_80%_48%]",
              labelColor: "text-sky-300",
              symbolColor: "text-sky-200",
              Icon: Flame,
              rows: [
                { kKey: "mr.rune.token.open",      kEn: "Open",        v: `$${overview.motherToken.launchPrice}`, accent: false },
                { kKey: "mr.rune.token.supply",    kEn: "Supply",      v: isEn ? `${((overview.motherToken.totalSupply ?? 0)/1e6).toFixed(0)}M` : `${((overview.motherToken.totalSupply ?? 0)/1e8).toFixed(1)}亿${t("mr.rune.kpi.tokensUnit")}`, accent: false },
                { kKey: "mr.rune.token.dailyBurn", kEn: "Daily Burn",  v: `${((overview.motherToken.dailyBurnRate ?? 0)*100).toFixed(1)}%`, accent: false },
                { kKey: "mr.rune.token.target24M", kEn: "24M Target",  v: `$${overview.motherToken.targetPriceLow}~${overview.motherToken.targetPriceHigh}`, accent: true },
              ],
            },
            {
              kind: "sub" as const,
              labelKey: "mr.rune.token.sub",
              labelEn: "Sub Token",
              symbol: overview.subToken.symbol,
              tintVars: "[--token-tint:30_92%_58%] [--token-border:30_92%_48%]",
              labelColor: "text-orange-300",
              symbolColor: "text-orange-200",
              Icon: TrendingUp,
              rows: [
                { kKey: "mr.rune.token.initial",   kEn: "Initial",     v: `$${overview.subToken.launchPrice}`, accent: false },
                { kKey: "mr.rune.token.supply",    kEn: "Supply",      v: `${((overview.subToken.totalSupply ?? 0)/1e6).toFixed(1)}M`, accent: false },
                { kKey: "mr.rune.token.dailyBurn", kEn: "Daily Burn",  v: `${((overview.subToken.dailyBurnRate ?? 0)*100).toFixed(1)}%`, accent: false },
                { kKey: "mr.rune.token.target24M", kEn: "24M Target",  v: `$${overview.subToken.targetPriceLow}~${overview.subToken.targetPriceHigh}`, accent: true },
              ],
            },
          ]).map(({ kind, labelKey, labelEn, symbol, tintVars, labelColor, symbolColor, Icon, rows }, i) => (
            <motion.button
              key={kind}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileTap={{ scale: 0.985 }}
              onClick={(e) => {
                const el = e.currentTarget;
                el.classList.remove("haptic-pulse");
                // force reflow so animation can replay
                void el.offsetWidth;
                el.classList.add("haptic-pulse");
              }}
              className={`token-card-3d ${tintVars} text-left p-5 w-full`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[11px] uppercase tracking-[0.22em] font-semibold ${labelColor}`}>
                  {isEn ? labelEn : t(labelKey)}
                  {isZh && <> · <span className="opacity-70">{labelEn}</span></>}
                </span>
                <Icon className={`h-4 w-4 ${labelColor} opacity-70`} />
              </div>
              <p className={`num text-5xl sm:text-6xl leading-none mb-4 ${symbolColor}`}>
                {symbol}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {rows.map((r) => (
                  <div key={r.kKey} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{isEn ? r.kEn : t(r.kKey)}</span>
                    <span className={r.accent ? "num num-gold text-base" : "num text-foreground text-base"}>{r.v}</span>
                  </div>
                ))}
              </div>
            </motion.button>
          ))}
        </motion.div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          ANALYSIS SECTION — 深度分析图表
      ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.15 }}
        className="space-y-8">

        {/* Tech-style section header */}
        <div className="relative pb-4">
          {/* Animated underline */}
          <motion.div
            className="absolute left-0 right-0 bottom-0 h-px pointer-events-none"
            style={{ background: "linear-gradient(90deg, hsl(var(--primary)/0.5) 0%, hsl(var(--primary)/0.2) 30%, transparent 100%)" }}
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
          />
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-stretch gap-4 min-w-0">
              {/* Glowing accent bar */}
              <motion.div
                className="w-[3px] rounded-full bg-gradient-to-b from-primary via-primary/80 to-primary/20"
                initial={{ scaleY: 0, originY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                style={{ boxShadow: "0 0 12px hsl(var(--primary)/0.6)" }}
              />
              <div>
                {!isEn && <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/60 block mb-0.5">{t("mr.rune.section.analysis.eyebrow")}</span>}
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {isEn ? "Market Analysis" : isZh ? `${t("mr.rune.section.analysis.title")} · Market Analysis` : t("mr.rune.section.analysis.title")}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("mr.rune.section.analysis.desc")}</p>
              </div>
            </div>

            {/* Live status badge */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/20 bg-primary/5 backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-primary/80 font-semibold">
                Real-time Data Stream
              </span>
            </motion.div>
          </div>
        </div>

        {/* Row 1: Price Stages + Fund Allocation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Chart 1: Six-Stage Dual Line — 2/3 width */}
          <TechChartCard
            icon={BarChart2}
            title={isEn ? "Six-Stage Dual Line" : (isZh ? `${t("mr.rune.chart.priceStages")} · Six-Stage Dual Line` : t("mr.rune.chart.priceStages"))}
            subtitle="$0.028 → $4.56 · 120×"
            accent="primary"
            delay={0.05}
            className="lg:col-span-2"
          >
            {priceStageChartData.length > 0 ? (
              <div className="relative">
                {/* Pulsing ambient glow inside chart area */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -top-8 -right-8 h-[260px] w-[260px] rounded-full"
                  style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.10), transparent 65%)" }}
                  animate={{ opacity: [0.4, 0.85, 0.4] }}
                  transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* Log/Linear toggle */}
                <div className="absolute top-0 right-2 z-10 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-background/50 p-1 text-[11px] uppercase tracking-[0.18em] backdrop-blur">
                  {(["log", "linear"] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTrendScale(s)}
                      className={`rounded-full px-3 py-0.5 num tabular-nums transition-all ${
                        trendScale === s
                          ? "bg-primary/25 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.4)]"
                          : "text-muted-foreground/60 hover:text-primary/80"
                      }`}
                    >
                      {s === "log" ? (isEn ? "Log" : (isZh ? "对数" : "Log")) : (isEn ? "Linear" : (isZh ? "线性" : "Linear"))}
                    </button>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={priceStageChartData} margin={{ top: 28, right: 18, left: 0, bottom: 6 }}>
                    <defs>
                      <linearGradient id="lineMotherGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={C.mother} stopOpacity={0.4}  />
                        <stop offset="100%" stopColor={C.mother} stopOpacity={1}    />
                      </linearGradient>
                      <linearGradient id="lineSubGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={C.sub} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={C.sub} stopOpacity={1}   />
                      </linearGradient>
                      <linearGradient id="areaMotherGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"  stopColor={C.mother} stopOpacity={0.32} />
                        <stop offset="100%" stopColor={C.mother} stopOpacity={0}   />
                      </linearGradient>
                      <linearGradient id="areaSubGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"  stopColor={C.sub} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={C.sub} stopOpacity={0}   />
                      </linearGradient>
                      <filter id="trendGlow">
                        <feGaussianBlur stdDeviation="2" result="b" />
                        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    {/* Dual Y axes: mother (~$0.03–$3) and sub (~$0.04–$450)
                        differ by ~100×, so a single linear axis crushes the
                        mother line to a flat baseline. Splitting them lets
                        each token render on its own scale. */}
                    <YAxis
                      yAxisId="mother"
                      orientation="left"
                      tick={{ fill: C.mother, fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      scale={trendScale}
                      domain={trendScale === "log" ? [0.02, "auto"] : [0, "auto"]}
                      allowDataOverflow
                      tickFormatter={v => v >= 1 ? `$${(+v).toFixed(1)}` : `$${(+v).toFixed(2)}`}
                    />
                    <YAxis
                      yAxisId="sub"
                      orientation="right"
                      tick={{ fill: C.sub, fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      scale={trendScale}
                      domain={trendScale === "log" ? [0.04, "auto"] : [0, "auto"]}
                      allowDataOverflow
                      tickFormatter={v => v >= 100 ? `$${(+v).toFixed(0)}` : v >= 1 ? `$${(+v).toFixed(0)}` : `$${(+v).toFixed(2)}`}
                    />
                    <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`$${fmt(v, v < 1 ? 4 : 2)}`, name]} animationDuration={180} />
                    <Legend wrapperStyle={{ fontSize: 11, color: C.muted, paddingTop: 8 }} iconType="circle" />
                    <Line
                      yAxisId="mother"
                      type="monotone" dataKey="mother"
                      name={isEn ? "Mother Token (符)" : `${t("mr.rune.token.mother")} (符)`}
                      stroke={C.mother} strokeWidth={2.8}
                      dot={{ r: 3.5, fill: C.mother, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: C.mother, stroke: "#fff", strokeWidth: 1.5 }}
                      style={{ filter: "url(#trendGlow)" }}
                      animationDuration={1600} animationBegin={150}
                    />
                    <Line
                      yAxisId="sub"
                      type="monotone" dataKey="sub"
                      name={isEn ? "Sub Token (符火)" : `${t("mr.rune.token.sub")} (符火)`}
                      stroke={C.sub} strokeWidth={2.8}
                      dot={{ r: 3.5, fill: C.sub, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: C.sub, stroke: "#fff", strokeWidth: 1.5 }}
                      style={{ filter: "url(#trendGlow)" }}
                      animationDuration={1600} animationBegin={400}
                    />
                  </ComposedChart>
                </ResponsiveContainer>

                {/* Multiplier strip below */}
                <div className="grid grid-cols-6 gap-1 mt-2 px-1">
                  {priceStageChartData.map((d: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.9 + i * 0.07 }}
                      className="text-center"
                    >
                      <span className={`num text-[11px] tabular-nums ${d.mult >= 80 ? "text-primary font-semibold" : d.mult > 1 ? "text-primary/60" : "text-muted-foreground/50"}`}>
                        {d.mult > 1 ? `${d.mult}×` : "—"}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            )}
          </TechChartCard>

          {/* Chart 2: Fund Allocation – 1/3 width — stacked bar + animated rows */}
          <TechChartCard
            icon={PieIcon}
            title={isEn ? "Fund Allocation" : `${t("mr.rune.chart.fundAlloc")}${isZh ? " · Fund Allocation" : ""}`}
            accent="chart-1"
            delay={0.15}
          >
            {fundAllocData.length > 0 ? (() => {
              const total = fundAllocData.reduce((s, x) => s + (x.value ?? 0), 0) || 1;
              return (
                <div className="px-2 pb-1">
                  {/* Total raised + counter */}
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground/60 mb-1">
                        {isEn ? "Total Raised" : (isZh ? "总融资规模" : "Total Raised")}
                      </p>
                      <div className="num-shimmer text-3xl leading-none">
                        <CountUp end={total / 1e6} prefix="$" suffix="M" decimals={1} duration={1.4} preserveValue />
                      </div>
                    </div>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground/50">
                      {fundAllocData.length} {isEn ? "Allocations" : (isZh ? "项分配" : "Allocations")}
                    </span>
                  </div>

                  {/* Stacked horizontal bar */}
                  <div className="relative h-3 rounded-full bg-border/25 overflow-hidden flex gap-[2px] mb-1.5">
                    {fundAllocData.map((d, i) => {
                      const pct = ((d.value ?? 0) / total) * 100;
                      return (
                        <motion.div
                          key={i}
                          className="h-full flex-none rounded-full"
                          style={{
                            background: PIE_COLORS[i],
                            boxShadow: `0 0 10px ${PIE_COLORS[i]}55`,
                          }}
                          initial={{ width: "0%", opacity: 0 }}
                          animate={{ width: `${pct}%`, opacity: 1 }}
                          transition={{ duration: 1.0, delay: 0.3 + i * 0.14, ease: [0.22, 1, 0.36, 1] }}
                        />
                      );
                    })}
                  </div>
                  {/* Percentage labels under bar */}
                  <div className="flex mb-4">
                    {fundAllocData.map((d, i) => {
                      const pct = ((d.value ?? 0) / total) * 100;
                      return (
                        <motion.div key={i} className="overflow-hidden"
                          style={{ width: `${pct}%` }}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: 0.7 + i * 0.14 }}>
                          <span className="num text-[11px] tabular-nums" style={{ color: PIE_COLORS[i] }}>
                            {pct.toFixed(0)}%
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Per-allocation rows with pulsing dot + progress */}
                  <div className="space-y-3">
                    {fundAllocData.map((d, i) => {
                      const pct = ((d.value ?? 0) / total) * 100;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -12, filter: "blur(4px)" }}
                          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                          transition={{ duration: 0.55, delay: 0.5 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                          className="space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <motion.span
                                className="shrink-0 w-2 h-2 rounded-sm"
                                style={{ background: PIE_COLORS[i] }}
                                animate={{
                                  boxShadow: [
                                    `0 0 0px ${PIE_COLORS[i]}`,
                                    `0 0 9px ${PIE_COLORS[i]}`,
                                    `0 0 0px ${PIE_COLORS[i]}`,
                                  ],
                                }}
                                transition={{ duration: 2.4 + i * 0.35, repeat: Infinity, ease: "easeInOut" }}
                              />
                              <span className="text-xs text-foreground/90 font-medium truncate">{d.name}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="num text-xs font-semibold tabular-nums" style={{ color: PIE_COLORS[i] }}>
                                <CountUp end={(d.value ?? 0) / 1e6} prefix="$" suffix="M" decimals={1}
                                  duration={1 + i * 0.15} preserveValue />
                              </span>
                            </div>
                          </div>
                          <div className="h-[3px] rounded-full bg-border/25 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: `linear-gradient(90deg, ${PIE_COLORS[i]}, ${PIE_COLORS[i]}66)` }}
                              initial={{ width: "0%" }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 1.0, delay: 0.6 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })() : (
              <Skeleton className="h-[280px] w-full" />
            )}
          </TechChartCard>
        </div>

        {/* Row 2: Node Comparison + Deflation Curve */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Chart 3: Node Returns by Stage */}
          <TechChartCard
            icon={TrendingUp}
            title={isEn ? "Node Returns / Stage" : `${t("mr.rune.chart.nodeCompare")}${isZh ? " · Node Returns / Stage" : ""}`}
            subtitle={t("mr.rune.chart.nodeCompare.sub")}
            accent="amber-500"
            delay={0.25}
          >
            {nodeCompareData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={nodeCompareData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <defs>
                    {(overview?.nodes ?? []).map((n, i) => (
                      <linearGradient key={n.level} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={Object.values(C).slice(0,4)[i]} stopOpacity={0.32} />
                        <stop offset="95%" stopColor={Object.values(C).slice(0,4)[i]} stopOpacity={0}    />
                      </linearGradient>
                    ))}
                    <filter id="lineGlow">
                      <feGaussianBlur stdDeviation="1.4" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v}`} />
                  <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`$${fmt(v, 0)}`, name]} animationDuration={180} />
                  <Legend wrapperStyle={{ fontSize: 11, color: C.muted, paddingTop: 4 }} iconType="circle" />
                  {(overview?.nodes ?? []).map((n, i) => (
                    <Area key={n.level} type="monotone" dataKey={n.level} name={nodeName(n)}
                      stroke={Object.values(C)[i]} strokeWidth={2.2}
                      fill={`url(#grad-${i})`} dot={false}
                      style={{ filter: "url(#lineGlow)" }}
                      animationDuration={1300} animationBegin={i * 120 + 200} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-[260px] w-full" />
            )}
          </TechChartCard>

          {/* Chart 4: Sub-token Deflation Curve */}
          <TechChartCard
            icon={Flame}
            title={isEn ? "Deflation Curve" : `${t("mr.rune.chart.deflation")}${isZh ? " · Deflation Curve" : ""}`}
            subtitle={t("mr.rune.chart.deflation.sub")}
            accent="orange-500"
            delay={0.35}
          >
            {deflationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={deflationData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gradCirc"  x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.sub}    stopOpacity={0.4} />
                      <stop offset="95%" stopColor={C.sub}    stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="gradBurn"  x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(0,80%,55%)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="hsl(0,80%,55%)" stopOpacity={0}   />
                    </linearGradient>
                    <filter id="burnGlow">
                      <feGaussianBlur stdDeviation="1.4" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v/1e6).toFixed(1)}M`} />
                  <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`${(v/1e6).toFixed(3)}M ${isEn ? "tokens" : t("mr.rune.kpi.tokensUnit")}`, name]} animationDuration={180} />
                  <Legend wrapperStyle={{ fontSize: 11, color: C.muted, paddingTop: 4 }} iconType="circle" />
                  <Area type="monotone" dataKey="circulating" name={isEn ? "Circulating" : (t("metrics.circulation") || "Circulating")} stroke={C.sub} strokeWidth={2.4} fill="url(#gradCirc)" dot={false}
                    style={{ filter: "url(#burnGlow)" }}
                    animationDuration={1400} animationBegin={200} />
                  <Area type="monotone" dataKey="burned"      name={isEn ? "Burned"      : (t("metrics.burned")      || "Burned")}      stroke="hsl(0,80%,55%)" strokeWidth={1.8} fill="url(#gradBurn)" dot={false} strokeDasharray="4 2"
                    style={{ filter: "url(#burnGlow)" }}
                    animationDuration={1400} animationBegin={400} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-[260px] w-full" />
            )}
          </TechChartCard>
        </div>
      </motion.div>

      {/* ── Dynamic mother-token price simulation (added 2026-04-28) ──
          Drops doc's static 80-120× target. Models price from LP supply
          dynamics: TLP USDT side ramps to 3500万 by day 180, LP RUNE
          drains by 0.2% protocol burn + user burn-stake (slider). */}
      <Card className="surface-3d border-amber-700/30 bg-gradient-to-br from-slate-900/70 to-slate-950/80">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
            <TrendingUp className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="break-keep">{isEn ? "Dynamic RUNE + FIRE Price Simulation" : "动态母币 + 子币价格模拟"}</span>
            <span className="text-[10px] bg-amber-900/40 text-amber-300 border border-amber-700/30 px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase shrink-0">{isEn ? "Estimated" : "预估"}</span>
          </CardTitle>
          <p className="text-[11px] text-muted-foreground/80 mt-1 leading-snug">
            {isEn
              ? "Bottom-up activity model. Two ground-truth knobs: monthly burn-stake users × avg package USDT. Their product feeds TLP (USDT in) and AMM-drains LP RUNE (RUNE out via constant-product math). Protocol auto-burn 0.2%/day stacks on top. Stage milestones emerge — they're not pinned to specific days."
              : "自底向上活动模型。两个基本面输入：月度活跃 burn-staker 人数 × 平均套餐 USDT。乘积 = 月度 USDT 流入 TLP，同时按 AMM 恒定乘积公式从 LP 抽走 RUNE，叠加 0.2%/日 协议自销毁。阶段时间点完全由活动量涌现，不再写死。"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Two ground-truth sliders — # users × pkg size drives everything. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Monthly active users */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{isEn ? "Monthly active burn-stakers" : "月度活跃 burn-staker 人数"}</Label>
                <span className="num text-xs text-amber-300">{monthlyActiveUsers.toLocaleString()}</span>
              </div>
              <Slider value={[monthlyActiveUsers]} min={100} max={5000} step={50}
                onValueChange={(v) => setMonthlyActiveUsers(v[0] ?? 1500)} className="py-1" />
              <div className="flex justify-between text-[9px] text-muted-foreground/50">
                <span>100</span><span>1,500</span><span>5,000</span>
              </div>
            </div>
            {/* Average package size */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{isEn ? "Avg package (USDT)" : "平均套餐 (USDT)"}</Label>
                <span className="num text-xs text-amber-300">${avgPackageUsdt.toLocaleString()}</span>
              </div>
              <Slider value={[avgPackageUsdt]} min={300} max={14000} step={100}
                onValueChange={(v) => setAvgPackageUsdt(v[0] ?? 3600)} className="py-1" />
              <div className="flex justify-between text-[9px] text-muted-foreground/50">
                <span>$300</span><span>$3,600</span><span>$14,000</span>
              </div>
            </div>
          </div>

          {/* Derived inflow tag — so users see the math */}
          <div className="text-[10px] text-muted-foreground/70 text-center">
            {isEn
              ? `Derived: ${monthlyActiveUsers.toLocaleString()} users × $${avgPackageUsdt.toLocaleString()} = $${((monthlyActiveUsers * avgPackageUsdt)/10000).toFixed(1)}万 USDT / mo into TLP. RUNE drains via AMM swap math + 0.2%/day protocol auto-burn.`
              : `推导：${monthlyActiveUsers.toLocaleString()} 人 × $${avgPackageUsdt.toLocaleString()} = ${((monthlyActiveUsers * avgPackageUsdt)/10000).toFixed(1)}万 USDT / 月 进入 TLP。RUNE 由 AMM 兑换数学 + 0.2%/日 协议自销毁同时收缩。`}
          </div>

          {/* Milestone KPI row — shows the selected token's price at each TLP milestone. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {priceMilestones.map(({ day, label, data }) => {
              const reached    = day < SIM_HORIZON_DAYS;
              const tokenPrice = simTokenView === "mother" ? (data?.price ?? 0) : (data?.subPrice ?? 0);
              const tokenColor = simTokenView === "mother" ? "text-amber-200" : "text-orange-200";
              return (
                <div key={label} className="p-3 rounded-xl border border-border/40 bg-card/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="text-[10px] text-muted-foreground/60 num">
                    {reached ? (isEn ? `≈ Day ${Math.round(day)}` : `≈ 第 ${Math.round(day)} 天`)
                             : (isEn ? "Out of horizon" : "超出 18 个月窗口")}
                  </p>
                  <p className={`num text-base ${tokenColor} mt-1`}>${tokenPrice.toFixed(tokenPrice < 1 ? 4 : 2)}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 num">
                    {simTokenView === "mother"
                      ? `LP ${fmt((data?.lpRune ?? 0) / 1e6, 1)}M`
                      : (isEn ? "FIRE price" : "FIRE 价格")}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Mother / Sub toggle — switches the single line shown on the chart. */}
          <div className="relative">
            <div className="absolute top-0 right-0 z-10 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-background/50 p-1 text-[11px] uppercase tracking-[0.18em] backdrop-blur">
              {(["mother", "sub"] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSimTokenView(s)}
                  className={`rounded-full px-3 py-0.5 num tabular-nums transition-all ${
                    simTokenView === s
                      ? "bg-primary/25 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.4)]"
                      : "text-muted-foreground/60 hover:text-primary/80"
                  }`}
                >
                  {s === "mother" ? (isEn ? "RUNE" : "母币") : (isEn ? "FIRE" : "子币")}
                </button>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={priceSimulation} margin={{ top: 28, right: 12, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="gradPriceSim" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={simTokenView === "mother" ? C.mother : C.sub} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={simTokenView === "mother" ? C.mother : C.sub} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}d`} />
                <YAxis tick={{ fill: simTokenView === "mother" ? C.mother : C.sub, fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 100 ? `$${v.toFixed(0)}` : v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(3)}`} />
                <Tooltip {...tooltipStyle}
                  formatter={(v: number) => [
                    `$${v.toFixed(v < 1 ? 4 : 2)}`,
                    simTokenView === "mother" ? (isEn ? "RUNE Price" : "RUNE 价格") : (isEn ? "FIRE Price" : "FIRE 子币价格"),
                  ]}
                  labelFormatter={(d: number) => isEn ? `Day ${d}` : `第 ${d} 天`}
                  animationDuration={180} />
                <Area type="monotone"
                  dataKey={simTokenView === "mother" ? "price" : "subPrice"}
                  stroke={simTokenView === "mother" ? C.mother : C.sub}
                  strokeWidth={2.4} fill="url(#gradPriceSim)" dot={false}
                  animationDuration={1400} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            {isEn
              ? "Day-stepped AMM sim. Each day: actualInflow = users·pkg/30 (capped at TLP cap headroom); swapOut = lpRune · actualInflow / (tlpUsdt + actualInflow); burnOut = lpRune · 0.2%; tlpUsdt += actualInflow; lpRune -= swapOut + burnOut. Inflow stops when cap is hit; auto-burn keeps grinding LP RUNE down past then. More users / bigger packages → both axes move faster simultaneously."
              : "逐日 AMM 模拟。每天：实际流入 = 人数·套餐/30（受 TLP 余量限制）；AMM 兑换流出 = lpRune · 流入 / (tlpUsdt + 流入)；协议烧 = lpRune · 0.2%；tlpUsdt 加流入，lpRune 减(兑换 + 烧)。封顶后流入归零，协议烧继续。人数 ↑ 或套餐 ↑ → 两轴同步加速。"}
          </p>
        </CardContent>
      </Card>

      {/* ── v2 tab nav (sits AFTER shared dashboards per user request 2026-04-28) ── */}
      <div className="surface-3d rounded-xl border border-border/40 bg-card/40 p-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-0.5 min-w-max relative">
          {[
            { id: "calc" as const, labelEn: "CALC",       labelCn: "节点收益计算器" },
            { id: "node" as const, labelEn: "NODES",      labelCn: "节点" },
            { id: "pkg"  as const, labelEn: "STAKE",      labelCn: "质押" },
            { id: "dual" as const, labelEn: "BURN STAKE", labelCn: "销毁质押" },
          ].map(({ id, labelEn, labelCn }) => {
            const active = v2Tab === id;
            return (
              <button
                key={id}
                onClick={() => setV2Tab(id)}
                className={`relative z-10 flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  active ? "text-amber-100" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="runeV2TabPill"
                    className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-500/20 via-amber-600/15 to-amber-700/10 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35),0_8px_24px_-8px_rgba(251,191,36,0.35)]"
                    transition={{ type: "spring", stiffness: 340, damping: 32 }}
                  />
                )}
                <span className="relative tracking-wider">{isEn ? labelEn : labelCn}</span>
                {!isEn && <span className="relative text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/60">{labelEn}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ NODES TAB ═══ — node-specific data: airdrop release table per stage,
          trading-driven daily dividend per tier, weight allocation. */}
      {v2Tab === "node" && (() => {
        const stagesUnlock = [
          { idx: 0, label: isEn ? "Stage 1 · Launch (20%)" : "阶段 1 · 启动 (20%)",   release: 0.20 },
          { idx: 1, label: isEn ? "Stage 2 · TLP 700万 (30%)" : "阶段 2 · TLP 700万 (30%)", release: 0.30 },
          { idx: 2, label: isEn ? "Stage 3 · TLP 1750万 (30%)" : "阶段 3 · TLP 1750万 (30%)", release: 0.30 },
          { idx: 3, label: isEn ? "Stage 4 · TLP 3500万 (20%)" : "阶段 4 · TLP 3500万 (20%)", release: 0.20 },
        ];
        const stages4 = [
          { idx: 0, tlp: 280,  qep: 360,  trp: 160,  tvl: 800 },
          { idx: 1, tlp: 700,  qep: 900,  trp: 400,  tvl: 2000 },
          { idx: 2, tlp: 1750, qep: 2250, trp: 1000, tvl: 5000 },
          { idx: 3, tlp: 3500, qep: 4500, trp: 2000, tvl: 10000 },
        ];
        // Trading-dividend rates per RUNE_全面技术说明文档.md §四.3
        // (上一版用了 节点招募计划.md 的旧 2%/3% 数字，与全面技术说明
        // 5%/5% 不一致 — 以全面技术说明文档为准, 2026-05-01 更正).
        const MOTHER_BUY_TAX  = 0.05;  // 母币买入滑点 5% (2%节点 + 3%社区)
        const MOTHER_SELL_TAX = 0.05;  // 母币卖出滑点 5% (2%社区 + 3%销毁)
        const SUB_BUY_TAX     = 0.05;  // 子币买入滑点 5% (2%节点 + 3%社区)
        const SUB_SELL_TAX    = 0.05;  // 子币卖出滑点 5% (4%销毁 + 1%社区)
        // "母币每天燃烧 0.2% 的 1%" / "子币每天燃烧 0.1% 的 2%"
        const MOTHER_BURN_DAILY = 0.002;
        const MOTHER_BURN_NODE  = 0.01;
        const SUB_BURN_DAILY    = 0.001;
        const SUB_BURN_NODE     = 0.02;
        const nodes = overview?.nodes ?? [];
        return (
          <div className="space-y-6">

            {/* 4-stage airdrop release table */}
            <Card className="surface-3d border-amber-700/30">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  <Layers className="h-4 w-4 text-amber-400 shrink-0" />
                  {isEn ? "Mother-Token Airdrop · 4-Stage Release Per Tier" : "节点空投 · 4 阶段释放表"}
                </CardTitle>
                <p className="text-[11px] text-muted-foreground/80 mt-1">
                  {isEn ? "Per `节点招募计划.md` §权益2: tokens unlock at TLP milestones (20/30/30/20%)." : "节点招募计划.md §权益2：按 TLP 里程碑解锁释放（20/30/30/20%）。"}
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground/70 uppercase tracking-wider">
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 px-2 sticky left-0 bg-card/80 backdrop-blur">{isEn ? "Tier" : "档位"}</th>
                        <th className="text-right py-2 px-2">{isEn ? "Total" : "总额"}</th>
                        {stagesUnlock.map((s) => (
                          <th key={s.idx} className="text-right py-2 px-2 whitespace-nowrap">{s.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map((n) => (
                        <tr key={n.level} className="border-b border-border/20">
                          <td className="py-2 px-2 sticky left-0 bg-card/40 backdrop-blur">
                            <div className="text-foreground">{nodeName(n)}</div>
                            <div className="text-[10px] text-muted-foreground">${n.investment.toLocaleString()}</div>
                          </td>
                          <td className="py-2 px-2 text-right num">{n.airdropPerSeat.toLocaleString()}</td>
                          {stagesUnlock.map((s) => {
                            const tokens = n.airdropPerSeat * s.release;
                            const stage = overview?.priceStages?.[s.idx];
                            const dynPrice = motherPriceForStage(s.idx, stage?.motherPrice ?? 0);
                            const usd = tokens * dynPrice;
                            return (
                              <td key={s.idx} className="py-2 px-2 text-right">
                                <div className="num text-foreground">{tokens.toLocaleString()}</div>
                                <div className="text-[10px] text-amber-300/80 num">${fmt(usd, 0)}</div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Trading dividend per tier per stage */}
            <Card className="surface-3d border-border/40">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap text-foreground">
                  <Activity className="h-4 w-4 text-primary shrink-0" />
                  {isEn ? "Trading Dividend · Daily Per Tier" : "交易分红 · 每档每日"}
                  <span className="text-[10px] bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase shrink-0">{isEn ? "Estimated" : "预估"}</span>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {isEn
                    ? "Mother buy-tax 2% + sell-profit-tax 5%. Sub buy-tax 2% + sell-profit-tax 3%. Daily burn share: mother 0.2%·1%, sub 0.1%·2%. Pool split by weight (2880 total)."
                    : "母币买入滑点 2% + 卖出盈利税 5%；子币买入滑点 2% + 卖出盈利税 3%；母币日烧 0.2%×1%、子币日烧 0.1%×2% 入节点池。按权重 2880 分配。"}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Three doc-grounded inputs — replaces the made-up turnover/AI-share knobs. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: isEn ? "Mother daily volume (USDT)" : "母币日交易额 (USDT)", value: motherDailyVolume, setter: setMotherDailyVolume, min: 100_000, max: 10_000_000, step: 50_000, fmt: (v: number) => `$${(v/10000).toFixed(0)}万` },
                    { label: isEn ? "Sub daily volume (USDT)"    : "子币日交易额 (USDT)", value: subDailyVolume,    setter: setSubDailyVolume,    min: 50_000,  max: 5_000_000,  step: 25_000, fmt: (v: number) => `$${(v/10000).toFixed(0)}万` },
                    { label: isEn ? "Avg sell profit %"          : "平均卖出盈利率 (%)",  value: avgSellProfitPct,  setter: setAvgSellProfitPct,  min: 5,       max: 50,         step: 1,      fmt: (v: number) => `${v}%` },
                  ].map(({ label, value, setter, min, max, step, fmt: vfmt }) => (
                    <div key={label} className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
                        <span className="num text-xs text-primary">{vfmt(value)}</span>
                      </div>
                      <Slider value={[value]} min={min} max={max} step={step}
                        onValueChange={(v) => setter(v[0] ?? value)} className="py-1" />
                      <div className="flex justify-between text-[9px] text-muted-foreground/60">
                        <span>{vfmt(min)}</span><span>{vfmt(max)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground uppercase tracking-wider">
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 px-2 sticky left-0 bg-card/80 backdrop-blur">{isEn ? "Stage" : "阶段"}</th>
                        <th className="text-right py-2 px-2 whitespace-nowrap">{isEn ? "Trade tax/day" : "交易税/日"}</th>
                        <th className="text-right py-2 px-2 whitespace-nowrap">{isEn ? "Burn share/day" : "燃烧分红/日"}</th>
                        <th className="text-right py-2 px-2 whitespace-nowrap">{isEn ? "Pool/day" : "节点池/日"}</th>
                        {nodes.map((n) => (
                          <th key={n.level} className="text-right py-2 px-2 whitespace-nowrap">{nodeName(n)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stages4.map((s) => {
                        // Trade-tax slice: assume 50/50 buy/sell split. Buy half pays
                        // slippage on full notional; sell half pays profit-tax on
                        // (notional × profit %). Sub doesn't trade at Stage 1
                        // (TLP < 500万 — sub launch threshold per 模型制度.md §壹).
                        const subActive = s.tlp >= 500;
                        const profit = avgSellProfitPct / 100;
                        const motherTradeShare = motherDailyVolume * (0.5 * MOTHER_BUY_TAX + 0.5 * MOTHER_SELL_TAX * profit);
                        const subTradeShare    = subActive ? subDailyVolume * (0.5 * SUB_BUY_TAX + 0.5 * SUB_SELL_TAX * profit) : 0;

                        // Burn-share slice: mother LP + sub LP at this stage's day,
                        // valued at that stage's price. Sub uses static doc target
                        // since we don't have a sub-side dynamic model yet.
                        const stageDay      = dayWhenTlpReaches(s.tlp);
                        const motherLp      = lpRuneAt(stageDay);
                        const motherPriceN  = motherPriceForStage(s.idx, overview?.priceStages?.[s.idx]?.motherPrice ?? 0);
                        const motherBurnSh  = motherLp * MOTHER_BURN_DAILY * MOTHER_BURN_NODE * motherPriceN;
                        const subSupplyEst  = subActive ? (overview?.subToken?.totalSupply ?? 13_100_000) : 0;
                        const subPriceN     = overview?.priceStages?.[s.idx]?.subPrice ?? 0;
                        const subBurnSh     = subSupplyEst * SUB_BURN_DAILY * SUB_BURN_NODE * subPriceN;

                        const tradeTax    = motherTradeShare + subTradeShare;
                        const burnShare   = motherBurnSh + subBurnSh;
                        const nodePoolDay = tradeTax + burnShare;
                        return (
                          <tr key={s.idx} className="border-b border-border/20">
                            <td className="py-2 px-2 sticky left-0 bg-card/40 backdrop-blur whitespace-nowrap">
                              <div className="text-foreground">{isEn ? `Stage ${s.idx + 1}` : `阶段 ${s.idx + 1}`}</div>
                              <div className="text-[10px] text-muted-foreground">TLP {s.tlp}万{!subActive && (isEn ? " · sub paused" : " · 子币未开")}</div>
                            </td>
                            <td className="py-2 px-2 text-right num text-foreground/80 whitespace-nowrap">${fmt(tradeTax, 0)}</td>
                            <td className="py-2 px-2 text-right num text-foreground/80 whitespace-nowrap">${fmt(burnShare, 0)}</td>
                            <td className="py-2 px-2 text-right num text-primary whitespace-nowrap">${fmt(nodePoolDay, 0)}</td>
                            {nodes.map((n) => {
                              const perSeat = (nodePoolDay * n.weight) / TOTAL_NODE_WEIGHT;
                              return (
                                <td key={n.level} className="py-2 px-2 text-right num text-foreground whitespace-nowrap">${fmt(perSeat, 2)}</td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Node weight & seats */}
            <Card className="surface-3d border-amber-700/30">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  <BarChart2 className="h-4 w-4 text-amber-400 shrink-0" />
                  {isEn ? "Node Weights & Seats" : "节点权重 / 席位"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground/70 uppercase tracking-wider">
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 px-2">{isEn ? "Tier" : "档位"}</th>
                        <th className="text-right py-2 px-2">{isEn ? "Price" : "单价"}</th>
                        <th className="text-right py-2 px-2">{isEn ? "Seats" : "席位"}</th>
                        <th className="text-right py-2 px-2">{isEn ? "Weight" : "权重"}</th>
                        <th className="text-right py-2 px-2">{isEn ? "Total weight" : "总权重"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map((n) => (
                        <tr key={n.level} className="border-b border-border/20">
                          <td className="py-2 px-2">{nodeName(n)}</td>
                          <td className="py-2 px-2 text-right num">${n.investment.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right num">{n.seats}</td>
                          <td className="py-2 px-2 text-right num">{(n.weight * 100).toFixed(0)}%</td>
                          <td className="py-2 px-2 text-right num text-amber-300">{(n.weight * n.seats).toFixed(0)}</td>
                        </tr>
                      ))}
                      <tr className="bg-amber-950/30">
                        <td className="py-2 px-2 font-semibold">{isEn ? "Total" : "合计"}</td>
                        <td className="py-2 px-2 text-right num">$800万</td>
                        <td className="py-2 px-2 text-right num">2420</td>
                        <td className="py-2 px-2 text-right">—</td>
                        <td className="py-2 px-2 text-right num text-amber-300 font-bold">{TOTAL_NODE_WEIGHT}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}
      {/* end NODES TAB */}

      {/* ═══ SUMMARY TAB ═══ — original calculator (input form + Total Returns + result charts).
          Was wrapped under Nodes tab; user wants it as a separate "综合" tab summarizing total returns. */}
      {/* Node ROI calculator — own tab, first in nav. */}
      {v2Tab === "calc" && (<>

      {/* ═══════════════════════════════════════════════════════════════════════
          CALCULATOR SECTION — 节点收益模拟器
      ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.25 }}
        className="space-y-6">

        <div className="border-b border-border/40 pb-4">
          <div className="border-l-[3px] border-primary pl-4">
            {!isEn && <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/60 block mb-0.5">{t("mr.rune.section.simulator.eyebrow")}</span>}
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {isEn ? "Node Yield Simulator" : isZh ? `${t("mr.rune.section.simulator.title")} · Node Yield Simulator` : t("mr.rune.section.simulator.title")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("mr.rune.section.simulator.desc")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* Left: Node Cards + Params */}
          <div className="lg:col-span-2 space-y-6">

            {/* Node tier selection */}
            {(overview?.nodes?.length) ? (
              <div>
                <SectionTitle icon={Coins} i18nKey="mr.rune.select.node" en="Select Node Tier" />
                <div className="grid grid-cols-2 gap-3">
                  {(overview.nodes ?? []).map(node => {
                    const color  = (C as Record<string,string>)[node.level] ?? C.pioneer;
                    const isOn   = nodeLevel === node.level;
                    const apy    = ((node.dailyUsdt * 365) / node.investment * 100).toFixed(2);
                    return (
                      <button key={node.level}
                        onClick={() => { setNodeLevel(node.level as RuneCalculatorInputNodeLevel); setSeats(1); }}
                        style={isOn ? {
                          boxShadow: `0 8px 24px -6px ${color}55, 0 0 0 1px ${color}80, inset 0 1px 0 0 ${color}40, inset 0 -12px 24px -12px ${color}30`,
                          borderColor: `${color}90`,
                        } : undefined}
                        className={`relative text-left p-4 rounded-xl border bg-gradient-to-br transition-all duration-300 overflow-hidden ${NODE_BG[node.level]} ${
                          isOn
                            ? `${NODE_RING[node.level]} -translate-y-0.5 scale-[1.02] z-10`
                            : "opacity-50 saturate-50 blur-[0.5px] hover:opacity-80 hover:saturate-100 hover:blur-0 hover:brightness-110"
                        }`}
                      >
                        {/* Selected glow line */}
                        {isOn && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-80" style={{ color }} />}

                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] uppercase tracking-widest font-bold" style={{ color }}>{nodeName(node)}</span>
                          {isOn ? <BadgeCheck className="h-3.5 w-3.5" style={{ color }} /> : <span className="text-[11px] uppercase tracking-widest text-muted-foreground/40 font-medium">{node.nameEn}</span>}
                        </div>
                        <p className="num text-xl mt-0.5">${node.investment.toLocaleString()}</p>

                        {/* APY badge */}
                        <div className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 num-sm border" style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                          APY {apy}%
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-x-2 gap-y-0.5">
                          <p className="text-[11px] text-muted-foreground">{isEn ? "Daily USDT" : t("mr.rune.table.dailyUsdt")} <span className="num num-sm" style={{ color }}>${node.dailyUsdt}</span></p>
                          <p className="text-[11px] text-muted-foreground">{isEn ? "Seats" : t("mr.rune.table.seats")} <span className="num num-sm text-foreground">{node.seats}</span></p>
                          <p className="text-[11px] text-muted-foreground col-span-2">{isEn ? "Private" : t("mr.rune.table.privatePrice")} <span className="num num-sm text-foreground">${node.privatePrice}</span></p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Params card */}
            <Card className="bg-card/80 backdrop-blur border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  {isEn ? "Parameters" : t("mr.rune.select.params")}
                  {isZh && <span className="text-xs text-muted-foreground font-normal ml-1">· Parameters</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Duration */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-medium text-foreground">
                      {isEn ? "Duration" : t("mr.rune.input.duration")}
                      {isZh && <span className="text-xs text-muted-foreground font-normal ml-1">Duration</span>}
                    </Label>
                    <span className="num text-lg">{durationDays}{isEn ? "d" : t("mr.rune.kpi.daysUnit")} / ≈{Math.round(durationDays/30)}{isEn ? "mo" : t("mr.rune.input.months")}</span>
                  </div>
                  <Slider value={[durationDays]} min={30} max={720} step={30}
                    onValueChange={v => setDurationDays(v[0])} className="py-2" />
                </div>

                {/* Price stage selector */}
                {(overview?.priceStages?.length) ? (
                  <div className="space-y-2">
                    <Label className="text-base font-medium text-foreground">
                      {isEn ? "Target Stage" : t("mr.rune.input.targetStage")}
                      {isZh && <span className="text-xs text-muted-foreground font-normal ml-1">Target Stage</span>}
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {(overview.priceStages ?? []).map((s, i) => {
                        const dynPrice = motherPriceForStage(i, s.motherPrice);
                        const dynMult  = s.motherPrice > 0 ? dynPrice / overview.motherToken.launchPrice : 0;
                        return (
                        <button key={i} onClick={() => { setPriceStageIndex(i); }}
                          className={`text-left p-2.5 rounded-lg border transition-all active:scale-[0.98] ${priceStageIndex === i ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_4px_14px_-4px_hsl(var(--primary)/0.45)]" : "border-border/50 hover:border-border hover:-translate-y-[1px]"}`}>
                          <p className="text-xs text-muted-foreground leading-tight mb-0.5">{stageLabel(s, i)}</p>
                          <p className="num text-sm text-foreground">${fmtPrice(dynPrice)}</p>
                          {dynMult > 1.05 && <p className="text-green-400 num text-xs">{dynMult.toFixed(dynMult >= 10 ? 0 : 1)}×</p>}
                        </button>
                        );
                      })}
                    </div>
                    {selectedStagePreview && isZh && (
                      <p className="text-xs text-muted-foreground px-1">{selectedStagePreview.trigger}</p>
                    )}
                  </div>
                ) : null}

                <Button className="w-full font-bold tracking-wide shadow-[0_0_28px_hsl(38,92%,50%,0.35)] bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/80 text-primary-foreground"
                  onClick={() => calcMutation.mutate({ data: { nodeLevel, seats, durationDays, priceStageIndex } })}
                  disabled={calcMutation.isPending}>
                  {calcMutation.isPending
                    ? (isEn ? "Calculating…" : t("mr.rune.btn.simulating"))
                    : bi("mr.rune.btn.simulate", "Run Simulation")}
                  {!calcMutation.isPending && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-3 space-y-6">
            <AnimatePresence mode="wait">
              {dynamicCalc ? (
                <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }} className="space-y-6">

                  {/* KPI cards — unified theme: primary (amber) for accents, neutral
                      surface for sub-cards. Drops the green/orange/rose/blue rainbow. */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="col-span-2 md:col-span-3 p-5 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent shadow-[0_0_24px_hsl(var(--primary)/0.12)]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[11px] text-primary uppercase tracking-widest font-semibold">
                          {bi("mr.rune.kpi.totalAssets", "Total Returns")}
                        </p>
                        <span className="text-[10px] bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase">
                          {isEn ? "Estimated" : "预估"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-2">
                        {isEn
                          ? "Returns only — principal is redeemable after the breakeven window (≈128d static)."
                          : "仅含收益。本金达到回本周期（静态约 128 天）后可赎回。"}
                      </p>
                      <div className="flex items-end gap-4 flex-wrap">
                        <p className="num-shimmer text-4xl">${fmt(dynamicCalc.totalAssets)}</p>
                        <div className="mb-1 flex gap-3 flex-wrap">
                          <span className="text-sm bg-primary/15 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full num num-sm">ROI {fmt(dynamicCalc.roi)}%</span>
                          <span className="text-sm bg-muted/40 text-foreground border border-border/40 px-2.5 py-0.5 rounded-full num num-sm">{fmt(dynamicCalc.roiMultiplier)}× {isEn ? "Principal" : t("mr.rune.kpi.principalMultiple")}</span>
                        </div>
                      </div>
                      {/* Yield range strip */}
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="num text-foreground/70">${fmt(dynamicCalc.totalAssetsLow)}</span>
                        <span className="opacity-60">— {isEn ? "monthly 15% (conservative)" : "月化 15% 保守"} ↔ {isEn ? "35% (optimistic)" : "35% 乐观"} —</span>
                        <span className="num text-foreground/70">${fmt(dynamicCalc.totalAssetsHigh)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {overview?.priceStages?.[priceStageIndex] ? stageLabel(overview.priceStages[priceStageIndex], priceStageIndex) : ""} {isEn ? "stage" : t("mr.rune.kpi.stage")} · {isEn ? "price" : "价格"} <span className="num text-primary">${fmtPrice(dynamicCalc.dynamicPrice)}</span> · {isEn ? "investment" : t("mr.rune.kpi.invest")} <span className="num text-foreground">${fmt(dynamicCalc.investment)}</span>
                      </p>
                    </div>
                    {[
                      {
                        label: isEn ? "Mother Token Value" : t("mr.rune.kpi.motherValue"),
                        value: dynamicCalc.motherTokenValue,
                        sub: <><span className="num">{dynamicCalc.motherTokens.toLocaleString()}</span> {isEn ? "tokens" : t("mr.rune.kpi.tokensUnit")} × ${fmtPrice(dynamicCalc.dynamicPrice)}</>,
                      },
                      {
                        label: isEn ? "Mother Token Airdrop" : t("mr.rune.kpi.airdropValue"),
                        value: dynamicCalc.airdropTokenValue,
                        sub: <><span className="num">{dynamicCalc.airdropTokens.toLocaleString()}</span> {isEn ? "tokens" : t("mr.rune.kpi.tokensUnit")} × ${fmtPrice(dynamicCalc.dynamicPrice)}</>,
                      },
                      {
                        label: isEn ? "Static USDT (65%)" : "静态 USDT (65%)",
                        value: dynamicCalc.totalUsdtIncome,
                        sub: <><span className="num">${fmt(dynamicCalc.dailyUsdt)}</span>{isEn ? "/day" : t("mr.rune.kpi.perDay")} × <span className="num">{dynamicCalc.durationDays}</span>{isEn ? "d" : t("mr.rune.kpi.daysUnit")}</>,
                      },
                      {
                        label: isEn ? "Sub-Token (35% dyn)" : "动态 子币 (35%)",
                        value: dynamicCalc.subTokenValue ?? 0,
                        sub: <><span className="num">{fmt(dynamicCalc.subTokenAccumulated ?? 0)}</span> {isEn ? "tokens accumulated" : "枚累计"}</>,
                      },
                    ].map((kpi) => (
                      <div key={kpi.label} className="p-4 rounded-xl border border-border/40 bg-card/60">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</p>
                        <p className="num text-lg text-foreground">${fmt(kpi.value)}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Result chart: pie + bar side by side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Asset breakdown pie */}
                    <TechChartCard
                      icon={PieIcon}
                      title={bi("mr.rune.chart.assetBreakdown", "Asset Breakdown")}
                      accent="primary"
                      delay={0.05}
                    >
                      <div className="relative">
                        <ResponsiveContainer width="100%" height={170}>
                          <PieChart>
                            <defs>
                              {RESULT_COLORS.map((c, i) => (
                                <radialGradient key={i} id={`resPieGrad-${i}`} cx="50%" cy="50%" r="50%">
                                  <stop offset="0%"  stopColor={c} stopOpacity={1}   />
                                  <stop offset="100%" stopColor={c} stopOpacity={0.55} />
                                </radialGradient>
                              ))}
                            </defs>
                            <Pie data={resultPieData} cx="50%" cy="50%" innerRadius={48} outerRadius={75}
                              dataKey="value" nameKey="name" paddingAngle={4}
                              stroke="hsl(230,30%,8%)" strokeWidth={2}
                              animationDuration={1000} animationBegin={150}>
                              {resultPieData.map((_, i) => (
                                <Cell key={i} fill={`url(#resPieGrad-${i})`} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle.contentStyle}
                              formatter={(v: number, name: string) => [`$${fmt(v, 0)}`, name]} animationDuration={180} />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center total */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="text-center">
                            <div className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Total</div>
                            <div className="num text-sm text-foreground/90">
                              ${fmt(resultPieData.reduce((s, d) => s + (d.value ?? 0), 0), 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 mt-3">
                        {resultPieData.map((d, i) => {
                          const total = resultPieData.reduce((s, x) => s + (x.value ?? 0), 0) || 1;
                          const pct   = ((d.value ?? 0) / total) * 100;
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                              className="flex items-center justify-between text-xs gap-2"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="h-2 w-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor]" style={{ background: RESULT_COLORS[i], color: RESULT_COLORS[i] }} />
                                <span className="text-muted-foreground truncate">{d.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-muted-foreground/60 num tabular-nums">{pct.toFixed(0)}%</span>
                                <span className="num font-semibold text-foreground/90 tabular-nums">${fmt(d.value, 0)}</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </TechChartCard>

                    {/* Stage ROI bar chart: show all stages for this node */}
                    <TechChartCard
                      icon={BarChart2}
                      title={bi("mr.rune.chart.stageForecast", "Stage Forecast")}
                      accent="amber-500"
                      delay={0.15}
                    >
                      {selectedNode && (overview?.priceStages?.length) ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart
                            data={(overview.priceStages ?? []).map((s, i) => {
                              const dynPrice = motherPriceForStage(i, s.motherPrice);
                              return {
                                label: stageLabel(s, i),
                                // Airdrop is mother-token, so it prices off motherPrice (not subPrice).
                                totalAssets: Math.round(
                                  selectedNode.motherTokensPerSeat * seats * dynPrice +
                                  selectedNode.airdropPerSeat      * seats * dynPrice +
                                  selectedNode.dailyUsdt           * seats * durationDays
                                ),
                                isActive: i === priceStageIndex,
                              };
                            })}
                            margin={{ top: 8, right: 8, left: -10, bottom: 4 }}
                          >
                            <defs>
                              <linearGradient id="stageActiveBar" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stopColor="hsl(38,92%,60%)" stopOpacity={1}    />
                                <stop offset="100%" stopColor="hsl(38,92%,50%)" stopOpacity={0.4}  />
                              </linearGradient>
                              <linearGradient id="stageIdleBar" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stopColor="hsl(217,55%,42%)" stopOpacity={0.85} />
                                <stop offset="100%" stopColor="hsl(217,55%,32%)" stopOpacity={0.3}  />
                              </linearGradient>
                              <filter id="activeBarGlow">
                                <feGaussianBlur stdDeviation="2.5" result="b" />
                                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                              </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false}
                              tickFormatter={v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`} />
                            <Tooltip {...tooltipStyle} formatter={(v: number) => [`$${fmt(v,0)}`, isEn ? "Total Returns" : t("mr.rune.kpi.totalAssets")]} animationDuration={180} />
                            <Bar dataKey="totalAssets" name={isEn ? "Total Returns" : t("mr.rune.kpi.totalAssets")} radius={[6,6,0,0]} maxBarSize={40}
                              animationDuration={1100} animationBegin={250}>
                              {(overview.priceStages ?? []).map((_, i) => (
                                <Cell key={i}
                                  fill={i === priceStageIndex ? "url(#stageActiveBar)" : "url(#stageIdleBar)"}
                                  style={i === priceStageIndex ? { filter: "url(#activeBarGlow)" } : undefined}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : null}
                      {/* Stage legend strip */}
                      <div className="flex items-center justify-center gap-4 mt-1 text-[11px] text-muted-foreground/70">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm shadow-[0_0_8px_hsl(38,92%,55%)]" style={{ background: "hsl(38,92%,55%)" }} />
                          <span>{isEn ? "Selected stage" : t("mr.rune.kpi.stage") + (isEn ? "" : " · 当前")}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm" style={{ background: "hsl(217,55%,40%)" }} />
                          <span>{isEn ? "Other stages" : "其他阶段"}</span>
                        </div>
                      </div>
                    </TechChartCard>
                  </div>

                  {/* Detail table */}
                  <Card className="bg-card/80 backdrop-blur border-border shadow-sm overflow-hidden">
                    <div className="bg-muted/20 border-b border-border/50 px-5 py-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" />
                        {isEn ? "Full Breakdown" : t("mr.rune.table.breakdown")}
                        {isZh && <span className="text-xs text-muted-foreground font-normal ml-1">· Full Breakdown</span>}
                      </h3>
                    </div>
                    <CardContent className="p-0">
                      <table className="w-full text-sm">
                        <tbody>
                          {dynamicCalc.breakdown.map((item, i) => (
                            <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                              <td className="py-2.5 px-5 text-muted-foreground">
                                {item.label}
                                {isZh && item.labelCn && <span className="ml-2 text-[11px] opacity-50">{item.labelCn}</span>}
                              </td>
                              <td className="py-2.5 px-5 text-right font-mono font-medium">{item.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="bg-card/80 backdrop-blur border-border shadow-sm min-h-[420px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground p-12 flex flex-col items-center gap-5">
                      <div className="w-20 h-20 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center">
                        <BarChart2 className="h-9 w-9 opacity-20" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground/60">{t("mr.rune.placeholder.title")}</p>
                        {isZh && <p className="text-sm opacity-60">Select node tier and parameters, then run simulation</p>}
                      </div>
                      <div className="grid grid-cols-3 gap-6 mt-2 text-center">
                        {[
                          { key: "mr.rune.placeholder.stepTier",   en: "Pick Tier"   },
                          { key: "mr.rune.placeholder.stepParams", en: "Set Params" },
                          { key: "mr.rune.placeholder.stepCharts", en: "View Charts" },
                        ].map((s, i) => (
                          <div key={s.key}>
                            <p className="text-xs text-muted-foreground">{isEn ? `Step ${i + 1}` : `${t("mr.rune.placeholder.stepLabel")} ${i + 1}`}</p>
                            <p className="text-xs font-semibold mt-0.5">{isEn ? s.en : t(s.key)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Node comparison table */}
            {(overview?.nodes?.length) ? (
              <Card className="bg-card/80 backdrop-blur border-border shadow-sm overflow-hidden">
                <div className="bg-muted/20 border-b border-border/50 px-5 py-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    {isEn ? "Node Parameters" : t("mr.rune.table.nodeParams")}
                    {isZh && <span className="text-xs text-muted-foreground font-normal ml-1">· Node Parameters</span>}
                  </h3>
                </div>

                {/* ── Desktop table (md+) ── */}
                <CardContent className="p-0 overflow-x-auto hidden md:block">
                  <table className="w-full text-xs min-w-[560px]">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/10">
                        {[
                          { key: "mr.rune.table.node",         en: "Node",         align: "left"  as const },
                          { key: "mr.rune.table.invest",       en: "Investment",   align: "right" as const },
                          { key: "mr.rune.table.privatePrice", en: "Private",      align: "right" as const },
                          { key: "mr.rune.token.mother",       en: "Mother Token", align: "right" as const },
                          { key: "mr.rune.table.airdrop",      en: "Airdrop",      align: "right" as const },
                          { key: "mr.rune.table.dailyUsdt",    en: "Daily USDT",   align: "right" as const },
                          { key: "mr.rune.table.seats",        en: "Seats",        align: "right" as const },
                        ].map(h => (
                          <th key={h.key} className={`py-2.5 px-4 text-muted-foreground font-medium tracking-wider text-[11px] uppercase ${h.align === "left" ? "text-left" : "text-right"}`}>
                            {isEn ? h.en : t(h.key)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(overview.nodes ?? []).map(node => {
                        const color = (C as Record<string,string>)[node.level] ?? C.pioneer;
                        return (
                          <tr key={node.level}
                            onClick={() => { setNodeLevel(node.level as RuneCalculatorInputNodeLevel); setSeats(1); }}
                            className={`border-b border-border/30 last:border-0 cursor-pointer transition-colors ${nodeLevel === node.level ? "bg-primary/5" : "hover:bg-muted/10"}`}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                                <span className="font-medium" style={{ color }}>{nodeName(node)}</span>
                                <span className="text-muted-foreground text-[11px]">{node.nameEn}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold">${node.investment.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono">${node.privatePrice}</td>
                            <td className="py-3 px-4 text-right font-mono">{node.motherTokensPerSeat.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono">{node.airdropPerSeat.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono font-semibold" style={{ color }}>${node.dailyUsdt}</td>
                            <td className="py-3 px-4 text-right font-mono text-muted-foreground">{node.seats}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>

                {/* ── Mobile cards (< md) ── */}
                <div className="md:hidden divide-y divide-border/30">
                  {(overview.nodes ?? []).map(node => {
                    const color = (C as Record<string,string>)[node.level] ?? C.pioneer;
                    const isSelected = nodeLevel === node.level;
                    return (
                      <div
                        key={node.level}
                        onClick={() => { setNodeLevel(node.level as RuneCalculatorInputNodeLevel); setSeats(1); }}
                        className={`px-4 py-4 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/10"}`}
                      >
                        {/* Node name header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                            <span className="font-semibold text-sm" style={{ color }}>{nodeName(node)}</span>
                            <span className="text-muted-foreground text-[11px] uppercase tracking-wider">{node.nameEn}</span>
                          </div>
                          {isSelected && (
                            <span className="text-[11px] uppercase tracking-widest text-primary border border-primary/30 rounded px-1.5 py-0.5">
                              {isEn ? "Selected" : t("mr.rune.table.selected")}
                            </span>
                          )}
                        </div>

                        {/* Primary metrics row */}
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div className="bg-muted/20 rounded-lg px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{isEn ? "Investment" : t("mr.rune.table.invest")}</div>
                            <div className="num text-sm text-foreground">${node.investment.toLocaleString()}</div>
                          </div>
                          <div className="bg-muted/20 rounded-lg px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{isEn ? "Daily USDT" : t("mr.rune.table.dailyUsdt")}</div>
                            <div className="num text-sm" style={{ color }}>${node.dailyUsdt}</div>
                          </div>
                          <div className="bg-muted/20 rounded-lg px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{isEn ? "Seats" : t("mr.rune.table.seats")}</div>
                            <div className="num text-sm text-foreground">{node.seats}</div>
                          </div>
                        </div>

                        {/* Secondary metrics row */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="px-3 py-1.5 border border-border/30 rounded-lg">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">{isEn ? "Private" : t("mr.rune.table.privatePrice")}</div>
                            <div className="num text-xs text-muted-foreground">${node.privatePrice}</div>
                          </div>
                          <div className="px-3 py-1.5 border border-border/30 rounded-lg">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">{isEn ? "Mother Token" : t("mr.rune.token.mother")}</div>
                            <div className="num text-xs text-muted-foreground">{node.motherTokensPerSeat.toLocaleString()}</div>
                          </div>
                          <div className="px-3 py-1.5 border border-border/30 rounded-lg">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">{isEn ? "Airdrop" : t("mr.rune.table.airdrop")}</div>
                            <div className="num text-xs text-muted-foreground">{node.airdropPerSeat.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </motion.div>

      </>)}
      {/* end NODE TAB calculator */}


      {/* ═══ 质押 TAB ═══ — USDT 套餐 calculator. Per 模型制度.md §叁
          deposit terms × yield × duration bonus. Per the 资金流向 doc,
          daily AI-quant yield splits 65% USDT static + 35% auto-buy
          sub-token. */}
      {v2Tab === "pkg" && (() => {
        // Yield bracket per duration
        const bracket =
          pkgDays === 30  ? { min: 0.3, max: 0.5, bonus: 0    }
        : pkgDays === 90  ? { min: 0.5, max: 0.7, bonus: 0    }
        : pkgDays === 180 ? { min: 0.5, max: 0.9, bonus: 0.10 }
        : pkgDays === 360 ? { min: 0.5, max: 0.9, bonus: 0.20 }
        :                   { min: 0.5, max: 0.9, bonus: 0.30 };
        // Map package duration → corresponding price-stage on the curve
        // above. Sub-token doesn't trade until TLP ≥ 500万U (~stage 1) so
        // 30d still uses launch; longer locks ride further up the curve.
        //   30d  → Stage 1 (TLP 700万,  ~day 24)
        //   90d  → Stage 2 (TLP 1750万, ~day 82)
        //   180d → Stage 3 (TLP 3500万,  day 180)
        //   360d → Stage 4 (post-target plateau, ~12-18mo)
        //   540d → Stage 5 (24mo target)
        const stageForDuration =
          pkgDays === 30  ? 1
        : pkgDays === 90  ? 2
        : pkgDays === 180 ? 3
        : pkgDays === 360 ? 4
        :                   5;
        const stageData     = overview?.priceStages?.[stageForDuration];
        const subPriceAtEnd = stageData?.subPrice ?? PKG_SUB_LAUNCH_PRICE;
        // Effective rate after bonus, clamped to bracket
        const baseRate    = Math.min(Math.max(pkgRatePct, bracket.min), bracket.max);
        const effDailyPct = baseRate * (1 + bracket.bonus);                 // % per day (post-bonus)
        const dailyYieldU = pkgUsdt * (effDailyPct / 100);                  // USDT/day total yield
        const totalYieldU = dailyYieldU * pkgDays;                          // total over period
        const staticUsdt  = totalYieldU * 0.65;                             // 65% USDT to user
        // Per user 2026-04-29 (corrected): the 35% dynamic portion is
        // injected into the LP pool — half buys sub, half is USDT — so it
        // is NOT user revenue. It supports protocol liquidity / price.
        // Tracked here only for transparency (shown as "injected into pool"
        // info, not counted in totalValue / ROI).
        const dynamicTotal    = totalYieldU * 0.35;
        const dynamicSubBuy   = dynamicTotal * 0.5;                         // 17.5% buys sub → pool
        const dynamicUsdtSide = dynamicTotal * 0.5;                         // 17.5% USDT      → pool
        const subTokens       = dynamicSubBuy / PKG_SUB_LAUNCH_PRICE;       // sub-tokens bought at launch
        const subValue        = subTokens * subPriceAtEnd;                  // their value at stage end (informational)
        const totalValue      = staticUsdt;
        const roi         = pkgUsdt > 0 ? (totalValue / pkgUsdt) * 100 : 0;
        const roiX        = pkgUsdt > 0 ?  totalValue / pkgUsdt        : 0;
        return (
          <Card className="surface-3d border-border/40">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap text-foreground">
                <Activity className="h-4 w-4 text-primary shrink-0" />
                {isEn ? "Stake Package · USDT → RUNE → Daily Yield" : "质押套餐 · USDT 买 RUNE 激活套餐"}
                <span className="text-[10px] bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase shrink-0">{isEn ? "Estimated" : "预估"}</span>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                {isEn
                  ? "30/90d no bonus, 180d +10%, 360d +20%, 540d +30%. Daily yield: 65% USDT direct + 35% pool injection."
                  : "30/90 天无加成；180 天 +10%；360 天 +20%；540 天 +30%。日化 65% USDT 直发 + 35% 底池注入。"}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{isEn ? "Principal (USDT)" : "本金 (USDT)"}</Label>
                  <select value={pkgUsdt} onChange={(e) => setPkgUsdt(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-background/60 border border-border/40 num text-sm text-foreground">
                    {[100, 200, 500, 1000, 2000, 5000, 10000].map(v => (
                      <option key={v} value={v}>${v.toLocaleString()}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{isEn ? "Duration" : "套餐期限"}</Label>
                  <select value={pkgDays} onChange={(e) => setPkgDays(Number(e.target.value) as typeof pkgDays)}
                    className="w-full px-3 py-2 rounded-lg bg-background/60 border border-border/40 text-sm text-foreground">
                    <option value={30}>30 {isEn ? "days · no bonus" : "天 · 无加成"}</option>
                    <option value={90}>90 {isEn ? "days · no bonus" : "天 · 无加成"}</option>
                    <option value={180}>180 {isEn ? "days · +10%" : "天 · +10%"}</option>
                    <option value={360}>360 {isEn ? "days · +20%" : "天 · +20%"}</option>
                    <option value={540}>540 {isEn ? "days · +30%" : "天 · +30%"}</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground/70">{isEn ? `Yield bracket: ${bracket.min}%-${bracket.max}% daily` : `日化区间：${bracket.min}%-${bracket.max}%`}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{isEn ? "Base daily rate" : "基础日化"}</Label>
                    <span className="num text-xs text-primary">{baseRate.toFixed(2)}%</span>
                  </div>
                  <Slider value={[baseRate]} min={bracket.min} max={bracket.max} step={0.05}
                    onValueChange={(v) => setPkgRatePct(v[0] ?? baseRate)} className="py-1" />
                  <div className="flex justify-between text-[9px] text-muted-foreground/60">
                    <span>{bracket.min}%</span><span>{bracket.max}%</span>
                  </div>
                </div>
              </div>

              {/* Total card */}
              <div className="p-4 sm:p-5 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent shadow-[0_0_24px_hsl(var(--primary)/0.12)]">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <p className="text-[11px] text-primary uppercase tracking-widest font-semibold">
                    {isEn ? "User Cash Income (65% Static USDT)" : "用户实得收益（65% 静态 USDT）"}
                  </p>
                  <span className="text-[10px] bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">{isEn ? "Estimated" : "预估"}</span>
                </div>
                <div className="flex items-end gap-3 flex-wrap">
                  <p className="num-shimmer text-3xl sm:text-4xl">${fmt(totalValue, 0)}</p>
                  <div className="flex gap-2 flex-wrap mb-1">
                    <span className="text-xs bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full num">ROI {fmt(roi, 1)}%</span>
                    <span className="text-xs bg-muted/40 text-foreground border border-border/40 px-2 py-0.5 rounded-full num">{fmt(roiX, 2)}×</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {isEn
                    ? `${baseRate.toFixed(2)}% × (1+${(bracket.bonus*100).toFixed(0)}% bonus) = ${effDailyPct.toFixed(3)}%/day · ${pkgDays}d total yield $${fmt(totalYieldU, 0)}`
                    : `${baseRate.toFixed(2)}% × (1+${(bracket.bonus*100).toFixed(0)}% 加成) = ${effDailyPct.toFixed(3)}%/日 · ${pkgDays} 天总收益 $${fmt(totalYieldU, 0)}`}
                </p>
              </div>

              {/* Two-card breakdown: 65% static / 35% dynamic */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border/40 bg-card/60">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{isEn ? "Static USDT (65%)" : "静态 USDT（65%）"}</p>
                  <p className="num text-lg text-foreground">${fmt(staticUsdt, 2)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isEn ? "Direct to wallet, daily settled" : "直发钱包，每日结算"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    ${fmt(dailyYieldU * 0.65, 2)}{isEn ? "/day" : "/日"} × {pkgDays}{isEn ? "d" : "天"}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-dashed border-border/30 bg-card/20">
                  <p className="text-[11px] text-muted-foreground/80 uppercase tracking-wider mb-1">{isEn ? "Pool Injection (35%)" : "底池注入（35%）"}</p>
                  <p className="num text-base text-muted-foreground/80">${fmt(dynamicTotal, 2)}</p>
                  <div className="text-[11px] text-muted-foreground/70 mt-1 space-y-0.5">
                    <p>{fmt(subTokens, 0)} {isEn ? "sub × " : "枚子币 × "}${PKG_SUB_LAUNCH_PRICE} = ${fmt(dynamicSubBuy, 2)}</p>
                    <p>${fmt(dynamicUsdtSide, 2)} USDT</p>
                  </div>
                </div>
              </div>

              {/* Doc reference table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground uppercase tracking-wider">
                    <tr className="border-b border-border/40">
                      <th className="text-left py-2 px-2">{isEn ? "Term" : "套餐"}</th>
                      <th className="text-right py-2 px-2">{isEn ? "Daily" : "日化"}</th>
                      <th className="text-right py-2 px-2">{isEn ? "Bonus" : "加成"}</th>
                      <th className="text-right py-2 px-2">{isEn ? "Cap" : "单单上限"}</th>
                      <th className="text-right py-2 px-2">{isEn ? "Day Cap (gross)" : "日额度"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { d: 30,  rate: "0.3-0.5%", bonus: "—",   cap: "$1,000", dayCap: "20万U" },
                      { d: 90,  rate: "0.5-0.7%", bonus: "—",   cap: "$1,000", dayCap: "30万U" },
                      { d: 180, rate: "0.5-0.9%", bonus: "+10%", cap: "$1,000", dayCap: isEn ? "unlimited" : "不限" },
                      { d: 360, rate: "0.5-0.9%", bonus: "+20%", cap: "$1,000", dayCap: isEn ? "unlimited" : "不限" },
                      { d: 540, rate: "0.5-0.9%", bonus: "+30%", cap: "$1,000", dayCap: isEn ? "unlimited" : "不限" },
                    ].map((r) => (
                      <tr key={r.d} className={`border-b border-border/20 ${r.d === pkgDays ? "bg-primary/5" : ""}`}>
                        <td className="py-2 px-2 text-foreground">{r.d} {isEn ? "days" : "天"}</td>
                        <td className="py-2 px-2 text-right num text-foreground/80">{r.rate}</td>
                        <td className="py-2 px-2 text-right num text-primary">{r.bonus}</td>
                        <td className="py-2 px-2 text-right num text-foreground/70">{r.cap}</td>
                        <td className="py-2 px-2 text-right num text-foreground/70">{r.dayCap}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                {isEn
                  ? "Estimated. Daily yield splits 65% USDT direct + 35% auto-buys sub-token. Sub valued at $0.038 launch price."
                  : "预估。日化收益 65% USDT 直发 + 35% 自动买子币。子币按 $0.038 开盘估值。"}
              </p>
            </CardContent>
          </Card>
        );
      })()}


      {/* ═══ DUAL-WHEEL TAB ═══ — single unified chain (re-read 2026-04-28).
          Per `核心机制.md` §壹: 销毁母币 → "永久通缩 + 永久日化 1.0-1.5%"。
          The "永久通缩" framing only holds if yield is in SUB-TOKENS — if it
          were mother, the burn → mint cycle wouldn't be net-deflationary.
          So the chain is:
            burn N mother → daily 1-1.5%×N **sub-tokens** → auto-stake
            sub-stake earns AI monthly distribution + IDO 50× allocation
          One calculator covers the whole chain; no separate 套餐 panel. */}
      {v2Tab === "dual" && (<>
      {/* ── DEAD: old separate burn-stake panel (mother token yield). ── */}
      {false && (<>
      {/* ── Burn-Stake panel (mother token) ──
          Per `核心机制.md` §壹: burn N mother tokens → permanent daily yield
          1.0%-1.5% × N in mother tokens. Tier rate increases with N. */}
      <Card className="surface-3d border-amber-700/30 bg-gradient-to-br from-slate-900/70 to-slate-950/80">
        <CardHeader className="cursor-pointer select-none" onClick={() => setBurnPanelOpen(o => !o)}>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-400" />
              {isEn ? "Burn-Stake Mother Token (Permanent Yield)" : "母币销毁质押 · 永久日化产出"}
              <span className="text-[10px] bg-amber-900/40 text-amber-300 border border-amber-700/30 px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase">{isEn ? "Estimated" : "预估"}</span>
            </CardTitle>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${burnPanelOpen ? "rotate-90" : ""}`} />
          </div>
          {!burnPanelOpen && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {isEn
                ? "Burn N mother tokens → daily 1.0–1.5% yield, paid in mother tokens, permanent. Click to open calculator."
                : "销毁 N 枚母币 → 每日 1.0%-1.5% 母币产出，永久。点击展开计算器。"}
            </p>
          )}
        </CardHeader>
        {burnPanelOpen && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">{isEn ? "Mother tokens to burn" : "销毁母币数量"}</Label>
                <input
                  type="number" value={burnTokens} min={1}
                  onChange={(e) => setBurnTokens(Math.max(1, Number(e.target.value)))}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-background/60 border border-border/40 num"
                />
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {isEn ? "Tiers: <100=1.0% · 100+=1.2% · 1k+=1.3% · 10k+=1.4% · 100k+=1.5% daily" : "阶梯：<100枚=1.0%·100+=1.2%·1k+=1.3%·10k+=1.4%·100k+=1.5% 每日"}
                </p>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">{isEn ? "Projection days" : "预测周期 (天)"}</Label>
                <input
                  type="number" value={burnDays} min={1}
                  onChange={(e) => setBurnDays(Math.max(1, Number(e.target.value)))}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-background/60 border border-border/40 num"
                />
                <p className="text-[10px] text-muted-foreground/70 mt-1">{isEn ? "Yield is permanent on-chain — pick a window for valuation" : "链上永久收益，仅用于估值窗口选择"}</p>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={burnCalcMutation.isPending}
                  onClick={() => burnCalcMutation.mutate({ data: { motherTokensBurned: burnTokens, durationDays: burnDays, priceStageIndex } })}
                >
                  {burnCalcMutation.isPending ? "…" : (isEn ? "Calculate" : "计算预估")}
                </Button>
              </div>
            </div>
            {burnCalcMutation.data && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-amber-700/30 bg-amber-950/20">
                  <p className="text-[10px] text-amber-300 uppercase tracking-wider">{isEn ? "Daily Rate" : "日化收益率"}</p>
                  <p className="num text-base text-amber-200 mt-0.5">{burnCalcMutation.data.dailyRatePct}%</p>
                </div>
                <div className="p-3 rounded-lg border border-border/40 bg-card/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isEn ? "Total Yield" : "周期产出"}</p>
                  <p className="num text-base mt-0.5">{fmt(burnCalcMutation.data.totalYieldTokens, 0)} {isEn ? "tokens" : "枚"}</p>
                </div>
                <div className="p-3 rounded-lg border border-emerald-700/30 bg-emerald-950/20">
                  <p className="text-[10px] text-emerald-300 uppercase tracking-wider">{isEn ? "Yield Value" : "产出市值"}</p>
                  <p className="num text-base text-emerald-200 mt-0.5">${fmt(burnCalcMutation.data.totalYieldValue)}</p>
                </div>
                <div className="p-3 rounded-lg border border-fuchsia-700/30 bg-fuchsia-950/20">
                  <p className="text-[10px] text-fuchsia-300 uppercase tracking-wider">ROI</p>
                  <p className="num text-base text-fuchsia-200 mt-0.5">{fmt(burnCalcMutation.data.roiMultiplier)}×</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(burnCalcMutation.data.roi)}% {isEn ? "vs launch cost" : "对开盘价"}</p>
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/60 leading-snug">
              {isEn
                ? "Estimated. Burn-stake is permanent on-chain (principal not returned). Yield rate is keyed off burn amount; AI engine projections (15-35% monthly) are not contractually guaranteed."
                : "预估。销毁质押在链上永久（本金不归还）。日化收益率按销毁量分层；AI 引擎月化区间 15-35% 为预估，非合约保证。"}
            </p>
          </CardContent>
        )}
      </Card>

      </>)}
      {/* end DEAD burn-stake panel */}

      {/* ── Real unified chain: burn-stake mother → daily sub-token yield → auto-stake → AI revenue + IDO ── */}
      <Card className="surface-3d border-amber-700/30 bg-gradient-to-br from-slate-900/70 to-slate-950/80">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
            <Flame className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="break-keep">{isEn ? "Burn-Stake Chain · Mother → Sub → AI + IDO" : "完整链路 · 销毁母币 → 子币 → AI 分红 + IDO"}</span>
            <span className="text-[10px] bg-amber-900/40 text-amber-300 border border-amber-700/30 px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase shrink-0">{isEn ? "Estimated" : "预估"}</span>
          </CardTitle>
          <p className="text-[11px] text-muted-foreground/80 mt-1 leading-snug">
            {isEn
              ? "Burn N mother (永久通缩) → daily 1.0-1.5% × N sub-tokens → auto-stake → monthly AI revenue (1M USDT/mo by weight) + IDO new-token allocations (~50× avg)."
              : "销毁 N 枚母币（永久通缩，本金不归还）→ 每日产 1.0-1.5%×N **子币** → 自动入子币质押池 → 享 AI 月分红（100万U/月按权重）+ IDO 打新（平均 50×）"}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Inputs — primary: USDT package principal (then converted to mother burn count via launch price). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{isEn ? "Package principal (USDT)" : "购买配套金额（USDT）"}</Label>
              <select value={burnTokens * 0.028} onChange={(e) => setBurnTokens(Number(e.target.value) / 0.028)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background/60 border border-border/40 num text-sm">
                {[
                  { usdt: 100,    tier: "1.2%" },
                  { usdt: 200,    tier: "1.2%" },
                  { usdt: 500,    tier: "1.2%" },
                  { usdt: 1000,   tier: "1.3%" },
                  { usdt: 2000,   tier: "1.3%" },
                  { usdt: 5000,   tier: "1.4%" },
                  { usdt: 10000,  tier: "1.4%" },
                  { usdt: 30000,  tier: "1.5%" },
                  { usdt: 50000,  tier: "1.5%" },
                  { usdt: 100000, tier: "1.5%" },
                ].map(({ usdt, tier }) => (
                  <option key={usdt} value={usdt}>${usdt.toLocaleString()} → {fmt(usdt / 0.028, 0)} {isEn ? "RUNE" : "枚"} · {tier}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {isEn ? "USDT → buys RUNE @ $0.028 → permanently burned" : "USDT → 按开盘价 $0.028 买 RUNE → 永久销毁"}
              </p>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{isEn ? "Duration (days)" : "周期 (天)"}</Label>
              <select value={burnDays} onChange={(e) => setBurnDays(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background/60 border border-border/40 text-sm">
                <option value={30}>30</option><option value={90}>90</option><option value={180}>180</option><option value={360}>360</option><option value={540}>540</option><option value={1080}>1080 (3yr)</option><option value={3600}>3600 (10yr)</option>
              </select>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {isEn ? "Yield is permanent on-chain — pick a window for valuation." : "链上永久产出，仅取窗口估值"}
              </p>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{isEn ? "Price Stage" : "价格阶段"}</Label>
              <select value={stakeStage} onChange={(e) => setStakeStage(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background/60 border border-border/40 text-sm">
                {(overview?.priceStages ?? []).map((s, i) => (<option key={i} value={i}>{stageLabel(s, i)}</option>))}
              </select>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {isEn
                  ? "Affects only the informational sub-token valuation card; AI dividend + IDO totals are USDT-denominated and stage-independent."
                  : "仅影响下方「子币持仓估值」参考卡。AI 分红 + IDO 是 USDT 计价，与阶段无关。"}
              </p>
            </div>
          </div>

          {/* Inputs — assumptions (collapsible) */}
          <details className="group">
            <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
              {isEn ? "Assumptions (advanced)" : "假设参数 (高级)"} ▾
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              {[
                {
                  label: isEn ? "Global sub-stake (tokens)" : "全网子币质押 (枚)",
                  value: globalSubStaked, setter: setGlobalSubStaked,
                  min: 10_000, max: 5_000_000, step: 10_000,
                  display: globalSubStaked.toLocaleString(),
                },
                {
                  label: isEn ? "AI pool / month (USDT)" : "AI 月度池 (USDT)",
                  value: aiPoolMonthly, setter: setAiPoolMonthly,
                  min: 100_000, max: 5_000_000, step: 100_000,
                  display: `$${aiPoolMonthly.toLocaleString()}`,
                },
                {
                  label: isEn ? "IDOs / month" : "每月 IDO 次数",
                  value: idosPerMonth, setter: setIdosPerMonth,
                  min: 0.5, max: 3, step: 0.5,
                  display: `${idosPerMonth}×`,
                },
                {
                  label: isEn ? "IDO avg multiplier" : "IDO 平均涨幅",
                  value: idoAvgMultiplier, setter: setIdoAvgMultiplier,
                  min: 10, max: 100, step: 5,
                  display: `${idoAvgMultiplier}×`,
                },
                {
                  label: isEn ? "IDO alloc factor (USDT/sub)" : "IDO 配额系数 (U/枚)",
                  value: idoAllocFactor, setter: setIdoAllocFactor,
                  min: 0.001, max: 0.01, step: 0.0005,
                  display: idoAllocFactor.toFixed(4),
                },
              ].map(({ label, value, setter, min, max, step, display }) => (
                <div key={label} className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
                    <span className="num text-xs text-primary">{display}</span>
                  </div>
                  <Slider value={[value]} min={min} max={max} step={step}
                    onValueChange={(v) => setter(v[0] ?? value)} className="py-1" />
                  <div className="flex justify-between text-[9px] text-muted-foreground/60">
                    <span>{typeof min === "number" && min < 1 ? min : min.toLocaleString()}</span>
                    <span>{typeof max === "number" && max < 1 ? max : max.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </details>

          {/* Computed outputs — burn-stake mother → sub-token value (primary).
              IDO 打新 shown as a SEPARATE section below. AI dividend
              dropped per user 2026-04-29 — too speculative, not core. */}
          {(() => {
            const stage = overview?.priceStages?.[stakeStage];
            if (!stage) return null;
            const launchMotherPrice = overview?.priceStages?.[0]?.motherPrice ?? 0.028;
            // Tier rate by burn amount (per `核心机制.md` §壹 "按销毁金额分层")
            const tierRate = burnTokens >= 100_000 ? 1.5
                          : burnTokens >=  10_000 ? 1.4
                          : burnTokens >=   1_000 ? 1.3
                          : burnTokens >=     100 ? 1.2
                          :                          1.0;
            const dailySubYield  = burnTokens * (tierRate / 100);
            const totalSubTokens = dailySubYield * burnDays;
            // Sub valuation now follows the dynamic price simulation at the
            // burn duration day, not doc-static stage.subPrice. So 30/90/180
            // day windows reflect what the activity sliders actually project
            // for sub price, starting from $0.038 launch upward.
            const tlpAtBurnEnd      = tlpAt(burnDays) * 10000;          // 万 → USDT
            const subPriceAtBurnEnd = subPriceAtTlp(tlpAtBurnEnd);
            const subTokenValue     = totalSubTokens * subPriceAtBurnEnd;
            const burnCostUsd       = burnTokens * launchMotherPrice;
            // IDO 打新 — sub-stake × allocFactor × IDO count × (multiplier-1)
            const months           = burnDays / 30;
            const avgSubStake      = totalSubTokens / 2;
            const idoCount         = idosPerMonth * months;
            const idoAllocPerEvent = avgSubStake * idoAllocFactor;
            const idoGains         = idoCount * idoAllocPerEvent * (idoAvgMultiplier - 1);
            const totalIncome = subTokenValue + idoGains;
            const roi  = burnCostUsd > 0 ? (totalIncome / burnCostUsd) * 100 : 0;
            const roiX = burnCostUsd > 0 ?  totalIncome / burnCostUsd        : 0;
            return (
              <div className="space-y-4">
                {/* Total — combines sub value + IDO. */}
                <div className="p-5 sm:p-6 rounded-2xl border-2 border-primary/60 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent shadow-[0_0_40px_hsl(var(--primary)/0.35)] relative overflow-hidden">
                  <div className="absolute -top-16 -right-12 w-48 h-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <p className="text-[12px] text-primary uppercase tracking-widest font-bold">
                        {isEn ? "Total Estimated Returns" : "总估算收益"}
                      </p>
                      <span className="text-[10px] bg-primary/25 text-primary border border-primary/40 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">{isEn ? "Estimated" : "预估"}</span>
                    </div>
                    <div className="flex items-end gap-3 flex-wrap">
                      <p className="num-shimmer text-4xl sm:text-5xl text-primary drop-shadow-[0_0_18px_hsl(var(--primary)/0.5)]">${fmt(totalIncome, 0)}</p>
                      <div className="flex gap-2 flex-wrap mb-1.5">
                        <span className="text-xs bg-primary/25 text-primary border border-primary/40 px-2.5 py-0.5 rounded-full num font-semibold">ROI {fmt(roi, 0)}%</span>
                        <span className="text-xs bg-muted/40 text-foreground border border-border/40 px-2.5 py-0.5 rounded-full num">{fmt(roiX, 1)}×</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {isEn
                        ? `Burned ${burnTokens.toLocaleString()} mother · cost $${fmt(burnCostUsd, 2)} @ launch · ${tierRate}% daily = ${fmt(dailySubYield, 0)} sub/day · ${burnDays}d`
                        : `销毁 ${burnTokens.toLocaleString()} 枚母币 · 成本 $${fmt(burnCostUsd, 2)} 开盘价 · 日化 ${tierRate}% = ${fmt(dailySubYield, 0)} 子币/天 · ${burnDays} 天`}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {isEn ? "⚠ Mother burn is permanent — principal not redeemable." : "⚠ 销毁母币本金不归还（永久通缩）。"}
                    </p>
                  </div>
                </div>

                {/* PART 1: Sub-token value (primary outcome of burn). */}
                <div className="p-4 rounded-xl border border-orange-500/40 bg-orange-500/5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[11px] text-orange-300 uppercase tracking-wider font-semibold">
                      {isEn ? "Sub-Token Value (from burn)" : "子币价值（销毁产出）"}
                    </p>
                    <span className="text-[10px] num text-orange-300/80">{totalIncome > 0 ? fmt((subTokenValue / totalIncome) * 100, 0) : 0}%</span>
                  </div>
                  <p className="num text-2xl text-orange-200">${fmt(subTokenValue, 0)}</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                    {fmt(totalSubTokens, 0)} {isEn ? "sub × " : "枚 × "}${subPriceAtBurnEnd.toFixed(subPriceAtBurnEnd < 1 ? 4 : 2)} {isEn ? "(dynamic)" : "（动态）"}
                  </p>
                </div>

                {/* PART 2: IDO 打新 — separate section below. */}
                <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[11px] text-emerald-300 uppercase tracking-wider font-semibold">
                      {isEn ? "IDO Allocation Gains (打新)" : "IDO 打新收益"}
                    </p>
                    <span className="text-[10px] num text-emerald-300/80">{totalIncome > 0 ? fmt((idoGains / totalIncome) * 100, 0) : 0}%</span>
                  </div>
                  <p className="num text-2xl text-emerald-200">${fmt(idoGains, 0)}</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                    {fmt(idoCount, 1)} {isEn ? "IDOs" : "次打新"} × ${fmt(idoAllocPerEvent, 0)} {isEn ? "alloc × " : "配额 × "}{(idoAvgMultiplier - 1).toFixed(0)}× {isEn ? "gain" : "涨幅"}
                  </p>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      </>)}
      {/* end STAKING TAB */}
    </div>
  );
}
