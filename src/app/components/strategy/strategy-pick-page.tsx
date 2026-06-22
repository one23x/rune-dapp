/**
 * StrategyPickPage — 策略页(/strategy/hl 无 ?strategy 时)。premium 重设计:
 *   refined hero(eyebrow + 大标题 + 副题)→ 顶级交易员 live watchlist → 三张板块策略卡 → 确认进引擎。
 * 移动端优先 + dark glass/amber;文案全 i18n。
 */
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import type { HlNetwork } from "@app/lib/engine";
import { StrategySelect } from "./strategy-select";
import { LeaderWatchlist } from "./leader-watchlist";

export function StrategyPickPage() {
  const { t } = useTranslation();
  const network: HlNetwork = "mainnet";

  return (
    <div className="min-h-screen pb-28 lg:pb-12 relative">
      {/* atmospheric backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[120%] h-48 bg-amber-500/[0.07] blur-3xl rounded-full" />
      </div>

      {/* back bar */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-white/10">
        <div className="px-3 sm:px-4 h-14 flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/strategy" data-testid="link-back-strategy">
            <button className="shrink-0 w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-foreground/80 hover:bg-white/10 active:scale-95 transition">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <h1 className="text-[15px] font-bold text-foreground truncate">{t("strategyPick.title", "选择策略")}</h1>
        </div>
      </div>

      <div className="relative px-4 pt-5 pb-4 max-w-2xl mx-auto space-y-5" style={{ animation: "fadeSlideIn 0.35s ease-out" }}>
        {/* hero */}
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300/90">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            {t("strategyPick.eyebrow", "Hyperliquid · 智能跟单")}
          </div>
          <h2 className="mt-3 font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            {t("strategyPick.heroTitle", "选择你的策略")}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/55 max-w-md">
            {t("strategyPick.heroSub", "选定后进入交易引擎 —— 自动跟单,风控全程托管。")}
          </p>
        </div>

        {/* 顶级交易员 live watchlist */}
        <LeaderWatchlist network={network} />

        {/* 板块策略卡 + 确认 */}
        <StrategySelect />
      </div>
    </div>
  );
}

export default StrategyPickPage;
