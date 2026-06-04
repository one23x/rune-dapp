import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function getHourlyValue(min: number, max: number, salt: number) {
  const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
  return min + seededRandom(hourSeed + salt) * (max - min);
}

function useHourlyValue(min: number, max: number, salt: number) {
  const [value, setValue] = useState(() => getHourlyValue(min, max, salt));
  useEffect(() => {
    const interval = setInterval(() => {
      setValue(getHourlyValue(min, max, salt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [min, max, salt]);
  return value;
}

/** Real-data backstop. When `realByDay` has an entry for "YYYY-MM-DD",
 *  the seeded mock value for that day is replaced with the real one
 *  written by the AI bot worker (sum of closed pnl_pct that day). */
export type RealPnlMap = Map<string, { netPct: number; count: number }>;

export function getCalendarDays(
  calendarMonth: Date,
  timeSeed = 0,
  realByDay?: RealPnlMap,
) {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: { day: number; pnl: number; real?: boolean; trades?: number }[] = [];
  for (let i = 0; i < firstDay; i++) days.push({ day: 0, pnl: 0 });

  const now = new Date();
  const dataStartDate = new Date(now.getFullYear(), now.getMonth() - 9, 1);
  const isHistorical = new Date(year, month, 1) >= dataStartDate && new Date(year, month, 1) <= now;

  if (!isHistorical) {
    for (let d = 1; d <= daysInMonth; d++) days.push({ day: d, pnl: 0 });
    return days;
  }
  const ymd = (d: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  // Per-month seed (deterministic across re-renders so the calendar values
  // for any historical month are stable for every viewer).
  const monthSeed = year * 100 + (month + 1);
  const monthRng = ((Math.sin(monthSeed * 4729 + 17389) % 1) + 1) % 1;
  // Target monthly aggregate 20%-45% (latest spec, was 28-45%).
  const targetMonthly = 20 + monthRng * 25;

  // Per-day raw P&L. Win range 0-4% (赢多), loss range -2%-0% (亏少).
  // Win rate 70-90% — winThreshold sampled per-month 0.10-0.30 then
  // jittered tighter for very recent days so today doesn't always win.
  const baseWinThreshold = 0.10 + monthRng * 0.20; // 10%-30% threshold → 70%-90% wins
  const rawPnls: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date > now) { rawPnls.push(0); continue; }

    const daysAgo = Math.floor((now.getTime() - date.getTime()) / 86400000);
    // Recent 5 days fluctuate with timeSeed; older days are stable
    const tf = daysAgo <= 5 ? timeSeed * (d + 3) : 0;
    const seed = year * 10000 + (month + 1) * 100 + d + tf;
    const rng  = ((Math.sin(seed * 9301 + 49297) % 1) + 1) % 1;
    const rng2 = ((Math.sin(seed * 7919 + 31337) % 1) + 1) % 1;
    const rng3 = ((Math.sin(seed * 6271 + 15731) % 1) + 1) % 1;
    // Slight per-day wobble around the month's base threshold.
    const winThreshold = Math.max(0.05, Math.min(0.35, baseWinThreshold + (rng3 - 0.5) * 0.06));
    const isWin = rng > winThreshold;
    let pnl: number;
    if (isWin) {
      // Win: 0% to +4%, biased toward middle via two-rng blend.
      pnl = (rng2 * 0.6 + rng3 * 0.4) * 4;
    } else {
      // Loss: -2% to 0%, slightly clustered near -1%.
      pnl = -((rng2 * 0.6 + rng3 * 0.4) * 2);
    }
    const dow = date.getDay();
    if (dow === 0 || dow === 6) pnl *= 0.6;

    // Today fluctuates with hour progress so the running total
    // ramps up through the day instead of jumping at 00:00.
    if (date.toDateString() === now.toDateString()) {
      const hourProgress = (now.getHours() * 60 + now.getMinutes()) / 1440;
      const jitter = ((Math.sin(timeSeed * 1337) % 1) + 1) % 1;
      pnl *= (0.3 + hourProgress * 0.7) * (0.85 + jitter * 0.3);
    }

    rawPnls.push(pnl);
  }

  // Scale raw values so the **complete** month sums to the target.
  // For partial months (current month before EOM), keep raw values
  // unscaled so today's running total reads naturally.
  const monthIsComplete = new Date(year, month + 1, 1) <= now;
  if (monthIsComplete) {
    const rawTotal = rawPnls.reduce((s, v) => s + v, 0);
    const scale = rawTotal > 0 ? targetMonthly / rawTotal : 1;
    for (let d = 1; d <= daysInMonth; d++) {
      // Real bot data, when present, supersedes the seeded mock.
      const real = realByDay?.get(ymd(d));
      if (real) {
        days.push({ day: d, pnl: Math.round(real.netPct * 100) / 100, real: true, trades: real.count });
        continue;
      }
      // Clamp scaled win to [0, 4]% and loss to [-2, 0]% so per-day
      // values stay in the spec range even after target-monthly scaling.
      let scaled = rawPnls[d - 1] * scale;
      if (scaled > 4)  scaled = 4;
      if (scaled < -2) scaled = -2;
      days.push({ day: d, pnl: Math.round(scaled * 100) / 100 });
    }
  } else {
    for (let d = 1; d <= daysInMonth; d++) {
      const real = realByDay?.get(ymd(d));
      if (real) {
        days.push({ day: d, pnl: Math.round(real.netPct * 100) / 100, real: true, trades: real.count });
        continue;
      }
      days.push({ day: d, pnl: Math.round(rawPnls[d - 1] * 100) / 100 });
    }
  }
  return days;
}

/**
 * Last completed month's total P&L — used for the strategy banner's
 * "Monthly Return" KPI, so on May 1 it shows April's final number,
 * not May 1's running total.
 */
export function getLastMonthMonthlyReturn(timeSeed = 0, realByDay?: RealPnlMap): number {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const days = getCalendarDays(lastMonth, timeSeed, realByDay);
  return days.reduce((s, c) => s + (c.pnl || 0), 0);
}

function getCumulativeStats(timeSeed = 0, realByDay?: RealPnlMap) {
  const now = new Date();
  const dataStart = new Date(now.getFullYear(), now.getMonth() - 9, 1);
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;
  for (let m = 0; m < 9; m++) {
    const mDate = new Date(dataStart.getFullYear(), dataStart.getMonth() + m, 1);
    const days = getCalendarDays(mDate, timeSeed, realByDay);
    for (const cell of days) {
      if (cell.day === 0 || cell.pnl === 0) continue;
      totalPnl += cell.pnl;
      if (cell.pnl > 0) wins++; else losses++;
    }
  }
  return { totalPnl, wins, losses };
}

export function StrategyHeader() {
  const { t } = useTranslation();
  return (
    <div className="px-4 pt-6 pb-2" style={{ animation: "fadeSlideIn 0.4s ease-out" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl border border-amber-500/30 bg-black/60 backdrop-blur-md flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(245,158,11,0.25)]">
            <span className="text-[13px] font-black text-amber-400 tracking-tighter">HL</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight gold-text leading-none drop-shadow-md" data-testid="text-strategy-title">
              {t("strategy.aiStrategies")}
            </h2>
            <span className="text-[10px] text-white/45 tracking-wide">
              {t("strategy.headerSubtitle", "链上永续金库 · 智能合约跟单")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-white/60 font-mono bg-white/5 px-2 py-1 rounded-full border border-white/10 shrink-0">
          <div className="relative w-1.5 h-1.5">
            <div
              className="absolute inset-0 bg-emerald-400 rounded-full"
              style={{ animation: "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
            />
            <div className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50" />
          </div>
          <span>{t("hl.live", "实时")}</span>
        </div>
      </div>
    </div>
  );
}
