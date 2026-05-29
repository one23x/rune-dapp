/**
 * Shared chrome for every /copy-trading/* page: the amber hero + the sub-tab
 * nav, with the standard mobile/desktop width + bottom-nav clearance.
 */

import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { GoldCard } from "@app/components/premium-card";
import { CopyTradingSubNav } from "@app/components/copy-trading/shared";

export function CopyTradingLayout({
  title, children, actions,
}: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground pb-24 lg:pb-8">
      <div className="max-w-lg lg:max-w-4xl mx-auto px-4 py-5 space-y-4">
        <GoldCard className="rounded-2xl">
          <div
            className="relative overflow-hidden rounded-2xl p-4 lg:p-5 flex items-center justify-between gap-3"
            style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.14) 0%, rgba(180,90,10,0.06) 60%, transparent 100%)" }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  One-Agents Engine
                </span>
              </div>
              <h1 className="text-lg lg:text-xl font-bold text-foreground truncate" style={{ fontFamily: "'Orbitron', 'Space Grotesk', sans-serif" }}>
                {title ?? t("copyTrading.entryTitle")}
              </h1>
            </div>
            {actions}
          </div>
        </GoldCard>

        <CopyTradingSubNav />

        {children}
      </div>
    </div>
  );
}
