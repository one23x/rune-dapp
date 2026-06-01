/**
 * SmartPredictionHero — Strategy → 智能预测 tab landing card.
 *
 * Pitches the Polymarket copy-trade product to dashboard users: tracks
 * leaderboard-top RUNE traders, layers our AI risk analytics on top of
 * their order flow, and recommends curated strategy packs.
 *
 * The "Enter" CTA opens https://www.rune-protocol.com/ in a new tab for
 * everyone.
 */
import { useTranslation } from "react-i18next";
import { Brain, Sparkles, ArrowRight, Radio } from "lucide-react";

const RUNE_PROTOCOL_URL = "https://www.rune-protocol.com/";

export function SmartPredictionHero() {
  const { t } = useTranslation();

  const handleEnter = () => {
    window.open(RUNE_PROTOCOL_URL, "_blank", "noopener,noreferrer");
  };

  const features = [
    {
      icon: Radio,
      titleKey: "strategy.smartPrediction.feature1Title",
      descKey: "strategy.smartPrediction.feature1Desc",
      color: "#fbbf24",
    },
    {
      icon: Brain,
      titleKey: "strategy.smartPrediction.feature2Title",
      descKey: "strategy.smartPrediction.feature2Desc",
      color: "#a78bfa",
    },
    {
      icon: Sparkles,
      titleKey: "strategy.smartPrediction.feature3Title",
      descKey: "strategy.smartPrediction.feature3Desc",
      color: "#4ade80",
    },
  ];

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease-out 0.05s both" }}>
      <section
        className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-[#1a1407]/95 via-[#0f0a04]/95 to-[#080502]/95 p-5 md:p-8 lg:p-10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
        data-testid="smart-prediction-hero"
      >
        {/* ── Background layers (all pointer-events-none to keep CTAs hot) ── */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_0%,rgba(251,191,36,0.12),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_100%,rgba(168,85,247,0.08),transparent_55%)] pointer-events-none" />

        {/* Ambient orbs */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-amber-500/15 blur-[80px] pointer-events-none animate-orb-drift" />
        <div className="absolute -bottom-32 -left-20 w-56 h-56 rounded-full bg-purple-500/10 blur-[90px] pointer-events-none animate-orb-drift" style={{ animationDelay: "-5s" }} />
        <div className="absolute top-1/3 right-1/4 w-32 h-32 rounded-full bg-emerald-400/8 blur-[50px] pointer-events-none animate-float-y" style={{ animationDelay: "-2s" }} />

        {/* Scan line */}
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none animate-scan-line" style={{ top: 0 }} />

        {/* Corner brackets */}
        <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-amber-400/40 rounded-tl pointer-events-none" />
        <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-amber-400/40 rounded-tr pointer-events-none" />
        <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-amber-400/40 rounded-bl pointer-events-none" />
        <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-amber-400/40 rounded-br pointer-events-none" />

        {/* ── Content ─────────────────────────────────────────────── */}
        <div className="relative z-10 space-y-5 md:space-y-6">
          {/* Top row: live badge */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur border border-amber-500/30">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-300">
                {t("strategy.smartPrediction.livePill", "LIVE")}
              </span>
            </div>
          </div>

          {/* Title + subtitle */}
          <div className="space-y-2">
            <h1
              className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight"
              style={{
                background: "linear-gradient(135deg, #fef3c7 0%, #fcd34d 35%, #f59e0b 70%, #d97706 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t("strategy.smartPrediction.title", "RUNE Smart Prediction")}
            </h1>
            <p className="text-sm md:text-base text-foreground/75 font-medium leading-snug">
              {t("strategy.smartPrediction.subtitle", "AI-driven Polymarket copy-trading")}
            </p>
          </div>

          {/* Description */}
          <p className="text-[13px] md:text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {t(
              "strategy.smartPrediction.description",
              "Track top-ranked RUNE traders on Polymarket, get layered AI risk analytics on their orders, and copy curated strategy packs in one tap.",
            )}
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.titleKey}
                  className="group relative overflow-hidden rounded-xl p-3 md:p-4 border border-white/8 bg-white/[0.025] backdrop-blur-sm transition-all hover:border-amber-500/30 hover:bg-white/[0.04] hover:-translate-y-0.5"
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
                  <div className="text-[12px] md:text-[13px] font-bold text-foreground/90 leading-tight">
                    {t(f.titleKey)}
                  </div>
                  <div className="text-[10.5px] md:text-[11.5px] text-muted-foreground mt-1 leading-snug">
                    {t(f.descKey)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA row. Entry is open to everyone. */}
          <div className="pt-1 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleEnter}
              className="group relative inline-flex w-full sm:w-auto h-11 md:h-12 items-center justify-center gap-2 rounded-lg px-5 md:px-8 text-[13px] md:text-sm font-bold text-black shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all hover:shadow-[0_0_32px_rgba(245,158,11,0.6)] hover:-translate-y-0.5 active:translate-y-0"
              style={{
                background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 50%, #d97706 100%)",
              }}
              data-testid="button-smart-prediction-enter"
            >
              <span>{t("strategy.smartPrediction.enterBtn", "Enter Smart Prediction")}</span>
              <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
