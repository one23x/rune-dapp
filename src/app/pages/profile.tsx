import { useMemo, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageEnter, PageEnterStagger, PageEnterItem } from "@app/components/page-enter";
import { useActiveAccount } from "thirdweb/react";
import {
  Copy, Check, ChevronRight, Bell, Settings, History, GitBranch, Server, Share2,
  ArrowLeftRight, User, Vault, Lock, Flame, TrendingUp, Coins, Wallet, Gift,
} from "lucide-react";
import { useToast } from "@app/hooks/use-toast";
import { copyText } from "@app/lib/copy";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { usePersonalStats } from "@/hooks/rune/use-team";
import { buildReferralUrl } from "@/hooks/rune/use-referral-param";
import { useUserPurchase } from "@/hooks/rune/use-node-presell";
import { NoNodeReminder } from "@/components/rune/no-node-reminder";
import { useNodeMembershipsRune } from "@app/lib/data-rune";
import {
  useEngineUser, usePusdBalance, useOrders, useCopySubs, useHlAccount, useHlSubs,
} from "@app/lib/engine-hooks";
import { asArray, pusdAmount, normalizeOrder, isClosed, fmtUsd } from "@app/components/copy-trading/shared";
import { Activity, Layers } from "lucide-react";

// MENU_ITEMS deliberately omits the "Referral & Team" entry — it lives
// above as a prominent top-level CTA button (see ~line 440), so showing
// it again here would just duplicate. Re-add only if the prominent CTA
// is removed.
const MENU_ITEMS = [
  { labelKey: "profile.myNodesLabel",      icon: Server,         path: "/profile/nodes",        descKey: "profile.nodeManagementDesc" },
  { labelKey: "profile.myVaultPositions",  icon: Vault,          path: "/profile/vault",        descKey: "profile.myVaultPositionsDesc" },
  { labelKey: "profile.swap",              icon: ArrowLeftRight, path: "/profile/swap",         descKey: "profile.swapDesc" },
  { labelKey: "profile.notifications",     icon: Bell,           path: "/profile/notifications", descKey: "profile.notificationsDesc" },
  { labelKey: "profile.settings",          icon: Settings,       path: "/profile/settings",     descKey: "profile.settingsDesc" },
];

// Mirrors `src/lib/thirdweb/contracts.ts NODE_META`. RUNE nodes have NO
// daily yield — the only earnings are direct-referral commission paid
// on-chain when a downline buys a node (rate set per tier on-chain).
const NODE_ID_TO_TIER: Record<number, string> = {
  101: "FOUNDER",
  201: "SUPER",
  301: "ADVANCED",
  401: "MID",
  501: "INITIAL",
};
const TIER_COLOR: Record<string, string> = {
  FOUNDER:  "hsl(266 60% 70%)",
  SUPER:    "hsl(38 95% 60%)",
  ADVANCED: "hsl(160 64% 55%)",
  MID:      "hsl(217 76% 64%)",
  INITIAL:  "hsl(215 28% 75%)",
};
const TIER_PRICE: Record<string, number> = {
  FOUNDER: 50000, SUPER: 10000, ADVANCED: 5000, MID: 2500, INITIAL: 1000,
};

import { fmtUsdtCompact } from "@/lib/format";

/** Locale-aware compact USDT — Chinese uses 百/千/万/十万/百万/千万/亿, other locales K/M. */
function fmtUsdt(v: number) {
  return fmtUsdtCompact(v, { maxFrac: 2 });
}

/** Smooth eased count-up from 0 to `target` on mount. */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    let startedAt = 0;
    const tick = (ts: number) => {
      if (!startedAt) startedAt = ts;
      const progress = Math.min(1, (ts - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function AnimUsdt({ value }: { value: number }) {
  const v = useCountUp(value);
  return <>{fmtUsdt(v)}</>;
}

/**
 * Profile main page. All earnings figures are USDT — RUNE token isn't
 * listed yet, so the only on-chain currency flowing today is USDT (paid
 * to direct referrers when a downline buys a node). RUNE/FIRE columns
 * stay as pre-launch placeholders until the lock + burn contracts ship.
 *
 * Data sources (each KPI footnoted in the UI):
 *  • directCommission / teamCommission → on-chain `usePersonalStats`
 *    (rune_referrers + rune_purchases joined by indexer GraphQL)
 *  • my-node investment + tier breakdown → `rune_purchases` filtered to
 *    the connected wallet
 *  • daily-yield estimate → tier × daily-rate × count (PROJECTION; the
 *    settlement contracts aren't live yet)
 */
/**
 * Engine copy-trading summary — surfaces live One-Agents Engine data on the
 * profile: HL account value + open positions (useHlAccount), Polymarket pUSD
 * balance + copy-subscription count, and a copy-trading performance summary
 * derived from the local order history (useOrders). Real data only; gracefully
 * hides itself when the wallet has no engine user / no HL account.
 */
function EngineSummaryCard({ wallet }: { wallet: string }) {
  const { t } = useTranslation();
  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;

  const balanceQ = usePusdBalance(userId);
  const ordersQ = useOrders(userId);
  const pmSubsQ = useCopySubs(userId);
  const hlAcctQ = useHlAccount(wallet, "mainnet");
  const hlSubsQ = useHlSubs(userId);

  const pusd = pusdAmount(balanceQ.data);
  const orders = useMemo(() => asArray(ordersQ.data).map(normalizeOrder), [ordersQ.data]);
  const closed = orders.filter(isClosed).filter((o) => o.pnl != null);
  const wins = closed.filter((o) => (o.pnl ?? 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
  const realizedPnl = closed.reduce((s, o) => s + (o.pnl ?? 0), 0);

  const pmSubCount = asArray(pmSubsQ.data).filter((s: any) => s?.status !== "stopped").length;
  const hlSubCount = (hlSubsQ.data?.subscriptions ?? []).filter((s: any) => s?.status !== "stopped").length;
  const hlAcctVal = hlAcctQ.data?.accountValue ?? 0;
  const hlOpen = hlAcctQ.data?.positions.length ?? 0;

  // While the engine user is resolving, hold a slot so the card doesn't pop in.
  if (userQ.isLoading) return <div className="rounded-3xl h-40 surface-3d" />;
  // No engine user → nothing to surface here (the copy-trading entry handles onboarding).
  if (!userId) return null;

  return (
    <div
      className="surface-3d relative overflow-hidden rounded-3xl border border-amber-500/35 p-4"
      style={{
        background: "linear-gradient(135deg, rgba(40,30,8,0.75), rgba(20,15,8,0.90) 60%, rgba(10,8,4,0.95))",
        boxShadow:
          "inset 0 1px 0 rgba(251,191,36,0.20), inset 0 -1px 0 rgba(0,0,0,0.25), 0 8px 24px -10px rgba(251,191,36,0.20), 0 18px 40px -16px rgba(0,0,0,0.50)",
      }}
    >
      <div className="pointer-events-none absolute -top-16 -right-8 h-44 w-44 rounded-full bg-amber-400/[0.18] blur-[70px]" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[11px] text-amber-200/85 font-bold uppercase tracking-[0.18em]">
              {t("profile.engineSummary", "Copy-Trading")}
            </span>
          </div>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/45">
            {t("profile.engineLive", "live")}
          </span>
        </div>

        {/* HL — account value + open positions */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-2xl px-3 py-3 ring-1 ring-sky-400/35"
            style={{ background: "linear-gradient(160deg, rgba(56,189,248,0.14), rgba(8,47,73,0.10) 60%, rgba(0,0,0,0.20))" }}
          >
            <div className="flex items-center gap-1 mb-1.5">
              <Layers className="h-3 w-3 text-sky-300" />
              <span className="text-[10px] uppercase tracking-wider text-sky-200/85 font-bold">{t("profile.hlAccount", "HL Account")}</span>
            </div>
            <div className="text-[16px] font-black text-sky-200 tabular-nums leading-tight">
              {hlAcctQ.isLoading ? "…" : fmtUsd(hlAcctVal)}
            </div>
            <div className="text-[10px] text-sky-300/70 mt-0.5">{hlOpen} {t("profile.hlOpenPositions", "open positions")}</div>
          </div>

          {/* Polymarket — pUSD balance + subscriptions */}
          <div
            className="rounded-2xl px-3 py-3 ring-1 ring-amber-400/40"
            style={{ background: "linear-gradient(160deg, rgba(251,191,36,0.16), rgba(120,80,10,0.10) 60%, rgba(0,0,0,0.20))" }}
          >
            <div className="flex items-center gap-1 mb-1.5">
              <Coins className="h-3 w-3 text-amber-300" />
              <span className="text-[10px] uppercase tracking-wider text-amber-200/85 font-bold">{t("profile.pmBalance", "pUSD")}</span>
            </div>
            <div className="text-[16px] font-black text-amber-200 tabular-nums leading-tight">
              {balanceQ.isLoading ? "…" : fmtUsd(pusd)}
            </div>
            <div className="text-[10px] text-amber-300/70 mt-0.5">{pmSubCount + hlSubCount} {t("profile.copySubs", "follows")}</div>
          </div>
        </div>

        {/* Copy-trading performance summary (from local order history) */}
        <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-border/30">
          <div className="text-center">
            <div className={`text-[15px] font-black tabular-nums ${realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtUsd(realizedPnl)}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{t("profile.realizedPnl", "Realized PnL")}</div>
          </div>
          <div className="text-center">
            <div className="text-[15px] font-black tabular-nums num-gold">{closed.length > 0 ? `${winRate.toFixed(0)}%` : "—"}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{t("profile.winRate", "Win Rate")}</div>
          </div>
          <div className="text-center">
            <div className="text-[15px] font-black tabular-nums">{orders.length}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{t("profile.totalTrades", "Trades")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const walletAddr = account?.address || "";
  const isConnected = !!walletAddr;

  const { data: stats, isLoading: statsLoading } = usePersonalStats(isConnected ? walletAddr : undefined);
  const { data: memberships = [], isLoading: nodesLoading } = useNodeMembershipsRune();
  const { hasPurchased: chainHasPurchased, isLoading: purchaseLoading } = useUserPurchase(walletAddr);

  // One-shot "no node yet" reminder — pops once when a bound user lands on
  // /app/profile without owning a node. Wait for both signals (chain +
  // GraphQL stats) before deciding so we don't flash open then closed.
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const dbHasPurchased = !!stats?.hasPurchased;
  const ownsNode = chainHasPurchased || dbHasPurchased || memberships.length > 0;
  useEffect(() => {
    if (!isConnected) return;
    if (statsLoading || purchaseLoading) return;
    if (reminderDismissed) return;
    if (!ownsNode) setReminderOpen(true);
  }, [isConnected, statsLoading, purchaseLoading, ownsNode, reminderDismissed]);
  // Reset dismissed flag when wallet changes.
  useEffect(() => { setReminderDismissed(false); }, [walletAddr]);

  // Commission rewards are stored on-chain as 18-decimal USDT (`uint256`).
  const directCommissionUsdt = useMemo(
    () => stats ? Number(stats.directCommission) / 1e18 : 0,
    [stats],
  );
  const teamCommissionUsdt = useMemo(
    () => stats ? Number(stats.teamCommission) / 1e18 : 0,
    [stats],
  );

  // Node ownership — read from BOTH sources and union them, because the
  // GraphQL `usePersonalStats.ownedNodeId` (used by OverviewTab) and the
  // Supabase `useNodeMembershipsRune` (queried directly here) can drift if
  // the indexer trails the on-chain event by a few blocks. Whichever
  // source sees a tier first wins; this matches whatever the user already
  // sees on /app/profile/nodes.
  const ownTierFromStats   = stats?.ownedNodeId && NODE_ID_TO_TIER[stats.ownedNodeId] ? NODE_ID_TO_TIER[stats.ownedNodeId] : null;
  const ownTierFromMembers = memberships.length > 0 ? memberships[0].nodeType : null;
  const ownTierLabel = ownTierFromStats ?? ownTierFromMembers;
  const ownTierColor = ownTierLabel ? TIER_COLOR[ownTierLabel] : "hsl(215 28% 65%)";

  const investedUsdt = ownTierLabel ? (TIER_PRICE[ownTierLabel] ?? 0) : 0;
  const nodeCount    = ownTierLabel ? 1 : 0; // RUNE = one node per wallet.

  // RUNE nodes don't pay daily yield — earnings come exclusively from the
  // direct-referral commission paid on-chain when a downline buys a node.
  // 总收益 = directCommissionUsdt (real, USDT, on-chain).
  const totalEarnings = directCommissionUsdt;

  // Match mainnet's referral URL format — `useReferralParam` reads
  // `?ref=` (and `?referrer=`) from the query string, so the link must
  // be built the same way. `buildReferralUrl` is the canonical helper.
  const referralLink = useMemo(() => buildReferralUrl(walletAddr), [walletAddr]);

  // Inline button feedback — shows a green check + "Copied" label inside
  // the button itself for 1.5s after a successful copy. This is the
  // primary feedback channel because toast notifications get hidden by
  // the Huawei system overlay or by status-bar masking. Toast still
  // fires as a secondary signal for users on devices where it works.
  const [copied, setCopied] = useState(false);
  const copyToClipboard = async (text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      toast({ title: t("common.copied", "Copied"), description: t("common.copiedDesc", "Copied to clipboard") });
    } else {
      toast({
        title: t("common.copyFailed", "Copy failed"),
        description: t("common.copyFailedDesc", "Long-press the link above to select & copy manually."),
        variant: "destructive",
      });
    }
  };
  // Share: navigator.share exists on Huawei browsers but frequently
  // silent-fails (resolves with no system sheet shown). Strategy:
  //   1. canShare() probe — Huawei often returns false here, letting
  //      us skip the broken path entirely.
  //   2. Catch real errors. AbortError = user dismissed the sheet;
  //      everything else (NotAllowedError / DataError) means share
  //      never happened, so we fall back to copy + toast.
  const shareReferralLink = async () => {
    if (!referralLink) return;
    const data = {
      title: "RUNE PROTOCOL",
      text: t("profile.inviteFriendsDesc", "Invite friends to RUNE PROTOCOL"),
      url: referralLink,
    };
    const canUseShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (typeof navigator.canShare !== "function" || navigator.canShare(data));
    if (canUseShare) {
      try {
        await navigator.share(data);
        return; // OS sheet handled it.
      } catch (err) {
        // User dismissed — don't fall back, don't toast.
        if ((err as { name?: string })?.name === "AbortError") return;
        // Any other error → the share never actually happened, fall
        // through to copy.
      }
    }
    await copyToClipboard(referralLink);
  };

  const shortAddr = walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : "";

  return (
    <PageEnter>
    <div className="pb-24 lg:pb-8 lg:pt-4" data-testid="page-profile">

      {/* Hero header — stronger amber wash, layered glows */}
      <div className="relative overflow-hidden border-b border-amber-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.18),transparent_60%)] pointer-events-none" />
        <div className="absolute -top-20 -right-10 h-64 w-64 rounded-full bg-amber-500/[0.12] blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full bg-amber-600/[0.08] blur-[70px] pointer-events-none" />
        <div className="relative px-4 lg:px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center shrink-0 ring-2 ring-amber-400/60"
              style={{
                background: "linear-gradient(135deg, hsl(43,90%,58%), hsl(38,85%,42%))",
                boxShadow: "0 6px 24px hsl(38_95%_55%/0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              <User className="h-7 w-7 text-black/80" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              {!isConnected ? (
                <div className="text-[15px] font-bold text-foreground/70">{t("common.notConnected", "Not connected")}</div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-black text-foreground tracking-tight" data-testid="text-wallet-address">{shortAddr}</span>
                    <button onClick={() => copyToClipboard(walletAddr)} className="p-1 rounded-md transition-colors hover:bg-amber-500/15" data-testid="button-copy-address">
                      <Copy className="h-3.5 w-3.5 text-amber-300" />
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-foreground/45 truncate">{walletAddr}</div>
                </>
              )}
              {/* Node tier inline */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5 rounded-lg ring-1 ring-amber-400/30 bg-amber-500/[0.08] px-2.5 py-1">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-amber-200/70 font-bold">
                    {t("profile.nodeTier", "Node")}
                  </span>
                  {!isConnected ? (
                    <span className="text-[12px] font-bold text-foreground/30">--</span>
                  ) : ownTierLabel ? (
                    <span className="text-[12px] font-black tabular-nums tracking-wide" style={{ color: ownTierColor, textShadow: `0 0 12px ${ownTierColor}` }} data-testid="text-node-tier">
                      {ownTierLabel}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-foreground/50">
                      {t("profile.noNode", "Not held")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 pt-3 space-y-3">

        {/* ── 总收益 = 质押收益 + 推广收益（pre-launch 占位，质押开放后写入实数）── */}
        <div
          className="gold-ring relative overflow-hidden rounded-3xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(60,40,8,0.85), rgba(28,20,8,0.95) 60%, rgba(14,10,4,0.98))",
          }}
        >
          <div className="pointer-events-none absolute -top-24 -right-12 h-64 w-64 rounded-full bg-amber-400/[0.30] blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-amber-600/[0.18] blur-[70px]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
          <div className="relative z-[2]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-300" />
                  <span className="text-[11px] text-amber-200/85 font-bold uppercase tracking-[0.18em]">
                    {t("profile.totalEarnings", "Total Earnings")}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 ring-1 ring-emerald-500/45 text-emerald-300">USDT</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 ring-1 ring-orange-500/45 text-orange-300">FIRE</span>
                </div>
                <div
                  className="num-shimmer text-[30px] leading-none font-black tabular-nums tracking-tight"
                  style={{ filter: "drop-shadow(0 0 18px hsl(38 100% 55% / 0.45)) drop-shadow(0 1px 0 rgba(0,0,0,0.4))" }}
                  data-testid="text-total-earnings"
                >
                  $0.00
                </div>
                <div className="text-[10px] text-amber-100/55 mt-2">
                  {t("profile.totalEarningsSource", "Staking + V-level referral · pre-launch")}
                </div>
              </div>
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ring-2 ring-amber-400/55"
                style={{
                  background: "linear-gradient(135deg, rgba(251,191,36,0.30), rgba(180,90,10,0.20))",
                  boxShadow: "0 4px 18px hsl(38 95% 55% / 0.4), inset 0 1px 0 rgba(255,255,255,0.20)",
                }}
              >
                <Wallet className="h-5 w-5 text-amber-300" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              {/* 质押收益（USDT + FIRE） */}
              <div
                className="rounded-2xl px-3 py-3 ring-1 ring-emerald-400/35 transition-all duration-300 hover:ring-emerald-400/65 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-6px_rgba(34,197,94,0.45)]"
                style={{
                  background: "linear-gradient(160deg, rgba(34,197,94,0.16), rgba(20,80,40,0.10) 60%, rgba(0,0,0,0.20))",
                  boxShadow: "inset 0 1px 0 rgba(34,197,94,0.30), 0 4px 14px -6px rgba(34,197,94,0.30)",
                }}
              >
                <div className="flex items-center gap-1 mb-1.5">
                  <Coins className="h-3 w-3 text-emerald-300" />
                  <span className="text-[10px] uppercase tracking-wider text-emerald-200/85 font-bold">
                    {t("profile.stakingYield", "Staking")}
                  </span>
                  <span className="text-[8px] font-bold px-1 py-px rounded bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 ml-auto">
                    {t("profile.preLaunch", "Pre-launch")}
                  </span>
                </div>
                <div className="text-[16px] font-black text-emerald-200 tabular-nums leading-tight">$0.00</div>
                <div className="text-[10px] text-emerald-300/70 mt-0.5">+ 0 FIRE</div>
                <div className="text-[9px] text-emerald-300/55 mt-0.5">USDT 65% / FIRE 35%</div>
              </div>
              {/* 推广收益（V-level FIRE） */}
              <div
                className="rounded-2xl px-3 py-3 ring-1 ring-orange-400/40 transition-all duration-300 hover:ring-orange-400/70 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-6px_rgba(251,146,60,0.45)]"
                style={{
                  background: "linear-gradient(160deg, rgba(251,146,60,0.16), rgba(120,60,10,0.10) 60%, rgba(0,0,0,0.20))",
                  boxShadow: "inset 0 1px 0 rgba(251,146,60,0.30), 0 4px 14px -6px rgba(251,146,60,0.30)",
                }}
              >
                <div className="flex items-center gap-1 mb-1.5">
                  <GitBranch className="h-3 w-3 text-orange-300" />
                  <span className="text-[10px] uppercase tracking-wider text-orange-200/85 font-bold">
                    {t("profile.referralYield", "Referral")}
                  </span>
                  <span className="text-[8px] font-bold px-1 py-px rounded bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 ml-auto">
                    V-level
                  </span>
                </div>
                <div className="text-[16px] font-black text-orange-200 tabular-nums leading-tight">0 FIRE</div>
                <div className="text-[10px] text-orange-300/70 mt-0.5">{t("profile.directRate", "Direct")} 5% · {t("profile.teamRate", "Team")} 4-29%</div>
                <div className="text-[9px] text-orange-300/55 mt-0.5">USD-valued FIRE</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 节点业绩（独立段）— 节点推广奖励 USDT 链上实付 + 节点空投 RUNE 占位 ── */}
        <div
          className="surface-3d relative overflow-hidden rounded-3xl border border-amber-500/35 p-4 mt-3"
          style={{
            background: "linear-gradient(135deg, rgba(40,30,8,0.75), rgba(20,15,8,0.90) 60%, rgba(10,8,4,0.95))",
            boxShadow:
              "inset 0 1px 0 rgba(251,191,36,0.20), inset 0 -1px 0 rgba(0,0,0,0.25), 0 8px 24px -10px rgba(251,191,36,0.20), 0 18px 40px -16px rgba(0,0,0,0.50)",
          }}
        >
          <div className="pointer-events-none absolute -top-16 -right-8 h-44 w-44 rounded-full bg-amber-400/[0.18] blur-[70px]" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-[11px] text-amber-200/85 font-bold uppercase tracking-[0.18em]">
                  {t("profile.nodePerformance", "Node Performance")}
                </span>
              </div>
              {ownTierLabel && (
                <span className="text-[10px] font-black tabular-nums tracking-wide px-2 py-0.5 rounded-full ring-1" style={{ color: ownTierColor, borderColor: ownTierColor + "33", background: ownTierColor + "12", textShadow: `0 0 10px ${ownTierColor}` }}>
                  {ownTierLabel}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* 节点推广奖励 USDT — real on-chain directCommission */}
              <div
                className="rounded-2xl px-3 py-3 ring-1 ring-emerald-400/40 transition-all duration-300 hover:ring-emerald-400/70 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-6px_rgba(34,197,94,0.45)]"
                style={{
                  background: "linear-gradient(160deg, rgba(34,197,94,0.18), rgba(20,80,40,0.10) 60%, rgba(0,0,0,0.20))",
                  boxShadow: "inset 0 1px 0 rgba(34,197,94,0.32), 0 4px 14px -6px rgba(34,197,94,0.32)",
                }}
              >
                <div className="flex items-center gap-1 mb-1.5">
                  <Gift className="h-3 w-3 text-emerald-300" />
                  <span className="text-[10px] uppercase tracking-wider text-emerald-200/85 font-bold">
                    {t("profile.nodeReferralReward", "Node Referral")}
                  </span>
                  <span className="text-[8px] font-bold px-1 py-px rounded bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/45 ml-auto">on-chain</span>
                </div>
                <div className="num-gold text-[18px] font-black tabular-nums leading-tight" style={{ filter: "drop-shadow(0 0 10px hsl(142 70% 50% / 0.45))" }}>
                  <AnimUsdt value={directCommissionUsdt} />
                </div>
                <div className="text-[9px] text-emerald-300/65 mt-0.5">USDT · {t("profile.nodeReferralSub", "5-15% per tier")}</div>
              </div>
              {/* 节点空投 RUNE — pre-launch placeholder */}
              <div
                className="rounded-2xl px-3 py-3 ring-1 ring-amber-400/40 transition-all duration-300 hover:ring-amber-400/70 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-6px_rgba(251,191,36,0.45)]"
                style={{
                  background: "linear-gradient(160deg, rgba(251,191,36,0.16), rgba(120,80,10,0.10) 60%, rgba(0,0,0,0.20))",
                  boxShadow: "inset 0 1px 0 rgba(251,191,36,0.30), 0 4px 14px -6px rgba(251,191,36,0.30)",
                }}
              >
                <div className="flex items-center gap-1 mb-1.5">
                  <Coins className="h-3 w-3 text-amber-300" />
                  <span className="text-[10px] uppercase tracking-wider text-amber-200/85 font-bold">
                    {t("profile.nodeAirdrop", "Node Airdrop")}
                  </span>
                  <span className="text-[8px] font-bold px-1 py-px rounded bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 ml-auto">
                    {t("profile.preLaunch", "Pre-launch")}
                  </span>
                </div>
                <div className="text-[18px] font-black text-amber-200 tabular-nums leading-tight">0 RUNE</div>
                <div className="text-[9px] text-amber-300/65 mt-0.5">{t("profile.nodeAirdropSub", "4-stage unlock by pool TVL")}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Engine copy-trading summary (HL + Polymarket, live data) ── */}
        {isConnected && <EngineSummaryCard wallet={walletAddr} />}

        {/* Invite link card — same elevated treatment so it reads as a peer
            of the hero rather than a flat list item. */}
        {isConnected && referralLink && (
          <div
            className="rounded-2xl p-4 space-y-3 ring-1 ring-amber-500/30 surface-3d"
            style={{
              background: "linear-gradient(160deg, rgba(40,30,8,0.65), rgba(20,15,8,0.85) 70%, rgba(10,8,4,0.92))",
              boxShadow: "inset 0 1px 0 rgba(251,191,36,0.18), 0 8px 24px -10px rgba(251,191,36,0.20), 0 20px 40px -20px rgba(0,0,0,0.55)",
            }}>
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                {t("profile.inviteFriends", "Invite Link")}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 min-w-0 rounded-xl px-3 py-2.5 font-mono text-[11px] text-foreground/80 truncate ring-1 ring-border/40 bg-muted/15 select-all cursor-text"
                  // Long-press selectable on Huawei / Android browsers
                  // where the JS-driven copy may silently fail. Tapping
                  // the field selects everything so the user can use
                  // the OS-level copy menu as a manual escape hatch.
                  onClick={(e) => {
                    const r = document.createRange();
                    r.selectNodeContents(e.currentTarget);
                    const s = window.getSelection();
                    if (s) { s.removeAllRanges(); s.addRange(r); }
                  }}
                >
                  {referralLink}
                </div>
                <button
                  onClick={() => copyToClipboard(referralLink)}
                  className={`shrink-0 px-3 py-2.5 rounded-xl ring-1 transition-all active:scale-95 inline-flex items-center gap-1 ${
                    copied
                      ? "ring-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                      : "ring-border/50 bg-muted/20 hover:ring-primary/40 text-muted-foreground"
                  }`}
                  data-testid="button-copy-referral"
                  aria-live="polite"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span className="text-[11px] font-bold">{t("common.copied", "Copied")}</span>
                    </>
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={shareReferralLink}
                  className="shrink-0 px-3.5 py-2.5 rounded-xl font-medium transition-all hover:brightness-110 active:scale-95"
                  style={{ background: "linear-gradient(135deg, hsl(43,74%,50%), hsl(38,70%,40%))", boxShadow: "0 2px 8px hsl(38_95%_55%/0.25)" }}
                  data-testid="button-share-referral"
                >
                  <Share2 className="h-4 w-4 text-black" />
                </button>
              </div>
            </div>

            {/* 突出的"团队推荐"主入口 — 上一版用细描边小卡片，与下方 menu
                视觉权重一致, 用户反馈不够显眼。改为金色渐变 + 双层 ring +
                外发光阴影 + 大尺寸 icon, 与下方普通菜单形成明显层级差。 */}
            <button
              className="group relative w-full flex items-center gap-3.5 px-4 py-4 rounded-2xl text-left overflow-hidden
                         bg-gradient-to-br from-primary/[0.18] via-primary/[0.08] to-primary/[0.02]
                         ring-1 ring-primary/45
                         shadow-[0_0_0_1px_hsl(38_95%_55%/0.10)_inset,0_8px_24px_-8px_hsl(38_95%_55%/0.45),0_18px_36px_-18px_hsl(38_95%_55%/0.35)]
                         hover:from-primary/[0.28] hover:via-primary/[0.14] hover:ring-primary/65
                         active:scale-[0.985] transition-all"
              onClick={() => navigate("/profile/referral")}
              data-testid="menu-referral"
            >
              {/* 顶部金色高光 + 右上角光晕 */}
              <span aria-hidden className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent pointer-events-none" />
              <span aria-hidden className="absolute -top-12 -right-8 w-32 h-32 rounded-full bg-primary/12 blur-2xl pointer-events-none" />

              <div className="relative h-11 w-11 rounded-xl flex items-center justify-center shrink-0
                              bg-gradient-to-br from-primary/40 to-primary/15
                              ring-1 ring-primary/55 shadow-[0_0_18px_-4px_hsl(38_95%_55%/0.55)]
                              transition-all group-hover:scale-105 group-hover:shadow-[0_0_24px_-2px_hsl(38_95%_55%/0.75)]">
                <GitBranch className="h-5 w-5 text-primary drop-shadow-[0_0_8px_hsl(38_95%_55%/0.8)]" />
              </div>

              <div className="relative flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold text-foreground tracking-wide">
                    {t("profile.referralTeam", "Referral & Team")}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/40">
                    HOT
                  </span>
                </div>
                <div className="text-[11px] text-foreground/65 mt-0.5 tabular-nums">
                  {stats ? (
                    <>
                      <span className="text-primary font-semibold">{stats.directCount}</span>
                      <span className="text-muted-foreground/60"> {t("profile.direct", "direct")} · </span>
                      <span className="text-primary font-semibold">{stats.totalDownstreamCount}</span>
                      <span className="text-muted-foreground/60"> {t("profile.team", "team")}</span>
                    </>
                  ) : "—"}
                </div>
              </div>

              <ChevronRight className="relative h-5 w-5 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        )}

        {/* Menu items (mobile + desktop) */}
        <div
          className="rounded-2xl overflow-hidden ring-1 ring-amber-500/25 surface-3d"
          style={{
            background: "linear-gradient(180deg, rgba(28,22,12,0.85), rgba(14,10,6,0.95))",
            boxShadow: "inset 0 1px 0 rgba(251,191,36,0.14), 0 8px 24px -10px rgba(0,0,0,0.55), 0 20px 40px -20px rgba(0,0,0,0.45)",
          }}>
          {MENU_ITEMS.map((item, idx) => (
            <button
              key={item.path}
              className="group w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-primary/[0.07] active:bg-primary/[0.10]"
              style={{ borderBottom: idx < MENU_ITEMS.length - 1 ? "1px solid hsl(228 22% 28% / 0.4)" : "none" }}
              onClick={() => navigate(item.path)}
              data-testid={`menu-${item.path.split("/").pop()}`}
            >
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 ring-1 ring-primary/25 transition-all group-hover:bg-primary/20 group-hover:ring-primary/45 group-hover:shadow-[0_0_14px_-2px_hsl(38_95%_55%/0.45)]">
                <item.icon className="h-4 w-4 text-primary transition-transform group-hover:scale-110" />
              </div>
              <div className="flex-1 min-w-0 transition-transform group-hover:translate-x-0.5">
                <div className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{t(item.labelKey)}</div>
                <div className="text-[10px] text-muted-foreground/80 mt-0.5">{t(item.descKey)}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-all group-hover:text-primary group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      </div>
    </div>
    <NoNodeReminder
      open={reminderOpen}
      onClose={() => { setReminderOpen(false); setReminderDismissed(true); }}
    />
    </PageEnter>
  );
}
