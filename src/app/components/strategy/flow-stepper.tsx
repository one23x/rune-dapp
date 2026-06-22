/**
 * FlowStepper — Purely-presentational 4-step progress indicator for a gated wizard.
 *
 * Shows which step is active, which are completed, and which are locked.
 * No data fetching, no business logic — render-only, driven by props.
 *
 * Design: dark-glass + amber. Mobile-first (fits 4 nodes + connectors at 360px).
 */

import type { ElementType } from "react";
import { Check } from "lucide-react";
import { cn } from "@app/lib/utils";

export interface FlowStep {
  key: string;
  label: string;
  icon: ElementType;
}

interface FlowStepperProps {
  /** 4 steps */
  steps: FlowStep[];
  /** 0-based index of the active step */
  current: number;
  /** highest unlocked index (steps <= this are done/clickable) */
  maxReached: number;
  /** clicking an unlocked step (index <= maxReached) calls this */
  onJump?: (index: number) => void;
}

type NodeState = "done" | "current" | "unlocked" | "locked";

function resolveState(index: number, current: number, maxReached: number): NodeState {
  if (index === current) return "current";
  if (index < current) return "done";
  if (index <= maxReached) return "unlocked";
  return "locked";
}

export function FlowStepper({ steps, current, maxReached, onJump }: FlowStepperProps) {
  return (
    <div className="w-full rounded-2xl border border-white/[0.06] bg-black/30 backdrop-blur-md p-3 sm:p-4">
      <div className="flex w-full items-start">
        {steps.map((step, index) => {
          const state = resolveState(index, current, maxReached);
          const Icon = state === "done" ? Check : step.icon;
          const clickable = index <= maxReached && state !== "current";
          // Connector to the right is amber once this step is completed.
          const connectorDone = index < current;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.key} className="flex min-w-0 flex-1 items-start">
              {/* Node (tile + label) */}
              <div className="flex min-w-0 shrink-0 flex-col items-center gap-1.5">
                <button
                  type="button"
                  disabled={!clickable}
                  aria-current={state === "current" ? "step" : undefined}
                  aria-label={step.label}
                  onClick={clickable ? () => onJump?.(index) : undefined}
                  className={cn(
                    "relative grid h-7 w-7 place-items-center rounded-full border transition-all duration-300 sm:h-9 sm:w-9",
                    state === "current" &&
                      "border-amber-400 bg-gradient-to-b from-amber-400/20 to-amber-600/10 text-amber-300 ring-2 ring-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.3)]",
                    state === "done" &&
                      "border-transparent bg-gradient-to-b from-amber-400 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]",
                    state === "unlocked" &&
                      "cursor-pointer border-amber-400/30 bg-amber-400/[0.06] text-amber-400/80 hover:border-amber-400/60 hover:bg-amber-400/10 hover:text-amber-300",
                    state === "locked" && "cursor-default border-white/10 bg-white/[0.02] text-foreground/30",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.25} />
                  {/* Subtle ordinal badge */}
                  <span
                    className={cn(
                      "absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-bold leading-none transition-colors duration-300 sm:h-4 sm:w-4 sm:text-[9px]",
                      state === "current" && "bg-amber-400 text-black",
                      state === "done" && "bg-black/60 text-amber-300",
                      state === "unlocked" && "bg-amber-400/20 text-amber-300/80",
                      state === "locked" && "bg-white/10 text-foreground/40",
                    )}
                  >
                    {index + 1}
                  </span>
                </button>
                <span
                  className={cn(
                    "max-w-[64px] truncate text-center text-[10px] leading-tight transition-colors duration-300 sm:max-w-[88px] sm:text-xs",
                    state === "current" && "font-semibold text-amber-300",
                    state === "done" && "text-foreground/70",
                    state === "unlocked" && "text-foreground/60",
                    state === "locked" && "text-foreground/30",
                  )}
                  title={step.label}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector to next node */}
              {!isLast && (
                <div className="mt-3.5 min-w-0 flex-1 px-1 sm:mt-[18px] sm:px-1.5">
                  <div
                    className={cn(
                      "h-0.5 w-full rounded-full transition-colors duration-300",
                      connectorDone
                        ? "bg-gradient-to-r from-amber-400 to-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                        : "bg-white/10",
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
