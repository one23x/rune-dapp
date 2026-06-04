import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Shield, TrendingUp, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@app/lib/utils";
import { usePoolStatsRune } from "@app/lib/data-rune";

type PoolView = "rune" | "reserve";

/**
 * Vault page LP card. Shows aggregate node-deposit totals split into the
 * 35% RUNE LP and 20% Reserve allocations. Per-tier breakdown lives on the
 * nodes page — vault is just the protocol-pool view.
 */
export function VaultLpPool() {
  const { t } = useTranslation();
  const [view, setView] = useState<PoolView>("rune");
  const { isLoading } = usePoolStatsRune();

  const isLive = false; // Pre-launch — RUNE token not yet listed.

  const POOL_TABS = [
    { key: "rune" as const,    icon: TrendingUp, label: "RUNE LP",                    pct: "35%" },
    { key: "reserve" as const, icon: Shield,     label: t("vault.lpPool.tabReserve"), pct: "20%" },
  ];

  return (
    <div className="glass-panel relative overflow-hidden">
      {/* Top accent line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

      <div className="relative px-5 py-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-white/10 border border-white/20 backdrop-blur-md shadow-lg">
              <Layers className="h-4 w-4 text-amber-200" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight text-white tracking-tight">
                {t("vault.lpPool.title")}
              </div>
              <div className="text-[11px] text-white/60 leading-tight mt-0.5">
                {t("vault.lpPool.subtitle")}
              </div>
            </div>
          </div>
          <span
            className={cn(
              "text-[10px] uppercase tracking-[0.18em] font-bold px-2.5 py-1 rounded-full border",
              isLive
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                : "bg-amber-500/10 text-amber-300 border-amber-400/30",
            )}
          >
            {isLive ? t("vault.lpPool.live") : t("vault.lpPool.preLaunch")}
          </span>
        </div>

        {/* 3-pool ratio strip */}
        <div className="rounded-xl overflow-hidden border border-white/10">
          <div className="flex h-2.5">
            <div className="h-full" style={{ width: "35%", background: "linear-gradient(90deg, hsl(38 95% 55%), hsl(38 95% 65%))" }} />
            <div className="h-full" style={{ width: "45%", background: "linear-gradient(90deg, hsl(217 76% 58%), hsl(217 76% 68%))" }} />
            <div className="h-full" style={{ width: "20%", background: "linear-gradient(90deg, hsl(173 58% 50%), hsl(173 58% 60%))" }} />
          </div>
          <div className="flex text-[10px] font-bold bg-black/30 backdrop-blur-sm">
            <div className="flex-none w-[35%] text-center py-1.5 text-amber-300">{t("vault.lpPool.ratioRune")}</div>
            <div className="flex-none w-[45%] text-center py-1.5 text-blue-400">{t("vault.lpPool.ratioManaged")}</div>
            <div className="flex-none w-[20%] text-center py-1.5 text-teal-400">{t("vault.lpPool.ratioReserve")}</div>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-2">
          {POOL_TABS.map((tab) => {
            const isActive = view === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold transition-all",
                  isActive
                    ? "bg-[#f59e0b] text-black shadow-[0_0_15px_rgba(245,158,11,0.45)]"
                    : "bg-white/5 border border-white/10 text-white/60 hover:text-white/90 hover:bg-white/10",
                )}
                data-testid={`button-vault-pool-${tab.key}`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                <span className="ml-0.5 opacity-75">{tab.pct}</span>
              </button>
            );
          })}
        </div>

        {/* Pool stats */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : view === "rune" ? (
          <div className="space-y-3">
            {/* RUNE LP balance — hero card */}
            <div className="relative rounded-2xl px-5 py-4 bg-black/20 border border-white/10 overflow-hidden">
              <div className="pointer-events-none absolute -top-12 -right-8 h-32 w-32 rounded-full bg-amber-500/20 blur-2xl" />
              <div className="relative">
                <div className="text-[10px] text-white/60 uppercase tracking-[0.15em] font-semibold mb-1.5">
                  {t("vault.lpPool.runePoolTitle")}
                </div>
                <div className="text-[15px] font-bold text-amber-300">
                  {t("vault.lpPool.preLaunch")}
                </div>
              </div>
            </div>

            {/* Pre-launch hint */}
            {!isLive && (
              <div className="flex items-center justify-between rounded-xl px-3.5 py-2 bg-white/5 border border-white/10">
                <div className="text-[11px] text-amber-200/85 font-medium">
                  {t("vault.lpPool.preLaunchPrice")}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-400/30">
                  {t("vault.lpPool.preLaunch")}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Reserve view */
          <div className="grid grid-cols-2 gap-2.5">
            <div className="relative rounded-2xl px-4 py-3.5 bg-black/20 border border-white/10 overflow-hidden">
              <div className="pointer-events-none absolute -top-10 -right-6 h-24 w-24 rounded-full bg-teal-500/20 blur-2xl" />
              <div className="relative">
                <div className="text-[10px] text-white/60 uppercase tracking-[0.15em] font-semibold mb-1">
                  {t("vault.lpPool.reserveBalance")}
                </div>
                <div className="text-[13px] font-semibold mt-1 leading-tight text-teal-300">
                  {t("vault.lpPool.reservePctOfDeposits")}
                </div>
              </div>
            </div>
            <div className="rounded-2xl px-4 py-3.5 bg-white/5 border border-white/10">
              <div className="text-[10px] text-white/60 uppercase tracking-[0.15em] font-semibold mb-1">
                {t("vault.lpPool.reservePurpose")}
              </div>
              <div className="text-[13px] font-semibold mt-1 leading-tight text-teal-300">
                {t("vault.lpPool.reservePurposeLabel")}
              </div>
              <div className="text-[10px] text-white/50 mt-1.5 leading-snug">
                {t("vault.lpPool.reservePurposeDesc")}
              </div>
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="flex items-center gap-1.5 text-[10px] text-white/50 pt-1">
          <RefreshCw className="h-3 w-3" />
          <span>
            {isLive ? t("vault.lpPool.footerLive") : t("vault.lpPool.footerPreLaunch")}
          </span>
        </div>
      </div>
    </div>
  );
}
