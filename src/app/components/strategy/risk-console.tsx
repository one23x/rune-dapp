/**
 * RiskConsole — 交易引擎页的「风险监控台」。展示账户当日风险敞口 vs 预算 +
 * 当前生效的风控铁律(daily-loss-halt / 单币上限 / 冷却 / 清算距离)。
 *
 * 诚实口径:NAV/当日盈亏/未实现来自真实账户;日内亏损预算进度按 strategy-lab 口径
 * (当日已亏 / 6% 净值)推算;风控铁律是配置项,以标签呈现(live 引擎门控状态待
 * 后端 decision_log 接入后再点亮)。移动端优先:2 列网格 + 进度条,无固定宽。
 */
import { useTranslation } from "react-i18next";
import { ShieldCheck, AlertTriangle, Activity } from "lucide-react";
import { cn } from "@app/lib/utils";
import { tierForAmount, RISK_BY_AMOUNT, perTradeUsd } from "@app/lib/deposit-tiers";

function fmtUsd(n: number): string {
  const s = Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(2);
  return `$${s}`;
}

export function RiskConsole({
  accountValue, dayPnl, unrealizedPnl, dailyLossBudgetPct = 6,
}: {
  accountValue: number;
  dayPnl: number;
  unrealizedPnl: number;
  /** 日内亏损停开新仓阈值(% 净值)。crypto 10 / equities·meme 6,默认 6。 */
  dailyLossBudgetPct?: number;
}) {
  const { t } = useTranslation();
  const budgetUsd = accountValue * (dailyLossBudgetPct / 100);
  const lossUsd = Math.max(0, -dayPnl);
  const usedPct = budgetUsd > 0 ? Math.min(100, (lossUsd / budgetUsd) * 100) : 0;
  const halted = usedPct >= 100;
  const warn = usedPct >= 70;

  const tone = halted ? "red" : warn ? "amber" : "emerald";
  const toneCls = halted
    ? { text: "text-red-300", bar: "bg-red-400", ring: "border-red-400/30 bg-red-500/[0.06]" }
    : warn
      ? { text: "text-amber-300", bar: "bg-amber-400", ring: "border-amber-400/25 bg-amber-500/[0.05]" }
      : { text: "text-emerald-300", bar: "bg-emerald-400", ring: "border-emerald-400/25 bg-emerald-500/[0.04]" };

  const cell = (label: string, node: React.ReactNode) => (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-foreground/45 mb-1 leading-tight">{label}</p>
      {node}
    </div>
  );

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-black/30 overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-black/20">
        <Activity className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <h3 className="text-xs font-semibold truncate">{t("riskConsole.title", "风险监控台")}</h3>
        <span className={cn("ml-auto shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] whitespace-nowrap", toneCls.ring, toneCls.text)}>
          {halted ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <ShieldCheck className="h-3 w-3 shrink-0" />}
          {halted ? t("riskConsole.halted", "已触发 · 只平不开") : warn ? t("riskConsole.warn", "接近预算") : t("riskConsole.ok", "正常")}
        </span>
      </header>

      <div className="p-3 space-y-3">
        {/* 日内亏损预算进度 */}
        <div>
          <div className="flex items-center justify-between gap-2 text-[11px] mb-1.5">
            <span className="text-foreground/55 shrink-0">{t("riskConsole.dailyBudget", "日内亏损预算")}</span>
            <span className={cn("font-mono tabular-nums text-right", toneCls.text)}>
              {fmtUsd(lossUsd)} / {fmtUsd(budgetUsd)} ({dailyLossBudgetPct}%)
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", toneCls.bar)} style={{ width: `${usedPct}%` }} />
          </div>
        </div>

        {/* 关键数 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-3">
          {cell(t("riskConsole.nav", "账户净值"),
            <p className="text-[15px] font-bold tabular-nums num-gold break-all">{fmtUsd(accountValue)}</p>)}
          {cell(t("riskConsole.dayPnl", "当日盈亏"),
            <p className={cn("text-[15px] font-bold tabular-nums break-all", dayPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              {dayPnl >= 0 ? "+" : ""}{fmtUsd(dayPnl)}</p>)}
          {cell(t("riskConsole.unrealized", "未实现"),
            <p className={cn("text-[15px] font-bold tabular-nums break-all", unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              {unrealizedPnl >= 0 ? "+" : ""}{fmtUsd(unrealizedPnl)}</p>)}
        </div>

        {/* 本档位风控(按充值金额绑定;净值向下吸附到所处档位)。 */}
        {(() => {
          const tier = tierForAmount(accountValue);
          const preset = RISK_BY_AMOUNT[tier];
          if (!preset) return null;
          const tierCell = (label: string, val: string, cls = "text-foreground/85") => (
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-foreground/40 mb-0.5 truncate">{label}</p>
              <p className={cn("text-[12px] font-bold tabular-nums truncate", cls)}>{val}</p>
            </div>
          );
          return (
            <div className="pt-1">
              <p className="text-[10px] text-foreground/45 mb-1.5">
                {t("riskConsole.tierRisk", "本档位风控")} · <span className="font-mono text-amber-300/80">{t("riskConsole.tierBy", "充值 ${{amount}} 档", { amount: tier.toLocaleString() })}</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                {tierCell(t("depositTier.perTrade", "单笔"), `$${perTradeUsd(tier)}`)}
                {tierCell(`${t("depositTier.daily", "每日")} ${t("depositTier.trades", "笔")}`, String(preset.dailyTrades))}
                {tierCell(t("depositTier.lev", "杠杆"), `≤${preset.maxLev}x`)}
                {tierCell(t("depositTier.tpsl", "止盈/止损"), `+${preset.tpRoe}% / −${preset.slRoe}%`, "text-emerald-300/90")}
              </div>
            </div>
          );
        })()}

        {/* 结构性铁律(全局,次要) */}
        <div className="flex flex-wrap gap-1.5">
          {[
            t("riskConsole.rule1", "单币 ≤30% 净值"),
            t("riskConsole.rule2", "止损后冷却 5min"),
            t("riskConsole.rule3", "清算 ≥3× 止损"),
          ].map((r) => (
            <span key={r} className="rounded-md bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-[10px] text-foreground/55">
              {r}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RiskConsole;
