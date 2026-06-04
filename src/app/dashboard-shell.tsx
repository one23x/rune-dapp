import "./index.css";
import { Switch, Route, Router as WouterRouter, Link, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import type React from "react";
import { motion } from "framer-motion";
import "@app/lib/i18n";
import { DesktopSidebar } from "@app/components/desktop-sidebar";
import { BottomNav } from "@app/components/bottom-nav";
import LangSwitcher from "@app/components/lang-switcher";
import { WalletConnectButton } from "@/components/rune/wallet-connect-button";
import { useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";

const Dashboard       = lazy(() => import("@app/pages/dashboard"));
const Trade           = lazy(() => import("@app/pages/trade"));
const Vault           = lazy(() => import("@app/pages/vault"));
const StrategyPage    = lazy(() => import("@app/pages/strategy"));
const StrategyVault   = lazy(() => import("@app/pages/strategy-vault"));
const StrategyHub     = lazy(() => import("@app/components/strategy/hl-copy-section").then((m) => ({ default: m.HlHubPage })));
const Market          = lazy(() => import("@app/pages/market"));
const CopyTrading     = lazy(() => import("@app/pages/copy-trading"));
const CopyTradingAuto      = lazy(() => import("@app/pages/copy-trading-auto"));
const CopyTradingSignals   = lazy(() => import("@app/pages/copy-trading-signals"));
const CopyTradingHistory   = lazy(() => import("@app/pages/copy-trading-history"));
const Profile         = lazy(() => import("@app/pages/profile"));
const Nodes           = lazy(() => import("@app/pages/nodes"));
const ProfileReferral = lazy(() => import("@app/pages/profile-referral"));
const ProfileCommission = lazy(() => import("@app/pages/profile-commission"));
const ProfileVault    = lazy(() => import("@app/pages/profile-vault"));
const ProfileSettings = lazy(() => import("@app/pages/profile-settings"));
const ProfileTransactions = lazy(() => import("@app/pages/profile-transactions"));
const ProfileNotifications = lazy(() => import("@app/pages/profile-notifications"));
const ProfileSwap = lazy(() => import("@app/pages/profile-swap"));
const AdminFunds = lazy(() => import("@app/pages/admin-funds"));
// 节点购买页 —— 故意不放进任何导航/菜单,仅可通过直链 /profile/nodes 访问。
const ProfileNodes = lazy(() => import("@app/pages/profile-nodes"));

/**
 * AnimatedRuneLogo — same animated halo + dual rotating arcs as mainnet's
 * AppLayout (`src/components/layout.tsx`). Kept locally inside the shell so
 * `/app/*` doesn't pull in the full mainnet AppLayout module graph.
 */
function AnimatedRuneLogo({ size = 36 }: { size?: number }) {
  const pad = size * 1.6;
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        className="absolute rounded-full"
        style={{ width: pad * 0.95, height: pad * 0.95, background: "radial-gradient(circle, rgba(251,191,36,0.18) 0%, rgba(217,119,6,0.08) 50%, transparent 72%)" }}
        animate={{ scale: [0.85, 1.05, 0.85], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full border border-amber-400/30"
        style={{ width: size * 0.9, height: size * 0.9 }}
        animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", repeatDelay: 0.4 }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: size * 1.25, height: size * 1.25, border: "1.5px solid transparent", borderTopColor: "rgba(251,191,36,0.55)", borderRightColor: "rgba(251,191,36,0.25)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: size * 1.05, height: size * 1.05, border: "1px solid transparent", borderBottomColor: "rgba(217,119,6,0.4)", borderLeftColor: "rgba(217,119,6,0.15)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      />
      <motion.img
        src="/rune-logo-new.png"
        alt="RUNE"
        className="relative z-10 object-contain"
        style={{ width: size, height: size, filter: "brightness(1.12) contrast(1.05)" }}
        animate={{
          filter: [
            "brightness(1.05) contrast(1.05) drop-shadow(0 0 5px rgba(251,191,36,0.3))",
            "brightness(1.2) contrast(1.08) drop-shadow(0 0 14px rgba(251,191,36,0.7))",
            "brightness(1.05) contrast(1.05) drop-shadow(0 0 5px rgba(251,191,36,0.3))",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/**
 * Wordmark — masked gradient + shimmer, lifted from mainnet AppLayout to keep
 * the brand mark identical between marketing and dashboard surfaces.
 */
function WordmarkRune({ height = 30 }: { height?: number }) {
  const maskStyle = {
    WebkitMaskImage: "url(/rune-wordmark.png)",
    maskImage: "url(/rune-wordmark.png)",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  } as React.CSSProperties;
  return (
    <div className="relative select-none" style={{ height, aspectRatio: "4 / 1" }} aria-label="RUNE">
      <img src="/rune-wordmark.png" alt="" className="block opacity-0 pointer-events-none" style={{ height, width: "auto" }} draggable={false} />
      <div
        className="absolute inset-0"
        style={{ ...maskStyle, background: "linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)" }}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          ...maskStyle,
          background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.85) 50%, transparent 70%)",
          backgroundSize: "250% 100%",
          mixBlendMode: "screen",
        }}
        animate={{ backgroundPosition: ["180% 0%", "-80% 0%"] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.4 }}
      />
    </div>
  );
}

/**
 * Dashboard header — sized to match mainnet AppLayout (h-72px, logo 52px
 * desktop / 36px mobile, wallet button shrunken to h-9 on mobile via the
 * same `[&_button]:!h-9` cascade selector mainnet uses).
 */
function ShellHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur-md shadow-sm">
      <div className="container flex h-[72px] items-center justify-between mx-auto pl-2 pr-2 md:pr-6 gap-4 md:gap-8">
        {/* Plain <a> (not wouter <Link>) so clicking the logo escapes
            the dashboard's `base="/app"` router and lands on the public
            mainnet site root (rune-ai.io/). wouter Link with href="/" would
            resolve to "/app" and trap users inside the dashboard shell. */}
        <a href="/" className="flex items-center gap-2 group min-w-0 shrink md:shrink-0 cursor-pointer">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="shrink-0"
          >
            <span className="hidden md:inline-flex"><AnimatedRuneLogo size={52} /></span>
            <span className="inline-flex md:hidden"><AnimatedRuneLogo size={36} /></span>
          </motion.div>
          <WordmarkRune />
        </a>

        {/* Desktop: full-size wallet button + language toggle */}
        <div className="hidden md:flex items-center h-[72px] gap-3 ml-auto">
          <LangSwitcher />
          <WalletConnectButton />
        </div>

        {/* Mobile: shrunken wallet button cluster */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <div className="[&_button]:!h-9 [&_button]:!px-2.5 [&_button]:!text-[11px] [&_button]:!rounded-lg [&_button]:!min-w-0 [&_button_img]:!w-3.5 [&_button_img]:!h-3.5">
            <WalletConnectButton />
          </div>
          <LangSwitcher />
        </div>
      </div>
    </header>
  );
}

function WalletRequiredGate({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const status = useActiveWalletConnectionStatus();
  const isResolving = status === "unknown" || status === "connecting";

  // Design-preview bypass: any /app route with ?preview=1 renders without a
  // connected wallet so member-only UIs can be reviewed in isolation.
  const previewMode =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("preview");
  if (previewMode) return <>{children}</>;

  if (isResolving) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary"
          />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1 flex items-center justify-center min-h-[70vh] px-6"
      >
        <div className="text-center max-w-sm space-y-6">
          <div className="relative mx-auto w-20 h-20">
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/10"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative w-20 h-20 rounded-full border border-primary/30 bg-card flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/70">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <path d="M16 12h.01" />
                <path d="M12 5V3" />
                <path d="M8 5V3" />
                <path d="M16 5V3" />
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">连接钱包以继续</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect your wallet to access the dashboard, trading strategies, and portfolio management.
            </p>
            <p className="text-xs text-muted-foreground/70">连接钱包后即可访问仪表盘、交易策略和资产管理。</p>
          </div>
          <div className="flex justify-center [&_button]:!h-11 [&_button]:!px-8 [&_button]:!text-sm [&_button]:!rounded-lg">
            <WalletConnectButton />
          </div>
        </div>
      </motion.div>
    );
  }

  return <>{children}</>;
}

function DashboardRoutes() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading…</div>}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/trade" component={Trade} />
        <Route path="/vault" component={Vault} />
        <Route path="/strategy" component={StrategyPage} />
        <Route path="/strategy/hl" component={StrategyHub} />
        <Route path="/strategy/vault/:network/:address">{(p) => <StrategyVault network={p.network} address={p.address} />}</Route>
        {/* HL copy-trading was merged into /strategy; keep /hl as a redirect
            so old links / bookmarks land on the strategy page. */}
        <Route path="/hl">{() => <Redirect to="/strategy" />}</Route>
        <Route path="/market" component={Market} />
        <Route path="/copy-trading" component={CopyTrading} />
        <Route path="/copy-trading/auto" component={CopyTradingAuto} />
        <Route path="/copy-trading/signals" component={CopyTradingSignals} />
        <Route path="/copy-trading/history" component={CopyTradingHistory} />
        {/* Positions/Earnings/Funds were consolidated into Overview, Strategy and History. */}
        <Route path="/copy-trading/positions">{() => <Redirect to="/copy-trading" />}</Route>
        <Route path="/copy-trading/funds">{() => <Redirect to="/copy-trading" />}</Route>
        <Route path="/copy-trading/earnings">{() => <Redirect to="/copy-trading/history" />}</Route>
        <Route path="/nodes" component={Nodes} />
        <Route path="/profile" component={Profile} />
        <Route path="/profile/nodes" component={ProfileNodes} />
        <Route path="/profile/referral" component={ProfileReferral} />
        <Route path="/profile/commission" component={ProfileCommission} />
        <Route path="/profile/vault" component={ProfileVault} />
        <Route path="/profile/settings" component={ProfileSettings} />
        <Route path="/profile/transactions" component={ProfileTransactions} />
        <Route path="/profile/notifications" component={ProfileNotifications} />
        <Route path="/profile/swap" component={ProfileSwap} />
        <Route path="/admin/funds" component={AdminFunds} />
      </Switch>
    </Suspense>
  );
}

/**
 * TAICLAW dashboard shell — mounted at `/app/*` from mainnet App.tsx.
 * Uses wouter `base="/app"` so TAICLAW pages' internal `<Link href="/profile">`
 * resolve to `/app/profile` without rewriting every link.
 *
 * Skips TAICLAW's WalletSync (which expected an api-server `authWallet` call) —
 * thirdweb ThirdwebProvider at the App.tsx level already supplies wallet state.
 */
export default function DashboardShell() {
  return (
    <WouterRouter base="/app">
      <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
        {/* Shared liquid-glass orb background — drifting champagne glows on the
            near-black base, behind all dashboard content (z-0). */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div
            className="absolute -top-[10%] -left-[10%] w-[60%] h-[50%] rounded-full opacity-60 blur-[100px]"
            style={{ background: "var(--orb-1)" }}
            animate={{ x: [0, 50, -20, 0], y: [0, -30, 40, 0], scale: [1, 1.1, 0.9, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute top-[20%] -right-[20%] w-[70%] h-[60%] rounded-full opacity-50 blur-[120px]"
            style={{ background: "var(--orb-2)" }}
            animate={{ x: [0, -40, 30, 0], y: [0, 50, -20, 0], scale: [1, 1.2, 0.8, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute -bottom-[10%] left-[10%] w-[50%] h-[40%] rounded-full opacity-60 blur-[90px]"
            style={{ background: "var(--orb-3)" }}
            animate={{ x: [0, 30, -40, 0], y: [0, -20, 50, 0], scale: [1, 0.9, 1.1, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="relative z-10">
        <ShellHeader />
        <div className="flex">
          <DesktopSidebar />
          <main className="flex-1 mx-auto max-w-lg lg:max-w-6xl xl:max-w-7xl w-full overflow-x-hidden pb-24 lg:pb-10">
            <WalletRequiredGate>
              <DashboardRoutes />
            </WalletRequiredGate>
          </main>
        </div>
        <BottomNav />
        </div>
      </div>
    </WouterRouter>
  );
}
