/**
 * 每日统计一行 — PM / HL stats 历史记录的统一设计(取自 HL 区 SbDailyRow:
 * 专业交易所风格,头部 日期 + 大号当日盈亏($+%),下面三列居中统计格
 * 已平仓($+%)/ 交易单数 / 当月累计)。数据源 v_wallet_daily_history
 * (展示值 = coalesce(manual_*, 真实),admin 调控即时一致)。
 *
 * `venueLabel` 可选:多 venue 混排场景(不传 = 单一市场上下文,不显示)。
 */

import { useTranslation } from "react-i18next";
import { cn } from "@app/lib/utils";
import { fmtUsd } from "@app/components/copy-trading/shared";
import { fmtPct, numOrZero, type WalletDailyRow } from "@app/lib/trading-stats-hooks";

export function DailyStatRow({ d, venueLabel }: { d: WalletDailyRow; venueLabel?: string }) {
  const { t } = useTranslation();
  const dayPnl = numOrZero(d.day_pnl_usd);
  const dayPos = dayPnl >= 0;
  const realized = numOrZero(d.realized_pnl_day_usd);
  const realizedPos = realized >= 0;
  const closes = numOrZero(d.closed_today);
  const fills = numOrZero(d.fills_today);
  const mtd = numOrZero(d.mtd_pnl_usd);
  // 百分比兜底:视图 *_pct 为 null 时用持仓成本/名义当分母前端算,保证每个金额旁都有 %(NaN→不显示)。
  const cost = numOrZero(d.position_cost_usd);
  const posVal = numOrZero(d.position_value_usd);
  const pctOf = (v: number, base: number): number => (base > 0 ? (v / base) * 100 : NaN);
  // 当日/已平仓 → 占成本(无则占名义);当月累计 → 占名义。
  const dayPnlPct = d.day_pnl_pct ?? pctOf(dayPnl, cost || posVal);
  const realizedPct = d.realized_day_pct ?? pctOf(realized, cost || posVal);
  const mtdPct = d.mtd_pnl_pct ?? pctOf(mtd, cost || posVal);
  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] font-bold text-foreground/85 tabular-nums">{d.day}</span>
          {venueLabel && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/5 text-muted-foreground shrink-0">{venueLabel}</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={cn("text-[12px] font-bold tabular-nums", dayPos ? "text-emerald-400" : "text-red-400")}>
            {dayPos ? "+" : ""}{fmtUsd(dayPnl)}
            {Number.isFinite(dayPnlPct) && <span className="text-[9px] opacity-70"> ({fmtPct(dayPnlPct)})</span>}
          </div>
          <div className="text-[9px] text-muted-foreground/60">{t("hl.statDayPnl", "当日盈亏")}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.statClosed", "已平仓")}</div>
          <div className={cn("text-[12px] font-bold tabular-nums", realizedPos ? "text-emerald-400" : "text-red-400")}>
            {realizedPos ? "+" : ""}{fmtUsd(realized)}
            {Number.isFinite(realizedPct) && <span className="text-[8px] opacity-70"> ({fmtPct(realizedPct)})</span>}
          </div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.statTrades", "交易单数")}</div>
          <div className="text-[12px] font-bold tabular-nums text-foreground/80">{fills || closes}</div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.mtdPnl", "当月累计")}</div>
          <div className={cn("text-[12px] font-bold tabular-nums", mtd >= 0 ? "text-emerald-400" : "text-red-400")}>
            {mtd >= 0 ? "+" : ""}{fmtUsd(mtd)}
            {Number.isFinite(mtdPct) && <span className="text-[8px] opacity-70"> ({fmtPct(mtdPct)})</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
