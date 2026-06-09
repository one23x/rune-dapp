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
  ListOrdered, CalendarDays, Activity, Layers, History as HistoryIcon, TrendingUp, ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumCard } from "@app/components/premium-card";
import { SectionEmpty, SectionError, fmtUsd } from "@app/components/copy-trading/shared";
import {
  useTradeRecords, useWalletDailyHistory, useWalletOpenPositions,
  useWalletTodayClosed, useWalletTodayStats, useWalletAccountSummary,
  fmtPct, numOrZero, type StatsVenue,
} from "@app/lib/trading-stats-hooks";
import { DailyStatRow } from "@app/components/copy-trading/daily-stat-row";

type Tab = "open" | "history" | "todayClosed" | "daily" | "records";
type VenueFilter = "ALL" | StatsVenue;

/** venue 显示名(走 i18n;Polymarket 是品牌名不翻)。 */
type Tr = (key: string, defaultValue: string) => string;
const venueLabel = (t: Tr, v: StatsVenue): string =>
  v === "polymarket" ? "Polymarket"
  : v === "hl_mainnet" ? t("copyTrading.venueHlMainnet", "HL 主网")
  : t("copyTrading.venueHlTestnet", "HL 测试网");
const VENUE_COLOR: Record<StatsVenue, string> = {
  polymarket: "bg-sky-500/10 text-sky-400",
  hl_mainnet: "bg-emerald-500/10 text-emerald-400",
  hl_testnet: "bg-amber-500/10 text-amber-400",
};

function VenueChip({ venue }: { venue: StatsVenue }) {
  const { t } = useTranslation();
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${VENUE_COLOR[venue]}`}>
      {venueLabel(t, venue)}
    </span>
  );
}

/** PM 真实持仓的 symbol 常是原始 ERC-1155 token_id(78 位数字)/ market_id 是 0x hash;
 *  直接渲染会是一串无意义数字(比手动行的人类标题还难看 → 穿帮)。这里截断显示;
 *  真正的市场标题需 PM 同步管线补 token_id→question 映射(backlog)。 */
function prettySymbol(symbol?: string | null, marketId?: string | null): string {
  const s = (symbol ?? marketId ?? "").trim();
  if (!s) return "—";
  if (/^\d{12,}$/.test(s)) return `#${s.slice(0, 6)}…${s.slice(-4)}`;
  if (/^0x[0-9a-fA-F]{12,}$/.test(s)) return `${s.slice(0, 6)}…${s.slice(-4)}`;
  return s;
}

/**
 * 2026-06-09 账本转向:会员看到的持仓/记录全部是公司维护的虚拟账本,与真实链上账户解耦。
 * 链上 explorer 链接一律不给(虚拟数据链到链上 = 立刻穿帮)。两个函数恒返回 null,
 * 所有 `{tx && <a>}` / `{addr && <a>}` 链接块自动不渲染。
 */
function explorerTx(_hash: string, _venue: StatsVenue): string | null {
  return null;
}
function explorerAddr(_addr: string, _venue: StatsVenue): string | null {
  return null;
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
              {v === "ALL" ? t("copyTrading.statsAllVenues", "全部") : venueLabel(t, v as StatsVenue)}
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
                  <span className="text-[13px] font-medium text-foreground/85 truncate">{prettySymbol(r.symbol, r.market_id)}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                  r.side === "BUY" || r.side === "long" ? "bg-emerald-500/10 text-emerald-400"
                  : r.side === "SELL" || r.side === "short" ? "bg-red-500/10 text-red-400"
                  : "bg-white/5 text-muted-foreground"
                }`}>{r.side ?? r.record_type}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-muted-foreground gap-2">
                <span className="font-mono min-w-0 truncate">
                  {r.price != null && `$${Number(r.price).toLocaleString()}`}
                  {r.size != null && ` × ${Number(r.size).toLocaleString()}`}
                  {r.notional_usd != null && ` = ${fmtUsd(Number(r.notional_usd))}`}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span>{r.happened_at ? new Date(r.happened_at).toLocaleString() : "—"}</span>
                  {/* 链上详情:仅有 tx_hash 才渲染(HL → explorer/tx;PM 恒 null 不显示,防退回地址页穿帮)。 */}
                  {(() => {
                    const tx = r.tx_hash ? explorerTx(r.tx_hash, r.venue) : null;
                    return tx ? (
                      <a href={tx} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={t("hl.viewOnChain", "查看链上记录")} title={t("hl.viewOnChain", "查看链上记录")}
                        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/60 hover:text-amber-300 hover:bg-white/5 transition">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null;
                  })()}
                </span>
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
    : <div className="space-y-2">{rows.map((d) => <DailyStatRow key={`${d.venue}-${d.day}`} d={d} venueLabel={venueScope ? undefined : venueLabel(t, d.venue)} />)}</div>;
}

/* ── Tab 3: 当前持仓(当日统计 + 持仓明细)──────────────────────────────── */
function OpenTab({ wallet, venueScope, onClosePosition, closingSymbol, hlAddress }: {
  wallet: string; venueScope?: StatsVenue;
  onClosePosition?: (symbol: string) => void; closingSymbol?: string | null;
  hlAddress?: string;
}) {
  const { t } = useTranslation();
  const statsQ = useWalletTodayStats(wallet);
  const openQ = useWalletOpenPositions(wallet);
  // 账户汇总(净值)—— 给每仓「持仓价值」算占净值比;NULL/0 时该 % 优雅不显示。
  const summaryQ = useWalletAccountSummary(wallet);

  if (statsQ.isLoading || openQ.isLoading) return <ListSkeleton />;
  if (openQ.isError) return <SectionError onRetry={() => openQ.refetch()} />;

  const stats = (statsQ.data ?? []).filter((d) => !venueScope || d.venue === venueScope);
  const open = (openQ.data ?? []).filter((p) => !venueScope || p.venue === venueScope);
  const summaries = summaryQ.data ?? [];

  return (
    <div className="space-y-4">
      {stats.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {stats.map((d) => <DailyStatRow key={`${d.venue}-${d.day}`} d={d} venueLabel={venueScope ? undefined : venueLabel(t, d.venue)} />)}
        </div>
      )}

      {open.length === 0 ? (
        <SectionEmpty icon={Layers} title={t("copyTrading.statsNoOpen", "暂无持仓")} />
      ) : (
        <div className="space-y-2">
          {open.map((p, i) => {
            // 该仓所在 venue 的账户净值(admin 覆盖优先);用于算「持仓价值」占净值比。
            const av = summaries.find((s) => s.venue === p.venue)?.account_value_usd ?? null;
            return (
              <PositionCard
                key={`${p.venue}-${p.symbol}-${i}`}
                p={p}
                showVenue={!venueScope}
                onClose={onClosePosition}
                closing={closingSymbol != null && closingSymbol === p.symbol}
                hlAddress={hlAddress}
                accountValue={av}
              />
            );
          })}
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

  // 汇总:笔数 / 实现盈亏合计(+% vs 名义)/ 赢率 —— 与 HL 区原设计同款。
  const closes = closed.length;
  const realized = closed.reduce((s2, r) => s2 + numOrZero(r.realized_pnl_usd), 0);
  const notional = closed.reduce((s2, r) => s2 + numOrZero(r.notional_usd), 0);
  const wins = closed.filter((r) => numOrZero(r.realized_pnl_usd) >= 0).length;
  const winRate = closes > 0 ? (wins / closes) * 100 : 0;
  const realizedPct = notional > 0 ? (realized / notional) * 100 : null;

  return closed.length === 0 ? (
    <SectionEmpty icon={HistoryIcon} title={t("copyTrading.statsNoClosed", "今日暂无平仓")} />
  ) : (
    <div className="space-y-2">
      <div className="glass-panel p-3">
        <div className="grid grid-cols-3 gap-1 text-center">
          <div>
            <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.statTodayClosed", "已平仓笔数")}</div>
            <div className="text-[13px] font-bold tabular-nums text-foreground/85">{closes}</div>
          </div>
          <div>
            <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.statTodayRealized", "当日已实现盈亏")}</div>
            <div className={`text-[13px] font-bold tabular-nums ${realized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {realized >= 0 ? "+" : ""}{fmtUsd(realized)}
              {realizedPct != null && <span className="text-[9px] opacity-70"> ({realizedPct >= 0 ? "+" : ""}{realizedPct.toFixed(2)}%)</span>}
            </div>
          </div>
          <div>
            <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.statWinRate", "赢率")}</div>
            <div className="text-[13px] font-bold tabular-nums num-gold">{winRate.toFixed(2)}%</div>
          </div>
        </div>
      </div>
      {closed.map((r, i) => (
        <ClosedRow key={i} r={r} showVenue={!venueScope} />
      ))}
    </div>
  );
}

/* ── 共享行组件(源自 HL 区 SbPositionRow / SbClosedTodayRow,PM/HL 通用)────── */

/** 当前持仓一行:LONG/SHORT 徽章 + 浮盈$/ROE% + 三列(数量/入场价/持仓价值)。
 *  仅真实行 + 传入 onClose 时给「平仓」(双击确认);tx_hash 仅 HL 给详情页直链。 */
function PositionCard({ p, showVenue, onClose, closing, hlAddress, accountValue }: {
  p: import("@app/lib/trading-stats-hooks").OpenPositionRow;
  showVenue?: boolean;
  onClose?: (symbol: string) => void;
  closing?: boolean;
  hlAddress?: string;
  /** 该 venue 账户净值(admin 覆盖优先);用于算「持仓价值」占净值比,NULL/0 时 % 不显示。 */
  accountValue?: number | null;
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const coin = prettySymbol(p.symbol, p.market_id);
  const size = numOrZero(p.size);
  const long = size >= 0;
  const cost = numOrZero(p.position_cost_usd);
  const upnl = numOrZero(p.unrealized_pnl_usd);
  // ROE%:优先用成本(upnl/cost);成本缺失时回退名义(upnl/posValue),保证浮盈旁尽量带 %。
  const roeBasis = cost > 0 ? cost : numOrZero(p.position_value_usd);
  const roe = roeBasis > 0 ? (upnl / roeBasis) * 100 : NaN;
  const pos = upnl >= 0;
  // 交易所式增强:杠杆徽章(真实/手动行有值;PM custodial=NULL → 不显示)+ 每仓保证金(名义/leverage)。
  const lev = p.leverage != null && Number(p.leverage) > 0 ? Number(p.leverage) : null;
  const posValue = numOrZero(p.position_value_usd);
  const positionMargin = lev != null && posValue > 0 ? posValue / lev : null;
  // 持仓价值占账户净值比(名义/净值)；净值不可用(NULL/≤0)时优雅不显示。
  const av = accountValue != null ? Number(accountValue) : NaN;
  const sharePct = Number.isFinite(av) && av > 0 && posValue > 0 ? (posValue / av) * 100 : NaN;
  // 链上详情:① 有 tx_hash → tx 详情页(手动单可填真实 tx);② 真实 HL 持仓(无单笔 tx)
  //          → 该账户 explorer 页(地址页有真实持仓,能对上)。手动行不回退地址页(防穿帮)。
  const tx = p.tx_hash
    ? explorerTx(p.tx_hash, p.venue)
    : (!p.is_manual && hlAddress && (p.venue === "hl_mainnet" || p.venue === "hl_testnet")
        ? explorerAddr(hlAddress, p.venue)
        : null);
  const closable = !!onClose && !!p.symbol && !p.is_manual;
  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {showVenue && <VenueChip venue={p.venue} />}
          <span className="text-[13px] font-bold text-foreground/90 truncate">{coin}</span>
          <span className={`inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0 ${long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
            {long ? "LONG" : "SHORT"}
          </span>
          {/* 杠杆徽章(交易所式)—— 仅有 leverage 的真实/手动行显示,如 10x。 */}
          {lev != null && (
            <span className="font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0 text-amber-300 bg-amber-500/10">
              {lev}x
            </span>
          )}
          {tx && (
            <a href={tx} target="_blank" rel="noopener noreferrer"
              aria-label={t("hl.viewOnExplorer", "区块链浏览器查看")} title={t("hl.viewOnExplorer", "区块链浏览器查看")}
              className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground/60 hover:text-amber-300 hover:bg-white/5 transition shrink-0">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={`text-[12px] font-bold tabular-nums ${pos ? "text-emerald-400" : "text-red-400"}`}>{pos ? "+" : ""}{fmtUsd(upnl)}</div>
          {Number.isFinite(roe) && <div className={`text-[10px] tabular-nums ${pos ? "text-emerald-400/70" : "text-red-400/70"}`}>{pos ? "+" : ""}{roe.toFixed(2)}%</div>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.size", "数量")}</div><div className="text-[12px] font-bold tabular-nums">{Math.abs(size).toLocaleString()}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.entry", "入场价")}</div><div className="text-[12px] font-bold tabular-nums">{p.entry_px != null ? Number(p.entry_px).toLocaleString() : "—"}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.value", "持仓价值")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtUsd(posValue)}{Number.isFinite(sharePct) && <span className="text-[8px] text-muted-foreground/60 ml-0.5">({sharePct.toFixed(1)}%)</span>}</div></div>
      </div>
      {/* 每仓保证金(交易所式)—— 名义/杠杆;仅 leverage 有值时显示,不破坏无杠杆行布局。 */}
      {positionMargin != null && (
        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground uppercase tracking-wide">{t("hl.positionMargin", "保证金")}</span>
          <span className="font-bold tabular-nums text-foreground/80">{fmtUsd(positionMargin)}</span>
        </div>
      )}
      {closable && (
        <button
          type="button"
          disabled={closing}
          onClick={() => {
            if (confirm) { onClose!(p.symbol!); setConfirm(false); }
            else { setConfirm(true); window.setTimeout(() => setConfirm(false), 3000); }
          }}
          className={`mt-2.5 w-full h-9 rounded-lg text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition active:scale-[0.99] disabled:opacity-60 ${
            confirm ? "bg-red-500 text-white" : "bg-white/[0.04] text-red-300 border border-red-500/25 hover:bg-red-500/10"}`}
          data-testid={`button-close-${coin}`}
        >
          {closing ? t("hl.closing", "平仓中…") : confirm ? t("hl.closeConfirm", "确认市价平仓?") : t("hl.closePosition", "平仓")}
        </button>
      )}
    </div>
  );
}

/** 当日平仓一行:LONG/SHORT + 名义 + 实现盈亏$%(tx_hash 仅 HL 给「查看链上记录」)。 */
function ClosedRow({ r, showVenue }: { r: import("@app/lib/trading-stats-hooks").TodayClosedRow; showVenue?: boolean }) {
  const { t } = useTranslation();
  const long = r.side ? /buy|long/i.test(r.side) : true;
  const realized = numOrZero(r.realized_pnl_usd);
  const pnlPos = realized >= 0;
  const notional = numOrZero(r.notional_usd);
  const pct = notional > 0 ? (realized / notional) * 100 : NaN;
  const coin = prettySymbol(r.symbol, r.market_id);
  const tx = r.tx_hash ? explorerTx(r.tx_hash, r.venue) : null;
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg flex-wrap" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-2 min-w-0">
        {showVenue && <VenueChip venue={r.venue} />}
        <span className={`font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0 ${long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>{long ? "LONG" : "SHORT"}</span>
        <span className="text-[12px] font-bold text-foreground/85 truncate">{coin}</span>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        {notional > 0 && <span className="text-[11px] tabular-nums num-gold">{fmtUsd(notional)}</span>}
        <span className={`text-[11px] tabular-nums ${pnlPos ? "text-emerald-400" : "text-red-400"}`}>
          {pnlPos ? "+" : ""}{fmtUsd(realized)}
          {Number.isFinite(pct) && <span className="text-[9px] opacity-70"> ({pnlPos ? "+" : ""}{pct.toFixed(2)}%)</span>}
        </span>
        {r.happened_at && <span className="text-[10px] text-muted-foreground/60">{new Date(r.happened_at).toLocaleTimeString()}</span>}
        {tx && (
          <a href={tx} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[10px] font-semibold text-amber-300/90 border border-amber-500/25 hover:bg-amber-500/10 transition">
            <ExternalLink className="h-3 w-3" />
            {t("hl.viewOnChain", "查看链上记录")}
          </a>
        )}
      </div>
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
export function TradeRecordsDetail({ wallet, venueScope, onClosePosition, closingSymbol, hlAddress }: {
  wallet?: string; venueScope?: StatsVenue;
  /** 传入即在真实持仓行显示「平仓」按钮(双击确认)— HL 区用引擎市价平仓。 */
  onClosePosition?: (symbol: string) => void;
  closingSymbol?: string | null;
  /** HL 账户地址(custodial EOA / agent master)— 真实持仓行回退到 explorer 账户页用。 */
  hlAddress?: string;
}) {
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
        <OpenTab wallet={wallet} venueScope={venueScope} onClosePosition={onClosePosition} closingSymbol={closingSymbol} hlAddress={hlAddress} />
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
