/**
 * Hyperliquid 合约跟单 — shared building blocks.
 *
 * Risk-tier mapping, leader/signal normalizers, network toggle, and the
 * one-click-copy hook. All data flows through the typed engine client
 * (`@app/lib/engine`) and the HL react-query hooks (`@app/lib/engine-hooks`).
 * No mocked arrays.
 */

import { useCallback, useState } from "react";
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
    <div className="inline-flex gap-1 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-1">
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-[12px] font-bold tracking-wide transition-colors",
              active
                ? "bg-gradient-to-b from-amber-400 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                : "text-white/55 hover:text-white/90",
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

/** The engine refuses to start an *active* follow on an unfunded HL account
 *  (400 insufficient_funds). Surface this as a "请先充值" prompt, not an error. */
export function isInsufficientFunds(err: unknown): boolean {
  return /insufficient_funds|fund your hyperliquid|account value/i.test(String((err as any)?.message ?? err));
}

/** Per-follow risk configuration — preset by a strategy pack (or a custom dialog). */
export interface HlFollowConfig {
  /** Fraction of the leader's notional mirrored per trade (0–1). */
  notionalRatio: number;
  /** Hard cap on leverage applied to mirrored positions. */
  maxLeverage: number;
  /** Auto take-profit on the mirrored position (%, null = off). */
  takeProfitPct?: number | null;
  /** Auto stop-loss on the mirrored position (%, null = off). */
  stopLossPct?: number | null;
  /** Per-trade notional cap (USD). Omit = engine default. */
  notionalCapUsd?: number;
  /** Daily notional cap (USD). Omit = engine default. */
  dailyCapUsd?: number;
  /** Coin whitelist (e.g. ["BTC","ETH","SOL"]). Empty = all coins. */
  allowedCoins?: string[];
  /**
   * Execution profile (执行器档): mirror|steady|aggressive|smart.
   * Omit = engine default 'mirror' (现有行为不变). The engine create route
   * whitelist-validates this against hl-executors EXECUTOR_IDS.
   */
  executorId?: HlExecutorId;
}

/** HL 执行器档(与后端 hl-executors.ts 的 ExecutorId 对齐)。 */
export type HlExecutorId = "mirror" | "steady" | "aggressive" | "smart";

export const HL_DEFAULT_FOLLOW: HlFollowConfig = {
  notionalRatio: 0.1,
  maxLeverage: 3,
  takeProfitPct: null,
  stopLossPct: null,
};

interface CopyVars {
  leader: HlLeader;
  config: HlFollowConfig;
}

type CopyOutcome = "ok" | "no_user" | "pending" | "funds" | "error";

export function useHlCopy(userId: string | undefined, network: HlNetwork) {
  const { t } = useTranslation();
  const { toast } = useToast();
  // We track the in-flight leader ourselves so a *batch* (copyMany) can surface
  // a single spinner per row while it walks the selection sequentially.
  const [pendingFor, setPendingFor] = useState<string | undefined>(undefined);
  const [batchPending, setBatchPending] = useState(false);

  // Raw follow request — shared by single + batch flows so the request shape
  // stays in one place. Throws a typed error the callers categorize.
  const submit = useCallback(
    async (leader: HlLeader, config: HlFollowConfig): Promise<CopyOutcome> => {
      if (!userId) throw new Error("no_user");
      await hyperliquid.subscribeCreate(userId, {
        leaderAddress: leader.address,
        network,
        // Pack/custom risk params; the engine create route validates/clamps.
        notionalRatio: config.notionalRatio,
        maxLeverage: config.maxLeverage,
        takeProfitPct: config.takeProfitPct ?? undefined,
        stopLossPct: config.stopLossPct ?? undefined,
        notionalCapUsd: config.notionalCapUsd,
        dailyCapUsd: config.dailyCapUsd,
        allowedCoins: config.allowedCoins && config.allowedCoins.length > 0 ? config.allowedCoins : undefined,
        // 执行器档:省略 → 后端默认 'mirror'(现有行为不变);后端白名单校验。
        executorId: config.executorId,
      });
      return "ok";
    },
    [userId, network],
  );

  const categorize = useCallback((err: unknown): CopyOutcome => {
    if (String((err as any)?.message ?? err) === "no_user") return "no_user";
    if (isInsufficientFunds(err)) return "funds";
    if (isEndpointMissing(err)) return "pending";
    return "error";
  }, []);

  const invalidate = useCallback(() => {
    if (userId) queryClient.invalidateQueries({ queryKey: ["engine", "hl", "subs", userId] });
  }, [userId]);

  // Single follow — one toast per the categorized outcome (unchanged UX).
  const copy = useCallback(
    async (leader: HlLeader, config: HlFollowConfig) => {
      setPendingFor(leader.address);
      try {
        await submit(leader, config);
        toast({ title: t("hl.copyStarted"), description: t("hl.copyStartedDesc") });
        invalidate();
      } catch (err) {
        const kind = categorize(err);
        if (kind === "no_user") {
          toast({ title: t("hl.needOnboard", "请先开通交易账户"), description: t("hl.needOnboardDesc", "在上方点击「开通交易账户」后即可一键跟单。") });
        } else if (kind === "funds") {
          toast({ title: t("hl.needFunds", "余额不足,请先充值"), description: t("hl.needFundsDesc", "请先充值 USDC 到 HL 交易账户,有余额后即可开始跟单。") });
        } else if (kind === "pending") {
          toast({ title: t("hl.copyPending"), description: t("hl.copyPendingDesc") });
        } else {
          toast({ title: t("common.error"), description: String((err as any)?.message ?? err), variant: "destructive" });
        }
      } finally {
        setPendingFor(undefined);
      }
    },
    [submit, categorize, invalidate, toast, t],
  );

  // Batch follow — walks the selection sequentially (no request bursts) and
  // emits a SINGLE summarized toast instead of one per leader. Returns the set
  // of leader addresses that succeeded so the caller can keep failed ones.
  const copyMany = useCallback(
    async (leaders: HlLeader[], config: HlFollowConfig): Promise<Set<string>> => {
      const succeeded = new Set<string>();
      if (leaders.length === 0) return succeeded;
      // Single follow → defer to copy() so the user gets the precise toast.
      if (leaders.length === 1) {
        await copy(leaders[0], config);
        return succeeded; // caller treats single via copy()'s own UX
      }
      setBatchPending(true);
      let okCount = 0, pendingCount = 0, errCount = 0, needOnboard = false, needFunds = false;
      let lastErr: unknown;
      try {
        for (const leader of leaders) {
          setPendingFor(leader.address);
          try {
            await submit(leader, config);
            okCount += 1;
            succeeded.add(leader.address.toLowerCase());
          } catch (err) {
            const kind = categorize(err);
            if (kind === "no_user") { needOnboard = true; break; }
            if (kind === "funds") { needFunds = true; break; }
            if (kind === "pending") pendingCount += 1;
            else { errCount += 1; lastErr = err; }
          }
        }
      } finally {
        setPendingFor(undefined);
        setBatchPending(false);
        invalidate();
      }
      // One summarized toast, priority: onboard > funds > started > pending > error.
      if (needOnboard) {
        toast({ title: t("hl.needOnboard", "请先开通交易账户"), description: t("hl.needOnboardDesc", "在上方点击「开通交易账户」后即可一键跟单。") });
      } else if (needFunds) {
        toast({ title: t("hl.needFunds", "余额不足,请先充值"), description: t("hl.needFundsDesc", "请先充值 USDC 到 HL 交易账户,有余额后即可开始跟单。") });
      } else if (okCount > 0) {
        toast({ title: t("hl.copyStarted"), description: t("hl.copyStartedBatch", "已开始跟单 {{count}} 个策略", { count: okCount }) });
      } else if (pendingCount > 0) {
        toast({ title: t("hl.copyPending"), description: t("hl.copyPendingDesc") });
      } else if (errCount > 0) {
        toast({ title: t("common.error"), description: String((lastErr as any)?.message ?? lastErr), variant: "destructive" });
      }
      return succeeded;
    },
    [copy, submit, categorize, invalidate, toast, t],
  );

  return { copy, copyMany, pendingFor, batchPending };
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
