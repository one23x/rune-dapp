/**
 * Strategy copy-trading — Signal list (信号数据列表), at /copy-trading/signals.
 * Tabs: leader-consensus signals (useLeaderSignals) + hot Polymarket markets
 * (useHotMarkets) with their fusion direction / score. Read-only, public feeds.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useLeaderSignals, useHotMarkets } from "@app/lib/engine-hooks";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { SectionEmpty, SectionError, asArray, asNumber } from "@app/components/copy-trading/shared";

interface NormSignal {
  id: string;
  title: string;
  direction: string;
  score: number;
}

function direction(raw: any): string {
  const d = String(raw?.direction ?? raw?.side ?? raw?.outcome ?? raw?.vote ?? raw?.signal ?? "").toUpperCase();
  if (d.includes("BULL") || d === "BUY" || d === "YES" || d === "UP" || d === "LONG") return "UP";
  if (d.includes("BEAR") || d === "SELL" || d === "NO" || d === "DOWN" || d === "SHORT") return "DOWN";
  return "NEUTRAL";
}

function score(raw: any): number {
  const s = raw?.score ?? raw?.confidence ?? raw?.weight ?? raw?.consensus ?? raw?.strength;
  const n = asNumber(s);
  return n > 1 ? Math.round(n) : Math.round(n * 100);
}

function DirBadge({ dir }: { dir: string }) {
  const cls = dir === "UP" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
    : dir === "DOWN" ? "bg-red-500/15 text-red-400 border-red-500/25"
    : "bg-white/[0.05] text-foreground/45 border-white/10";
  const Icon = dir === "UP" ? TrendingUp : dir === "DOWN" ? TrendingDown : Minus;
  return (
    <Badge className={`text-[10px] no-default-hover-elevate no-default-active-elevate border ${cls}`}>
      <Icon className="h-2.5 w-2.5 mr-0.5" /> {dir}
    </Badge>
  );
}

function SignalRow({ s }: { s: NormSignal }) {
  const { t } = useTranslation();
  return (
    <div className="premium-card rounded-xl p-3 flex items-center justify-between gap-3">
      <p className="text-[13px] font-medium text-foreground/85 truncate flex-1 min-w-0">{s.title}</p>
      <div className="flex items-center gap-2 shrink-0">
        {s.score > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {t("copyTrading.signalScore")} <b className="text-foreground/80">{s.score}</b>
          </span>
        )}
        <DirBadge dir={s.direction} />
      </div>
    </div>
  );
}

function SignalList({ rows, loading, error, retry, emptyKey, emptyIcon }: {
  rows: NormSignal[]; loading: boolean; error: boolean; retry: () => void; emptyKey: string; emptyIcon: typeof Activity;
}) {
  const { t } = useTranslation();
  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;
  if (error) return <SectionError onRetry={retry} />;
  if (rows.length === 0) return <SectionEmpty icon={emptyIcon} title={t(emptyKey)} />;
  return <div className="space-y-2">{rows.map((s) => <SignalRow key={s.id} s={s} />)}</div>;
}

export default function CopyTradingSignalsPage() {
  const { t } = useTranslation();
  const leadersQ = useLeaderSignals();
  const hotQ = useHotMarkets();

  const leaderRows = useMemo<NormSignal[]>(() => asArray(leadersQ.data).map((r: any, i: number) => ({
    id: String(r?.id ?? r?.marketId ?? r?.market ?? i),
    title: String(r?.question ?? r?.market ?? r?.title ?? r?.marketId ?? r?.symbol ?? "—"),
    direction: direction(r),
    score: score(r),
  })), [leadersQ.data]);

  const hotRows = useMemo<NormSignal[]>(() => asArray(hotQ.data).map((r: any, i: number) => ({
    id: String(r?.id ?? r?.marketId ?? r?.slug ?? i),
    title: String(r?.question ?? r?.title ?? r?.market ?? r?.marketId ?? "—"),
    direction: direction(r),
    score: score(r),
  })), [hotQ.data]);

  return (
    <CopyTradingLayout title={t("copyTrading.signalsTitle")}>
      <Tabs defaultValue="leaders" className="w-full">
        <TabsList className="w-full grid grid-cols-2 mb-3">
          <TabsTrigger value="leaders" className="text-xs gap-1"><Activity className="h-3.5 w-3.5" />{t("copyTrading.signalsLeaders")}</TabsTrigger>
          <TabsTrigger value="hot" className="text-xs gap-1"><Flame className="h-3.5 w-3.5" />{t("copyTrading.signalsHot")}</TabsTrigger>
        </TabsList>
        <TabsContent value="leaders" className="mt-0">
          <SignalList rows={leaderRows} loading={leadersQ.isLoading} error={leadersQ.isError}
            retry={() => leadersQ.refetch()} emptyKey="copyTrading.noSignals" emptyIcon={Activity} />
        </TabsContent>
        <TabsContent value="hot" className="mt-0">
          <SignalList rows={hotRows} loading={hotQ.isLoading} error={hotQ.isError}
            retry={() => hotQ.refetch()} emptyKey="copyTrading.noHotMarkets" emptyIcon={Flame} />
        </TabsContent>
      </Tabs>
    </CopyTradingLayout>
  );
}
