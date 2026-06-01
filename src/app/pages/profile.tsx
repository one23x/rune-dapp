import { useMemo, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageEnter, PageEnterStagger, PageEnterItem } from "@app/components/page-enter";
import { useActiveAccount } from "thirdweb/react";
import {
  Copy, Check, ChevronRight, Bell, Settings, History, GitBranch, Share2,
  ArrowLeftRight, User, Vault, Lock, Flame, TrendingUp, Coins, Wallet,
} from "lucide-react";
import { useToast } from "@app/hooks/use-toast";
import { copyText } from "@app/lib/copy";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { usePersonalStats } from "@/hooks/rune/use-team";
import { buildReferralUrl } from "@/hooks/rune/use-referral-param";
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
  { labelKey: "profile.myVaultPositions",  icon: Vault,          path: "/profile/vault",        descKey: "profile.myVaultPositionsDesc" },
  { labelKey: "profile.swap",              icon: ArrowLeftRight, path: "/profile/swap",         descKey: "profile.swapDesc" },
  { labelKey: "profile.notifications",     icon: Bell,           path: "/profile/notifications", descKey: "profile.notificationsDesc" },
  { labelKey: "profile.settings",          icon: Settings,       path: "/profile/settings",     descKey: "profile.settingsDesc" },
];

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
  if (userQ.isLoading) return <div className="glass-panel h-40" />;
  // No engine user → nothing to surface here (the copy-trading entry handles onboarding).
  if (!userId) return null;

  return (
    <div className="glass-panel p-5 relative overflow-hidden">
      <div className="pointer-events-none absolute -right-10 -bottom-10 w-32 h-32 bg-amber-500/20 blur-3xl rounded-full" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-amber-400" />
            <h3 className="text-white/90 text-sm font-medium">{t("profile.engineSummary", "Copy-Trading")}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" style={{ animation: "pulse-ring 2s infinite" }} />
            <span className="text-[10px] text-emerald-400 font-medium tracking-wider uppercase">{t("profile.engineLive", "live")}</span>
          </div>
        </div>

        {/* HL account value + pUSD balance */}
        <div className="flex justify-between items-end mb-4">
          <div>
            <div className="text-xs text-white/50 mb-1">{t("profile.hlAccount", "HL Account")}</div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {hlAcctQ.isLoading ? "…" : fmtUsd(hlAcctVal)}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">{hlOpen} {t("profile.hlOpenPositions", "open positions")}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/50 mb-1">{t("profile.pmBalance", "pUSD")}</div>
            <div className="text-sm font-medium text-white/90 tabular-nums">
              {balanceQ.isLoading ? "…" : fmtUsd(pusd)}
            </div>
          </div>
        </div>

        {/* Copy-trading performance summary (from local order history) */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
          <div className="text-center">
            <div className={`text-sm font-bold tabular-nums ${realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtUsd(realizedPnl)}</div>
            <div className="text-[9px] text-white/40 mt-1 uppercase tracking-wide">{t("profile.realizedPnl", "Realized PnL")}</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-white tabular-nums">{closed.length > 0 ? `${winRate.toFixed(0)}%` : "—"}</div>
            <div className="text-[9px] text-white/40 mt-1 uppercase tracking-wide">{t("profile.winRate", "Win Rate")}</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-white tabular-nums">{orders.length}</div>
            <div className="text-[9px] text-white/40 mt-1 uppercase tracking-wide">{t("profile.totalTrades", "Trades")}</div>
          </div>
        </div>
        <div className="mt-3 text-[10px] text-center text-white/50">
          {t("profile.copySubs", "follows")}: <span className="text-white">{pmSubCount + hlSubCount}</span>
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

  const { data: stats } = usePersonalStats(isConnected ? walletAddr : undefined);

  // Commission rewards are stored on-chain as 18-decimal USDT (`uint256`).
  const directCommissionUsdt = useMemo(
    () => stats ? Number(stats.directCommission) / 1e18 : 0,
    [stats],
  );

  // Direct-referral commission is the only on-chain earnings today (USDT).
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
    <div className="relative pb-24 lg:pb-8 px-4 lg:px-6" data-testid="page-profile">

      {/* Header — glass identity card */}
      <header className="pt-6 pb-5 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg shrink-0">
            <User className="text-white/80" size={24} />
          </div>
          <div className="flex-1 min-w-0">
            {!isConnected ? (
              <div className="text-[15px] font-bold text-white/70">{t("common.notConnected", "Not connected")}</div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-lg font-bold tracking-tight gold-text drop-shadow-md" data-testid="text-wallet-address">{shortAddr}</h1>
                  <button
                    onClick={() => copyToClipboard(walletAddr)}
                    className="text-white/50 hover:text-white/90 transition-colors"
                    data-testid="button-copy-address"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <div className="font-mono text-[10px] text-white/40 truncate">{walletAddr}</div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="space-y-4 relative z-10">

        {/* ── Total Earnings hero card ── */}
        <div className="glass-panel-strong p-5 relative overflow-hidden">
          <div className="shimmer-sweep" />
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-amber-400" />
                <h3 className="text-white/90 text-sm font-medium">{t("profile.totalEarnings", "Total Earnings")}</h3>
              </div>
              <div className="flex gap-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">USDT</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-500/30 text-orange-300">FIRE</span>
              </div>
            </div>

            <div className="text-4xl font-bold gold-text tracking-tight mb-1 drop-shadow-md" data-testid="text-total-earnings">
              <AnimUsdt value={totalEarnings} />
            </div>
            <div className="text-[10px] text-white/50 mb-4">
              {t("profile.totalEarningsSource", "Staking + V-level referral · pre-launch")}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Staking yield */}
              <div className="bg-black/20 border border-white/10 rounded-xl p-3 relative overflow-hidden hover:border-emerald-500/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-white/70 flex items-center gap-1">
                    <Coins size={11} className="text-emerald-400" />
                    {t("profile.stakingYield", "Staking")}
                  </span>
                  <span className="text-[8px] bg-white/10 px-1 py-0.5 rounded text-white/50">{t("profile.preLaunch", "Pre-launch")}</span>
                </div>
                <div className="text-lg font-bold text-emerald-400 mb-1">$0.00</div>
                <div className="text-[9px] text-white/40">+ 0 FIRE</div>
                <div className="text-[9px] text-white/40">USDT 65% / FIRE 35%</div>
              </div>

              {/* Referral yield */}
              <div className="bg-black/20 border border-white/10 rounded-xl p-3 relative overflow-hidden hover:border-orange-500/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-white/70 flex items-center gap-1">
                    <GitBranch size={11} className="text-orange-400" />
                    {t("profile.referralYield", "Referral")}
                  </span>
                  <span className="text-[8px] bg-white/10 px-1 py-0.5 rounded text-white/50">V-level</span>
                </div>
                <div className="text-lg font-bold text-orange-400 mb-1">0 FIRE</div>
                <div className="text-[9px] text-white/40">{t("profile.directRate", "Direct")} 5% · {t("profile.teamRate", "Team")} 4-29%</div>
                <div className="text-[9px] text-white/40">USD-valued FIRE</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Engine copy-trading summary (HL + Polymarket, live data) ── */}
        {isConnected && <EngineSummaryCard wallet={walletAddr} />}

        {/* Invite link card */}
        {isConnected && referralLink && (
          <div className="glass-panel p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User size={16} className="text-amber-400" />
                <h3 className="text-white/90 text-sm font-medium">{t("profile.inviteFriends", "Invite Link")}</h3>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 font-mono text-[11px] text-white/60 truncate select-all cursor-text"
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
                  className={`shrink-0 px-3 py-2.5 rounded-lg border transition-all active:scale-95 inline-flex items-center gap-1 ${
                    copied
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-black/30 hover:border-white/30 text-white/80"
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
                  className="shrink-0 px-4 py-2.5 rounded-lg gold-button font-medium text-xs flex items-center justify-center active:scale-95"
                  data-testid="button-share-referral"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Prominent "Referral & Team" entry */}
            <button
              className="group relative w-full flex items-center gap-3.5 p-4 rounded-2xl text-left overflow-hidden
                         bg-amber-500/[0.08] border border-amber-500/40
                         hover:bg-amber-500/[0.14] hover:border-amber-500/60
                         active:scale-[0.985] transition-all"
              onClick={() => navigate("/profile/referral")}
              data-testid="menu-referral"
            >
              <span aria-hidden className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent pointer-events-none" />
              <span aria-hidden className="absolute -top-12 -right-8 w-32 h-32 rounded-full bg-amber-500/12 blur-2xl pointer-events-none" />

              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/20 border border-amber-500/40 transition-all group-hover:scale-105">
                <GitBranch className="h-5 w-5 text-amber-400" />
              </div>

              <div className="relative flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white tracking-wide">
                    {t("profile.referralTeam", "Referral & Team")}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    HOT
                  </span>
                </div>
                <div className="text-[11px] text-white/60 mt-0.5 tabular-nums">
                  {stats ? (
                    <>
                      <span className="text-amber-300 font-semibold">{stats.directCount}</span>
                      <span className="text-white/40"> {t("profile.direct", "direct")} · </span>
                      <span className="text-amber-300 font-semibold">{stats.totalDownstreamCount}</span>
                      <span className="text-white/40"> {t("profile.team", "team")}</span>
                    </>
                  ) : "—"}
                </div>
              </div>

              <ChevronRight className="relative h-5 w-5 text-amber-400/70 shrink-0 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        )}

        {/* Settings menu list */}
        <div className="glass-panel overflow-hidden">
          <div className="flex flex-col">
            {MENU_ITEMS.map((item, idx) => (
              <button
                key={item.path}
                className={`group flex items-center justify-between p-4 hover:bg-white/5 transition-colors ${
                  idx < MENU_ITEMS.length - 1 ? "border-b border-white/5" : ""
                }`}
                onClick={() => navigate(item.path)}
                data-testid={`menu-${item.path.split("/").pop()}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:bg-white/20 transition-colors shrink-0">
                    <item.icon size={14} />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="text-sm text-white/90 font-medium truncate">{t(item.labelKey)}</div>
                    <div className="text-[10px] text-white/40 mt-0.5 truncate">{t(item.descKey)}</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
    </PageEnter>
  );
}
