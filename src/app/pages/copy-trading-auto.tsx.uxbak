/**
 * Strategy copy-trading — One-click Auto-Copy (一键自动跟单), at
 * /copy-trading/auto.
 *
 * Pick a risk preset, then one-click activate. Activation prefers the engine's
 * recommendation preset onboarding (`recommendations.onboardPreset`) and falls
 * back to a direct copy-subscription create (`copySubscriptions.create`).
 * Active subscriptions are listed from `useCopySubs`.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Scale, Flame, Zap, Check, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@app/lib/utils";
import { useToast } from "@app/hooks/use-toast";
import { queryClient } from "@app/lib/queryClient";
import { useEngineUser, useCopySubs } from "@app/lib/engine-hooks";
import { recommendations, copySubscriptions } from "@app/lib/engine";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { CopyGate, SectionEmpty, asArray } from "@app/components/copy-trading/shared";

interface PresetDef { key: string; nameKey: string; descKey: string; icon: typeof Shield; color: string; }

const PRESETS: PresetDef[] = [
  { key: "conservative", nameKey: "copyTrading.presetConservative", descKey: "copyTrading.presetConservativeDesc", icon: Shield, color: "#4ade80" },
  { key: "balanced",     nameKey: "copyTrading.presetBalanced",     descKey: "copyTrading.presetBalancedDesc",     icon: Scale,  color: "#fbbf24" },
  { key: "aggressive",   nameKey: "copyTrading.presetAggressive",   descKey: "copyTrading.presetAggressiveDesc",   icon: Flame,  color: "#f87171" },
];

function AutoCopyInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>("balanced");

  // Engine presets — used to map a chosen risk level to a real preset id when
  // available. If the endpoint isn't live, the static cards still work.
  const presetsQ = useQuery({
    queryKey: ["engine", "rec-presets"],
    queryFn: () => recommendations.presets(),
    staleTime: 300_000,
    retry: false,
  });
  const enginePresets = asArray(presetsQ.data);

  const subsQ = useCopySubs(userId);
  const subs = asArray(subsQ.data);

  const activate = useMutation({
    mutationFn: async (presetKey: string) => {
      // Resolve a matching engine preset id (by id / key / name), else send the key.
      const match = enginePresets.find((p: any) => {
        const id = String(p?.id ?? p?.key ?? p?.preset ?? p?.name ?? "").toLowerCase();
        return id.includes(presetKey);
      });
      const presetId = String((match as any)?.id ?? (match as any)?.key ?? presetKey);
      const body = { preset: presetId, riskPreset: presetKey };
      try {
        return await recommendations.onboardPreset(userId, body);
      } catch {
        // Fallback: create a copy subscription directly from the preset.
        return await copySubscriptions.create(userId, { preset: presetId, riskPreset: presetKey, autoCopy: true });
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
    <div className="space-y-4">
      <div className="premium-card rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11"
            style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(180,90,10,0.12))", border: "1px solid rgba(251,191,36,0.4)" }}>
            <Zap className="h-5 w-5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground" style={{ fontFamily: "'Orbitron', 'Space Grotesk', sans-serif" }}>
              {t("copyTrading.autoCopyTitle")}
            </h2>
            <p className="mt-1 text-[12px] text-foreground/55 leading-relaxed">{t("copyTrading.autoCopyDesc")}</p>
          </div>
        </div>

        <div>
          <h3 className="text-[11px] uppercase tracking-wider text-foreground/40 font-semibold mb-2">{t("copyTrading.pickPreset")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PRESETS.map((p) => {
              const Icon = p.icon;
              const isSel = selected === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setSelected(p.key)}
                  className={cn(
                    "text-left rounded-xl p-3 border transition-all",
                    isSel ? "ring-1 ring-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-600/10 to-transparent border-amber-500/40"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="h-4 w-4" style={{ color: p.color }} />
                    <span className="text-[13px] font-bold text-foreground/90">{t(p.nameKey)}</span>
                    {isSel && <Check className="h-3.5 w-3.5 text-amber-300 ml-auto" />}
                  </div>
                  <p className="text-[11px] text-foreground/50 leading-snug">{t(p.descKey)}</p>
                </button>
              );
            })}
          </div>
        </div>

        <Button
          className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold"
          onClick={() => activate.mutate(selected)}
          disabled={activate.isPending}
        >
          {activate.isPending ? (
            <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{t("copyTrading.autoCopyActivating")}</>
          ) : (
            <><Zap className="h-4 w-4 mr-1.5" />{t("copyTrading.autoCopyActivate")}</>
          )}
        </Button>
      </div>

      {/* Active subscriptions */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-foreground/40 font-semibold mb-2">{t("copyTrading.activeSubs")}</h3>
        {subsQ.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : subs.length === 0 ? (
          <SectionEmpty icon={Users} title={t("copyTrading.noActiveSubs")} />
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
                      {t("copyTrading.stopSub")}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
    <CopyTradingLayout title={t("copyTrading.tabAutoCopy")}>
      <CopyGate wallet={wallet} userLoading={userQ.isLoading} userId={userId}>
        {(uid) => <AutoCopyInner userId={uid} />}
      </CopyGate>
    </CopyTradingLayout>
  );
}
