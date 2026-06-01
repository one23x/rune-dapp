import { useState } from "react";
import { Layers, ExternalLink } from "lucide-react";
import { RuneLockSection } from "@app/components/vault/rune-lock-section";
import { EmberBurnSection } from "@app/components/vault/ember-burn-section";
import { VaultLpPool } from "@app/components/vault/vault-lp-pool";
import { VaultCharts, VaultRecruitment } from "@app/components/vault/vault-charts";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { PageEnter, SubTabSwitch } from "@app/components/page-enter";

type VaultTab = "pool" | "lock" | "burn";

const TABS: Array<{ key: VaultTab; labelKey: string; descKey: string }> = [
  { key: "pool", labelKey: "vault.tabPool", descKey: "vault.tabPoolDesc" },
  { key: "lock", labelKey: "vault.tabLock", descKey: "vault.tabLockDesc" },
  { key: "burn", labelKey: "vault.tabBurn", descKey: "vault.tabBurnDesc" },
];

/**
 * Vault page — ported to the GOLD+BLACK liquid-glass language (rune-glass/Vault
 * mockup). Page-level orbs now live in the dashboard shell. All visible strings
 * still flow through `t("vault.*")` keys, and the analytics link keeps its real
 * new-tab /projects/rune behaviour.
 */
export default function Vault() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<VaultTab>("pool");

  const indicatorLeft =
    activeTab === "pool" ? "4px" : activeTab === "lock" ? "calc(33.333% + 1px)" : "calc(66.666% - 2px)";

  return (
    <PageEnter>
      <div className="relative pb-24 lg:pb-8 px-4 lg:px-6">
        {/* Header — glass icon tile + live pulse + metallic title */}
        <header className="pt-6 pb-5 relative z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                  <Layers className="text-amber-200" size={20} />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3">
                  <div
                    className="absolute inset-0 bg-emerald-400 rounded-full"
                    style={{ animation: "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
                  />
                  <div className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50" />
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight gold-text drop-shadow-md leading-tight">
                  {t("vault.pageTitle")}
                </h1>
                <p className="text-xs text-white/70 truncate">{t("vault.pageSubtitle")}</p>
              </div>
            </div>

            {/* 查看分析 — real behaviour preserved: opens mainnet RUNE analytics
                in a NEW TAB so the user keeps their place on /app/vault. */}
            <a
              href="/projects/rune"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white/90 hover:bg-white/20 transition-colors backdrop-blur-md shrink-0"
              data-testid="link-view-analysis"
            >
              <span className="whitespace-nowrap">{t("vault.viewAnalysis", "查看分析")}</span>
              <ExternalLink size={12} className="opacity-70" />
            </a>
          </div>
        </header>

        {/* Tab Switcher — sliding glass pill */}
        <div className="mb-6 relative z-10">
          <div className="flex p-1 rounded-xl bg-black/20 backdrop-blur-md border border-white/10 relative">
            <div
              className="absolute inset-y-1 rounded-lg bg-white/15 shadow-sm border border-white/20 transition-all duration-300 ease-out"
              style={{ width: "calc(33.333% - 5px)", left: indicatorLeft }}
            />
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  title={t(tab.descKey)}
                  className={`flex-1 py-2 text-xs font-semibold z-10 transition-colors ${
                    isActive ? "text-white" : "text-white/55 hover:text-white/80"
                  }`}
                  data-testid={`tab-vault-${tab.key}`}
                >
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <main className="relative z-10">
          <SubTabSwitch tabKey={activeTab}>
            <AnimatePresence mode="wait">
              {activeTab === "pool" && (
                <motion.div
                  key="pool"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, type: "spring" }}
                  className="space-y-4 pb-4"
                >
                  <VaultRecruitment />
                  <VaultLpPool />
                  <VaultCharts />
                </motion.div>
              )}
              {activeTab === "lock" && (
                <motion.div
                  key="lock"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, type: "spring" }}
                >
                  <RuneLockSection />
                </motion.div>
              )}
              {activeTab === "burn" && (
                <motion.div
                  key="burn"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, type: "spring" }}
                >
                  <EmberBurnSection />
                </motion.div>
              )}
            </AnimatePresence>
          </SubTabSwitch>
        </main>
      </div>
    </PageEnter>
  );
}
