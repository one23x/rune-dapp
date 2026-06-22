/**
 * 引擎页「链上真实数据」组件 —— 直读 useHlAccount(真实 HL 账户:positions /
 * recentFills / accountValue / unrealizedPnl),**不走虚拟账本 / admin 覆盖**。
 * 按所选策略的 universe 过滤(只看该策略盯盘币种)。
 *
 * 因为数据是真实链上的,fills 的 HL explorer/tx 链接是诚实的(有 hash 才给),
 * 满足"开/平仓小图标 → Hyperliquid 下单详情页"。移动端优先 + dark glass 风格。
 */
import { useTranslation } from "react-i18next";
import { ExternalLink, TrendingUp, TrendingDown, Inbox } from "lucide-react";
import type { HlAccount, HlPosition, HlFillRow, HlNetwork } from "@app/lib/engine";
import { cn } from "@app/lib/utils";

function hlTx(hash: string, network: HlNetwork): string {
  const base = network === "testnet" ? "https://app.hyperliquid-testnet.xyz" : "https://app.hyperliquid.xyz";
  return `${base}/explorer/tx/${hash}`;
}
function hlAddr(addr: string, network: HlNetwork): string {
  const base = network === "testnet" ? "https://app.hyperliquid-testnet.xyz" : "https://app.hyperliquid.xyz";
  return `${base}/explorer/address/${addr}`;
}
function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
function usd(n: number): string {
  const a = Math.abs(n);
  return `${n < 0 ? "-" : ""}$${a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function baseCoin(coin: string): string {
  return coin.replace(/-PERP$/i, "").replace(/-USDC$/i, "").toUpperCase();
}
function inUni(coin: string, uni?: Set<string>): boolean {
  return !uni || uni.has(baseCoin(coin));
}

const pnlCls = (n: number) => (n >= 0 ? "text-emerald-400" : "text-red-400");

/** 真实账户总览条(链上)。NAV 做主视觉;未入金/无持仓时盈亏类显示「—」而非噪音 "+$0"。 */
export function EngineStats({ acct, loading }: { acct?: HlAccount; loading: boolean }) {
  const { t } = useTranslation();
  const nav = acct?.accountValue ?? 0;
  const funded = nav > 0;
  // 盈亏类仅在已入金时有意义;否则「—」(避免一堆 +$0 噪音)。
  const pnl = (v: number | undefined) =>
    funded && v != null
      ? { txt: `${v >= 0 ? "+" : ""}${usd(v)}`, cls: pnlCls(v) }
      : { txt: "—", cls: "text-foreground/35" };
  const unreal = pnl(acct?.unrealizedPnl);
  const today = pnl(acct?.todayPnl);

  const sub = (label: string, txt: React.ReactNode, cls: string) => (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-foreground/45 mb-0.5 leading-tight truncate">{label}</p>
      {loading ? <div className="h-4 w-12 rounded bg-white/5 animate-pulse" /> : <p className={cn("text-[14px] font-bold tabular-nums break-all", cls)}>{txt}</p>}
    </div>
  );

  return (
    <div className="glass-panel-strong relative p-4 overflow-hidden">
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Hero:账户净值 */}
      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-wider text-foreground/45 mb-1">{t("engineLive.nav", "账户净值")}</p>
        {loading ? (
          <div className="h-8 w-32 rounded bg-white/5 animate-pulse" />
        ) : (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[28px] leading-none font-extrabold tabular-nums num-gold break-all">{`$${nav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
            {!funded && (
              <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-medium text-amber-300/80">
                {t("engineLive.notFunded", "待入金")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 次级:未实现 / 当日 / 可提 */}
      <div className="relative z-10 mt-3.5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3">
        {sub(t("engineLive.unrealized", "未实现"), unreal.txt, unreal.cls)}
        {sub(t("engineLive.today", "当日盈亏"), today.txt, today.cls)}
        {sub(t("engineLive.withdrawable", "可提"), funded ? usd(acct?.withdrawable ?? 0) : "—", funded ? "text-foreground" : "text-foreground/35")}
      </div>

      {/* 交易账户:真实 HL 地址 + 链上 explorer/address 链接(让用户看清是哪个账户) */}
      {acct?.address && (
        <div className="relative z-10 mt-3 pt-2.5 border-t border-white/[0.06] flex items-center gap-2">
          <span className="text-[10px] text-foreground/45 shrink-0">{t("engineLive.account", "交易账户")}</span>
          <code className="font-mono text-[11px] text-foreground/70 truncate">{shortAddr(acct.address)}</code>
          <a
            href={hlAddr(acct.address, acct.network)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] text-amber-300/80 hover:text-amber-300 active:scale-95 transition"
            data-testid="link-hl-address"
          >
            {t("engineLive.viewOnHl", "在 Hyperliquid 查看")}<ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground/40">
      <Inbox className="h-6 w-6" />
      <p className="text-[11px]">{text}</p>
    </div>
  );
}

/** 真实持仓(链上),按 universe 过滤。 */
export function EnginePositions({ positions, uni, loading }: { positions: HlPosition[]; uni?: Set<string>; loading: boolean }) {
  const { t } = useTranslation();
  const list = positions.filter((p) => inUni(p.coin, uni));
  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />)}</div>;
  if (!list.length) return <Empty text={t("engineLive.noPositions", "当前无持仓(该策略盯盘范围内)")} />;
  return (
    <ul className="space-y-2">
      {list.map((p) => {
        // 收益% = 浮盈 ÷ 下单占用保证金(市值/杠杆)= HL 的 ROE 口径。
        const margin = p.leverage && p.leverage > 0 ? p.positionValue / p.leverage : p.positionValue;
        const roe = margin > 0 ? (p.upnl / margin) * 100 : 0;
        return (
        <li key={p.coin} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0",
              p.side === "LONG" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300")}>
              {p.side === "LONG" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{p.side}
            </span>
            <span className="font-mono text-[13px] font-bold truncate">{baseCoin(p.coin)}</span>
            {p.leverage != null && <span className="text-[10px] text-foreground/45 shrink-0">{p.leverage}x</span>}
            <span className="flex-1 min-w-2" />
            <span className={cn("text-[13px] font-bold tabular-nums shrink-0 text-right", pnlCls(p.upnl))}>{p.upnl >= 0 ? "+" : ""}{usd(p.upnl)}<span className="ml-1 text-[11px] font-mono opacity-90">({roe >= 0 ? "+" : ""}{roe.toFixed(1)}%)</span></span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-foreground/55">
            <span className="flex flex-col gap-0.5 min-w-0">{t("engineLive.size", "数量")} <span className="font-mono text-foreground/80 truncate">{p.size}</span></span>
            <span className="flex flex-col gap-0.5 min-w-0">{t("engineLive.entry", "开仓")} <span className="font-mono text-foreground/80 truncate">{p.entryPx != null ? usd(p.entryPx) : "—"}</span></span>
            <span className="flex flex-col gap-0.5 min-w-0">{t("engineLive.value", "市值")} <span className="font-mono text-foreground/80 truncate">{usd(p.positionValue)}</span></span>
          </div>
        </li>
      );})}
    </ul>
  );
}

/** 真实成交(链上,开/平仓),按 universe 过滤;有 hash → HL explorer/tx 小图标。 */
export function EngineFills({ fills, network, uni, loading }: { fills: HlFillRow[]; network: HlNetwork; uni?: Set<string>; loading: boolean }) {
  const { t } = useTranslation();
  const list = fills.filter((f) => inUni(f.coin, uni));
  if (loading) return <div className="space-y-1.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />)}</div>;
  if (!list.length) return <Empty text={t("engineLive.noFills", "暂无成交记录(该策略盯盘范围内)")} />;
  return (
    <ul className="divide-y divide-white/[0.04]">
      {list.map((f, i) => {
        const d = new Date(f.time);
        const ts = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        return (
          <li key={`${f.hash ?? i}-${i}`} className="flex items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              {/* 第一行:方向 + 币 + 平仓盈亏(盈亏色清晰) */}
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[11px] font-semibold shrink-0", f.isClose ? "text-amber-300/85" : "text-sky-300/90")}>{f.dir}</span>
                <span className="font-mono text-[12px] font-bold truncate">{baseCoin(f.coin)}</span>
                {f.isClose && <span className={cn("ml-auto text-[12px] font-bold tabular-nums shrink-0", pnlCls(f.closedPnl))}>{f.closedPnl >= 0 ? "+" : ""}{usd(f.closedPnl)}</span>}
              </div>
              {/* 第二行:时间 + 数量 @ 价格 */}
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/55">
                <span className="font-mono tabular-nums shrink-0">{ts}</span>
                <span className="font-mono text-foreground/55 truncate">{f.sz} @ {usd(f.px)}</span>
              </div>
            </div>
            {f.hash && (
              <a href={hlTx(f.hash, network)} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 grid h-10 w-10 place-items-center rounded-lg text-muted-foreground/60 hover:text-amber-300 hover:bg-white/5"
                aria-label={t("engineLive.viewOnHl", "在 Hyperliquid 查看")}
                data-testid="link-hl-tx">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
