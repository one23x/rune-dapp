/**
 * Strategy copy-trading — Earnings detail (收益详情), at /copy-trading/earnings.
 * Realized / unrealized PnL derived from useOrders + useOpenOrders. A cumulative
 * realized-PnL curve is rendered with recharts (lazy-imported to keep it out of
 * the main bundle). Profit-share is shown from any fee data, else a clear
 * "0 / no data" state (no dedicated revenue-share endpoint on the project plane).
 */

import { lazy, Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, PiggyBank } from "lucide-react";
import { PremiumCard } from "@app/components/premium-card";
import { useEngineUser, useOrders, useOpenOrders } from "@app/lib/engine-hooks";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import {
  CopyGate, SectionEmpty, SectionError, asArray, asNumber, normalizeOrder, isClosed, fmtUsd, type NormOrder,
} from "@app/components/copy-trading/shared";

const EarningsChart = lazy(() => import("@app/components/copy-trading/earnings-chart"));

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <PremiumCard className="p-3.5 text-center">
      <div className="text-lg font-black tabular-nums num-gold" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</div>
    </PremiumCard>
  );
}

function EarningsInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const ordersQ = useOrders(userId);
  const openQ = useOpenOrders(userId);

  const closed = useMemo<NormOrder[]>(
    () => asArray(ordersQ.data).map(normalizeOrder).filter(isClosed).filter((o) => o.pnl != null)
      .sort((a, b) => a.createdAt - b.createdAt),
    [ordersQ.data],
  );
  const open = useMemo<NormOrder[]>(() => asArray(openQ.data).map(normalizeOrder), [openQ.data]);

  const realized = closed.reduce((s, o) => s + (o.pnl ?? 0), 0);
  const unrealized = open.reduce((s, o) => s + (o.pnl ?? 0), 0);

  // Profit-share: derive from any fee field on orders; no revenue-share endpoint
  // exists on the project-key plane, so this falls back to a 0 / no-data state.
  const fees = asArray(ordersQ.data).reduce((s, o: any) => s + asNumber(o?.fee ?? o?.fees ?? o?.profitShare), 0);

  // Cumulative realized PnL series for the chart.
  const series = useMemo(() => {
    let cum = 0;
    return closed.map((o, i) => { cum += o.pnl ?? 0; return { i: i + 1, pnl: Number(cum.toFixed(2)) }; });
  }, [closed]);

  if (ordersQ.isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (ordersQ.isError) return <SectionError onRetry={() => ordersQ.refetch()} />;

  const hasData = closed.length > 0 || open.length > 0;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-foreground/55 leading-relaxed">{t("copyTrading.earningsDesc")}</p>

      <div className="grid grid-cols-3 gap-2">
        <Tile label={t("copyTrading.statRealized")} value={fmtUsd(realized)} accent={realized >= 0 ? "#4ade80" : "#f87171"} />
        <Tile label={t("copyTrading.statUnrealized")} value={fmtUsd(unrealized)} accent={unrealized >= 0 ? "#4ade80" : "#f87171"} />
        <Tile label={t("copyTrading.statPnl")} value={fmtUsd(realized + unrealized)} accent={(realized + unrealized) >= 0 ? "#4ade80" : "#f87171"} />
      </div>

      {!hasData ? (
        <SectionEmpty icon={TrendingUp} title={t("copyTrading.noEarnings")} />
      ) : series.length >= 2 ? (
        <PremiumCard className="p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-foreground/40 font-semibold mb-3">{t("copyTrading.earningsEquityCurve")}</h3>
          <Suspense fallback={<Skeleton className="h-44 w-full rounded-lg" />}>
            <EarningsChart data={series} />
          </Suspense>
        </PremiumCard>
      ) : null}

      {/* Profit-share / fee ledger */}
      <PremiumCard className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-amber-300/80" />
          <h3 className="text-[13px] font-bold text-foreground/85">{t("copyTrading.profitShareTitle")}</h3>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{t("copyTrading.profitShareDesc")}</p>
        {fees > 0 ? (
          <div className="flex justify-between text-[13px] pt-1">
            <span className="text-muted-foreground">{t("copyTrading.profitShareTitle")}</span>
            <span className="font-bold tabular-nums">{fmtUsd(fees)}</span>
          </div>
        ) : (
          <p className="text-[12px] text-foreground/45 pt-1">{t("copyTrading.profitShareNoData")}</p>
        )}
      </PremiumCard>
    </div>
  );
}

export default function CopyTradingEarningsPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  return (
    <CopyTradingLayout title={t("copyTrading.earningsTitle")}>
      <CopyGate wallet={wallet} userLoading={userQ.isLoading} userId={userId}>
        {(uid) => <EarningsInner userId={uid} />}
      </CopyGate>
    </CopyTradingLayout>
  );
}
