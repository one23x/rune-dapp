/**
 * Prediction AI Console — a live typewriter terminal that narrates how a
 * model reads a prediction market and arrives at a PLACE / CLOSE decision.
 *
 * Mirrors the Hyperliquid AiThinkingConsole's char-by-char playback, but
 * the lines are prediction-market native (order book, news sentiment,
 * base rate vs. market-implied probability, edge) and the feed is
 * synthesized deterministically from `prediction-ai-data` — a new tick is
 * pushed on a timer so the console keeps ticking while open.
 */
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Terminal, X, Brain } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { pmTick, hash32, type PmTick } from "@app/lib/prediction-ai-data";

interface ConsoleLine {
  type: "system" | "analysis" | "signal" | "result";
  text: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
function tsLabel(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type TFunc = (key: string, fallback: string, opts?: Record<string, unknown>) => string;

/** Turn one tick into a block of console lines (fully i18n with English
 *  fallbacks; missing locales fall back to en automatically). */
function buildBlock(tick: PmTick, t: TFunc): ConsoleLine[] {
  const stamp = tsLabel(tick.ts);
  const lines: ConsoleLine[] = [
    { type: "system", text: `[${stamp}] ${tick.model} ${t("pmConsole.scanning", "scanning \u201C{{market}}\u201D", { market: tick.market })}` },
    { type: "analysis", text: `> ${t("pmConsole.orderBook", "order book: {{outcome}} {{bid}}\u00A2 / {{ask}}\u00A2 \u00B7 spread {{spread}}\u00A2", { outcome: tick.outcome, bid: tick.bid, ask: tick.ask, spread: tick.ask - tick.bid })}` },
    { type: "analysis", text: `> ${t("pmConsole.volume", "24h volume ${{vol}}K across {{traders}} traders", { vol: tick.volK, traders: tick.traders })}` },
    { type: "analysis", text: `> ${t("pmConsole.sentiment", "news sentiment {{pct}}% favorable (last 6h)", { pct: tick.sentiment })}` },
    { type: "analysis", text: `> ${t("pmConsole.baseRate", "base rate {{base}}% vs market-implied {{impl}}%", { base: tick.baseRate, impl: tick.implied })}` },
    { type: "signal", text: `> ${t("pmConsole.edge", "edge {{edge}}% \u00B7 confidence {{conf}}%", { edge: tick.edgePct, conf: tick.confidence })}` },
  ];

  if (tick.decision === "PLACE") {
    lines.push({
      type: "result",
      text: `${t("pmConsole.place", "PLACE {{outcome}} @ {{price}}\u00A2 \u2014 {{reason}}", { outcome: tick.outcome, price: tick.priceCents, reason: tick.rationale })}`,
    });
  } else if (tick.decision === "CLOSE") {
    const pnl = tick.pnlPct ?? 0;
    lines.push({
      type: "result",
      text: `${t("pmConsole.close", "CLOSE {{outcome}} @ {{price}}\u00A2 \u00B7 pnl {{pnl}}% \u2014 {{reason}}", { outcome: tick.outcome, price: tick.priceCents, pnl: `${pnl >= 0 ? "+" : ""}${pnl}`, reason: tick.rationale })}`,
    });
  } else {
    lines.push({
      type: "result",
      text: `${t("pmConsole.hold", "HOLD \u2014 {{reason}}", { reason: tick.rationale })}`,
    });
  }
  return lines;
}

function lineColor(type: string): string {
  return type === "system"
    ? "text-muted-foreground/55"
    : type === "signal"
    ? "text-yellow-400/85"
    : type === "result"
    ? "text-emerald-400 font-bold"
    : "text-foreground/65";
}

export function PredictionAiConsole({
  model,
  color,
  isVisible,
}: {
  model: string;
  color: string;
  isVisible: boolean;
}) {
  const { t } = useTranslation();
  const tt = t as unknown as TFunc;

  const [displayedLines, setDisplayedLines] = useState<ConsoleLine[]>([]);
  const [currentText, setCurrentText] = useState("");
  const [currentType, setCurrentType] = useState<string>("system");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!isVisible) {
      cancelRef.current = true;
      setDisplayedLines([]);
      setCurrentText("");
      setIsTyping(false);
      return;
    }

    cancelRef.current = false;
    let mounted = true;
    let counter = hash32(`console:${model}`);

    async function typeLines(lines: ConsoleLine[]) {
      for (const line of lines) {
        if (cancelRef.current || !mounted) return;
        setCurrentType(line.type);
        for (let i = 0; i <= line.text.length; i++) {
          if (cancelRef.current || !mounted) return;
          setCurrentText(line.text.slice(0, i));
          const speed = line.type === "system" ? 12 : line.type === "result" ? 18 : 14;
          await new Promise((r) => setTimeout(r, speed));
        }
        setDisplayedLines((prev) => [...prev.slice(-60), line]);
        setCurrentText("");
        const pause = line.type === "result" ? 700 : line.type === "signal" ? 350 : 80;
        await new Promise((r) => setTimeout(r, pause));
      }
    }

    async function loop() {
      setIsTyping(true);
      // Seed a small backlog so the console isn't empty on open, then keep
      // pushing fresh ticks for a live feel.
      const now = Date.now();
      const backlog = [3, 2, 1].map((n) => pmTick(counter++, model, now - n * 47_000));
      let queue: PmTick[] = [...backlog];

      while (!cancelRef.current && mounted) {
        if (queue.length === 0) {
          queue.push(pmTick(counter++, model, Date.now()));
        }
        const tick = queue.shift()!;
        const block = buildBlock(tick, tt);
        await typeLines(block);
        if (cancelRef.current || !mounted) break;
        await new Promise((r) => setTimeout(r, 2200));
      }
      setIsTyping(false);
    }

    void loop();
    return () => {
      mounted = false;
      cancelRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, model]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displayedLines, currentText]);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${color}15` }}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "rgba(0,0,0,0.3)", borderBottom: `1px solid ${color}10` }}>
        <Terminal className="h-3 w-3" style={{ color }} />
        <span className="text-[10px] font-mono font-bold" style={{ color }}>
          {model} {t("pmConsole.title", "Reasoning Console")}
        </span>
        <div className="flex-1" />
        {isTyping && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        <span className="text-[9px] font-mono text-muted-foreground/40">
          {isTyping ? t("pmConsole.analyzing", "analyzing...") : t("pmConsole.idle", "idle")}
        </span>
      </div>
      <div ref={scrollRef} className="px-3 py-2 h-[240px] overflow-y-auto font-mono text-[10px] leading-relaxed space-y-0.5 scrollbar-hide">
        {displayedLines.map((line, i) => (
          <div key={i} className={lineColor(line.type)}>{line.text}</div>
        ))}
        {currentText && (
          <div className={lineColor(currentType)}>
            {currentText}
            <span className="animate-pulse" style={{ color }}>▊</span>
          </div>
        )}
        {displayedLines.length === 0 && !currentText && (
          <div className="text-muted-foreground/30 animate-pulse">{t("pmConsole.initializing", "Initializing {{model}}...", { model })}</div>
        )}
      </div>
    </div>
  );
}

export function PredictionAiConsoleButton({ model, color }: { model: string; color: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-bold transition-all active:scale-[0.98]"
        style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${color}25`, color }}
      >
        <Brain className="h-3.5 w-3.5" />
        {t("pmConsole.title", "Reasoning Console")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-md w-full p-0 overflow-hidden"
          style={{
            background: "linear-gradient(160deg, hsl(22,20%,4%), hsl(20,15%,3%))",
            border: `1px solid ${color}22`,
          }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4" style={{ color }} />
              <span className="text-sm font-bold">{model} {t("pmConsole.title", "Reasoning Console")}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <PredictionAiConsole model={model} color={color} isVisible={open} />
        </DialogContent>
      </Dialog>
    </>
  );
}
