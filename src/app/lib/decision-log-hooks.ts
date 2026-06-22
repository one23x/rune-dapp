/**
 * Decision-log hooks — a withengine-style "Decision log · live" view layered
 * on top of the EXISTING `ai_console_logs` realtime stream (see ai-bot-feed.ts).
 *
 * Nothing new is written to the database for v1: the cf-worker-ai-bot already
 * emits one row per bot tick. Here we only *re-shape* those rows into the
 * four decision kinds the strategy page renders:
 *
 *   watch  — passive observation, no action ("markets quiet", a forming setup)
 *   review — the agent reasoning toward / about a decision (carries conviction)
 *   trade  — an execution event (opened / filled / closed / adjusted exits)
 *   passed — looked and declined (skip / abstain / retry-next-tick)
 *
 * `useDecisionLog` = the full live stream (includes watch heartbeats).
 * `useActionsFeed` = only material rows (review/trade/passed), with repeated
 *   "passed — holding ..." rows on the same symbol collapsed into one entry
 *   carrying a repeat count + span label ("3× over 1h"), exactly like the
 *   reference UI, so the feed never floods.
 *
 * When the real per-vault `decision_log` table lands (v2), point these hooks
 * at it instead — the component contract (DecisionEntry) stays identical.
 */
import { useMemo } from "react";
import { useConsoleLogs, type ConsoleLog } from "./ai-bot-feed";

export type DecisionKind = "watch" | "review" | "trade" | "passed";

/**
 * The customer-facing ActionsLog buckets rows into three categories:
 *   risk  (风险)  — 止损 / 持仓币剧烈波动
 *   watch (关注)  — 准备下单的币,含被门控挡下的开仓(如「跳过开仓 · 恐慌挡多」)
 *   trade (成交)  — 真实开 / 平仓 fills
 * We keep the 4-kind `DecisionKind` union stable (decision-log.tsx /
 * performance-panel.tsx key Records by it) and layer the customer category +
 * a structured `action`/`reason` on top, so a skip-open row renders explicitly
 * rather than as a vague "setup".
 */
export type DecisionCategory = "risk" | "watch" | "trade";

/** What actually happened, parsed from the executor row (when discernible). */
export type DecisionAction = "skip-open" | "stop-loss" | "open" | "close" | null;

export interface DecisionEntry {
  id: number;
  ts: string;
  kind: DecisionKind;
  symbol: string | null;        // display symbol, e.g. "ETH-PERP"
  message: string;
  conviction: number | null;    // 0..1, present on review/trade when known
  /** Preferred customer bucket. When absent the consumer derives it from kind. */
  category?: DecisionCategory;
  /** Structured action for explicit rendering (skip-open shows reason). */
  action?: DecisionAction;
  /** Human reason on a skip / stop, e.g. "恐慌挡多" — used as the row detail. */
  reason?: string | null;
}

export interface ActionEntry extends DecisionEntry {
  repeat: number;               // how many raw rows collapsed into this one
  spanLabel: string | null;     // e.g. "3× over 1h" when repeat > 1
}

/** "BTCUSDT" -> "BTC-PERP"; passthrough for anything already perp-shaped. */
function toPerp(asset: string | null): string | null {
  if (!asset) return null;
  if (asset.endsWith("USDT")) return `${asset.slice(0, -4)}-PERP`;
  if (asset.endsWith("-PERP")) return asset;
  return asset;
}

const TRADE_RE = /\b(open(?:ed|ing)?|fill(?:ed)?|clos(?:e|ed|ing)|adjust(?:ed)?|stop|take-?profit|tp\/sl)\b/i;
const DIR_RE = /\b(long|short)\b/i;

// --- executor decision keywords (CN + EN) ---------------------------------
// A real "open was SKIPPED" row from the worker, e.g. "跳过开仓 ETH · 恐慌挡多"
// or "skip open · fear-blocked long". This must NOT read as a vague setup.
const SKIP_OPEN_RE = /(跳过开仓|挡多|挡空|不开仓|skip[\s-]*open|open[\s-]*skipped|blocked\s+(?:long|short|open)|gated\s+(?:long|short|open))/i;
// Stop-loss / forced close on a loss.
const STOP_LOSS_RE = /(止损|止盈|强平|爆仓|stop[\s-]*loss|stop[\s-]*out|liquidat)/i;
// A real open / close fill (execution event).
const OPEN_RE = /(已开仓|开多|开空|开仓成交|opened?\b|filled\s+(?:long|short))/i;
const CLOSE_RE = /(已平仓|平仓|平多|平空|closed?\b)/i;

/**
 * Extract a short human reason for a skip / stop. Prefers text after a
 * separator ("· — :"), else falls back to the matched keyword itself
 * (e.g. "恐慌挡多" / "fear-blocked long").
 */
function parseReason(msg: string): string | null {
  const sep = msg.match(/[·\-—:：]\s*([^·\-—\n]{2,60})\s*$/);
  if (sep && sep[1].trim()) return sep[1].trim();
  const fear = msg.match(/(恐慌挡多|恐慌挡空|挡多|挡空|fear[\s-]*blocked\s+(?:long|short))/i);
  if (fear) return fear[1].trim();
  return null;
}

/** conf 78 / (conf 78%) / conviction 0.78 -> 0..1 */
function parseConviction(msg: string): number | null {
  const pct = msg.match(/conf(?:idence)?\s*[:=]?\s*(\d{1,3})\s*%?/i);
  if (pct) return Math.max(0, Math.min(1, Number(pct[1]) / 100));
  const frac = msg.match(/conviction\s*[:=]?\s*(0?\.\d+|1(?:\.0+)?)/i);
  if (frac) return Math.max(0, Math.min(1, Number(frac[1])));
  return null;
}

/** Map one console-log row to a decision entry. */
export function classify(log: ConsoleLog): DecisionEntry {
  const symbol = toPerp(log.asset);
  const conviction = parseConviction(log.message);
  const msg = log.message ?? "";

  // 1. Executor decisions take priority over the generic level switch so a
  //    real "open SKIPPED (恐慌挡多)" never collapses into a vague setup.
  //    A skip-open is still a "passed" kind (looked & declined) but carries an
  //    explicit action+reason and is bucketed into the customer "watch" lane —
  //    it IS a coin we were preparing to trade but got gated.
  if (SKIP_OPEN_RE.test(msg)) {
    return {
      id: log.id, ts: log.ts, kind: "passed", symbol, message: msg, conviction,
      category: "watch", action: "skip-open", reason: parseReason(msg),
    };
  }
  // 2. Stop-loss / forced close on a loss → risk lane. Still a trade event.
  if (STOP_LOSS_RE.test(msg)) {
    return {
      id: log.id, ts: log.ts, kind: "trade", symbol, message: msg, conviction,
      category: "risk", action: "stop-loss", reason: parseReason(msg),
    };
  }
  // 3. Real open / close fills → trade lane.
  if (OPEN_RE.test(msg)) {
    return {
      id: log.id, ts: log.ts, kind: "trade", symbol, message: msg, conviction,
      category: "trade", action: "open",
    };
  }
  if (CLOSE_RE.test(msg)) {
    return {
      id: log.id, ts: log.ts, kind: "trade", symbol, message: msg, conviction,
      category: "trade", action: "close",
    };
  }

  // 4. Fallback: the original level-driven shaping (unchanged contract).
  let kind: DecisionKind;
  switch (log.level) {
    case "result":
      // A completed tick: execution if it reads like one, otherwise the
      // model's reasoned call (review). A bare neutral reads as a watch.
      if (TRADE_RE.test(msg)) kind = "trade";
      else if (DIR_RE.test(msg)) kind = "review";
      else kind = "watch";
      break;
    case "signal":
      kind = "review";
      break;
    case "warn":
    case "error":
      kind = "passed";
      break;
    case "info":
    default:
      kind = TRADE_RE.test(msg) ? "trade" : "watch";
      break;
  }

  return { id: log.id, ts: log.ts, kind, symbol, message: msg, conviction };
}

/**
 * Customer bucket for an entry. Prefers the structured `category` (set by
 * classify on executor rows); otherwise derives it from the decision kind:
 *   trade               → trade (成交)
 *   review (a forming   → watch (关注: a coin we're preparing to trade)
 *     setup) / passed
 *   watch               → watch
 * Risk is only assigned via the explicit `category` (stop-loss / sharp move),
 * so the client-rule setup feed never mislabels a benign setup as risk.
 */
export function customerCategory(e: DecisionEntry): DecisionCategory {
  if (e.category) return e.category;
  if (e.kind === "trade") return "trade";
  return "watch";
}

/** Full live stream, newest first — includes watch heartbeats. */
export function useDecisionLog(model?: string): { entries: DecisionEntry[]; loading: boolean } {
  const { logs, loading } = useConsoleLogs(model);
  const entries = useMemo(() => logs.map(classify), [logs]);
  return { entries, loading };
}

function spanLabel(repeat: number, firstTs: string, lastTs: string): string | null {
  if (repeat < 2) return null;
  const ms = Math.abs(+new Date(firstTs) - +new Date(lastTs));
  const mins = Math.round(ms / 60000);
  const span = mins >= 60 ? `${Math.round(mins / 60)}h` : `${Math.max(1, mins)}m`;
  return `${repeat}× over ${span}`;
}

/**
 * Material feed: drop watch heartbeats, then collapse runs of repeated
 * `passed` on the same symbol (e.g. "Holding INTC long probe ...") that are
 * adjacent in the stream into a single entry. `logs` is newest-first, so a
 * "run" is a maximal block of same-(symbol,passed) rows.
 */
export function useActionsFeed(model?: string): { actions: ActionEntry[]; loading: boolean } {
  const { entries, loading } = useDecisionLog(model);

  const actions = useMemo<ActionEntry[]>(() => {
    const material = entries.filter((e) => e.kind !== "watch");
    const out: ActionEntry[] = [];
    for (const e of material) {
      const prev = out[out.length - 1];
      const collapsible =
        e.kind === "passed" &&
        prev &&
        prev.kind === "passed" &&
        prev.symbol === e.symbol;
      if (collapsible) {
        prev.repeat += 1;
        // entries are newest-first; prev is newer, e is older -> e is the start.
        prev.spanLabel = spanLabel(prev.repeat, prev.ts, e.ts);
        continue;
      }
      out.push({ ...e, repeat: 1, spanLabel: null });
    }
    return out;
  }, [entries]);

  return { actions, loading };
}

/** HH:MM:SS for the live stream. */
export function clockLabel(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** "just now" / "12m ago" / "3h ago" / "2d ago" for the actions feed. */
export function relativeLabel(iso: string): string {
  const ms = Date.now() - +new Date(iso);
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
