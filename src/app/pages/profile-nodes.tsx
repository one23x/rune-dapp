import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { NodeOverviewPanel } from "@app/components/profile/node-overview";
import { RewardsPanel } from "@app/components/profile/team-detail";
import { ArbNodePurchase } from "@app/components/nodes/arb-node-purchase";
import { Server, Gift, Layers } from "lucide-react";
import { DashboardSubTabs, type SubTabItem } from "@app/components/dashboard-sub-tabs";
import { PageEnter, SubTabSwitch } from "@app/components/page-enter";
import { GoldCard } from "@app/components/premium-card";

type Sub = "overview" | "rewards" | "arb";

const TABS: SubTabItem<Sub>[] = [
  { key: "overview", icon: Server, labelKey: "profile.nodeOverview",      fallback: "Overview" },
  { key: "rewards",  icon: Gift,   labelKey: "profile.nodeRewards.title", fallback: "Rewards" },
  // Arbitrum 节点购买 —— 与 BSC NodePresell 并存的新增通道(USDC@Arbitrum, 跨链可付)。
  { key: "arb",      icon: Layers, labelKey: "arbNode.tab",               fallback: "Arbitrum" },
];

/**
 * 节点中心 — Overview (RUNE OverviewTab) + Rewards. Wrapper is styled in
 * the same "premium reactor" language as Vault: layered amber ambience,
 * gradient title strip with accent rails, and a content card framed by a
 * slowly-revolving gold ring + halo (`nodes-gold-ring`). RUNE nodes pay
 * no daily yield; the only earning is the on-chain direct-referral
 * commission that RewardsTab already surfaces on the referral page.
 */
export default function ProfileNodes() {
  const account = useActiveAccount();
  const address = account?.address;
  const { t } = useTranslation();
  const [sub, setSub] = useState<Sub>("overview");

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        {t("common.connectWallet", "请先连接钱包")}
      </div>
    );
  }

  return (
    <PageEnter>
      <div className="relative overflow-hidden pb-24 lg:pb-8">
        {/* Layered amber ambience — same recipe as Vault so the two pages
            feel like the same product. Pure decoration, pointer-events-none. */}
        <div className="pointer-events-none absolute -top-24 left-[8%] h-[30rem] w-[30rem] rounded-full bg-amber-500/[0.10] blur-[120px]" />
        <div className="pointer-events-none absolute top-[28%] right-[6%] h-[26rem] w-[26rem] rounded-full bg-amber-400/[0.07] blur-[100px]" />
        <div className="pointer-events-none absolute top-[60%] left-[18%] h-[22rem] w-[22rem] rounded-full bg-orange-500/[0.05] blur-[110px]" />

        {/* Animated diagonal gold scan-line — sells the "tech / luxury" texture
            without any per-element accents. Lives behind the content. */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, transparent 0%, transparent 38%, rgba(251,191,36,0.05) 50%, transparent 62%, transparent 100%)",
            backgroundSize: "250% 100%",
            mixBlendMode: "screen",
          }}
          animate={{ backgroundPosition: ["180% 0%", "-80% 0%"] }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        />

        {/* Page-scoped CSS: only the header pulse-line keyframe now lives
            here. The rotating gold ring + halo was extracted into the shared
            `.gold-ring` class (src/app/index.css) so every page can reuse it;
            this page now consumes it via the <GoldCard> wrapper below. */}
        <style>{`
          @keyframes nodesPulseLine { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
        `}</style>

        {/* Header — premium reactor strip, matched to Vault's layout. Padding
            ladder mirrors the content area below so the title icon, the
            tab-pill row, and the gold ring share a single vertical axis on
            every breakpoint (critical at 320px). */}
        <div className="relative px-3 sm:px-4 lg:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 max-w-6xl mx-auto w-full">
          <div className="pointer-events-none absolute inset-x-3 sm:inset-x-4 lg:inset-x-6 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/85 to-transparent" />
          <div className="pointer-events-none absolute inset-x-[22%] sm:inset-x-[18%] top-[1.5px] h-px bg-gradient-to-r from-transparent via-amber-200/45 to-transparent" />
          <div
            className="pointer-events-none absolute inset-x-3 sm:inset-x-4 lg:inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent"
            style={{ animation: "nodesPulseLine 3.4s ease-in-out infinite" }}
          />

          <div className="flex items-center gap-2 sm:gap-2.5">
            <div
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl flex items-center justify-center ring-2 ring-amber-400/55 shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.32), rgba(180,90,10,0.18))",
                boxShadow: "0 4px 16px hsl(38 95% 55% / 0.45), inset 0 1px 0 rgba(255,255,255,0.20)",
              }}
            >
              <Server className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-200" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className="text-[16px] sm:text-[18px] font-black leading-tight tracking-[0.02em] truncate"
                style={{
                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 40%, #fbbf24 65%, #d97706 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.5))",
                }}
                data-testid="text-nodes-page-title"
              >
                {t("profile.nodesPageTitle", "我的节点")}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-amber-200/65 mt-0.5 tracking-wide truncate">
                {t("profile.nodesPageSubtitle", "节点权益 · 直推奖励 · 实时上链")}
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tabs — DashboardSubTabs is already mobile-tested down to 320px */}
        <div className="relative px-3 sm:px-4 lg:px-6 max-w-6xl mx-auto w-full">
          <DashboardSubTabs<Sub> tabs={TABS} active={sub} onChange={setSub} testIdPrefix="tab-nodes" />
        </div>

        {/* Content frame — animated gold ring + halo wrap the actual tab
            content. Inner padding is the only thing that fights the halo on
            narrow screens; `p-2.5` on mobile keeps the halo glow visible
            without crowding the cards inside. */}
        <div className="relative px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 max-w-6xl mx-auto w-full">
          <GoldCard className="p-2.5 sm:p-4 lg:p-5">
            <div className="relative z-[2]">
              <SubTabSwitch tabKey={sub}>
                {sub === "overview" ? <NodeOverviewPanel address={address} />
                  : sub === "rewards" ? <RewardsPanel address={address} />
                  : <ArbNodePurchase />}
              </SubTabSwitch>
            </div>
          </GoldCard>
        </div>
      </div>
    </PageEnter>
  );
}
