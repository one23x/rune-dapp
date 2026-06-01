import { useState, type ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@app/lib/utils";

/**
 * Tiny collapsible info card. Used to fold the benefits / formula blurbs on
 * the vault lock + burn sections so the page lands on the action surface
 * (period selector, amount input) instead of three screens of preamble.
 */
export function CollapsibleInfoCard({
  title,
  defaultOpen = false,
  accent = "primary",
  icon: IconComp = Info,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  /** Accent semantic token — primary (amber) for lock, red for burn. */
  accent?: "primary" | "red";
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const palette =
    accent === "red"
      ? {
          iconWrap: "bg-orange-500/15 ring-orange-500/30",
          iconColor: "text-orange-300",
        }
      : {
          iconWrap: "bg-amber-500/15 ring-amber-400/30",
          iconColor: "text-amber-300",
        };

  return (
    <div className="glass-panel transition-colors">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <div className={cn("h-6 w-6 rounded-md flex items-center justify-center ring-1", palette.iconWrap)}>
            <IconComp className={cn("h-3 w-3", palette.iconColor)} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">{title}</span>
        </div>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-white/50 transition-transform", open ? "rotate-180" : "rotate-0")}
        />
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-2">{children}</div>}
    </div>
  );
}
