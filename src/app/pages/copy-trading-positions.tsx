/**
 * Strategy copy-trading — Positions (持仓), at /copy-trading/positions.
 * Live open orders / positions from useOpenOrders, with useOrders as a
 * supplement for any open-state rows the CLOB feed omits.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";
import { useEngineUser, useOpenOrders, useOrders } from "@app/lib/engine-hooks";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import {
  CopyGate, SectionEmpty, SectionError, asArray, normalizeOrder, isClosed, fmtUsd, type NormOrder,
} from "@app/components/copy-trading/shared";

export function OrderRow({ o }: { o: NormOrder }) {
  const { t } = useTranslation();
  const buy = o.side === "BUY" || o.side === "YES" || o.side === "LONG";
  return (
    <div className="premium-card rounded-xl p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[13px] font-medium text-foreground/85 leading-snug line-clamp-2 flex-1 min-w-0">{o.market}</p>
        {o.side && (
          <Badge className={`text-[10px] shrink-0 no-default-hover-elevate no-default-active-elevate border ${buy ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-red-500/15 text-red-400 border-red-500/25"}`}>
            {o.side}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label={t("copyTrading.price")} value={o.price > 0 ? o.price.toFixed(3) : "—"} />
        <Stat label={t("copyTrading.size")} value={o.size > 0 ? o.size.toLocaleString() : "—"} />
        <Stat label={t("copyTrading.notional")} value={o.notional > 0 ? fmtUsd(o.notional) : "—"} />
        <Stat label={t("copyTrading.status")} value={o.status || "—"} />
      </div>
      {o.pnl != null && (
        <div className="mt-2 pt-2 border-t border-border/30 flex justify-between text-[12px]">
          <span className="text-muted-foreground">{t("copyTrading.statPnl")}</span>
          <span className={`font-bold tabular-nums ${o.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtUsd(o.pnl)}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
      <div className="text-[12px] font-bold tabular-nums truncate">{value}</div>
    </div>
  );
}

function PositionsInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const openQ = useOpenOrders(userId);
  const ordersQ = useOrders(userId);

  const rows = useMemo<NormOrder[]>(() => {
    const open = asArray(openQ.data).map(normalizeOrder);
    const ids = new Set(open.map((o) => o.id));
    // Supplement with any non-closed rows from local order history.
    const extra = asArray(ordersQ.data).map(normalizeOrder).filter((o) => !isClosed(o) && !ids.has(o.id));
    return [...open, ...extra];
  }, [openQ.data, ordersQ.data]);

  if (openQ.isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  if (openQ.isError) return <SectionError onRetry={() => openQ.refetch()} />;
  if (rows.length === 0) return <SectionEmpty icon={Layers} title={t("copyTrading.noPositions")} desc={t("copyTrading.noPositionsDesc")} />;
  return <div className="space-y-2">{rows.map((o) => <OrderRow key={o.id} o={o} />)}</div>;
}

export default function CopyTradingPositionsPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  return (
    <CopyTradingLayout title={t("copyTrading.positionsTitle")}>
      <CopyGate wallet={wallet} userLoading={userQ.isLoading} userId={userId}>
        {(uid) => <PositionsInner userId={uid} />}
      </CopyGate>
    </CopyTradingLayout>
  );
}
