/**
 * Hyperliquid copy-trading section — the heart of the Strategy page.
 *
 * Reskinned to the "CopyTradingStrategy" canvas mockup: a single glass screen
 * with a live account-stats header (Engine Live pill + 3-up grid), a parameter-
 * configuration panel (跟单比例 / 杠杆 / 止盈 / 止损), a multi-select strategy/leader
 * list, and a sticky bottom "开启跟单" action. The visual is the mockup's; every
 * number and row stays bound to the real engine data the section already used.
 *
 * Engine wiring (Bearer read plane, real data only):
 *   - GET /v1/hl/leaders                 → useHlLeaders   (策略 list, by risk tier)
 *   - GET /v1/hl/signals                 → useHlSignals   (数据源 leader feed)
 *   - GET /v1/hl/account                 → useHlAccount   (持仓 / 历史 / 账户)
 *   - GET /v1/users/:id/hl/subscriptions → useHlSubs      (active follows)
 *
 * The sticky CTA fires the existing one-click-follow flow (useHlCopy.copy) for
 * each selected leader with the chosen HlFollowConfig; it degrades gracefully
 * (see useHlCopy) until the engine create route ships.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { useActiveAccount } from "thirdweb/react";
import {
  Users, Activity, Layers, History as HistoryIcon,
  Wallet, TrendingUp, TrendingDown, Zap, Crown, ShieldCheck, CheckCircle2,
  Loader2, Circle, AlertTriangle, RefreshCw, Copy, ArrowDownToLine, ArrowUpFromLine,
  Settings, ChevronRight, Sparkles, ArrowLeft, Pause, Play, X, ExternalLink,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@app/lib/utils";
import { copyText } from "@app/lib/copy";
import { queryClient } from "@app/lib/queryClient";
import { useToast } from "@app/hooks/use-toast";
import { arbitrum } from "@/lib/thirdweb/chains";
import {
  useEngineUser, useHlLeaders, useHlSignals, useHlAccount, useHlSubs, useHlSubMutations,
} from "@app/lib/engine-hooks";
import { hyperliquid } from "@app/lib/engine";
import type { HlLeader, HlNetwork, HlPosition, HlSignal } from "@app/lib/engine";
import { AiDecisionCards } from "./ai-decision-cards";
import {
  NetworkToggle, HlEmpty, useHlCopy, TIER_META, tierOf,
  shortAddr, fmtUsd, fmtHold, fmtScore, fmtTimeAgo,
  HL_DEFAULT_FOLLOW, type HlFollowConfig,
} from "@app/components/hl/shared";
import { useOnboardFlow, DepositBuyPanel } from "@app/components/copy-trading/shared";

// Native USDC on Arbitrum One — the asset the engine custodial EOA accepts for
// HL deposits (mainnet). PayEmbed bridges/buys this directly to that address.
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`;

// On-chain authenticity: the HL read plane exposes no per-fill txHash, so the
// honest "verify on chain" link is the address page on Hyperliquid's own
// explorer — it shows that address's real fills/positions.
function hlExplorerAddress(addr: string, network: HlNetwork): string {
  const base = network === "testnet" ? "https://app.hyperliquid-testnet.xyz" : "https://app.hyperliquid.xyz";
  return `${base}/explorer/address/${addr}`;
}

// ── HL 充值 / 提现(响应式)──────────────────────────────────────────────────
//
// 充值:展示用户的引擎托管 EOA(= HL 签名者/账户),用户从 Arbitrum 把 USDC 充进去;
//       测试网用 HL 测试网水龙头/桥。地址来自 engineUser.engineEoaAddress —— 未开户时为空,
//       由 HlAccountStrip 的「开通账户」先把它创建出来(解决"充值地址生成不出来")。
// 提现:hyperliquid.withdraw → 引擎签 withdraw3 经官方桥把 USDC 提到指定 Arbitrum 地址。
// 弹窗用 w-[calc(100vw-2rem)] max-w-sm + footer 在 <sm 纵向堆叠,适配手机端。
// 跨链 / 买币直充(thirdweb PayEmbed)—— Arbitrum USDC 直接到托管 EOA(=seller)。
// 资金只会进引擎托管地址(HL 下单账户),与 copy-trading 的 DepositBridge 同构,
// 仅链/资产不同(Arbitrum USDC)。先输金额→下一步→PayEmbed,弹窗内可滚动且自适应宽度。
function HlFunding({
  userId, network, depositAddress, withdrawable,
}: { userId: string; network: HlNetwork; depositAddress: string; withdrawable: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const account = useActiveAccount();
  const [depOpen, setDepOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [confirming, setConfirming] = useState(false);

  const amt = Number(amount);
  const amountValid = amount !== "" && Number.isFinite(amt) && amt > 0 && (withdrawable <= 0 || amt <= withdrawable);
  const destValid = /^0x[a-fA-F0-9]{40}$/.test(dest.trim());

  // Prefill the destination with the connected wallet when the dialog opens —
  // the common case is withdrawing back to your own wallet (still editable).
  useEffect(() => {
    if (wdOpen && !dest && account?.address) setDest(account.address);
  }, [wdOpen, account?.address, dest]);

  const withdraw = useMutation({
    mutationFn: async () => hyperliquid.withdraw(userId, { amountUsd: amt, destination: dest.trim(), network }),
    onSuccess: () => {
      toast({ title: t("hl.withdrawSuccess", "提现已提交"), description: t("hl.withdrawSuccessDesc", "USDC 将经官方桥到达目标 Arbitrum 地址(约几分钟,含 ~$1 桥费)。") });
      queryClient.invalidateQueries({ queryKey: ["engine", "hl", "account"] });
      reset(); setWdOpen(false);
    },
    onError: (e: unknown) => toast({ title: t("common.error", "出错了"), description: String((e as { message?: string })?.message ?? e), variant: "destructive" }),
  });

  function reset() { setAmount(""); setDest(""); setConfirming(false); }
  function handleWdOpenChange(v: boolean) { if (!v) reset(); setWdOpen(v); }

  async function copyAddr() {
    if (!depositAddress) return;
    const ok = await copyText(depositAddress);
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

      {/* 充值 —— 与 copy-trading 共享 DepositBuyPanel(冲动买单)+ 转账地址次路径 */}
      <Dialog open={depOpen} onOpenChange={setDepOpen}>
        <DialogContent className="bg-card border-border w-[calc(100vw-1.5rem)] max-w-md p-4 rounded-2xl max-h-[88dvh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                <ArrowDownToLine className="h-4 w-4 text-black" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[15px] font-bold leading-tight">{t("hl.depositTitle", "充值到 HL 交易账户")}</DialogTitle>
                <DialogDescription className="text-[12px] leading-tight">
                  {network === "testnet"
                    ? t("hl.depositDescTestnet", "测试网:用 Hyperliquid 测试网水龙头/桥把测试 USDC 充到下面这个托管地址。")
                    : t("hl.depositDescMainnet", "主网:从 Arbitrum 把 USDC 充到下面这个托管地址,引擎用它在 HL 下单。")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 mt-1">
            {/* 主路径:用卡 / 跨链一键买入 USDC 直充托管 EOA(仅主网且已有地址) */}
            {network === "mainnet" && depositAddress && (
              <DepositBuyPanel chain={arbitrum} token={USDC_ARBITRUM} seller={depositAddress} assetLabel="USDC" />
            )}

            {/* 次路径:转账到地址 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground/70">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                {network === "testnet" ? t("hl.depositAddressLabel", "充值地址(托管 EOA)") : t("deposit.manualTransfer", "或转账到地址")}
              </div>
              {depositAddress ? (
                <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] uppercase tracking-wide text-amber-300/70 mb-1">ARBITRUM · USDC</div>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono text-foreground/80 break-all flex-1 min-w-0" data-testid="text-hl-deposit-address">{depositAddress}</code>
                    <button onClick={copyAddr} aria-label={t("common.copy", "复制")} className="shrink-0 h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors" data-testid="button-hl-copy-address">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground text-center py-3">{t("hl.addressNeedOnboard", "暂无地址 —— 请先开通账户")}</p>
              )}
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                {t("hl.depositNote", "仅支持 USDC(Arbitrum)。到账后即可在金库一键跟单。提现请用本页「提现」。")}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 提现 —— 镜像 copy-trading 两步确认(填写 → 复核 → 提交);目标地址默认连接钱包。 */}
      <Dialog open={wdOpen} onOpenChange={handleWdOpenChange}>
        <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shrink-0">
                <ArrowUpFromLine className="h-4 w-4 text-black" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold">{t("hl.withdrawTitle", "从 HL 提现")}</DialogTitle>
                <DialogDescription className="text-[12px]">
                  {t("hl.withdrawDesc", "经 Hyperliquid 官方桥把 USDC 提到指定 Arbitrum 地址(含 ~$1 桥费,占用保证金的部分需先平仓)。")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <label className="text-[12px] text-muted-foreground">{t("hl.withdrawAmountLabel", "提现金额(USDC)")}</label>
                <span className="text-[11px] text-foreground/50">{t("hl.withdrawable", "可提")}: {fmtUsd(withdrawable)}</span>
              </div>
              <Input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setConfirming(false); }} placeholder="0.00" inputMode="decimal" className="bg-background/50 text-sm" data-testid="input-hl-withdraw-amount" />
              {amount !== "" && !amountValid && (
                <p className="mt-1 text-[11px] text-red-400">{t("hl.withdrawInvalidAmount", "金额无效或超出可提余额")}</p>
              )}
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground mb-1 block">{t("hl.withdrawDestLabel", "目标地址(Arbitrum 0x...)")}</label>
              <Input value={dest} onChange={(e) => { setDest(e.target.value.trim()); setConfirming(false); }} placeholder="0x..." className="bg-background/50 text-[12px] font-mono" data-testid="input-hl-withdraw-dest" />
              {dest !== "" && !destValid && (
                <p className="mt-1 text-[11px] text-red-400">{t("hl.withdrawInvalidDest", "请输入有效的 Arbitrum 地址")}</p>
              )}
            </div>

            {confirming && amountValid && destValid && (
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)" }}>
                <div className="flex items-center gap-1.5 text-[12px] text-amber-300 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t("hl.withdrawReviewTitle", "请确认提现信息")}
                </div>
                <div className="flex justify-between text-[12px]"><span className="text-muted-foreground">{t("hl.withdrawAmountLabel", "提现金额(USDC)")}</span><span className="font-bold tabular-nums">{fmtUsd(amt)}</span></div>
                <div className="text-[11px] font-mono text-foreground/70 break-all">{dest}</div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setWdOpen(false)}>{t("common.cancel", "取消")}</Button>
            {!confirming ? (
              <Button
                size="sm"
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold disabled:opacity-50"
                disabled={!amountValid || !destValid}
                onClick={() => setConfirming(true)}
                data-testid="button-hl-withdraw-next"
              >
                {t("hl.withdrawConfirm", "下一步")}
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold disabled:opacity-50"
                disabled={!amountValid || !destValid || withdraw.isPending}
                onClick={() => withdraw.mutate()}
                data-testid="button-hl-withdraw-confirm"
              >
                {withdraw.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4 mr-1.5" />}
                {withdraw.isPending ? t("hl.withdrawSubmitting", "提交中…") : t("hl.withdrawSubmit", "确认提现")}
              </Button>
            )}
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
//   wallet, no engine user   → explicit 开通 button (reuses useOnboardFlow)
//   engine user present      → enabled banner with live state
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
      <div className="glass-panel p-4">
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
      </div>
    );
  }

  // Resolving the engine user for this wallet → skeleton (don't claim 已开通).
  if (userLoading) {
    return (
      <div className="glass-panel p-3.5">
        <div className="flex items-center gap-3">
          <Skeleton className="shrink-0 h-10 w-10 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-2.5 w-40 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Engine user lookup failed → friendly error + retry (don't silently claim 已开通).
  if (userError) {
    return (
      <div className="glass-panel p-4">
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
      </div>
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
      <div className="glass-panel p-4 space-y-3">
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
      </div>
    );
  }

  // Engine user present → account enabled banner with quick state.
  return (
    <div className="glass-panel p-3.5">
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
            <span>{t("hl.followsCount", "{{count}} 个进行中的跟单", { count: followCount })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Header — icon + title + Engine Live pill (mockup hero) ────────────────────

function SectionHeader({
  network, onNetwork, reduce,
}: { network: HlNetwork; onNetwork: (n: HlNetwork) => void; reduce: boolean }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
              <Activity className="text-amber-400 h-5 w-5" />
            </div>
            {/* Live pulse dot */}
            <span className="absolute -top-1 -right-1 w-3 h-3">
              {!reduce && <span className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: "pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite" }} />}
              <span className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50" />
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-bold tracking-tight text-foreground drop-shadow-sm truncate">
              {t("hl.sectionTitle")}
            </h2>
            <p className="text-[12px] text-foreground/55 leading-snug">{t("hl.configSubtitle", "配置参数 · 选择策略一键跟单")}</p>
          </div>
        </div>
        <span className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-medium text-emerald-300">
          <span className={cn("w-1.5 h-1.5 bg-emerald-400 rounded-full", !reduce && "animate-pulse")} />
          {t("hl.engineLive", "实时引擎")}
        </span>
      </div>
      <div className="mt-3">
        <NetworkToggle value={network} onChange={onNetwork} />
      </div>
    </div>
  );
}

// ── Stats grid — 3-up live account context (账户净值 / 未实现盈亏 / 跟单中) ─────

function StatsGrid({
  wallet, loading, accountValue, unrealizedPnl, followCount, reduce,
}: {
  wallet?: string; loading: boolean; accountValue: number; unrealizedPnl: number; followCount: number; reduce: boolean;
}) {
  const { t } = useTranslation();
  const pnlPos = unrealizedPnl >= 0;
  const cell = (label: string, node: React.ReactNode) => (
    <div className="min-w-0">
      <p className="text-[10px] text-foreground/55 uppercase tracking-wider mb-1 truncate">{label}</p>
      {node}
    </div>
  );
  return (
    <motion.div
      {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring", stiffness: 220, damping: 26 } })}
      className="glass-panel-strong relative p-4 overflow-hidden"
    >
      <div className="shimmer-sweep" />
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="grid grid-cols-3 gap-2 relative z-10">
        {cell(
          t("hl.accountValue", "账户净值"),
          loading
            ? <Skeleton className="h-5 w-16 rounded" />
            : <p className="text-sm font-bold text-foreground tabular-nums truncate">{wallet ? fmtUsd(accountValue) : "—"}</p>,
        )}
        {cell(
          t("hl.unrealized", "未实现盈亏"),
          loading
            ? <Skeleton className="h-5 w-16 rounded" />
            : <p className={cn("text-sm font-bold tabular-nums truncate", pnlPos ? "text-emerald-400" : "text-red-400")}>{wallet ? `${pnlPos ? "+" : ""}${fmtUsd(unrealizedPnl)}` : "—"}</p>,
        )}
        {cell(
          t("hl.copying", "跟单中"),
          <p className="text-sm font-bold text-foreground tabular-nums">{followCount}</p>,
        )}
      </div>
    </motion.div>
  );
}

// ── 参数配置 — pill toggles feeding the real HlFollowConfig ───────────────────

function Pill({
  active, onClick, children, reduce,
}: { active: boolean; onClick: () => void; children: React.ReactNode; reduce: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      {...(reduce ? {} : { whileTap: { scale: 0.94 } })}
      className={cn(
        "flex-1 py-2 text-xs font-medium rounded-lg transition-colors",
        active
          ? "bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]"
          : "text-foreground/60 hover:bg-white/10 hover:text-foreground",
      )}
    >
      {children}
    </motion.button>
  );
}

export function ConfigPanel({
  cfg, setCfg, reduce,
}: { cfg: HlFollowConfig; setCfg: React.Dispatch<React.SetStateAction<HlFollowConfig>>; reduce: boolean }) {
  const { t } = useTranslation();
  const ratios = [0.05, 0.1, 0.25, 0.5];
  const leverages = [2, 3, 5, 10];
  const tps = [20, 50, 100];
  const sls = [10, 20, 50];

  const rightVal = (v: React.ReactNode) => <span className="text-xs font-mono font-bold text-amber-400">{v}</span>;

  return (
    <motion.div
      {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring", stiffness: 220, damping: 26, delay: 0.05 } })}
      className="glass-panel p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-medium text-foreground/90">{t("hl.paramConfig", "参数配置")}</h3>
      </div>

      <div className="space-y-5">
        {/* 跟单比例 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground/70">{t("hl.allocationLabel", "跟单比例(仓位占比)")}</span>
            {rightVal(`${(cfg.notionalRatio * 100).toFixed(0)}%`)}
          </div>
          <div className="flex gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
            {ratios.map((r) => (
              <Pill key={r} active={cfg.notionalRatio === r} reduce={reduce} onClick={() => setCfg((c) => ({ ...c, notionalRatio: r }))}>
                {(r * 100).toFixed(0)}%
              </Pill>
            ))}
          </div>
        </div>

        {/* 杠杆倍数 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground/70">{t("hl.leverageLabel", "杠杆倍数")}</span>
            {rightVal(`${cfg.maxLeverage}x`)}
          </div>
          <div className="flex gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
            {leverages.map((lv) => (
              <Pill key={lv} active={cfg.maxLeverage === lv} reduce={reduce} onClick={() => setCfg((c) => ({ ...c, maxLeverage: lv }))}>
                {lv}x
              </Pill>
            ))}
          </div>
        </div>

        {/* 止盈 / 止损 — toggleable (click active to turn off) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-foreground/70">{t("hl.cfgTp", "止盈 %")}</span>
              {rightVal(cfg.takeProfitPct == null ? t("hl.off", "关") : `${cfg.takeProfitPct}%`)}
            </div>
            <div className="flex gap-1 bg-black/20 border border-white/5 rounded-xl p-1">
              {tps.map((v) => (
                <Pill key={v} active={cfg.takeProfitPct === v} reduce={reduce} onClick={() => setCfg((c) => ({ ...c, takeProfitPct: c.takeProfitPct === v ? null : v }))}>
                  {v}%
                </Pill>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-foreground/70">{t("hl.cfgSl", "止损 %")}</span>
              {rightVal(cfg.stopLossPct == null ? t("hl.off", "关") : `${cfg.stopLossPct}%`)}
            </div>
            <div className="flex gap-1 bg-black/20 border border-white/5 rounded-xl p-1">
              {sls.map((v) => (
                <Pill key={v} active={cfg.stopLossPct === v} reduce={reduce} onClick={() => setCfg((c) => ({ ...c, stopLossPct: c.stopLossPct === v ? null : v }))}>
                  {v}%
                </Pill>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Hero — "进入智能合约交易" (mirrors the trade page hero, LIVE stats) ─────────
//
// Visual twin of the trade page's perp hero, but every number is real:
// 账户净值 / 未实现盈亏 / 跟单中 come from useHlAccount + the live sub count.
function HlHero({
  wallet, loading, accountValue, unrealizedPnl, followCount, reduce,
}: {
  wallet?: string; loading: boolean; accountValue: number; unrealizedPnl: number; followCount: number; reduce: boolean;
}) {
  const { t } = useTranslation();
  const pnlPos = unrealizedPnl >= 0;
  const stat = (label: string, node: React.ReactNode) => (
    <div className="min-w-0">
      <p className="text-[10px] text-foreground/55 uppercase tracking-wider mb-1 truncate">{label}</p>
      {node}
    </div>
  );
  return (
    <motion.div
      {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring", stiffness: 220, damping: 26 } })}
      className="glass-panel-strong relative p-5 overflow-hidden"
    >
      <div className="shimmer-sweep" />
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                <Activity className="text-amber-400 h-5 w-5" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3">
                {!reduce && <span className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: "pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite" }} />}
                <span className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50" />
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-[19px] font-bold tracking-tight text-foreground drop-shadow-sm leading-tight">
                {t("hl.heroTitle", "进入智能合约交易")}
              </h2>
              <p className="text-[12px] text-foreground/55 leading-snug mt-0.5">{t("hl.heroSubtitle", "实时复制顶级合约交易员的链上策略,资金自托管。")}</p>
            </div>
          </div>
          <span className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-medium text-emerald-300">
            <span className={cn("w-1.5 h-1.5 bg-emerald-400 rounded-full", !reduce && "animate-pulse")} />
            {t("hl.engineLive", "实时引擎")}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 rounded-xl bg-black/25 border border-white/10 p-3">
          {stat(
            t("hl.accountValue", "账户净值"),
            loading
              ? <Skeleton className="h-5 w-16 rounded" />
              : <p className="text-sm font-bold text-foreground tabular-nums truncate num-gold">{wallet ? fmtUsd(accountValue) : "—"}</p>,
          )}
          {stat(
            t("hl.unrealized", "未实现盈亏"),
            loading
              ? <Skeleton className="h-5 w-16 rounded" />
              : <p className={cn("text-sm font-bold tabular-nums truncate", pnlPos ? "text-emerald-400" : "text-red-400")}>{wallet ? `${pnlPos ? "+" : ""}${fmtUsd(unrealizedPnl)}` : "—"}</p>,
          )}
          {stat(
            t("hl.copying", "跟单中"),
            <p className="text-sm font-bold text-foreground tabular-nums">{followCount}</p>,
          )}
        </div>

        <p className="mt-3 text-[10px] text-foreground/40 flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-emerald-400/70 shrink-0" />
          {t("hl.heroTrust", "资金托管 · Arbitrum USDC · Hyperliquid 引擎")}
        </p>
      </div>
    </motion.div>
  );
}

// ── 热门金库 — leader card that navigates to a full detail page ───────────────

function VaultCard({ leader, network, subscribed }: { leader: HlLeader; network: HlNetwork; subscribed: boolean }) {
  const { t } = useTranslation();
  const meta = TIER_META[tierOf(leader)];
  const Icon = meta.icon;
  return (
    <Link href={`/strategy/vault/${network}/${leader.address}`} data-testid={`link-vault-${leader.address}`}>
      <div className="glass-panel p-4 transition-all cursor-pointer hover:border-white/20 active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}40`, color: meta.color }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-foreground truncate">{leader.label || shortAddr(leader.address)}</span>
                {leader.isHft && <Badge className="text-[8px] px-1 py-0 border-0 bg-red-500/20 text-red-300 no-default-hover-elevate no-default-active-elevate">HFT</Badge>}
              </div>
              <div className="text-[10px] text-foreground/50 mt-1 flex items-center gap-2">
                <Badge className="text-[8px] px-1.5 py-0 border-0 no-default-hover-elevate no-default-active-elevate" style={{ background: `${meta.color}1f`, color: meta.color }}>{t(meta.labelKey)}</Badge>
                <code className="font-mono truncate">{shortAddr(leader.address)}</code>
              </div>
            </div>
          </div>
          {subscribed ? (
            <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[11px] font-medium">
              <CheckCircle2 className="w-3 h-3" />{t("hl.copying", "跟单中")}
            </span>
          ) : (
            <span className="shrink-0 flex items-center gap-0.5 text-[11px] text-amber-300/90 font-medium">
              {t("hl.viewDetail", "查看详情")}<ChevronRight className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Real leader metrics */}
        <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-white/10">
          <div className="bg-black/20 rounded-lg p-2 border border-white/5">
            <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hl.score", "评分")}</p>
            <p className="text-xs font-bold text-foreground tabular-nums">{fmtScore(leader.score)}</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 border border-white/5">
            <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hl.medHold", "中位持仓")}</p>
            <p className="text-xs font-bold text-foreground tabular-nums">{fmtHold(leader.medianHoldingS)}</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 border border-white/5">
            <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hl.style", "风格")}</p>
            <p className="text-xs font-bold text-foreground">{leader.isHft ? t("hl.styleHft", "高频") : t("hl.styleSwing", "波段")}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function VaultsList({
  leaders, loading, network, subscribedLeaders,
}: {
  leaders: HlLeader[]; loading: boolean; network: HlNetwork; subscribedLeaders: Set<string>;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <h3 className="text-sm font-medium text-foreground/90 truncate">{t("hl.hotVaults", "热门金库")}</h3>
        </div>
        <span className="text-[10px] text-foreground/50 truncate ml-2">{t("hl.hotVaultsDesc", "点击金库查看详情并一键跟单")}</span>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : leaders.length === 0 ? (
        <HlEmpty icon={Users} title={t("hl.noLeaders")} desc={t("hl.noLeadersDesc")} />
      ) : (
        <div className="space-y-3">
          {leaders.map((l) => (
            <VaultCard key={l.address} leader={l} network={network} subscribed={subscribedLeaders.has(l.address.toLowerCase())} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 数据源 tab — live leader signal feed ─────────────────────────────────────

export function SignalRow({ s }: { s: HlSignal }) {
  const { t } = useTranslation();
  const tAgo = t as Parameters<typeof fmtTimeAgo>[1];
  const long = s.side === "LONG";
  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
            {long ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {s.side}
          </span>
          <span className="text-[13px] font-bold text-foreground/90">{s.coin}</span>
          {s.isClose && <Badge className="text-[8px] px-1 py-0 border-0 bg-white/[0.06] text-foreground/50 no-default-hover-elevate no-default-active-elevate">{t("hl.close")}</Badge>}
        </div>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtTimeAgo(s.happenedAt, tAgo)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mt-2 text-center">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.price")}</div><div className="text-[12px] font-bold tabular-nums">{s.px > 0 ? s.px.toLocaleString() : "—"}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.notional")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtUsd(s.notionalUsd)}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.leader")}</div><div className="text-[11px] font-mono font-bold truncate">{shortAddr(s.leaderAddress)}</div></div>
      </div>
    </div>
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

function PositionRow({ p, network, address }: { p: HlPosition; network: HlNetwork; address?: string }) {
  const { t } = useTranslation();
  const long = p.side === "LONG";
  const lev = p.leverage && p.leverage > 0 ? p.leverage : null;
  // ROE% = uPnL / initial margin (positionValue / leverage) — exchange convention.
  const initMargin = lev ? p.positionValue / lev : p.positionValue;
  const roe = initMargin > 0 ? (p.upnl / initMargin) * 100 : 0;
  const pos = p.upnl >= 0;
  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-bold text-foreground/90">{p.coin}</span>
          <span className={cn("inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
            {p.side}
          </span>
          {lev != null && <Badge className="text-[9px] px-1 py-0 border-0 bg-amber-500/15 text-amber-300 no-default-hover-elevate no-default-active-elevate">{lev}x</Badge>}
          {address && (
            <a
              href={hlExplorerAddress(address, network)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("hl.viewOnExplorer", "区块链浏览器查看")}
              title={t("hl.viewOnExplorer", "区块链浏览器查看")}
              className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground/60 hover:text-amber-300 hover:bg-white/5 transition shrink-0"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={cn("text-[12px] font-bold tabular-nums", pos ? "text-emerald-400" : "text-red-400")}>{pos ? "+" : ""}{fmtUsd(p.upnl)}</div>
          <div className={cn("text-[10px] tabular-nums", pos ? "text-emerald-400/70" : "text-red-400/70")}>{pos ? "+" : ""}{roe.toFixed(2)}%</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.size")}</div><div className="text-[12px] font-bold tabular-nums">{Math.abs(p.size).toLocaleString()}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.entry")}</div><div className="text-[12px] font-bold tabular-nums">{p.entryPx != null ? p.entryPx.toLocaleString() : "—"}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.value")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtUsd(p.positionValue)}</div></div>
      </div>
    </div>
  );
}

function HistoryRow({ s, network }: { s: HlSignal; network: HlNetwork }) {
  const { t } = useTranslation();
  const tAgo = t as Parameters<typeof fmtTimeAgo>[1];
  const long = s.side === "LONG";
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>{s.side}</span>
        <span className="text-[12px] font-bold text-foreground/85">{s.coin}</span>
        <Badge className="text-[8px] px-1 py-0 border-0 bg-white/[0.06] text-foreground/50 no-default-hover-elevate no-default-active-elevate">{s.isClose ? t("hl.close") : t("hl.open")}</Badge>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-[11px] tabular-nums num-gold">{fmtUsd(s.notionalUsd)}</span>
        <span className="text-[10px] text-muted-foreground/60">{fmtTimeAgo(s.happenedAt, tAgo)}</span>
        {/* 区块链浏览器:在 HL 浏览器查看该 leader 地址的真实成交 */}
        <a
          href={hlExplorerAddress(s.leaderAddress, network)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={t("hl.viewOnExplorer", "区块链浏览器查看")}
          title={t("hl.viewOnExplorer", "区块链浏览器查看")}
          className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground/60 hover:text-amber-300 hover:bg-white/5 transition"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
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

  const acct = acctQ.data;
  const positions = acct?.positions ?? [];
  const history = (sigQ.data?.signals ?? []).filter((s) => s.isClose);

  return (
    <Tabs defaultValue="open" className="w-full">
      <TabsList className="w-full grid grid-cols-2 mb-3">
        <TabsTrigger value="open" className="text-xs">{t("hl.subTabOpen")}</TabsTrigger>
        <TabsTrigger value="history" className="text-xs">{t("hl.subTabHistory")}</TabsTrigger>
      </TabsList>

      <TabsContent value="open" className="space-y-2 mt-0">
        {acct && (
          <div className="glass-panel p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.accountValue", "账户净值")}</div><div className="text-[13px] font-bold num-gold tabular-nums">{fmtUsd(acct.accountValue)}</div></div>
              <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.unrealized", "未实现盈亏")}</div><div className={cn("text-[13px] font-bold tabular-nums", acct.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>{acct.unrealizedPnl >= 0 ? "+" : ""}{fmtUsd(acct.unrealizedPnl)}</div></div>
              <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.realized", "已实现盈亏")}</div><div className={cn("text-[13px] font-bold tabular-nums", acct.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>{acct.realizedPnl >= 0 ? "+" : ""}{fmtUsd(acct.realizedPnl)}</div></div>
            </div>
          </div>
        )}
        {acctQ.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : acctQ.isError ? (
          <HlEmpty icon={Layers} title={t("hl.acctError")} desc={t("hl.acctErrorDesc")} />
        ) : positions.length === 0 ? (
          <HlEmpty icon={Layers} title={t("hl.noPositions")} desc={t("hl.noPositionsDesc")} />
        ) : (
          positions.map((p, i) => <PositionRow key={`${p.coin}-${i}`} p={p} network={network} address={acct?.address} />)
        )}
      </TabsContent>

      <TabsContent value="history" className="space-y-1.5 mt-0">
        {sigQ.isLoading ? (
          <div className="space-y-1.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : history.length === 0 ? (
          <HlEmpty icon={HistoryIcon} title={t("hl.noHistory")} desc={t("hl.noHistoryDesc")} />
        ) : (
          history.map((s) => <HistoryRow key={s.id} s={s} network={network} />)
        )}
      </TabsContent>
    </Tabs>
  );
}

// ── Active subscriptions strip ───────────────────────────────────────────────

function ActiveSubs({ userId }: { userId?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const subsQ = useHlSubs(userId);
  const mut = useHlSubMutations(userId);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const subs = (subsQ.data?.subscriptions ?? []).filter((s: any) => s.status !== "stopped");
  if (!userId || subsQ.isLoading || subs.length === 0) return null;

  async function run(fn: () => Promise<unknown>, errKey: string) {
    try { await fn(); } catch (e: any) { toast({ title: t(errKey, "操作失败"), description: String(e?.message ?? e), variant: "destructive" }); }
  }

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Crown className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-[11px] uppercase tracking-wider text-foreground/50 font-semibold">{t("hl.activeFollows")}</span>
        <Badge className="text-[9px] px-1.5 py-0 border-0 bg-amber-500/15 text-amber-300 no-default-hover-elevate no-default-active-elevate ml-auto">{subs.length}</Badge>
      </div>
      <div className="space-y-1.5">
        {subs.map((s: any) => {
          const paused = s.status === "paused";
          const confirming = confirmId === s.id;
          return (
            <div key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
              <code className="font-mono text-foreground/80 truncate">{shortAddr(s.leaderAddress)}</code>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-muted-foreground/70">{(Number(s.ratio) * 100).toFixed(0)}% · {s.maxLeverage}x</span>
                <Badge className={cn("text-[9px] px-1.5 py-0 border-0 no-default-hover-elevate no-default-active-elevate", paused ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>{s.status}</Badge>
                {confirming ? (
                  <>
                    <button onClick={() => run(() => mut.cancel(s.id).then(() => setConfirmId(null)), "hl.cancelFollowFailed")} disabled={mut.isPending}
                      className="text-[10px] text-rose-300 hover:underline px-1">{t("common.confirm", "确认")}</button>
                    <button onClick={() => setConfirmId(null)} className="text-[10px] text-muted-foreground/70 hover:underline px-1">{t("common.cancel", "取消")}</button>
                  </>
                ) : (
                  <>
                    <button title={paused ? t("hl.resumeFollow", "恢复") : t("hl.pauseFollow", "暂停")} disabled={mut.isPending}
                      onClick={() => run(() => (paused ? mut.resume(s.id) : mut.pause(s.id)), "hl.pauseResumeFailed")}
                      className="p-1 rounded hover:bg-white/5 text-foreground/60 hover:text-foreground">
                      {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    </button>
                    <button title={t("hl.cancelFollow", "取消跟单")} disabled={mut.isPending}
                      onClick={() => setConfirmId(s.id)}
                      className="p-1 rounded hover:bg-rose-500/10 text-foreground/60 hover:text-rose-300">
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 持仓 / 数据源 secondary section (kept functionality, restyled control) ────

function SecondaryPanels({ network }: { network: HlNetwork }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"positions" | "data">("positions");
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-1">
        {([
          { id: "positions", labelKey: "hl.tabPositions", icon: Layers },
          { id: "data", labelKey: "hl.tabData", icon: Activity },
        ] as const).map((x) => {
          const Icon = x.icon;
          const active = tab === x.id;
          return (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={cn(
                "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[12px] font-bold tracking-wide transition-all",
                active
                  ? "bg-gradient-to-b from-amber-400 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                  : "text-white/55 hover:text-white/90 hover:bg-white/5",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-black" : "text-white/55")} />
              <span className="truncate">{t(x.labelKey)}</span>
            </button>
          );
        })}
      </div>
      <div style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
        {tab === "positions" && <MyPositionsTab network={network} />}
        {tab === "data" && <DataSourceTab network={network} />}
      </div>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

/**
 * HlCopySection — drop-in body for the Strategy page's "strategies" tab.
 * Renders the mockup glass design (header + Engine Live pill, 3-up account
 * stats, 参数配置 panel, 选择策略 multi-select, sticky 开启跟单 CTA) plus the
 * preserved onboarding / funding / active-follows / positions functionality.
 * No page chrome (the Strategy page already supplies the header + outer tabbar).
 */
export function HlCopySection() {
  const { t } = useTranslation();
  const reduce = !!useReducedMotion();
  const account = useActiveAccount();
  const wallet = account?.address;
  const [network, setNetwork] = useState<HlNetwork>("mainnet");

  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;

  const acctQ = useHlAccount(wallet, network);
  const subsQ = useHlSubs(userId);
  const leadersQ = useHlLeaders(network);

  const subscribedLeaders = useMemo(() => {
    const set = new Set<string>();
    for (const s of subsQ.data?.subscriptions ?? []) {
      if ((s as any).status !== "stopped") set.add(String((s as any).leaderAddress).toLowerCase());
    }
    return set;
  }, [subsQ.data]);

  const acct = acctQ.data;
  const leaders = leadersQ.data?.leaders ?? [];

  return (
    <div className="space-y-5" style={{ animation: "fadeSlideIn 0.4s ease-out 0.1s both" }}>
      <NetworkToggle value={network} onChange={setNetwork} />

      {/* Hero 入口 → 智能跟单HL 整页 (数据台/策略包/一键跟单/信号/持仓/历史订单) */}
      <Link href="/strategy/hl" data-testid="link-hl-hub">
        <div className="cursor-pointer active:scale-[0.99] transition-transform">
          <HlHero
            wallet={wallet}
            loading={!!wallet && acctQ.isLoading}
            accountValue={acct?.accountValue ?? 0}
            unrealizedPnl={acct?.unrealizedPnl ?? 0}
            followCount={subscribedLeaders.size}
            reduce={reduce}
          />
        </div>
      </Link>

      {/* 钱包面板 — 开户 / 充值 / 提现 (engine-user onboarding + custodial EOA) */}
      <HlAccountStrip
        wallet={wallet}
        userLoading={!!wallet && userQ.isLoading}
        userError={!!wallet && userQ.isError}
        userId={userId}
        onRetryUser={() => userQ.refetch()}
        followCount={subscribedLeaders.size}
      />

      {userId && (
        <HlFunding
          userId={userId}
          network={network}
          depositAddress={(userQ.data as { engineEoaAddress?: string } | undefined)?.engineEoaAddress ?? ""}
          withdrawable={acct?.withdrawable ?? 0}
        />
      )}

      {/* 热门金库 — 点击金库进入各自的详情页 */}
      <VaultsList
        leaders={leaders}
        loading={leadersQ.isLoading}
        network={network}
        subscribedLeaders={subscribedLeaders}
      />
    </div>
  );
}

// ── 策略包行 — 可选择 + 可展开(更多资料 + AI 分析);跟单由底部唯一主按钮统一触发 ──
//
// Single source of follow truth: rows only toggle *selection*; the one master
// "一键跟单" button at the bottom of the list batch-follows the selection via
// copyMany. Tapping the chevron expands honest detail derived from real leader
// fields (tier / score / median hold / HFT) plus a heuristic AI assessment.

/** Honest, deterministic assessment composed from the leader's REAL fields
 *  (tier, score, median holding, HFT) — not a fabricated win-rate or live LLM. */
function aiAnalysis(leader: HlLeader, t: (k: string, d?: string) => string): string {
  const tier = tierOf(leader);
  const score = leader.score ?? 0;
  const hold = leader.medianHoldingS ?? 0;
  const style = leader.isHft
    ? t("hl.ai.styleHft", "高频短打,换手快、单笔暴露低")
    : hold > 0 && hold < 3600
      ? t("hl.ai.styleScalp", "日内波段,持仓偏短")
      : t("hl.ai.styleSwing", "趋势波段,持仓偏长、回撤更平滑");
  const grade = score >= 85
    ? t("hl.ai.gradeHigh", "评分处于头部区间,信号一致性强")
    : score >= 70
      ? t("hl.ai.gradeMid", "评分稳健,风险收益较均衡")
      : t("hl.ai.gradeLow", "评分中性,建议小比例试跟");
  const tierNote = tier === "conservative"
    ? t("hl.ai.tierConservative", "适合作为底仓稳健跟随")
    : tier === "aggressive"
      ? t("hl.ai.tierAgg", "弹性更高,建议配合止盈止损")
      : tier === "arbitrage"
        ? t("hl.ai.tierArb", "中性套利,波动更低")
        : t("hl.ai.tierSteady", "攻守平衡,适合中等仓位");
  return `${style}。${grade},${tierNote}。`;
}

function PackRow({
  leader, subscribed, selected, onToggleSelect,
}: {
  leader: HlLeader; subscribed: boolean; selected: boolean; onToggleSelect: (l: HlLeader) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const meta = TIER_META[tierOf(leader)];
  const Icon = meta.icon;
  const stat = (label: string, value: React.ReactNode) => (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 min-w-0">
      <div className="text-[9px] uppercase tracking-wide text-foreground/45 truncate">{label}</div>
      <div className="text-[12px] font-bold text-foreground/85 tabular-nums truncate">{value}</div>
    </div>
  );
  return (
    <div className={cn("glass-panel p-3.5 transition", selected && !subscribed && "ring-1 ring-amber-400/60")}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => !subscribed && onToggleSelect(leader)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
          data-testid={`button-pack-select-${leader.address}`}
        >
          <div className={cn(
            "h-5 w-5 rounded-md border grid place-items-center shrink-0 transition",
            subscribed ? "border-emerald-500/40 bg-emerald-500/15" : selected ? "border-amber-400 bg-amber-400" : "border-white/20",
          )}>
            {subscribed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : selected ? <CheckCircle2 className="h-3.5 w-3.5 text-black" /> : null}
          </div>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}40`, color: meta.color }}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-foreground truncate">{leader.label || shortAddr(leader.address)}</span>
              {leader.isHft && <Badge className="text-[8px] px-1 py-0 border-0 bg-red-500/20 text-red-300 no-default-hover-elevate no-default-active-elevate">HFT</Badge>}
              {subscribed && <span className="text-[10px] text-emerald-400 font-semibold shrink-0">{t("hl.copying", "跟单中")}</span>}
            </div>
            <div className="text-[10px] text-foreground/50 mt-1 flex items-center gap-2">
              <Badge className="text-[8px] px-1.5 py-0 border-0 no-default-hover-elevate no-default-active-elevate" style={{ background: `${meta.color}1f`, color: meta.color }}>{t(meta.labelKey)}</Badge>
              <span className="tabular-nums">{t("hl.score", "评分")} {fmtScore(leader.score)}</span>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={t("hl.moreDetail", "更多资料")}
          className="shrink-0 h-9 px-2 inline-flex items-center gap-0.5 rounded-lg text-[11px] text-foreground/55 hover:text-amber-300 hover:bg-white/5 transition"
          data-testid={`button-pack-detail-${leader.address}`}
        >
          {t("hl.detail", "详情")}
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5" style={{ animation: "fadeSlideIn 0.25s ease-out" }}>
          <div className="grid grid-cols-3 gap-2">
            {stat(t("hl.score", "评分"), fmtScore(leader.score))}
            {stat(t("hl.tier", "风险层级"), t(meta.labelKey))}
            {stat(t("hl.medianHold", "中位持仓"), fmtHold(leader.medianHoldingS))}
          </div>
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> {t("hl.aiAnalysis", "AI 分析")}
            </div>
            <p className="text-[11px] text-foreground/70 mt-1 leading-relaxed">{aiAnalysis(leader, t as Parameters<typeof aiAnalysis>[1])}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 智能跟单HL — full hub page reached from the 跟单 tab hero ──────────────────
//
// 数据台 (StatsGrid) · 参数配置 · 策略包 + 一键跟单 (PackRow) · 跟单中 (ActiveSubs)
// · 信号 / 持仓列表 / 历史订单列表 (SecondaryPanels). Honest live engine data only.
export function HlHubPage() {
  const { t } = useTranslation();
  const reduce = !!useReducedMotion();
  const account = useActiveAccount();
  const wallet = account?.address;
  const [network, setNetwork] = useState<HlNetwork>("mainnet");

  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  const acctQ = useHlAccount(wallet, network);
  const subsQ = useHlSubs(userId);
  const leadersQ = useHlLeaders(network);
  const { copyMany, batchPending } = useHlCopy(userId, network);

  const subscribedLeaders = useMemo(() => {
    const set = new Set<string>();
    for (const s of subsQ.data?.subscriptions ?? []) {
      if ((s as any).status !== "stopped") set.add(String((s as any).leaderAddress).toLowerCase());
    }
    return set;
  }, [subsQ.data]);

  const acct = acctQ.data;
  const leaders = leadersQ.data?.leaders ?? [];
  const [cfg, setCfg] = useState<HlFollowConfig>(HL_DEFAULT_FOLLOW);

  // Leader SELECTION for the single batch-follow button. Pre-select the top-3
  // not-yet-followed leaders once they load (sensible default; user can edit).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (leaders.length === 0) return;
    setSelected((prev) => {
      if (prev.size > 0) return prev;
      return new Set(
        leaders
          .filter((l) => !subscribedLeaders.has(l.address.toLowerCase()))
          .slice(0, 3)
          .map((l) => l.address.toLowerCase()),
      );
    });
  }, [leaders, subscribedLeaders]);
  const toggleSelect = (l: HlLeader) =>
    setSelected((s) => {
      const n = new Set(s);
      const k = l.address.toLowerCase();
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  const selectedLeaders = leaders.filter(
    (l) => selected.has(l.address.toLowerCase()) && !subscribedLeaders.has(l.address.toLowerCase()),
  );

  return (
    <div className="min-h-screen pb-28 lg:pb-12">
      {/* Back header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-white/10">
        <div className="px-4 h-14 flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/strategy" data-testid="link-back-strategy-hub">
            <button className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-foreground/80 hover:bg-white/10 active:scale-95 transition">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <h1 className="text-[15px] font-bold text-foreground truncate">{t("hl.hubTitle", "智能跟单 HL")}</h1>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto" style={{ animation: "fadeSlideIn 0.4s ease-out" }}>
        <SectionHeader network={network} onNetwork={setNetwork} reduce={reduce} />

        {/* 数据台 */}
        <StatsGrid
          wallet={wallet}
          loading={!!wallet && acctQ.isLoading}
          accountValue={acct?.accountValue ?? 0}
          unrealizedPnl={acct?.unrealizedPnl ?? 0}
          followCount={subscribedLeaders.size}
          reduce={reduce}
        />

        {/* 参数配置 */}
        <ConfigPanel cfg={cfg} setCfg={setCfg} reduce={reduce} />

        {/* 策略包 — 选择 + 唯一的「一键跟单」主按钮(批量 copyMany) */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-medium text-foreground/90">{t("hl.strategyPacks", "策略包")}</h3>
            </div>
            {leaders.length > 0 && (
              <span className="text-[11px] text-foreground/45 tabular-nums">{t("hl.selectedCount", "已选")} {selectedLeaders.length}/{leaders.length}</span>
            )}
          </div>
          {leadersQ.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          ) : leaders.length === 0 ? (
            <HlEmpty icon={Users} title={t("hl.noLeaders")} desc={t("hl.noLeadersDesc")} />
          ) : (
            <>
              <div className="space-y-3">
                {leaders.map((l) => (
                  <PackRow
                    key={l.address}
                    leader={l}
                    subscribed={subscribedLeaders.has(l.address.toLowerCase())}
                    selected={selected.has(l.address.toLowerCase())}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
              {/* 唯一一键跟单主按钮 — 批量跟随所选策略 */}
              <button
                type="button"
                disabled={selectedLeaders.length === 0 || batchPending}
                onClick={() => copyMany(selectedLeaders, cfg)}
                className={cn(
                  "mt-4 w-full h-12 rounded-2xl inline-flex items-center justify-center gap-2 text-[15px] font-extrabold transition-all",
                  selectedLeaders.length === 0
                    ? "bg-white/5 text-foreground/40 cursor-not-allowed"
                    : "bg-gradient-to-r from-amber-400 to-yellow-600 text-black shadow-[0_0_20px_rgba(245,158,11,0.35)] active:scale-[0.99]",
                )}
                data-testid="button-hl-follow-master"
              >
                {batchPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {t("hl.oneClickFollow", "一键跟单")}{selectedLeaders.length > 0 ? ` (${selectedLeaders.length})` : ""}
              </button>
              <p className="mt-2 text-center text-[11px] text-foreground/45">{t("hl.followHint", "按上方参数配置批量跟随所选策略")}</p>
            </>
          )}
        </div>

        {/* 跟单中 */}
        <ActiveSubs userId={userId} />

        {/* F17 — AI 跟单决策卡(开启 AI 决策后显示每个信号的判断+调参) */}
        <AiDecisionCards userId={userId} />

        {/* 信号 / 持仓列表 / 历史订单列表 */}
        <SecondaryPanels network={network} />
      </div>
    </div>
  );
}

export default HlCopySection;
