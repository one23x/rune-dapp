/**
 * Smart Copy-Trading — Strategy & Tiers (策略与档位), at /copy-trading/auto.
 *
 * Sections:
 *  1. Current status card (membership tier, daily copy progress, AI decisions)
 *  2. L1-L5 strategy tier selector (lock/unlock by tier)
 *  3. AI decision packages (buy with points)
 *  4. Copy config toggles (auto-copy, AI filter, confidence threshold)
 *  5. Membership comparison table
 *
 * Activation still calls the real engine (recommendations.onboardPreset →
 * copySubscriptions.create fallback). Active subs shown with stop control.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Zap, Check, Loader2, Users, Crown, TrendingUp, Lock, ArrowRight,
  ToggleLeft, ToggleRight, Settings, ChevronDown, Shield, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@app/lib/utils";
import { useToast } from "@app/hooks/use-toast";
import { queryClient } from "@app/lib/queryClient";
import { useEngineUser, useCopySubs } from "@app/lib/engine-hooks";
import { recommendations, copySubscriptions, signals } from "@app/lib/engine";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { CopyGate, SectionEmpty, asArray, fmtUsd } from "@app/components/copy-trading/shared";

// ─── Tier definitions ─────────────────────────────────────────────────────────

interface TierDef {
  key: string;
  label: string;
  dailyLimit: string;
  monthLimit: string;
  dailyCopies: number;
  aiDecisions: number;
  signalsPerDay: number;
  fillRate: string;
  winRate: string;
  requiredTier: "Free" | "Pro" | "Elite" | "Institutional";
  color: string;
  glowColor: string;
  borderActive: string;
  bgActive: string;
}

const TIERS: TierDef[] = [
  {
    key: "L1", label: "L1", dailyLimit: "$100", monthLimit: "$2,000",
    dailyCopies: 3, aiDecisions: 5, signalsPerDay: 5, fillRate: "85%", winRate: "62%",
    requiredTier: "Free", color: "text-zinc-400", glowColor: "",
    borderActive: "rgba(255,255,255,0.12)", bgActive: "rgba(255,255,255,0.04)",
  },
  {
    key: "L2", label: "L2", dailyLimit: "$200", monthLimit: "$5,000",
    dailyCopies: 15, aiDecisions: 50, signalsPerDay: 20, fillRate: "91%", winRate: "68%",
    requiredTier: "Pro", color: "text-indigo-400", glowColor: "rgba(99,102,241,0.15)",
    borderActive: "rgba(99,102,241,0.4)", bgActive: "rgba(99,102,241,0.08)",
  },
  {
    key: "L3", label: "L3", dailyLimit: "$500", monthLimit: "$10,000",
    dailyCopies: 50, aiDecisions: 200, signalsPerDay: 60, fillRate: "94%", winRate: "73%",
    requiredTier: "Elite", color: "text-amber-400", glowColor: "rgba(245,158,11,0.1)",
    borderActive: "rgba(245,158,11,0.4)", bgActive: "rgba(245,158,11,0.06)",
  },
  {
    key: "L4", label: "L4", dailyLimit: "$1,000", monthLimit: "$100,000",
    dailyCopies: 200, aiDecisions: 1000, signalsPerDay: 200, fillRate: "97%", winRate: "79%",
    requiredTier: "Institutional", color: "text-orange-400", glowColor: "",
    borderActive: "rgba(249,115,22,0.4)", bgActive: "rgba(249,115,22,0.05)",
  },
  {
    key: "L5", label: "L5", dailyLimit: "$2,000", monthLimit: "$200,000",
    dailyCopies: -1, aiDecisions: -1, signalsPerDay: -1, fillRate: "99%", winRate: "84%",
    requiredTier: "Institutional", color: "text-red-400", glowColor: "",
    borderActive: "rgba(239,68,68,0.4)", bgActive: "rgba(239,68,68,0.05)",
  },
];

const AI_PACKAGES = [
  { label: "基础包", decisions: "+50", points: 200, recommended: false },
  { label: "标准包", decisions: "+150", points: 500, recommended: true },
  { label: "高级包", decisions: "+500", points: 1500, recommended: false },
];

// Mock membership — in a real app this comes from a user profile hook
const MOCK_TIER = "Pro";
const MOCK_TIER_MAP: Record<string, string> = {
  Free: "L1",
  Pro: "L2",
  Elite: "L3",
  Institutional: "L5",
};

const TIER_ORDER = ["Free", "Pro", "Elite", "Institutional"];

function isUnlocked(tier: TierDef, memberTier: string): boolean {
  return TIER_ORDER.indexOf(memberTier) >= TIER_ORDER.indexOf(tier.requiredTier);
}

function ProgressBar({ used, total, accent }: { used: number; total: number; accent: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
    </div>
  );
}

function AutoCopyInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState("L2");
  const [autoCopy, setAutoCopy] = useState(true);
  const [aiFilter, setAiFilter] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const activeTierDef = TIERS.find(t => t.key === MOCK_TIER_MAP[MOCK_TIER]) ?? TIERS[1];
  const todayCopies = 8;
  const aiRemaining = 23;

  const presetsQ = useQuery({
    queryKey: ["engine", "rec-presets"],
    queryFn: () => recommendations.presets(),
    staleTime: 300_000,
    retry: false,
  });
  const enginePresets = asArray(presetsQ.data);
  const subsQ = useCopySubs(userId);
  const subs = asArray(subsQ.data);

  const tierKeyToPreset: Record<string, string> = {
    L1: "conservative", L2: "balanced", L3: "aggressive", L4: "aggressive", L5: "aggressive",
  };

  const activate = useMutation({
    mutationFn: async (tierKey: string) => {
      const presetKey = tierKeyToPreset[tierKey] ?? "balanced";
      const match = enginePresets.find((p: any) => {
        const id = String(p?.id ?? p?.key ?? p?.preset ?? p?.name ?? "").toLowerCase();
        return id.includes(presetKey);
      });
      const presetId = String((match as any)?.id ?? (match as any)?.key ?? presetKey);
      try {
        return await recommendations.onboardPreset(userId, { preset: presetId, riskPreset: presetKey });
      } catch {
        const top = asArray(await signals.leadersTop("7d").catch(() => null));
        const topWallet = top
          .map((r: any) => r?.wallet ?? r?.proxyWallet ?? r?.address)
          .find((w: any) => typeof w === "string" && w.startsWith("0x"));
        if (!topWallet) throw new Error(t("copyTrading.noLeaderForPreset", "暂无可跟的 Leader,请稍后再试"));
        const caps = presetKey.includes("aggress")
          ? { notionalRatio: 0.1, notionalCapUsd: 200 }
          : presetKey.includes("conserv")
            ? { notionalRatio: 0.03, notionalCapUsd: 50 }
            : { notionalRatio: 0.05, notionalCapUsd: 100 };
        return await copySubscriptions.create(userId, { leaderWallet: topWallet, ...caps, status: "active" });
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

  const buyPackage = (pkg: typeof AI_PACKAGES[0]) => {
    toast({ title: t("common.comingSoon"), description: `${pkg.label} (${pkg.decisions} 次 · ${pkg.points} 积分)` });
  };

  return (
    <div className="space-y-5">

      {/* ── 1. Current Status Card ── */}
      <div className="relative rounded-2xl p-5 overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(0,0,0,1) 60%)", border: "1px solid rgba(245,158,11,0.3)" }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "rgba(245,158,11,0.04)", filter: "blur(80px)" }} />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
              style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
              <Crown className="h-3.5 w-3.5" /> Pro 会员
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
              style={{ background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }}>
              <TrendingUp className="h-3.5 w-3.5" /> L2 策略包激活中
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-muted-foreground">今日跟单</span>
                <span className="font-medium text-foreground">{todayCopies} / <span className="text-muted-foreground">{activeTierDef.dailyCopies} 次</span></span>
              </div>
              <ProgressBar used={todayCopies} total={activeTierDef.dailyCopies} accent="rgba(156,163,175,0.8)" />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-muted-foreground">AI 决策剩余</span>
                <span className="font-medium text-amber-400">{aiRemaining} / <span className="text-amber-600/70">{activeTierDef.aiDecisions} 次</span></span>
              </div>
              <ProgressBar used={aiRemaining} total={activeTierDef.aiDecisions}
                accent="linear-gradient(90deg, #f59e0b, #d97706)" />
            </div>
          </div>

          <div className="flex items-center gap-5 pt-4 border-t border-white/[0.06]">
            <button className="text-[12px] font-medium flex items-center gap-0.5 transition-colors"
              style={{ color: "#a5b4fc" }}
              onClick={() => toast({ title: t("common.comingSoon") })}>
              升级会员 <ArrowRight className="h-3 w-3 ml-0.5" />
            </button>
            <button className="text-[12px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-0.5 transition-colors"
              onClick={() => toast({ title: t("common.comingSoon") })}>
              购买决策包 <ArrowRight className="h-3 w-3 ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Strategy Tier Selector ── */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold text-foreground">策略包</h2>
          <span className="text-[12px] text-muted-foreground">选择并激活</span>
        </div>

        <div className="space-y-2.5">
          {TIERS.map(tier => {
            const unlocked = isUnlocked(tier, MOCK_TIER);
            const isActive = tier.key === MOCK_TIER_MAP[MOCK_TIER];
            const isSelected = selectedTier === tier.key;

            if (!unlocked) {
              return (
                <div key={tier.key} className="flex items-center p-4 rounded-xl opacity-60"
                  style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg border font-bold mr-4 ${tier.color}`}
                    style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.1)" }}>
                    {tier.label}
                  </div>
                  <div className="flex-1">
                    <div className="text-[17px] font-medium text-foreground/60">{tier.dailyLimit}<span className="text-xs text-muted-foreground ml-1">/日</span></div>
                    <div className="text-[12px] text-muted-foreground">{tier.monthLimit} /月</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                      <Lock className="h-3 w-3" /> 需要 {tier.requiredTier}
                    </div>
                    <button className="text-[10px] px-2 py-1 rounded transition-colors"
                      style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24" }}
                      onClick={() => toast({ title: t("common.comingSoon"), description: "积分临时升级功能即将开放" })}>
                      用积分临时升级 ↗
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <button key={tier.key} onClick={() => setSelectedTier(tier.key)}
                className={cn("w-full flex items-center p-4 rounded-xl transition-all text-left", isSelected && "ring-1 ring-amber-500/30")}
                style={{
                  background: isActive ? tier.bgActive : isSelected ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${isActive ? tier.borderActive : isSelected ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
                  boxShadow: isActive && tier.glowColor ? `0 0 20px ${tier.glowColor}` : undefined,
                }}>
                <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg border font-bold mr-4", tier.color)}
                  style={{ background: isActive ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)", borderColor: isActive ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.1)" }}>
                  {tier.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-[17px] font-medium", isActive ? "text-amber-400" : "text-foreground")}>
                    {tier.dailyLimit}<span className="text-xs text-muted-foreground ml-1">/日</span>
                  </div>
                  <div className="text-[12px] text-muted-foreground">{tier.monthLimit} /月</div>
                </div>
                {isActive ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-medium"
                    style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399" }}>
                    <Check className="h-3 w-3" /> 激活中
                  </div>
                ) : isSelected ? (
                  <Check className="h-4 w-4 text-foreground/40" />
                ) : null}
              </button>
            );
          })}
        </div>

        {selectedTier !== MOCK_TIER_MAP[MOCK_TIER] && (
          <Button className="w-full font-bold" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000" }}
            onClick={() => activate.mutate(selectedTier)}
            disabled={activate.isPending}>
            {activate.isPending
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />激活中…</>
              : <><Zap className="h-4 w-4 mr-1.5" />激活 {selectedTier} 策略包</>}
          </Button>
        )}
      </section>

      {/* ── 3. Active Subscriptions ── */}
      {(subsQ.isLoading || subs.length > 0) && (
        <div>
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            {t("copyTrading.activeSubs", "Active Subscriptions")}
          </h3>
          {subsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : (
            <div className="space-y-2">
              {subs.map((s: any, i: number) => {
                const id = String(s?.id ?? i);
                const status = String(s?.status ?? "active").toLowerCase();
                const active = status === "active" || status === "running";
                const label = String(s?.leaderWallet ?? s?.leader ?? s?.preset ?? s?.name ?? id);
                return (
                  <div key={id} className="premium-card rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-foreground/85 truncate font-mono">{label}</div>
                      <Badge className={cn("mt-1 text-[10px] no-default-hover-elevate no-default-active-elevate",
                        active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-muted/30 text-muted-foreground border-border")}>
                        {active ? t("copyTrading.subStatusActive") : t("copyTrading.subStatusStopped")}
                      </Badge>
                    </div>
                    {active && (
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] border-red-500/30 text-red-400"
                        onClick={() => stop.mutate(id)} disabled={stop.isPending}>
                        {t("copyTrading.stopSub", "Stop")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 4. AI Decision Packages ── */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-1">
            AI 决策包 <Zap className="h-4 w-4 text-amber-400" />
          </h2>
          <span className="text-[12px] text-muted-foreground">提升跟单可信度</span>
        </div>

        <div className="p-4 rounded-xl text-[13px] text-muted-foreground leading-relaxed"
          style={{ background: "rgba(26,21,13,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="mb-2.5">AI 决策引擎分析每条跟单信号，自动跳过低可信度订单，让跟单更稳定。决策次数越多，过滤越精准。</p>
          <div className="font-mono text-[11px] flex flex-wrap items-center gap-1.5 p-2 rounded-lg"
            style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <span className="text-foreground/80">[信号源 12条]</span>
            <ArrowRight className="h-3 w-3" />
            <span className="text-red-400">[AI过滤 ✕3跳过]</span>
            <ArrowRight className="h-3 w-3" />
            <span className="text-emerald-400">[执行 9条]</span>
            <ArrowRight className="h-3 w-3" />
            <span className="text-amber-400">可信度 ↑87%</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[13px] font-medium text-foreground">购买决策包</h3>
          <span className="text-[12px] text-muted-foreground font-mono">我的积分: <span className="text-amber-400">680 pts</span></span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {AI_PACKAGES.map((pkg, i) => (
            <div key={i} className={cn("p-3 rounded-xl flex flex-col relative overflow-hidden")}
              style={{
                background: pkg.recommended ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.025)",
                border: pkg.recommended ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.06)",
              }}>
              {pkg.recommended && (
                <div className="absolute top-0 right-0 text-black text-[10px] font-bold px-2 py-0.5 rounded-bl-lg"
                  style={{ background: "#f59e0b" }}>
                  🔥 推荐
                </div>
              )}
              <div className={`text-[11px] mb-0.5 ${pkg.recommended ? "text-amber-500/70" : "text-muted-foreground"}`}>{pkg.label}</div>
              <div className={`text-[17px] font-bold mb-3 ${pkg.recommended ? "text-amber-400" : "text-foreground"}`}>
                {pkg.decisions} <span className={`text-[11px] font-normal ${pkg.recommended ? "text-amber-500/50" : "text-muted-foreground"}`}>次</span>
              </div>
              <div className="mt-auto flex items-center justify-between gap-1">
                <span className={`text-[11px] font-mono ${pkg.recommended ? "text-amber-400" : "text-foreground/70"}`}>{pkg.points} 积分</span>
                <button onClick={() => buyPackage(pkg)}
                  className={cn("px-2.5 py-1.5 rounded-lg text-[11px] transition-colors font-medium",
                    pkg.recommended ? "text-black font-bold" : "text-white")}
                  style={pkg.recommended
                    ? { background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 0 15px rgba(245,158,11,0.3)" }
                    : { background: "rgba(255,255,255,0.1)" }}>
                  购买
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Copy Config Toggles ── */}
      <section className="space-y-3 pt-2 border-t border-white/[0.05]">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" /> 跟单配置
          </h2>
        </div>

        <div className="space-y-2">
          {[
            { label: "自动跟单模式", value: autoCopy, set: setAutoCopy },
            { label: "AI 过滤开启", value: aiFilter, set: setAiFilter },
          ].map(({ label, value, set }, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-[13px] font-medium text-foreground">{label}</span>
              <button onClick={() => set(!value)} className="focus:outline-none">
                {value
                  ? <ToggleRight className="h-8 w-8 text-amber-500" />
                  : <ToggleLeft className="h-8 w-8 text-muted-foreground/40" />}
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between p-3.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[13px] font-medium text-foreground">最低可信度阈值</span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer"
              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
              onClick={() => toast({ title: t("common.comingSoon") })}>
              <span className="text-[13px] font-medium text-amber-400">70%</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[13px] font-medium text-foreground">当前跟单交易员</span>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-muted-foreground">{subs.filter((s: any) => String(s?.status ?? "active").toLowerCase() === "active").length || 3} 位</span>
              <button className="text-[12px] text-amber-500 hover:text-amber-400 flex items-center transition-colors"
                onClick={() => toast({ title: t("common.comingSoon") })}>
                管理 ↗
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Membership Comparison Table ── */}
      <section className="pt-2 border-t border-white/[0.05]">
        <button className="w-full flex items-center justify-between p-4 rounded-xl text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-3"
          style={{ background: "rgba(24,22,17,1)", border: "1px solid rgba(255,255,255,0.05)" }}
          onClick={() => setShowTable(!showTable)}>
          <span>查看完整会员权益对比</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", showTable && "rotate-180")} />
        </button>

        {showTable && (
          <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
            <table className="w-full text-[12px] text-left border-collapse">
              <thead>
                <tr>
                  <th className="py-3 px-3 font-normal text-muted-foreground border-b border-white/[0.04] w-[22%]"></th>
                  <th className="py-3 px-3 font-medium text-muted-foreground border-b border-white/[0.04] text-center">Free</th>
                  <th className="py-3 px-3 font-medium text-amber-500 border-b border-amber-500/20 text-center" style={{ background: "rgba(245,158,11,0.05)" }}>Pro</th>
                  <th className="py-3 px-3 font-medium text-muted-foreground border-b border-white/[0.04] text-center">Elite</th>
                  <th className="py-3 px-3 font-medium text-muted-foreground border-b border-white/[0.04] text-center">机构</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "日跟单次", values: ["3", "15", "50", "无限"] },
                  { label: "AI决策", values: ["5", "50", "200", "无限"] },
                  { label: "策略包", values: ["L1", "L2", "L3", "L5"] },
                  { label: "月上限", values: ["$2K", "$5K", "$10K", "$200K"] },
                ].map((row, i, arr) => (
                  <tr key={i}>
                    <td className={`py-2.5 px-3 text-muted-foreground ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`}>{row.label}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className={cn(`py-2.5 px-3 text-center ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`,
                        j === 1 ? "text-amber-400 font-medium" : "text-foreground/60")}
                        style={j === 1 ? { background: "rgba(245,158,11,0.03)" } : {}}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
    <CopyTradingLayout title={t("copyTrading.tabAutoCopy", "Auto-Copy Strategy")}>
      <CopyGate wallet={wallet} userLoading={userQ.isLoading} userId={userId}>
        {(uid) => <AutoCopyInner userId={uid} />}
      </CopyGate>
    </CopyTradingLayout>
  );
}
