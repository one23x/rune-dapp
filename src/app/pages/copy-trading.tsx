/**
 * Smart Copy-Trading — Overview (主页面总览), at /copy-trading.
 *
 * Gates: wallet not connected → connect prompt; connected but no engine user →
 * 开户 (account-opening) flow; active user → data dashboard + deposit / withdraw.
 * Real engine data only via the react-query hooks; loading=Skeleton,
 * empty=empty state.
 *
 * Visual design ported from the approved `CopyTrading.tsx` canvas mockup:
 * balance card → deposit/withdraw → stats grid → active positions → quick actions.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import {
  Wallet, ArrowDown, ArrowUp, Plus, ChevronRight, Sparkles, Zap, Activity,
  BarChart2, TrendingUp, TrendingDown, Layers, X, Gift, Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@app/hooks/use-toast";
import {
  useEngineUser, usePusdBalance, useOpenOrders, useOrders, useLeaderSignals, useHotMarkets,
  usePolymarketOrderMutations,
} from "@app/lib/engine-hooks";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { PremiumCard } from "@app/components/premium-card";
import {
  OnboardCard, DepositDialog, WithdrawDialog, SectionEmpty,
  asArray, pusdAmount, normalizeOrder, isClosed, fmtUsd,
} from "@app/components/copy-trading/shared";

export default function CopyTradingPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;

  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;

  // Temporary design-preview bypass: visit /copy-trading?preview=1 to skip the
  // wallet/onboarding gates and render the active dashboard (real data hooks
  // stay wired — they just show 0 / empty when there's no userId yet).
  const previewMode =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("preview");

  const balanceQ = usePusdBalance(userId);
  const openQ = useOpenOrders(userId);
  const ordersQ = useOrders(userId);
  const signalsQ = useLeaderSignals();
  const hotQ = useHotMarkets();

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // Close/cancel + redeem REAL Polymarket positions via the engine. `confirmClose`
  // holds the order pending a destructive-close confirmation; `confirmRedeem`
  // gates the account-level redeem of resolved positions back to pUSD.
  const { toast } = useToast();
  const orderMut = usePolymarketOrderMutations(userId);
  const [confirmClose, setConfirmClose] = useState<{ id: string; market: string } | null>(null);
  const [confirmRedeem, setConfirmRedeem] = useState(false);

  const doClose = async () => {
    const target = confirmClose;
    if (!target) return;
    try {
      await orderMut.cancelOrder(target.id);
      toast({ title: t("copyTrading.closeSuccess", "持仓已平仓 / 订单已撤销") });
    } catch (e: any) {
      toast({ title: t("common.error", "出错了"), description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setConfirmClose(null);
    }
  };

  const doRedeem = async () => {
    try {
      await orderMut.redeem();
      toast({ title: t("copyTrading.redeemSuccess", "已赎回已结算持仓 → pUSD") });
    } catch (e: any) {
      toast({ title: t("common.error", "出错了"), description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setConfirmRedeem(false);
    }
  };

  const balance = pusdAmount(balanceQ.data);

  const openOrders = useMemo(() => asArray(openQ.data).map(normalizeOrder), [openQ.data]);
  const allOrders = useMemo(() => asArray(ordersQ.data).map(normalizeOrder), [ordersQ.data]);
  const openNotional = openOrders.reduce((s, o) => s + o.notional, 0);

  const closed = allOrders.filter(isClosed);
  const withPnl = closed.filter((o) => o.pnl != null);
  const wins = withPnl.filter((o) => (o.pnl ?? 0) > 0).length;
  const winRate = withPnl.length > 0 ? (wins / withPnl.length) * 100 : 0;
  const realizedPnl = withPnl.reduce((s, o) => s + (o.pnl ?? 0), 0);

  const signalCount = asArray(signalsQ.data).length + asArray(hotQ.data).length;
  const statsLoading = balanceQ.isLoading || openQ.isLoading || ordersQ.isLoading;

  // ── Gate 1: no wallet ──────────────────────────────────────────────────────
  if (!wallet && !previewMode) {
    return (
      <CopyTradingLayout>
        <PremiumCard className="p-7 text-center space-y-2">
          <Wallet className="h-9 w-9 text-amber-300/70 mx-auto" />
          <h2 className="text-sm font-bold text-foreground">{t("copyTrading.connectTitle")}</h2>
          <p className="text-[12px] text-muted-foreground leading-relaxed max-w-xs mx-auto">{t("copyTrading.connectDesc")}</p>
        </PremiumCard>
      </CopyTradingLayout>
    );
  }

  // ── Gate 2: resolving user ────────────────────────────────────────────────
  if (userQ.isLoading && !previewMode) {
    return (
      <CopyTradingLayout>
        <Skeleton className="h-44 w-full rounded-2xl" />
      </CopyTradingLayout>
    );
  }

  // ── Gate 3: connected but not onboarded → 开户 ────────────────────────────
  if (!userId && !previewMode) {
    return (
      <CopyTradingLayout>
        <OnboardCard wallet={wallet} />
      </CopyTradingLayout>
    );
  }

  // ── Active account → data dashboard (mockup design) ───────────────────────
  return (
    <CopyTradingLayout>
      {/* ── Balance + actions card ── */}
      <div className="relative overflow-hidden rounded-2xl p-5"
        style={{
          background: "linear-gradient(180deg, rgba(245,158,11,0.08) 0%, transparent 70%)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
        <div className="absolute -top-12 right-0 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "rgba(245,158,11,0.08)", filter: "blur(60px)" }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

        <div className="relative z-10">
          {/* Status pill */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] text-muted-foreground">Smart Copy-Trading</span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[11px] font-medium text-emerald-400">{t("copyTrading.accountActive")}</span>
            </div>
          </div>

          {/* Balance */}
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-0.5">{t("copyTrading.statBalance")}</p>
            {statsLoading ? (
              <Skeleton className="h-9 w-40 rounded-lg" />
            ) : (
              <h2 className="text-3xl font-light text-amber-400 tracking-tight tabular-nums">{fmtUsd(balance)}</h2>
            )}
          </div>

          {/* Deposit / Withdraw */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => setDepositOpen(true)}
              className="flex-1 relative overflow-hidden rounded-xl bg-amber-500 text-black font-bold text-sm py-3 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ boxShadow: "0 0 20px rgba(245,158,11,0.35)" }}>
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
              <ArrowDown size={16} strokeWidth={2.5} className="relative z-10" />
              <span className="relative z-10">{t("copyTrading.deposit")}</span>
            </button>
            <button onClick={() => setWithdrawOpen(true)}
              className="flex-1 rounded-xl bg-white/[0.06] border border-white/[0.12] text-foreground font-semibold text-sm py-3 flex items-center justify-center gap-2 hover:bg-white/10 active:scale-[0.98] transition-all">
              <ArrowUp size={16} strokeWidth={2.5} />
              <span>{t("copyTrading.withdraw")}</span>
            </button>
          </div>

          {/* Activate strategy CTA */}
          <Link href="/copy-trading/auto" className="block">
            <button className="w-full relative overflow-hidden rounded-xl py-3 px-4 flex items-center justify-between group active:scale-[0.98] transition-transform"
              style={{ border: "1px solid rgba(245,158,11,0.3)", background: "linear-gradient(90deg, rgba(245,158,11,0.1), rgba(245,158,11,0.04))" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Plus size={16} className="text-amber-400" strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-amber-400 leading-tight">{t("copyTrading.activateEngineTitle", "激活智能跟单引擎")}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t("copyTrading.activateEngineDesc", "选择 L1–L5 策略包 · 自动跟单顶级交易员")}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles size={12} className="text-amber-400/60" />
                <ChevronRight size={16} className="text-amber-400/60 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </Link>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {statsLoading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
            ) : (
              <>
                <StatCell label={t("copyTrading.statOpenPositions")} value={String(openOrders.length)} />
                <StatCell label={t("copyTrading.statNotional")} value={fmtUsd(openNotional)} />
                <StatCell label={t("copyTrading.statWinRate")} value={`${winRate.toFixed(0)}%`} accent={winRate >= 55 ? "#10b981" : undefined} />
                <StatCell label={t("copyTrading.statSignals")} value={String(signalCount)} />
                <StatCell label={t("copyTrading.statPnl")} value={fmtUsd(realizedPnl)} accent={realizedPnl >= 0 ? "#10b981" : "#f87171"} />
                <StatCell label={t("copyTrading.statTrades", "交易次数")} value={String(allOrders.length)} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Active Positions ── */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-foreground">{t("copyTrading.activePositions", "Active Positions")}</h3>
          <div className="flex items-center gap-3">
            {/* Redeem resolved positions → pUSD (account-level engine route). */}
            <button
              onClick={() => setConfirmRedeem(true)}
              disabled={orderMut.isRedeeming || !userId}
              className="text-xs text-amber-400/90 hover:text-amber-300 flex items-center gap-1 disabled:opacity-50 transition-colors"
            >
              {orderMut.isRedeeming ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />}
              {t("copyTrading.redeem", "赎回结算")}
            </button>
            <Link href="/copy-trading/history" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {t("copyTrading.viewAll", "View All")} <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        {openQ.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        ) : openOrders.length === 0 ? (
          <SectionEmpty icon={Layers} title={t("copyTrading.noPositions")} desc={t("copyTrading.noPositionsDesc")} />
        ) : (
          <div className="space-y-3">
            {openOrders.slice(0, 5).map((pos) => {
              const isBuy = pos.side === "BUY" || pos.side === "YES" || pos.side === "LONG";
              const pnlPositive = (pos.pnl ?? 0) >= 0;
              return (
                <div key={pos.id} className="relative overflow-hidden rounded-xl p-4"
                  style={{ background: "#15120d", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.02)" }}>
                  <div className="absolute top-0 left-0 w-1 h-full opacity-50"
                    style={{ background: isBuy ? "#10b981" : "#ef4444" }} />

                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-sm font-medium text-foreground/90 leading-snug pr-4 line-clamp-2">{pos.market}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
                      style={isBuy ? { background: "rgba(16,185,129,0.1)", color: "#10b981" } : { background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                      {pos.side || "—"}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-3 pb-3 border-b border-white/5">
                    <PosCell label={t("copyTrading.colPrice", "Price")} value={pos.price ? fmtUsd(pos.price) : "—"} />
                    <PosCell label={t("copyTrading.colSize", "Size")} value={pos.size ? pos.size.toLocaleString() : "—"} />
                    <PosCell label={t("copyTrading.colNotional", "Notional")} value={fmtUsd(pos.notional)} />
                    <PosCell label={t("copyTrading.colStatus", "Status")}
                      value={
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          {pos.status || "Live"}
                        </span>
                      } />
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{t("copyTrading.unrealizedPnl", "Unrealized PnL")}</span>
                    {pos.pnl == null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <span className="text-sm font-medium flex items-center gap-1" style={{ color: pnlPositive ? "#10b981" : "#ef4444" }}>
                        {pnlPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {fmtUsd(pos.pnl)}
                      </span>
                    )}
                  </div>

                  {/* Close / Cancel — destructive, gated behind a confirm dialog.
                      Cancels the live CLOB order via the engine. */}
                  <button
                    onClick={() => setConfirmClose({ id: pos.id, market: pos.market })}
                    disabled={orderMut.isCancelling}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
                  >
                    {orderMut.isCancelling && orderMut.cancellingId === pos.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <X size={13} />}
                    {t("copyTrading.closePosition", "平仓 / 撤单")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("copyTrading.quickActions", "Quick Actions")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction href="/copy-trading/auto" icon={Zap} iconColor="#f59e0b" bg="rgba(245,158,11,0.1)" label={t("copyTrading.tabAutoCopy")} />
          <QuickAction href="/copy-trading/signals" icon={Activity} iconColor="#818cf8" bg="rgba(99,102,241,0.1)" label={t("copyTrading.tabSignals")} />
          <QuickAction href="/copy-trading/history" icon={BarChart2} iconColor="#10b981" bg="rgba(16,185,129,0.1)" label={t("copyTrading.tabHistory")} />
          <QuickAction href="/strategy" icon={Sparkles} iconColor="#38bdf8" bg="rgba(56,189,248,0.1)" label={t("hl.navTitle", "Hyperliquid")} />
        </div>
      </div>

      {/* ── Funds footer ── */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground rounded-lg px-3 py-2.5"
        style={{ border: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
        <Wallet size={11} className="shrink-0 text-muted-foreground/70" />
        <span>{t("copyTrading.fundsFooter", "充值/提现通过 Polygon 网络 pUSD · 即时到账")}</span>
      </div>

      <DepositDialog open={depositOpen} onOpenChange={setDepositOpen} userId={userId ?? ""} />
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} userId={userId ?? ""} available={balance} />

      {/* Confirm: close / cancel a single live position. */}
      <AlertDialog open={!!confirmClose} onOpenChange={(o) => { if (!o) setConfirmClose(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("copyTrading.confirmCloseTitle", "确认平仓 / 撤单?")}</AlertDialogTitle>
            <AlertDialogDescription className="line-clamp-3">
              {t("copyTrading.confirmCloseDesc", "将撤销该 Polymarket 订单。此操作不可撤销。")}
              {confirmClose ? ` — ${confirmClose.market}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={doClose}
              disabled={orderMut.isCancelling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {orderMut.isCancelling
                ? t("copyTrading.closing", "处理中…")
                : t("copyTrading.confirmCloseAction", "确认平仓")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: redeem all resolved positions → pUSD. */}
      <AlertDialog open={confirmRedeem} onOpenChange={setConfirmRedeem}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("copyTrading.confirmRedeemTitle", "赎回已结算持仓?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("copyTrading.confirmRedeemDesc", "将把所有已结算的 Polymarket 持仓赎回为 pUSD 抵押金。")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={doRedeem}
              disabled={orderMut.isRedeeming}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              {orderMut.isRedeeming
                ? t("copyTrading.redeeming", "赎回中…")
                : t("copyTrading.confirmRedeemAction", "确认赎回")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CopyTradingLayout>
  );
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 truncate">{label}</p>
      <p className="text-sm font-semibold tabular-nums truncate" style={{ color: accent ?? "hsl(var(--foreground))" }}>{value}</p>
    </div>
  );
}

function PosCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] text-muted-foreground uppercase truncate">{label}</p>
      <p className="text-xs text-foreground/80 truncate">{value}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, iconColor, bg, label }: {
  href: string; icon: typeof Zap; iconColor: string; bg: string; label: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="flex items-center gap-3 rounded-xl p-3 hover:bg-white/[0.02] transition-colors"
        style={{ background: "#15120d", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
          <Icon size={16} style={{ color: iconColor }} />
        </div>
        <span className="text-sm font-medium text-foreground/80">{label}</span>
      </div>
    </Link>
  );
}
