/**
 * 我的节点 / My Nodes — `/nodes`
 *
 * Reuses existing building blocks (no re-invention):
 *   • useNodeMembershipsRune  — wallet's held nodes from rune_purchases
 *   • useNodeStatus           — current granted node level (engine gating)
 *   • useRedeemCode           — redeem an authorization code (same flow as NodeGateCard)
 *   • NodePresell.nodePresell — legacy presell buy (USDT approve + nodePresell),
 *                               emits EventNodePresell → indexer → rune_purchases
 *   • NODE_META               — 5 tiers (101–501): level / nameCn / nameEn / color / priceUsdt
 *   • NodeBadge               — granted-level badge (from copy-trading/shared)
 *
 * Three sections: held panel, buy grid (+ buy dialog), redeem-code card.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { prepareContractCall, waitForReceipt } from "thirdweb";
import { approve } from "thirdweb/extensions/erc20";
import { PageEnter } from "@app/components/page-enter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@app/lib/utils";
import { useToast } from "@app/hooks/use-toast";
import { queryClient } from "@app/lib/queryClient";
import { useNodeMembershipsRune } from "@app/lib/data-rune";
import { useNodeStatus, useRedeemCode } from "@app/lib/engine-hooks";
import { getPaymentStatusLabel, type PaymentStatus } from "@app/hooks/use-payment";
import { NodeBadge } from "@app/components/copy-trading/shared";
import { NODE_META, NODE_IDS, type NodeId, nodePresellContract, usdtContract } from "@/lib/thirdweb/contracts";
import { getRuneAddresses } from "@/lib/thirdweb/addresses";
import { runeChain, runeChainKey } from "@/lib/thirdweb/chains";
import { thirdwebClient } from "@/lib/thirdweb/client";
import { useNodeConfigs } from "@/hooks/rune/use-node-presell";
import {
  Layers, ShoppingCart, KeyRound, Loader2, CheckCircle2, ShieldCheck, Gem,
} from "lucide-react";

function fmtPrice(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}

/** Tier card meta resolved from NODE_META + i18n benefit blurbs. */
function tierBenefits(t: ReturnType<typeof useTranslation>["t"], nameEn: string): string {
  return t(`node.benefit.${nameEn}`, "");
}

// ─── Buy dialog ──────────────────────────────────────────────────────────────

function BuyDialog({
  open, onOpenChange, initialTier,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTier: NodeId | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendTransaction();
  const configsQ = useNodeConfigs();
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [selected, setSelected] = useState<NodeId | null>(initialTier);

  const busy = status === "approving" || status === "paying" || status === "confirming" || status === "recording";

  function handleOpenChange(v: boolean) {
    if (busy) return; // don't close mid-transaction
    if (!v) { setStatus("idle"); setSelected(initialTier); }
    onOpenChange(v);
  }

  /** Resolve the on-chain payAmount (USDT wei, 18 dec) for a given nodeId.
   *  Source of truth is NodePresell.getNodeConfigs; fall back to the display
   *  price in NODE_META when the read hasn't landed. */
  function resolvePayAmount(nodeId: NodeId): bigint {
    const cfg = (configsQ.data as { nodeId: bigint; payAmount: bigint }[] | undefined)
      ?.find((c) => Number(c.nodeId) === nodeId);
    if (cfg && cfg.payAmount > 0n) return cfg.payAmount;
    return BigInt(NODE_META[nodeId].priceUsdt) * 10n ** 18n;
  }

  // Buy via the legacy NodePresell contract (0xF327…) so the QuickNode indexer
  // picks up EventNodePresell → writes rune_purchases (no manual backfill).
  // referrer is pre-bound on-chain; nodePresell(nodeId) pulls USDT via
  // approve + transferFrom, so we only approve then call with the nodeId.
  async function onBuy() {
    if (!selected) return;
    if (!account) {
      toast({ title: t("common.error", "出错了"), description: t("node.connectFirst", "请先连接钱包"), variant: "destructive" });
      return;
    }
    const nodeId = selected;
    const payAmount = resolvePayAmount(nodeId);
    const spender = getRuneAddresses(runeChainKey).nodePresell;

    try {
      // Step 1: approve USDT to NodePresell (exact payAmount).
      setStatus("approving");
      const approveTx = approve({ contract: usdtContract, spender, amountWei: payAmount });
      const approveResult = await sendTransaction(approveTx);
      await waitForReceipt({ client: thirdwebClient, chain: runeChain, transactionHash: approveResult.transactionHash });

      // Step 2: nodePresell(uint256 nodeId) — emits EventNodePresell.
      setStatus("paying");
      const buyTx = prepareContractCall({
        contract: nodePresellContract,
        method: "function nodePresell(uint256 nodeId)",
        params: [BigInt(nodeId)],
      });
      (buyTx as any).gas = BigInt(600000);
      const buyResult = await sendTransaction(buyTx);

      setStatus("confirming");
      const receipt = await waitForReceipt({ client: thirdwebClient, chain: runeChain, transactionHash: buyResult.transactionHash });
      if (receipt.status === "reverted") throw new Error("Transaction reverted");

      // No DB write needed: the indexer derives rune_purchases from
      // EventNodePresell, so confirmation alone is success.
      setStatus("success");
      toast({
        title: t("node.buySuccess", "购买成功"),
        description: t("node.buySuccessDesc", "节点已购买,链上确认后即生效。"),
      });
      // Refresh held panel + gating status.
      queryClient.invalidateQueries({ queryKey: ["rune", "purchases"] });
      queryClient.invalidateQueries({ queryKey: ["engine", "node-status", account?.address?.toLowerCase()] });
      window.setTimeout(() => handleOpenChange(false), 1200);
    } catch (e: any) {
      setStatus("error");
      toast({
        title: t("common.error", "出错了"),
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border w-[calc(100vw-1.5rem)] max-w-md p-4 rounded-2xl max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
              <ShoppingCart className="h-4 w-4 text-black" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] font-bold leading-tight">{t("node.buyTitle", "购买节点")}</DialogTitle>
              <DialogDescription className="text-[12px] leading-tight">
                {t("node.buyDialogDesc", "选择档位,使用 USDT 支付。")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {/* Tier selector */}
          <div className="space-y-2">
            {NODE_IDS.map((id) => {
              const meta = NODE_META[id];
              const isSel = selected === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  onClick={() => setSelected(id)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                    isSel
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-white/10 bg-white/[0.03] hover:border-amber-400/40",
                  )}
                  data-testid={`buy-tier-${id}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Gem className={cn("h-4 w-4 shrink-0", meta.color)} />
                    <span className="min-w-0">
                      <span className={cn("text-[13px] font-bold", meta.color)}>{meta.nameCn}</span>
                      <span className="ml-1.5 text-[11px] text-muted-foreground">{meta.nameEn}</span>
                    </span>
                  </span>
                  <span className="text-[13px] font-bold tabular-nums text-foreground/90 shrink-0">{fmtPrice(meta.priceUsdt)}</span>
                </button>
              );
            })}
          </div>

          {busy && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-[12px] font-semibold text-amber-300">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              {getPaymentStatusLabel(status)}
            </div>
          )}
          {status === "success" && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-[12px] font-semibold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {t("node.buySuccess", "购买成功")}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => handleOpenChange(false)}>
            {t("common.cancel", "取消")}
          </Button>
          <Button
            size="sm"
            disabled={!selected || busy}
            onClick={onBuy}
            className="bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold"
            data-testid="button-confirm-buy"
          >
            {busy ? getPaymentStatusLabel(status) : t("node.buyConfirm", "确认购买")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Redeem-code card (mirrors NodeGateCard's redeem interaction) ─────────────

function RedeemCard({ wallet }: { wallet: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const redeem = useRedeemCode(wallet);

  async function onVerify() {
    try {
      const res = await redeem.mutateAsync(code.trim());
      if (res?.ok) {
        toast({
          title: t("node.redeemSuccess", "授权码已验证"),
          description: res.level != null
            ? t("node.redeemSuccessLevel", "已开通节点 L{{level}}", { level: res.level })
            : t("node.redeemSuccessDesc", "节点权限已开通,可以开通交易账户了。"),
        });
        setCode("");
        // node-status invalidated by the hook; also refresh held panel.
        queryClient.invalidateQueries({ queryKey: ["rune", "purchases"] });
      } else {
        toast({ title: t("common.error", "出错了"), description: res?.error || t("node.redeemInvalid", "授权码无效"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: t("common.error", "出错了"), description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  return (
    <div className="premium-card rounded-2xl p-5 space-y-3" data-testid="node-redeem-card">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 grid place-items-center shrink-0">
          <KeyRound className="h-4.5 w-4.5 text-black" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-foreground">{t("node.redeemTitle", "授权码兑换")}</h2>
          <p className="mt-0.5 text-[12px] text-foreground/55 leading-snug">{t("node.redeemDesc", "已有授权码?输入即可开通节点权限。")}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("node.codePlaceholder", "授权码")}
          className="bg-background/50 border-border text-sm flex-1 font-mono"
          data-testid="input-node-code"
          onKeyDown={(e) => { if (e.key === "Enter" && code.trim() && !redeem.isPending) onVerify(); }}
        />
        <Button
          className="bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold shrink-0 sm:w-auto w-full"
          disabled={!code.trim() || redeem.isPending}
          onClick={onVerify}
          data-testid="button-verify-node-code"
        >
          {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("node.verify", "验证")}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NodesPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;

  const membershipsQ = useNodeMembershipsRune();
  const statusQ = useNodeStatus(wallet);
  const memberships = membershipsQ.data ?? [];

  const [buyOpen, setBuyOpen] = useState(false);
  const [buyTier, setBuyTier] = useState<NodeId | null>(null);

  function openBuy(tier: NodeId | null) {
    setBuyTier(tier);
    setBuyOpen(true);
  }

  // Map a held membership's nodeType (nameEn) back to a NODE_META tier for display.
  const tierByNameEn = (nameEn: string): { id: NodeId; meta: typeof NODE_META[NodeId] } | null => {
    const id = NODE_IDS.find((nid) => NODE_META[nid].nameEn === nameEn);
    return id ? { id, meta: NODE_META[id] } : null;
  };

  const level = statusQ.data?.level ?? 0;

  return (
    <PageEnter>
      <div className="relative pb-24 lg:pb-8 px-4 lg:px-6" data-testid="page-nodes">
        {/* Header */}
        <header className="pt-6 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 grid place-items-center shrink-0 shadow-lg shadow-amber-500/20">
              <Layers className="h-5 w-5 text-black" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight gold-text">{t("node.pageTitle", "我的节点")}</h1>
              <p className="text-[12px] text-muted-foreground">{t("node.pageSubtitle", "持有节点解锁开户与跟单权限")}</p>
            </div>
          </div>
        </header>

        <main className="space-y-4 relative z-10">
          {/* ── Held panel ── */}
          <section className="premium-card rounded-2xl p-5 space-y-3" data-testid="node-held-panel">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-foreground">{t("node.heldTitle", "我持有的节点")}</h2>
              {level > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-amber-200"
                  style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)" }}>
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
                  {t("node.levelBadge", "节点 L{{level}}", { level })}
                </span>
              )}
            </div>

            {level > 0 && statusQ.data?.limits && (
              <NodeBadge level={level} limits={statusQ.data.limits} />
            )}

            {membershipsQ.isLoading ? (
              <div className="py-6 text-center"><Loader2 className="h-5 w-5 text-amber-300 animate-spin mx-auto" /></div>
            ) : memberships.length === 0 ? (
              <div className="py-8 text-center">
                <Layers className="h-9 w-9 text-muted-foreground/25 mx-auto mb-3" />
                <p className="text-sm text-foreground/60">{t("node.emptyTitle", "你还没有持有任何节点")}</p>
                <p className="mt-1 text-[12px] text-muted-foreground/60">{t("node.emptyDesc", "购买节点即可解锁开户与跟单。")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {memberships.map((m) => {
                  const tier = tierByNameEn(m.nodeType);
                  const meta = tier?.meta;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
                      data-testid={`held-node-${m.id}`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Gem className={cn("h-4 w-4 shrink-0", meta?.color ?? "text-slate-300")} />
                        <span className="min-w-0">
                          <span className={cn("text-[13px] font-bold", meta?.color ?? "text-foreground")}>
                            {meta?.nameCn ?? m.nodeType}
                          </span>
                          <span className="ml-1.5 text-[11px] text-muted-foreground">{meta?.nameEn ?? m.nodeType}</span>
                        </span>
                      </span>
                      <span className="text-[13px] font-bold tabular-nums text-foreground/90 shrink-0">
                        {fmtPrice(meta?.priceUsdt ?? Number(m.price))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Buy grid ── */}
          <section className="space-y-3" data-testid="node-buy-grid">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-foreground">{t("node.buyGridTitle", "购买节点")}</h2>
              <span className="text-[11px] text-muted-foreground">{t("node.payHint", "USDT 支付 · {{chain}}", { chain: runeChain.name ?? "BSC" })}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {NODE_IDS.map((id) => {
                const meta = NODE_META[id];
                const benefit = tierBenefits(t, meta.nameEn);
                return (
                  <div
                    key={id}
                    className="premium-card rounded-2xl p-4 flex flex-col gap-3"
                    style={{ borderColor: `rgba(${meta.rgb}, 0.25)` }}
                    data-testid={`node-card-${id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Gem className={cn("h-5 w-5", meta.color)} />
                        <span>
                          <div className={cn("text-[15px] font-bold leading-tight", meta.color)}>{meta.nameCn}</div>
                          <div className="text-[11px] text-muted-foreground leading-tight">{meta.nameEn}</div>
                        </span>
                      </span>
                      <div className="text-right">
                        <div className="text-[16px] font-bold tabular-nums text-foreground">{fmtPrice(meta.priceUsdt)}</div>
                        <div className="text-[10px] text-muted-foreground">USDT</div>
                      </div>
                    </div>
                    {benefit && <p className="text-[12px] text-foreground/60 leading-snug flex-1">{benefit}</p>}
                    <Button
                      className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold"
                      onClick={() => openBuy(id)}
                      data-testid={`button-buy-${id}`}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1.5" />
                      {t("node.buyCta", "购买节点")}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Redeem code ── */}
          {wallet && <RedeemCard wallet={wallet} />}
        </main>

        {/* key on the tier so reopening from a different card resets the dialog's selection */}
        <BuyDialog key={buyTier ?? "none"} open={buyOpen} onOpenChange={setBuyOpen} initialTier={buyTier} />
      </div>
    </PageEnter>
  );
}
