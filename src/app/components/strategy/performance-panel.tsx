/**
 * PerformancePanel — withengine 风格的「绩效」面板(策略页)。
 *
 * 自上而下:
 *   1. 时间窗 tabs(1D / 7D / 30D / All)——驱动统计卡的窗口。客户端只有当日
 *      (1D)有真实数据;7D/30D/All 显示「—」(不编造,避免误导)。
 *   2. 统计卡(P&L / 已实现 / Sharpe / 最大回撤)——全部来自传入的真实链上 acct
 *      (useHlAccount);Sharpe 永远「—」(需 20+ 天序列,客户端拿不到)。
 *   3. 净值曲线——纯内联 SVG sparkline(不引图表库),由 recentFills 的累计已实现
 *      PnL 构成;点数 < 2 时显示「数据不足」。
 *   4. 子 tabs(持仓 / 历史 / 指令)——持仓与历史来自 acct;指令把决策 feed
 *      (entries)映射成紧凑表格。
 *   5. 盯盘市场——universe 各币的实时 mark price + 24h 涨跌;一次性经 HL info
 *      `metaAndAssetCtxs` 拉取(CORS 开放,浏览器直连),react-query 缓存 60s。
 *
 * 真实 vs 近似:净值曲线/已实现/持仓/历史/盯盘行情均为真实数据;P&L% 用
 * todayPnl÷accountValue;最大回撤为曲线 best-effort;Sharpe 与多窗口(7D+)无
 * 客户端真值故留空。
 *
 * 注:DecisionEntry 的真实导出在 @app/lib/decision-log-hooks(hl-strategy-feed
 * 仅 import-type 未 re-export),故此处从其真实来源导入以保证类型可编译。
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  LineChart,
  Layers,
  History as HistoryIcon,
  ListChecks,
  Eye,
} from "lucide-react";
import type { HlAccount, HlNetwork, HlPosition, HlFillRow } from "@app/lib/engine";
import type { DecisionEntry } from "@app/lib/decision-log-hooks";
import { useHlEquityCurve } from "@app/lib/engine-hooks";
import { useTradeRecords, useWalletDailyHistory } from "@app/lib/trading-stats-hooks";
import { cn } from "@app/lib/utils";

const HL_INFO = "https://api.hyperliquid.xyz/info";
const DAY_MS = 24 * 3600 * 1000;

type Timeframe = "1D" | "7D" | "30D" | "All";
type SubTab = "positions" | "history" | "directives";

// ── format helpers (贴合 engine-console / hl-strategy-feed 既有写法) ──────────
function usd(n: number): string {
  const a = Math.abs(n);
  return `${n < 0 ? "-" : ""}$${a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function px(n: number): string {
  return n >= 100 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : Number(n.toPrecision(4)).toString();
}
function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function signClass(n: number): string {
  return n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-muted-foreground/60";
}
function baseCoin(c: string): string {
  return c.replace(/-(PERP|USDC|USD)$/i, "").toUpperCase();
}
function clock(ms: number): string {
  const d = new Date(ms);
  const p = (x: number) => x.toString().padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Hyperliquid metaAndAssetCtxs(一次性,缓存 60s)──────────────────────────
interface MarkRow {
  name: string;
  markPx: number;
  change24h: number | null;
}
type MetaCtxResp = [
  { universe: Array<{ name: string }> },
  Array<{ markPx?: string; prevDayPx?: string }>,
];

async function fetchMarks(): Promise<Map<string, MarkRow>> {
  const r = await fetch(HL_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
  });
  if (!r.ok) throw new Error(`metaAndAssetCtxs ${r.status}`);
  const [meta, ctxs] = (await r.json()) as MetaCtxResp;
  const out = new Map<string, MarkRow>();
  const list = meta?.universe ?? [];
  for (let i = 0; i < list.length; i++) {
    const name = list[i]?.name;
    const ctx = ctxs?.[i];
    if (!name || !ctx) continue;
    const mark = Number(ctx.markPx);
    const prev = Number(ctx.prevDayPx);
    const change = Number.isFinite(mark) && Number.isFinite(prev) && prev !== 0 ? ((mark - prev) / prev) * 100 : null;
    out.set(name.toUpperCase(), { name, markPx: mark, change24h: change });
  }
  return out;
}

// ── small presentational atoms ────────────────────────────────────────────
function StatCard({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/30 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/55 truncate">{label}</p>
      <div className="mt-1 text-[15px] font-bold tabular-nums leading-tight break-all">{children}</div>
      {sub != null && <div className="mt-0.5 text-[10px] text-muted-foreground/45 truncate">{sub}</div>}
    </div>
  );
}

const DASH = <span className="text-muted-foreground/35">—</span>;

// ── equity sparkline (inline SVG, no chart lib) ────────────────────────────
function Sparkline({ points }: { points: number[] }) {
  const W = 600;
  const H = 120;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const path = points
    .map((v, i) => {
      const x = i * step;
      const y = H - ((v - min) / span) * (H - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  const stroke = up ? "#34d399" : "#f87171";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-24 w-full">
      <polyline points={path.replace(/[ML]/g, " ").trim()} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function PerformancePanel({ userId, acct, network, universe, entries }: {
  userId?: string;
  acct?: HlAccount;
  network: HlNetwork;
  universe: string[];
  entries: DecisionEntry[];
}) {
  const { t } = useTranslation();
  const [tf, setTf] = useState<Timeframe>("1D");
  const [tab, setTab] = useState<SubTab>("positions");

  // 多日真实净值快照(worker equity-snapshot job)。有数据 → 净值曲线用真曲线;
  // 无快照(job 未开 / 新账户)→ 回退现有当日累计 PnL 逻辑(不报错)。拉 90 天一次,
  // 按 tab 选窗在客户端切片(避免每切窗都打一次端点)。
  const curveQ = useHlEquityCurve(userId, 90);
  const snapPoints = useMemo(
    () =>
      (curveQ.data?.points ?? [])
        .filter((p) => p.accountValue != null && Number.isFinite(p.accountValue))
        .map((p) => ({ t: +new Date(p.ts), v: p.accountValue as number }))
        .sort((a, b) => a.t - b.t),
    [curveQ.data],
  );

  // 多日曲线兜底:worker equity-snapshot 没数据时,用同步表 trading_acct_daily 的
  // 日线累计已实现 PnL(realized_pnl_cum_usd,缺则按 day_pnl_usd 累加)画多日曲线 —— 与
  // 当日 intraday 兜底同口径(累计 PnL,非绝对净值)。只取本 HL venue 行。
  const hlVenue = network === "testnet" ? "hl_testnet" : "hl_mainnet";
  const dailyQ = useWalletDailyHistory(acct?.address, 90);
  const dailyPoints = useMemo(() => {
    const rows = (dailyQ.data ?? [])
      .filter((r) => r.venue === hlVenue && r.day)
      .slice()
      .sort((a, b) => (a.day < b.day ? -1 : 1));
    let running = 0;
    return rows.map((r) => {
      const cum = r.realized_pnl_cum_usd != null ? r.realized_pnl_cum_usd : (running += r.day_pnl_usd ?? 0);
      return { t: +new Date(r.day), v: cum };
    });
  }, [dailyQ.data, hlVenue]);

  // 平仓历史/已实现 兜底:引擎 /v1/hl/account 的 recentFills 对高 fill 账户会因 SQL timeout→
  // info 429→直连 HL 兜底(无 fills)而为空 → 历史/已实现/平仓笔数 全 0。改读同步表
  // trading_trade_records(useTradeRecords,worker 实时写,已持久化 stats.*),映射成 HlFillRow。
  // 只取真实(source!=='manual',防穿帮)平仓行。引擎有 fills 时仍优先用引擎(更全,含开仓)。
  const recsQ = useTradeRecords(acct?.address, network === "testnet" ? "hl_testnet" : "hl_mainnet", 200);
  const fallbackFills: HlFillRow[] = useMemo(
    () =>
      (recsQ.data ?? [])
        .filter((r) => r.source !== "manual" && (r.realized_pnl_usd != null || /close/i.test(r.record_type)))
        .map((r) => ({
          coin: r.symbol ?? "",
          dir: /short/i.test(r.side ?? "") ? "Close Short" : "Close Long",
          side: r.side ?? "",
          sz: Number(r.size) || 0,
          px: Number(r.price) || 0,
          closedPnl: Number(r.realized_pnl_usd) || 0,
          isClose: true,
          time: r.happened_at ? +new Date(r.happened_at) : 0,
          hash: r.tx_hash ?? null,
        })),
    [recsQ.data],
  );
  const fills: HlFillRow[] = acct?.recentFills?.length ? acct.recentFills : fallbackFills;
  const positions: HlPosition[] = acct?.positions ?? [];
  const navValue = acct?.accountValue ?? 0;
  const is1D = tf === "1D";

  // 已实现(当日):仅近 24h 平仓的 closedPnl 之和。**不**回退 acct.realizedPnl
  //(那是**累计/全期**值,标成「1D」会误导——之前 $162/0笔平仓 的来源)。无平仓 → $0。
  const since = Date.now() - DAY_MS;
  const dayCloses = useMemo(() => fills.filter((f) => f.isClose && f.time >= since), [fills, since]);
  const realized1D = dayCloses.reduce((s, f) => s + (f.closedPnl || 0), 0);

  // P&L · 1D:当日已实现 + 当前浮动盈亏。让"仅有持仓未平"的账户也能看到实时盈亏,
  //   而不是显示 $0(已实现为 0 但有浮动 -$x 时,旧逻辑误显示 $0)。无持仓且无当日数据 → null。
  const unrealized = acct?.unrealizedPnl ?? 0;
  const pnl1D = acct?.todayPnl != null || positions.length > 0 ? (acct?.todayPnl ?? 0) + unrealized : null;
  const pnlPct = pnl1D != null && navValue > 0 ? (pnl1D / navValue) * 100 : null;

  // 选定窗口(tf)对应的天数;All = 全部快照。
  const windowDays = tf === "1D" ? 1 : tf === "7D" ? 7 : tf === "30D" ? 30 : null;

  // 真实净值曲线(优先):用 worker 快照的 account_value 序列,按 tf 切窗 → 多日真曲线。
  //   每点是绝对净值(equity),非累计 PnL —— 这正是「净值曲线」该显示的口径。
  const snapEquity = useMemo(() => {
    if (snapPoints.length < 2) return null;
    const cutoff = windowDays != null ? Date.now() - windowDays * DAY_MS : 0;
    const win = snapPoints.filter((p) => p.t >= cutoff);
    // 窗内不足 2 点(如 1D 但当天只一条快照)→ 该窗用真曲线不成立,交回退处理。
    return win.length >= 2 ? win.map((p) => p.v) : null;
  }, [snapPoints, windowDays]);

  // 当日回退曲线(无快照时):按时间升序累计**近 24h** 平仓 PnL,起点 0(仅 1D 有意义)。
  const intradayEquity = useMemo(() => {
    const closes = dayCloses.slice().sort((a, b) => a.time - b.time);
    const pts = [0];
    let cum = 0;
    for (const f of closes) {
      cum += f.closedPnl || 0;
      pts.push(cum);
    }
    // 实时终点:累计已实现 + 当前浮动盈亏 → 仅有持仓未平的新账户也能渲染曲线。
    if (positions.length > 0) pts.push(cum + unrealized);
    return pts;
  }, [dayCloses, positions.length, unrealized]);

  // 日线兜底曲线(多日):trading_acct_daily 累计 PnL,按 tf 切窗。
  const dailyEquity = useMemo(() => {
    if (dailyPoints.length < 2) return null;
    const cutoff = windowDays != null ? Date.now() - windowDays * DAY_MS : 0;
    const win = dailyPoints.filter((p) => p.t >= cutoff);
    return win.length >= 2 ? win.map((p) => p.v) : null;
  }, [dailyPoints, windowDays]);

  // 优先级:worker 真净值快照(绝对净值,最佳)> 日线累计 PnL 兜底(多日)> 当日 intraday(仅 1D)。
  const usingSnapshot = snapEquity != null;
  const equity = usingSnapshot
    ? (snapEquity as number[])
    : dailyEquity != null
      ? dailyEquity
      : is1D
        ? intradayEquity
        : [];
  const hasCurve = equity.length >= 2;

  // 最大回撤(best-effort,来自曲线)。
  const maxDD = useMemo(() => {
    if (!hasCurve) return null;
    let peak = equity[0];
    let dd = 0;
    for (const v of equity) {
      if (v > peak) peak = v;
      dd = Math.min(dd, v - peak);
    }
    return dd;
  }, [equity, hasCurve]);

  // 盯盘行情(一次性 / 缓存 60s)。
  const marksQ = useQuery({
    queryKey: ["hl-marks", network],
    queryFn: fetchMarks,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const marks = marksQ.data;

  const tfs: Timeframe[] = ["1D", "7D", "30D", "All"];
  const subTabs: Array<[SubTab, string, React.ComponentType<{ className?: string }>]> = [
    ["positions", t("perf.positions", "持仓"), Layers],
    ["history", t("perf.history", "历史"), HistoryIcon],
    ["directives", t("perf.directives", "指令"), ListChecks],
  ];

  // 指令表:newest-first,cap 15。
  const directives = entries.slice(0, 15);
  const phaseOf = (k: DecisionEntry["kind"]) =>
    k === "watch" ? "scan" : k === "trade" ? "trade" : "decide";
  const outcomeOf = (k: DecisionEntry["kind"]) => (k === "trade" ? "executed" : "expired");

  return (
    <section className="flex flex-col gap-3">
      {/* 1 ── timeframe tabs ── */}
      <div className="flex rounded-2xl border border-white/[0.06] bg-black/30 p-1 text-[11px] font-medium">
        {tfs.map((v) => (
          <button
            key={v}
            onClick={() => setTf(v)}
            className={cn(
              "flex-1 rounded-xl px-2 py-1.5 transition-colors",
              tf === v
                ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black font-semibold"
                : "text-muted-foreground/60 hover:text-foreground/80",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* 2 ── stat cards ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label={`${t("perf.pnl", "P&L")} · ${tf}`}
          sub={!is1D ? <span className="text-muted-foreground/30">—</span> : pnlPct != null ? pct(pnlPct) : undefined}
        >
          {!is1D ? DASH : pnl1D != null ? <span className={signClass(pnl1D)}>{usd(pnl1D)}</span> : DASH}
        </StatCard>

        <StatCard
          label={`${t("perf.realized", "已实现")} · ${tf}`}
          sub={!is1D ? <span className="text-muted-foreground/30">—</span> : t("perf.closes", "{{n}} 笔平仓", { n: dayCloses.length })}
        >
          {!is1D ? DASH : <span className={cn("num-gold", signClass(realized1D))}>{usd(realized1D)}</span>}
        </StatCard>

        <StatCard label={t("perf.sharpe", "Sharpe")} sub={t("perf.sharpeNeed", "需 20+ 天")}>
          {DASH}
        </StatCard>

        <StatCard
          label={`${t("perf.maxdd", "最大回撤")} · ${tf}`}
          sub={!is1D && !usingSnapshot ? <span className="text-muted-foreground/30">—</span> : undefined}
        >
          {(is1D || usingSnapshot) && maxDD != null ? <span className="text-red-400">{usd(maxDD)}</span> : DASH}
        </StatCard>
      </div>

      {/* 3 ── equity curve ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-black/30 px-3 py-3">
        <div className="flex items-center gap-2">
          <LineChart className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <h3 className="text-[11px] font-semibold tracking-wide">{t("perf.equity", "净值曲线")}</h3>
          {usingSnapshot && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
              {t("perf.realEquity", "真实净值")}
            </span>
          )}
          {hasCurve && (
            <span className="ml-auto font-mono text-[10px] text-muted-foreground/55 tabular-nums">
              {usd(equity[0])} → <span className={signClass(equity[equity.length - 1])}>{usd(equity[equity.length - 1])}</span> · {tf}
            </span>
          )}
        </div>
        <div className="mt-2">
          {hasCurve ? (
            <Sparkline points={equity} />
          ) : curveQ.isLoading || dailyQ.isLoading || recsQ.isLoading ? (
            <p className="py-6 text-center text-[11px] text-amber-300/70 flex items-center justify-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
              {t("engineLive.updating", "链上更新中…")}
            </p>
          ) : (
            <p className="py-6 text-center text-[11px] text-muted-foreground/40">{t("perf.noCurve", "数据不足")}</p>
          )}
        </div>
      </div>

      {/* 4 ── sub-tabs ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-black/30 overflow-hidden">
        <div className="flex border-b border-white/[0.06] p-1 text-[11px] font-medium">
          {subTabs.map(([v, label, Icon]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 transition-colors",
                tab === v ? "bg-white/10 text-foreground" : "text-muted-foreground/60 hover:text-foreground/80",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="px-3 py-2.5">
          {/* Positions */}
          {tab === "positions" && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/55">
                {t("perf.positions", "持仓")} · {positions.length}
              </p>
              {positions.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-muted-foreground/40">—</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {positions.map((p) => {
                    const sz = (p as { szi?: number; size?: number }).szi ?? p.size ?? 0;
                    const long = sz >= 0;
                    return (
                      <li key={p.coin} className="flex items-center gap-2 rounded-xl bg-black/30 px-2.5 py-1.5">
                        <span className="font-mono text-[11px] font-semibold text-foreground/85">{baseCoin(p.coin)}</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold", long ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
                          {long ? "LONG" : "SHORT"}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground/55 tabular-nums">
                          @ {p.entryPx != null ? px(p.entryPx) : "—"}
                        </span>
                        <span className={cn("ml-auto font-mono text-[11px] font-semibold tabular-nums", signClass(p.upnl ?? 0))}>
                          {usd(p.upnl ?? 0)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* History */}
          {tab === "history" && (
            <div>
              {fills.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-muted-foreground/40">—</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {fills.map((f, i) => (
                    <li key={f.hash ?? `${f.time}-${i}`} className="flex items-center gap-2 py-1 text-[11px]">
                      <span className="font-mono text-[10px] text-muted-foreground/45 tabular-nums shrink-0">{clock(f.time)}</span>
                      <span className="font-mono font-semibold text-foreground/80 shrink-0">{baseCoin(f.coin)}</span>
                      <span className="text-muted-foreground/55 truncate">{f.dir}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/45 tabular-nums shrink-0">
                        {px(f.sz)} @ {px(f.px)}
                      </span>
                      {f.isClose && (
                        <span className={cn("ml-auto font-mono text-[11px] font-semibold tabular-nums shrink-0", signClass(f.closedPnl || 0))}>
                          {usd(f.closedPnl || 0)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Directives */}
          {tab === "directives" && (
            <div className="-mx-1 overflow-x-auto">
              {directives.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-muted-foreground/40">—</p>
              ) : (
                <table className="w-full min-w-[440px] text-[11px]">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-wide text-muted-foreground/45">
                      <th className="px-1 py-1 text-left font-medium">#</th>
                      <th className="px-1 py-1 text-left font-medium">{t("perf.time", "时间")}</th>
                      <th className="px-1 py-1 text-left font-medium">{t("perf.market", "市场")}</th>
                      <th className="px-1 py-1 text-left font-medium">{t("perf.phase", "阶段")}</th>
                      <th className="px-1 py-1 text-left font-medium">{t("perf.outcome", "结果")}</th>
                      <th className="px-1 py-1 text-right font-medium">{t("perf.conviction", "信念")}</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {directives.map((e) => (
                      <tr key={e.id} className="border-t border-white/[0.04]">
                        <td className="px-1 py-1.5 text-muted-foreground/45">{String(e.id)}</td>
                        <td className="px-1 py-1.5 text-muted-foreground/55">{clock(+new Date(e.ts))}</td>
                        <td className="px-1 py-1.5 font-semibold text-foreground/80">{e.symbol ?? "—"}</td>
                        <td className="px-1 py-1.5 text-sky-400/80">{phaseOf(e.kind)}</td>
                        <td className={cn("px-1 py-1.5", e.kind === "trade" ? "text-emerald-400" : "text-amber-400/70")}>
                          {outcomeOf(e.kind)}
                        </td>
                        <td className="px-1 py-1.5 text-right text-foreground/70">{e.conviction?.toFixed(2) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5 ── markets watched ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-black/30 px-3 py-3">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <h3 className="text-[11px] font-semibold tracking-wide">
            {t("perf.marketsWatched", "盯盘市场")} · {universe.length}
          </h3>
          <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-muted-foreground/40">
            <Activity className="h-2.5 w-2.5" />
            {t("perf.tradable", "可交易范围")}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {universe.map((c) => {
            const row = marks?.get(baseCoin(c));
            const ch = row?.change24h;
            return (
              <div key={c} className="flex items-center gap-2 rounded-xl bg-black/30 px-2.5 py-1.5">
                <span className="font-mono text-[10px] font-semibold text-foreground/80 truncate">{baseCoin(c)}-PERP</span>
                <span className="ml-auto flex flex-col items-end leading-tight">
                  <span className="font-mono text-[11px] tabular-nums text-foreground/85">
                    {row && Number.isFinite(row.markPx) ? px(row.markPx) : marksQ.isLoading ? "…" : "—"}
                  </span>
                  {ch != null && (
                    <span className={cn("flex items-center gap-0.5 font-mono text-[9px] tabular-nums", signClass(ch))}>
                      {ch >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {pct(ch)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default PerformancePanel;
