/**
 * React-Query hooks over the One-Agents Engine client (`engine.ts`).
 *
 * Follows the app's existing @tanstack/react-query usage (see queryClient.ts:
 * staleTime Infinity, no auto-refetch, no retry). Hooks are `enabled`-gated on
 * the identifier so a missing wallet / userId simply stays idle instead of
 * firing a doomed request. Feature pages can override `staleTime` / `enabled`
 * per call site as they get built out.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  users,
  funding,
  trading,
  strategies,
  copySubscriptions,
  signals,
  hyperliquid,
  node,
  packs,
  type HlNetwork,
  type HlAccount,
  type NodeStatus,
  type PolymarketOrderInput,
} from "@app/lib/engine";
import { supabase } from "@app/lib/supabase-client";
import {
  fetchHlAccountFromSync,
  fetchHlLeadersFromSync,
  fetchHlSignalsFromSync,
  fetchPusdBalanceFromSync,
} from "@app/lib/engine-supabase-reads";

/**
 * Resolve the Engine user for a connected wallet — **auto-onboard on first sight**.
 *
 * 之前:findOrNull 对未开户钱包返回 null → userId/engineEoaAddress 都拿不到 →
 *   充值弹窗地址空白、跟单/持仓页空白("充值地址生成不出来")。
 * 现在:未开户(null)就自动开户(每个连接的钱包 = 一个交易子账户;onboard 在引擎侧
 *   是幂等 find-or-create),保证 userId + 托管 EOA + 充值地址**恒存在**,地址直接显示给客户。
 * onboard 响应是 { userId, engineEoaAddress, ... }(没有 id)→ 归一成带 `id` 的用户对象,
 * 让所有读 `data.id` 的调用方继续可用。
 */
export function useEngineUser(wallet: string | undefined) {
  return useQuery({
    queryKey: ["engine", "user", wallet?.toLowerCase()],
    queryFn: async () => {
      const existing = await users.findOrNull(wallet!);
      if (existing) return existing;
      try {
        const onboarded = (await users.onboard(wallet!)) as Record<string, unknown>;
        return { ...onboarded, id: onboarded.id ?? onboarded.userId };
      } catch (e: any) {
        // 引擎节点门控拒绝(非节点/未兑码)→ 不是错误,而是「未开户」:返回 null,
        // 让 PM/HL 的 !userId 分支配合 useNodeGate.blocked 显示授权码卡(NodeGateCard),
        // 而不是落入「加载失败 / 重试」分支。兑码成功后 useRedeemCode 失效本查询自动重试开户。
        const msg = String(e?.message ?? e);
        if (/node_required|not.?a.?node|403|forbidden/i.test(msg)) return null;
        throw e;
      }
    },
    enabled: !!wallet,
    retry: false,
  });
}

/**
 * Lookup-only variant — resolves the engine trading subaccount **without**
 * auto-onboarding. Used by gated surfaces (e.g. the prediction-market bet flow)
 * where placing an order must require an *explicitly opened* trading account
 * (node / auth-code gated). Returns `data:null` (not an error) for a wallet that
 * has never opened an account, so callers can distinguish "not onboarded yet"
 * from "still loading".
 */
export function useEngineUserLookup(wallet: string | undefined) {
  return useQuery({
    queryKey: ["engine", "user-lookup", wallet?.toLowerCase()],
    queryFn: async () => (await users.findOrNull(wallet!)) ?? null,
    enabled: !!wallet,
    retry: false,
  });
}

/**
 * Node-gating status for a wallet (GET /v1/node/status). Drives the 开户 gate:
 * a trading account can only be opened by a node holder.
 *
 * IMPORTANT — graceful fallback while the backend is still shipping: this hook
 * is `retry:false` and callers must only BLOCK onboarding on an *explicit*
 * `isNode:false`. When the request fails / 404s the query is in an error state
 * (`data` undefined) → the gate treats that as "allow" so we never brick
 * onboarding before node gating goes live.
 */
export function useNodeStatus(wallet: string | undefined) {
  return useQuery<NodeStatus>({
    queryKey: ["engine", "node-status", wallet?.toLowerCase()],
    queryFn: () => node.status(wallet!),
    enabled: !!wallet,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Redeem a node authorization code — **against Supabase** (the single source of
 * truth for auth codes), NOT the engine. Calls the `redeem_auth_code` RPC
 * (security-definer) which atomically claims the code by binding
 * `rune_auth_codes.assigned_to = wallet`. The dapp gate (`useSupabaseNode`)
 * opens the moment a code is assigned to the wallet, and `use-deposit-cap`
 * reads the code's pm/hl caps. A separate sync mirrors assigned codes into the
 * engine's `node_access` so the trading account aligns server-side.
 *
 * (The old engine `POST /v1/node/redeem-code` read RDS `trading.auth_codes`,
 * which never existed on prod and held none of the admin's Supabase codes.)
 */
export function useRedeemCode(wallet: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<{ ok: boolean; error?: string; node_id?: number; level?: number }> => {
      if (!wallet) throw new Error("not_connected");
      const { data, error } = await supabase.rpc("redeem_auth_code", {
        p_code: code.trim(),
        p_wallet: wallet,
      });
      if (error) return { ok: false, error: error.message };
      return (data ?? { ok: false, error: "no_response" }) as { ok: boolean; error?: string; node_id?: number };
    },
    onSuccess: (res) => {
      if (res?.ok) {
        // Re-resolve every gate input: Supabase node identity, deposit caps,
        // the Supabase node-gate(useSupabaseNodeGate 的 queryKey),engine
        // node-status,以及 engine user 本身(被 node_required 拒过的开户要重试)。
        qc.invalidateQueries({ queryKey: ["rune", "supabaseNode"] });
        qc.invalidateQueries({ queryKey: ["rune", "depositCap"] });
        qc.invalidateQueries({ queryKey: ["rune", "node-gate"] });
        qc.invalidateQueries({ queryKey: ["engine", "node-status"] });
        qc.invalidateQueries({ queryKey: ["engine", "user"] });
      }
    },
  });
}

/** Hot Polymarket markets — `{ data: [...] }`. Refreshes on a short interval. */
export function useHotMarkets() {
  return useQuery({
    queryKey: ["engine", "hot-markets"],
    queryFn: () => signals.hotMarkets(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/**
 * Project's CONSOLE-curated strategy packs (GET /v1/packs, project-scoped).
 * These replace the hardcoded HL presets when the client has configured packs;
 * an empty list / fetch error lets the caller fall back to the built-in presets.
 */
export function useConsolePacks() {
  return useQuery({
    queryKey: ["engine", "console-packs"],
    queryFn: () => packs.consolePacks(),
    staleTime: 60_000,
    retry: false,
  });
}

/** Top leaderboard traders by window. */
export function useLeaders(window: "1d" | "7d" | "30d" = "7d") {
  return useQuery({
    queryKey: ["engine", "leaders", window],
    queryFn: () => signals.leadersTop(window),
    staleTime: 60_000,
  });
}

/**
 * Latest leader-consensus signals feed (PM 市场共识流,非 HL)。
 * 该共识聚合在 Supabase 无对应同形状源(trading_signal_trades 是逐笔信号、
 * 字段形状不同),故保持读引擎,但把轮询 30s→120s 降消耗(共识卡非实时关键)。
 */
export function useLeaderSignals() {
  return useQuery({
    queryKey: ["engine", "leader-signals"],
    queryFn: () => signals.leaderSignalsLatest(),
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
}

/** A user's strategies. */
export function useStrategies(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "strategies", userId],
    queryFn: () => strategies.list(userId!),
    enabled: !!userId,
  });
}

/** A user's leader-wallet copy subscriptions. */
export function useCopySubs(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "copy-subs", userId],
    queryFn: () => copySubscriptions.list(userId!),
    enabled: !!userId,
  });
}

/** A user's local Polymarket order history. */
export function useOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "orders", userId],
    queryFn: () => trading.polymarket.orders(userId!),
    enabled: !!userId,
  });
}

/** A user's live open Polymarket orders. 轮询 15s→60s 降引擎消耗(无同步源)。 */
export function useOpenOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "open-orders", userId],
    queryFn: () => trading.polymarket.openOrders(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
  });
}

/**
 * A user's pUSD collateral balance — **同步表优先,引擎兜底**。
 * 先读 trading_pm_account_state(生产机 pm-positions-sync 每 ~2min 刷),拼出
 * 引擎 pusd-balance 同形状 { smartWallet, balanceUsd };该 user 无同步行时回退
 * 引擎实时 funding.pusdBalance(保证未覆盖账户不白屏)。refetchInterval 由
 * 30s 放宽到 120s(同步表本就 2min 刷,实时打引擎只是兜底场景)。
 */
export function usePusdBalance(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "pusd-balance", userId],
    queryFn: async () => {
      try {
        const synced = await fetchPusdBalanceFromSync(userId!);
        if (synced) return synced;
      } catch {
        // 同步表读失败(RLS/网络)→ 安静回退引擎,不阻断余额显示。
      }
      return funding.pusdBalance(userId!);
    },
    enabled: !!userId,
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
}

/**
 * Manage a user's REAL Polymarket positions — cancel an open CLOB order and
 * redeem resolved positions back to pUSD. Both call live engine routes
 * (engine.ts → trading.polymarket.cancelOrder / redeem, which hit
 * `trade/polymarket/users/:userId/...` on the One-Agents Engine). On success
 * we invalidate the open-orders + pUSD-balance queries so the dashboard
 * reflects the new state immediately. No-ops (idle) until a userId exists.
 */
export function usePolymarketOrderMutations(userId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["engine", "open-orders", userId] });
    qc.invalidateQueries({ queryKey: ["engine", "orders", userId] });
    qc.invalidateQueries({ queryKey: ["engine", "pusd-balance", userId] });
  };

  const cancel = useMutation({
    mutationFn: ({ orderId }: { orderId: string }) =>
      trading.polymarket.cancelOrder(userId!, orderId),
    onSuccess: invalidate,
  });

  const redeem = useMutation({
    mutationFn: (body?: unknown) => trading.polymarket.redeem(userId!, body),
    onSuccess: invalidate,
  });

  return {
    cancelOrder: (orderId: string) => cancel.mutateAsync({ orderId }),
    redeem: (body?: unknown) => redeem.mutateAsync(body),
    isCancelling: cancel.isPending,
    isRedeeming: redeem.isPending,
    cancellingId: cancel.isPending ? (cancel.variables as { orderId: string } | undefined)?.orderId : undefined,
  };
}

/** Manual close of an HL position — reduce-only IOC market-close via the live
 *  engine route (engine.ts → hyperliquid.close → POST trade/hyperliquid/.../close).
 *  Invalidates the HL account query so positions/balance refresh after closing. */
export function useHlClose(userId: string | undefined, network: HlNetwork) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (coin: string) => hyperliquid.close(userId!, { coin, network }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engine", "hl", "account", network] }),
  });
  return {
    close: (coin: string) => m.mutateAsync(coin),
    isClosing: m.isPending,
    closingCoin: m.isPending ? (m.variables as string | undefined) : undefined,
  };
}

/**
 * Place a REAL Polymarket CLOB order for a user.
 *
 * Hits the live engine route (engine.ts → trading.polymarket.placeOrder →
 * POST `trade/polymarket/users/:userId/orders`), which signs & submits to the
 * Polymarket CLOB using the user's engine-held EOA + CLOB API key. The body
 * needs the outcome `tokenId` (the ERC-1155 CLOB token for the chosen Yes/No
 * leg — sourced from the market's `clobTokenIds`), `side` (BUY to enter a
 * position), `price` (0–1 probability), and `size` (number of shares).
 *
 * On success we invalidate open-orders + pUSD-balance so the dashboard
 * reflects the new state immediately. Idle (never fires) until a userId exists.
 */
export function usePolymarketPlaceOrder(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: PolymarketOrderInput) => {
      if (!userId) throw new Error("not_connected");
      return trading.polymarket.placeOrder(userId, order);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engine", "open-orders", userId] });
      qc.invalidateQueries({ queryKey: ["engine", "orders", userId] });
      qc.invalidateQueries({ queryKey: ["engine", "pusd-balance", userId] });
    },
  });
}

// ─── Hyperliquid copy-trading (network-keyed) ────────────────────────────────

/**
 * Ranked HL leaders for a network — **同步表优先,引擎兜底**。
 * 先读 trading_hl_leaders(生产机 trading-sync 每 ~2min 刷);空表回退引擎
 * hyperliquid.leaders。组件无需改(返回 { network, leaders } 同形状)。
 */
export function useHlLeaders(network: HlNetwork) {
  return useQuery({
    queryKey: ["engine", "hl", "leaders", network],
    queryFn: async () => {
      try {
        const synced = await fetchHlLeadersFromSync(network);
        if (synced) return synced;
      } catch {
        /* 同步表读失败 → 回退引擎 */
      }
      return hyperliquid.leaders(network);
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
}

/**
 * Recent HL leader signals (open/close fills) — **同步表优先,引擎兜底**。
 * 先读 trading_hl_copy_signals(每 ~2min 刷,按 network + happened_at desc,
 * 可按 leader 过滤);空结果回退引擎 hyperliquid.signals。refetchInterval
 * 30s→120s(同步表 2min 刷)。返回 { network, signals } 同形状,组件无需改。
 */
export function useHlSignals(
  network: HlNetwork,
  opts?: { limit?: number; leader?: string },
) {
  return useQuery({
    queryKey: ["engine", "hl", "signals", network, opts?.limit ?? null, opts?.leader ?? null],
    queryFn: async () => {
      try {
        const synced = await fetchHlSignalsFromSync(network, opts);
        if (synced) return synced;
      } catch {
        /* 同步表读失败 → 回退引擎 */
      }
      return hyperliquid.signals(network, opts);
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
}

/**
 * A user/follower's HL account state + open positions — **同步表优先,引擎兜底**。
 * 先从 trading_hl_account_state(HL 现金,2min 刷)+ v_wallet_open_positions(持仓)
 * 拼出引擎 HlAccount 同形状对象;同步层无该 HL 账户(地址未覆盖)时回退引擎实时
 * hyperliquid.account,保证不白屏。refetchInterval 30s→120s(同步表 2min 刷)。
 * 注意:useHlAccountAdjusted(hl-display-overrides.ts)包装本 hook,叠加 admin 覆盖/
 * 手动持仓/手动成交 —— 本 hook 返回同形状对象后那层逻辑原样工作。
 */
/**
 * 末级兜底:直连 HL 公共 /info clearinghouseState(CORS 开,全球可达)验证账户是否到账。
 * 仅在引擎 /v1/hl/account + 同步层都拿不到时调用 —— 典型场景:刚充值、QN HyperCore 尚未
 * 索引(无交易活动)且引擎侧 /info 间歇 429 的新户。带重试绕 429;只回余额/funded 级字段
 * (无 fills/持仓明细,established 账户下轮 poll 会被引擎完整结果覆盖)。
 */
async function fetchHlAccountDirect(
  address: string,
  network: HlNetwork,
): Promise<HlAccount | null> {
  const base =
    network === "testnet"
      ? "https://api.hyperliquid-testnet.xyz"
      : "https://api.hyperliquid.xyz";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${base}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: address }),
      });
      if (res.ok) {
        const d = (await res.json()) as {
          marginSummary?: { accountValue?: string; totalMarginUsed?: string };
          withdrawable?: string;
          assetPositions?: unknown[];
        } | null;
        if (d?.marginSummary) {
          const accountValue = Number(d.marginSummary.accountValue ?? 0);
          const marginUsed = Number(d.marginSummary.totalMarginUsed ?? 0);
          return {
            network,
            address,
            funded: accountValue > 0 || (d.assetPositions?.length ?? 0) > 0,
            accountValue,
            withdrawable: Number(d.withdrawable ?? 0),
            margin: marginUsed,
            marginUsed,
            unrealizedPnl: 0,
            realizedPnl: 0,
            positions: [],
          };
        }
      }
    } catch {
      /* 网络/429 → 重试 */
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return null;
}

export function useHlAccount(address: string | undefined, network: HlNetwork) {
  return useQuery({
    queryKey: ["engine", "hl", "account", network, address?.toLowerCase()],
    queryFn: async () => {
      // 引擎 /v1/hl/account = 实时 clearinghouseState + userFills:完整(含 recentFills /
      // realizedPnl / todayPnl / 真实 entryPx),且**按地址**查 —— 不受多 project / 视图
      // (v_wallet_open_positions 按连接钱包)歧义影响。是 Trades / Performance / 持仓 的正源。
      // 同步表只作兜底(引擎瞬时失败):它**不含 fills、realizedPnl=0**,单用会让这些面板空。
      try {
        const live = await hyperliquid.account(address!, network);
        if (live) return live;
      } catch {
        /* 引擎瞬时失败 → 回退同步表(至少有余额/持仓) */
      }
      const synced = await fetchHlAccountFromSync(address!, network);
      if (synced) return synced;
      // 末级兜底:刚充值的新户(QN HyperCore 尚未索引 + 引擎 /info 间歇 429)→ 直连 HL
      // 公共 clearinghouseState 验证。只要 HL 验证到余额,即可判定 funded → 显示「开户成功」。
      const verified = await fetchHlAccountDirect(address!, network);
      if (verified) return verified;
      throw new Error("hl account unavailable");
    },
    enabled: !!address,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

/** A user's HL copy subscriptions (+ mirrored positions). */
export function useHlSubs(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "hl", "subs", userId],
    queryFn: () => hyperliquid.subscriptions(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** F17 — AI 跟单决策流(决策卡)。每个信号经 AI 判断+调参的审计。
 *  无 Supabase 同步源 → 仍读引擎,但轮询 30s→180s、staleTime 提到 180s
 *  降消耗(决策卡为审计展示,非实时关键)。 */
export function useHlCopyDecisions(userId: string | undefined) {
  return useQuery({
    queryKey: ["engine", "hl", "copy-decisions", userId],
    queryFn: () => hyperliquid.copyDecisions(userId!),
    enabled: !!userId,
    staleTime: 180_000,
    refetchInterval: 180_000,
  });
}

/**
 * 账户净值历史曲线 —— worker equity-snapshot job 落的多日真实净值序列
 * (GET /v1/users/:userId/hl/equity-curve?days=N)。有真实快照时 PerformancePanel 用它画
 * 多日真曲线,无快照(job 未开 / 账户新)→ points:[],面板回退现有当日逻辑。
 * 快照本就每 ~30min 一条 → 轮询 5min、staleTime 5min,降消耗。
 */
export function useHlEquityCurve(userId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ["engine", "hl", "equity-curve", userId, days],
    queryFn: () => hyperliquid.equityCurve(userId!, days),
    enabled: !!userId,
    staleTime: 300_000,
    refetchInterval: 300_000,
    retry: false,
  });
}

/**
 * Manage an existing HL copy subscription: pause / resume (PATCH) + cancel (DELETE).
 * Routes are live (hl-read.ts :588 / :616). Invalidates the subs query on success so the
 * ActiveSubs list reflects the new state immediately.
 */
export function useHlSubMutations(userId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["engine", "hl", "subs", userId] });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
      hyperliquid.subscriptionPatch(userId!, id, { status }),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: ({ id }: { id: string }) => hyperliquid.subscriptionDelete(userId!, id),
    onSuccess: invalidate,
  });

  return {
    pause: (id: string) => setStatus.mutateAsync({ id, status: "paused" }),
    resume: (id: string) => setStatus.mutateAsync({ id, status: "active" }),
    cancel: (id: string) => cancel.mutateAsync({ id }),
    isPending: setStatus.isPending || cancel.isPending,
  };
}

/**
 * One-click STOP ALL copy-trading for a user: pauses every active HL + PM subscription
 * (POST /v1/users/:userId/stop-all). Idempotent — already-paused/stopped subs are no-ops.
 * Existing positions keep getting AI-managed exits (mirror close / TP-SL); no new positions open.
 * Invalidates the HL subs query so the active-follows list reflects the paused state immediately.
 */
export function useStopAllCopy(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => hyperliquid.stopAll(userId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engine", "hl", "subs", userId] }),
  });
}

/**
 * 选择/切换策略市场(单选)。把该用户所有 HL 订阅约束到该板块币种宇宙(allowed_coins),
 * 执行器据此只交易该板块的币。成功后刷新订阅列表。
 */
export function useSetStrategyMarket(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (market: string) => hyperliquid.setStrategyMarket(userId!, market),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engine", "hl", "subs", userId] }),
  });
}
