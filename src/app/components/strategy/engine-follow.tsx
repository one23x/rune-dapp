/**
 * EngineFollow — 引擎页「开启跟单」动作卡。选执行风格 → 一键跟单顶级交易员(真实订阅,
 * 复用 useHlCopy);已跟单显示「已跟单」+ 顶部「跟单中 N 位」。未开户 → 引导先开通。
 *
 * 移动端优先 + dark glass/amber。
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Check, Loader2, Crown, Sparkles } from "lucide-react";
import { useHlLeaders, useHlSubs } from "@app/lib/engine-hooks";
import { useHlCopy, executorOnlyConfig, type HlExecutorId } from "@app/components/hl/shared";
import type { HlNetwork, HlLeader } from "@app/lib/engine";
import { cn } from "@app/lib/utils";

const STYLES: HlExecutorId[] = ["mirror", "steady", "aggressive", "smart"];

export function EngineFollow({ userId, network, onFollowed }: { userId?: string; network: HlNetwork; onFollowed?: () => void }) {
  const { t } = useTranslation();
  const leadersQ = useHlLeaders(network);
  const subsQ = useHlSubs(userId);
  const { copy, copyMany, batchPending } = useHlCopy(userId, network);
  const [exec, setExec] = useState<HlExecutorId>("mirror");
  const [busy, setBusy] = useState<string | null>(null);

  const followed = useMemo(() => {
    const s = new Set<string>();
    for (const x of (subsQ.data?.subscriptions ?? []) as Array<{ status?: string; leaderAddress: string }>) {
      if (x.status !== "stopped") s.add(String(x.leaderAddress).toLowerCase());
    }
    return s;
  }, [subsQ.data]);

  // 风控:智能/手动跟单都只用「摆动型」leader —— 排除 HFT、要求中位持仓 ≥30min(1800s),
  // 避免高频/scalper 在小户上被手续费吃成负 EV(全亏损教训)。摆动池不足 3 个时退回非-HFT 池。
  const ranked = useMemo(
    () => {
      const all = [...(leadersQ.data?.leaders ?? [])].filter((l) => l.active !== false && l.isHft !== true);
      const swing = all.filter((l) => (l.medianHoldingS ?? 0) >= 1800);
      return (swing.length >= 3 ? swing : all).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    },
    [leadersQ.data],
  );
  const leaders = ranked.slice(0, 6);
  // 智能优选:按平台评分取 Top 3,且未被跟过的(已跟的不重复发)。
  const SMART_N = 3;
  const smartPicks = useMemo(
    () => ranked.filter((l) => !followed.has(l.address.toLowerCase())).slice(0, SMART_N),
    [ranked, followed],
  );

  async function follow(l: HlLeader) {
    if (busy || batchPending || !userId) return;
    setBusy(l.address.toLowerCase());
    try { await copy(l, executorOnlyConfig(exec)); onFollowed?.(); } finally { setBusy(null); }
  }

  // 智能跟单:自动优选 Top N(按评分)+ smart 执行器(AI ranker 逐笔门控,仅跟高胜率信号)。
  async function smartFollow() {
    if (busy || batchPending || !userId || smartPicks.length === 0) return;
    await copyMany(smartPicks, executorOnlyConfig("smart"));
    onFollowed?.();
  }

  return (
    <section className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] p-3.5">
      <header className="flex items-center gap-2 mb-2.5">
        <Users className="h-4 w-4 text-amber-300 shrink-0" />
        <h4 className="text-[13px] font-bold text-foreground/90">{t("engine.follow", "开启跟单")}</h4>
        {followed.size > 0 && (
          <span className="ml-auto text-[10px] font-mono text-emerald-400/90">{t("engine.following", "跟单中 {{n}} 位", { n: followed.size })}</span>
        )}
      </header>

      {!userId ? (
        <p className="text-[11px] text-amber-200/80 leading-snug">{t("engine.needOnboard", "请先在策略页开通交易账户")}</p>
      ) : (
        <>
          {/* 智能跟单 —— 一键自动优选(评分 Top N)+ AI ranker 智能执行 */}
          <button
            type="button"
            onClick={smartFollow}
            disabled={batchPending || smartPicks.length === 0}
            className="gold-button w-full flex items-center justify-center gap-1.5 rounded-xl py-3 min-h-[46px] text-[13px] font-extrabold active:scale-[0.99] disabled:opacity-50"
            data-testid="engine-smart-follow"
          >
            {batchPending ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Sparkles className="h-4 w-4 shrink-0" />}
            <span className="truncate">{t("engine.smartFollow", "智能跟单 · 自动优选 Top {{n}}", { n: smartPicks.length || SMART_N })}</span>
          </button>
          <p className="mt-1.5 mb-2.5 text-[10px] leading-snug text-foreground/45">
            {t("engine.smartFollowHint", "按平台评分自动优选顶级交易员,并启用 AI ranker 智能执行(仅跟高胜率信号)")}
          </p>

          <div className="flex items-center gap-2 mb-2.5">
            <span className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[10px] text-foreground/40 shrink-0">{t("engine.orPickManually", "或手动选择")}</span>
            <span className="h-px flex-1 bg-white/[0.06]" />
          </div>

          {/* 风格 */}
          <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] text-foreground/45 shrink-0">{t("engine.style", "风格")}:</span>
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setExec(s)}
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition active:scale-95",
                  exec === s ? "bg-amber-500/20 text-amber-200 border border-amber-400/40" : "bg-white/[0.04] text-foreground/60 border border-white/10",
                )}
                data-testid={`engine-exec-${s}`}
              >
                {t(`engine.exec.${s}`, s)}
              </button>
            ))}
          </div>

          {/* 交易员列表 */}
          {leadersQ.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />)}</div>
          ) : leaders.length === 0 ? (
            <p className="text-[11px] text-foreground/40 py-3 text-center">{t("engine.noLeaders", "暂无可跟交易员")}</p>
          ) : (
            <ul className="space-y-2">
              {leaders.map((l) => {
                const on = followed.has(l.address.toLowerCase());
                const loading = busy === l.address.toLowerCase();
                return (
                  <li key={l.address} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <Crown className="h-3.5 w-3.5 text-amber-300/70 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-foreground/85 truncate">{l.label || `${l.address.slice(0, 6)}…${l.address.slice(-4)}`}</div>
                      {l.score != null && <div className="text-[9.5px] font-mono text-foreground/40">score {l.score}</div>}
                    </div>
                    <button
                      onClick={() => follow(l)}
                      disabled={on || loading || batchPending}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition active:scale-95",
                        on ? "bg-emerald-500/15 text-emerald-300 cursor-default" : "gold-button",
                      )}
                      data-testid={`engine-follow-${l.address.slice(0, 6)}`}
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : on ? <Check className="h-3.5 w-3.5" /> : null}
                      {on ? t("engine.followed", "已跟单") : t("engine.oneClickFollow", "一键跟单")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export default EngineFollow;
