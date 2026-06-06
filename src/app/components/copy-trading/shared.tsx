/**
 * Smart Copy-Trading — shared building blocks.
 *
 * Everything the /copy-trading/* pages reuse: loose engine-shape normalizers,
 * the sub-tab nav, the account-opening (开户) flow, and the deposit / withdraw
 * dialogs. All data flows through the typed engine client (`@app/lib/engine`)
 * and the react-query hooks (`@app/lib/engine-hooks`) — no mocked arrays.
 */

import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@app/lib/utils";
import { copyText } from "@app/lib/copy";
import { useToast } from "@app/hooks/use-toast";
import { queryClient } from "@app/lib/queryClient";
import { funding, users, type NodeStatus } from "@app/lib/engine";
import { useNodeStatus, useRedeemCode } from "@app/lib/engine-hooks";
import { useDepositCap } from "@/hooks/rune/use-deposit-cap";
import { useSupabaseNode } from "@/hooks/rune/use-supabase-node";
import { useActiveAccount, PayEmbed } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb/client";
import { polygon } from "@/lib/thirdweb/chains";
import {
  LayoutDashboard, Zap, Activity, History as HistoryIcon,
  Wallet, Copy, CheckCircle2, Circle, Loader2, ArrowDownToLine, ArrowUpFromLine, AlertTriangle,
  ShieldCheck, KeyRound, ShoppingCart,
} from "lucide-react";

// Polymarket pUSD @ Polygon — 跨链/买币直充入金的目标代币(无 AA:连接钱包=交易钱包)。
const PUSD_POLYGON = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB" as `0x${string}`;

// ─── Loose-shape normalizers ─────────────────────────────────────────────────
// Engine list endpoints return either `{ data: [...] }` or a bare array; some
// scalar endpoints wrap the value. These coerce defensively so a page never
// crashes on an unexpected envelope.

export function asArray<T = any>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["data", "orders", "positions", "signals", "results", "items", "subscriptions"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

export function asNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  return 0;
}

/** Pull a pUSD balance out of any of the shapes the engine might return. */
export function pusdAmount(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" || typeof v === "string") return asNumber(v);
  const o = v as Record<string, unknown>;
  for (const k of ["balance", "pusd", "pusdBalance", "available", "amount", "value", "collateral"]) {
    if (o[k] != null) return asNumber(o[k]);
  }
  return 0;
}

export interface NormOrder {
  id: string;
  market: string;
  side: string;
  price: number;
  size: number;
  notional: number;
  status: string;
  pnl: number | null;
  createdAt: number;
}

export function normalizeOrder(raw: any, i: number): NormOrder {
  const price = asNumber(raw?.price ?? raw?.avgPrice ?? raw?.fillPrice);
  const size = asNumber(raw?.size ?? raw?.amount ?? raw?.shares ?? raw?.quantity);
  const notionalRaw = raw?.notional ?? raw?.value ?? raw?.cost;
  const notional = notionalRaw != null ? asNumber(notionalRaw) : price * size;
  const pnlRaw = raw?.pnl ?? raw?.realizedPnl ?? raw?.profit;
  const ts = raw?.createdAt ?? raw?.created_at ?? raw?.timestamp ?? raw?.ts;
  return {
    id: String(raw?.id ?? raw?.orderId ?? raw?.orderID ?? raw?.hash ?? `ord-${i}`),
    market: String(raw?.market ?? raw?.question ?? raw?.marketId ?? raw?.tokenId ?? raw?.title ?? "—"),
    side: String(raw?.side ?? raw?.outcome ?? raw?.direction ?? "").toUpperCase(),
    price,
    size,
    notional,
    status: String(raw?.status ?? raw?.state ?? "").toUpperCase(),
    pnl: pnlRaw != null ? asNumber(pnlRaw) : null,
    createdAt: ts ? new Date(ts).getTime() || 0 : 0,
  };
}

const CLOSED_STATES = new Set(["CLOSED", "FILLED", "MATCHED", "RESOLVED", "REDEEMED", "SETTLED", "COMPLETE"]);
export function isClosed(o: NormOrder) { return CLOSED_STATES.has(o.status); }

export function fmtUsd(n: number, digits = 2): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

// ─── Sub-tab nav (mirrors DashboardSubTabs, route-aware) ─────────────────────

const SUB_TABS = [
  { href: "/copy-trading",         labelKey: "copyTrading.tabOverview", fallback: "Overview",  icon: LayoutDashboard },
  { href: "/copy-trading/auto",    labelKey: "copyTrading.tabAutoCopy", fallback: "Strategy",  icon: Zap },
  { href: "/copy-trading/signals", labelKey: "copyTrading.tabSignals",  fallback: "Signals",   icon: Activity },
  { href: "/copy-trading/stats",   labelKey: "copyTrading.tabStats",    fallback: "交易数据",   icon: HistoryIcon },
] as const;

export function CopyTradingSubNav() {
  const [location] = useLocation();
  const { t } = useTranslation();
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide rounded-xl border border-border/55 bg-card/60 p-1 surface-3d">
      {SUB_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.href === "/copy-trading"
          ? location === "/copy-trading"
          : location === tab.href || location.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className="flex-1 basis-0 min-w-0">
            <button
              className={cn(
                "w-full inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 transition-colors whitespace-nowrap",
                isActive
                  ? "border-amber-500/40 bg-gradient-to-br from-amber-500/20 via-amber-600/15 to-amber-700/10 text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/80",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
              <span className="text-[11.5px] font-bold tracking-wide truncate hidden sm:inline">
                {t(tab.labelKey, tab.fallback)}
              </span>
            </button>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Generic state atoms ─────────────────────────────────────────────────────

export function SectionEmpty({ icon: Icon, title, desc }: { icon: typeof Wallet; title: string; desc?: string }) {
  return (
    <div className="py-14 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/25 mx-auto mb-3" />
      <p className="text-sm text-foreground/60">{title}</p>
      {desc && <p className="mt-1 text-[12px] text-muted-foreground/60 max-w-xs mx-auto">{desc}</p>}
    </div>
  );
}

export function SectionError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="py-14 text-center">
      <AlertTriangle className="h-9 w-9 text-amber-400/50 mx-auto mb-3" />
      <p className="text-sm text-foreground/60">{t("copyTrading.loadError")}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-[12px] text-primary underline underline-offset-2">
          {t("copyTrading.retry")}
        </button>
      )}
    </div>
  );
}

// ─── Node gating (开户前置:需节点权限) ───────────────────────────────────────
//
// A trading account can only be opened by a NODE holder. Before showing the
// normal 开户 action we check `useNodeStatus(wallet)`:
//   - explicit { isNode:false }  → render the gate (buy node / redeem code)
//   - { isNode:true }            → proceed (+ a small level/limits badge)
//   - status errored / 404       → FALL BACK to allow (backend not shipped yet)
//
// BUY_NODE_URL is a single constant so the buy-node destination is trivial to
// re-point (internal route today; swap for an external store URL later).
export const BUY_NODE_URL = "/nodes";

/**
 * Resolve the node-gating decision for a wallet. Two independent sources:
 *
 *   1. Engine `GET /v1/node/status` (`useNodeStatus`) — reads RDS `node_access`
 *      / redeemed `auth_codes` / on-chain `levelOf`. For real node BUYERS this
 *      returns `isNode:false`: their auth code lives in main-net Supabase
 *      `rune_auth_codes.assigned_to` but was never redeemed into the engine, the
 *      on-chain `NodePresell.levelOf` reverts, and `balanceOf` grants no tier.
 *   2. Supabase `useSupabaseNode` — the SOURCE OF TRUTH for node ownership:
 *      a row in `rune_auth_codes` assigned to this wallet (and/or a `chain_id:56`
 *      purchase in `rune_purchases`). This carries the granted level + caps.
 *
 * So a wallet is a node if EITHER source says so. `blocked` only when the engine
 * explicitly says not-a-node AND Supabase has no node record. Any error /
 * missing wallet / still-loading falls back to allow (optimistic — never wrongly
 * gate a paying buyer).
 */
export function useNodeGate(wallet: string | undefined) {
  const q = useNodeStatus(wallet);
  const sb = useSupabaseNode(wallet);
  const status: NodeStatus | undefined = q.data;

  // Supabase-derived node identity (assigned auth code / chain-56 purchase).
  const hasSupabaseNode = sb.isNode;

  // Block ONLY when the engine explicitly says not-a-node AND Supabase has no
  // node record. Stay optimistic while either source is still loading.
  const engineSaysNo = status?.isNode === false;
  const blocked = engineSaysNo && !sb.loading && !hasSupabaseNode;

  // isNode = engine OR Supabase. Optimistic (true) until the engine answers.
  const isNode = (status?.isNode ?? true) || hasSupabaseNode;
  // Prefer engine level; else the Supabase-granted level; else ≥1 if Supabase
  // knows this is a node (enough to pass the gate / render a badge).
  const level = status?.level || sb.level || (hasSupabaseNode ? 1 : 0);

  return {
    loading: q.isLoading,
    blocked,
    isNode,
    level,
    limits: status?.limits ?? null,
    status,
  };
}

/** Small badge showing the granted node level + its key limits (L1–L5). */
export function NodeBadge({ level, limits }: { level: number; limits: NodeStatus["limits"] }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2"
      style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.20)" }}
      data-testid="node-level-badge"
    >
      <span className="inline-flex items-center gap-1.5 shrink-0">
        <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-[12px] font-bold text-amber-200">{t("node.levelBadge", "节点 L{{level}}", { level })}</span>
      </span>
      {limits && (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-foreground/60 tabular-nums">
          <span>{t("node.limitPerTrade", "单笔")}: {fmtUsd(limits.perTradeUsd, 0)}</span>
          <span>{t("node.limitDaily", "每日")}: {fmtUsd(limits.dailyUsd, 0)}</span>
          <span>{t("node.limitTrades", "每日笔数")}: {limits.maxTradesPerDay}</span>
        </span>
      )}
    </div>
  );
}

/**
 * Node gate card — shown when the wallet is explicitly NOT a node. Offers two
 * paths: buy a node (link to BUY_NODE_URL) or redeem an authorization code. On
 * a successful redeem (ok:true) the node-status query is invalidated → the gate
 * re-resolves and `children` (the normal 开户 flow) renders.
 */
export function NodeGateCard({ wallet, grantedLevel }: { wallet: string; grantedLevel?: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const redeem = useRedeemCode(wallet);

  async function onVerify() {
    try {
      const res = await redeem.mutateAsync(code.trim());
      if (res?.ok) {
        toast({
          title: t("node.redeemSuccess", "授权码已验证"),
          description: res.level != null
            ? t("node.redeemSuccessLevel", "已开通节点 L{{level}}", { level: res.level })
            : t("node.redeemSuccessDesc", "节点权限已开通,可以开通交易账户了。"),
        });
        // node-status invalidated in the hook → gate re-resolves on its own.
      } else {
        toast({ title: t("common.error", "出错了"), description: res?.error || t("node.redeemInvalid", "授权码无效"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: t("common.error", "出错了"), description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  const isExternal = /^https?:\/\//i.test(BUY_NODE_URL);

  return (
    <div className="premium-card rounded-2xl p-5 space-y-4" data-testid="node-gate-card">
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11"
          style={{
            background: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(180,90,10,0.12))",
            border: "1px solid rgba(251,191,36,0.4)",
            boxShadow: "0 0 18px rgba(251,191,36,0.18)",
          }}
        >
          <KeyRound className="h-5 w-5 text-amber-300" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-foreground">{t("node.gateTitle", "开通交易账户需要节点权限")}</h2>
          <p className="mt-0.5 text-[12px] text-foreground/55 leading-snug">
            {t("node.gateDesc", "购买节点或输入授权码即可解锁开户与跟单。")}
          </p>
        </div>
      </div>

      {/* (a) 购买节点 */}
      {isExternal ? (
        <a
          href={BUY_NODE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="gold-button w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-extrabold"
          data-testid="button-buy-node"
        >
          <ShoppingCart className="h-4 w-4" />{t("node.buyNode", "购买节点")}
        </a>
      ) : (
        <Link href={BUY_NODE_URL} className="block">
          <button
            type="button"
            className="gold-button w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-extrabold"
            data-testid="button-buy-node"
          >
            <ShoppingCart className="h-4 w-4" />{t("node.buyNode", "购买节点")}
          </button>
        </Link>
      )}

      {/* divider */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-white/[0.08]" />
        <span className="text-[10px] uppercase tracking-wider text-foreground/35">{t("node.or", "或")}</span>
        <div className="h-px flex-1 bg-white/[0.08]" />
      </div>

      {/* (b) 输入授权码 */}
      <div className="space-y-2">
        <label className="text-[12px] text-muted-foreground">{t("node.codeLabel", "输入授权码")}</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("node.codePlaceholder", "授权码")}
            className="bg-background/50 border-border text-sm flex-1 font-mono"
            data-testid="input-node-code"
            onKeyDown={(e) => { if (e.key === "Enter" && code.trim() && !redeem.isPending) onVerify(); }}
          />
          <Button
            className="bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold shrink-0 sm:w-auto w-full"
            disabled={!code.trim() || redeem.isPending}
            onClick={onVerify}
            data-testid="button-verify-node-code"
          >
            {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("node.verify", "验证")}
          </Button>
        </div>
      </div>

      {typeof grantedLevel === "number" && grantedLevel > 0 && (
        <p className="text-[11px] text-emerald-300">{t("node.currentLevel", "当前节点等级:L{{level}}", { level: grantedLevel })}</p>
      )}
    </div>
  );
}

/**
 * Gate wrapper for the 开户 entry points. Resolves node status for `wallet`:
 *   - while loading           → skeleton card
 *   - explicit isNode:false   → <NodeGateCard/> (buy / redeem)
 *   - node holder / fallback  → renders `children` (the normal open-account flow)
 * `children` receives the resolved node status so it can render <NodeBadge/>.
 */
export function NodeGate({
  wallet,
  children,
}: {
  wallet: string;
  children: (node: { level: number; limits: NodeStatus["limits"]; isNode: boolean }) => React.ReactNode;
}) {
  const gate = useNodeGate(wallet);
  if (gate.loading) return <div className="premium-card rounded-2xl h-44" data-testid="node-gate-loading" />;
  if (gate.blocked) return <NodeGateCard wallet={wallet} grantedLevel={gate.level} />;
  return <>{children({ level: gate.level, limits: gate.limits, isNode: gate.isNode })}</>;
}

// ─── 开户 / Account-opening flow (3-step) ────────────────────────────────────

type StepState = "idle" | "running" | "done";

export function useOnboardFlow(wallet: string | undefined) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [steps, setSteps] = useState<[StepState, StepState, StepState]>(["idle", "idle", "idle"]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("No wallet");
      setSteps(["running", "idle", "idle"]);
      // Engine POST /users/onboard returns { userId, ... } (NOT { id }).
      const user = await users.onboard(wallet);
      const userId = String((user as { userId?: string; id?: string })?.userId ?? user?.id ?? "");
      if (!userId) throw new Error("onboard returned no userId");
      setSteps(["done", "running", "idle"]);
      await users.confirm(userId);
      setSteps(["done", "done", "running"]);
      await users.enablePolymarket(userId);
      setSteps(["done", "done", "done"]);
      return userId;
    },
    onSuccess: () => {
      toast({ title: t("copyTrading.onboardSuccess"), description: t("copyTrading.onboardSuccessDesc") });
      queryClient.invalidateQueries({ queryKey: ["engine", "user", wallet?.toLowerCase()] });
    },
    onError: (e: any) => {
      setSteps(["idle", "idle", "idle"]);
      toast({ title: t("common.error"), description: String(e?.message ?? e), variant: "destructive" });
    },
  });

  return { steps, run: () => mutation.mutate(), isPending: mutation.isPending };
}

export function OnboardCard({ wallet }: { wallet: string }) {
  // Node-gate the whole open-account action: not-a-node → buy/redeem gate;
  // node holder → the normal 开户 card (+ a level/limits badge).
  return (
    <NodeGate wallet={wallet}>
      {(node) => <OnboardCardInner wallet={wallet} node={node} />}
    </NodeGate>
  );
}

function OnboardCardInner({
  wallet, node,
}: { wallet: string; node: { level: number; limits: NodeStatus["limits"]; isNode: boolean } }) {
  const { t } = useTranslation();
  const { steps, run, isPending } = useOnboardFlow(wallet);
  const labels = [t("copyTrading.onboardStep1"), t("copyTrading.onboardStep2"), t("copyTrading.onboardStep3")];

  return (
    <div className="premium-card rounded-2xl p-5 space-y-4">
      {node.level > 0 && <NodeBadge level={node.level} limits={node.limits} />}
      <div>
        <h2 className="font-display text-base font-bold text-foreground">
          {t("copyTrading.onboardTitle")}
        </h2>
        <p className="mt-1 text-[12px] text-foreground/55 leading-relaxed">{t("copyTrading.onboardDesc")}</p>
      </div>
      <div className="space-y-2">
        {labels.map((label, i) => {
          const s = steps[i];
          return (
            <div key={i} className="flex items-center gap-2.5">
              {s === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                : s === "running" ? <Loader2 className="h-4 w-4 text-amber-300 animate-spin shrink-0" />
                : <Circle className="h-4 w-4 text-foreground/25 shrink-0" />}
              <span className={cn("text-[13px]", s === "idle" ? "text-foreground/40" : "text-foreground/80")}>{label}</span>
            </div>
          );
        })}
      </div>
      <Button
        className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold"
        onClick={run}
        disabled={isPending}
      >
        {isPending ? t("copyTrading.onboardOpening") : t("copyTrading.onboardCta")}
      </Button>
    </div>
  );
}

/**
 * Connect / onboard gate for sub-pages. Renders the connect prompt or the
 * 开户 card when appropriate; otherwise calls `children(userId)`.
 */
export function CopyGate({
  wallet, userLoading, userId, children,
}: {
  wallet: string | undefined;
  userLoading: boolean;
  userId: string | undefined;
  children: (userId: string) => React.ReactNode;
}) {
  const { t } = useTranslation();
  if (!wallet) {
    return (
      <div className="premium-card rounded-2xl p-7 text-center space-y-2">
        <Wallet className="h-9 w-9 text-amber-300/70 mx-auto" />
        <h2 className="text-sm font-bold text-foreground">{t("copyTrading.connectTitle")}</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed max-w-xs mx-auto">{t("copyTrading.connectDesc")}</p>
      </div>
    );
  }
  if (userLoading) return <div className="premium-card rounded-2xl h-44" />;
  if (!userId) return <OnboardCard wallet={wallet} />;
  return <>{children(userId)}</>;
}

// ─── Deposit dialog ───────────────────────────────────────────────────────────

export function DepositDialog({
  open, onOpenChange, userId, smartWalletAddress, wallet, deposited = 0,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  /** PM 直充必须打到后端读余额的地址 = user.smartWalletAddress(而非连接钱包)。
   *  缺失时回退连接钱包。 */
  smartWalletAddress?: string;
  /** 连接钱包地址 —— 用于读取 PM 充值限额(rune_auth_codes.pm_cap_usd)。 */
  wallet?: string;
  /** PM 累计已充值 proxy = 当前 pUSD 余额(剩余可充 = pm_cap_usd − deposited)。 */
  deposited?: number;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<{ chain: string; address: string }[]>([]);
  const [assets, setAssets] = useState<string[]>([]);
  // PM 充值限额:pm_cap_usd − 当前 pUSD 余额;无授权码 → cap 0 → 阻断。
  const cap = useDepositCap(wallet, "pm", deposited);

  const load = useMutation({
    mutationFn: async () => {
      if (!userId) return; // 账户还在自动开户中 → 等 userId 就绪(下方 effect 会再触发)
      const [addrRes, assetRes] = await Promise.allSettled([
        funding.depositAddresses(userId),
        funding.supportedAssets(),
      ]);
      if (addrRes.status === "fulfilled") {
        // 引擎返回 { address: { evm, svm, tron, btc }, note } —— 按链 key 展开。
        // 旧逻辑 asArray→String(r.address) 把 address 对象渲染成 "[object Object]" → 弹窗显示不出地址。
        // 兼容旧的数组形态 [{chain,address}]。
        const val: any = addrRes.value;
        const addrObj = val?.address ?? val;
        let rows: { chain: string; address: string }[] = [];
        if (addrObj && typeof addrObj === "object" && !Array.isArray(addrObj)) {
          // 只保留一个充值地址(EVM = Polygon USDC,最常用);多链地址会让用户困惑。
          const evm = (addrObj as Record<string, unknown>).evm;
          if (typeof evm === "string" && evm.length > 0) {
            rows = [{ chain: "USDC", address: evm }];
          } else {
            rows = Object.entries(addrObj)
              .filter(([, a]) => typeof a === "string" && (a as string).length > 0)
              .slice(0, 1)
              .map(([chain, a]) => ({ chain: chain.toUpperCase(), address: String(a) }));
          }
        } else {
          rows = asArray(addrObj)
            .map((r: any) => ({
              chain: String(r?.chain ?? r?.network ?? r?.chainId ?? ""),
              address: String(r?.address ?? r?.depositAddress ?? r ?? ""),
            }))
            .filter((r) => r.address);
        }
        setAddresses(rows);
      }
      if (assetRes.status === "fulfilled") {
        setAssets(asArray(assetRes.value).map((a: any) => String(a?.symbol ?? a?.asset ?? a)).filter(Boolean));
      }
      if (addrRes.status === "rejected" && assetRes.status === "rejected") {
        throw addrRes.reason;
      }
    },
    onError: (e: any) => toast({ title: t("common.error"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  // Lazy-load when the dialog opens. NOTE: 父组件用 setDepositOpen(true) **程序化**打开时,
  // Radix 的 onOpenChange(=handleOpenChange) **不会**触发(它只在用户交互 ESC/遮罩/trigger 时触发),
  // 所以必须用 useEffect 监听受控的 `open` —— 否则地址永远卡在 "generating"(这就是充值页拿不到地址的根因)。
  useEffect(() => {
    if (open && addresses.length === 0 && !load.isPending && userId) load.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  function handleOpenChange(v: boolean) {
    if (v && addresses.length === 0 && !load.isPending && userId) load.mutate();
    onOpenChange(v);
  }

  async function onCopy(addr: string) {
    const ok = await copyText(addr);
    toast(ok ? { title: t("common.copied") } : { title: t("common.error"), variant: "destructive" });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border w-[calc(100vw-1.5rem)] max-w-md p-4 rounded-2xl max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
              <ArrowDownToLine className="h-4 w-4 text-black" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] font-bold leading-tight">{t("copyTrading.depositTitle")}</DialogTitle>
              <DialogDescription className="text-[12px] leading-tight">{t("copyTrading.depositDesc")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {/* 主路径:用卡 / 跨链一键买入(冲动买单)。
              seller 必须 = user.smartWalletAddress —— 后端从该地址读 pUSD 余额/交易
              (trade-polymarket.ts: pusdBalance(getAddress(user.smartWalletAddress)))。
              一旦 smartWalletAddress 与连接钱包不同(PM 入金钱包建好后),打到连接钱包就
              「充值未到账」。smartWalletAddress 缺失才回退连接钱包(seller 不传)。
              买入成功后必须主动失效余额查询,否则入金到账但余额不刷新。 */}
          <DepositBuyPanel
            chain={polygon}
            token={PUSD_POLYGON}
            seller={smartWalletAddress}
            assetLabel="pUSD"
            cap={cap}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["engine", "pusd-balance", userId] });
              queryClient.invalidateQueries({ queryKey: ["engine", "open-orders", userId] });
              // 成功后自动关闭弹窗(留 1.5s 让 PayEmbed 成功态可见),余额已失效→重读。
              window.setTimeout(() => handleOpenChange(false), 1500);
            }}
          />

          {/* 次路径:转账到地址 */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground/70">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t("deposit.manualTransfer", "或转账到地址")}
            </div>
            <p className="text-[10px] leading-snug text-amber-300/80">
              {t("deposit.onchainWaitPm", "仅支持 Polygon 网络 USDC。链上确认约需 2–5 分钟到账,到账后余额会自动刷新,请耐心等待。")}
            </p>
            {load.isPending ? (
              <div className="py-5 text-center"><Loader2 className="h-5 w-5 text-amber-300 animate-spin mx-auto" /></div>
            ) : addresses.length > 0 ? (
              <div className="space-y-2">
                {addresses.map((a) => (
                  <div key={a.chain + a.address} className="rounded-xl p-2.5 bg-white/[0.03] border border-white/[0.06]">
                    {a.chain && <div className="text-[10px] uppercase tracking-wide text-amber-300/70 mb-1">{a.chain}</div>}
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] font-mono text-foreground/80 break-all flex-1 min-w-0">{a.address}</code>
                      <button onClick={() => onCopy(a.address)} aria-label={t("common.copy", "复制")} className="shrink-0 h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {assets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {assets.map((a) => (
                      <Badge key={a} variant="outline" className="text-[11px] no-default-hover-elevate no-default-active-elevate">{a}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground text-center py-3">{t("copyTrading.noDepositAddress")}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 直充买入面板(thirdweb PayEmbed)——「冲动买单」:预设金额 + 一键买入 ──────────
// 共享组件:Polymarket(polygon/pUSD,seller=连接钱包)与 Hyperliquid(arbitrum/USDC,
// seller=引擎托管 EOA)复用同一套视觉,仅 chain/token/seller 不同。资金只进指定 seller。
// 预设金额 chips 驱动冲动买单;PayEmbed 用 .tw-pay-embed-fit(400px pin + zoom 自适配手机)。
const BUY_PRESETS = [50, 100, 500, 1000];

// 跨链桥到账延迟容错的余额刷新轮询。
// PayEmbed 的 onPurchaseSuccess 在「下单成功」时触发,但跨链桥把资金真正搬到
// 目标地址往往要再等 30s–2min。单次失效查询(哪怕加一个 5s 延迟兜底)会在资金到账前
// 就读到旧余额然后停下,导致「充值成功但余额不刷新」。
//
// 这里在成功后立即刷新一次,然后每 POLL_INTERVAL_MS(6s)刷一次、持续 POLL_DURATION_MS
// (3 分钟,约 30 次),桥资金无论何时到账,下一次轮询都会失效余额查询 → react-query
// 重新拉取 → UI 更新。轮询用裸 window 定时器,刻意不挂在组件生命周期上:弹窗成功后
// ~1.5s 自动关闭、面板卸载,但轮询必须继续(它失效的是弹窗背后页面里仍 active 的余额查询)。
const POLL_INTERVAL_MS = 6_000;
const POLL_DURATION_MS = 3 * 60_000;

function startDepositRefreshPolling(onSuccess?: () => void) {
  if (!onSuccess) return;
  // 立即刷新一次。
  onSuccess();
  const intervalId = window.setInterval(() => {
    onSuccess();
  }, POLL_INTERVAL_MS);
  // ~3 分钟后停止轮询(无论面板是否已卸载)。
  window.setTimeout(() => window.clearInterval(intervalId), POLL_DURATION_MS);
}

export function DepositBuyPanel({
  chain, token, seller, assetLabel, onSuccess, cap,
}: {
  chain: any; // thirdweb Chain（polygon / arbitrum）
  token: `0x${string}`;
  seller?: string; // 不传 = 连接钱包（Polymarket 直充本钱包）
  assetLabel: string;
  /** 买入成功回调 —— 调用方在此刷新余额（PayEmbed 不会自动失效 react-query 缓存，
   *  否则「入金成功但余额不更新」直到 staleTime 过期 + 重新挂载才显示）。 */
  onSuccess?: () => void;
  /** 充值限额校验（来自 useDepositCap）。不传 = 不做限额校验(向后兼容)。
   *  传入时:金额必须 ≥ minPerTx 且 ≤ remaining;预设按钮过滤越界值;
   *  无授权码(!hasCode)或 remaining<minPerTx → 阻断充值并提示。 */
  cap?: { remaining: number; minPerTx: number; hasCode: boolean; loading: boolean };
}) {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);
  const amt = Number(amount);
  // 充值目标 = 后端读余额/执行的地址(PM=派生 Polymarket 钱包 / HL=托管 EOA),由调用方传入。
  // **绝不回退到连接钱包**:连接钱包不是后端读钱的地址,回退会导致"充值不到账"。
  // seller 未就绪 → 不渲染买入流程,显示"地址准备中"(见下方守卫),而不是打到错地址。
  const sellerAddr = seller;

  // ── 限额校验 ───────────────────────────────────────────────────────────────
  // cap 未传 → 不校验(min/max 视为放行)。传入时:
  //   - capLoading           → 读取中,先不阻断也不让进 PayEmbed(按钮禁用)
  //   - !hasCode             → 没绑授权码 → 硬阻断(需先购买节点 / 绑定授权码)
  //   - remaining < minPerTx → 额度不足 / 已达上限 → 硬阻断
  //   - 否则金额需在 [minPerTx, remaining] 内
  const capEnabled = !!cap;
  const minPerTx = cap?.minPerTx ?? 0;
  const remaining = cap?.remaining ?? Infinity;
  const capLoading = cap?.loading ?? false;
  const noCode = capEnabled && !capLoading && !cap!.hasCode;
  const capExhausted = capEnabled && !capLoading && cap!.hasCode && remaining < minPerTx;
  const capBlocked = noCode || capExhausted; // 完全无法充值
  const amountValid =
    amt > 0 &&
    (!capEnabled || (!capLoading && amt >= minPerTx && amt <= remaining));
  const canProceed = amountValid && !capBlocked && !(capEnabled && capLoading);

  if (!account) return null;
  // 充值地址(后端读钱的地址)还没就绪 → 禁充并提示,绝不回退到错地址。
  if (!sellerAddr) {
    return (
      <div className="rounded-2xl p-3.5 flex items-center gap-2 text-[12px] text-muted-foreground"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}
        data-testid="deposit-addr-preparing">
        <Loader2 className="h-4 w-4 animate-spin text-amber-300 shrink-0" />
        {t("deposit.addrPreparing", "正在准备充值地址,请稍候…")}
      </div>
    );
  }

  // 完全阻断态:无授权码 / 额度不足 → 只显示提示,不渲染金额输入与买入流程。
  if (capBlocked) {
    return (
      <div
        className="rounded-2xl p-3.5 space-y-2"
        style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.3)" }}
        data-testid="deposit-cap-blocked"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-300" />
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-red-200">
              {noCode
                ? t("deposit.capNoCodeTitle", "暂不可充值")
                : t("deposit.capReachedTitle", "已达充值上限")}
            </div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-red-100/80">
              {noCode
                ? t("deposit.capNoCodeDesc", "该钱包尚未绑定授权码,请先购买节点 / 绑定授权码后再充值。")
                : t("deposit.capReachedDesc", "已达到授权码允许的累计充值上限,无法继续充值。")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-3.5 space-y-3"
      style={{ background: "linear-gradient(155deg, rgba(251,191,36,0.10), rgba(245,158,11,0.02))", border: "1px solid rgba(251,191,36,0.20)" }}
    >
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 grid place-items-center shrink-0">
          <Zap className="h-3.5 w-3.5 text-black" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight">{t("deposit.buyTitle", "用卡 / 跨链一键买入")}</div>
          <div className="text-[11px] text-muted-foreground leading-tight truncate">{t("deposit.buyDesc", "几秒到账,立即开始跟单")}</div>
        </div>
      </div>

      {/* 限额提示:已充值额度内可充范围(单笔 ≥minPerTx,且 ≤remaining)。 */}
      {capEnabled && !capLoading && (
        <div className="text-[11px] text-foreground/55 leading-snug tabular-nums" data-testid="deposit-cap-hint">
          {t("deposit.capRange", "单笔 ≥ ${{min}},本次最多可充 ${{max}}", {
            min: minPerTx,
            max: Math.floor(remaining),
          })}
        </div>
      )}

      {!confirmed || !(amt > 0) ? (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {BUY_PRESETS.map((p) => {
              // 限额生效时过滤越界预设:<minPerTx 或 >remaining 的禁用。
              const presetDisabled = capEnabled && !capLoading && (p < minPerTx || p > remaining);
              return (
              <button
                key={p}
                type="button"
                disabled={presetDisabled}
                onClick={() => setAmount(String(p))}
                className={cn(
                  "h-11 rounded-xl text-[13px] font-bold tabular-nums transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
                  amt === p
                    ? "bg-gradient-to-br from-amber-400 to-yellow-600 text-black border border-amber-400"
                    : "bg-white/[0.04] text-foreground/80 border border-white/10 hover:border-amber-400/40",
                )}
              >
                ${p}
              </button>
              );
            })}
          </div>
          <div className="flex items-center rounded-xl bg-background/60 border border-white/10 px-3 h-11 focus-within:border-amber-400/50 transition-colors">
            <span className="text-[13px] text-muted-foreground mr-1">$</span>
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t("deposit.customAmount", "自定义金额")}
              className="border-0 bg-transparent px-0 h-auto text-[15px] font-bold focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span className="text-[11px] text-muted-foreground ml-1 shrink-0">{assetLabel}</span>
          </div>
          {/* 金额越界红字提示(限额生效且已输入金额时)。 */}
          {capEnabled && !capLoading && amt > 0 && !amountValid && (
            <p className="text-[11px] text-red-400 leading-snug" data-testid="deposit-cap-error">
              {amt < minPerTx
                ? t("deposit.capBelowMin", "单笔充值不能低于 ${{min}}", { min: minPerTx })
                : t("deposit.capAboveRemaining", "超出可充额度(最多 ${{max}})", { max: Math.floor(remaining) })}
            </p>
          )}
          <button
            type="button"
            className="gold-button w-full h-12 rounded-xl inline-flex items-center justify-center gap-1.5 text-[15px] font-extrabold disabled:opacity-40 disabled:saturate-50"
            disabled={!canProceed}
            onClick={() => setConfirmed(true)}
          >
            <Zap className="h-4 w-4" />
            {capEnabled && capLoading
              ? t("deposit.capChecking", "正在读取额度…")
              : amt > 0
                ? `${t("deposit.buyNow", "立即买入")} $${amt}`
                : t("deposit.enterAmount", "输入或选择金额")}
          </button>
        </>
      ) : (
        <div className="w-full">
          <button
            className="mb-2 inline-flex items-center gap-1 text-[12px] text-amber-300 hover:underline"
            onClick={() => setConfirmed(false)}
          >
            ← {t("common.back", "改数量")} · <span className="font-bold tabular-nums">${amt}</span>
          </button>
          {done && (
            <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-[12px] font-semibold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {t("deposit.received", "入金已到账,余额刷新中…")}
            </div>
          )}
          <div className="rounded-xl overflow-hidden overflow-x-auto bg-background/40 grid place-items-center">
            <PayEmbed
              client={thirdwebClient}
              className="tw-pay-embed-fit"
              payOptions={{
                mode: "direct_payment",
                paymentInfo: {
                  chain,
                  sellerAddress: sellerAddr as `0x${string}`,
                  token: { address: token },
                  amount: String(amt),
                },
                onPurchaseSuccess: () => {
                  setDone(true);
                  // 跨链桥资金常在 onPurchaseSuccess 后 30s–2min 才真正到账,单次(+5s)
                  // 刷新会读到旧余额后就停。改为轮询:立即刷新一次,然后每 6s 刷一次、共 ~3 分钟
                  // (30 次),桥资金一旦到账余额查询就会重读、UI 更新。
                  //
                  // 关键:弹窗成功后 ~1.5s 会自动关闭、本面板随之卸载,因此轮询不能挂在
                  // React effect / 组件生命周期上(否则卸载即停)。这里用裸 window.setInterval
                  // + window.setTimeout 兜底清理,卸载后继续跑也无妨——它只调用调用方传入的
                  // invalidateQueries,刷新的是弹窗背后页面里仍挂载(active)的余额查询。
                  startDepositRefreshPolling(onSuccess);
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Withdraw dialog (guarded, confirm-only) ─────────────────────────────────

export function WithdrawDialog({
  open, onOpenChange, userId, available,
}: { open: boolean; onOpenChange: (v: boolean) => void; userId: string; available: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [confirming, setConfirming] = useState(false);

  const amt = Number(amount);
  const amountValid = amount !== "" && Number.isFinite(amt) && amt > 0 && amt <= available;
  const destValid = /^0x[a-fA-F0-9]{40}$/.test(dest.trim());

  const withdraw = useMutation({
    mutationFn: async () => {
      // walletWithdraw — relayer on-chain pUSD withdraw to an external 0x address.
      // Backend expects { amountUsd, destination } (zod-validated); the old { amount, to } 400'd every time.
      return funding.walletWithdraw(userId, { amountUsd: amt, destination: dest.trim() });
    },
    onSuccess: () => {
      toast({ title: t("copyTrading.withdrawSuccess"), description: t("copyTrading.withdrawSuccessDesc") });
      queryClient.invalidateQueries({ queryKey: ["engine", "pusd-balance", userId] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: t("common.error"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  function reset() { setAmount(""); setDest(""); setConfirming(false); }

  function handleOpenChange(v: boolean) { if (!v) reset(); onOpenChange(v); }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              <ArrowUpFromLine className="h-4 w-4 text-black" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold">{t("copyTrading.withdrawTitle")}</DialogTitle>
              <DialogDescription className="text-[12px]">{t("copyTrading.withdrawDesc")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] text-muted-foreground">{t("copyTrading.withdrawAmountLabel")}</label>
              <span className="text-[11px] text-foreground/50">{t("copyTrading.withdrawAvailable")}: {fmtUsd(available)}</span>
            </div>
            <Input
              value={amount}
              onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setConfirming(false); }}
              placeholder="0.00"
              inputMode="decimal"
              className="bg-background/50 border-border text-sm"
            />
            {amount !== "" && !amountValid && (
              <p className="mt-1 text-[11px] text-red-400">{t("copyTrading.withdrawInvalidAmount")}</p>
            )}
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">{t("copyTrading.withdrawDestLabel")}</label>
            <Input
              value={dest}
              onChange={(e) => { setDest(e.target.value.trim()); setConfirming(false); }}
              placeholder="0x…"
              className="bg-background/50 border-border text-xs font-mono"
            />
            {dest !== "" && !destValid && (
              <p className="mt-1 text-[11px] text-red-400">{t("copyTrading.withdrawInvalidDest")}</p>
            )}
          </div>

          {confirming && amountValid && destValid && (
            <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)" }}>
              <div className="flex items-center gap-1.5 text-[12px] text-amber-300 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" /> {t("copyTrading.withdrawReviewTitle")}
              </div>
              <div className="flex justify-between text-[12px]"><span className="text-muted-foreground">{t("copyTrading.withdrawAmountLabel")}</span><span className="font-bold tabular-nums">{fmtUsd(amt)}</span></div>
              <div className="text-[11px] font-mono text-foreground/70 break-all">{dest}</div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          {!confirming ? (
            <Button
              size="sm"
              disabled={!amountValid || !destValid}
              onClick={() => setConfirming(true)}
              className="bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold"
            >
              {t("copyTrading.withdrawConfirm")}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!amountValid || !destValid || withdraw.isPending}
              onClick={() => withdraw.mutate()}
              className="bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold"
            >
              {withdraw.isPending ? t("copyTrading.withdrawSubmitting") : t("copyTrading.withdrawSubmit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
