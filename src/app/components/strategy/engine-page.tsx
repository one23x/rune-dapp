/**
 * EnginePage — 交易引擎页(/strategy/hl?strategy=<id>)。选定板块策略后的驾驶舱。
 *
 *   header: 策略名 + 暂停 / 切换(都跳回策略页 /strategy/hl;暂停额外 stop-all)
 *   顶部: 链上真实账户总览(EngineStats,useHlAccount —— 不走虚拟账本/admin 覆盖)+ 盯盘币种
 *   tabs: 决策(DecisionLog,按策略 universe 过滤,对话流) · 持仓(链上真实持仓 + 开/平仓成交,
 *         有 hash → HL explorer/tx 详情) · 风险(RiskConsole,真实数) · 记录(AiDecisionCards)
 *   浮窗: AgentChat(带 strategyId,按当前语言回复)
 *
 * 每个策略:盯盘币种不同 → 决策流 / 持仓 / 成交 都按其 universe 过滤,呈现不同。
 * 移动端优先 + dark glass/amber 风格;数据全部真实链上(无虚拟覆盖)。
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useActiveAccount } from "thirdweb/react";
import { ArrowLeft, Pause, Repeat, Activity, Wallet, Shield, MessageSquare, TrendingUp, LineChart, Rocket, Radio } from "lucide-react";
import { useEngineUser, useStopAllCopy, useHlAccount, useHlSignals } from "@app/lib/engine-hooks";
import { useToast } from "@app/hooks/use-toast";
import { cn } from "@app/lib/utils";
import type { HlNetwork } from "@app/lib/engine";
import { DecisionLog } from "./decision-log";
import { RiskConsole } from "./risk-console";
import { AiDecisionCards } from "./ai-decision-cards";
import { AgentChat } from "./agent-chat";
import { EngineStats, EnginePositions, EngineFills } from "./engine-live";
import { useHlStrategyDecisions } from "@app/lib/hl-strategy-feed";
import { EngineFollow } from "./engine-follow";
import { EngineSignals } from "./engine-signals";

const STRAT_META: Record<string, { name: string; budget: number; universe: string[] }> = {
  "crypto-trend": { name: "加密趋势", budget: 10, universe: ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "HYPE"] },
  "equity-swing": { name: "美股摆动", budget: 6, universe: ["NVDA", "AAPL", "TSLA", "MSFT", "META", "AMZN", "GOOGL", "AMD", "MU", "INTC", "MRVL", "ARM", "HOOD", "ORCL", "SPX"] },
  "meme-momentum": { name: "Meme 动量", budget: 6, universe: ["DOGE", "WIF", "KPEPE", "KBONK", "PENGU", "TRUMP", "FARTCOIN", "SPX"] },
};
/** 板块图标(替代 emoji)。 */
const STRAT_ICON: Record<string, typeof Activity> = {
  "crypto-trend": TrendingUp, "equity-swing": LineChart, "meme-momentum": Rocket,
};

type EngineTab = "decision" | "signals" | "positions" | "risk" | "records";

export function EnginePage({ strategyId }: { strategyId: string }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const account = useActiveAccount();
  const wallet = account?.address;
  const network: HlNetwork = "mainnet";

  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  const hlUser = userQ.data as { engineEoaAddress?: string; hlMode?: string; hlMasterAddress?: string } | undefined;
  const agentMode = hlUser?.hlMode === "agent";
  const hlAddress = agentMode ? (hlUser?.hlMasterAddress ?? wallet) : hlUser?.engineEoaAddress;
  // 链上真实账户(useHlAccount:sync 表/直连 HL info)—— 不走虚拟账本 / admin 覆盖。
  const acctQ = useHlAccount(hlAddress, network);
  const acct = acctQ.data;
  const stopAll = useStopAllCopy(userId);
  const signalsQ = useHlSignals(network, { limit: 300 });

  const meta = STRAT_META[strategyId] ?? { name: strategyId, budget: 6, universe: [] };
  const SIcon = STRAT_ICON[strategyId] ?? Activity;
  // 写死列表退化为"板块归属判定"(哪些币属于本策略板块)。
  const sectorSet = useMemo(() => new Set(meta.universe.map((s) => s.toUpperCase())), [strategyId]);
  // 动态盯盘 = 当日(近 24h)交易员实际交易、且属于本板块的币;无则回退板块全集。
  const dynUniverse = useMemo(() => {
    const since = Date.now() - 24 * 3600 * 1000;
    const coins = new Set<string>();
    for (const s of (signalsQ.data?.signals ?? []) as Array<{ coin: string; happenedAt: string }>) {
      if (new Date(s.happenedAt).getTime() < since) continue;
      const base = s.coin.replace(/-(PERP|USDC|USD)$/i, "").toUpperCase();
      if (sectorSet.has(base)) coins.add(base);
    }
    return coins.size ? Array.from(coins) : meta.universe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalsQ.data, sectorSet, strategyId]);
  const uni = useMemo(() => (dynUniverse.length ? new Set(dynUniverse.map((s) => s.toUpperCase())) : undefined), [dynUniverse]);
  const loading = !!wallet && acctQ.isLoading;

  // 客户端 HL 原生决策流(真实 HL K 线 → 规则 → 对话流,无 Binance/403);盯盘币来自当日交易员。
  const { entries: hlDecisions } = useHlStrategyDecisions(strategyId, dynUniverse);

  const [tab, setTab] = useState<EngineTab>("decision");

  function onPause() {
    if (userId) stopAll.mutate(undefined, { onSettled: () => navigate("/strategy/hl") });
    else navigate("/strategy/hl");
    toast({ title: t("engine.paused", "已暂停"), description: t("engine.pausedDesc", "已停止开新仓,返回策略选择。") });
  }
  function onSwitch() {
    navigate("/strategy/hl");
  }

  const TABS: { id: EngineTab; label: string; icon: typeof Activity }[] = [
    { id: "decision", label: t("engine.tabDecision", "决策"), icon: MessageSquare },
    { id: "signals", label: t("engine.tabSignals", "信号"), icon: Radio },
    { id: "positions", label: t("engine.tabPositions", "持仓"), icon: Wallet },
    { id: "risk", label: t("engine.tabRisk", "风险"), icon: Shield },
    { id: "records", label: t("engine.tabRecords", "记录"), icon: Activity },
  ];

  return (
    <div className="min-h-screen pb-28 lg:pb-12">
      {/* header: 策略名 + 暂停 / 切换(窄屏按钮缩成图标,文字 hidden;不挤掉策略名) */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-white/10">
        <div className="px-3 sm:px-4 h-14 flex items-center gap-1.5 sm:gap-2 max-w-2xl mx-auto">
          <Link href="/strategy/hl" data-testid="link-back-pick">
            <button className="shrink-0 w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-foreground/80 hover:bg-white/10 active:scale-95 transition">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="shrink-0 grid h-8 w-8 place-items-center rounded-lg bg-amber-500/12 border border-amber-400/20">
            <SIcon className="h-4 w-4 text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-bold text-foreground truncate tracking-tight">{t(`strategyName.${strategyId}`, meta.name)}</div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate">{t("engine.running", "交易引擎 · 链上实时")}</span>
            </div>
          </div>
          <button
            onClick={onPause}
            disabled={stopAll.isPending}
            className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 h-10 min-w-10 px-2.5 text-[11px] font-semibold text-amber-300 active:scale-95 transition disabled:opacity-50"
            data-testid="button-engine-pause"
            aria-label={t("engine.pause", "暂停")}
          >
            <Pause className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t("engine.pause", "暂停")}</span>
          </button>
          <button
            onClick={onSwitch}
            className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 h-10 min-w-10 px-2.5 text-[11px] font-semibold text-foreground/80 hover:bg-white/10 active:scale-95 transition"
            data-testid="button-engine-switch"
            aria-label={t("engine.switch", "切换")}
          >
            <Repeat className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{t("engine.switch", "切换")}</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto" style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
        {/* 链上真实账户总览 */}
        <EngineStats acct={acct} loading={loading} />

        {/* 盯盘币种(动态:来自当日交易员实际交易 ∩ 本板块);窄屏横向滚动,不撑破布局 */}
        {dynUniverse.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
            <span className="text-[10px] text-foreground/45 shrink-0">{t("engine.watching", "盯盘")}:</span>
            {dynUniverse.map((s) => (
              <span key={s} className="shrink-0 rounded bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-foreground/60">{s}</span>
            ))}
          </div>
        )}

        {/* 开启跟单(真实订阅顶级交易员;入金后即可一键跟) */}
        <EngineFollow userId={userId} network={network} />

        {/* tab 栏(5 等宽;窄屏图标在上、文字在下两行排,触控 ≥44px,不挤) */}
        <div className="flex w-full gap-1 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-1">
          {TABS.map((tb) => {
            const Icon = tb.icon;
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={cn(
                  "flex-1 min-w-0 flex flex-col xs:flex-row items-center justify-center gap-0.5 xs:gap-1 py-2 min-h-[44px] rounded-xl text-[11px] sm:text-[12px] font-bold tracking-tight transition-all",
                  active
                    ? "bg-gradient-to-b from-amber-400 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                    : "text-white/55 hover:text-white/90 hover:bg-white/5",
                )}
                data-testid={`engine-tab-${tb.id}`}
              >
                <Icon className="h-4 w-4 xs:h-3.5 xs:w-3.5 shrink-0" />
                <span className="truncate leading-none">{tb.label}</span>
              </button>
            );
          })}
        </div>

        <div className="min-w-0" style={{ animation: "fadeSlideIn 0.25s ease-out" }}>
          {tab === "decision" && <DecisionLog entries={hlDecisions} symbols={dynUniverse} />}
          {tab === "signals" && <EngineSignals network={network} universe={dynUniverse} />}
          {tab === "positions" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-[11px] font-semibold text-foreground/55 mb-2">{t("engine.holdings", "持仓(链上真实)")}</h4>
                <EnginePositions positions={acct?.positions ?? []} uni={uni} loading={loading} />
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-foreground/55 mb-2">{t("engine.fills", "成交记录 · 开/平仓")}</h4>
                <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3">
                  <EngineFills fills={acct?.recentFills ?? []} network={network} uni={uni} loading={loading} />
                </div>
              </div>
            </div>
          )}
          {tab === "risk" && (
            <RiskConsole
              accountValue={acct?.accountValue ?? 0}
              dayPnl={acct?.todayPnl ?? 0}
              unrealizedPnl={acct?.unrealizedPnl ?? 0}
              dailyLossBudgetPct={meta.budget}
            />
          )}
          {tab === "records" && <AiDecisionCards userId={userId} />}
        </div>
      </div>

      {/* 浮窗:按策略 / 订单与 agent 对话(带 strategyId) */}
      <AgentChat userId={userId} strategyId={strategyId} />
    </div>
  );
}

export default EnginePage;
