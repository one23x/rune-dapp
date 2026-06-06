/**
 * Smart Copy-Trading — Stats (交易数据), at /copy-trading/stats.
 *
 * Reads the NEW Supabase stats layer (v_trade_records / v_wallet_daily_history /
 * v_wallet_open_positions / v_wallet_today_closed / v_loss_monitor_today) via
 * trading-stats-hooks — NOT the engine API and NOT the raw synced trading_* tables.
 *
 * Tabs: 交易记录(三分类) / 每日历史(金额+百分比) / 当日(持仓+平仓) / 亏损监控.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import {
  ListOrdered, CalendarDays, Activity, ShieldAlert, TrendingUp, TrendingDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumCard } from "@app/components/premium-card";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { SectionEmpty, SectionError, fmtUsd } from "@app/components/copy-trading/shared";
import {
  useTradeRecords, useWalletDailyHistory, useWalletOpenPositions,
  useWalletTodayClosed, useWalletTodayStats, useLossMonitorToday,
  fmtPct, numOrZero, type StatsVenue, type WalletDailyRow,
} from "@app/lib/trading-stats-hooks";

type Tab = "records" | "daily" | "today" | "monitor";
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
function RecordsTab({ wallet }: { wallet: string }) {
  const { t } = useTranslation();
  const [venue, setVenue] = useState<VenueFilter>("ALL");
  const q = useTradeRecords(wallet, venue === "ALL" ? undefined : venue);

  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <SectionError onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];

  return (
    <div className="space-y-3">
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

      {rows.length === 0 ? (
        <SectionEmpty icon={ListOrdered} title={t("copyTrading.statsNoRecords", "暂无交易记录")} />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.record_id} className="rounded-xl px-3.5 py-3"
              style={{ background: "rgba(18,16,12,0.98)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex justify-between items-center mb-1.5 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <VenueChip venue={r.venue} />
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
              {r.source === "manual" && (
                <div className="mt-1 text-[10px] text-amber-400/80">{t("copyTrading.statsManualRecord", "手动补录")}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tab 2: 每日历史(每项金额 + 百分比 + 当月累计)──────────────────────── */
function DailyRow({ d }: { d: WalletDailyRow }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl px-3.5 py-3 space-y-2"
      style={{ background: "rgba(18,16,12,0.98)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <VenueChip venue={d.venue} />
          <span className="text-[12px] font-mono text-foreground/80">{d.day}</span>
        </div>
        <PnlText v={d.day_pnl_usd} pct={d.day_pnl_pct} className="text-[13px]" />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <Metric label={t("copyTrading.statsPosValue", "持仓金额")}
          value={<>{fmtUsd(numOrZero(d.position_value_usd))}<span className="ml-1 text-[10px] text-muted-foreground">({d.position_share_pct ?? 0}%)</span></>} />
        <Metric label={t("copyTrading.statsRealizedDay", "当日实现")}
          value={<PnlText v={d.realized_pnl_day_usd} pct={d.realized_day_pct} className="text-[11px]" />} />
        <Metric label={t("copyTrading.statsUnrealized", "当日浮盈亏")}
          value={<PnlText v={d.unrealized_pnl_usd} pct={d.unrealized_pct} className="text-[11px]" />} />
        <Metric label={t("copyTrading.statsMtdPnl", "当月累计")}
          value={<PnlText v={d.mtd_pnl_usd} pct={d.mtd_pnl_pct} className="text-[11px]" />} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-mono text-foreground/85 text-right">{value}</span>
    </div>
  );
}

function DailyTab({ wallet }: { wallet: string }) {
  const { t } = useTranslation();
  const q = useWalletDailyHistory(wallet);
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <SectionError onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  return rows.length === 0
    ? <SectionEmpty icon={CalendarDays} title={t("copyTrading.statsNoDaily", "暂无每日数据(快照每日生成)")} />
    : <div className="space-y-2">{rows.map((d) => <DailyRow key={`${d.venue}-${d.day}`} d={d} />)}</div>;
}

/* ── Tab 3: 当日(统计 + 持仓 + 平仓)────────────────────────────────────── */
function TodayTab({ wallet }: { wallet: string }) {
  const { t } = useTranslation();
  const statsQ = useWalletTodayStats(wallet);
  const openQ = useWalletOpenPositions(wallet);
  const closedQ = useWalletTodayClosed(wallet);

  if (statsQ.isLoading || openQ.isLoading || closedQ.isLoading) return <ListSkeleton />;
  if (statsQ.isError) return <SectionError onRetry={() => statsQ.refetch()} />;

  const stats = statsQ.data ?? [];
  const open = openQ.data ?? [];
  const closed = closedQ.data ?? [];

  return (
    <div className="space-y-4">
      {/* 当日统计(每 venue 一卡)*/}
      {stats.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {stats.map((d) => <DailyRow key={`${d.venue}-${d.day}`} d={d} />)}
        </div>
      )}

      {/* 当前持仓 */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-foreground/40 font-semibold mb-2">
          {t("copyTrading.statsOpenPositions", "当前持仓")} ({open.length})
        </h3>
        {open.length === 0 ? (
          <SectionEmpty icon={Activity} title={t("copyTrading.statsNoOpen", "暂无持仓")} />
        ) : (
          <div className="space-y-2">
            {open.map((p, i) => (
              <div key={`${p.venue}-${p.symbol}-${i}`} className="rounded-xl px-3.5 py-2.5 flex justify-between items-center gap-2"
                style={{ background: "rgba(18,16,12,0.98)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <VenueChip venue={p.venue} />
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
      </section>

      {/* 当日平仓/成交 */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-foreground/40 font-semibold mb-2">
          {t("copyTrading.statsTodayClosed", "当日平仓 / 成交")} ({closed.length})
        </h3>
        {closed.length === 0 ? (
          <SectionEmpty icon={ListOrdered} title={t("copyTrading.statsNoClosed", "今日暂无平仓")} />
        ) : (
          <div className="space-y-2">
            {closed.map((r, i) => (
              <div key={i} className="rounded-xl px-3.5 py-2.5 flex justify-between items-center gap-2"
                style={{ background: "rgba(18,16,12,0.98)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <VenueChip venue={r.venue} />
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
        )}
      </section>
    </div>
  );
}

/* ── Tab 4: 亏损监控(全账户)───────────────────────────────────────────── */
function MonitorTab() {
  const { t } = useTranslation();
  const q = useLossMonitorToday();
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <SectionError onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];

  return rows.length === 0 ? (
    <SectionEmpty icon={ShieldAlert} title={t("copyTrading.statsNoLoss", "今日暂无亏损账户 🎉")} />
  ) : (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="rounded-xl overflow-hidden relative"
          style={{ background: "rgba(18,16,12,0.98)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500" style={{ boxShadow: "0 0 8px rgba(239,68,68,0.4)" }} />
          <div className="pl-4 pr-3 py-3 space-y-2">
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <VenueChip venue={r.venue} />
                <span className="text-[11px] font-mono text-foreground/75 truncate">{r.wallet}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                {r.is_unrealized_loss && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 flex items-center gap-0.5">
                    <TrendingDown className="h-2.5 w-2.5" />{t("copyTrading.statsFlagUnrealized", "浮亏")}
                  </span>
                )}
                {r.is_realized_loss && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 flex items-center gap-0.5">
                    <TrendingDown className="h-2.5 w-2.5" />{t("copyTrading.statsFlagRealized", "实现亏损")}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <Metric label={t("copyTrading.statsUnrealized", "当日浮盈亏")}
                value={<PnlText v={r.unrealized_pnl_usd} pct={r.unrealized_pct} className="text-[11px]" />} />
              <Metric label={t("copyTrading.statsRealizedDay", "当日实现")}
                value={<PnlText v={r.realized_pnl_day_usd} pct={r.realized_day_pct} className="text-[11px]" />} />
              <Metric label={t("copyTrading.statsDayPnl", "每日盈亏")}
                value={<PnlText v={r.day_pnl_usd} pct={r.day_pnl_pct} className="text-[11px]" />} />
              <Metric label={t("copyTrading.statsPosValue", "持仓金额")}
                value={fmtUsd(numOrZero(r.position_value_usd))} />
            </div>
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

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function CopyTradingStatsPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const [tab, setTab] = useState<Tab>("records");

  const tabs = useMemo(() => ([
    { id: "records" as Tab, icon: ListOrdered, label: t("copyTrading.statsTabRecords", "交易记录") },
    { id: "daily" as Tab, icon: CalendarDays, label: t("copyTrading.statsTabDaily", "每日历史") },
    { id: "today" as Tab, icon: Activity, label: t("copyTrading.statsTabToday", "当日") },
    { id: "monitor" as Tab, icon: ShieldAlert, label: t("copyTrading.statsTabMonitor", "亏损监控") },
  ]), [t]);

  return (
    <CopyTradingLayout title={t("copyTrading.statsTitle", "交易数据")}>
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

        {tab === "monitor" ? (
          <MonitorTab />
        ) : !wallet ? (
          <PremiumCard className="p-6 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-[12px] text-muted-foreground">{t("copyTrading.statsConnectWallet", "连接钱包查看你的交易数据")}</p>
          </PremiumCard>
        ) : tab === "records" ? (
          <RecordsTab wallet={wallet} />
        ) : tab === "daily" ? (
          <DailyTab wallet={wallet} />
        ) : (
          <TodayTab wallet={wallet} />
        )}
      </div>
    </CopyTradingLayout>
  );
}
