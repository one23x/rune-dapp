import { useEffect, useState } from "react";
import { Layers, ExternalLink, Lock, Droplets, Flame, Rocket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "framer-motion";
import { PageEnter } from "@app/components/page-enter";

/**
 * Vault page — staking-launch COUNTDOWN hero.
 *
 * The old 金库质押 pool/lock/burn tabs (progress bars + on-chain value fetches)
 * are retired here: vault staking isn't live yet, so showing progress/value
 * numbers was misleading. This page now leads with a polished launch countdown
 * to the go-live moment and a marketing-light feature strip describing the RUNE
 * vault ecosystem (lock-stake / LP pool / burn). The page shell, header and
 * bottom nav are untouched; the /projects/rune analytics link is preserved.
 *
 * Go-live: 2026-07-09 19:13:00 Singapore time (UTC+8).
 */
const LAUNCH_AT = new Date("2026-07-09T19:13:00+08:00");

type Remaining = { d: number; h: number; m: number; s: number; done: boolean };

function computeRemaining(): Remaining {
  const diff = LAUNCH_AT.getTime() - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true };
  const totalSec = Math.floor(diff / 1000);
  return {
    d: Math.floor(totalSec / 86400),
    h: Math.floor((totalSec % 86400) / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
    done: false,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

function CountUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-0 flex-1">
      <div
        className="num-gold font-display tabular-nums leading-none
                   text-[clamp(2rem,11vw,3.75rem)] font-extrabold tracking-tight"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
    </div>
  );
}

function CountSep() {
  return (
    <div
      className="num-gold font-display text-[clamp(1.5rem,8vw,2.75rem)] font-bold leading-none -mt-3 opacity-60 select-none"
      aria-hidden
    >
      :
    </div>
  );
}

export default function Vault() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [remaining, setRemaining] = useState<Remaining>(() => computeRemaining());

  // Tick once per second; clean the interval on unmount. Stop ticking once
  // we've crossed the launch moment (nothing left to count down).
  useEffect(() => {
    if (remaining.done) return;
    const id = window.setInterval(() => setRemaining(computeRemaining()), 1000);
    return () => window.clearInterval(id);
  }, [remaining.done]);

  const isLive = remaining.done;

  const features = [
    {
      icon: Lock,
      titleKey: "vault.launch.featLockTitle",
      titleFallback: "锁定质押",
      descKey: "vault.launch.featLockDesc",
      descFallback: "按 RUNE 节点等级解锁分层收益",
      color: "#fbbf24",
    },
    {
      icon: Droplets,
      titleKey: "vault.launch.featLpTitle",
      titleFallback: "流动性池",
      descKey: "vault.launch.featLpDesc",
      descFallback: "为协议提供流动性,共享交易费",
      color: "#38bdf8",
    },
    {
      icon: Flame,
      titleKey: "vault.launch.featBurnTitle",
      titleFallback: "销毁通缩",
      descKey: "vault.launch.featBurnDesc",
      descFallback: "协议回购销毁,长期通缩模型",
      color: "#fb7185",
    },
  ];

  return (
    <PageEnter>
      <div className="relative pb-24 lg:pb-8 px-4 lg:px-6">
        {/* Header — glass icon tile + live pulse + metallic title (unchanged shell) */}
        <header className="pt-6 pb-5 relative z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                  <Layers className="text-amber-200" size={20} />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3">
                  <div
                    className="absolute inset-0 bg-emerald-400 rounded-full"
                    style={reduce ? undefined : { animation: "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
                  />
                  <div className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50" />
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight gold-text drop-shadow-md leading-tight">
                  {t("vault.pageTitle")}
                </h1>
                <p className="text-xs text-white/70 truncate">{t("vault.pageSubtitle")}</p>
              </div>
            </div>

            {/* 查看分析 — preserved: opens mainnet RUNE analytics in a NEW TAB. */}
            <a
              href="/projects/rune"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white/90 hover:bg-white/20 transition-colors backdrop-blur-md shrink-0"
              data-testid="link-view-analysis"
            >
              <span className="whitespace-nowrap">{t("vault.viewAnalysis", "查看分析")}</span>
              <ExternalLink size={12} className="opacity-70" />
            </a>
          </div>
        </header>

        {/* ── Launch countdown hero ── */}
        <main className="relative z-10">
          <section
            className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-[#1a1407]/95 via-[#0f0a04]/95 to-[#080502]/95 p-5 sm:p-7 lg:p-9 shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
            data-testid="vault-launch-hero"
          >
            {/* Background layers — pointer-events-none so CTAs stay hot */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_0%,rgba(251,191,36,0.14),transparent_60%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_100%,rgba(217,119,6,0.08),transparent_55%)] pointer-events-none" />
            {!reduce && (
              <>
                <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-amber-500/15 blur-[80px] pointer-events-none animate-orb-drift" />
                <div className="absolute -bottom-32 -left-20 w-56 h-56 rounded-full bg-amber-600/10 blur-[90px] pointer-events-none animate-orb-drift" style={{ animationDelay: "-5s" }} />
                <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none animate-scan-line" style={{ top: 0 }} />
              </>
            )}

            {/* Corner brackets */}
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-amber-400/40 rounded-tl pointer-events-none" />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-amber-400/40 rounded-tr pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-amber-400/40 rounded-bl pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-amber-400/40 rounded-br pointer-events-none" />

            <div className="relative z-10 space-y-5 sm:space-y-6">
              {/* Status pill */}
              <div className="flex items-center justify-center sm:justify-start">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur border border-amber-500/30">
                  <span className="relative flex h-1.5 w-1.5">
                    {!reduce && <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80" />}
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-amber-300">
                    {isLive
                      ? t("vault.launch.livePill", "已上线")
                      : t("vault.launch.soonPill", "即将上线")}
                  </span>
                </div>
              </div>

              {/* Headline */}
              <div className="space-y-2 text-center sm:text-left">
                <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight gold-text drop-shadow-md">
                  {t("vault.launch.headline", "金库质押 · 上线倒计时")}
                </h2>
                <p className="text-[13px] sm:text-sm text-white/70 leading-snug max-w-2xl mx-auto sm:mx-0">
                  {t(
                    "vault.launch.subline",
                    "机构级质押金库即将开启 · 按 RUNE 节点等级享分层收益与生态权益",
                  )}
                </p>
              </div>

              {/* Countdown */}
              {isLive ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-6 text-center" data-testid="vault-launch-live">
                  <Rocket className="mx-auto mb-2 text-emerald-300" size={28} />
                  <div className="font-display text-xl sm:text-2xl font-extrabold gold-text">
                    {t("vault.launch.liveHeadline", "金库质押已上线")}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {t("vault.launch.liveSub", "质押功能现已开放,敬请体验")}
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm px-3 py-5 sm:px-6"
                  data-testid="vault-launch-countdown"
                >
                  <div className="flex items-start justify-center gap-1 sm:gap-3">
                    <CountUnit value={pad(remaining.d)} label={t("vault.launch.days", "天")} />
                    <CountSep />
                    <CountUnit value={pad(remaining.h)} label={t("vault.launch.hours", "时")} />
                    <CountSep />
                    <CountUnit value={pad(remaining.m)} label={t("vault.launch.minutes", "分")} />
                    <CountSep />
                    <CountUnit value={pad(remaining.s)} label={t("vault.launch.seconds", "秒")} />
                  </div>
                  <div className="mt-4 text-center text-[10px] text-white/40 tracking-wide">
                    {t("vault.launch.targetLabel", "上线时间")} · 2026-07-09 19:13 (UTC+8)
                  </div>
                </div>
              )}

              {/* Feature strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {features.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div
                      key={f.titleKey}
                      className="group relative overflow-hidden rounded-xl p-3.5 border border-white/8 bg-white/[0.025] backdrop-blur-sm transition-all hover:border-amber-500/30 hover:bg-white/[0.04]"
                    >
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center mb-2.5"
                        style={{
                          background: `${f.color}1a`,
                          border: `1px solid ${f.color}40`,
                          boxShadow: `0 0 16px ${f.color}1a`,
                        }}
                      >
                        <Icon className="h-4 w-4" style={{ color: f.color }} />
                      </div>
                      <div className="text-[13px] font-bold text-foreground/90 leading-tight">
                        {t(f.titleKey, f.titleFallback)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        {t(f.descKey, f.descFallback)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Open-after-launch note + disabled CTA */}
              <div className="pt-1 flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={!isLive}
                  className={
                    isLive
                      ? "group relative inline-flex w-full h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold text-black shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all hover:-translate-y-0.5"
                      : "inline-flex w-full h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold cursor-not-allowed text-white/40 border border-white/10 bg-white/[0.03]"
                  }
                  style={isLive ? { background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 50%, #d97706 100%)" } : undefined}
                  data-testid="button-vault-launch-cta"
                >
                  {isLive
                    ? t("vault.launch.ctaLive", "进入金库质押")
                    : t("vault.launch.ctaSoon", "上线后开放")}
                </button>
                {!isLive && (
                  <p className="text-center text-[11px] text-white/40">
                    {t("vault.launch.note", "质押、流动性与销毁模块将于上线时同步开放")}
                  </p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </PageEnter>
  );
}
