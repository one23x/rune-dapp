/**
 * Arbitrum 节点购买 — thirdweb Edition Drop (DropERC1155) on Arbitrum One.
 *
 * 与 BSC NodePresell 购买流程**并存**:这是新增的第二条购买通道,链上是 Arbitrum
 * 上一套 DropERC1155(`arbNodeDropContract`),5 档 = token id 0–4,USDC(Arb)结算。
 *
 * 支付走 thirdweb v5 `ClaimButton`(claimParams type=ERC1155),并依赖其内置的
 * Pay Modal:当连接钱包在 Arbitrum 上 USDC 不足时,Modal 自动开启
 * buyWithCrypto / buyWithFiat(默认开启),让只有 USDT@BSC 的买家也能付 ——
 * thirdweb pay 会把 USDT@BSC 桥/swap 成 USDC@Arbitrum 再完成 claim。
 *
 * 余量(已 claim / 限量)与价格优先从链上 `getActiveClaimCondition` 读;读不到
 * (无活动 claim 阶段 / RPC 抖动)时退回 contracts.ts 里的静态 tier 表展示。
 */

import { useTranslation } from "react-i18next";
import { useActiveAccount, ClaimButton } from "thirdweb/react";
import { ShieldCheck, Users, Wallet, Loader2 } from "lucide-react";
import { PremiumCard } from "@app/components/premium-card";
import { thirdwebClient } from "@/lib/thirdweb/client";
import { arbitrum } from "@/lib/thirdweb/chains";
import { ARB_NODE_DROP_ADDRESS } from "@/lib/thirdweb/addresses";
import { ARB_NODE_TIERS, type ArbNodeTier } from "@/lib/thirdweb/contracts";
import { useArbTierClaimCondition } from "@/hooks/rune/use-arb-node-drop";
import { useToast } from "@app/hooks/use-toast";

// Edition Drop 上 USDC 精度 = 6(原生 Arb USDC)。展示价格时按此换算。
const USDC_DECIMALS = 6n;

function fmtUsdcWhole(raw: bigint): string {
  return (raw / 10n ** USDC_DECIMALS).toLocaleString("en-US");
}

function TierCard({ tier }: { tier: ArbNodeTier }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const account = useActiveAccount();
  const isZh = i18n.language.startsWith("zh");

  // 链上活动 claim 阶段:价格 + 已 claim + 限量。读不到则退回静态表。
  const ccQ = useArbTierClaimCondition(tier.tokenId);
  const cc = ccQ.data;

  const priceLabel = cc ? fmtUsdcWhole(cc.pricePerToken) : tier.priceUsdc.toLocaleString("en-US");
  const maxSupply = cc ? Number(cc.maxClaimableSupply) : tier.maxSupply;
  const claimed = cc ? Number(cc.supplyClaimed) : 0;
  const remaining = Number.isFinite(maxSupply) ? Math.max(maxSupply - claimed, 0) : null;
  const soldOut = remaining !== null && remaining <= 0;
  const occupiedPct = maxSupply > 0 ? Math.min(Math.round((claimed / maxSupply) * 100), 100) : 0;

  const tierName = isZh ? tier.nameCn : tier.nameEn;

  return (
    <PremiumCard className="p-3.5">
      <div className="flex items-start gap-3">
        <div
          className="h-11 w-11 rounded-xl shrink-0 flex items-center justify-center text-xl font-bold"
          style={{
            background: `rgba(${tier.rgb}, 0.16)`,
            color: `rgb(${tier.rgb})`,
            border: `1.5px solid rgba(${tier.rgb}, 0.32)`,
            boxShadow: `0 0 18px rgba(${tier.rgb}, 0.25)`,
          }}
        >
          {tier.nameCn.charAt(tier.nameCn.length - 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">{tierName}</span>
            <span className={`text-[11px] font-mono uppercase tracking-[0.16em] ${tier.color}`}>{tier.nameEn}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            {remaining !== null ? (
              <span>
                <span className="text-foreground/75 font-semibold">{remaining.toLocaleString()}</span>{" "}
                {t("arbNode.seatsLeft", "席位剩余")}
                {ccQ.isLoading && <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />}
              </span>
            ) : (
              <span>{t("arbNode.loadingCfg", "读取链上余量…")}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-bold tabular-nums" style={{ color: `rgb(${tier.rgb})` }}>
            {priceLabel}
          </div>
          <div className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-[0.18em]">USDC</div>
        </div>
      </div>

      {/* Occupancy */}
      {remaining !== null && maxSupply > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground/50 mb-1">
            <span>{t("arbNode.occupancy", "席位占用")}</span>
            <span className="tabular-nums">{occupiedPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${occupiedPct}%`, background: `rgba(${tier.rgb}, 0.7)` }} />
          </div>
        </div>
      )}

      {/* Claim — thirdweb ClaimButton, ERC1155, cross-chain pay (default PayModal) */}
      <div className="mt-3">
        {!account ? (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-[12px] text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            {t("arbNode.connectFirst", "请先连接钱包")}
          </div>
        ) : soldOut ? (
          <div className="flex items-center justify-center rounded-lg border border-red-500/25 bg-red-500/8 py-2.5 text-[12px] text-red-300/90 font-semibold">
            {t("arbNode.soldOut", "已售罄")}
          </div>
        ) : (
          <ClaimButton
            contractAddress={ARB_NODE_DROP_ADDRESS}
            chain={arbitrum}
            client={thirdwebClient}
            claimParams={{
              type: "ERC1155",
              tokenId: tier.tokenId,
              quantity: 1n,
              // 给 allowlist 类 claim condition 传 from = 领取人,避免 allowlist 校验问题。
              from: account.address,
            }}
            // PayModal 默认开启跨链买币 + 法币入金:只有 USDT@BSC 的买家也能付,
            // thirdweb pay 会自动桥/swap 成 USDC@Arbitrum 再 claim。
            payModal={{
              theme: "dark",
              metadata: { name: `RUNE ${tier.nameEn}` },
            }}
            className="w-full"
            style={{
              background: `rgb(${tier.rgb})`,
              color: "#000",
              fontWeight: 700,
              borderRadius: "0.5rem",
              boxShadow: `0 0 18px rgba(${tier.rgb}, 0.35)`,
            }}
            onTransactionConfirmed={() => {
              toast({
                title: t("arbNode.toastDone", "购买成功"),
                description: t("arbNode.toastDoneDesc", "节点 NFT 已铸造到你的钱包(Arbitrum)。"),
              });
              ccQ.refetch();
            }}
            onError={(e) => {
              toast({
                title: t("arbNode.toastFail", "购买失败"),
                description: e?.message ?? t("arbNode.toastFailDesc", "交易未完成,请重试。"),
                variant: "destructive",
              });
            }}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              {t("arbNode.buy", "购买节点")}
            </span>
          </ClaimButton>
        )}
      </div>
    </PremiumCard>
  );
}

/**
 * ArbNodePurchase — drop-in body listing the 5 Arbitrum Edition Drop tiers,
 * each with its own ClaimButton. No page chrome (the host page supplies the
 * header / tab strip), matching the HlCopySection pattern.
 */
export function ArbNodePurchase() {
  const { t } = useTranslation();
  return (
    <div className="space-y-3" style={{ animation: "fadeSlideIn 0.4s ease-out 0.1s both" }}>
      <div>
        <h2 className="font-display text-[15px] font-bold text-foreground">
          {t("arbNode.sectionTitle", "Arbitrum 节点购买")}
        </h2>
        <p className="mt-1 text-[12px] text-foreground/55 leading-relaxed">
          {t(
            "arbNode.subtitle",
            "在 Arbitrum One 上以 USDC 购买节点(链上 Edition Drop)。只持有 USDT@BSC 也可一键跨链支付,系统自动兑成 USDC 后完成铸造。",
          )}
        </p>
      </div>
      {ARB_NODE_TIERS.map((tier) => (
        <TierCard key={tier.tokenId.toString()} tier={tier} />
      ))}
    </div>
  );
}

export default ArbNodePurchase;
