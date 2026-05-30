/**
 * Hyperliquid 合约跟单 — shared building blocks.
 *
 * Risk-tier mapping, leader/signal normalizers, network toggle, and the
 * one-click-copy hook. All data flows through the typed engine client
 * (`@app/lib/engine`) and the HL react-query hooks (`@app/lib/engine-hooks`).
 * No mocked arrays.
 */

import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@app/lib/utils";
import { useToast } from "@app/hooks/use-toast";
import { queryClient } from "@app/lib/queryClient";
import { hyperliquid, type HlLeader, type HlNetwork } from "@app/lib/engine";
import { Shield, Gauge, Flame, ArrowLeftRight } from "lucide-react";

// ─── Risk-tier mapping ───────────────────────────────────────────────────────
//
// HL leaders carry { score, medianHoldingS, isHft, label }. We bucket them into
// four trading-habit tiers (mirrors @one-agents/strategies PRESET_CATALOG risk
// tiers + an arbitrage bucket):
//
//   套利  arbitrage    → label hints at "arb"/"mm"/"market" (cross-venue / maker)
//   激进  aggressive   → isHft, OR a short median hold (< 15 min)
//   稳健  steady       → long median hold (≥ 2 h) AND a strong score (≥ 0.6)
//   保守  conservative → everything else (lower turnover / unscored / mid hold)
//
// Order of checks matters: arbitrage (explicit label) → aggressive (HFT/scalp)
// → steady (patient + proven) → conservative (default).

export type HlTier = "conservative" | "steady" | "aggressive" | "arbitrage";

export const HL_TIERS: HlTier[] = ["conservative", "steady", "aggressive", "arbitrage"];

export const TIER_META: Record<
  HlTier,
  { icon: typeof Shield; color: string; labelKey: string; descKey: string }
> = {
  conservative: { icon: Shield,        color: "#34d399", labelKey: "hl.tierConservative",    descKey: "hl.tierConservativeDesc" },
  steady:       { icon: Gauge,         color: "#60a5fa", labelKey: "hl.tierSteady",          descKey: "hl.tierSteadyDesc" },
  aggressive:   { icon: Flame,         color: "#f87171", labelKey: "hl.tierAggressive",      descKey: "hl.tierAggressiveDesc" },
  arbitrage:    { icon: ArrowLeftRight, color: "#c084fc", labelKey: "hl.tierArbitrage",       descKey: "hl.tierArbitrageDesc" },
};

const ARB_RE = /\b(arb|arbitrage|mm|maker|market.?mak|spread|basis|funding)\b/i;

export function tierOf(l: HlLeader): HlTier {
  const label = (l.label ?? "").toLowerCase();
  if (ARB_RE.test(label)) return "arbitrage";
  const holdS = l.medianHoldingS ?? null;
  if (l.isHft || (holdS != null && holdS < 15 * 60)) return "aggressive";
  const score = l.score ?? 0;
  if (holdS != null && holdS >= 2 * 3600 && score >= 0.6) return "steady";
  return "conservative";
}

export function groupByTier(leaders: HlLeader[]): Record<HlTier, HlLeader[]> {
  const out: Record<HlTier, HlLeader[]> = { conservative: [], steady: [], aggressive: [], arbitrage: [] };
  for (const l of leaders) out[tierOf(l)].push(l);
  // Within a tier, strongest score first.
  for (const k of HL_TIERS) out[k].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return out;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

export function shortAddr(a: string): string {
  return a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "—";
}

export function fmtUsd(n: number, digits = 2): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function fmtHold(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export function fmtScore(score: number | null): string {
  return score == null ? "—" : (score * 100).toFixed(0);
}

export function fmtTimeAgo(iso: string, t: (k: string, d?: string, o?: any) => string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const m = Math.floor(ms / 60000);
  if (m < 1) return t("hl.justNow", "now");
  if (m < 60) return t("hl.minAgo", "{{n}}m", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("hl.hourAgo", "{{n}}h", { n: h });
  return t("hl.dayAgo", "{{n}}d", { n: Math.floor(h / 24) });
}

// ─── Network toggle (segmented control) ──────────────────────────────────────

export function NetworkToggle({
  value, onChange,
}: { value: HlNetwork; onChange: (n: HlNetwork) => void }) {
  const { t } = useTranslation();
  const opts: { id: HlNetwork; labelKey: string }[] = [
    { id: "mainnet", labelKey: "hl.mainnet" },
    { id: "testnet", labelKey: "hl.testnet" },
  ];
  return (
    <div className="inline-flex gap-1 rounded-xl border border-border/55 bg-card/60 p-1 surface-3d">
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-[12px] font-bold tracking-wide transition-colors",
              active
                ? "bg-gradient-to-br from-amber-500/20 via-amber-600/15 to-amber-700/10 ring-1 ring-amber-500/35 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(o.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

// ─── One-click copy ──────────────────────────────────────────────────────────
//
// Attempts POST /v1/users/:userId/hl/subscriptions. That route is NOT on the
// Bearer plane yet (hl-read.ts is read-only), so the engine returns 404/405.
// We detect that case and surface a clear "pending engine endpoint" toast
// instead of faking success. When the backend ships the create route this
// starts working with zero front-end changes.

export function isEndpointMissing(err: unknown): boolean {
  const s = String((err as any)?.message ?? err);
  return /\b(404|405|not.?found|method.?not.?allowed|no_route|route)\b/i.test(s);
}

export function useHlCopy(userId: string | undefined, network: HlNetwork) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (leader: HlLeader) => {
      if (!userId) throw new Error("no_user");
      return hyperliquid.subscribeCreate(userId, {
        leaderAddress: leader.address,
        network,
        // Sensible defaults; the engine create route will validate/clamp.
        notionalRatio: 0.1,
        maxLeverage: 3,
      });
    },
    onSuccess: () => {
      toast({ title: t("hl.copyStarted"), description: t("hl.copyStartedDesc") });
      if (userId) queryClient.invalidateQueries({ queryKey: ["engine", "hl", "subs", userId] });
    },
    onError: (err: unknown) => {
      // Not onboarded yet → guide the user to 开通 instead of a raw error string.
      if (String((err as any)?.message ?? err) === "no_user") {
        toast({
          title: t("hl.needOnboard", "请先开通交易账户"),
          description: t("hl.needOnboardDesc", "在上方点击「开通交易账户」后即可一键跟单。"),
        });
        return;
      }
      if (isEndpointMissing(err)) {
        toast({
          title: t("hl.copyPending"),
          description: t("hl.copyPendingDesc"),
        });
        return;
      }
      toast({ title: t("common.error"), description: String((err as any)?.message ?? err), variant: "destructive" });
    },
  });

  return {
    copy: (leader: HlLeader) => mutation.mutate(leader),
    pendingFor: mutation.isPending ? (mutation.variables as HlLeader | undefined)?.address : undefined,
  };
}

// ─── State atoms ─────────────────────────────────────────────────────────────

export function HlEmpty({ icon: Icon, title, desc }: { icon: typeof Shield; title: string; desc?: string }) {
  return (
    <div className="py-12 text-center">
      <Icon className="h-9 w-9 text-muted-foreground/25 mx-auto mb-3" />
      <p className="text-sm text-foreground/60">{title}</p>
      {desc && <p className="mt-1 text-[12px] text-muted-foreground/60 max-w-xs mx-auto">{desc}</p>}
    </div>
  );
}
