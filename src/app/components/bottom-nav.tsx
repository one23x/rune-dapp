import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, LayoutGroup } from "framer-motion";
import { LayoutDashboard, Eye, Shield, BarChart2, User } from "lucide-react";

// Unified amber palette — every tab uses the mainnet `--primary`
// (hsl 38 95% 55%) so the strip reads as a single coherent surface
// rather than alternating amber/red dots. The CJK glyph row is gated
// behind showZh inside the component.
const ACCENT      = "hsl(38, 95%, 60%)";
const ACCENT_GLOW = "rgba(251, 191, 36, 0.55)";
const PILL_BG     = "linear-gradient(135deg, rgba(251,191,36,0.22), rgba(180,90,10,0.10))";

const TABS = [
  { path: "/",         icon: LayoutDashboard, id: "home" },
  { path: "/trade",    icon: Eye,             id: "predict" },
  { path: "/vault",    icon: Shield,          id: "vault" },
  { path: "/strategy", icon: BarChart2,       id: "trade" },
  { path: "/profile",  icon: User,            id: "profile" },
].map((t) => ({ ...t, accent: ACCENT, glow: ACCENT_GLOW, pillBg: PILL_BG }));

export function BottomNav() {
  const [location] = useLocation();
  const { t, i18n } = useTranslation();
  // CJK locales show the Chinese brand glyph above the English code; everything
  // else collapses to just the English code so non-Chinese users don't get a
  // foreign script crammed into a small tab.
  const showZh = i18n.language === "zh" || i18n.language === "zh-TW";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="bottom-nav"
    >
      <LayoutGroup>
        <div
          className="pointer-events-auto relative flex items-stretch justify-around mx-3 mb-2.5 w-[calc(100%-1.5rem)] max-w-md rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(180deg, rgba(28,22,10,0.94) 0%, rgba(14,10,4,0.96) 100%)",
            backdropFilter: "blur(28px) saturate(1.6)",
            WebkitBackdropFilter: "blur(28px) saturate(1.6)",
            border: "1px solid rgba(251,191,36,0.30)",
            boxShadow:
              "0 -8px 36px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(251,191,36,0.22), inset 0 1px 0 rgba(251,191,36,0.18), inset 0 -1px 0 rgba(0,0,0,0.50), 0 -4px 24px rgba(251,191,36,0.10)",
          }}
        >
          {/* Top shimmer line — single amber gradient, matches mainnet header */}
          <div
            className="absolute top-0 left-0 right-0 h-[1.5px] pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.55) 50%, transparent 100%)",
            }}
          />
          {/* Inner top edge highlight — gives the strip a subtle bevel */}
          <div className="absolute inset-x-3 top-[1.5px] h-px pointer-events-none bg-gradient-to-r from-transparent via-amber-300/25 to-transparent" />

          {TABS.map((tab) => {
            const isActive = tab.path === "/" ? location === "/" : location.startsWith(tab.path);
            const Icon = tab.icon;

            return (
              <Link key={tab.path} href={tab.path} className="flex-1">
                <motion.button
                  aria-label={t(`nav.${tab.id}`)}
                  aria-current={isActive ? "page" : undefined}
                  className="relative flex flex-col items-center justify-center w-full min-h-[48px] py-2.5 px-1 gap-0.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  data-testid={`nav-${tab.id}`}
                >
                  {/* Sliding pill - renders only on active, layoutId moves it */}
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-x-1 inset-y-1 rounded-xl"
                      style={{ background: tab.pillBg }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}

                  {/* Top glow line - also slides with layoutId */}
                  {isActive && (
                    <motion.span
                      layoutId="nav-topline"
                      className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                      style={{
                        width: 32,
                        height: 2,
                        background: tab.accent,
                        boxShadow: `0 0 10px ${tab.glow}, 0 0 22px ${tab.glow}80`,
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}

                  {/* Icon */}
                  <motion.div
                    className="relative z-10"
                    animate={isActive ? { scale: 1.18, y: -1 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 26 }}
                  >
                    <Icon
                      style={{
                        width: 19,
                        height: 19,
                        color: isActive ? tab.accent : "rgba(255,255,255,0.65)",
                        strokeWidth: isActive ? 2.2 : 1.7,
                        filter: isActive
                          ? `drop-shadow(0 0 6px ${tab.glow}) drop-shadow(0 0 14px ${tab.glow}70)`
                          : undefined,
                        transition: "color 0.25s, filter 0.25s",
                      }}
                    />
                  </motion.div>

                  {/* Chinese brand glyph — CJK locales only */}
                  {showZh && (
                    <span
                      className="relative z-10 leading-none font-bold"
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.05em",
                        color: isActive ? tab.accent : "rgba(255,255,255,0.72)",
                        textShadow: isActive ? `0 0 12px ${tab.glow}` : undefined,
                        transition: "color 0.25s, text-shadow 0.25s",
                      }}
                    >
                      {t(`nav.${tab.id}Zh`)}
                    </span>
                  )}

                  {/* English code (always shown; sized up when Chinese row is hidden) */}
                  <span
                    className="relative z-10 leading-none"
                    style={{
                      fontSize: showZh ? 9 : 10.5,
                      fontFamily: "monospace",
                      fontWeight: showZh ? 400 : 700,
                      letterSpacing: "0.10em",
                      color: isActive ? (showZh ? `${tab.accent}cc` : tab.accent) : "rgba(255,255,255,0.6)",
                      textShadow: !showZh && isActive ? `0 0 12px ${tab.glow}` : undefined,
                      transition: "color 0.25s",
                    }}
                  >
                    {t(`nav.${tab.id}`)}
                  </span>
                </motion.button>
              </Link>
            );
          })}
        </div>
      </LayoutGroup>
    </nav>
  );
}
