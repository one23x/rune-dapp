/**
 * EngineConsole — 策略向导的最终「数据台」步骤。
 *
 *   顶部余额条:账户净值(num-gold 主视觉)+ 未实现 / 当日 小字 + 暂停跟单按钮;
 *               下方横向滚动「持仓币 chips」(来自 acct.positions 的 base 币)。
 *   三栏日志网格(窄屏堆叠):信号流 / 持仓·订单历史 / 风控台。
 *   底部「智能对话」按钮 → Dialog 内嵌 DecisionLog。
 *
 * 数据全部真实链上(useHlAccount 传入的 acct);盯盘币种动态来自当日(近 24h)
 * 交易员实际交易 ∩ 本策略板块。移动端优先 + dark glass / amber 风格。
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Pause, Radio, Shield, MessageSquare, BarChart3, Layers, RefreshCw } from "lucide-react";
import { useHlSignals, useStopAllCopy, useHlCopyDecisions } from "@app/lib/engine-hooks";
import { fetchFearGreedHistory } from "@app/lib/api";
import { useHlStrategyDecisions } from "@app/lib/hl-strategy-feed";
import { useDecisionLog } from "@app/lib/decision-log-hooks";
import type { HlAccount, HlNetwork } from "@app/lib/engine";
import { cn } from "@app/lib/utils";
import { EngineSignals } from "./engine-signals";
import { RiskConsole } from "./risk-console";
import { ActionsLog } from "./actions-log";
import { PerformancePanel } from "./performance-panel";
import { AgentChat } from "./agent-chat";

const STRAT_META: Record<string, { name: string; budget: number; universe: string[] }> = {
  "crypto-trend": { name: "加密趋势", budget: 10, universe: ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "HYPE"] },
  "equity-swing": { name: "美股摆动", budget: 6, universe: ["NVDA", "AAPL", "TSLA", "MSFT", "META", "AMZN", "GOOGL", "AMD", "MU", "INTC", "MRVL", "ARM", "HOOD", "ORCL", "SPX"] },
  "meme-momentum": { name: "Meme 动量", budget: 6, universe: ["DOGE", "WIF", "KPEPE", "KBONK", "PENGU", "TRUMP", "FARTCOIN", "SPX"] },
};

function baseCoin(c: string): string {
  return c.replace(/-(PERP|USDC|USD)$/i, "").toUpperCase();
}
function usd(n: number): string {
  const a = Math.abs(n);
  return `${n < 0 ? "-" : ""}$${a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 全局加密 F&G(恐慌贪婪)指数 —— 与服务端「情绪门控」用的是同一个 GLOBAL 值。
 * 首选:本用户 copy-decisions 里携带的 `scope:'global'` sentiment(EXACT 门控值,
 *       如 value≈23 / extreme_fear);该值就是决定「极度恐慌挡做多」的那个数。
 * 兜底:当还没有携带 global 的决策时(无 userId / 决策流为空),回退到 alternative.me
 *       全局 BTC F&G(fetchFearGreedHistory("BTC").current,与门控上游同源)。
 * 注意:这是 GLOBAL 市场情绪,**不是**任何单币的 per-coin F&G。
 */
function useGlobalFearGreed(userId?: string): { value: number; label: string } | null {
  const decisionsQ = useHlCopyDecisions(userId);
  // 兜底全局 F&G(仅在 decisions 没给出 global 时才真正被用到;query 始终挂载但极少刷新)。
  const fallbackQ = useQuery({
    queryKey: ["global-fear-greed", "BTC"],
    queryFn: () => fetchFearGreedHistory("BTC"),
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  return useMemo(() => {
    // 1) 首选 — 最近一条带 scope:'global' 的决策(门控同源值)。
    const decisions = decisionsQ.data?.decisions ?? [];
    for (const d of decisions) {
      const g = (d.sentiment ?? []).find((s) => s.scope === "global" && Number.isFinite(s.value));
      if (g) return { value: Math.round(g.value), label: g.classification || g.mood || "" };
    }
    // 2) 兜底 — alternative.me 全局 F&G。
    const cur = fallbackQ.data?.current;
    if (cur && Number.isFinite(cur.value)) return { value: Math.round(cur.value), label: cur.label || "" };
    return null;
  }, [decisionsQ.data, fallbackQ.data]);
}

export function EngineConsole({ userId, strategyId, network, acct, loading, onSwitchStrategy }: {
  userId?: string;
  strategyId: string;
  network: HlNetwork;
  acct?: HlAccount;
  loading: boolean;
  onSwitchStrategy?: () => void;
}) {
  const { t } = useTranslation();
  const stopAll = useStopAllCopy(userId);
  const signalsQ = useHlSignals(network, { limit: 300 });
  const meta = STRAT_META[strategyId] ?? { name: strategyId, budget: 6, universe: [] };

  // 本策略板块币集合(仅用于在动态盯盘里把板块币排前,不再用来过滤掉其它币)。
  const sectorSet = useMemo(() => new Set(meta.universe.map((s) => s.toUpperCase())), [strategyId]); // eslint-disable-line react-hooks/exhaustive-deps
  // 动态盯盘 = 近 24h 交易员**实际交易**的币(按笔数排序;本板块币优先靠前)。
  // 不再与板块写死列表取交集(活跃 leader 常交易板块外的币,交集会把信号几乎全过滤掉)。
  const dynUniverse = useMemo(() => {
    const since = Date.now() - 24 * 3600 * 1000;
    const counts = new Map<string, number>();
    for (const s of (signalsQ.data?.signals ?? []) as Array<{ coin: string; happenedAt: string }>) {
      if (new Date(s.happenedAt).getTime() < since) continue;
      const base = baseCoin(s.coin);
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    const ranked = [...counts.entries()]
      .sort((a, b) => (sectorSet.has(b[0]) ? 1 : 0) - (sectorSet.has(a[0]) ? 1 : 0) || b[1] - a[1])
      .map(([c]) => c);
    return ranked.length ? ranked.slice(0, 12) : meta.universe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalsQ.data, sectorSet, strategyId]);

  // 客户端 HL 原生决策流(真实 HL K 线 → 规则 → 对话流);盯盘币来自当日交易员。
  const { entries: hlDecisions } = useHlStrategyDecisions(strategyId, dynUniverse);

  // 真实执行器决策流(ai_console_logs):含「跳过开仓 · 恐慌挡多」/止损 等真实事件。
  // 与客户端规则 setup 合并喂进 ActionsLog,真实 skip-open 才能显式出现。
  const { entries: realDecisions } = useDecisionLog();
  const actionEntries = useMemo(
    () => [...realDecisions, ...hlDecisions],
    [realDecisions, hlDecisions],
  );

  // 全局 F&G(门控同源)→ 钉在 ActionsLog「风险」tab 顶部。
  const fearGreed = useGlobalFearGreed(userId);

  // 日志面板:Actions(交易/风险/留意)/ 表现 / 风控 可切换(放在信号流上面)。
  const [logTab, setLogTab] = useState<"actions" | "performance" | "risk">("actions");

  const nav = acct?.accountValue ?? 0;
  const funded = nav > 0;
  const heldCoins = useMemo(() => {
    const set = new Set<string>();
    for (const p of acct?.positions ?? []) set.add(baseCoin(p.coin));
    return Array.from(set);
  }, [acct?.positions]);

  // 盈亏类仅在已入金时有意义;否则「—」。
  const pnlTxt = (v: number | undefined) =>
    funded && v != null ? `${v >= 0 ? "+" : ""}${usd(v)}` : "—";
  const pnlCls = (v: number | undefined) =>
    funded && v != null ? (v >= 0 ? "text-emerald-400" : "text-red-400") : "text-foreground/35";

  return (
    <div className="space-y-3">
      {/* 0. 当前策略市场 + 切换(单选:一次只跟一个板块) */}
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2">
        <Layers className="h-3.5 w-3.5 text-amber-300 shrink-0" />
        <span className="text-[10px] uppercase tracking-wider text-foreground/45 shrink-0">{t("console.market", "策略市场")}</span>
        <span className="text-[12px] font-bold text-foreground/90 truncate">{t(`strategyName.${strategyId}`, meta.name)}</span>
        {onSwitchStrategy && (
          <button
            onClick={onSwitchStrategy}
            className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-foreground/70 active:scale-95 transition hover:text-foreground/90 hover:border-white/20"
            data-testid="button-switch-strategy"
          >
            <RefreshCw className="h-3 w-3" />{t("console.switchStrategy", "切换策略")}
          </button>
        )}
      </div>

      {/* 1. 顶部余额条 */}
      <section className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-foreground/45 mb-1">{t("console.balance", "余额")}</p>
            {loading ? (
              <div className="h-8 w-32 rounded bg-white/5 animate-pulse" />
            ) : (
              <p className="text-[28px] leading-none font-extrabold tabular-nums num-gold break-all">{funded ? `$${nav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</p>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-[11px] text-foreground/55">
                {t("console.unrealized", "未实现")} <span className={cn("font-mono font-bold tabular-nums", pnlCls(acct?.unrealizedPnl))}>{pnlTxt(acct?.unrealizedPnl)}</span>
              </span>
              <span className="text-[11px] text-foreground/55">
                {t("console.dayPnl", "当日")} <span className={cn("font-mono font-bold tabular-nums", pnlCls(acct?.todayPnl))}>{pnlTxt(acct?.todayPnl)}</span>
              </span>
            </div>
          </div>
          <button
            onClick={() => stopAll.mutate(undefined)}
            disabled={stopAll.isPending}
            className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 h-10 px-3 text-[11px] font-semibold text-amber-300 active:scale-95 transition disabled:opacity-50"
            data-testid="button-console-pause"
          >
            <Pause className="h-4 w-4 shrink-0" /><span>{t("console.pause", "暂停跟单")}</span>
          </button>
        </div>

        {/* 持仓币 chips(横向滚动) */}
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
            <span className="text-[10px] text-foreground/45 shrink-0">{t("console.held", "持仓币")}:</span>
            {heldCoins.length === 0 ? (
              <span className="text-[10px] text-foreground/40 shrink-0">{t("console.noHeld", "暂无持仓")}</span>
            ) : (
              heldCoins.map((c) => (
                <span key={c} className="shrink-0 rounded bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-foreground/60">{c}</span>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 小符 AI —— 固定内联按钮(放在 logs 面板上方,非浮窗;点开聊天面板) */}
      <AgentChat userId={userId} strategyId={strategyId} inline />

      {/* 2. 日志面板(决策日志 ↔ 风控 可切换)—— 放在信号流上面,内联展示。 */}
      <section className="rounded-2xl border border-white/[0.06] bg-black/30 overflow-hidden">
        <header className="flex items-center gap-1 px-2 py-2 border-b border-white/[0.06] bg-black/20 overflow-x-auto scrollbar-hide">
          {([
            { id: "actions", icon: MessageSquare, label: t("console.tabActions", "Actions") },
            { id: "performance", icon: BarChart3, label: t("console.tabPerformance", "表现") },
            { id: "risk", icon: Shield, label: t("console.colRisk", "风控台") },
          ] as const).map((tb) => {
            const active = logTab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setLogTab(tb.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition active:scale-95",
                  active
                    ? "bg-gradient-to-b from-amber-400 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                    : "text-white/55 hover:text-white/90 hover:bg-white/5",
                )}
                data-testid={`console-logtab-${tb.id}`}
              >
                <tb.icon className="h-3.5 w-3.5 shrink-0" />{tb.label}
              </button>
            );
          })}
        </header>
        <div className="p-2" style={{ animation: "fadeSlideIn 0.2s ease-out" }}>
          {logTab === "actions" ? (
            <ActionsLog entries={actionEntries} fills={acct?.recentFills ?? []} positions={acct?.positions ?? []} network={network} fearGreed={fearGreed} />
          ) : logTab === "performance" ? (
            <PerformancePanel userId={userId} acct={acct} network={network} universe={dynUniverse} entries={hlDecisions} />
          ) : (
            <RiskConsole
              accountValue={acct?.accountValue ?? 0}
              dayPnl={acct?.todayPnl ?? 0}
              unrealizedPnl={acct?.unrealizedPnl ?? 0}
              dailyLossBudgetPct={meta.budget}
            />
          )}
        </div>
      </section>

      {/* 3. 信号流(持仓·订单/历史 已移除 —— 与上方 logs 面板的「表现」重复) */}
      <section className="rounded-2xl border border-white/[0.06] bg-black/30 overflow-hidden">
        <header className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-black/20">
          <Radio className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <h3 className="text-xs font-semibold truncate">{t("console.colSignals", "信号流")}</h3>
        </header>
        <div className="p-2">
          <EngineSignals network={network} universe={dynUniverse} />
        </div>
      </section>

    </div>
  );
}

export default EngineConsole;
