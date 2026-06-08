/**
 * Smart Copy-Trading — Strategy (策略跟单), at /copy-trading/auto.
 *
 * New flow (执行器自带 sizing): pick a 跟单风格(执行器:镜像/稳健/激进/智能)→ pick a 交易员
 * (leader) → ONE click follows via copySubscriptions.create. The frontend sends ONLY
 * { leader, executorId } — NO ratio/cap/preset/riskPreset — the backend applies sizing
 * (base ratio / per-trade / daily / leverage + gating) by executorId. The old「策略包」
 * (preset/riskPreset) selection layer is removed. Active subscriptions list with a stop
 * control. No mock data: status/stats derive from real orders & subs.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Zap, Check, Loader2, Crown, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@app/lib/utils";
import { useToast } from "@app/hooks/use-toast";
import { queryClient } from "@app/lib/queryClient";
import { useEngineUser, useCopySubs } from "@app/lib/engine-hooks";
import { useWalletDailyHistory, numOrZero } from "@app/lib/trading-stats-hooks";
import { useActiveAccount as useAcct2 } from "thirdweb/react";
import { copySubscriptions, signals } from "@app/lib/engine";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { CopyGate, asArray, fmtUsd } from "@app/components/copy-trading/shared";

// ─── 执行器(跟单风格)— mirror|steady|aggressive|smart(默认 mirror)──────────────
// 与 HL 端、后端 hl-executors EXECUTOR_IDS 对齐。后端按 executorId 套 sizing,前端只传 id。
type PmExecutorId = "mirror" | "steady" | "aggressive" | "smart";
type ExecutorMeta = { id: PmExecutorId; emoji: string; label: string; blurb: string };
const PM_EXECUTORS: ExecutorMeta[] = [
  { id: "mirror",     emoji: "🪞", label: "镜像 Mirror",     blurb: "原样跟随交易员,最快进场(默认)" },
  { id: "steady",     emoji: "🛡", label: "稳健 Steady",     blurb: "小仓位·只跟顶级交易员" },
  { id: "aggressive", emoji: "🔥", label: "激进 Aggressive", blurb: "大仓位·广撒网" },
  { id: "smart",      emoji: "🤖", label: "智能 Smart",      blurb: "只在 AI 看好时精选出手" },
];

function ExecutorPicker({
  value, onChange, disabled = false,
}: { value: PmExecutorId; onChange: (id: PmExecutorId) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] font-semibold text-foreground/70">{t("hl.executorTitle", "执行风格")}</span>
        <span className="text-[10px] text-foreground/40">· {t("hl.executorHint", "决定如何替你执行跟单")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PM_EXECUTORS.map((e) => {
          const on = value === e.id;
          return (
            <button
              key={e.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(e.id)}
              data-testid={`button-executor-${e.id}`}
              className={cn(
                "text-left rounded-xl px-3 py-2.5 border transition-all active:scale-[0.99] disabled:opacity-50",
                on
                  ? "bg-primary/10 border-primary/30 text-foreground"
                  : "bg-white/[0.02] border-white/[0.06] text-foreground/55 hover:border-white/15",
              )}
            >
              <div className="flex items-center gap-1.5 text-[13px] font-bold">
                <span>{e.emoji}</span>
                <span>{t(`hl.executor.${e.id}.label`, e.label)}</span>
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-foreground/40">{t(`hl.executor.${e.id}.blurb`, e.blurb)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 候选交易员一行(来自 leaderboard)。followed → 「已跟单」;否则一键跟单。
function LeaderRow({
  wallet, label, followed, busy, onFollow,
}: { wallet: string; label: string; followed: boolean; busy: boolean; onFollow: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="premium-card rounded-xl p-3 flex items-center justify-between gap-3"
      style={followed ? { boxShadow: "0 0 0 1px rgba(52,211,153,0.4), 0 0 16px rgba(52,211,153,0.12)" } : undefined}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] border border-white/[0.08] shrink-0">
          <Crown className="h-4 w-4 text-amber-300/80" />
        </span>
        <code className="font-mono text-[13px] font-semibold text-foreground/85 truncate">{label}</code>
      </div>
      {followed ? (
        <span className="shrink-0 h-9 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-[12px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
          <Check className="h-3.5 w-3.5" />{t("copyTrading.followed", "已跟单")}
        </span>
      ) : (
        <Button
          size="sm"
          className="shrink-0 h-9 px-3.5 font-extrabold"
          style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000" }}
          disabled={busy}
          onClick={onFollow}
          data-testid={`button-leader-follow-${wallet}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
          {busy ? t("copyTrading.activating", "激活中…") : t("copyTrading.oneClickFollow", "一键开始跟单")}
        </Button>
      )}
    </div>
  );
}

function leaderWalletOf(r: any): string | undefined {
  const w = r?.wallet ?? r?.proxyWallet ?? r?.address ?? r?.leaderWallet ?? r?.leader;
  return typeof w === "string" && w.startsWith("0x") ? w : undefined;
}

function AutoCopyInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const subsQ = useCopySubs(userId);
  const subs = asArray(subsQ.data);
  // 统计走 Supabase 合并层(show=真实+复制,跨 PM/HL,与 stats 页同口径)。
  const _acct = useAcct2();
  const _wallet = _acct?.address;
  const dailyQ = useWalletDailyHistory(_wallet);
  const dh = useMemo(() => dailyQ.data ?? [], [dailyQ.data]);

  // Top leaders (7d) — the 交易员 candidates for one-click follow.
  const leadersQ = useQuery({
    queryKey: ["engine", "pm-leaders-top", "7d"],
    queryFn: () => signals.leadersTop("7d"),
    staleTime: 120_000,
    retry: false,
  });
  const leaders = useMemo(() => {
    const seen = new Set<string>();
    const out: { wallet: string; label: string }[] = [];
    for (const r of asArray(leadersQ.data)) {
      const w = leaderWalletOf(r);
      if (!w || seen.has(w.toLowerCase())) continue;
      seen.add(w.toLowerCase());
      const name = String((r as any)?.name ?? (r as any)?.label ?? "").trim();
      out.push({ wallet: w, label: name || `${w.slice(0, 6)}…${w.slice(-4)}` });
    }
    return out.slice(0, 12);
  }, [leadersQ.data]);

  const followedWallets = useMemo(() => {
    const s = new Set<string>();
    for (const sub of subs) {
      const st = String((sub as any)?.status ?? "active").toLowerCase();
      if (st !== "active" && st !== "running") continue;
      const w = (sub as any)?.leaderWallet ?? (sub as any)?.leader;
      if (typeof w === "string" && w.startsWith("0x")) s.add(w.toLowerCase());
    }
    return s;
  }, [subs]);

  const activeSubs = subs.filter((s: any) => {
    const st = String(s?.status ?? "active").toLowerCase();
    return st === "active" || st === "running";
  });
  const copiesThisMonth = useMemo(() => {
    const n = new Date();
    const ym = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    return dh.filter((r) => String(r.day).startsWith(ym)).reduce((s, r) => s + numOrZero(r.closed_today), 0);
  }, [dh]);
  const realizedPnl = useMemo(() => {
    const latest = new Map<string, any>();
    for (const r of dh) { const e = latest.get(r.venue); if (!e || r.day > e.day) latest.set(r.venue, r); }
    return [...latest.values()].reduce((s, r) => s + numOrZero(r.realized_pnl_cum_usd), 0);
  }, [dh]);
  const isRunning = activeSubs.length > 0;

  // 主选择层:跟单风格(执行器)。默认 mirror。一键跟单只传 { leaderWallet, executorId }。
  const [executorId, setExecutorId] = useState<PmExecutorId>("mirror");
  const [busyWallet, setBusyWallet] = useState<string | null>(null);

  const follow = useMutation({
    mutationFn: async (leaderWallet: string) => {
      // 契约变更:只传 { leaderWallet, executorId } —— 不再传 preset/riskPreset/ratio/cap。
      // 后端按 executorId 套 sizing(基础仓位 ratio/单笔/日额/杠杆 + 门控)。
      return await copySubscriptions.create(userId, { leaderWallet, executorId });
    },
    onSuccess: () => {
      toast({ title: t("copyTrading.autoCopySuccess"), description: t("copyTrading.autoCopySuccessDesc") });
      queryClient.invalidateQueries({ queryKey: ["engine", "copy-subs", userId] });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  async function onFollow(leaderWallet: string) {
    if (busyWallet) return;
    setBusyWallet(leaderWallet.toLowerCase());
    try { await follow.mutateAsync(leaderWallet); } catch { /* toast handled */ } finally { setBusyWallet(null); }
  }

  const stop = useMutation({
    mutationFn: async (id: string) => copySubscriptions.delete(userId, id),
    onSuccess: () => {
      toast({ title: t("copyTrading.stopSubSuccess") });
      queryClient.invalidateQueries({ queryKey: ["engine", "copy-subs", userId] });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  return (
    <div className="space-y-5">

      {/* ── 1. Status card (real) ── */}
      <div className="relative rounded-2xl p-5 overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(0,0,0,1) 60%)", border: "1px solid rgba(245,158,11,0.25)" }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "rgba(245,158,11,0.04)", filter: "blur(80px)" }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <span className="text-[11px] text-muted-foreground">{t("copyTrading.tabAutoCopy", "Strategy")}</span>
            <div className="flex items-center gap-1.5">
              {isRunning ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <span className="text-[11px] font-medium text-emerald-400">{t("copyTrading.strategyRunning", "策略运行中")}</span>
                </>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground">{t("copyTrading.strategyIdle", "未激活")}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <StatCell label={t("copyTrading.activeSubsShort", "活跃订阅")}
              value={subsQ.isLoading ? "—" : String(activeSubs.length)} />
            <StatCell label={t("copyTrading.copiesThisMonth", "本月跟单")}
              value={dailyQ.isLoading ? "—" : String(copiesThisMonth)} />
            <StatCell label={t("copyTrading.statRealized", "已实现盈亏")}
              value={dailyQ.isLoading ? "—" : fmtUsd(realizedPnl)}
              accent={realizedPnl >= 0 ? "#10b981" : "#f87171"} />
          </div>
        </div>
      </div>

      {/* ── 2. Pick 风格(执行器)── 主选择层,替代旧策略包。sizing 由后端按 executorId 决定。 */}
      <section className="rounded-xl p-4"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <ExecutorPicker value={executorId} onChange={setExecutorId} disabled={!!busyWallet} />
      </section>

      {/* ── 3. Pick 交易员 → 一键跟单 ── */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <Users className="h-4 w-4 text-amber-400 self-center" />
          <h2 className="text-[15px] font-semibold text-foreground">{t("copyTrading.pickLeader", "选择交易员")}</h2>
          <span className="text-[12px] text-muted-foreground">{t("copyTrading.pickLeaderHint", "选一位,一键跟单")}</span>
        </div>

        {leadersQ.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : leaders.length === 0 ? (
          <div className="rounded-xl p-6 text-center text-[13px] text-muted-foreground"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            {t("copyTrading.noLeaderForPreset", "暂无可跟的 Leader，请稍后再试")}
          </div>
        ) : (
          <div className="space-y-2">
            {leaders.map((l) => (
              <LeaderRow
                key={l.wallet}
                wallet={l.wallet}
                label={l.label}
                followed={followedWallets.has(l.wallet.toLowerCase())}
                busy={busyWallet === l.wallet.toLowerCase()}
                onFollow={() => onFollow(l.wallet)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Active subscriptions (real) ── */}
      {(subsQ.isLoading || activeSubs.length > 0) && (
        <section className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            {t("copyTrading.activeSubs", "Active Subscriptions")}
          </h3>
          {subsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : (
            <div className="space-y-2">
              {activeSubs.map((s: any, i: number) => {
                const id = String(s?.id ?? i);
                const label = String(s?.leaderWallet ?? s?.leader ?? id);
                return (
                  <div key={id} className="premium-card rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-foreground/85 truncate font-mono">{label}</div>
                      <Badge className="mt-1 text-[10px] no-default-hover-elevate no-default-active-elevate bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
                        {t("copyTrading.subStatusActive", "激活中")}
                      </Badge>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] border-red-500/30 text-red-400"
                      onClick={() => stop.mutate(id)} disabled={stop.isPending}>
                      {t("copyTrading.stopSub", "Stop")}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 truncate">{label}</p>
      <p className="text-[15px] font-semibold tabular-nums truncate" style={{ color: accent ?? "hsl(var(--foreground))" }}>{value}</p>
    </div>
  );
}

export default function CopyTradingAutoPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  return (
    <CopyTradingLayout title={t("copyTrading.tabAutoCopy", "Strategy")}>
      <CopyGate wallet={wallet} userLoading={userQ.isLoading} userId={userId}>
        {(uid) => <AutoCopyInner userId={uid} />}
      </CopyGate>
    </CopyTradingLayout>
  );
}
