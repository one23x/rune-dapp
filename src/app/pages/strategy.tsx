import { StrategyHeader } from "@app/components/strategy/strategy-header";
import { HlCopySection } from "@app/components/strategy/hl-copy-section";

/**
 * Strategy = a single Hyperliquid page (was a 3-tab surface — consolidated per
 * UIUX direction), laid out like the Trade page:
 *
 *   StrategyHeader (页眉)
 *   └─ HlCopySection
 *        ├─ 智能合约跟单 hero  → tap → /strategy/hl hub
 *        │     (统计台 + 4 tabs: 总览 / 智能跟单 / 信号源 / 持仓·平仓)
 *        └─ 交易所式双栏: 左 = 推荐金库 (real-time HL 链上协议金库,纯展示)
 *                         右 = 实验室 (AiLab)
 *
 * 金库介绍 (TradingVaultBanner) is kept in the codebase but no longer surfaced.
 */
export default function StrategyPage() {
  return (
    <div className="space-y-4 pb-24 lg:pb-8 lg:px-6 lg:pt-4" data-testid="page-strategy">
      <StrategyHeader />
      <div className="px-4 space-y-4">
        <HlCopySection />
      </div>
    </div>
  );
}
