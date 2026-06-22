/**
 * LeaderWatchlist — 当前顶级交易员正在交易的交易对(live flow)。
 * 数据:useHlSignals 近 24h leader 信号,按 coin 聚合(净方向/笔数/名义额),
 * 按名义额降序,做成横向滚动的 live ticker。真实 HL 数据(无 Binance)。
 *
 * 移动端优先 + dark glass/amber 风格。
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Radio, TrendingUp, TrendingDown } from "lucide-react";
import { useHlSignals } from "@app/lib/engine-hooks";
import type { HlNetwork } from "@app/lib/engine";
import { cn } from "@app/lib/utils";

interface Row { coin: string; net: "LONG" | "SHORT"; notional: number; count: number }

function usd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function LeaderWatchlist({ network }: { network: HlNetwork }) {
  const { t } = useTranslation();
  const { data, isLoading } = useHlSignals(network, { limit: 300 });

  const rows = useMemo<Row[]>(() => {
    const since = Date.now() - 24 * 3600 * 1000;
    const m = new Map<string, { long: number; short: number; notional: number; count: number }>();
    for (const s of (data?.signals ?? []) as Array<{ coin: string; side: string; notionalUsd: number; happenedAt: string }>) {
      if (new Date(s.happenedAt).getTime() < since) continue;
      const coin = s.coin.replace(/-(PERP|USDC|USD)$/i, "").toUpperCase();
      const e = m.get(coin) ?? { long: 0, short: 0, notional: 0, count: 0 };
      if (s.side === "LONG") e.long += s.notionalUsd; else e.short += s.notionalUsd;
      e.notional += Math.abs(s.notionalUsd); e.count += 1;
      m.set(coin, e);
    }
    return [...m.entries()]
      .map(([coin, e]) => ({ coin, net: (e.long >= e.short ? "LONG" : "SHORT") as "LONG" | "SHORT", notional: e.notional, count: e.count }))
      .sort((a, b) => b.notional - a.notional)
      .slice(0, 16);
  }, [data]);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent overflow-hidden">
      <header className="flex items-center gap-2 px-3.5 py-2.5">
        <span className="inline-flex items-center gap-1.5">
          <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-wide text-foreground/90">{t("leaderWatch.title", "顶级交易员动向")}</span>
        </span>
        <span className="text-[10px] text-foreground/40 truncate">{t("leaderWatch.subtitle", "交易员近 24h 在交易的币")}</span>
      </header>

      {isLoading && rows.length === 0 ? (
        <div className="flex gap-2 px-3.5 pb-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 w-24 shrink-0 rounded-xl bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-3.5 pb-3 text-[11px] text-foreground/40">{t("leaderWatch.empty", "暂无近期交易员信号")}</p>
      ) : (
        <div className="flex gap-2 px-3.5 pb-3 overflow-x-auto scrollbar-hide">
          {rows.map((r) => {
            const long = r.net === "LONG";
            return (
              <div
                key={r.coin}
                className={cn(
                  "shrink-0 rounded-xl border px-2.5 py-1.5 min-w-[92px]",
                  long ? "border-emerald-400/20 bg-emerald-500/[0.06]" : "border-red-400/20 bg-red-500/[0.06]",
                )}
              >
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[12px] font-bold text-foreground">{r.coin}</span>
                  {long ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] font-mono">
                  <span className={long ? "text-emerald-400/90" : "text-red-400/90"}>{usd(r.notional)}</span>
                  <span className="text-foreground/35">·</span>
                  <span className="text-foreground/45">{r.count}×</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default LeaderWatchlist;
