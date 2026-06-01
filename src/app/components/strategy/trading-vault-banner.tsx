import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart2, TrendingUp, Shield, RefreshCw, Activity } from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { VaultCalendar } from "./vault-calendar";
import { getLastMonthMonthlyReturn } from "./strategy-header";
import { useDailyPnl } from "@app/lib/ai-bot-feed";

/* ── Stable rate display.
 *  Picks a value within [min, max] from a deterministic 12h epoch hash so
 *  every viewer sees the same number for the same 12-hour window — and the
 *  number doesn't twitch every 2 seconds.
 */
const SLOT_MS = 12 * 60 * 60 * 1000;
function epochSlotHash(salt: string) {
  // Cheap deterministic hash of `${salt}:${slot}` → [0, 1).
  const slot = Math.floor(Date.now() / SLOT_MS);
  let h = 2166136261 >>> 0;
  const s = `${salt}:${slot}`;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return (h % 100000) / 100000;
}
function StableRate({ min, max, decimals = 1, suffix = "%", salt }: {
  min: number; max: number; decimals?: number; suffix?: string; salt: string;
}) {
  const val = min + epochSlotHash(salt) * (max - min);
  return <>{val.toFixed(decimals)}{suffix}</>;
}

/* ── Animated count-up ── */
function CountUp({ target, prefix = "", suffix = "", decimals = 0, duration = 1000 }: {
  target: number; prefix?: string; suffix?: string; decimals?: number; duration?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(target * ease);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return <>{prefix}{val.toFixed(decimals)}{suffix}</>;
}

/* ── Simulated monthly performance trend (20–45%) — deterministic so it
 *  stays consistent on every reload and matches the spec's monthly band. */
function buildPerf() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months.map((m, i) => ({
    month: m,
    rate: +(20 + Math.abs(Math.sin(i * 0.9 + 1.2)) * 25).toFixed(1),
  }));
}
const PERF_DATA = buildPerf();

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-[11px]"
      style={{ background: "rgba(10,8,4,0.95)", border: "1px solid rgba(245,158,11,0.30)" }}>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-bold text-amber-300">{payload[0].value}%</div>
    </div>
  );
};

export function TradingVaultBanner() {
  const { t } = useTranslation();


  // Last completed month's actual P&L total — real bot-closed PnL when
  // available (from ai_paper_trades), seeded mock as backstop. Always
  // matches the calendar below since both call into the same function.
  const { byDay: realByDay } = useDailyPnl();
  const lastMonthPct = getLastMonthMonthlyReturn(0, realByDay);

  const STATS = [
    {
      icon: TrendingUp,
      colorClass: "text-amber-300",
      bgClass: "bg-amber-500/[0.06] ring-amber-500/25",
      label: t("strategy.banner.monthlyReturn"),
      value: `${lastMonthPct >= 0 ? "+" : ""}${lastMonthPct.toFixed(1)}%`,
      sub: t("strategy.banner.monthlyReturnSub"),
    },
    {
      icon: Activity,
      colorClass: "text-amber-300",
      bgClass: "bg-amber-500/[0.06] ring-amber-500/25",
      label: t("strategy.banner.annualEst"),
      // Annual ≈ last-month-pct × 12 (linear) so it reads coherent with
      // the headline monthly figure — with monthly 20-45% that's 240-540%.
      value: `${(lastMonthPct * 12).toFixed(0)}%`,
      sub: t("strategy.banner.annualEstSub"),
    },
    {
      icon: Shield,
      colorClass: "text-emerald-400",
      bgClass: "bg-emerald-500/[0.06] ring-emerald-500/25",
      label: t("strategy.banner.status"),
      value: t("strategy.banner.statusValue"),
      sub: t("strategy.banner.statusSub"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-4 lg:mx-0 rounded-3xl overflow-hidden border-2 border-amber-500/40"
      style={{
        background: "linear-gradient(140deg, rgba(40,30,8,0.95) 0%, rgba(26,19,7,0.93) 40%, rgba(30,21,7,0.85) 70%, rgba(10,8,4,0.98) 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(251,191,36,0.30), inset 0 -1px 0 rgba(0,0,0,0.45), 0 14px 40px -12px rgba(245,158,11,0.35), 0 28px 64px -28px rgba(251,191,36,0.20), 0 32px 80px -24px rgba(0,0,0,0.65)",
      }}
    >
      {/* Layered ambient glows — warm amber aurora */}
      <div className="pointer-events-none absolute -top-32 -right-20 h-72 w-72 rounded-full bg-amber-500/[0.28] blur-[100px]" />
      <div className="pointer-events-none absolute -top-20 left-1/3 h-56 w-56 rounded-full bg-amber-400/[0.16] blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-60 w-60 rounded-full bg-amber-600/[0.16] blur-[80px]" />

      {/* Top accent lines */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/85 to-transparent" />
      <div className="pointer-events-none absolute inset-x-[12%] top-[1.5px] h-[1px] bg-gradient-to-r from-transparent via-amber-200/55 to-transparent" />

      {/* Diagonal scan-line shimmer (slow infinite) */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, transparent 0%, transparent 38%, rgba(255,255,255,0.04) 50%, transparent 62%, transparent 100%)",
          backgroundSize: "250% 100%",
          mixBlendMode: "screen",
        }}
        animate={{ backgroundPosition: ["180% 0%", "-80% 0%"] }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      />

      {/* HUD corners — premium reactor look */}
      {[
        "top-3 left-3 border-t-2 border-l-2 rounded-tl-md",
        "top-3 right-3 border-t-2 border-r-2 rounded-tr-md",
        "bottom-3 left-3 border-b-2 border-l-2 rounded-bl-md",
        "bottom-3 right-3 border-b-2 border-r-2 rounded-br-md",
      ].map((cls, i) => (
        <span key={i} className={`absolute w-3 h-3 pointer-events-none ${cls}`} style={{ borderColor: "rgba(251,191,36,0.50)" }} />
      ))}

      <div className="relative p-5 space-y-4">

        {/* Header — bigger icon, premium typography */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center ring-2 ring-amber-400/55"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.40), rgba(180,120,20,0.20))",
                boxShadow: "0 6px 20px -4px hsl(38 95% 55% / 0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
            >
              <BarChart2 className="h-5 w-5 text-amber-100" strokeWidth={2.5} />
            </div>
            <div>
              <div
                className="text-[16px] font-black leading-tight tracking-[0.02em]"
                style={{
                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 40%, #fbbf24 65%, #d97706 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.5))",
                }}
              >
                {t("strategy.banner.title")}
              </div>
              <div className="text-[11px] text-amber-200/70 leading-tight mt-1 tracking-wide">
                {t("strategy.banner.subtitle")}
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.20), rgba(251,191,36,0.05))",
              border: "1px solid rgba(251,191,36,0.40)",
              boxShadow: "0 0 12px hsl(38 95% 55% / 0.30)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-50 animate-ping" />
              <span className="relative inline-flex h-full w-full rounded-full bg-amber-300" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] font-black text-amber-200">
              {t("strategy.banner.live")}
            </span>
          </div>
        </div>

        {/* KPI grid — taller, glow accent on the hero tile (the headline number) */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {STATS.map(({ icon: Icon, colorClass, label, value, sub }, idx) => {
            const isHero = idx === 1; // Annual estimate
            return (
              <div
                key={label}
                className={`relative rounded-2xl px-3 py-3 overflow-hidden ${isHero ? "ring-2 ring-amber-400/45" : "ring-1 ring-white/10"}`}
                style={{
                  background: isHero
                    ? "linear-gradient(160deg, rgba(251,191,36,0.20), rgba(120,80,10,0.12) 60%, rgba(0,0,0,0.30))"
                    : "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02) 60%, rgba(0,0,0,0.30))",
                  boxShadow: isHero
                    ? "inset 0 1px 0 rgba(251,191,36,0.40), 0 6px 18px -6px rgba(251,191,36,0.40)"
                    : "inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 14px -6px rgba(0,0,0,0.40)",
                }}
              >
                {isHero && (
                  <div className="pointer-events-none absolute -top-8 -right-6 h-20 w-20 rounded-full bg-amber-400/30 blur-2xl" />
                )}
                <Icon className={`h-4 w-4 mb-1.5 ${isHero ? "text-amber-300" : colorClass}`} />
                <div
                  className={`text-[17px] font-black tabular-nums leading-none ${isHero ? "" : colorClass}`}
                  style={
                    isHero
                      ? {
                          background: "linear-gradient(135deg, #fef9c3 0%, #fde68a 40%, #f59e0b 100%)",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          filter: "drop-shadow(0 0 12px hsl(38 95% 55% / 0.45))",
                        }
                      : { textShadow: "0 0 10px currentColor" }
                  }
                >
                  {value}
                </div>
                <div className={`text-[10px] mt-1.5 leading-tight ${isHero ? "text-amber-200/85" : "text-muted-foreground"}`}>{label}</div>
                <div className={`text-[9px] mt-0.5 ${isHero ? "text-amber-300/70" : `${colorClass} opacity-70`}`}>{sub}</div>
              </div>
            );
          })}
        </div>

        {/* Monthly performance area chart — premium-tinted card to match
            the banner shell. Inset glow + corner accents echo the outer
            HUD frame so this reads as part of the same instrument panel. */}
        <div
          className="relative rounded-2xl px-3.5 pt-3 pb-2 overflow-hidden ring-1 ring-amber-400/25"
          style={{
            background:
              "linear-gradient(160deg, rgba(245,158,11,0.10), rgba(80,52,8,0.05) 60%, rgba(0,0,0,0.30))",
            boxShadow:
              "inset 0 1px 0 rgba(251,191,36,0.20), inset 0 -1px 0 rgba(0,0,0,0.30), 0 4px 18px -8px rgba(245,158,11,0.30)",
          }}
        >
          <div className="pointer-events-none absolute -top-10 -right-6 h-24 w-24 rounded-full bg-amber-500/[0.20] blur-2xl" />
          <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
          <div className="relative flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-amber-200/85 uppercase tracking-[0.18em]">
              {t("strategy.banner.trendTitle")}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 ring-1 ring-amber-400/35 text-amber-200">
              {t("strategy.banner.trendBadge")}
            </span>
          </div>
          <div style={{ height: 90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PERF_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month"
                  tick={{ fontSize: 8.5, fill: "rgba(255,255,255,0.32)", fontFamily: "monospace" }}
                  axisLine={false} tickLine={false} />
                <YAxis domain={[0, 50]}
                  tick={{ fontSize: 8, fill: "rgba(255,255,255,0.28)", fontFamily: "monospace" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(245,158,11,0.2)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#tvGrad)"
                  dot={{ r: 2.5, fill: "#f59e0b", strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: "#fbbf24", strokeWidth: 0 }}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Range labels */}
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
            <span className="text-amber-400/70">▼ 20% {t("strategy.banner.floor")}</span>
            <span className="text-amber-300/90">▲ 45% {t("strategy.banner.ceiling")}</span>
          </div>
        </div>

        {/* AI Quant Calendar */}
        <VaultCalendar />

        {/* Footer note */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <RefreshCw className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {t("strategy.banner.footerFormulaNoAmount", "总入金 × 45% = 交易金库 · 节点招募结束后激活")}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
