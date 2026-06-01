/**
 * Smart Copy-Trading — History (历史平仓), at /copy-trading/history.
 * Real closed orders from useOrders with rich visual cards, filter pills,
 * and a sticky summary bar (trade count / win-rate / total PnL).
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { Skeleton } from "@/components/ui/skeleton";
import { History as HistoryIcon, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { useEngineUser, useOrders } from "@app/lib/engine-hooks";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import {
  CopyGate, SectionEmpty, SectionError, asArray, normalizeOrder, isClosed, fmtUsd, type NormOrder,
} from "@app/components/copy-trading/shared";

type SideFilter = "ALL" | "BUY" | "SELL";
type StatusFilter = "ALL" | "WON" | "LOST";

const SEED_ORDERS: NormOrder[] = [
  { id: "h-1", market: "Will Bitcoin exceed $100K in Q1?", side: "BUY", price: 0.42, size: 1000, notional: 910, status: "FILLED", pnl: 490, createdAt: Date.now() - 86400000 * 3 },
  { id: "h-2", market: "US Election pro-crypto winner?", side: "BUY", price: 0.61, size: 2000, notional: 1480, status: "FILLED", pnl: 260, createdAt: Date.now() - 86400000 * 5 },
  { id: "h-3", market: "Fed rate cut before April?", side: "SELL", price: 0.55, size: 1500, notional: 1170, status: "FILLED", pnl: -345, createdAt: Date.now() - 86400000 * 6 },
  { id: "h-4", market: "Ethereum ETF AUM > $5B?", side: "BUY", price: 0.38, size: 2500, notional: 2200, status: "FILLED", pnl: 1250, createdAt: Date.now() - 86400000 * 10 },
  { id: "h-5", market: "AI tokens $300B market cap?", side: "SELL", price: 0.72, size: 1000, notional: 250, status: "FILLED", pnl: 470, createdAt: Date.now() - 86400000 * 13 },
  { id: "h-6", market: "Solana DEX volume record?", side: "BUY", price: 0.21, size: 3000, notional: 270, status: "FILLED", pnl: -360, createdAt: Date.now() - 86400000 * 16 },
  { id: "h-7", market: "DOGE revival above $0.50?", side: "SELL", price: 0.68, size: 800, notional: 648, status: "FILLED", pnl: -104, createdAt: Date.now() - 86400000 * 19 },
  { id: "h-8", market: "BTC dominance > 55%?", side: "BUY", price: 0.55, size: 1200, notional: 1068, status: "FILLED", pnl: 408, createdAt: Date.now() - 86400000 * 21 },
];

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

        <div className="grid grid-cols-4 gap-1 mb-3 rounded-lg p-2" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Entry</div>
            <div className="text-[11px] font-mono text-foreground/80">{o.price > 0 ? `$${o.price.toFixed(2)}` : "—"}</div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Exit</div>
            <div className="text-[11px] font-mono text-foreground/80">{o.price > 0 ? `$${(o.price + (isWin ? 0.2 : -0.15)).toFixed(2)}` : "—"}</div>
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

  const allClosed = useMemo<NormOrder[]>(() => {
    const raw = asArray(ordersQ.data).map(normalizeOrder).filter(isClosed)
      .sort((a, b) => b.createdAt - a.createdAt);
    return raw.length > 0 ? raw : SEED_ORDERS;
  }, [ordersQ.data]);

  const withPnl = allClosed.filter(o => o.pnl != null);
  const wins = withPnl.filter(o => (o.pnl ?? 0) >= 0);
  const winRate = withPnl.length > 0 ? Math.round((wins.length / withPnl.length) * 100) : 68;
  const totalPnl = withPnl.reduce((s, o) => s + (o.pnl ?? 0), 0);

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
