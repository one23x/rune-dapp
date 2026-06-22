/**
 * StrategySelect — 选板块策略(premium 重设计)。每张卡:左侧 accent 渐变光带 + 发光图标 +
 * 名称/板块/简介 + mini-stats(币种数 / 打法数 / 方向)+ 选中态光环;确认 → /strategy/hl?strategy=id。
 *
 * 文案全走 i18n(strategyName/strategySector/strategyBlurb/strategyCard.*)。移动端优先 + dark glass/amber。
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp, LineChart, Rocket, CheckCircle2, ArrowRight, Layers, Activity, type LucideIcon } from "lucide-react";
import { cn } from "@app/lib/utils";

interface Accent { rail: string; tile: string; icon: string; ring: string; glow: string }
interface StrategyMeta {
  id: string; icon: LucideIcon; name: string; sector: string; blurb: string;
  markets: number; dirKey: "dirBoth" | "dirLong"; accent: Accent;
}

const STRATEGIES: StrategyMeta[] = [
  {
    id: "crypto-trend", icon: TrendingUp, name: "加密趋势", sector: "加密主流",
    blurb: "十日突破 · 回调延续 · 冲洗回升 · 双向", markets: 8, dirKey: "dirBoth",
    accent: { rail: "from-amber-400 to-amber-600", tile: "bg-amber-500/15", icon: "text-amber-300", ring: "ring-amber-400/40", glow: "shadow-[0_0_24px_rgba(245,158,11,0.18)]" },
  },
  {
    id: "equity-swing", icon: LineChart, name: "美股摆动", sector: "美股",
    blurb: "趋势回调 · 指数洗盘 · 财报后漂移", markets: 15, dirKey: "dirLong",
    accent: { rail: "from-sky-400 to-cyan-600", tile: "bg-sky-500/15", icon: "text-sky-300", ring: "ring-sky-400/40", glow: "shadow-[0_0_24px_rgba(56,189,248,0.18)]" },
  },
  {
    id: "meme-momentum", icon: Rocket, name: "Meme 动量", sector: "Meme",
    blurb: "突破首回踩 · 冲洗回升 · 破位逼空空", markets: 8, dirKey: "dirLong",
    accent: { rail: "from-fuchsia-400 to-purple-600", tile: "bg-fuchsia-500/15", icon: "text-fuchsia-300", ring: "ring-fuchsia-400/40", glow: "shadow-[0_0_24px_rgba(232,121,249,0.18)]" },
  },
];

export function StrategySelect() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const reduce = useReducedMotion();
  const [sel, setSel] = useState<string | null>(null);
  const selMeta = STRATEGIES.find((s) => s.id === sel);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3">
        {STRATEGIES.map((s, i) => {
          const active = sel === s.id;
          const Icon = s.icon;
          return (
            <motion.button
              key={s.id}
              type="button"
              onClick={() => setSel(s.id)}
              {...(reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.06 * i, type: "spring", stiffness: 240, damping: 26 } })}
              className={cn(
                "group relative w-full text-left rounded-2xl border overflow-hidden transition-all active:scale-[0.99]",
                active ? cn("border-white/15 bg-white/[0.04] ring-1", s.accent.ring, s.accent.glow) : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
              )}
              data-testid={`strategy-card-${s.id}`}
            >
              {/* accent 光带 */}
              <span className={cn("absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b transition-opacity", s.accent.rail, active ? "opacity-100" : "opacity-50 group-hover:opacity-80")} />
              <div className="pl-4 pr-3.5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={cn("shrink-0 grid h-11 w-11 place-items-center rounded-xl transition", active ? s.accent.tile : "bg-white/[0.04]")}>
                    <Icon className={cn("h-5 w-5", active ? s.accent.icon : "text-foreground/55")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[15px] font-bold text-foreground truncate tracking-tight">{t(`strategyName.${s.id}`, s.name)}</span>
                      <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-foreground/50">{t(`strategySector.${s.id}`, s.sector)}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-foreground/55">{t(`strategyBlurb.${s.id}`, s.blurb)}</p>
                  </div>
                  {active && <CheckCircle2 className={cn("h-5 w-5 shrink-0", s.accent.icon)} />}
                </div>
                {/* mini-stats */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-[3.5rem]">
                  {[
                    { icon: Layers, txt: t("strategyCard.markets", "{{n}} 币种", { n: s.markets }) },
                    { icon: Activity, txt: t("strategyCard.plays", "3 套打法") },
                    { icon: null, txt: t(`strategyCard.${s.dirKey}`, s.dirKey === "dirBoth" ? "双向" : "偏多") },
                  ].map((m, k) => (
                    <span key={k} className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-mono text-foreground/55">
                      {m.icon && <m.icon className="h-2.5 w-2.5" />}{m.txt}
                    </span>
                  ))}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!sel}
        onClick={() => sel && navigate(`/strategy/hl?strategy=${sel}`)}
        className="gold-button w-full flex items-center justify-center gap-1.5 rounded-xl py-3.5 min-h-[52px] text-[13px] font-extrabold disabled:opacity-40 transition"
        data-testid="button-confirm-strategy"
      >
        {selMeta ? `${t("strategySelect.confirm", "确认并进入交易引擎")} · ${t(`strategyName.${selMeta.id}`, selMeta.name)}` : t("strategySelect.confirm", "确认并进入交易引擎")}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default StrategySelect;
