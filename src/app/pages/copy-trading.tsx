/**
 * Smart Copy-Trading — Overview (主页面总览), at /copy-trading.
 *
 * Gates: wallet not connected → connect prompt; connected but no engine user →
 * 开户 (account-opening) flow; active user → data dashboard + deposit / withdraw.
 * Real engine data only via the react-query hooks; loading=Skeleton,
 * empty=empty state.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Layers, Activity, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumCard } from "@app/components/premium-card";
import {
  useEngineUser, usePusdBalance, useOpenOrders, useOrders, useLeaderSignals, useHotMarkets,
} from "@app/lib/engine-hooks";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import {
  OnboardCard, DepositDialog, WithdrawDialog, SectionEmpty,
  asArray, pusdAmount, normalizeOrder, isClosed, fmtUsd,
} from "@app/components/copy-trading/shared";

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <PremiumCard className="p-3 text-center min-w-0">
      <div className="text-[15px] font-black tabular-nums truncate num-gold" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide truncate">{label}</div>
    </PremiumCard>
  );
}

export default function CopyTradingPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;

  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;

  const balanceQ = usePusdBalance(userId);
  const openQ = useOpenOrders(userId);
  const ordersQ = useOrders(userId);
  const signalsQ = useLeaderSignals();
  const hotQ = useHotMarkets();

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

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

  // ── Gate 1: no wallet ──────────────────────────────────────────────────────
  if (!wallet) {
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
  if (userQ.isLoading) {
    return (
      <CopyTradingLayout>
        <Skeleton className="h-44 w-full rounded-2xl" />
      </CopyTradingLayout>
    );
  }

  // ── Gate 3: connected but not onboarded → 开户 ────────────────────────────
  if (!userId) {
    return (
      <CopyTradingLayout>
        <OnboardCard wallet={wallet} />
      </CopyTradingLayout>
    );
  }

  // ── Active account → data dashboard ───────────────────────────────────────
  return (
    <CopyTradingLayout
      actions={
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" onClick={() => setDepositOpen(true)} className="bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold h-8 px-2.5 text-[12px]">
            <ArrowDownToLine className="h-3.5 w-3.5 mr-1" />{t("copyTrading.deposit")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(true)} className="h-8 px-2.5 text-[12px] border-amber-500/30">
            <ArrowUpFromLine className="h-3.5 w-3.5 mr-1" />{t("copyTrading.withdraw")}
          </Button>
        </div>
      }
    >
      {/* Status pill */}
      <div className="flex items-center gap-2 text-[12px]">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.6)" }} />
        <span className="text-foreground/70 font-medium">{t("copyTrading.accountActive")}</span>
        <span className="text-muted-foreground/60">· {t("copyTrading.accountReady")}</span>
      </div>

      {/* Data dashboard */}
      <div>
        <h2 className="text-[11px] uppercase tracking-wider text-foreground/40 font-semibold mb-2">{t("copyTrading.dataDashboard")}</h2>
        {balanceQ.isLoading || openQ.isLoading || ordersQ.isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <StatTile label={t("copyTrading.statBalance")} value={fmtUsd(balance)} />
            <StatTile label={t("copyTrading.statOpenPositions")} value={String(openOrders.length)} />
            <StatTile label={t("copyTrading.statNotional")} value={fmtUsd(openNotional)} />
            <StatTile label={t("copyTrading.statSignals")} value={String(signalCount)} accent="#60a5fa" />
            <StatTile label={t("copyTrading.statWinRate")} value={`${winRate.toFixed(0)}%`} accent={winRate >= 55 ? "#4ade80" : undefined} />
            <StatTile label={t("copyTrading.statPnl")} value={fmtUsd(realizedPnl)} accent={realizedPnl >= 0 ? "#4ade80" : "#f87171"} />
          </div>
        )}
      </div>

      {/* Quick links into the sub-sections */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <QuickLink href="/copy-trading/auto" icon={TrendingUp} label={t("copyTrading.tabAutoCopy")} />
        <QuickLink href="/copy-trading/signals" icon={Activity} label={t("copyTrading.tabSignals")} />
        <QuickLink href="/copy-trading/positions" icon={Layers} label={t("copyTrading.tabPositions")} />
        <QuickLink href="/hl" icon={Zap} label={t("hl.navTitle")} />
      </div>

      {openOrders.length === 0 && allOrders.length === 0 && (
        <SectionEmpty icon={Layers} title={t("copyTrading.noPositions")} desc={t("copyTrading.noPositionsDesc")} />
      )}

      <DepositDialog open={depositOpen} onOpenChange={setDepositOpen} userId={userId} />
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} userId={userId} available={balance} />
    </CopyTradingLayout>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Layers; label: string }) {
  return (
    <Link href={href} className="block">
      <PremiumCard className="p-3.5 flex flex-col items-center justify-center gap-2 text-center hover:scale-[1.02] transition-transform">
        <div className="flex items-center justify-center rounded-lg h-9 w-9 bg-amber-500/10 border border-amber-500/25">
          <Icon className="h-4 w-4 text-amber-300/90" />
        </div>
        <span className="text-[12px] font-medium text-foreground/75">{label}</span>
      </PremiumCard>
    </Link>
  );
}
