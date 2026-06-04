/**
 * Smart Copy-Trading — Signals (信号), at /copy-trading/signals.
 * Three sections: leader signals with copy toggle, hot-market intelligence grid,
 * leaderboard. All data comes from the live engine — no mock/seed fallbacks.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, CheckCircle2, TrendingUp, BarChart2, Shield, Zap, Trophy,
} from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLeaderSignals, useHotMarkets, useLeaders, useEngineUser, useCopySubs } from "@app/lib/engine-hooks";
import { copySubscriptions } from "@app/lib/engine";
import { useToast } from "@app/hooks/use-toast";

const isAddr = (v: unknown): v is string => typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);
const extractWallet = (r: any): string | null => {
  const w = r?.wallet ?? r?.address ?? r?.leaderWallet ?? r?.leader;
  return isAddr(w) ? w : null;
};
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { SectionError, SectionEmpty, asArray, asNumber } from "@app/components/copy-trading/shared";

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

// Presentation-only palettes (avatar colors / icon set) applied by index — these
// are styling, not data. All textual/numeric content is engine-derived below.
const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-amber-500/20 text-amber-400",
  "bg-rose-500/20 text-rose-400",
];
const INTEL_ICONS = [
  { icon: TrendingUp, iconColor: "text-emerald-500" },
  { icon: BarChart2, iconColor: "text-blue-500" },
  { icon: Shield, iconColor: "text-amber-500" },
  { icon: Zap, iconColor: "text-purple-500" },
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

  const leadersQ = useLeaderSignals();
  const hotQ = useHotMarkets();
  const leaderboardQ = useLeaders("7d");

  // Real copy-trade follow (leaderboard rows carry a 0x wallet; leader SIGNALS are
  // market-consensus = no single wallet, so the signal-card toggle stays cosmetic).
  const account = useActiveAccount();
  const userQ = useEngineUser(account?.address);
  const userId: string | undefined = userQ.data?.id as string | undefined;
  const copySubsQ = useCopySubs(userId);
  const qc = useQueryClient();
  // lower(leaderWallet) -> subscription id, from real subs.
  const subByWallet = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of asArray(copySubsQ.data?.subscriptions ?? copySubsQ.data)) {
      const w = (s as any)?.leaderWallet;
      if (isAddr(w) && (s as any)?.status !== "stopped") m.set(w.toLowerCase(), String((s as any).id));
    }
    return m;
  }, [copySubsQ.data]);

  const followMut = useMutation({
    mutationFn: async ({ wallet, on }: { wallet: string; on: boolean }) => {
      if (!userId) throw new Error("not_connected");
      if (on) return copySubscriptions.create(userId, { leaderWallet: wallet });
      const id = subByWallet.get(wallet.toLowerCase());
      if (!id) return;
      return copySubscriptions.delete(userId, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engine", "copy-subs", userId] }),
    onError: (e: any) =>
      toast({ title: t("copyTrading.followFailed", "操作失败"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  async function followWallet(wallet: string) {
    if (!account?.address) { toast({ title: t("copyTrading.connectToFollow", "请先连接钱包") }); return; }
    const on = !subByWallet.has(wallet.toLowerCase());
    await followMut.mutateAsync({ wallet, on });
    toast({ title: on ? t("copyTrading.copyStarted", "跟单已开启") : t("copyTrading.copyStopped", "跟单已停止"), description: `${wallet.slice(0, 6)}…${wallet.slice(-4)}` });
  }

  const leaderSignals = useMemo<LeaderSignal[]>(() => {
    return asArray(leadersQ.data).map((r: any, i: number) => ({
      id: String(r?.id ?? r?.marketId ?? i),
      name: String(r?.leader ?? r?.leaderName ?? r?.name ?? `Leader ${i + 1}`),
      initials: String(r?.leader ?? r?.leaderName ?? r?.name ?? "L").slice(0, 2).toUpperCase(),
      colorClass: AVATAR_COLORS[i % AVATAR_COLORS.length],
      direction: directionFromRaw(r),
      question: String(r?.question ?? r?.market ?? r?.title ?? r?.marketId ?? "—"),
      score: scoreFromRaw(r) > 0 ? `${scoreFromRaw(r)}%` : "—",
      timeAgo: "now",
      category: String(r?.category ?? "Crypto"),
    }));
  }, [leadersQ.data]);

  // Section 2 — hot Polymarket markets surfaced as "intelligence" cards (real).
  const intelligence = useMemo(() => {
    return asArray(hotQ.data).slice(0, 4).map((m: any, i: number) => {
      const title = String(m?.question ?? m?.title ?? m?.market ?? m?.name ?? `Market ${i + 1}`);
      const prob = asNumber(m?.probability ?? m?.prob ?? m?.yesPrice ?? m?.price);
      const score = scoreFromRaw(m) || (prob > 0 ? Math.round(prob > 1 ? prob : prob * 100) : 0);
      const vol = asNumber(m?.volume ?? m?.volume24h ?? m?.liquidity ?? m?.totalVolume);
      return {
        ...INTEL_ICONS[i % INTEL_ICONS.length],
        title: title.length > 22 ? `${title.slice(0, 22)}…` : title,
        desc: vol > 0 ? `${t("copyTrading.volume", "成交量")} $${Math.round(vol).toLocaleString()}` : String(m?.category ?? title),
        score,
      };
    });
  }, [hotQ.data, t]);

  // Section 3 — top traders leaderboard (real).
  const leaderboard = useMemo(() => {
    const raw = asArray(leaderboardQ.data);
    const scores = raw.map((r: any) => asNumber(r?.score ?? r?.rating ?? r?.winRate ?? r?.pnlPct));
    const maxScore = Math.max(1, ...scores);
    return raw.slice(0, 5).map((r: any, i: number) => {
      const name = String(r?.leader ?? r?.name ?? r?.handle ?? r?.address ?? `Trader ${i + 1}`);
      const score = asNumber(r?.score ?? r?.rating ?? r?.winRate);
      const pnlPct = asNumber(r?.pnlPct ?? r?.roi ?? r?.return7d ?? r?.return ?? r?.pnl);
      return {
        rank: i + 1,
        name: name.length > 18 ? `${name.slice(0, 18)}…` : name,
        initials: name.slice(0, 2).toUpperCase(),
        colorClass: AVATAR_COLORS[i % AVATAR_COLORS.length],
        score: score > 0 ? score.toFixed(1) : "—",
        pnl: pnlPct,
        width: `${Math.min(100, Math.max(6, (score / maxScore) * 100))}%`,
        wallet: extractWallet(r),
      };
    });
  }, [leaderboardQ.data]);

  // NOTE: leader SIGNALS are market-consensus (no single 0x wallet to follow),
  // so the per-signal-card 跟单 button used to be cosmetic (local-state + toast,
  // no network). It was removed to avoid implying a copy-trade that never fired.
  // Real follow remains on the leaderboard rows below (they carry a 0x wallet →
  // copySubscriptions.create, via `followWallet`).

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
          ) : leaderSignals.length === 0 ? (
            <SectionEmpty icon={Activity} title={t("copyTrading.noSignals", "暂无信号")} desc={t("copyTrading.noSignalsDesc", "交易员信号将在此实时显示")} />
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
                    {/* Per-signal follow removed: a market-consensus signal has no
                        single wallet to copy. Real copy-trade lives on the
                        leaderboard rows below (followWallet → copySubscriptions). */}
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

          {hotQ.isLoading ? (
            <div className="grid grid-cols-2 gap-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          ) : hotQ.isError ? (
            <SectionError onRetry={() => hotQ.refetch()} />
          ) : intelligence.length === 0 ? (
            <SectionEmpty icon={Zap} title={t("copyTrading.noIntelligence", "暂无市场情报")} desc={t("copyTrading.noIntelligenceDesc", "热门市场数据将在此显示")} />
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {intelligence.map((d, i) => (
                <div key={i} className="rounded-xl p-3 flex flex-col justify-between"
                  style={{ background: "rgba(21,18,13,1)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <d.icon className={`h-3.5 w-3.5 ${d.iconColor}`} />
                      <span className="text-[12px] font-bold text-foreground line-clamp-1">{d.title}</span>
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
          )}
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

          {leaderboardQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : leaderboardQ.isError ? (
            <SectionError onRetry={() => leaderboardQ.refetch()} />
          ) : leaderboard.length === 0 ? (
            <SectionEmpty icon={Trophy} title={t("copyTrading.noLeaderboard", "暂无排行")} desc={t("copyTrading.noLeaderboardDesc", "顶级交易员排行将在此显示")} />
          ) : (
            <div className="space-y-2">
              {leaderboard.map((l, i) => (
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
                  <div className={`text-[13px] font-bold shrink-0 ${l.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {l.pnl >= 0 ? "+" : ""}{l.pnl.toFixed(1)}%
                  </div>
                  {l.wallet && (() => {
                    const isFollowing = subByWallet.has(l.wallet.toLowerCase());
                    return (
                      <button
                        onClick={() => followWallet(l.wallet!)}
                        disabled={followMut.isPending || !account?.address}
                        title={!account?.address ? t("copyTrading.connectToFollow", "请先连接钱包") : undefined}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 transition-colors disabled:opacity-40 ${
                          isFollowing
                            ? "text-emerald-400 border border-emerald-500/25 bg-emerald-500/10"
                            : "text-black bg-gradient-to-br from-amber-500 to-amber-600 hover:opacity-90"
                        }`}
                      >
                        {isFollowing ? t("copyTrading.following", "已跟单") : t("copyTrading.follow", "跟单")}
                      </button>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </CopyTradingLayout>
  );
}
