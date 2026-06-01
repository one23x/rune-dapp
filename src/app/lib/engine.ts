/**
 * One-Agents Engine — typed fetch client.
 *
 * The Engine (https://api.one-agents.com) authenticates project-scoped routes
 * with a Bearer **project API key**. A SPA must NEVER hold that key, so every
 * call here goes through a key-injecting PROXY:
 *
 *   - DEV  → Vite `server.proxy` maps `/engine/*` → engine, injecting the
 *            Bearer header from `process.env.ONE_AGENTS_API_KEY` (node side,
 *            see vite.config.ts). Never enters the client bundle.
 *   - PROD → Supabase Edge Function `engine-proxy` (supabase/functions/
 *            engine-proxy/index.ts) reads the key from Deno.env and forwards.
 *
 * The base is chosen by `VITE_ENGINE_PROXY` (default `/engine` for dev; in
 * prod set to the Edge Function URL e.g.
 * `https://<ref>.functions.supabase.co/engine-proxy`).
 *
 * Conventions follow `src/app/lib/api.ts`: thin `fetch`, JSON content-type,
 * throw on non-2xx with the upstream `error` message.
 */

export const ENGINE_BASE: string =
  (import.meta.env.VITE_ENGINE_PROXY as string | undefined) ?? "/engine";

/** Engine paths are passed WITHOUT a leading slash, e.g. `engineFetch("users/onboard")`. */
async function engineFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const url = `${ENGINE_BASE.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Engine error ${res.status}`);
  }
  // Some endpoints (DELETE) may return an empty body.
  const text = await res.text();
  return (text ? JSON.parse(text) : (undefined as unknown)) as T;
}

const get = <T = any>(path: string) => engineFetch<T>(path, { method: "GET" });
const post = <T = any>(path: string, body?: unknown) =>
  engineFetch<T>(path, { method: "POST", body: body == null ? undefined : JSON.stringify(body) });
const patch = <T = any>(path: string, body?: unknown) =>
  engineFetch<T>(path, { method: "PATCH", body: body == null ? undefined : JSON.stringify(body) });
const del = <T = any>(path: string) => engineFetch<T>(path, { method: "DELETE" });

const qs = (params: Record<string, string | number | undefined | null>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

// ── Shared shapes (loose — feature pages refine as needed) ───────────────────

export interface EngineUser {
  id: string;
  smartWalletAddress?: string;
  status?: string;
  [k: string]: unknown;
}

/** Many list endpoints wrap rows as `{ data: [...] }`; some return a bare array. */
export interface DataEnvelope<T> {
  data: T[];
  [k: string]: unknown;
}

export interface PolymarketOrderInput {
  // Engine validates the full body; kept loose so feature pages pass through.
  marketId?: string;
  tokenId?: string;
  side?: "BUY" | "SELL";
  price?: number;
  size?: number;
  [k: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// users — Bearer
// ─────────────────────────────────────────────────────────────────────────────
export const users = {
  /** Look up a user by smart wallet. Engine returns 404 when not onboarded. */
  find: (wallet: string) =>
    get<EngineUser>(`users${qs({ smartWalletAddress: wallet })}`),
  /** Same as find() but null instead of throwing on 404 (convenience). */
  findOrNull: async (wallet: string): Promise<EngineUser | null> => {
    try {
      return await get<EngineUser>(`users${qs({ smartWalletAddress: wallet })}`);
    } catch (e) {
      if (String(e).includes("404") || /not.?found/i.test(String(e))) return null;
      throw e;
    }
  },
  byId: (userId: string) => get<EngineUser>(`users/${userId}`),
  /** Provision a per-user engine EOA signer. */
  onboard: (wallet: string) =>
    post<EngineUser>("users/onboard", { smartWalletAddress: wallet }),
  /** Verify the on-chain admin grant → status active. */
  confirm: (userId: string, body?: unknown) =>
    post<EngineUser>(`users/${userId}/confirm`, body ?? {}),
  /**
   * "Enable Polymarket" = mint/recover the CLOB API key (idempotent). There is
   * no dedicated enablePolymarket route; this is the canonical activation call.
   */
  enablePolymarket: (userId: string) =>
    post(`trade/polymarket/users/${userId}/api-key`, {}),
  polymarketKeyStatus: (userId: string) =>
    get(`trade/polymarket/users/${userId}/api-key`),
};

// ─────────────────────────────────────────────────────────────────────────────
// funding — Polymarket pUSD deposit / balance / withdraw — Bearer
// ─────────────────────────────────────────────────────────────────────────────
export const funding = {
  pusdBalance: (userId: string) =>
    get(`trade/polymarket/users/${userId}/pusd-balance`),
  /** Generate per-chain deposit addresses for a user. */
  depositAddresses: (userId: string, body?: unknown) =>
    post(`trade/polymarket/users/${userId}/deposit-addresses`, body ?? {}),
  supportedAssets: () => get("trade/polymarket/supported-assets"),
  depositStatus: (query: string) =>
    get(`trade/polymarket/deposit-status/${encodeURIComponent(query)}`),
  /** Relayer pUSD transfer withdraw. */
  withdraw: (userId: string, body: unknown) =>
    post(`trade/polymarket/users/${userId}/withdraw`, body),
  /** Per-user deposit-wallet on-chain pUSD withdraw. */
  walletWithdraw: (userId: string, body: unknown) =>
    post(`trade/polymarket/users/${userId}/wallet-withdraw`, body),
};

// ─────────────────────────────────────────────────────────────────────────────
// trading — Polymarket — Bearer
// ─────────────────────────────────────────────────────────────────────────────
export const trading = {
  polymarket: {
    placeOrder: (userId: string, order: PolymarketOrderInput) =>
      post(`trade/polymarket/users/${userId}/orders`, order),
    /** Local order history. */
    orders: (userId: string) =>
      get(`trade/polymarket/users/${userId}/orders`),
    /** Live open orders from the CLOB. */
    openOrders: (userId: string) =>
      get(`trade/polymarket/users/${userId}/open-orders`),
    cancelOrder: (userId: string, orderId: string) =>
      del(`trade/polymarket/users/${userId}/orders/${orderId}`),
    /** Redeem resolved positions → pUSD. */
    redeem: (userId: string, body?: unknown) =>
      post(`trade/polymarket/users/${userId}/redeem`, body ?? {}),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// hyperliquid — Bearer. Reads live on the project-key plane (routes/hl-read.ts):
//   GET /v1/hl/leaders, /v1/hl/signals, /v1/hl/account, /v1/hl/positions,
//   GET /v1/users/:userId/hl/subscriptions.
// `withdraw` is the only write exposed today; there is NO subscribe-CREATE
// route on the Bearer plane yet (see `subscribeCreate` below).
// ─────────────────────────────────────────────────────────────────────────────
export type HlNetwork = "mainnet" | "testnet";

export interface HlLeader {
  address: string;
  label: string | null;
  active: boolean;
  network: HlNetwork;
  score: number | null;
  medianHoldingS: number | null;
  isHft: boolean | null;
}
export interface HlSignal {
  id: string;
  leaderAddress: string;
  coin: string;
  side: "LONG" | "SHORT";
  isClose: boolean;
  px: number;
  sz: number;
  notionalUsd: number;
  leaderSzAfter: number | null;
  happenedAt: string;
}
export interface HlPosition {
  coin: string;
  size: number;
  side: "LONG" | "SHORT";
  entryPx: number | null;
  positionValue: number;
  upnl: number;
  leverage: number | null;
}
export interface HlAccount {
  network: HlNetwork;
  address: string;
  funded: boolean;
  accountValue: number;
  withdrawable: number;
  margin: number;
  unrealizedPnl: number;
  realizedPnl: number;
  positions: HlPosition[];
}

export const hyperliquid = {
  /** withdraw3 → Arbitrum address. */
  withdraw: (userId: string, body: unknown) =>
    post(`trade/hyperliquid/users/${userId}/withdraw`, body),

  /** Ranked HL leaders for a network (active, by score desc). */
  leaders: (network: HlNetwork) =>
    get<{ network: HlNetwork; leaders: HlLeader[] }>(`v1/hl/leaders${qs({ network })}`),

  /** Recent leader signals (open/close fills). */
  signals: (network: HlNetwork, opts?: { limit?: number; leader?: string }) =>
    get<{ network: HlNetwork; signals: HlSignal[] }>(
      `v1/hl/signals${qs({ network, limit: opts?.limit, leader: opts?.leader })}`,
    ),

  /** Follower/user HL account state + open positions (direct HL info API). */
  account: (address: string, network: HlNetwork) =>
    get<HlAccount>(`v1/hl/account${qs({ address, network })}`),

  /** Just the positions array (subset of account). */
  positions: (address: string, network: HlNetwork) =>
    get<{ network: HlNetwork; address: string; positions: HlPosition[] }>(
      `v1/hl/positions${qs({ address, network })}`,
    ),

  /** A user's HL copy subscriptions + mirrored positions. */
  subscriptions: (userId: string) =>
    get<{ userId: string; subscriptions: any[] }>(`v1/users/${userId}/hl/subscriptions`),

  /** One-click copy: CREATE an HL copy subscription (live: hl-read.ts POST :398). */
  subscribeCreate: (userId: string, body: unknown) =>
    post(`v1/users/${userId}/hl/subscriptions`, body),

  /** Pause / resume an active subscription (PATCH live: hl-read.ts :588). */
  subscriptionPatch: (userId: string, id: string, body: { status: "active" | "paused" }) =>
    patch<{ ok: boolean; id: string; status: string }>(`v1/users/${userId}/hl/subscriptions/${id}`, body),

  /** Cancel (stop following) a subscription (DELETE live: hl-read.ts :616). */
  subscriptionDelete: (userId: string, id: string) =>
    del<{ ok: boolean }>(`v1/users/${userId}/hl/subscriptions/${id}`),

  /** F17 — this user's AI copy-trade decision stream (drives the decision cards). */
  copyDecisions: (userId: string) =>
    get<{ userId: string; decisions: HlCopyDecision[] }>(`v1/users/${userId}/hl/copy-decisions`),
};

/** One AI copy-trade decision (从 ai_inferences,kind='copy-trade-decision')。 */
export interface HlCopyDecision {
  id: string;
  model: string;
  symbol: string | null;
  leader: string | null;
  side: string | null;
  leaderScore: number | null;
  sentiment: Array<{ scope: string; mood?: string; classification?: string; value: number; fresh_min_ago?: number }>;
  act: boolean | null;
  confidence: number | null;
  notionalMult: number | null;
  leverage: number | null;
  rationale: string | null;
  source: "ai" | "mirror" | "ai-fallback" | null;
  at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// strategies (Trigger-AST) — Bearer
// ─────────────────────────────────────────────────────────────────────────────
export const strategies = {
  list: (userId: string) => get(`v1/users/${userId}/strategies`),
  get: (userId: string, id: string) => get(`v1/users/${userId}/strategies/${id}`),
  create: (userId: string, ast: unknown) =>
    post(`v1/users/${userId}/strategies`, ast),
  update: (userId: string, id: string, patchBody: unknown) =>
    patch(`v1/users/${userId}/strategies/${id}`, patchBody),
  delete: (userId: string, id: string) =>
    del(`v1/users/${userId}/strategies/${id}`),
  runs: (userId: string, id: string) =>
    get(`v1/users/${userId}/strategies/${id}/runs`),
};

// ─────────────────────────────────────────────────────────────────────────────
// copy-subscriptions (leader-wallet copy-trading) — Bearer
// ─────────────────────────────────────────────────────────────────────────────
export const copySubscriptions = {
  list: (userId: string) => get(`v1/users/${userId}/copy-subscriptions`),
  /** Create / upsert a leader-wallet subscription. */
  create: (userId: string, body: unknown) =>
    post(`v1/users/${userId}/copy-subscriptions`, body),
  update: (userId: string, id: string, body: unknown) =>
    patch(`v1/users/${userId}/copy-subscriptions/${id}`, body),
  /** Stop a subscription (→ status=stopped). */
  delete: (userId: string, id: string) =>
    del(`v1/users/${userId}/copy-subscriptions/${id}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// signals + fusion + leaderboard — Bearer (read; signals:read scope)
// ─────────────────────────────────────────────────────────────────────────────
export const signals = {
  /** Top traders by window (1d / 7d / 30d). */
  leadersTop: (window: "1d" | "7d" | "30d" = "7d") =>
    get(`v1/leaders/top${qs({ window })}`),
  /** Latest batch of leader-consensus signals. */
  leaderSignalsLatest: () => get("v1/signals/leaders/latest"),
  leaderSignalsByMarket: (marketId: string) =>
    get(`v1/signals/leaders/by-market/${encodeURIComponent(marketId)}`),
  /** Weighted-vote fusion for a Polymarket market. */
  fusionByMarket: (marketId: string) =>
    get(`v1/signals/fusion/by-market/${encodeURIComponent(marketId)}`),
  /** Multi-strategy fusion for a crypto symbol. */
  fusionQuant: (symbol: string) =>
    get(`v1/signals/fusion/quant/${encodeURIComponent(symbol)}`),
  /** Cursor-paginated quant signals. */
  quant: (cursor?: string) => get(`v1/quant/signals${qs({ cursor })}`),
  quantStrategies: () => get("v1/quant/strategies"),
  quantPerformance: () => get("v1/quant/performance"),
  /**
   * Hot Polymarket markets. NEW engine endpoint added in parallel; returns
   * `{ data: [...] }`. Wired here ahead of the backend ship.
   */
  hotMarkets: () => get<DataEnvelope<any>>("v1/markets/polymarket/hot"),
};

// ─────────────────────────────────────────────────────────────────────────────
// recommendations / presets — Bearer
// ─────────────────────────────────────────────────────────────────────────────
export const recommendations = {
  presets: () => get("v1/recommendations/presets"),
  ranked: (preset: string) => get(`v1/recommendations${qs({ preset })}`),
  onboardPreset: (userId: string, body: unknown) =>
    post(`v1/users/${userId}/onboard-preset`, body),
};

// ── Low-level escape hatch for feature pages that need an un-wrapped path ─────
export const engine = {
  get,
  post,
  patch,
  delete: del,
  base: ENGINE_BASE,
};

export default {
  users,
  funding,
  trading,
  hyperliquid,
  strategies,
  copySubscriptions,
  signals,
  recommendations,
  engine,
};
