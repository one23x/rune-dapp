import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Grid, Users, X, Menu, BookOpen, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/contexts/language-context";
import { WalletConnectButton } from "@/components/rune/wallet-connect-button";
import { useActiveAccount } from "thirdweb/react";
import { useUserPurchase } from "@/hooks/rune/use-node-presell";
import { emitOpenPurchase } from "@/lib/rune/purchase-signal";
import { useTutorialStore } from "@/lib/tutorial-store";

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Renders as a plain <a target="_blank"> instead of wouter <Link>.
   *  Used for the LIBRARY slot, which opens the external protocol site
   *  rather than the internal /resources page. */
  external?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/projects",                     label: "PROJECTS",   key: "projects",   icon: Grid },
  { href: "/tools",                        label: "SIMULATORS", key: "simulators", icon: Activity },
  { href: "/recruit",                      label: "RECRUIT",    key: "recruit",    icon: Users },
  { href: "https://www.rune-protocol.com", label: "PREDICTIONS", key: "library",    icon: BookOpen, external: true },
];

/* ─── Animated Logo ──────────────────────────────────────────────── */
function AnimatedRuneLogo({ size = 42 }: { size?: number }) {
  const pad = size * 1.6;
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>

      {/* Outer slow-pulse ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: pad * 0.95, height: pad * 0.95,
          background: "radial-gradient(circle, rgba(251,191,36,0.18) 0%, rgba(217,119,6,0.08) 50%, transparent 72%)",
        }}
        animate={{ scale: [0.85, 1.05, 0.85], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Fast expanding ring — ripple */}
      <motion.div
        className="absolute rounded-full border border-amber-400/30"
        style={{ width: size * 0.9, height: size * 0.9 }}
        animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", repeatDelay: 0.4 }}
      />

      {/* Second ripple — offset delay */}
      <motion.div
        className="absolute rounded-full border border-amber-300/20"
        style={{ width: size * 0.9, height: size * 0.9 }}
        animate={{ scale: [1, 2.0], opacity: [0.5, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 1.1, repeatDelay: 0.4 }}
      />

      {/* Rotating arc halo */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 1.25, height: size * 1.25,
          border: "1.5px solid transparent",
          borderTopColor: "rgba(251,191,36,0.55)",
          borderRightColor: "rgba(251,191,36,0.25)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />

      {/* Counter-rotating arc — opposite direction */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 1.05, height: size * 1.05,
          border: "1px solid transparent",
          borderBottomColor: "rgba(217,119,6,0.4)",
          borderLeftColor: "rgba(217,119,6,0.15)",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      />

      {/* Inner glow disc */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.75, height: size * 0.75,
          background: "radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 70%)",
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.92, 1.08, 0.92] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Logo image */}
      <motion.img
        src="/rune-logo-new.png"
        alt="RUNE"
        className="relative z-10 object-contain"
        style={{ width: size, height: size, filter: "brightness(1.12) contrast(1.05)" }}
        animate={{
          filter: [
            "brightness(1.05) contrast(1.05) drop-shadow(0 0 5px rgba(251,191,36,0.3))",
            "brightness(1.2)  contrast(1.08) drop-shadow(0 0 14px rgba(251,191,36,0.7))",
            "brightness(1.05) contrast(1.05) drop-shadow(0 0 5px rgba(251,191,36,0.3))",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ─── Wordmark ───────────────────────────────────────────────────── */
function WordmarkRune({ small = false }: { small?: boolean }) {
  const height = small ? 20 : 30;
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
    <div
      className="relative select-none"
      style={{ height, aspectRatio: "4 / 1" }}
      aria-label="RUNE"
    >
      {/* Hidden image preserves intrinsic width so the wordmark sizes correctly */}
      <img
        src="/rune-wordmark.png"
        alt=""
        className="block opacity-0 pointer-events-none"
        style={{ height, width: "auto" }}
        draggable={false}
      />

      {/* Base gold layer */}
      <div
        className="absolute inset-0"
        style={{
          ...maskStyle,
          background: "linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)",
        }}
      />

      {/* Moving shimmer highlight */}
      <motion.div
        className="absolute inset-0"
        style={{
          ...maskStyle,
          background:
            "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.85) 50%, transparent 70%)",
          backgroundSize: "250% 100%",
          mixBlendMode: "screen",
        }}
        animate={{ backgroundPosition: ["180% 0%", "-80% 0%"] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.4 }}
      />
    </div>
  );
}


function Navbar() {
  const [location, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t, language } = useLanguage();
  const activeAccount = useActiveAccount();
  const { hasPurchased } = useUserPurchase(activeAccount?.address);
  const connectSpotlight = useTutorialStore((s) => s.connectSpotlight);

  const isEn = language === "en";

  // Dashboard only appears in the nav when the wallet is connected — avoids
  // dead-ending unauthenticated users on the protected page.
  const visibleNavItems = activeAccount
    ? [...NAV_ITEMS, { href: "/app/profile", label: "DASHBOARD", key: "dashboard", icon: LayoutDashboard }]
    : NAV_ITEMS;

  /** Dashboard is now SOFT-gated (2026-04-29 revert): bound-but-unpurchased
   *  users can see their binding + referral link inside dashboard, with a
   *  persistent CTA to buy a node. Nav clicks are no longer intercepted —
   *  the user reaches the page and the restricted view explains what's
   *  locked behind a purchase. */
  function handleNavClick(_e: React.MouseEvent, _key: string) {
    // intentional no-op; kept as a hook in case we re-introduce gating later.
  }
  void hasPurchased;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/90 backdrop-blur-md shadow-sm relative overflow-hidden">

        {/* ── Animated background lights ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Primary gold orb — left anchor */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 360,
              height: 360,
              background: "radial-gradient(circle, rgba(251,191,36,0.13) 0%, rgba(217,119,6,0.06) 45%, transparent 70%)",
              top: "-160px",
              left: "-60px",
            }}
            animate={{ x: [0, 50, 0], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Secondary amber orb — center drift */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 220,
              height: 220,
              background: "radial-gradient(circle, rgba(251,191,36,0.07) 0%, transparent 70%)",
              top: "-100px",
              left: "38%",
            }}
            animate={{ x: [0, -35, 20, 0], opacity: [0.4, 0.75, 0.5, 0.4] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
        </div>

        <div className="container flex h-[72px] items-center justify-between mx-auto pl-2 pr-2 md:pr-6 gap-4 md:gap-8">

          {/* Logo + wordmark. `shrink-0` on desktop so the wordmark never
              collides with the first nav item; on mobile we let it shrink
              so the wallet + menu cluster always fits. */}
          <Link
            href="/"
            className="flex items-center gap-2 group min-w-0 shrink md:shrink-0"
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="shrink-0"
            >
              {/* Two sized copies — smaller on <md to avoid crowding the header. */}
              <span className="hidden md:inline-flex"><AnimatedRuneLogo size={52} /></span>
              <span className="inline-flex md:hidden"><AnimatedRuneLogo size={36} /></span>
            </motion.div>
            {/* Wordmark keeps the original full-size 30 px height across every
                breakpoint — the user asked for consistent brand sizing. */}
            <WordmarkRune />
          </Link>

          {/* Desktop nav. `ml-auto` pushes the whole cluster to the right edge,
              leaving the flex gap to space it from the logo cluster. Item
              padding shrinks from px-6 to px-4 so five nav items + language
              + wallet fit on a 1024 px viewport without wrapping. */}
          <nav className="hidden md:flex items-stretch h-[72px] gap-0 ml-auto">
            {visibleNavItems.map((item) => {
              const isExternal = (item as NavItem).external;
              // Dashboard nav points at /app/profile but covers the whole
              // /app/* surface (vault, strategy, profile sub-pages, etc.).
              const isActive = !isExternal && (
                item.key === "dashboard"
                  ? location === "/app" || location.startsWith("/app/")
                  : (location === item.href || (item.href !== "/" && location.startsWith(item.href)))
              );
              const className = cn(
                "relative flex flex-col items-center justify-center px-4 lg:px-5 transition-all duration-200 group border-b-2",
                isActive
                  ? "border-amber-400 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/50"
              );
              const inner = (
                <>
                  <span className={cn(
                    "text-[13.5px] font-semibold tracking-tight leading-none transition-colors whitespace-nowrap",
                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {t(`mr.nav.${item.key}`)}
                  </span>
                  {!isEn && (
                    <span className={cn(
                      "text-[9.5px] uppercase tracking-[0.12em] mt-[3px] leading-none transition-colors",
                      isActive ? "text-amber-400/80" : "text-muted-foreground/40 group-hover:text-muted-foreground/70"
                    )}>
                      {item.label}
                    </span>
                  )}
                </>
              );
              return isExternal ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={className}
                >
                  {inner}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.key)}
                  className={className}
                >
                  {inner}
                </Link>
              );
            })}
            {/* Language toggle — desktop only, inline with nav */}
            <div className="hidden md:flex items-center h-[72px] pl-3 ml-3 border-l border-border/30">
              <LanguageToggle />
            </div>
            {/* Connect wallet — desktop */}
            <div className="hidden md:flex items-center h-[72px] pl-3 ml-1">
              <div
                title="连接钱包以访问完整功能 · Connect wallet to access full features"
                className={`relative rounded-xl transition-all duration-300 ${connectSpotlight ? "ring-2 ring-cyan-400/90 ring-offset-2 ring-offset-background shadow-[0_0_32px_10px_rgba(34,211,238,0.40)]" : ""}`}
              >
                <WalletConnectButton />
              </div>
            </div>
          </nav>

          {/* Right controls — mobile only. Language toggle lives inside the
              hamburger drawer; only the wallet + menu buttons sit in the
              header. Shrunk to a 36 px cluster so the logo + wordmark
              still have breathing room on a 360 px viewport. */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            {/* Connect wallet — mobile. 36 px tall, 11 px text, tighter
                radius; connected-state pill truncates long addresses via
                the max-width set in WalletConnectButton itself. */}
            <div className={`[&_button]:!h-9 [&_button]:!px-2.5 [&_button]:!text-[11px] [&_button]:!rounded-lg [&_button]:!min-w-0 [&_button_img]:!w-3.5 [&_button_img]:!h-3.5 rounded-lg transition-all duration-300 ${connectSpotlight ? "ring-2 ring-cyan-400/90 ring-offset-1 ring-offset-background shadow-[0_0_24px_8px_rgba(34,211,238,0.40)]" : ""}`}>
              <WalletConnectButton />
            </div>
            {/* Mobile hamburger — matches the wallet button height. */}
            <button
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all shrink-0"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md md:hidden"
              onClick={() => setMenuOpen(false)}
            />

            <motion.div
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 md:hidden w-[78vw] max-w-[300px] flex flex-col bg-[#080f1e] border-l border-border/40 shadow-[-20px_0_60px_rgba(0,0,0,0.6)]"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 h-16 border-b border-border/30 shrink-0">
                <div className="flex items-center gap-3">
                  <AnimatedRuneLogo size={28} />
                  <WordmarkRune small />
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Nav items */}
              <nav className="flex-1 flex flex-col justify-center px-6 gap-1 py-8">
                {visibleNavItems.map((item, i) => {
                  const Icon = item.icon;
                  const isExternal = (item as NavItem).external;
                  // Dashboard nav points at /app/profile but covers the whole
              // /app/* surface (vault, strategy, profile sub-pages, etc.).
              const isActive = !isExternal && (
                item.key === "dashboard"
                  ? location === "/app" || location.startsWith("/app/")
                  : (location === item.href || (item.href !== "/" && location.startsWith(item.href)))
              );
                  const linkClass = cn(
                    "group flex items-center gap-5 py-5 border-b transition-all",
                    isActive ? "border-primary/30" : "border-border/20 hover:border-border/40"
                  );
                  const inner = (
                    <>
                      <span className={cn(
                        "text-[11px] font-mono tabular-nums w-5 shrink-0",
                        isActive ? "text-primary/80" : "text-muted-foreground/40"
                      )}>
                        0{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xl font-bold tracking-tight leading-none",
                          isActive ? "text-primary" : "text-foreground/70 group-hover:text-foreground transition-colors"
                        )}>
                          {t(`mr.nav.${item.key}`)}
                        </p>
                        {!isEn && (
                          <p className={cn(
                            "text-[11px] mt-1 tracking-widest uppercase",
                            isActive ? "text-primary/60" : "text-muted-foreground/40"
                          )}>
                            {item.label}
                          </p>
                        )}
                      </div>
                      <Icon className={cn(
                        "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                        isActive ? "text-primary" : "text-muted-foreground/30"
                      )} />
                    </>
                  );
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 + 0.1, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {isExternal ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={() => setMenuOpen(false)}
                          className={linkClass}
                        >
                          {inner}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={(e) => { handleNavClick(e, item.key); setMenuOpen(false); }}
                          className={linkClass}
                        >
                          {inner}
                        </Link>
                      )}
                    </motion.div>
                  );
                })}
              </nav>

              {/* Drawer footer — language toggle moved here on mobile so the
                  header cluster stays uncluttered for logo + wordmark + wallet. */}
              <div className="px-6 py-5 border-t border-border/20 shrink-0 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60 font-medium">
                    Language · 语言
                  </span>
                  <LanguageToggle />
                </div>
                <p className="text-[11px] text-muted-foreground/30 uppercase tracking-widest">
                  {t("mr.footer.tagline")}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function AppLayout({ children }: LayoutProps) {
  const { t } = useLanguage();

  return (
    <div className="relative flex min-h-screen flex-col bg-background selection:bg-primary/30 selection:text-amber-200">
      <Navbar />
      <main className="flex-1 w-full mx-auto">
        {children}
      </main>
      <footer className="py-6 md:px-8 md:py-0 border-t border-border bg-card/30 backdrop-blur-sm">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row mx-auto px-4">
          <div className="flex items-center gap-2.5">
            <div className="w-[18px] h-[18px] rounded overflow-hidden bg-black border border-white/10 shrink-0">
              <img src="/rune-logo.png" alt="MarketRune" className="w-full h-full object-contain" />
            </div>
            <span style={{ fontFamily: "'Cinzel', serif" }}>
              <span className="text-[11px] font-bold tracking-[0.18em] text-amber-500/60 uppercase">Rune</span>
            </span>
          </div>
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            {t("mr.footer.tagline")}
          </p>
        </div>
      </footer>
    </div>
  );
}
