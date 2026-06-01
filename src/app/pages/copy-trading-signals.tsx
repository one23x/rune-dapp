/**
 * Smart Copy-Trading — Signals (信号), at /copy-trading/signals.
 * Three sections: leader signals with copy toggle, AI intelligence grid,
 * weekly leaderboard. Uses real engine hooks with seed fallbacks.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, CheckCircle2, Check, TrendingUp, BarChart2, Shield, Zap, Trophy,
} from "lucide-react";
import { useLeaderSignals, useHotMarkets } from "@app/lib/engine-hooks";
import { useToast } from "@app/hooks/use-toast";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { SectionError, asArray, asNumber } from "@app/components/copy-trading/shared";

interface LeaderSignal {
  id: string;
  name: string;
  initials: string;
  colorClass: string;
  direction: "BUY" | "SELL";
  question: string;
  score: string;
  timeAgo: string;
  category: string;
}

const SEED_LEADER_SIGNALS: LeaderSignal[] = [
  { id: "ls-1", name: "CryptoLeader Alpha", initials: "CA", colorClass: "bg-blue-500/20 text-blue-400", direction: "BUY", question: "Bitcoin > $150K by 2026?", score: "87%", timeAgo: "3m", category: "Crypto" },
  { id: "ls-2", name: "AI Oracle Bot", initials: "AO", colorClass: "bg-purple-500/20 text-purple-400", direction: "SELL", question: "Fed rate cut before July?", score: "72%", timeAgo: "11m", category: "Macro" },
  { id: "ls-3", name: "NewsArb Pro", initials: "NP", colorClass: "bg-emerald-500/20 text-emerald-400", direction: "BUY", question: "Ethereum ETF AUM > $10B?", score: "91%", timeAgo: "28m", category: "Crypto" },
  { id: "ls-4", name: "DeFi Maximalist", initials: "DM", colorClass: "bg-amber-500/20 text-amber-400", direction: "BUY", question: "Solana flips ETH in DEX vol?", score: "64%", timeAgo: "1h", category: "DeFi" },
];

const AI_INTELLIGENCE = [
  { icon: TrendingUp, iconColor: "text-emerald-500", title: "动量突破", desc: "BTC链上资金流入连续3日正向，看涨信号强烈", score: 82 },
  { icon: BarChart2, iconColor: "text-blue-500", title: "情绪指标", desc: "市场恐慌指数降至38，历史底部区间", score: 76 },
  { icon: Shield, iconColor: "text-amber-500", title: "风险预警", desc: "ETH期权隐含波动率上升，注意仓位风险", score: 68 },
  { icon: Zap, iconColor: "text-purple-500", title: "套利机会", desc: "Polymarket vs Kalshi价差扩大，跨平台套利窗口", score: 91 },
];

const LEADERBOARD = [
  { rank: 1, name: "CryptoLeader Alpha", initials: "CA", colorClass: "bg-blue-500/20 text-blue-400", score: "9.8", pnl: "+34.2%", width: "98%" },
  { rank: 2, name: "NewsArb Pro", initials: "NP", colorClass: "bg-emerald-500/20 text-emerald-400", score: "9.4", pnl: "+28.7%", width: "94%" },
  { rank: 3, name: "AI Oracle Bot", initials: "AO", colorClass: "bg-purple-500/20 text-purple-400", score: "8.9", pnl: "+21.3%", width: "89%" },
  { rank: 4, name: "DeFi Maximalist", initials: "DM", colorClass: "bg-amber-500/20 text-amber-400", score: "8.2", pnl: "+15.8%", width: "82%" },
  { rank: 5, name: "Momentum Trader", initials: "MT", colorClass: "bg-rose-500/20 text-rose-400", score: "7.6", pnl: "+9.4%", width: "76%" },
];

function directionFromRaw(raw: any): "BUY" | "SELL" {
  const d = String(raw?.direction ?? raw?.side ?? raw?.outcome ?? raw?.vote ?? raw?.signal ?? "").toUpperCase();
  if (d.includes("BULL") || d === "BUY" || d === "YES" || d === "UP" || d === "LONG") return "BUY";
  return "SELL";
}

function scoreFromRaw(raw: any): number {
  const s = raw?.score ?? raw?.confidence ?? raw?.weight ?? raw?.consensus ?? raw?.strength;
  const n = asNumber(s);
  return n > 1 ? Math.round(n) : Math.round(n * 100);
}

export default function CopyTradingSignalsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [followed, setFollowed] = useState<Record<string, boolean>>({
    "CryptoLeader Alpha": true,
    "NewsArb Pro": true,
  });

  const leadersQ = useLeaderSignals();
  const hotQ = useHotMarkets();

  const leaderSignals = useMemo<LeaderSignal[]>(() => {
    const raw = asArray(leadersQ.data);
    if (raw.length === 0) return SEED_LEADER_SIGNALS;
    return raw.map((r: any, i: number) => ({
      id: String(r?.id ?? r?.marketId ?? i),
      name: String(r?.leader ?? r?.leaderName ?? r?.name ?? `Leader ${i + 1}`),
      initials: String(r?.leader ?? "L").slice(0, 2).toUpperCase(),
      colorClass: ["bg-blue-500/20 text-blue-400", "bg-purple-500/20 text-purple-400", "bg-emerald-500/20 text-emerald-400", "bg-amber-500/20 text-amber-400"][i % 4],
      direction: directionFromRaw(r),
      question: String(r?.question ?? r?.market ?? r?.title ?? r?.marketId ?? "—"),
      score: `${scoreFromRaw(r) || 75}%`,
      timeAgo: "now",
      category: String(r?.category ?? "Crypto"),
    }));
  }, [leadersQ.data]);

  const toggleFollow = (name: string) => {
    setFollowed(prev => {
      const next = { ...prev, [name]: !prev[name] };
      if (!prev[name]) {
        toast({ title: t("copyTrading.copyStarted", "跟单已开启"), description: name });
      } else {
        toast({ title: t("copyTrading.copyStopped", "跟单已停止"), description: name });
      }
      return next;
    });
  };

  const lastUpdate = useMemo(() => {
    const now = new Date();
    return `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  }, []);

  return (
    <CopyTradingLayout title={t("copyTrading.signalsTitle", "Signals")}>
      <div className="space-y-5">

        {/* ── Section 1: Leader Signals ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-2">
              <h2 className="text-[15px] font-bold text-foreground tracking-wide">
                {t("copyTrading.leaderSignalsTitle", "跟单交易员信号")}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-0.5 rounded-full"
              style={{ background: "rgba(21,18,13,1)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t("copyTrading.updatedAt", { time: lastUpdate }, `Updated ${lastUpdate}`)}
            </div>
          </div>

          {leadersQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : leadersQ.isError ? (
            <SectionError onRetry={() => leadersQ.refetch()} />
          ) : (
            <div className="space-y-2">
              {leaderSignals.map(s => (
                <div key={s.id} className="rounded-xl p-3 flex flex-col gap-2.5"
                  style={{ background: "rgba(21,18,13,1)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.colorClass}`}>
                        {s.initials}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[13px] font-medium text-foreground truncate">{s.name}</span>
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            s.direction === "BUY"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>
                            {s.direction}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate">{s.question}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[13px] font-bold text-amber-500">{s.score}</span>
                      <span className="text-[10px] text-muted-foreground">{s.timeAgo}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                    <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      #{s.category}
                    </span>
                    {followed[s.name] ? (
                      <button onClick={() => toggleFollow(s.name)}
                        className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 px-2.5 py-1 rounded-lg"
                        style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                        <Check className="h-3 w-3" />
                        {t("copyTrading.following", "已复制")}
                      </button>
                    ) : (
                      <button onClick={() => toggleFollow(s.name)}
                        className="text-[11px] font-bold text-black px-3 py-1 rounded-lg transition-colors hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                        {t("copyTrading.follow", "跟单")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 2: AI Intelligence Grid ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="text-[15px] font-bold text-foreground tracking-wide">
              {t("copyTrading.aiIntelligenceTitle", "智能决策")}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {AI_INTELLIGENCE.map((d, i) => (
              <div key={i} className="rounded-xl p-3 flex flex-col justify-between"
                style={{ background: "rgba(21,18,13,1)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <d.icon className={`h-3.5 w-3.5 ${d.iconColor}`} />
                    <span className="text-[12px] font-bold text-foreground">{d.title}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight mb-3 line-clamp-2">{d.desc}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{t("copyTrading.signalScore", "Score")}</span>
                    <span className="font-bold text-amber-500">{d.score}%</span>
                  </div>
                  <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.5)" }}>
                    <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: "linear-gradient(90deg, #f59e0b, #d97706)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: Weekly Leaderboard ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-l-2 border-amber-500 pl-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="text-[15px] font-bold text-foreground tracking-wide">
                {t("copyTrading.leaderboardTitle", "持仓评分榜")}
              </h2>
            </div>
            <span className="text-[10px] text-amber-500/80 px-2 py-0.5 rounded"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
              {t("copyTrading.weeklyRank", "本周排行")}
            </span>
          </div>

          {hotQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : (
            <div className="space-y-2">
              {LEADERBOARD.map((l, i) => (
                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                  l.rank === 1 ? "border-amber-500/20" : "border-white/[0.04]"
                }`}
                  style={{ background: l.rank === 1 ? "rgba(245,158,11,0.05)" : "rgba(21,18,13,1)" }}>
                  <div className={`w-5 text-center text-[13px] font-bold ${
                    l.rank === 1 ? "text-amber-500" :
                    l.rank === 2 ? "text-foreground/60" :
                    l.rank === 3 ? "text-amber-700" : "text-muted-foreground"
                  }`}>
                    {l.rank === 1 ? "🥇" : l.rank}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${l.colorClass}`}>
                      {l.initials}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-foreground truncate">{l.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="h-1 max-w-[80px] flex-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.5)" }}>
                          <div className="h-full rounded-full" style={{ width: l.width, background: "linear-gradient(90deg, #f59e0b, #d97706)" }} />
                        </div>
                        <span className="text-[10px] font-bold text-amber-500">{l.score}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[13px] font-bold text-emerald-400 shrink-0">{l.pnl}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </CopyTradingLayout>
  );
}
