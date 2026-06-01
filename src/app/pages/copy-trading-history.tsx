/**
 * Smart Copy-Trading — History (历史平仓), at /copy-trading/history.
 * Real closed orders from useOrders with rich visual cards, filter pills,
 * and a sticky summary bar (trade count / win-rate / total PnL).
 */

import { lazy, Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { Skeleton } from "@/components/ui/skeleton";
import { History as HistoryIcon, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { PremiumCard } from "@app/components/premium-card";
import { useEngineUser, useOrders, useOpenOrders } from "@app/lib/engine-hooks";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import {
  CopyGate, SectionEmpty, SectionError, asArray, normalizeOrder, isClosed, fmtUsd, type NormOrder,
} from "@app/components/copy-trading/shared";

const EarningsChart = lazy(() => import("@app/components/copy-trading/earnings-chart"));

type SideFilter = "ALL" | "BUY" | "SELL";
type StatusFilter = "ALL" | "WON" | "LOST";

function HistoryOrderCard({ o }: { o: NormOrder }) {
  const isWin = (o.pnl ?? 0) >= 0;
  const isBuy = o.side === "BUY" || o.side === "YES" || o.side === "LONG";
  const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

  return (
    <div className="rounded-xl overflow-hidden relative"
      style={{ background: "rgba(18,16,12,0.98)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${
        isWin ? "bg-emerald-500" : "bg-red-500"
      }`} style={{ boxShadow: isWin ? "0 0 8px rgba(16,185,129,0.4)" : "0 0 8px rgba(239,68,68,0.4)" }} />

      <div className="pl-4 pr-3 py-3">
        <div className="flex justify-between items-start mb-3 gap-2">
          <p className="text-[13px] font-medium text-foreground/85 leading-tight line-clamp-2 flex-1">{o.market}</p>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
            isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          }`}>{o.side}</span>
        </div>

        <div className="grid grid-cols-3 gap-1 mb-3 rounded-lg p-2" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Price</div>
            <div className="text-[11px] font-mono text-foreground/80">{o.price > 0 ? `$${o.price.toFixed(2)}` : "—"}</div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Size</div>
            <div className="text-[11px] font-mono text-foreground/80">{o.size > 0 ? o.size.toLocaleString() : "—"}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Value</div>
            <div className="text-[11px] font-mono text-foreground/80">{o.notional > 0 ? fmtUsd(o.notional) : "—"}</div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-white/[0.04]">
          <span className="text-[11px] text-muted-foreground">{dateStr}</span>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1">
              {isWin
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                : <XCircle className="h-3.5 w-3.5 text-red-400" />}
              <span className={`text-[11px] font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                {isWin ? "WON" : "LOST"}
              </span>
            </div>
            {o.pnl != null && (
              <span className={`text-[13px] font-bold font-mono tabular-nums ${o.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {o.pnl >= 0 ? "+" : ""}{fmtUsd(o.pnl)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [sideFilter, setSideFilter] = useState<SideFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const ordersQ = useOrders(userId);
  const openQ = useOpenOrders(userId);

  const allClosed = useMemo<NormOrder[]>(() =>
    asArray(ordersQ.data).map(normalizeOrder).filter(isClosed).sort((a, b) => b.createdAt - a.createdAt),
    [ordersQ.data]);

  const withPnl = allClosed.filter(o => o.pnl != null);
  const wins = withPnl.filter(o => (o.pnl ?? 0) >= 0);
  const winRate = withPnl.length > 0 ? Math.round((wins.length / withPnl.length) * 100) : 0;
  const totalPnl = withPnl.reduce((s, o) => s + (o.pnl ?? 0), 0);

  // Earnings (merged from the old Earnings tab): unrealized PnL from open orders +
  // a cumulative realized-PnL equity curve.
  const unrealized = useMemo(
    () => asArray(openQ.data).map(normalizeOrder).reduce((s, o) => s + (o.pnl ?? 0), 0),
    [openQ.data]);
  const series = useMemo(() => {
    let cum = 0;
    return [...withPnl].sort((a, b) => a.createdAt - b.createdAt)
      .map((o, i) => { cum += o.pnl ?? 0; return { i: i + 1, pnl: Number(cum.toFixed(2)) }; });
  }, [withPnl]);

  const filtered = useMemo(() => {
    return allClosed.filter(o => {
      if (sideFilter !== "ALL") {
        const isBuy = o.side === "BUY" || o.side === "YES" || o.side === "LONG";
        if (sideFilter === "BUY" && !isBuy) return false;
        if (sideFilter === "SELL" && isBuy) return false;
      }
      if (statusFilter !== "ALL") {
        const isWin = (o.pnl ?? 0) >= 0;
        if (statusFilter === "WON" && !isWin) return false;
        if (statusFilter === "LOST" && isWin) return false;
      }
      return true;
    });
  }, [allClosed, sideFilter, statusFilter]);

  if (ordersQ.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 rounded-xl" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  if (ordersQ.isError) return <SectionError onRetry={() => ordersQ.refetch()} />;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="rounded-xl px-4 py-3 flex justify-between items-center"
        style={{ background: "rgba(18,16,12,0.9)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground">{t("copyTrading.historyTrades", "Trades")}</span>
          <span className="text-[14px] font-bold font-mono text-foreground">{allClosed.length}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-muted-foreground">{t("copyTrading.historyWinRate", "Win Rate")}</span>
          <span className="text-[14px] font-bold font-mono text-foreground">{winRate}%</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground">{t("copyTrading.statPnl", "Total PnL")}</span>
          <span className={`text-[14px] font-bold font-mono ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}{fmtUsd(totalPnl)}
          </span>
        </div>
      </div>

      {/* Earnings (realized / unrealized / equity curve) — merged from Earnings tab */}
      <div className="grid grid-cols-2 gap-2">
        <EarnTile label={t("copyTrading.statRealized", "已实现")} value={fmtUsd(totalPnl)} accent={totalPnl >= 0 ? "#4ade80" : "#f87171"} />
        <EarnTile
          label={t("copyTrading.statUnrealized", "浮动盈亏")}
          value={openQ.isLoading ? "…" : openQ.isError ? "—" : fmtUsd(unrealized)}
          accent={openQ.isLoading || openQ.isError ? undefined : unrealized >= 0 ? "#4ade80" : "#f87171"}
        />
      </div>
      {series.length >= 2 && (
        <PremiumCard className="p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-foreground/40 font-semibold mb-3">{t("copyTrading.earningsEquityCurve", "Equity Curve")}</h3>
          <Suspense fallback={<Skeleton className="h-44 w-full rounded-lg" />}>
            <EarningsChart data={series} />
          </Suspense>
        </PremiumCard>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <div className="flex rounded-full p-0.5 shrink-0" style={{ background: "rgba(26,24,19,1)", border: "1px solid rgba(51,47,38,1)" }}>
            {(["ALL", "BUY", "SELL"] as SideFilter[]).map(s => (
              <button key={s} onClick={() => setSideFilter(s)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                  sideFilter === s ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
                style={sideFilter === s ? { background: "rgba(42,38,28,1)" } : {}}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {(["ALL", "WON", "LOST"] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={statusFilter !== s ? { background: "rgba(18,16,12,0.8)", border: "1px solid rgba(34,31,24,1)" } : {}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Order list */}
      {filtered.length === 0 ? (
        <SectionEmpty icon={HistoryIcon} title={t("copyTrading.noHistory", "No history found")} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map(o => <HistoryOrderCard key={o.id} o={o} />)}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="py-6 flex flex-col items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            {t("copyTrading.historyShowing", { count: filtered.length, total: allClosed.length }, `Showing ${filtered.length} of ${allClosed.length} trades`)}
          </span>
          <button className="text-[11px] text-primary flex items-center gap-1">
            {t("copyTrading.loadMore", "Load more")} <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function EarnTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <PremiumCard className="p-3.5 text-center">
      <div className="text-lg font-black tabular-nums num-gold" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</div>
    </PremiumCard>
  );
}

export default function CopyTradingHistoryPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  return (
    <CopyTradingLayout title={t("copyTrading.historyTitle", "Trade History")}>
      <CopyGate wallet={wallet} userLoading={userQ.isLoading} userId={userId}>
        {(uid) => <HistoryInner userId={uid} />}
      </CopyGate>
    </CopyTradingLayout>
  );
}
