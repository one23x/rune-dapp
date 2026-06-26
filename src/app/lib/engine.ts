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

/**
 * 成交/平仓方向归一 —— 数据源里 `side` 有四种写法(record_type=close 用 long/short;
 * position_closed 用 buy/sell),大小写不一,HL wire 还可能是 B/A。各处 UI 自己写正则只覆盖
 * 一部分 → 把空头错判成多头(大盘下跌时盈利的空头平仓被显示成盈利 Long)。统一在此判定。
 * 持仓(开仓)方向请用 size 符号(size<0=空),不要用本函数。
 */
export function sideIsShort(side?: string | null): boolean {
  const s = (side ?? "").trim().toLowerCase();
  if (!s) return false;
  return s === "a" || s.includes("short") || s.includes("sell");
}
export function sideIsLong(side?: string | null): boolean {
  const s = (side ?? "").trim().toLowerCase();
  if (!s) return false;
  return s === "b" || s.includes("long") || s.includes("buy");
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
  /** 当日盈亏 — today's realized closedPnl since UTC day-start (optional; backend buildAccount). */
  todayPnl?: number;
  /** 当前占用保证金(totalMarginUsed)。展示"保证金占用",避免净值被仓位占用被误读为亏损。 */
  marginUsed?: number;
  /** 累计手续费(USD,该账户 HL fills 的 fee 之和;后端 buildAccount 聚合,可选)。 */
  fees?: number;
  positions: HlPosition[];
  /** 本账户真实成交历史(最近 50 条,该 follower 地址的 HL fills;开/平仓都含)。 */
  recentFills?: HlFillRow[];
}

/** 一条真实成交(来自 /v1/hl/account 的 recentFills)。 */
export interface HlFillRow {
  coin: string;
  dir: string;            // "Open Long" / "Close Short" 等
  side: string;           // "BUY" | "SELL"
  sz: number;
  px: number;
  closedPnl: number;
  isClose: boolean;
  time: number;           // ms epoch
  hash: string | null;
}

/** One HL copy subscription row (+ mirrored positions) from GET /v1/users/:id/hl/subscriptions. */
export interface HlSubscription {
  id: string;
  leaderAddress: string;
  followerAddress: string;
  network: HlNetwork;
  ratio: number;
  notionalCapUsd: number;
  dailyCapUsd: number;
  maxLeverage: number;
  takeProfitPct: number | null;
  stopLossPct: number | null;
  allowedCoins: string[];
  status: string;
  createdAt: string;
  /** per-customer 每日开仓笔数上限(null = 不限)。 */
  dailyTradeCap: number | null;
  /** 当日已开仓笔数(UTC 日切重置)。 */
  todayTradeCount: number;
  positions: Array<{ coin: string; sizeBase: number; avgEntryPx: number | null; updatedAt: string }>;
}

/**
 * Non-custodial **agent-mode** user-signed payload (P1 backend).
 * `typedData` is a viem/EIP-712 object the CONNECTED wallet signs in-browser via
 * `account.signTypedData(typedData)`; `action` + `nonce` are echoed back verbatim
 * to the matching POST relay (must be byte-identical to what was signed).
 */
export interface HlAgentSignPayload {
  typedData: Record<string, unknown>;
  action: Record<string, unknown>;
  nonce: number;
}

/** Body posted back to the approve-agent / approve-builder relay routes. */
export interface HlAgentApproveBody {
  signature: string;
  action: Record<string, unknown>;
  nonce: number;
  network?: HlNetwork;
}

// ─────────────────────────────────────────────────────────────────────────────
// agent — conversational strategy chat (Bearer). Scoped per user so the agent
// can build a personal memory/preference bank. Backend route `hl/agent/chat`
// is pending; the UI (AgentChat) degrades gracefully (offline bubble) until it ships.
// ─────────────────────────────────────────────────────────────────────────────
/** A transaction prepared by the thirdweb Nebula on-chain brain, to be signed by the user's wallet. */
export interface AgentChatAction {
  type: string;
  source?: string;
  data?: { chainId: number; to: string; value?: string; data?: string; function?: string | null };
}
export interface AgentChatReply {
  reply: string;
  /** Nebula-prepared transactions (on-chain branch). Empty/absent for the strategy brain. */
  actions?: AgentChatAction[];
  /** Nebula session id — persist client-side and echo back for multi-turn on-chain context. */
  sessionId?: string;
  /** true when answered by the on-chain brain (Nebula). */
  onchain?: boolean;
  prefsUpdated?: boolean;
}

export const agent = {
  chat: (body: {
    userId?: string;
    message: string;
    history?: Array<{ role: string; text: string }>;
    lang?: string;
    strategyId?: string;
    walletAddress?: string;
    sessionId?: string;
  }) => post<AgentChatReply>("v1/hl/agent/chat", body),
};

export const hyperliquid = {
  /** withdraw3 → Arbitrum address. */
  withdraw: (userId: string, body: unknown) =>
    post(`trade/hyperliquid/users/${userId}/withdraw`, body),

  // ── 非托管 agent 模式 (P1 routes) — provision + user-signed approvals ────────
  /** Provision a per-user engine **agent** key bound to the user's master wallet.
   *  → { ok, agentAddress }. Sets hlMode='agent' server-side. */
  agentProvision: (userId: string, body: { masterAddress: string }) =>
    post<{ ok: boolean; agentAddress: string }>(
      `trade/hyperliquid/users/${userId}/hl/agent/provision`,
      body,
    ),
  /** GET the approveAgent payload to sign with the connected (master) wallet. */
  agentApproveAgentPayload: (userId: string, network: HlNetwork) =>
    get<HlAgentSignPayload>(
      `trade/hyperliquid/users/${userId}/hl/agent/approve-agent-payload${qs({ network })}`,
    ),
  /** Relay the user-signed approveAgent signature → records approval. */
  agentApproveAgent: (userId: string, body: HlAgentApproveBody) =>
    post<{ ok: boolean; resp: unknown }>(
      `trade/hyperliquid/users/${userId}/hl/agent/approve-agent`,
      body,
    ),
  /** GET the approveBuilderFee payload (builder/maxFeeRate from server config). */
  agentApproveBuilderPayload: (userId: string, network: HlNetwork) =>
    get<HlAgentSignPayload>(
      `trade/hyperliquid/users/${userId}/hl/agent/approve-builder-payload${qs({ network })}`,
    ),
  /** Relay the user-signed approveBuilderFee signature → records approval. */
  agentApproveBuilder: (userId: string, body: HlAgentApproveBody) =>
    post<{ ok: boolean; resp: unknown }>(
      `trade/hyperliquid/users/${userId}/hl/agent/approve-builder`,
      body,
    ),

  /** Manual close — reduce-only IOC market-close of an open position (live:
   *  trade-hyperliquid.ts POST :115). Body: { coin, sizeBase?, network? }. */
  close: (userId: string, body: { coin: string; sizeBase?: number; network: HlNetwork }) =>
    post<{ ok: boolean; network: HlNetwork }>(`trade/hyperliquid/users/${userId}/close`, body),

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
    get<{ userId: string; subscriptions: HlSubscription[] }>(`v1/users/${userId}/hl/subscriptions`),

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

  /**
   * 账户净值历史曲线 —— worker equity-snapshot job 落的多日真实净值序列
   * (live: hl-read.ts GET /v1/users/:userId/hl/equity-curve?days=N)。无快照 → points:[]。
   */
  equityCurve: (userId: string, days = 30) =>
    get<{ userId: string; days: number; points: HlEquityPoint[] }>(
      `v1/users/${userId}/hl/equity-curve${qs({ days })}`,
    ),

  /**
   * One-click STOP ALL copy-trading: pause every active HL + PM subscription for this user
   * (live: hl-read.ts POST /v1/users/:userId/stop-all). Idempotent — only flips `active`→`paused`,
   * so existing positions still get AI-managed exits (mirror close / TP-SL); no NEW positions open.
   */
  stopAll: (userId: string) =>
    post<{ ok: boolean; paused: number; hl: number; pm: number }>(`v1/users/${userId}/stop-all`, {}),

  /**
   * 选择/切换策略市场(单选)。把该用户所有 HL 订阅的 allowed_coins 设成该板块的币种宇宙,
   * 执行器据此只交易该板块的币(live: hl-read.ts POST /v1/users/:userId/strategy-market)。
   */
  setStrategyMarket: (userId: string, market: string) =>
    post<{ ok: boolean; market: string; updated: number; coins: number }>(`v1/users/${userId}/strategy-market`, { market }),
};

/** 一点净值快照(GET /v1/users/:userId/hl/equity-curve)。 */
export interface HlEquityPoint {
  ts: string;
  accountValue: number | null;
  unrealizedPnl: number | null;
}

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
// node gating — Bearer. A trading account can only be opened by a NODE holder.
//   GET  /v1/node/status?wallet=0x..   → NodeStatus
//   POST /v1/node/redeem-code { wallet, code } → RedeemCodeResult
// The backend is still being built; callers FALL BACK to allowing onboarding
// when the status call fails / 404s (only an explicit isNode:false blocks).
// ─────────────────────────────────────────────────────────────────────────────

/** Per-level trading limits the engine enforces for a node (L1–L5). */
export interface NodeLimits {
  perTradeUsd: number;
  dailyUsd: number;
  maxTradesPerDay: number;
  maxLeverage: number;
}

export interface NodeStatus {
  isNode: boolean;
  /** 0 = not a node; 1–5 = node tier. */
  level: number;
  limits: NodeLimits | null;
}

export interface RedeemCodeResult {
  ok: boolean;
  level?: number;
  error?: string;
}

export const node = {
  /** Node gating status for a wallet (level + per-tier limits). */
  status: (wallet: string) => get<NodeStatus>(`v1/node/status${qs({ wallet })}`),
  /** Redeem an authorization code → grants / raises node level. */
  redeemCode: (wallet: string, code: string) =>
    post<RedeemCodeResult>("v1/node/redeem-code", { wallet, code }),
};

// ─────────────────────────────────────────────────────────────────────────────
// gas — 充值直转时连接钱包原生币不足付 gas → 引擎从服务端钱包发一小笔。
// 服务端校验:绑定授权码 + 每钱包每链限次 + 链上余额确实低于阈值;总开关默认关
// (关闭/未部署时报错,调用方降级为「联系客服」提示)。
// ─────────────────────────────────────────────────────────────────────────────
export const gas = {
  grant: (address: string, chain: "arbitrum" | "polygon") =>
    post<{ txHash: string; amountWei: string }>("v1/rune/gas-grant", { address, chain }),
};

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
// console packs — Bearer (project-scoped). The project CLIENT curates these in
// the rune-console; the dapp renders them as the followable strategy packs.
// GET /v1/packs → { projectId, packs: ConsolePack[] }.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A project-curated strategy pack from the CONSOLE. `leaderAddress` is the
 * specific HL leader this pack copies (null = the client hasn't bound a leader
 * yet → not followable). `params` holds the risk config the client set; key
 * naming is tolerant (ratioPct|notionalRatio, cap|notionalCapUsd,
 * daily|dailyCapUsd, coins|allowedCoins, maxLeverage) and pricing-stripped.
 */
export interface ConsolePack {
  slug: string;
  name: string;
  category: string;
  tier: "entry" | "advanced" | "pro" | null;
  /** The HL leader this pack copies (0x… or null when unbound). */
  leaderAddress: string | null;
  /** Minimum follower account value (USD) the client requires (or null). */
  minBalanceUsd: number | null;
  /** Optional perf summary the console may attach (shape is client-defined). */
  perf: unknown | null;
  /** Risk config (pricing-stripped). Tolerant of both naming styles. */
  params: Record<string, unknown>;
}

export const packs = {
  /** Project's console-curated strategy packs (project-scoped via proxy). */
  list: () => get<{ projectId: string; packs: ConsolePack[] }>("v1/packs"),
  /** Alias matching the engine route naming. */
  consolePacks: () => get<{ projectId: string; packs: ConsolePack[] }>("v1/packs"),
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
  node,
  strategies,
  copySubscriptions,
  signals,
  packs,
  recommendations,
  engine,
};
