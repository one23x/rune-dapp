import { useEffect, useState, useRef } from "react";
import { useGetProjectsSummary, useListProjects } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowUp, ArrowDown, TrendingUp, Minus } from "lucide-react";
import { ProjectCard } from "@/components/shared/project-card";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import { useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";
import type { Project } from "@/lib/queries";
import { useLanguage } from "@/contexts/language-context";

function AnimatedCounter({ value, isCurrency = false, isPercent = false, isInteger = false }: { value: number | string, isCurrency?: boolean, isPercent?: boolean, isInteger?: boolean }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [displayValue, setDisplayValue] = useState(0);
  
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g,"")) : value;
  const stringPrefix = typeof value === 'string' && value.startsWith('$') ? '$' : '';
  const stringSuffix = typeof value === 'string' && value.match(/[KMB]$/) ? value.match(/[KMB]$/)?.[0] : '';

  useEffect(() => {
    if (!isInView || isNaN(numValue)) return;
    let startTime: number;
    const duration = 1800;
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(numValue * easeProgress);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, numValue]);

  if (isNaN(numValue)) return <span ref={ref}>{value}</span>;
  let formatted = displayValue.toFixed(isInteger ? 0 : isPercent ? 2 : (numValue > 1000 ? 0 : 2));
  if (isCurrency && !stringPrefix) formatted = `$${formatted}`;
  return <span ref={ref}>{stringPrefix}{formatted}{stringSuffix}</span>;
}

function getSeededChange(project: Project): number {
  const seed = (project.id * 7919 + project.apy * 1000) % 1000;
  const raw = ((seed / 1000) * 12) - 4;
  return Math.round(raw * 100) / 100;
}

function getRankStyle(rank: number) {
  if (rank === 0) return { bg: "bg-amber-500/15 border-amber-500/40", text: "text-amber-400", label: "1st" };
  if (rank === 1) return { bg: "bg-slate-400/10 border-slate-400/30", text: "text-slate-300", label: "2nd" };
  if (rank === 2) return { bg: "bg-orange-600/10 border-orange-600/30", text: "text-orange-500", label: "3rd" };
  return { bg: "bg-muted/30 border-border/50", text: "text-muted-foreground", label: `${rank + 1}th` };
}

function YieldChangeBadge({ change }: { change: number }) {
  if (change > 0.5) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-2 py-0.5 num-sm">
      <ArrowUp className="h-3 w-3" />+{change.toFixed(2)}%
    </span>
  );
  if (change < -0.5) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-0.5 num-sm">
      <ArrowDown className="h-3 w-3" />{change.toFixed(2)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/40 border border-border/40 rounded px-2 py-0.5 num-sm">
      <Minus className="h-3 w-3" />{change > 0 ? "+" : ""}{change.toFixed(2)}%
    </span>
  );
}

function RiskDot({ level }: { level: string }) {
  const cls =
    level === "low" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" :
    level === "medium" ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls} shrink-0`} />;
}

function TrendingRow({ project, rank, delay }: { project: Project; rank: number; delay: number }) {
  const change = getSeededChange(project);
  const { bg, text, label } = getRankStyle(rank);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={project.symbol === "RUNE" ? "/projects/rune" : project.symbol === "B18" ? "/projects/b18" : project.symbol === "HYPE" ? "/projects/hyperliquid" : project.symbol === "ATM" ? "/projects/legend-atm" : `/projects/${project.id}`}>
        <div className="group corner-brackets flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border/40 bg-card/50 hover:bg-card/80 hover:border-primary/25 transition-all cursor-pointer hover:shadow-[0_0_20px_rgba(0,0,0,0.3)]">
          {project.symbol === "RUNE" ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-black border border-primary/20 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.15)]">
              <img src="/rune-logo.png" alt="RUNE" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className={`w-9 h-9 rounded-lg border text-xs font-bold flex items-center justify-center shrink-0 ${bg} ${text}`}>
              {label}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-semibold text-sm text-foreground truncate">{project.name}</span>
              <span className="text-[11px] sm:text-[11px] font-mono text-muted-foreground border border-border/50 rounded px-1 sm:px-1.5 py-px shrink-0 tracking-wider">{project.symbol}</span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60 hidden sm:inline shrink-0">{project.category}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <RiskDot level={project.riskLevel} />
              <span className="text-[11px] sm:text-[11px] text-muted-foreground capitalize">{project.riskLevel} risk</span>
              <span className="text-muted-foreground/40 text-[11px]">·</span>
              <span className="text-[11px] sm:text-[11px] text-muted-foreground num-sm truncate">TVL {project.tvl}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-lg font-bold num-gold leading-none">{project.apy.toFixed(2)}%</span>
            <YieldChangeBadge change={change} />
          </div>

          <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0 ml-1 hidden sm:block" />
        </div>
      </Link>
    </motion.div>
  );
}

const cardStagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const cardItem = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 280, damping: 22 } }
};

export default function Home() {
  const { t, language } = useLanguage();
  const isEn = language === "en";
  const isZh = language === "zh" || language === "zh-TW";
  const account = useActiveAccount();
  // thirdweb returns "unknown" / "connecting" during the auto-reconnect
  // window after a hard reload. Gate the secondary CTA on a resolved
  // status so the first paint doesn't flash the wrong button (and trap
  // users on /tools when they were already a signed-in member).
  const connectionStatus = useActiveWalletConnectionStatus();
  const isResolvingWallet = connectionStatus === "unknown" || connectionStatus === "connecting";
  const isConnected = connectionStatus === "connected" && !!account?.address;

  const { data: summary, isLoading: isSummaryLoading } = useGetProjectsSummary();
  const { data: allProjects, isLoading: isTrendingLoading } = useListProjects({ sortBy: "trending" });

  const trendingProjects = allProjects?.filter(p => p.trending).slice(0, 6) ?? [];
  const topByApy = allProjects ? [...allProjects].sort((a, b) => b.apy - a.apy).slice(0, 3) : [];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-16">

      {/* ── Hero ── */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 backdrop-blur-md p-8 md:p-12 lg:p-16 shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-background/80 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,hsl(38,90%,50%,0.07),transparent_55%)] pointer-events-none" />

        {/* Ambient orbs */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/15 rounded-full blur-[90px] pointer-events-none animate-orb-drift" />
        <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-chart-2/8 rounded-full blur-[100px] pointer-events-none animate-orb-drift" style={{ animationDelay: '-6s' }} />
        <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-chart-3/6 rounded-full blur-[60px] pointer-events-none animate-float-y" style={{ animationDelay: '-2s' }} />

        {/* Scan line */}
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none animate-scan-line" style={{ top: 0, zIndex: 1 }} />

        {/* Corner accents */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-primary/40 rounded-tl pointer-events-none" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-primary/40 rounded-tr pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-primary/40 rounded-bl pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-primary/40 rounded-br pointer-events-none" />

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40 font-medium hidden sm:block">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary/40">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </motion.div>
        </motion.div>

        <div className="relative z-10 max-w-3xl space-y-6">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-background/70 backdrop-blur border border-border/60 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">
              {isEn ? "LIVE DATA" : `${t("mr.home.badge.live")} · LIVE DATA`}
            </span>
          </div>

          {/* Main heading */}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight lg:text-6xl text-foreground">
            {isEn ? (
              <>
                <motion.span
                  initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12, duration: 0.5, ease: [0.16,1,0.3,1] }}
                  className="block text-foreground/90"
                >
                  Institutional-Grade
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22, duration: 0.5, ease: [0.16,1,0.3,1] }}
                  className="block mt-1"
                  style={{ background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 45%, #d97706 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                >
                  DeFi Analysis
                </motion.span>
                <motion.span
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.45 }}
                  className="block mt-3"
                >
                  <span className="block text-2xl lg:text-3xl text-foreground/85 font-semibold tracking-tight">
                    {t("mr.home.hero.sub")}
                  </span>
                </motion.span>
              </>
            ) : isZh ? (
              <>
                <motion.span
                  initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12, duration: 0.5, ease: [0.16,1,0.3,1] }}
                  className="block text-foreground/90"
                >
                  Institutional-Grade
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22, duration: 0.5, ease: [0.16,1,0.3,1] }}
                  className="block mt-1"
                  style={{ background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 45%, #d97706 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                >
                  DeFi Analysis
                </motion.span>
                <motion.span
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.45 }}
                  className="block mt-3"
                >
                  <span className="block text-2xl lg:text-3xl text-foreground/85 font-semibold tracking-tight">
                    {t("mr.home.hero.title")}
                  </span>
                  <span className="block text-lg lg:text-xl text-muted-foreground/85 font-medium mt-1 tracking-wide">
                    {t("mr.home.hero.sub")}
                  </span>
                </motion.span>
              </>
            ) : (
              <>
                <motion.span
                  initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.18, duration: 0.55, ease: [0.16,1,0.3,1] }}
                  className="block"
                  style={{ background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 45%, #d97706 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                >
                  {t("mr.home.hero.title")}
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.55, ease: [0.16,1,0.3,1] }}
                  className="block mt-1 text-foreground/40 text-2xl lg:text-3xl"
                >
                  DeFi Analysis
                </motion.span>
                <motion.span
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.48, duration: 0.55 }}
                  className="block mt-3"
                >
                  <span className="block text-2xl lg:text-3xl text-foreground/75 font-semibold tracking-tight">
                    {t("mr.home.hero.sub")}
                  </span>
                  <span className="block text-sm text-muted-foreground/50 font-medium mt-2 tracking-widest uppercase">
                    Institutional-Grade · DeFi Analysis
                  </span>
                </motion.span>
              </>
            )}
          </h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.45 }}
            className="text-base text-muted-foreground/90 max-w-2xl leading-relaxed"
          >
            {t("mr.home.hero.desc")}
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.45 }}
            className="flex flex-wrap gap-4 pt-2"
          >
            <Link href="/projects" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all hover:bg-primary/90 hover:shadow-[0_0_32px_rgba(245,158,11,0.55)] hover:-translate-y-0.5 active:translate-y-0">
              {t("mr.home.hero.btn.explore")}{!isEn && <span className="ml-1.5 opacity-60 text-xs">EXPLORE</span>}
            </Link>
            {isResolvingWallet ? (
              // Skeleton placeholder: same h-12 + rounded shell so the hero's
              // CTA row doesn't reflow once the wallet status resolves.
              <span aria-hidden className="inline-flex h-12 w-40 items-center justify-center rounded-md border border-border/40 bg-background/30 backdrop-blur" />
            ) : isConnected ? (
              <Link href="/app/profile" className="inline-flex h-12 items-center justify-center rounded-md border border-border/60 bg-background/50 backdrop-blur px-8 text-sm font-medium shadow-sm transition-all hover:bg-card hover:border-primary/30 hover:-translate-y-0.5 active:translate-y-0">
                {t("mr.home.hero.btn.dashboard")}{!isEn && <span className="ml-1.5 opacity-60 text-xs">DASHBOARD</span>}
              </Link>
            ) : (
              <Link href="/tools" className="inline-flex h-12 items-center justify-center rounded-md border border-border/60 bg-background/50 backdrop-blur px-8 text-sm font-medium shadow-sm transition-all hover:bg-card hover:border-primary/30 hover:-translate-y-0.5 active:translate-y-0">
                {t("mr.home.hero.btn.simulators")}{!isEn && <span className="ml-1.5 opacity-60 text-xs">SIMULATORS</span>}
              </Link>
            )}
          </motion.div>
        </div>
      </motion.section>

      {/* ── Market Overview ── */}
      <section className="space-y-6">
        <div className="flex items-end gap-4 border-l-[3px] border-primary pl-4">
          <div>
            {!isEn && <span className="text-[11px] uppercase tracking-[0.2em] text-primary/60 font-semibold">MARKET OVERVIEW</span>}
            <h2 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">{t("mr.section.market")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">
              {isEn ? "Global DeFi metrics" : `Global DeFi metrics · ${t("mr.section.market")}`}
            </p>
          </div>
        </div>

        <motion.div
          variants={cardStagger}
          initial="hidden"
          animate="show"
          className="grid gap-4 grid-cols-2 lg:grid-cols-4"
        >
          {isSummaryLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-[120px] w-full rounded-xl bg-card border border-border" />)
          ) : summary ? (
            <>
              <motion.div variants={cardItem}>
                <Card className="corner-brackets bg-card/80 backdrop-blur-sm border-border/60 shadow-sm border-t-[2px] border-t-primary hover:bg-card hover:border-t-primary hover:shadow-[0_0_24px_rgba(245,158,11,0.1)] transition-all duration-300 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      <span className="block">Total Value Locked</span>
                      <span className="text-[11px] opacity-60 tracking-widest zh-only">总锁仓量</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold num-gold">
                      <AnimatedCounter value={summary.totalTvl} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={cardItem}>
                <Card className="corner-brackets bg-card/80 backdrop-blur-sm border-border/60 shadow-sm border-t-[2px] border-t-emerald-500 hover:bg-card hover:shadow-[0_0_24px_rgba(52,211,153,0.08)] transition-all duration-300 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      <span className="block">Average Market APY</span>
                      <span className="text-[11px] opacity-60 tracking-widest zh-only">市场平均年化</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold num-shimmer">
                      <AnimatedCounter value={summary.avgApy} isPercent />%
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={cardItem}>
                <Card className="corner-brackets bg-card/80 backdrop-blur-sm border-border/60 shadow-sm border-t-[2px] border-t-chart-3 hover:bg-card hover:shadow-[0_0_24px_rgba(96,165,250,0.08)] transition-all duration-300 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      <span className="block">Tracked Projects</span>
                      <span className="text-[11px] opacity-60 tracking-widest zh-only">追踪项目数</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold num-gold">
                      <AnimatedCounter value={summary.totalProjects} isInteger />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={cardItem}>
                <Card className="corner-brackets bg-card/80 backdrop-blur-sm border-border/60 shadow-sm border-t-[2px] border-t-chart-4 hover:bg-card hover:shadow-[0_0_24px_rgba(248,113,113,0.08)] transition-all duration-300 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      <span className="block">Top Category</span>
                      <span className="text-[11px] opacity-60 tracking-widest zh-only">热门赛道</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold uppercase tracking-wider text-foreground pt-1">
                      {Object.entries(summary.categoryCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "DEX"}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          ) : null}
        </motion.div>
      </section>

      {/* ── Trending Opportunities ── */}
      <section className="space-y-6">
        <div className="border-b border-border/40 pb-4">
          <div className="border-l-[3px] border-chart-2 pl-4">
            <div className="flex items-center gap-2 mb-0.5">
              {!isEn && <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/60">TRENDING OPPORTUNITIES</span>}
              <TrendingUp className="h-3 w-3 text-primary/40" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">
              {t("mr.section.trending")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">
              {isEn ? "Highest yield changes in 24h" : `${t("mr.section.trending.sub")} · TRENDING`}
            </p>
          </div>
        </div>

        {isTrendingLoading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl bg-card border border-border" />
            ))}
          </div>
        ) : trendingProjects.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
            {/* Leaderboard list */}
            <div className="space-y-2.5">
              {trendingProjects.map((project, i) => (
                <TrendingRow key={project.id} project={project} rank={i} delay={i * 0.065} />
              ))}
            </div>

            {/* Side panel */}
            <div className="flex flex-col gap-4">
              {/* Top APY snapshot */}
              <div className="corner-brackets rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Top APY Snapshot</span>
                  <span className="text-[11px] text-muted-foreground/50 tracking-wider zh-only">最高年化速览</span>
                </div>
                {topByApy.map((p, i) => {
                  const change = getSeededChange(p);
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-0.5">
                      <span className={`text-xs font-bold w-5 text-center num-sm ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : "text-orange-500"}`}>
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground num-sm tracking-widest">{p.symbol}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold num-gold leading-snug">{p.apy.toFixed(2)}%</div>
                        <YieldChangeBadge change={change} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 24h Activity */}
              <div className="rounded-xl border border-chart-2/25 bg-chart-2/5 p-5 space-y-3">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-chart-2/70 font-semibold block">24h Yield Activity</span>
                  <span className="text-[11px] text-muted-foreground/50 tracking-wider zh-only">24小时收益变动概览</span>
                </div>
                {allProjects && (() => {
                  const changes = allProjects.map(p => getSeededChange(p));
                  const rising = changes.filter(c => c > 0.5).length;
                  const falling = changes.filter(c => c < -0.5).length;
                  const stable = changes.length - rising - falling;
                  return (
                    <div className="space-y-3 pt-1">
                      {[
                        { label: `${rising} rising`, color: "bg-emerald-500", val: rising, textColor: "text-emerald-400" },
                        { label: `${stable} stable`, color: "bg-muted-foreground/40", val: stable, textColor: "text-muted-foreground" },
                        { label: `${falling} falling`, color: "bg-red-500", val: falling, textColor: "text-red-400" },
                      ].map(({ label, color, val, textColor }) => (
                        <div key={label} className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                            <motion.div
                              className={`h-full ${color} rounded-full`}
                              initial={{ width: 0 }}
                              whileInView={{ width: `${(val / changes.length) * 100}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                            />
                          </div>
                          <span className={`text-[11px] num-sm ${textColor} w-16 text-right`}>{label}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center border border-dashed border-border rounded-xl bg-card/30">
            <p className="text-muted-foreground text-sm">No trending projects at this time.</p>
          </div>
        )}

        {/* View All — bottom of trending */}
        <div className="flex justify-end pt-1">
          <Link href="/projects" className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary border border-border/50 hover:border-primary/30 rounded-lg px-4 py-2 bg-card/40 hover:bg-card/80 transition-all duration-200">
            {t("mr.action.viewFull")}{!isEn && " · VIEW ALL"}
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ── Recommended Projects ── */}
      <section className="space-y-6">
        <div className="border-b border-border/40 pb-4">
          <div className="border-l-[3px] border-primary pl-4">
            {!isEn && <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/60 block mb-0.5">FEATURED ANALYSIS</span>}
            <h2 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">
              {t("mr.projects.featured")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">
              {isEn ? "Curated high-conviction opportunities" : `Curated opportunities · ${t("mr.projects.featured")}`}
            </p>
          </div>
        </div>

        {isTrendingLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-[280px] w-full rounded-xl bg-card border border-border" />)}
          </div>
        ) : allProjects && allProjects.filter(p => p.isRecommended).length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {allProjects.filter(p => p.isRecommended).slice(0, 4).map(project => (
              <motion.div key={project.id} variants={itemVariants}>
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="py-12 text-center border border-dashed border-border rounded-xl bg-card/30">
            <p className="text-muted-foreground text-sm">No recommended projects at this time.</p>
          </div>
        )}

        {/* View All — bottom of recommended */}
        <div className="flex justify-end pt-1">
          <Link href="/projects" className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary border border-border/50 hover:border-primary/30 rounded-lg px-4 py-2 bg-card/40 hover:bg-card/80 transition-all duration-200">
            {t("mr.action.viewFull")}{!isEn && " · VIEW ALL"}
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
}
