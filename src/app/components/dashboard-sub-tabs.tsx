import { useId } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@app/lib/utils";

export interface SubTabItem<K extends string = string> {
  key: K;
  icon: React.ComponentType<{ className?: string }>;
  /** i18n key */
  labelKey: string;
  /** English fallback if the key is missing */
  fallback: string;
}

/**
 * Shared sub-tab pill row used on Vault, Profile-Referral, Profile-Nodes
 * (and anywhere else that needs an in-page tab strip). `flex-1 basis-0`
 * gives every tab true equal width regardless of label length. The active
 * highlight is a single absolutely-positioned pill that slides between cells
 * via a shared `layoutId` (iOS segmented-control feel); `whileTap` adds a
 * tactile press. Both states keep the same `border` so the content box is
 * identical pixel-for-pixel and nothing drifts as the pill moves.
 */
export function DashboardSubTabs<K extends string>({
  tabs,
  active,
  onChange,
  testIdPrefix,
}: {
  tabs: ReadonlyArray<SubTabItem<K>>;
  active: K;
  onChange: (key: K) => void;
  testIdPrefix?: string;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  // Unique per-instance id so multiple sub-tab strips on one page don't share
  // (and animate between) the same sliding pill.
  const groupId = useId();

  return (
    <div className="flex gap-1.5 rounded-xl border border-border/55 bg-card/60 p-1 surface-3d">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <motion.button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={cn(
              "relative flex-1 basis-0 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 transition-colors",
              isActive
                ? "border-amber-500/40 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/40",
            )}
            data-testid={testIdPrefix ? `${testIdPrefix}-${tab.key}` : undefined}
          >
            {isActive && (
              <motion.span
                layoutId={`subtab-pill-${groupId}`}
                className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-500/20 via-amber-600/15 to-amber-700/10 ring-1 ring-amber-400/30"
                style={{
                  boxShadow:
                    "inset 0 1px 0 rgba(255,244,214,0.18), 0 2px 12px rgba(245,158,11,0.20)",
                }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon
              className={cn(
                "relative z-10 hidden sm:block h-3.5 w-3.5 shrink-0",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span className="relative z-10 text-[12px] font-bold tracking-wide whitespace-nowrap truncate">
              {t(tab.labelKey, tab.fallback)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
