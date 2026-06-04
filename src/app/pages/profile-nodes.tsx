import { useActiveAccount } from "thirdweb/react";
import { useTranslation } from "react-i18next";
import { ArbNodePurchase } from "@app/components/nodes/arb-node-purchase";
import { PageEnter } from "@app/components/page-enter";

/**
 * 隐藏的节点购买页 —— 仅通过直链 /profile/nodes 访问(不在任何导航/菜单)。
 * Arbitrum One 上的 thirdweb Edition Drop 节点购买(6 档,含 token5=1 USDC 体验档),
 * 支持跨链支付(USDT@BSC → 自动兑 USDC@Arbitrum)。原 /nodes 页保持不变。
 */
export default function ProfileNodes() {
  const account = useActiveAccount();
  const { t } = useTranslation();
  return (
    <PageEnter>
      <div className="px-4 lg:px-6 py-5 max-w-2xl mx-auto space-y-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("profile.nodesPageTitle", "我的节点")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t("profile.nodesPageSubtitle", "节点权益 · 直推奖励 · 实时上链")}</p>
        </div>
        {!account ? (
          <p className="text-sm text-muted-foreground py-10 text-center">{t("common.connectWallet", "请先连接钱包")}</p>
        ) : (
          <ArbNodePurchase />
        )}
      </div>
    </PageEnter>
  );
}
