import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles, ChevronRight, Users } from "lucide-react";
import { GoldCard } from "@app/components/premium-card";

/**
 * Smart Copy-Trading entry — the single foreground CTA into the copy-trading
 * feature. Uses the app's flagship `GoldCard` (animated golden ring) surface +
 * amber palette so it reads as a premium hero on the trade page. Routes to
 * `/copy-trading` (wouter base="/app" → /app/copy-trading).
 *
 * `compact` renders a slim banner (for inline placement on the trade page);
 * default renders a fuller hero with the description line.
 */
export function CopyTradingEntry({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();

  return (
    <Link href="/copy-trading" className="block">
      <GoldCard className="rounded-2xl">
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="relative overflow-hidden rounded-2xl p-4 lg:p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(180,90,10,0.06) 60%, transparent 100%)",
          }}
          data-testid="copy-trading-entry"
        >
          <div className="flex items-center gap-3.5">
            <div
              className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11 lg:h-12 lg:w-12"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(180,90,10,0.12))",
                border: "1px solid rgba(251,191,36,0.4)",
                boxShadow: "0 0 18px rgba(251,191,36,0.18), inset 0 1px 0 rgba(251,191,36,0.25)",
              }}
            >
              <Users className="h-5 w-5 lg:h-6 lg:w-6 text-amber-300" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-300/80 shrink-0" />
                <h3
                  className="font-bold text-[15px] lg:text-base text-foreground truncate"
                  style={{ fontFamily: "'Orbitron', 'Space Grotesk', sans-serif", letterSpacing: "0.01em" }}
                >
                  {t("copyTrading.entryTitle", "智能预测跟单")}
                </h3>
              </div>
              {!compact && (
                <p className="mt-1 text-[12px] leading-snug text-foreground/55 line-clamp-2">
                  {t("copyTrading.entryDesc")}
                </p>
              )}
              {compact && (
                <p className="mt-0.5 text-[11px] text-amber-300/70">
                  {t("copyTrading.entryCta", "进入智能跟单")}
                </p>
              )}
            </div>

            <ChevronRight className="h-5 w-5 text-amber-300/70 shrink-0" />
          </div>
        </motion.div>
      </GoldCard>
    </Link>
  );
}

export default CopyTradingEntry;
