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

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { useActiveAccount } from "thirdweb/react";
import {
  Users, Activity, Layers, History as HistoryIcon,
  Wallet, TrendingUp, TrendingDown, Zap, Crown, ShieldCheck, CheckCircle2,
  Loader2, Circle, AlertTriangle, RefreshCw, Copy, ArrowDownToLine, ArrowUpFromLine,
  Settings, Check,
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
import {
  useEngineUser, useHlLeaders, useHlSignals, useHlAccount, useHlSubs,
} from "@app/lib/engine-hooks";
import { hyperliquid } from "@app/lib/engine";
import type { HlLeader, HlNetwork, HlPosition, HlSignal } from "@app/lib/engine";
import {
  NetworkToggle, HlEmpty, useHlCopy, TIER_META, tierOf,
  shortAddr, fmtUsd, fmtHold, fmtScore, fmtTimeAgo,
  HL_DEFAULT_FOLLOW, type HlFollowConfig,
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
  userId, network, depositAddress, withdrawable,
}: { userId: string; network: HlNetwork; depositAddress: string; withdrawable: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [depOpen, setDepOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");

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
          </div>
          <DialogFooter>
            <Button variant="gold" className="w-full" onClick={() => setDepOpen(false)}>{t("common.done", "完成")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 提现:withdraw3 → Arbitrum */}
      <Dialog open={wdOpen} onOpenChange={(v) => { if (!v) { setAmount(""); setDest(""); } setWdOpen(v); }}>
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
              <label className="text-[12px] text-muted-foreground mb-1 block">{t("hl.withdrawDest", "目标地址(Arbitrum 0x...)")}</label>
              <Input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="0x..." className="bg-background/50 text-[12px] font-mono" data-testid="input-hl-withdraw-dest" />
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
            <span>{t("hl.followsCount", { count: followCount })}</span>
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

function ConfigPanel({
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

// ── 选择策略 — multi-select leader card (real HlLeader fields) ────────────────

function StrategyCard({
  leader, selected, subscribed, copying, onToggle, reduce,
}: {
  leader: HlLeader; selected: boolean; subscribed: boolean; copying: boolean;
  onToggle: (l: HlLeader) => void; reduce: boolean;
}) {
  const { t } = useTranslation();
  const meta = TIER_META[tierOf(leader)];
  const Icon = meta.icon;
  const interactive = !subscribed;
  return (
    <motion.div
      {...(reduce || !interactive ? {} : { whileTap: { scale: 0.985 } })}
      onClick={() => interactive && onToggle(leader)}
      className={cn(
        "glass-panel p-4 transition-all",
        interactive && "cursor-pointer",
        subscribed
          ? "border-emerald-500/30 shadow-[0_0_14px_rgba(52,211,153,0.12)]"
          : selected
            ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-[rgba(36,28,14,0.6)]"
            : "hover:border-white/20",
      )}
    >
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
            {copying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}{t("hl.copying", "跟单中")}
          </span>
        ) : (
          <div className={cn(
            "shrink-0 w-5 h-5 rounded-full flex items-center justify-center border transition-colors",
            selected ? "bg-amber-500 border-amber-500 text-black" : "border-white/20 text-transparent",
          )}>
            <Check className="w-3 h-3" strokeWidth={3} />
          </div>
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
    </motion.div>
  );
}

function StrategySelect({
  leaders, loading, selected, subscribedLeaders, pendingFor, onToggle, reduce,
}: {
  leaders: HlLeader[];
  loading: boolean;
  selected: Set<string>;
  subscribedLeaders: Set<string>;
  pendingFor?: string;
  onToggle: (l: HlLeader) => void;
  reduce: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-medium text-foreground/90">{t("hl.selectStrategy", "选择策略")}</h3>
        </div>
        <span className="text-[10px] text-foreground/50 bg-white/10 px-2 py-0.5 rounded border border-white/10">{t("hl.multiSelect", "可多选")}</span>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : leaders.length === 0 ? (
        <HlEmpty icon={Users} title={t("hl.noLeaders")} desc={t("hl.noLeadersDesc")} />
      ) : (
        <div className="space-y-3">
          {leaders.map((l) => {
            const key = l.address.toLowerCase();
            return (
              <StrategyCard
                key={l.address}
                leader={l}
                selected={selected.has(key)}
                subscribed={subscribedLeaders.has(key)}
                copying={pendingFor?.toLowerCase() === key}
                onToggle={onToggle}
                reduce={reduce}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 数据源 tab — live leader signal feed ─────────────────────────────────────

function SignalRow({ s }: { s: HlSignal }) {
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

function PositionRow({ p }: { p: HlPosition }) {
  const { t } = useTranslation();
  const long = p.side === "LONG";
  return (
    <div className="glass-panel p-3">
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
    </div>
  );
}

function HistoryRow({ s }: { s: HlSignal }) {
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
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[11px] tabular-nums num-gold">{fmtUsd(s.notionalUsd)}</span>
        <span className="text-[10px] text-muted-foreground/60">{fmtTimeAgo(s.happenedAt, tAgo)}</span>
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
    <div className="glass-panel p-3">
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
  const { copy, copyMany, pendingFor, batchPending } = useHlCopy(userId, network);

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
  const [selected, setSelected] = useState<Set<string>>(() => new Set<string>());

  const toggle = (l: HlLeader) => {
    const key = l.address.toLowerCase();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectedCount = selected.size;

  async function startCopy() {
    // Only follow leaders that exist on the *current* network (drops any stale
    // cross-network selection), sequentially, then keep any that failed.
    const chosen = leaders.filter((l) => selected.has(l.address.toLowerCase()));
    if (chosen.length === 0) return;
    if (chosen.length === 1) {
      await copy(chosen[0], cfg);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(chosen[0].address.toLowerCase());
        return next;
      });
      return;
    }
    const succeeded = await copyMany(chosen, cfg);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const addr of succeeded) next.delete(addr);
      return next;
    });
  }

  const busy = !!pendingFor || batchPending;
  const showStickyBar = !leadersQ.isLoading && leaders.length > 0;

  return (
    <div className="space-y-5" style={{ animation: "fadeSlideIn 0.4s ease-out 0.1s both" }}>
      <SectionHeader network={network} onNetwork={setNetwork} reduce={reduce} />

      <StatsGrid
        wallet={wallet}
        loading={!!wallet && acctQ.isLoading}
        accountValue={acct?.accountValue ?? 0}
        unrealizedPnl={acct?.unrealizedPnl ?? 0}
        followCount={subscribedLeaders.size}
        reduce={reduce}
      />

      {/* 开户 / enable strip — reflects the real engine-user onboarding state */}
      <HlAccountStrip
        wallet={wallet}
        userLoading={!!wallet && userQ.isLoading}
        userError={!!wallet && userQ.isError}
        userId={userId}
        onRetryUser={() => userQ.refetch()}
        followCount={subscribedLeaders.size}
      />

      {/* 充值 / 提现 —— 账户已开通(userId 解析出来)时显示;地址 = 引擎托管 EOA。 */}
      {userId && (
        <HlFunding
          userId={userId}
          network={network}
          depositAddress={(userQ.data as { engineEoaAddress?: string } | undefined)?.engineEoaAddress ?? ""}
          withdrawable={acct?.withdrawable ?? 0}
        />
      )}

      <ConfigPanel cfg={cfg} setCfg={setCfg} reduce={reduce} />

      <StrategySelect
        leaders={leaders}
        loading={leadersQ.isLoading}
        selected={selected}
        subscribedLeaders={subscribedLeaders}
        pendingFor={pendingFor}
        onToggle={toggle}
        reduce={reduce}
      />

      <ActiveSubs userId={userId} />

      <SecondaryPanels network={network} />

      {/* Sticky 开启跟单 CTA — clears the mobile bottom-nav; reuses one-click follow. */}
      {showStickyBar && (
        <div className="sticky bottom-20 lg:bottom-4 z-30 -mx-4 px-4 pt-6 pb-1 pointer-events-none bg-gradient-to-t from-background via-background/85 to-transparent">
          <motion.button
            type="button"
            disabled={selectedCount === 0 || busy}
            onClick={startCopy}
            {...(reduce ? {} : { whileTap: selectedCount > 0 && !busy ? { scale: 0.98 } : undefined })}
            className={cn(
              "pointer-events-auto w-full relative overflow-hidden rounded-xl font-bold text-sm py-4 flex items-center justify-center gap-2 transition-all",
              selectedCount > 0 && !busy
                ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                : "glass-panel text-foreground/50 cursor-not-allowed border-white/10",
            )}
            data-testid="button-hl-start-copy"
          >
            {selectedCount > 0 && !busy && <span className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />}
            {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : <Zap className="h-4 w-4" strokeWidth={2.5} />}
            <span className="relative">
              {selectedCount > 0
                ? `${t("hl.startCopy", "开启跟单")} · ${t("hl.selectedCount", "已选 {{count}}", { count: selectedCount })}`
                : t("hl.selectAtLeastOne", "请选择至少一个策略")}
            </span>
          </motion.button>
        </div>
      )}
    </div>
  );
}

export default HlCopySection;
