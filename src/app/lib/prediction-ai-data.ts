/**
 * Deterministic generators for the prediction-market AI Lab.
 *
 * The Hyperliquid AI hub reads live ticks from Supabase (a Cloudflare
 * worker writes them). There is no equivalent worker for the Polymarket
 * side yet, so this module synthesizes the same *shape* of data — model
 * stats, simulated place/close orders, and reasoning-console ticks —
 * fully deterministically from a seed so every viewer sees a stable,
 * sensible feed and reloads don't shuffle the numbers.
 *
 * Everything here is prediction-market native: outcomes are YES/NO,
 * prices are in cents (0–100, the implied probability), and "orders"
 * are PLACE (open a position) / CLOSE (resolve or exit) events, each
 * carrying the model's own reasoning.
 */

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

export function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** mulberry32 — small, fast, deterministic PRNG returning [0,1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Markets ──────────────────────────────────────────────────────────────────

export interface PmMarket {
  q: string;
  cat: string;
}

/** A curated slate of Polymarket-style event questions across categories.
 *  Used purely as labels for the simulated feed. */
export const PM_MARKETS: PmMarket[] = [
  { q: "BTC above $120K by quarter end?", cat: "Crypto" },
  { q: "ETH spot ETF net inflows top $1B this week?", cat: "Crypto" },
  { q: "Fed cuts rates at the next meeting?", cat: "Macro" },
  { q: "US CPI prints below 3.0% this month?", cat: "Macro" },
  { q: "SOL flips $250 before August?", cat: "Crypto" },
  { q: "OpenAI ships a new flagship model this quarter?", cat: "Tech" },
  { q: "Nvidia tops $4T market cap this year?", cat: "Tech" },
  { q: "S&P 500 closes at a record high this week?", cat: "Macro" },
  { q: "A spot XRP ETF is approved this year?", cat: "Crypto" },
  { q: "Lakers reach the conference finals?", cat: "Sports" },
  { q: "A new AI lab raises a $1B+ round this quarter?", cat: "Tech" },
  { q: "Gold closes above $2,600 this month?", cat: "Macro" },
  { q: "BTC dominance falls below 50% this quarter?", cat: "Crypto" },
  { q: "Apple announces an AI search deal this year?", cat: "Tech" },
];

// ─── Reasoning fragments ────────────────────────────────────────────────────────

/** Pools of model-voice reasoning clauses. Combined deterministically into
 *  a one-line rationale that explains a PLACE / CLOSE decision. */
const PLACE_REASONS = [
  "order flow skewed toward {outcome}; implied odds lag the base rate",
  "fresh liquidity on the {outcome} side widened the edge past threshold",
  "news sentiment turned favorable while the market was slow to reprice",
  "model probability sits {edge}% above the {outcome} ask — clear mispricing",
  "momentum in resolution signals confirms the {outcome} thesis",
  "thin {outcome} book lets us size in before the crowd reprices",
  "cross-market correlation supports {outcome}; entry priced with margin",
];

const CLOSE_REASONS = [
  "target hit — odds converged to fair value, booking the edge",
  "resolution signals weakened; trimming risk before expiry",
  "spread collapsed into our estimate, edge no longer compensates risk",
  "sentiment reversed; exiting to protect realized gains",
  "market repriced toward our entry thesis — taking profit",
  "liquidity thinned ahead of resolution; closing the position",
];

function pick<T>(arr: T[], r: number): T {
  return arr[Math.floor(r * arr.length) % arr.length];
}

function fillReason(tpl: string, outcome: "YES" | "NO", edge: number): string {
  return tpl.replace("{outcome}", outcome).replace("{edge}", edge.toFixed(0));
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface PmOrder {
  id: string;
  model: string;
  market: string;
  category: string;
  outcome: "YES" | "NO";
  action: "PLACE" | "CLOSE";
  entryCents: number;
  exitCents: number | null;
  shares: number;
  status: "OPEN" | "CLOSED";
  pnlPct: number | null;
  rationale: string;
  openedAt: string;
  closedAt: string | null;
}

/** Deterministic list of simulated place/close orders for one model,
 *  newest first. Closed orders carry a realized pnl% and an exit price;
 *  open orders are still live. Each row carries its own reasoning. */
export function pmOrders(model: string, count = 12): PmOrder[] {
  const rand = rng(hash32(`orders:${model}`));
  const out: PmOrder[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const mkt = PM_MARKETS[Math.floor(rand() * PM_MARKETS.length)];
    const outcome: "YES" | "NO" = rand() > 0.5 ? "YES" : "NO";
    const entryCents = 8 + Math.floor(rand() * 80); // 8..88¢
    const shares = 25 + Math.floor(rand() * 475); // 25..500 shares
    const edge = 3 + Math.floor(rand() * 14); // 3..16%
    // ~60% of rows are resolved/closed, weighted toward wins.
    const closed = i >= 2 && rand() > 0.4;
    const win = rand() > 0.32;
    const openedAt = new Date(now - (i * 2 + 1) * 3_600_000 - Math.floor(rand() * 1_800_000));
    let exitCents: number | null = null;
    let pnlPct: number | null = null;
    let closedAt: string | null = null;
    if (closed) {
      // YES price rising = profit for a YES holder; mirror for NO.
      const move = (win ? 1 : -1) * (4 + Math.floor(rand() * 22));
      exitCents = Math.max(2, Math.min(98, entryCents + move));
      pnlPct = +(((exitCents - entryCents) / entryCents) * 100).toFixed(1);
      closedAt = new Date(openedAt.getTime() + (1 + Math.floor(rand() * 8)) * 3_600_000).toISOString();
    }
    const action: "PLACE" | "CLOSE" = closed ? "CLOSE" : "PLACE";
    const rationale = closed
      ? pick(CLOSE_REASONS, rand())
      : fillReason(pick(PLACE_REASONS, rand()), outcome, edge);
    out.push({
      id: `pm-${model}-${i}`,
      model,
      market: mkt.q,
      category: mkt.cat,
      outcome,
      action,
      entryCents,
      exitCents,
      shares,
      status: closed ? "CLOSED" : "OPEN",
      pnlPct,
      rationale,
      openedAt: openedAt.toISOString(),
      closedAt,
    });
  }
  return out;
}

// ─── Model stats ────────────────────────────────────────────────────────────────

export interface PmModelStats {
  hitRatePct: number; // accuracy on resolved markets
  resolved: number;
  open: number;
  avgConfidence: number;
  avgEdgePct: number;
}

/** Deterministic per-model headline stats. RUNE is positioned as the
 *  flagship with a slightly higher hit rate; others sit in a sensible band. */
export function pmStats(model: string): PmModelStats {
  const isRune = model.toLowerCase().includes("rune");
  const r = (hash32(`stats:${model}`) % 1000) / 1000;
  return {
    hitRatePct: isRune ? 71 + r * 8 : 58 + r * 12,
    resolved: 60 + Math.floor(r * 140),
    open: 3 + Math.floor(r * 9),
    avgConfidence: isRune ? 70 + r * 10 : 60 + r * 14,
    avgEdgePct: 4 + r * 7,
  };
}

// ─── Console ticks ──────────────────────────────────────────────────────────────

export interface PmTick {
  id: string;
  ts: string;
  model: string;
  market: string;
  category: string;
  outcome: "YES" | "NO";
  decision: "PLACE" | "CLOSE" | "HOLD";
  priceCents: number;
  confidence: number;
  edgePct: number;
  bid: number;
  ask: number;
  volK: number;
  traders: number;
  sentiment: number;
  baseRate: number;
  implied: number;
  pnlPct?: number;
  rationale: string;
}

/** Build one deterministic console tick from a seed. `tsMs` lets the
 *  caller place the tick in time (recent backlog vs. live now). */
export function pmTick(seed: number, model: string, tsMs: number): PmTick {
  const rand = rng(seed >>> 0);
  const mkt = PM_MARKETS[Math.floor(rand() * PM_MARKETS.length)];
  const outcome: "YES" | "NO" = rand() > 0.5 ? "YES" : "NO";
  const ask = 8 + Math.floor(rand() * 82); // 8..90¢
  const bid = Math.max(1, ask - (1 + Math.floor(rand() * 4)));
  const edgePct = 2 + Math.floor(rand() * 15);
  const implied = ask; // market-implied probability ≈ ask price
  const baseRate = Math.max(2, Math.min(97, implied + (outcome === "YES" ? edgePct : -edgePct)));
  const confidence = 58 + Math.floor(rand() * 38);
  const volK = 20 + Math.floor(rand() * 480);
  const traders = 40 + Math.floor(rand() * 960);
  const sentiment = 35 + Math.floor(rand() * 60);
  const roll = rand();
  const decision: PmTick["decision"] = roll > 0.62 ? "PLACE" : roll > 0.34 ? "CLOSE" : "HOLD";
  const win = rand() > 0.32;
  const pnlPct = decision === "CLOSE" ? +(((win ? 1 : -1) * (3 + rand() * 24))).toFixed(1) : undefined;
  const rationale =
    decision === "CLOSE"
      ? pick(CLOSE_REASONS, rand())
      : decision === "PLACE"
      ? fillReason(pick(PLACE_REASONS, rand()), outcome, edgePct)
      : "edge below threshold — staying flat until odds drift";
  return {
    id: `tick-${model}-${seed}`,
    ts: new Date(tsMs).toISOString(),
    model,
    market: mkt.q,
    category: mkt.cat,
    outcome,
    decision,
    priceCents: ask,
    confidence,
    edgePct,
    bid,
    ask,
    volK,
    traders,
    sentiment,
    baseRate,
    implied,
    pnlPct,
    rationale,
  };
}
