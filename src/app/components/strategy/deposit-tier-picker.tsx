/**
 * DepositTierPicker — 按节点等级展示固定充值金额按钮 + 每档绑定风控预览
 * (来自 rune-intelligent-trading-manual.md;单一事实源 = lib/deposit-tiers.ts)。
 *
 * 用户只能从所属等级开放的固定金额里选(不可手输);超出剩余额度的金额禁用。
 * 选中 → onPick(amount),由调用方把该金额喂进实际充值流程(并由后端绑定风控到订阅)。
 *
 * 移动端优先 + 站内 dark glass/amber 风格。
 */
import { useTranslation } from "react-i18next";
import { CheckCircle2, Lock, Sparkles, TrendingUp, Scale, Rocket } from "lucide-react";
import { cn } from "@app/lib/utils";
import { amountsForLevel, RISK_BY_AMOUNT, perTradeUsd } from "@app/lib/deposit-tiers";

const POS_ICON: Record<string, typeof Sparkles> = {
  steadiest: Sparkles, steady: TrendingUp, balanced: Scale, aggressive: Rocket,
};

export function DepositTierPicker({
  level, remaining, selected, onPick,
}: {
  level: number;
  /** 剩余可充(cap − 已充),超出的金额禁用。 */
  remaining: number;
  selected?: number;
  onPick: (amount: number) => void;
}) {
  const { t } = useTranslation();
  const amounts = amountsForLevel(level);

  if (level < 1 || amounts.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-3 flex items-center gap-2 text-[12px] text-amber-200/80">
        <Lock className="h-4 w-4 shrink-0" />
        {t("depositTier.noLevel", "需先持有节点 / 兑换授权码")}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="text-[13px] font-bold text-foreground/90">{t("depositTier.title", "选择充值金额")}</h4>
        <span className="text-[10px] text-foreground/40">{t("depositTier.hint", "金额绑定风控规则(不可手输)")}</span>
        <span className="ml-auto text-[10px] text-foreground/45 shrink-0">
          {t("depositTier.remaining", "剩余可充")}: <span className="font-mono text-foreground/70">${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {amounts.map((amt) => {
          const r = RISK_BY_AMOUNT[amt];
          if (!r) return null;
          const Icon = POS_ICON[r.posKey] ?? Sparkles;
          const over = amt > remaining;
          const active = selected === amt;
          return (
            <button
              key={amt}
              type="button"
              disabled={over}
              onClick={() => onPick(amt)}
              className={cn(
                "w-full text-left rounded-2xl border p-3 transition active:scale-[0.99] min-h-[64px]",
                over ? "opacity-45 cursor-not-allowed border-white/[0.06] bg-white/[0.01]"
                  : active ? "border-amber-400/50 bg-amber-500/[0.08] shadow-[0_0_16px_rgba(245,158,11,0.12)]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
              )}
              data-testid={`deposit-tier-${amt}`}
            >
              <div className="flex items-center gap-2">
                <div className={cn("shrink-0 grid h-9 w-9 place-items-center rounded-xl", active ? "bg-amber-500/15" : "bg-white/5")}>
                  <Icon className={cn("h-4 w-4", active ? "text-amber-300" : "text-foreground/55")} />
                </div>
                <span className="text-[16px] font-extrabold tabular-nums num-gold">${amt.toLocaleString()}</span>
                <span className="text-[10px] text-foreground/45 truncate">{t(`depositTier.pos.${r.posKey}`, r.posKey)}</span>
                {active && <CheckCircle2 className="h-4 w-4 text-amber-300 ml-auto shrink-0" />}
                {over && <span className="ml-auto shrink-0 text-[10px] text-red-400/80">{t("depositTier.exceedsCap", "超出剩余额度")}</span>}
              </div>
              {/* 绑定风控预览(单笔10% · 每日笔数 · ≤杠杆 · TP/SL) */}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-foreground/55 font-mono">
                <span>{t("depositTier.perTrade", "单笔")} <span className="text-foreground/80">${perTradeUsd(amt)}</span></span>
                <span>{t("depositTier.daily", "每日")} <span className="text-foreground/80">{r.dailyTrades}</span> {t("depositTier.trades", "笔")}</span>
                <span><span className="text-foreground/80">≤{r.maxLev}x</span> {t("depositTier.lev", "杠杆")}</span>
                <span>{t("depositTier.tpsl", "止盈/止损")} <span className="text-emerald-400/80">+{r.tpRoe}%</span>/<span className="text-red-400/80">−{r.slRoe}%</span></span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DepositTierPicker;
