import { useLocation, Link } from "wouter";
import { Home, BarChart3, Brain, User, TrendingUp, Server, GitBranch, ArrowLeftRight, History, Bell, Settings, ChevronLeft, Vault } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";

const mainNavItems = [
  { path: "/", icon: Home, labelKey: "nav.home" },
  { path: "/trade", icon: BarChart3, labelKey: "nav.predict" },
  {
    path: "/vault",
    labelKey: "nav.vault",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="8" r="5" />
        <circle cx="12" cy="8" r="2" />
        <path d="M12 13v3" />
        <path d="M8 21h8" />
        <path d="M10 18h4" />
      </svg>
    ),
  },
  { path: "/strategy", icon: Brain, labelKey: "nav.trade" },
  { path: "/market", icon: TrendingUp, labelKey: "nav.market" },
  { path: "/profile", icon: User, labelKey: "nav.profile" },
];

const profileNavItems = [
  { path: "/profile", labelKey: "profile.overviewTab", icon: User, exact: true },
  { path: "/profile/nodes", labelKey: "profile.nodeDetailsTitle", icon: Server },
  { path: "/profile/nodes/earnings", labelKey: "profile.nodeEarningsDetail", icon: TrendingUp },
  { path: "/profile/vault", labelKey: "profile.myVaultPositions", icon: Vault },
  { path: "/profile/referral", labelKey: "profile.referralTeam", icon: GitBranch },
  { path: "/profile/swap", labelKey: "profile.swap", icon: ArrowLeftRight },
  { path: "/profile/transactions", labelKey: "profile.transactionHistory", icon: History },
  { path: "/profile/notifications", labelKey: "profile.notifications", icon: Bell },
  { path: "/profile/settings", labelKey: "profile.settings", icon: Settings },
];

export function DesktopSidebar() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const account = useActiveAccount();

  const isProfile = location === "/profile" || location.startsWith("/profile/");

  return (
    <aside className="hidden lg:flex flex-col w-[220px] xl:w-[260px] shrink-0 sticky top-[72px] h-[calc(100vh-72px)] border-r border-border/30 bg-background/50">
      {isProfile ? (
        <>
          {/* Back to main nav */}
          <div className="px-3 pt-3 pb-1">
            <Link href="/">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-foreground/40 hover:text-foreground/70 hover:bg-white/[0.03] transition-all cursor-pointer">
                <ChevronLeft className="h-4 w-4" />
                <span>{t("nav.home")}</span>
              </div>
            </Link>
          </div>
          <div className="px-5 pt-2 pb-2 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">
            {t("nav.profile")}
          </div>
          <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
            {profileNavItems.map((item) => {
              const isActive = item.exact ? location === item.path : location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                      isActive
                      ? "text-primary bg-primary/10 shadow-[0_0_12px_rgba(212,168,50,0.08)]"
                        : "text-foreground/45 hover:text-foreground/75 hover:bg-white/[0.03]"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-primary" : ""}`} />
                    <span>{t(item.labelKey)}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </>
      ) : (
        <nav className="flex-1 px-3 py-4 space-y-1">
          {mainNavItems.map((item) => {
            const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? "text-primary bg-primary/10 shadow-[0_0_12px_rgba(212,168,50,0.08)]"
                      : "text-foreground/50 hover:text-foreground/80 hover:bg-white/[0.03]"
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                  <span>{t(item.labelKey)}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Wallet status at bottom */}
      <div className="border-t border-border/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${account ? "bg-primary animate-pulse" : "bg-foreground/20"}`}
            style={account ? { boxShadow: "0 0 6px rgba(212,168,50,0.45)" } : undefined}
          />
          <span className="text-xs text-foreground/40 truncate">
            {account ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : t("common.notConnected")}
          </span>
        </div>
      </div>
    </aside>
  );
}
