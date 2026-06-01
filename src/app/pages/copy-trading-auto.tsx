/**
 * Smart Copy-Trading — Strategy & Tiers (策略跟单), at /copy-trading/auto.
 *
 * Real-data flow: pick an L1–L5 strategy tier → its system params auto-fill
 * (risk preset, notional ratio, per-trade & monthly caps) → ONE click activates
 * copy-trading via the engine (recommendations.onboardPreset → copySubscriptions
 * fallback). Active subscriptions are listed with a stop control. Secondary
 * content (advanced config, tier comparison) lives in dialogs — not tiled down
 * the page. No mock data: status/stats are derived from real orders & subs.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Zap, Check, Loader2, Sliders, Settings, BarChart3, ToggleLeft, ToggleRight, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@app/lib/utils";
import { useToast } from "@app/hooks/use-toast";
import { queryClient } from "@app/lib/queryClient";
import { useEngineUser, useCopySubs, useOrders } from "@app/lib/engine-hooks";
import { recommendations, copySubscriptions, signals } from "@app/lib/engine";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { CopyGate, asArray, normalizeOrder, fmtUsd } from "@app/components/copy-trading/shared";

// ─── Tier definitions (each carries the real system params it applies) ────────

interface TierDef {
  key: string;
  preset: "conservative" | "balanced" | "aggressive";
  riskLabel: string;
  dailyLimit: string;
  monthLimit: string;
  notionalRatio: number;   // fraction of leader notional copied
  notionalCapUsd: number;  // per-trade cap
  color: string;
  accent: string;
  glow: string;
}

const TIERS: TierDef[] = [
  { key: "L1", preset: "conservative", riskLabel: "保守", dailyLimit: "$100",   monthLimit: "$2,000",   notionalRatio: 0.03, notionalCapUsd: 50,   color: "text-zinc-300",   accent: "rgba(161,161,170,0.5)", glow: "" },
  { key: "L2", preset: "balanced",     riskLabel: "均衡", dailyLimit: "$200",   monthLimit: "$5,000",   notionalRatio: 0.05, notionalCapUsd: 100,  color: "text-indigo-300", accent: "rgba(99,102,241,0.45)", glow: "rgba(99,102,241,0.15)" },
  { key: "L3", preset: "aggressive",   riskLabel: "进取", dailyLimit: "$500",   monthLimit: "$10,000",  notionalRatio: 0.08, notionalCapUsd: 200,  color: "text-amber-300",  accent: "rgba(245,158,11,0.5)",  glow: "rgba(245,158,11,0.12)" },
  { key: "L4", preset: "aggressive",   riskLabel: "高阶", dailyLimit: "$1,000", monthLimit: "$100,000", notionalRatio: 0.10, notionalCapUsd: 500,  color: "text-orange-300", accent: "rgba(249,115,22,0.5)",  glow: "" },
  { key: "L5", preset: "aggressive",   riskLabel: "机构", dailyLimit: "$2,000", monthLimit: "$200,000", notionalRatio: 0.12, notionalCapUsd: 1000, color: "text-red-300",    accent: "rgba(239,68,68,0.5)",   glow: "" },
];

const PRESET_TO_TIER: Record<string, string> = { conservative: "L1", balanced: "L2", aggressive: "L3" };

function deriveActiveTier(subs: any[]): string | null {
  for (const s of subs) {
    const status = String(s?.status ?? "active").toLowerCase();
    if (status !== "active" && status !== "running") continue;
    const cap = Number(s?.notionalCapUsd ?? s?.notionalCap ?? 0);
    if (cap > 0) {
      const byCap = TIERS.find((t) => t.notionalCapUsd === cap);
      if (byCap) return byCap.key;
    }
    const preset = String(s?.riskPreset ?? s?.preset ?? "").toLowerCase();
    for (const k of Object.keys(PRESET_TO_TIER)) if (preset.includes(k)) return PRESET_TO_TIER[k];
  }
  return null;
}

function AutoCopyInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const presetsQ = useQuery({
    queryKey: ["engine", "rec-presets"],
    queryFn: () => recommendations.presets(),
    staleTime: 300_000,
    retry: false,
  });
  const enginePresets = asArray(presetsQ.data);

  const subsQ = useCopySubs(userId);
  const subs = asArray(subsQ.data);
  const ordersQ = useOrders(userId);
  const orders = useMemo(() => asArray(ordersQ.data).map(normalizeOrder), [ordersQ.data]);

  const activeTierKey = useMemo(() => deriveActiveTier(subs), [subs]);
  const activeSubs = subs.filter((s: any) => {
    const st = String(s?.status ?? "active").toLowerCase();
    return st === "active" || st === "running";
  });
  const copiesThisMonth = useMemo(() => {
    const now = new Date();
    return orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [orders]);
  const realizedPnl = orders.filter((o) => o.pnl != null).reduce((s, o) => s + (o.pnl ?? 0), 0);
  const isRunning = activeSubs.length > 0;

  // Selection — defaults to the active tier once it resolves, until the user picks.
  const [selectedTier, setSelectedTier] = useState<string>("L2");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (activeTierKey && !touched) setSelectedTier(activeTierKey);
  }, [activeTierKey, touched]);

  const [autoCopy, setAutoCopy] = useState(true);
  const [aiFilter, setAiFilter] = useState(true);
  const [minConfidence, setMinConfidence] = useState(70);
  const [configOpen, setConfigOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const selDef = TIERS.find((t) => t.key === selectedTier) ?? TIERS[1];
  const isActiveSelected = selectedTier === activeTierKey;

  const activate = useMutation({
    mutationFn: async (tierKey: string) => {
      const tier = TIERS.find((t) => t.key === tierKey)!;
      const presetKey = tier.preset;
      const match = enginePresets.find((p: any) => {
        const id = String(p?.id ?? p?.key ?? p?.preset ?? p?.name ?? "").toLowerCase();
        return id.includes(presetKey);
      });
      const presetId = String((match as any)?.id ?? (match as any)?.key ?? presetKey);
      const body = {
        preset: presetId,
        riskPreset: presetKey,
        notionalRatio: tier.notionalRatio,
        notionalCapUsd: tier.notionalCapUsd,
        autoExecute: autoCopy,
        aiFilter,
        minConfidence: minConfidence / 100,
      };
      try {
        return await recommendations.onboardPreset(userId, body);
      } catch {
        const top = asArray(await signals.leadersTop("7d").catch(() => null));
        const topWallet = top
          .map((r: any) => r?.wallet ?? r?.proxyWallet ?? r?.address)
          .find((w: any) => typeof w === "string" && w.startsWith("0x"));
        if (!topWallet) throw new Error(t("copyTrading.noLeaderForPreset", "暂无可跟的 Leader，请稍后再试"));
        return await copySubscriptions.create(userId, {
          leaderWallet: topWallet,
          notionalRatio: tier.notionalRatio,
          notionalCapUsd: tier.notionalCapUsd,
          status: "active",
        });
      }
    },
    onSuccess: () => {
      toast({ title: t("copyTrading.autoCopySuccess"), description: t("copyTrading.autoCopySuccessDesc") });
      queryClient.invalidateQueries({ queryKey: ["engine", "copy-subs", userId] });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: String(e?.message ?? e), variant: "destructive" }),
  });

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
              value={ordersQ.isLoading ? "—" : String(copiesThisMonth)} />
            <StatCell label={t("copyTrading.statRealized", "已实现盈亏")}
              value={ordersQ.isLoading ? "—" : fmtUsd(realizedPnl)}
              accent={realizedPnl >= 0 ? "#10b981" : "#f87171"} />
          </div>
        </div>
      </div>

      {/* ── 2. Strategy tier selector ── */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold text-foreground">{t("copyTrading.strategyPacks", "策略包")}</h2>
          <span className="text-[12px] text-muted-foreground">{t("copyTrading.selectAndActivate", "选择并激活")}</span>
        </div>

        <div className="space-y-2.5">
          {TIERS.map((tier) => {
            const isActive = tier.key === activeTierKey;
            const isSelected = selectedTier === tier.key;
            return (
              <button key={tier.key}
                onClick={() => { setSelectedTier(tier.key); setTouched(true); }}
                className={cn("w-full flex items-center p-4 rounded-xl transition-all text-left")}
                style={{
                  background: isSelected ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${isSelected ? tier.accent : "rgba(255,255,255,0.06)"}`,
                  boxShadow: isSelected && tier.glow ? `0 0 20px ${tier.glow}` : undefined,
                }}>
                <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg border font-bold mr-4", tier.color)}
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                  {tier.key}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-[17px] font-medium", isSelected ? "text-amber-400" : "text-foreground")}>
                    {tier.dailyLimit}<span className="text-xs text-muted-foreground ml-1">/{t("copyTrading.perDay", "日")}</span>
                  </div>
                  <div className="text-[12px] text-muted-foreground">{tier.monthLimit} /{t("copyTrading.perMonth", "月")} · {tier.riskLabel}</div>
                </div>
                {isActive ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-medium"
                    style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399" }}>
                    <Check className="h-3 w-3" /> {t("copyTrading.subStatusActive", "激活中")}
                  </div>
                ) : isSelected ? (
                  <Check className="h-4 w-4 text-amber-400" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Selected tier → auto-filled system params + ONE-CLICK follow */}
        <div className="rounded-xl p-4 space-y-3.5"
          style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-amber-400" />
            <span className="text-[13px] font-semibold text-foreground">
              {selDef.key} · {selDef.riskLabel}{t("copyTrading.paramsSuffix", "策略 · 系统参数")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Param label={t("copyTrading.paramRatio", "跟单比例")} value={`${(selDef.notionalRatio * 100).toFixed(0)}%`} />
            <Param label={t("copyTrading.paramTradeCap", "单笔上限")} value={`$${selDef.notionalCapUsd}`} />
            <Param label={t("copyTrading.paramDailyCap", "单日上限")} value={selDef.dailyLimit} />
            <Param label={t("copyTrading.paramMonthCap", "月度上限")} value={selDef.monthLimit} />
            <Param label={t("copyTrading.paramRisk", "风险档位")} value={selDef.riskLabel} />
            <Param label={t("copyTrading.paramAiFilter", "AI 过滤")} value={aiFilter ? `${t("common.on", "开启")} · ≥${minConfidence}%` : t("common.off", "关闭")} />
          </div>

          <Button className="w-full font-bold h-11"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000" }}
            onClick={() => activate.mutate(selectedTier)}
            disabled={activate.isPending}>
            {activate.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{t("copyTrading.activating", "激活中…")}</>
            ) : isActiveSelected ? (
              <><Check className="h-4 w-4 mr-1.5" />{t("copyTrading.reapply", "已激活 · 重新应用参数")}</>
            ) : (
              <><Zap className="h-4 w-4 mr-1.5" />{t("copyTrading.oneClickFollow", "一键开始跟单")}</>
            )}
          </Button>

          <div className="flex gap-2">
            <button onClick={() => setConfigOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium text-foreground/80 transition-colors hover:bg-white/5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Settings className="h-3.5 w-3.5" /> {t("copyTrading.advancedConfig", "高级设置")}
            </button>
            <button onClick={() => setCompareOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium text-foreground/80 transition-colors hover:bg-white/5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <BarChart3 className="h-3.5 w-3.5" /> {t("copyTrading.compareTiers", "档位对比")}
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. Active subscriptions (real) ── */}
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
                const label = String(s?.leaderWallet ?? s?.leader ?? s?.preset ?? s?.riskPreset ?? id);
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

      {/* ── Advanced config dialog ── */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Settings className="h-4 w-4 text-amber-400" /> {t("copyTrading.advancedConfig", "高级设置")}
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              {t("copyTrading.configDesc", "这些设置会在你下一次一键跟单时生效。")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            <ConfigToggle label={t("copyTrading.cfgAutoCopy", "自动跟单模式")} value={autoCopy} onToggle={() => setAutoCopy((v) => !v)} />
            <ConfigToggle label={t("copyTrading.cfgAiFilter", "AI 过滤开启")} value={aiFilter} onToggle={() => setAiFilter((v) => !v)} />
            <div className="p-3.5 rounded-xl space-y-2.5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-foreground">{t("copyTrading.cfgMinConfidence", "最低可信度阈值")}</span>
                <span className="text-[13px] font-bold text-amber-400">{minConfidence}%</span>
              </div>
              <div className="flex gap-1.5">
                {[60, 70, 80, 90].map((v) => (
                  <button key={v} onClick={() => setMinConfidence(v)}
                    className={cn("flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                      minConfidence === v ? "bg-amber-500 text-black" : "bg-white/5 text-muted-foreground hover:text-foreground")}>
                    {v}%
                  </button>
                ))}
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed pt-1">
              <Activity className="h-3.5 w-3.5 mt-px shrink-0 text-amber-400/70" />
              {t("copyTrading.aiFilterNote", "AI 决策引擎会分析每条跟单信号，自动跳过低可信度订单，让跟单更稳定。")}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Tier comparison dialog (real params) ── */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-400" /> {t("copyTrading.compareTiers", "档位对比")}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
            <table className="w-full text-[12px] text-left border-collapse">
              <thead>
                <tr>
                  {[
                    t("copyTrading.colTier", "档位"),
                    t("copyTrading.paramRisk", "风险"),
                    t("copyTrading.paramRatio", "比例"),
                    t("copyTrading.paramTradeCap", "单笔"),
                    t("copyTrading.paramMonthCap", "月上限"),
                  ].map((h, i) => (
                    <th key={i} className="py-2.5 px-3 font-medium text-muted-foreground border-b border-white/[0.06] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIERS.map((tier, i) => (
                  <tr key={tier.key} className={cn(selectedTier === tier.key && "bg-amber-500/5")}>
                    <td className={cn("py-2.5 px-3 font-bold", tier.color, i < TIERS.length - 1 && "border-b border-white/[0.03]")}>{tier.key}</td>
                    <td className={cn("py-2.5 px-3 text-foreground/70", i < TIERS.length - 1 && "border-b border-white/[0.03]")}>{tier.riskLabel}</td>
                    <td className={cn("py-2.5 px-3 text-foreground/70 tabular-nums", i < TIERS.length - 1 && "border-b border-white/[0.03]")}>{(tier.notionalRatio * 100).toFixed(0)}%</td>
                    <td className={cn("py-2.5 px-3 text-foreground/70 tabular-nums", i < TIERS.length - 1 && "border-b border-white/[0.03]")}>${tier.notionalCapUsd}</td>
                    <td className={cn("py-2.5 px-3 text-foreground/70 tabular-nums", i < TIERS.length - 1 && "border-b border-white/[0.03]")}>{tier.monthLimit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
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

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-3 py-2 flex items-center justify-between gap-2"
      style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function ConfigToggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <button onClick={onToggle} className="focus:outline-none">
        {value ? <ToggleRight className="h-8 w-8 text-amber-500" /> : <ToggleLeft className="h-8 w-8 text-muted-foreground/40" />}
      </button>
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
