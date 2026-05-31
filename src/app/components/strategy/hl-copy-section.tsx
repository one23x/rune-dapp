/**
 * Hyperliquid copy-trading section — the heart of the Strategy page.
 *
 * This folds the former standalone /hl page into the Strategy surface so that
 * "Strategy = Hyperliquid": the agent-copy list is reframed as the risk-tier
 * STRATEGY list (保守 / 稳健 / 激进 / 套利), with HL 开户 (enable / connect),
 * the mainnet/testnet toggle, and 持仓 / 历史 all living here.
 *
 * Engine wiring (Bearer read plane, real data only):
 *   - GET /v1/hl/leaders                 → useHlLeaders   (策略 by risk tier)
 *   - GET /v1/hl/signals                 → useHlSignals   (数据源 leader feed)
 *   - GET /v1/hl/account                 → useHlAccount   (持仓 / 历史)
 *   - GET /v1/users/:id/hl/subscriptions → useHlSubs      (active follows)
 *
 * One-click follow attempts POST .../hl/subscriptions and degrades gracefully
 * (see useHlCopy) until the engine create route ships.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount, PayEmbed } from "thirdweb/react";
import {
  Users, Activity, Layers, History as HistoryIcon, ChevronDown, ChevronRight,
  Wallet, TrendingUp, TrendingDown, Zap, Crown, ShieldCheck, CheckCircle2,
  Loader2, Circle, AlertTriangle, RefreshCw, Copy, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PremiumCard } from "@app/components/premium-card";
import { cn } from "@app/lib/utils";
import { copyText } from "@app/lib/copy";
import { queryClient } from "@app/lib/queryClient";
import { useToast } from "@app/hooks/use-toast";
import {
  useEngineUser, useHlLeaders, useHlSignals, useHlAccount, useHlSubs,
} from "@app/lib/engine-hooks";
import { hyperliquid } from "@app/lib/engine";
import { thirdwebClient } from "@/lib/thirdweb/client";
import { arbitrum } from "@/lib/thirdweb/chains";

// HL 交易账户的结算币 = USDC@Arbitrum One。跨链/买币用 PayEmbed 直接送到用户的托管 EOA。
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`;

// HL 跨链/买币直充(thirdweb PayEmbed)—— 和 pUSD 同源,只是目标链/币换成 Arbitrum/USDC,
// 收款地址 = 用户的托管 EOA(HL 签名者/账户),即「跨链转入 EOA」。仅主网;测试网走水龙头。
function HlDepositBridge({ depositAddress, network }: { depositAddress: string; network: HlNetwork }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [go, setGo] = useState(false);
  const amt = Number(amount);
  if (network === "testnet") {
    return (
      <div className="border-t border-border/40 pt-3">
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          {t("hl.testnetFaucetNote", "测试网:从 Hyperliquid 测试网水龙头领测试 USDC,或把测试 USDC 充到上面的托管地址。跨链买币仅主网可用。")}
        </p>
      </div>
    );
  }
  if (!depositAddress) return null;
  return (
    <div className="border-t border-border/40 pt-3 space-y-2">
      <label className="text-[12px] text-muted-foreground block">
        {t("hl.bridgeFundLabel", "用卡 / 跨链买 USDC 直充到托管账户(Arbitrum)")}
      </label>
      {!go || !(amt > 0) ? (
        <div className="flex items-center gap-2">
          <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="USDC" className="text-xs" />
          <Button size="sm" disabled={!(amt > 0)} onClick={() => setGo(true)}>{t("common.next", "下一步")}</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl">
          <button className="mb-1 text-[11px] text-amber-300 hover:underline" onClick={() => setGo(false)}>← {t("common.back", "改数量")}</button>
          <PayEmbed
            client={thirdwebClient}
            payOptions={{
              mode: "direct_payment",
              paymentInfo: {
                chain: arbitrum,
                sellerAddress: depositAddress as `0x${string}`,
                token: { address: USDC_ARBITRUM },
                amount: String(amt),
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
import type { HlLeader, HlNetwork, HlPosition, HlSignal } from "@app/lib/engine";
import {
  NetworkToggle, HlEmpty, useHlCopy, groupByTier, HL_TIERS, TIER_META,
  shortAddr, fmtUsd, fmtHold, fmtScore, fmtTimeAgo,
} from "@app/components/hl/shared";
import { useOnboardFlow } from "@app/components/copy-trading/shared";

// ── HL 充值 / 提现(响应式)──────────────────────────────────────────────────
//
// 充值:展示用户的引擎托管 EOA(= HL 签名者/账户),用户从 Arbitrum 把 USDC 充进去;
//       测试网用 HL 测试网水龙头/桥。地址来自 engineUser.engineEoaAddress —— 未开户时为空,
//       由 HlAccountStrip 的「开通账户」先把它创建出来(解决"充值地址生成不出来")。
// 提现:hyperliquid.withdraw → 引擎签 withdraw3 经官方桥把 USDC 提到指定 Arbitrum 地址。
// 弹窗用 w-[calc(100vw-2rem)] max-w-sm + footer 在 <sm 纵向堆叠,适配手机端。
function HlFunding({
  userId, network, depositAddress, withdrawable, connectedWallet,
}: { userId: string; network: HlNetwork; depositAddress: string; withdrawable: number; connectedWallet: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [depOpen, setDepOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);
  const [amount, setAmount] = useState("");
  // 提现默认转到客户连接的钱包(EOA)。仍可改,但默认就是「直接转入连接钱包」。
  const [dest, setDest] = useState(connectedWallet);

  const amt = Number(amount);
  const amountValid = amount !== "" && Number.isFinite(amt) && amt > 0 && (withdrawable <= 0 || amt <= withdrawable);
  const destValid = /^0x[a-fA-F0-9]{40}$/.test(dest.trim());

  const withdraw = useMutation({
    mutationFn: async () => hyperliquid.withdraw(userId, { amountUsd: amt, destination: dest.trim(), network }),
    onSuccess: () => {
      toast({ title: t("hl.withdrawSuccess", "提现已提交"), description: t("hl.withdrawSuccessDesc", "USDC 将经官方桥到达目标 Arbitrum 地址(约几分钟,含 ~$1 桥费)。") });
      queryClient.invalidateQueries({ queryKey: ["engine", "hl", "account"] });
      setAmount(""); setDest(""); setWdOpen(false);
    },
    onError: (e: unknown) => toast({ title: t("common.error", "出错了"), description: String((e as { message?: string })?.message ?? e), variant: "destructive" }),
  });

  function copyAddr() {
    if (!depositAddress) return;
    const ok = copyText(depositAddress);
    toast(ok ? { title: t("common.copied", "已复制") } : { title: t("common.copyFailed", "复制失败"), variant: "destructive" });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-9 text-[13px] border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" onClick={() => setDepOpen(true)} data-testid="button-hl-deposit">
          <ArrowDownToLine className="h-4 w-4 mr-1.5" />{t("hl.deposit", "充值")}
        </Button>
        <Button variant="outline" className="h-9 text-[13px] border-amber-500/30 text-amber-300 hover:bg-amber-500/10" onClick={() => setWdOpen(true)} data-testid="button-hl-withdraw">
          <ArrowUpFromLine className="h-4 w-4 mr-1.5" />{t("hl.withdraw", "提现")}
        </Button>
      </div>

      {/* 充值:展示托管 EOA 地址 */}
      <Dialog open={depOpen} onOpenChange={setDepOpen}>
        <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-emerald-300" />{t("hl.depositTitle", "充值到 HL 交易账户")}
            </DialogTitle>
            <DialogDescription className="text-[12px] leading-relaxed">
              {network === "testnet"
                ? t("hl.depositDescTestnet", "测试网:用 Hyperliquid 测试网水龙头/桥把测试 USDC 充到下面这个托管地址。")
                : t("hl.depositDescMainnet", "主网:从 Arbitrum 把 USDC 充到下面这个托管地址,引擎用它在 HL 下单。")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[12px] text-muted-foreground mb-1 block">{t("hl.depositAddress", "充值地址(托管 EOA)")}</label>
              <div className="flex items-center gap-2">
                <Input value={depositAddress || t("hl.addressNeedOnboard", "暂无地址 —— 请先开通账户")} readOnly className="bg-background/50 text-[12px] font-mono" data-testid="input-hl-deposit-address" />
                <Button size="icon" variant="ghost" className="shrink-0" onClick={copyAddr} disabled={!depositAddress}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              {t("hl.depositNote", "仅支持 USDC(Arbitrum)。到账后即可在策略包一键跟单。提现请用本页「提现」。")}
            </p>
            {/* 跨链/买币直充到托管 EOA(和 pUSD 同源,目标链/币 = Arbitrum/USDC) */}
            <HlDepositBridge depositAddress={depositAddress} network={network} />
          </div>
          <DialogFooter>
            <Button variant="gold" className="w-full" onClick={() => setDepOpen(false)}>{t("common.done", "完成")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 提现:withdraw3 → Arbitrum */}
      <Dialog open={wdOpen} onOpenChange={(v) => { if (!v) { setAmount(""); setDest(connectedWallet); } setWdOpen(v); }}>
        <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4 text-amber-300" />{t("hl.withdrawTitle", "从 HL 提现")}
            </DialogTitle>
            <DialogDescription className="text-[12px] leading-relaxed">
              {t("hl.withdrawDesc", "经 Hyperliquid 官方桥把 USDC 提到指定 Arbitrum 地址(含 ~$1 桥费,占用保证金的部分需先平仓)。")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <label className="text-[12px] text-muted-foreground">{t("hl.withdrawAmount", "提现金额(USDC)")}</label>
                <span className="text-[11px] text-foreground/50">{t("hl.withdrawable", "可提")}: {fmtUsd(withdrawable)}</span>
              </div>
              <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" inputMode="decimal" className="bg-background/50 text-sm" data-testid="input-hl-withdraw-amount" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <label className="text-[12px] text-muted-foreground">{t("hl.withdrawDest", "提现到(默认你连接的钱包)")}</label>
                {connectedWallet && dest.trim().toLowerCase() !== connectedWallet.toLowerCase() && (
                  <button type="button" onClick={() => setDest(connectedWallet)} className="text-[11px] text-amber-300 hover:underline">
                    {t("hl.useConnectedWallet", "填入连接钱包")}
                  </button>
                )}
              </div>
              <Input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="0x..." className="bg-background/50 text-[12px] font-mono" data-testid="input-hl-withdraw-dest" />
              <p className="mt-1 text-[11px] text-muted-foreground/70">{t("hl.withdrawToConnectedNote", "USDC 经官方桥提到这个 Arbitrum 地址(默认 = 你连接的钱包)。")}</p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setWdOpen(false)}>{t("common.cancel", "取消")}</Button>
            <Button
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold disabled:opacity-50"
              disabled={!amountValid || !destValid || withdraw.isPending}
              onClick={() => withdraw.mutate()}
              data-testid="button-hl-withdraw-confirm"
            >
              {withdraw.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4 mr-1.5" />}
              {t("hl.withdrawConfirm", "确认提现")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── 开户 / enable strip — HL account onboarding state ────────────────────────
//
// Reflects the *real* engine-user state instead of assuming "已开通" the moment
// a wallet connects:
//   no wallet                → connect CTA
//   user query loading       → resolving skeleton
//   user query error         → friendly error + retry
//   wallet, no engine user   → explicit 开通 button (reuses useOnboardFlow:
//                              POST /users/onboard → confirm → enablePolymarket,
//                              the same idempotent contract /copy-trading uses)
//   engine user present      → enabled banner with live state
//
// The onboarding action is guarded against double-submit (disabled while the
// mutation is pending) and surfaces per-step progress so the user knows what
// is happening and how long it takes.

function HlAccountStrip({
  wallet, userLoading, userError, userId, onRetryUser, followCount,
}: {
  wallet?: string;
  userLoading: boolean;
  userError: boolean;
  userId?: string;
  onRetryUser: () => void;
  followCount: number;
}) {
  const { t } = useTranslation();
  const { steps, run, isPending } = useOnboardFlow(wallet);

  // Not connected → 开户 CTA (connect wallet to enable HL copy-trading).
  if (!wallet) {
    return (
      <PremiumCard className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(180,90,10,0.12))",
              border: "1px solid rgba(251,191,36,0.4)",
              boxShadow: "0 0 18px rgba(251,191,36,0.18)",
            }}
          >
            <Wallet className="h-5 w-5 text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[14px] font-bold text-foreground">
              {t("hl.openTitle")}
            </div>
            <p className="mt-0.5 text-[12px] text-foreground/55 leading-snug">{t("hl.openDesc")}</p>
          </div>
        </div>
      </PremiumCard>
    );
  }

  // Resolving the engine user for this wallet → skeleton (don't claim 已开通).
  if (userLoading) {
    return (
      <PremiumCard className="p-3.5">
        <div className="flex items-center gap-3">
          <Skeleton className="shrink-0 h-10 w-10 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-2.5 w-40 rounded" />
          </div>
        </div>
      </PremiumCard>
    );
  }

  // Engine user lookup failed → friendly error + retry (don't silently claim 已开通).
  if (userError) {
    return (
      <PremiumCard className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11"
            style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)" }}
          >
            <AlertTriangle className="h-5 w-5 text-red-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-foreground/90">{t("hl.openErrorTitle", "无法读取账户")}</div>
            <p className="mt-0.5 text-[11px] text-foreground/50 leading-snug">{t("hl.openErrorDesc", "连接引擎失败,请检查网络后重试。")}</p>
          </div>
          <button
            onClick={onRetryUser}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-2.5 py-1.5 text-[11px] font-semibold text-foreground/70 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />{t("common.retry", "重试")}
          </button>
        </div>
      </PremiumCard>
    );
  }

  // Wallet connected but no engine user yet → explicit 开通 action.
  if (!userId) {
    const stepLabels = [
      t("hl.openStep1", "创建引擎签名账户"),
      t("hl.openStep2", "确认链上授权"),
      t("hl.openStep3", "启用交易"),
    ];
    return (
      <PremiumCard className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(180,90,10,0.12))",
              border: "1px solid rgba(251,191,36,0.4)",
              boxShadow: "0 0 18px rgba(251,191,36,0.18)",
            }}
          >
            <Wallet className="h-5 w-5 text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[14px] font-bold text-foreground">
              {t("hl.openTitle")}
            </div>
            <p className="mt-0.5 text-[12px] text-foreground/55 leading-snug">{t("hl.openCtaDesc", "一次性开通交易账户即可一键跟单,约需 10 秒。")}</p>
          </div>
        </div>

        {/* Per-step progress so the user sees what's happening + how long it takes. */}
        {isPending && (
          <div className="space-y-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2.5">
            {stepLabels.map((label, i) => {
              const s = steps[i];
              return (
                <div key={i} className="flex items-center gap-2">
                  {s === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    : s === "running" ? <Loader2 className="h-3.5 w-3.5 text-amber-300 animate-spin shrink-0" />
                    : <Circle className="h-3.5 w-3.5 text-foreground/25 shrink-0" />}
                  <span className={cn("text-[11px]", s === "idle" ? "text-foreground/40" : "text-foreground/80")}>{label}</span>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={run}
          disabled={isPending}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[12px] font-bold transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed",
            "bg-gradient-to-r from-amber-500 to-yellow-600 text-black border border-amber-500/50",
          )}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {isPending ? t("hl.opening", "开通中…") : t("hl.openCta", "开通交易账户")}
        </button>
      </PremiumCard>
    );
  }

  // Engine user present → account enabled banner with quick state.
  return (
    <PremiumCard className="p-3.5">
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-xl h-10 w-10"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}
        >
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-foreground/90">{t("hl.accountEnabled")}</span>
            <Badge className="text-[9px] px-1.5 py-0 border-0 bg-emerald-500/15 text-emerald-300 no-default-hover-elevate no-default-active-elevate">
              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{t("hl.enabledBadge")}
            </Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/80">
            <code className="font-mono">{shortAddr(wallet)}</code>
            <span>·</span>
            <span>{t("hl.followsCount", { count: followCount })}</span>
          </div>
        </div>
      </div>
    </PremiumCard>
  );
}

// ── Account stat strip (持仓 totals) ─────────────────────────────────────────

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <PremiumCard className="p-3 text-center min-w-0">
      <div className="text-[15px] font-black tabular-nums truncate num-gold" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide truncate">{label}</div>
    </PremiumCard>
  );
}

// ── Leader card (one strategy / leader to follow) ────────────────────────────

function LeaderCard({
  leader, onCopy, copying, subscribed,
}: { leader: HlLeader; onCopy: (l: HlLeader) => void; copying: boolean; subscribed: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "linear-gradient(145deg, rgba(22,16,8,0.98), rgba(14,10,4,0.99))",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <code className="text-[12px] font-mono font-bold text-foreground/85 truncate">{leader.label || shortAddr(leader.address)}</code>
          {leader.isHft && <Badge className="text-[8px] px-1 py-0 border-0 bg-red-500/20 text-red-300 no-default-hover-elevate no-default-active-elevate">HFT</Badge>}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{shortAddr(leader.address)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mt-2.5">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.score")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtScore(leader.score)}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.medHold")}</div><div className="text-[12px] font-bold tabular-nums">{fmtHold(leader.medianHoldingS)}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.style")}</div><div className="text-[12px] font-bold">{leader.isHft ? t("hl.styleHft") : t("hl.styleSwing")}</div></div>
      </div>
      <button
        onClick={() => onCopy(leader)}
        disabled={copying || subscribed}
        className={cn(
          "w-full mt-2.5 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold transition-all active:scale-[0.98] disabled:opacity-60",
          subscribed
            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
            : "bg-gradient-to-r from-amber-500 to-yellow-600 text-black border border-amber-500/50",
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        {subscribed ? t("hl.copying") : copying ? t("hl.starting") : t("hl.copyNow")}
      </button>
    </div>
  );
}

// ── 策略 tab — leaders grouped into expandable risk-tier categories ──────────

function StrategyPacksTab({
  network, userId, subscribedLeaders,
}: { network: HlNetwork; userId?: string; subscribedLeaders: Set<string> }) {
  const { t } = useTranslation();
  const leadersQ = useHlLeaders(network);
  const { copy, pendingFor } = useHlCopy(userId, network);
  const [open, setOpen] = useState<Record<string, boolean>>({ conservative: true, steady: true });

  const grouped = useMemo(() => groupByTier(leadersQ.data?.leaders ?? []), [leadersQ.data]);

  if (leadersQ.isLoading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }
  const total = (leadersQ.data?.leaders ?? []).length;
  if (total === 0) {
    return <HlEmpty icon={Users} title={t("hl.noLeaders")} desc={t("hl.noLeadersDesc")} />;
  }

  return (
    <div className="space-y-2.5">
      {HL_TIERS.map((tier) => {
        const list = grouped[tier];
        const meta = TIER_META[tier];
        const Icon = meta.icon;
        const isOpen = open[tier] ?? false;
        return (
          <PremiumCard key={tier} className="overflow-hidden">
            <button
              onClick={() => setOpen((s) => ({ ...s, [tier]: !isOpen }))}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
            >
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}35` }}>
                <Icon className="h-4 w-4" style={{ color: meta.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-foreground/90">{t(meta.labelKey)}</span>
                  <Badge className="text-[9px] px-1.5 py-0 border-0 no-default-hover-elevate no-default-active-elevate" style={{ background: `${meta.color}1f`, color: meta.color }}>{list.length}</Badge>
                </div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{t(meta.descKey)}</div>
              </div>
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>
            {isOpen && (
              <div className="px-2.5 pb-2.5 pt-0.5 space-y-2 border-t border-border/30">
                {list.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground/60 text-center py-4">{t("hl.tierEmpty")}</p>
                ) : (
                  list.map((l) => (
                    <LeaderCard
                      key={l.address}
                      leader={l}
                      onCopy={copy}
                      copying={pendingFor?.toLowerCase() === l.address.toLowerCase()}
                      subscribed={subscribedLeaders.has(l.address.toLowerCase())}
                    />
                  ))
                )}
              </div>
            )}
          </PremiumCard>
        );
      })}
    </div>
  );
}

// ── 数据源 tab — live leader signal feed ─────────────────────────────────────

function SignalRow({ s }: { s: HlSignal }) {
  const { t } = useTranslation();
  const long = s.side === "LONG";
  return (
    <PremiumCard className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
            {long ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {s.side}
          </span>
          <span className="text-[13px] font-bold text-foreground/90">{s.coin}</span>
          {s.isClose && <Badge className="text-[8px] px-1 py-0 border-0 bg-white/[0.06] text-foreground/50 no-default-hover-elevate no-default-active-elevate">{t("hl.close")}</Badge>}
        </div>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtTimeAgo(s.happenedAt, t)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mt-2 text-center">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.price")}</div><div className="text-[12px] font-bold tabular-nums">{s.px > 0 ? s.px.toLocaleString() : "—"}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.notional")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtUsd(s.notionalUsd)}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.leader")}</div><div className="text-[11px] font-mono font-bold truncate">{shortAddr(s.leaderAddress)}</div></div>
      </div>
    </PremiumCard>
  );
}

function DataSourceTab({ network }: { network: HlNetwork }) {
  const { t } = useTranslation();
  const sigQ = useHlSignals(network, { limit: 60 });
  const signals = sigQ.data?.signals ?? [];

  if (sigQ.isLoading) {
    return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }
  if (signals.length === 0) {
    return <HlEmpty icon={Activity} title={t("hl.noSignals")} desc={t("hl.noSignalsDesc")} />;
  }
  return <div className="space-y-2">{signals.map((s) => <SignalRow key={s.id} s={s} />)}</div>;
}

// ── 持仓 / 平仓 / 历史 tab ───────────────────────────────────────────────────

function PositionRow({ p }: { p: HlPosition }) {
  const { t } = useTranslation();
  const long = p.side === "LONG";
  return (
    <PremiumCard className="p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-foreground/90">{p.coin}</span>
          <span className={cn("inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
            {p.side}
          </span>
          {p.leverage != null && <Badge className="text-[9px] px-1 py-0 border-0 bg-amber-500/15 text-amber-300 no-default-hover-elevate no-default-active-elevate">{p.leverage}x</Badge>}
        </div>
        <span className={cn("text-[12px] font-bold tabular-nums", p.upnl >= 0 ? "text-emerald-400" : "text-red-400")}>{fmtUsd(p.upnl)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.size")}</div><div className="text-[12px] font-bold tabular-nums">{Math.abs(p.size).toLocaleString()}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.entry")}</div><div className="text-[12px] font-bold tabular-nums">{p.entryPx != null ? p.entryPx.toLocaleString() : "—"}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.value")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtUsd(p.positionValue)}</div></div>
      </div>
    </PremiumCard>
  );
}

function HistoryRow({ s }: { s: HlSignal }) {
  const { t } = useTranslation();
  const long = s.side === "LONG";
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>{s.side}</span>
        <span className="text-[12px] font-bold text-foreground/85">{s.coin}</span>
        <Badge className="text-[8px] px-1 py-0 border-0 bg-white/[0.06] text-foreground/50 no-default-hover-elevate no-default-active-elevate">{s.isClose ? t("hl.close") : t("hl.open")}</Badge>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[11px] tabular-nums num-gold">{fmtUsd(s.notionalUsd)}</span>
        <span className="text-[10px] text-muted-foreground/60">{fmtTimeAgo(s.happenedAt, t)}</span>
      </div>
    </div>
  );
}

function MyPositionsTab({ network }: { network: HlNetwork }) {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const acctQ = useHlAccount(wallet, network);
  // History = recent close fills across leaders on this network (the engine
  // doesn't expose a per-follower fill history on the Bearer plane, so we use
  // the leader signal close-feed as the network activity record).
  const sigQ = useHlSignals(network, { limit: 40 });

  if (!wallet) {
    return <HlEmpty icon={Wallet} title={t("hl.connectTitle")} desc={t("hl.connectDesc")} />;
  }

  const positions = acctQ.data?.positions ?? [];
  const history = (sigQ.data?.signals ?? []).filter((s) => s.isClose);

  return (
    <Tabs defaultValue="open" className="w-full">
      <TabsList className="w-full grid grid-cols-2 mb-3">
        <TabsTrigger value="open" className="text-xs">{t("hl.subTabOpen")}</TabsTrigger>
        <TabsTrigger value="history" className="text-xs">{t("hl.subTabHistory")}</TabsTrigger>
      </TabsList>

      <TabsContent value="open" className="space-y-2 mt-0">
        {acctQ.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : acctQ.isError ? (
          <HlEmpty icon={Layers} title={t("hl.acctError")} desc={t("hl.acctErrorDesc")} />
        ) : positions.length === 0 ? (
          <HlEmpty icon={Layers} title={t("hl.noPositions")} desc={t("hl.noPositionsDesc")} />
        ) : (
          positions.map((p, i) => <PositionRow key={`${p.coin}-${i}`} p={p} />)
        )}
      </TabsContent>

      <TabsContent value="history" className="space-y-1.5 mt-0">
        {sigQ.isLoading ? (
          <div className="space-y-1.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : history.length === 0 ? (
          <HlEmpty icon={HistoryIcon} title={t("hl.noHistory")} desc={t("hl.noHistoryDesc")} />
        ) : (
          history.map((s) => <HistoryRow key={s.id} s={s} />)
        )}
      </TabsContent>
    </Tabs>
  );
}

// ── Active subscriptions strip ───────────────────────────────────────────────

function ActiveSubs({ userId }: { userId?: string }) {
  const { t } = useTranslation();
  const subsQ = useHlSubs(userId);
  const subs = (subsQ.data?.subscriptions ?? []).filter((s: any) => s.status !== "stopped");
  if (!userId || subsQ.isLoading || subs.length === 0) return null;
  return (
    <PremiumCard className="p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Crown className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-[11px] uppercase tracking-wider text-foreground/50 font-semibold">{t("hl.activeFollows")}</span>
        <Badge className="text-[9px] px-1.5 py-0 border-0 bg-amber-500/15 text-amber-300 no-default-hover-elevate no-default-active-elevate ml-auto">{subs.length}</Badge>
      </div>
      <div className="space-y-1.5">
        {subs.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
            <code className="font-mono text-foreground/80 truncate">{shortAddr(s.leaderAddress)}</code>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground/70">{(Number(s.ratio) * 100).toFixed(0)}% · {s.maxLeverage}x</span>
              <Badge className="text-[9px] px-1.5 py-0 border-0 bg-emerald-500/15 text-emerald-300 no-default-hover-elevate no-default-active-elevate">{s.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </PremiumCard>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

type HlTab = "packs" | "data" | "positions";

/**
 * HlCopySection — drop-in body for the Strategy page's "strategies" tab.
 * Renders the network toggle, 开户/enable strip, account stats, active follows,
 * and the 策略 / 数据源 / 持仓 inner tabs. No page chrome (the Strategy page
 * already supplies the header + outer tabbar).
 */
export function HlCopySection() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const [network, setNetwork] = useState<HlNetwork>("mainnet");
  const [tab, setTab] = useState<HlTab>("packs");

  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;

  const acctQ = useHlAccount(wallet, network);
  const subsQ = useHlSubs(userId);

  const subscribedLeaders = useMemo(() => {
    const set = new Set<string>();
    for (const s of subsQ.data?.subscriptions ?? []) {
      if ((s as any).status !== "stopped") set.add(String((s as any).leaderAddress).toLowerCase());
    }
    return set;
  }, [subsQ.data]);

  const acct = acctQ.data;
  const openPnl = acct?.unrealizedPnl ?? 0;

  return (
    <div className="space-y-4" style={{ animation: "fadeSlideIn 0.4s ease-out 0.1s both" }}>
      {/* Intro line — frames the section as HL one-click-follow strategies */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            {t("hl.sectionTitle")}
          </h2>
          <NetworkToggle value={network} onChange={setNetwork} />
        </div>
        <p className="mt-1 text-[12px] text-foreground/55 leading-relaxed">{t("hl.subtitle")}</p>
      </div>

      {/* 开户 / enable strip — reflects the real engine-user onboarding state */}
      <HlAccountStrip
        wallet={wallet}
        userLoading={!!wallet && userQ.isLoading}
        userError={!!wallet && userQ.isError}
        userId={userId}
        onRetryUser={() => userQ.refetch()}
        followCount={subscribedLeaders.size}
      />

      {/* Account stat strip — real HL account state for the connected wallet */}
      {wallet && (
        acctQ.isLoading ? (
          <div className="grid grid-cols-4 gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            <StatTile label={t("hl.accountValue")} value={fmtUsd(acct?.accountValue ?? 0)} />
            <StatTile label={t("hl.openPositions")} value={String(acct?.positions.length ?? 0)} />
            <StatTile label={t("hl.unrealized")} value={fmtUsd(openPnl)} accent={openPnl >= 0 ? "#4ade80" : "#f87171"} />
            <StatTile label={t("hl.follows")} value={String(subscribedLeaders.size)} accent="#60a5fa" />
          </div>
        )
      )}

      {/* 充值 / 提现 —— 账户已开通(userId 解析出来)时显示;地址 = 引擎托管 EOA。
          未开通则上方 HlAccountStrip 显示「开通账户」,开通后地址即出现(修"充值地址生成不出来")。 */}
      {userId && (
        <HlFunding
          userId={userId}
          network={network}
          depositAddress={(userQ.data as { engineEoaAddress?: string } | undefined)?.engineEoaAddress ?? ""}
          withdrawable={acct?.withdrawable ?? 0}
          connectedWallet={wallet ?? ""}
        />
      )}

      <ActiveSubs userId={userId} />

      {/* Inner tabs: 策略 / 数据源 / 持仓 */}
      <div className="flex gap-1.5 rounded-xl border border-border/55 bg-card/60 p-1 surface-3d">
        {([
          { id: "packs", labelKey: "hl.tabStrategies", icon: Users },
          { id: "data", labelKey: "hl.tabData", icon: Activity },
          { id: "positions", labelKey: "hl.tabPositions", icon: Layers },
        ] as const).map((x) => {
          const Icon = x.icon;
          const active = tab === x.id;
          return (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={cn(
                "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-[12px] font-bold tracking-wide transition-all",
                active
                  ? "bg-gradient-to-br from-amber-500/20 via-amber-600/15 to-amber-700/10 ring-1 ring-amber-500/35 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/80",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span className="truncate">{t(x.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
        {tab === "packs" && <StrategyPacksTab network={network} userId={userId} subscribedLeaders={subscribedLeaders} />}
        {tab === "data" && <DataSourceTab network={network} />}
        {tab === "positions" && <MyPositionsTab network={network} />}
      </div>
    </div>
  );
}

export default HlCopySection;
