/**
 * Strategy copy-trading — History (历史平仓 + 历史), at /copy-trading/history.
 * Closed / filled / all orders from useOrders, filtered by status. Sorted
 * newest-first.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { History as HistoryIcon } from "lucide-react";
import { useEngineUser, useOrders } from "@app/lib/engine-hooks";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { CopyGate, SectionEmpty, SectionError, asArray, normalizeOrder, isClosed, type NormOrder } from "@app/components/copy-trading/shared";
import { OrderRow } from "@app/pages/copy-trading-positions";

function HistoryList({ rows }: { rows: NormOrder[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return <SectionEmpty icon={HistoryIcon} title={t("copyTrading.noHistory")} />;
  return <div className="space-y-2">{rows.map((o) => <OrderRow key={o.id} o={o} />)}</div>;
}

function HistoryInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const ordersQ = useOrders(userId);

  const all = useMemo<NormOrder[]>(
    () => asArray(ordersQ.data).map(normalizeOrder).sort((a, b) => b.createdAt - a.createdAt),
    [ordersQ.data],
  );
  const closed = all.filter(isClosed);
  const filled = all.filter((o) => o.status === "FILLED" || o.status === "MATCHED");

  if (ordersQ.isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  if (ordersQ.isError) return <SectionError onRetry={() => ordersQ.refetch()} />;

  return (
    <Tabs defaultValue="closed" className="w-full">
      <TabsList className="w-full grid grid-cols-3 mb-3">
        <TabsTrigger value="closed" className="text-xs">{t("copyTrading.historyClosed")}</TabsTrigger>
        <TabsTrigger value="filled" className="text-xs">{t("copyTrading.historyFilled")}</TabsTrigger>
        <TabsTrigger value="all" className="text-xs">{t("copyTrading.historyAll")}</TabsTrigger>
      </TabsList>
      <TabsContent value="closed" className="mt-0"><HistoryList rows={closed} /></TabsContent>
      <TabsContent value="filled" className="mt-0"><HistoryList rows={filled} /></TabsContent>
      <TabsContent value="all" className="mt-0"><HistoryList rows={all} /></TabsContent>
    </Tabs>
  );
}

export default function CopyTradingHistoryPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  return (
    <CopyTradingLayout title={t("copyTrading.historyTitle")}>
      <CopyGate wallet={wallet} userLoading={userQ.isLoading} userId={userId}>
        {(uid) => <HistoryInner userId={uid} />}
      </CopyGate>
    </CopyTradingLayout>
  );
}
