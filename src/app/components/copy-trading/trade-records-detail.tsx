/**
 * Trade-records DETAIL — the full HL + PM trade history view, reading the NEW
 * Supabase stats layer (v_trade_records / v_wallet_daily_history /
 * v_wallet_open_positions / v_wallet_today_closed / v_loss_monitor_today) via
 * trading-stats-hooks — NOT the engine API and NOT the raw synced trading_* tables.
 *
 * Reusable, chrome-less: the host page supplies the page shell (profile gives it
 * a back-button header; /copy-trading/stats mounts it as its first-screen body).
 * Tabs: 当前持仓 / 历史记录 / 当日平仓 / 每日历史 / 交易记录(三分类).
 *
 * Scoped to the CONNECTED wallet only — no account-wide views (the loss-monitor
 * is operational/internal and was intentionally removed from this end-user page).
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ListOrdered, CalendarDays, Activity, Layers, History as HistoryIcon, TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumCard } from "@app/components/premium-card";
import { SectionEmpty, SectionError, fmtUsd } from "@app/components/copy-trading/shared";
import {
  useTradeRecords, useWalletDailyHistory, useWalletOpenPositions,
  useWalletTodayClosed, useWalletTodayStats,
  fmtPct, numOrZero, type StatsVenue,
} from "@app/lib/trading-stats-hooks";
import { DailyStatRow } from "@app/components/copy-trading/daily-stat-row";

type Tab = "open" | "history" | "todayClosed" | "daily" | "records";
type VenueFilter = "ALL" | StatsVenue;

const VENUE_LABEL: Record<StatsVenue, string> = {
  polymarket: "Polymarket",
  hl_mainnet: "HL 主网",
  hl_testnet: "HL 测试网",
};
const VENUE_COLOR: Record<StatsVenue, string> = {
  polymarket: "bg-sky-500/10 text-sky-400",
  hl_mainnet: "bg-emerald-500/10 text-emerald-400",
  hl_testnet: "bg-amber-500/10 text-amber-400",
};

function VenueChip({ venue }: { venue: StatsVenue }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${VENUE_COLOR[venue]}`}>
      {VENUE_LABEL[venue]}
    </span>
  );
}

function PnlText({ v, pct, className = "" }: { v: number | null | undefined; pct?: number | null; className?: string }) {
  const n = numOrZero(v);
  const pos = n >= 0;
  return (
    <span className={`font-mono font-bold tabular-nums ${pos ? "text-emerald-400" : "text-red-400"} ${className}`}>
      {pos ? "+" : ""}{fmtUsd(n)}
      {pct != null && <span className="ml-1 text-[10px] opacity-80">({fmtPct(pct)})</span>}
    </span>
  );
}

/* ── Tab 1: 交易记录(polymarket / hl_mainnet / hl_testnet)──────────────── */
function RecordsTab({ wallet, venueScope }: { wallet: string; venueScope?: StatsVenue }) {
  const { t } = useTranslation();
  const [venue, setVenue] = useState<VenueFilter>("ALL");
  const effective = venueScope ?? (venue === "ALL" ? undefined : venue);
  const q = useTradeRecords(wallet, effective);

  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <SectionError onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];

  return (
    <div className="space-y-3">
      {!venueScope && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {(["ALL", "polymarket", "hl_mainnet", "hl_testnet"] as VenueFilter[]).map((v) => (
            <button key={v} onClick={() => setVenue(v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                venue === v ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "text-muted-foreground hover:text-foreground"
              }`}
              style={venue !== v ? { background: "rgba(18,16,12,0.8)", border: "1px solid rgba(34,31,24,1)" } : {}}>
              {v === "ALL" ? t("copyTrading.statsAllVenues", "全部") : VENUE_LABEL[v as StatsVenue]}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <SectionEmpty icon={ListOrdered} title={t("copyTrading.statsNoRecords", "暂无交易记录")} />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.record_id} className="rounded-xl px-3.5 py-3"
              style={{ background: "rgba(18,16,12,0.98)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex justify-between items-center mb-1.5 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {!venueScope && <VenueChip venue={r.venue} />}
                  <span className="text-[13px] font-medium text-foreground/85 truncate">{r.symbol ?? r.market_id ?? "—"}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                  r.side === "BUY" || r.side === "long" ? "bg-emerald-500/10 text-emerald-400"
                  : r.side === "SELL" || r.side === "short" ? "bg-red-500/10 text-red-400"
                  : "bg-white/5 text-muted-foreground"
                }`}>{r.side ?? r.record_type}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                <span className="font-mono">
                  {r.price != null && `$${Number(r.price).toLocaleString()}`}
                  {r.size != null && ` × ${Number(r.size).toLocaleString()}`}
                  {r.notional_usd != null && ` = ${fmtUsd(Number(r.notional_usd))}`}
                </span>
                <span>{r.happened_at ? new Date(r.happened_at).toLocaleString() : "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tab 2: 每日历史 —— 统一用 DailyStatRow(与 HL 区同设计)────────────── */
function DailyTab({ wallet, venueScope }: { wallet: string; venueScope?: StatsVenue }) {
  const { t } = useTranslation();
  const q = useWalletDailyHistory(wallet);
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <SectionError onRetry={() => q.refetch()} />;
  const rows = (q.data ?? []).filter((d) => !venueScope || d.venue === venueScope);
  return rows.length === 0
    ? <SectionEmpty icon={CalendarDays} title={t("copyTrading.statsNoDaily", "暂无每日数据(快照每日生成)")} />
    : <div className="space-y-2">{rows.map((d) => <DailyStatRow key={`${d.venue}-${d.day}`} d={d} venueLabel={venueScope ? undefined : VENUE_LABEL[d.venue]} />)}</div>;
}

/* ── Tab 3: 当前持仓(当日统计 + 持仓明细)──────────────────────────────── */
function OpenTab({ wallet, venueScope }: { wallet: string; venueScope?: StatsVenue }) {
  const { t } = useTranslation();
  const statsQ = useWalletTodayStats(wallet);
  const openQ = useWalletOpenPositions(wallet);

  if (statsQ.isLoading || openQ.isLoading) return <ListSkeleton />;
  if (openQ.isError) return <SectionError onRetry={() => openQ.refetch()} />;

  const stats = (statsQ.data ?? []).filter((d) => !venueScope || d.venue === venueScope);
  const open = (openQ.data ?? []).filter((p) => !venueScope || p.venue === venueScope);

  return (
    <div className="space-y-4">
      {stats.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {stats.map((d) => <DailyStatRow key={`${d.venue}-${d.day}`} d={d} venueLabel={venueScope ? undefined : VENUE_LABEL[d.venue]} />)}
        </div>
      )}

      {open.length === 0 ? (
        <SectionEmpty icon={Layers} title={t("copyTrading.statsNoOpen", "暂无持仓")} />
      ) : (
        <div className="space-y-2">
          {open.map((p, i) => (
            <div key={`${p.venue}-${p.symbol}-${i}`} className="rounded-xl px-3.5 py-2.5 flex justify-between items-center gap-2"
              style={{ background: "rgba(18,16,12,0.98)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-1.5 min-w-0">
                {!venueScope && <VenueChip venue={p.venue} />}
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-foreground/85 truncate">{p.symbol ?? p.market_id}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {Number(p.size ?? 0).toLocaleString()} @ {p.entry_px != null ? `$${Number(p.entry_px).toLocaleString()}` : "—"}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[12px] font-mono text-foreground/85">{fmtUsd(numOrZero(p.position_value_usd))}</div>
                <PnlText v={p.unrealized_pnl_usd} className="text-[10px]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tab 4: 当日平仓 / 成交 ─────────────────────────────────────────────── */
function TodayClosedTab({ wallet, venueScope }: { wallet: string; venueScope?: StatsVenue }) {
  const { t } = useTranslation();
  const q = useWalletTodayClosed(wallet);
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <SectionError onRetry={() => q.refetch()} />;
  const closed = (q.data ?? []).filter((r) => !venueScope || r.venue === venueScope);

  return closed.length === 0 ? (
    <SectionEmpty icon={HistoryIcon} title={t("copyTrading.statsNoClosed", "今日暂无平仓")} />
  ) : (
    <div className="space-y-2">
      {closed.map((r, i) => (
        <div key={i} className="rounded-xl px-3.5 py-2.5 flex justify-between items-center gap-2"
          style={{ background: "rgba(18,16,12,0.98)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-1.5 min-w-0">
            {!venueScope && <VenueChip venue={r.venue} />}
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-foreground/85 truncate">{r.symbol ?? r.market_id}</div>
              <div className="text-[10px] text-muted-foreground">{r.record_type} · {r.happened_at ? new Date(r.happened_at).toLocaleTimeString() : "—"}</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            {r.notional_usd != null && <div className="text-[12px] font-mono text-foreground/85">{fmtUsd(Number(r.notional_usd))}</div>}
            {r.realized_pnl_usd != null && <PnlText v={r.realized_pnl_usd} className="text-[10px]" />}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );
}

/**
 * The reusable detail body — scoped to the CONNECTED wallet only.
 * `wallet` undefined → connect-wallet prompt. Tabs (deduped from the old
 * stats-page tabs + the overview PM 三-Tab):
 *   当前持仓 / 当日平仓 / 历史记录(每日) / 交易记录(三分类).
 */
export function TradeRecordsDetail({ wallet, venueScope }: { wallet?: string; venueScope?: StatsVenue }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("open");

  const tabs = useMemo(() => ([
    { id: "open" as Tab, icon: Layers, label: t("copyTrading.tabOpenPositions", "当前持仓") },
    { id: "todayClosed" as Tab, icon: Activity, label: t("copyTrading.tabTodayClosed", "当日平仓") },
    { id: "history" as Tab, icon: CalendarDays, label: t("copyTrading.tabHistoryRecords", "历史记录") },
    { id: "records" as Tab, icon: ListOrdered, label: t("copyTrading.statsTabRecords", "交易记录") },
  ]), [t]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              tab === id ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "text-muted-foreground hover:text-foreground"
            }`}
            style={tab !== id ? { background: "rgba(18,16,12,0.8)", border: "1px solid rgba(34,31,24,1)" } : {}}>
            <Icon className="h-3 w-3" />{label}
          </button>
        ))}
      </div>

      {!wallet ? (
        <PremiumCard className="p-6 text-center">
          <TrendingUp className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-[12px] text-muted-foreground">{t("copyTrading.statsConnectWallet", "连接钱包查看你的交易数据")}</p>
        </PremiumCard>
      ) : tab === "open" ? (
        <OpenTab wallet={wallet} venueScope={venueScope} />
      ) : tab === "todayClosed" ? (
        <TodayClosedTab wallet={wallet} venueScope={venueScope} />
      ) : tab === "history" ? (
        <DailyTab wallet={wallet} venueScope={venueScope} />
      ) : (
        <RecordsTab wallet={wallet} venueScope={venueScope} />
      )}
    </div>
  );
}

export default TradeRecordsDetail;
