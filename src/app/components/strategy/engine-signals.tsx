/**
 * EngineSignals — 引擎页「信号」tab。本策略 universe 内的 leader 实时信号(useHlSignals)
 * + 顶部净流向指标(多/空名义额、笔数)。真实 HL 数据。移动端优先 + dark glass。
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TrendingUp, TrendingDown, Inbox } from "lucide-react";
import { useHlSignals } from "@app/lib/engine-hooks";
import type { HlNetwork } from "@app/lib/engine";
import { coinSector, STRATEGY_MARKETS, type StrategyMarket } from "@app/lib/strategy-universe";
import { cn } from "@app/lib/utils";

// 板块 → 短标签 + 配色(信号分类标签 / 筛选 chips 复用)。
const SECTOR_TAG: Record<StrategyMarket, { key: string; fallback: string; cls: string }> = {
  "crypto-trend": { key: "signalSector.crypto", fallback: "加密", cls: "text-amber-300 bg-amber-500/10 border-amber-400/20" },
  "equity-swing": { key: "signalSector.equity", fallback: "美股", cls: "text-sky-300 bg-sky-500/10 border-sky-400/20" },
  "meme-momentum": { key: "signalSector.meme", fallback: "Meme", cls: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-400/20" },
};

function usd(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${Math.round(a / 1_000)}K`;
  return `$${Math.round(a)}`;
}
function baseCoin(c: string): string { return c.replace(/-(PERP|USDC|USD)$/i, "").toUpperCase(); }

interface Sig { id: string; coin: string; side: string; isClose: boolean; notionalUsd: number; px: number; sz: number; happenedAt: string }

export function EngineSignals({ network, universe }: { network: HlNetwork; universe: string[] }) {
  const { t } = useTranslation();
  const { data, isLoading } = useHlSignals(network, { limit: 200 });
  const uni = useMemo(() => new Set(universe.map((s) => s.toUpperCase())), [universe]);
  // 板块筛选(交易员信号分类):全部 / 加密 / 美股 / Meme。
  const [sectorFilter, setSectorFilter] = useState<StrategyMarket | "all">("all");

  // 显示全部 leader 信号(时间倒序,最新在上)。按板块筛选(选中某板块时只看该板块信号);
  // universe 仅做软优先:本策略盯盘币排前,其余照常显示,绝不丢。
  const rows = useMemo<Sig[]>(() => {
    let all = (data?.signals ?? []) as Sig[];
    if (sectorFilter !== "all") all = all.filter((s) => coinSector(s.coin) === sectorFilter);
    if (uni.size === 0) return all.slice(0, 50);
    const inUni = all.filter((s) => uni.has(baseCoin(s.coin)));
    const rest = all.filter((s) => !uni.has(baseCoin(s.coin)));
    return [...inUni, ...rest].slice(0, 50);
  }, [data, uni, sectorFilter]);

  const net = useMemo(() => {
    let long = 0, short = 0;
    for (const s of rows) { if (s.side === "LONG") long += Math.abs(s.notionalUsd); else short += Math.abs(s.notionalUsd); }
    return { long, short, dir: long >= short ? "LONG" : "SHORT" as "LONG" | "SHORT" };
  }, [rows]);

  return (
    <section className="rounded-xl border border-white/[0.06] bg-black/30 overflow-hidden">
      {/* 净流向指标 */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.06] bg-black/20">
        <span className="text-[10px] uppercase tracking-wider text-foreground/45">{t("engineSignals.net", "净流向")}</span>
        <span className={cn("inline-flex items-center gap-1 text-[12px] font-bold", net.dir === "LONG" ? "text-emerald-400" : "text-red-400")}>
          {net.dir === "LONG" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{net.dir}
        </span>
        <span className="ml-auto text-[10px] font-mono text-foreground/55">
          <span className="text-emerald-400/80">{usd(net.long)}</span> / <span className="text-red-400/80">{usd(net.short)}</span>
        </span>
      </div>

      {/* 板块筛选 chips —— 交易员信号分类(全部 / 加密 / 美股 / Meme) */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06] overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setSectorFilter("all")}
          className={cn("shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition active:scale-95",
            sectorFilter === "all" ? "bg-white/10 text-foreground/90 border border-white/15" : "bg-white/[0.03] text-foreground/55 border border-white/[0.06]")}
          data-testid="signal-sector-all"
        >
          {t("signalSector.all", "全部")}
        </button>
        {STRATEGY_MARKETS.map((m) => {
          const tag = SECTOR_TAG[m];
          const active = sectorFilter === m;
          return (
            <button
              key={m}
              onClick={() => setSectorFilter(m)}
              className={cn("shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 border",
                active ? tag.cls : "bg-white/[0.03] text-foreground/55 border-white/[0.06]")}
              data-testid={`signal-sector-${m}`}
            >
              {t(tag.key, tag.fallback)}
            </button>
          );
        })}
      </div>

      <div className="max-h-[55vh] sm:max-h-[460px] overflow-y-auto scrollbar-hide">
        {isLoading && rows.length === 0 ? (
          <div className="p-3 space-y-1.5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-8 rounded bg-white/[0.03] animate-pulse" />)}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/40">
            <Inbox className="h-6 w-6" /><p className="text-[11px]">{t("engineSignals.empty", "该策略盯盘范围内暂无信号")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {rows.map((s) => {
              const long = s.side === "LONG";
              const sec = coinSector(s.coin);
              const d = new Date(s.happenedAt);
              const ts = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
              return (
                <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="font-mono text-[10px] text-muted-foreground/45 tabular-nums shrink-0">{ts}</span>
                  <span className={cn("text-[11px] font-bold shrink-0", long ? "text-emerald-300" : "text-red-300")}>
                    {s.isClose ? t("engineSignals.close", "平仓") : t("engineSignals.open", "开仓")} {s.side}
                  </span>
                  <span className="font-mono text-[11px] font-bold">{baseCoin(s.coin)}</span>
                  {sec && (
                    <span className={cn("shrink-0 rounded border px-1 py-0.5 text-[8.5px] font-semibold leading-none", SECTOR_TAG[sec].cls)}>
                      {t(SECTOR_TAG[sec].key, SECTOR_TAG[sec].fallback)}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-foreground/55 shrink-0">{usd(s.notionalUsd)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export default EngineSignals;
