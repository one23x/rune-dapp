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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@app/lib/utils";
import { copyText } from "@app/lib/copy";
import { useToast } from "@app/hooks/use-toast";
import { queryClient } from "@app/lib/queryClient";
import { funding, users, gas as engineGas, type NodeStatus } from "@app/lib/engine";
import { useNodeStatus, useRedeemCode } from "@app/lib/engine-hooks";
import { useDepositCap } from "@/hooks/rune/use-deposit-cap";
import { useSupabaseNodeGate } from "@app/lib/node-gate-supabase";
import { useActiveAccount, useActiveWalletChain, useSwitchActiveWalletChain, useReadContract, useSendTransaction, PayEmbed } from "thirdweb/react";
import { getContract, prepareContractCall, toUnits, toTokens } from "thirdweb";
import { getRpcClient, eth_getBalance } from "thirdweb/rpc";
import type { Chain } from "thirdweb";
import { thirdwebClient } from "@/lib/thirdweb/client";
import { polygon } from "@/lib/thirdweb/chains";
import QRCode from "qrcode";
import {
  LayoutDashboard, Zap, Activity, History as HistoryIcon,
  Wallet, Copy, CheckCircle2, Circle, Loader2, ArrowDownToLine, ArrowUpFromLine, AlertTriangle,
  ShieldCheck, KeyRound, ShoppingCart, QrCode, Send,
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
  // 引擎 /trade/polymarket/users/:id/pusd-balance 返回 { smartWallet, balanceRaw, balanceUsd }
  // —— 余额在 `balanceUsd`(人类可读 USD 值)。必须排在前面,否则之前漏读这字段 = 余额恒显 0。
  for (const k of ["balanceUsd", "balance", "pusd", "pusdBalance", "available", "amount", "value", "collateral"]) {
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
  /** 链上交易哈希(PM 撮合订单常缺失)→ 用于「查看链上记录」,缺失时降级到地址页。 */
  txHash: string | null;
}

export function normalizeOrder(raw: any, i: number): NormOrder {
  const price = asNumber(raw?.price ?? raw?.avgPrice ?? raw?.fillPrice);
  const size = asNumber(raw?.size ?? raw?.amount ?? raw?.shares ?? raw?.quantity);
  const notionalRaw = raw?.notional ?? raw?.value ?? raw?.cost;
  const notional = notionalRaw != null ? asNumber(notionalRaw) : price * size;
  const pnlRaw = raw?.pnl ?? raw?.realizedPnl ?? raw?.profit;
  const ts = raw?.createdAt ?? raw?.created_at ?? raw?.timestamp ?? raw?.ts;
  const txRaw = raw?.txHash ?? raw?.transactionHash ?? raw?.tx_hash ?? raw?.txid ?? raw?.hash;
  const txHash = typeof txRaw === "string" && /^0x[a-fA-F0-9]{6,}$/.test(txRaw) ? txRaw : null;
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
    txHash,
  };
}

const CLOSED_STATES = new Set(["CLOSED", "FILLED", "MATCHED", "RESOLVED", "REDEEMED", "SETTLED", "COMPLETE"]);
export function isClosed(o: NormOrder) { return CLOSED_STATES.has(o.status); }

export function fmtUsd(n: number, digits = 2): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** Signed percent — 盈绿带+ / 亏红带-，与 fmtUsd 的符号规范一致。 */
export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "0.0%";
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

/** PnL → color (emerald/red/neutral)。0 视为非亏(绿),严格亏损才红。 */
export function pnlColor(n: number | null | undefined): string {
  if (n == null) return "hsl(var(--foreground))";
  return n >= 0 ? "#10b981" : "#f87171";
}

// ─── Polygonscan helpers ─────────────────────────────────────────────────────
// PM 在 Polygon 上结算。订单常无 txHash(CLOB 撮合/聚合),所以「查看链上记录」
// 优先用 txHash 跳交易详情,缺失时降级到用户 deposit/交易钱包的地址页。
export function polygonscanTx(hash: string): string {
  return `https://polygonscan.com/tx/${hash}`;
}
export function polygonscanAddress(addr: string): string {
  return `https://polygonscan.com/address/${addr}`;
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

/** Where the resolved gate decision came from (diagnostics + UX). */
export type NodeGateSource = "purchase" | "authcode" | "supabase-none" | "backend" | "backend-fallback";

export interface NodeGateResult {
  loading: boolean;
  blocked: boolean;
  isNode: boolean;
  level: number;
  limits: NodeStatus["limits"];
  status: NodeStatus | undefined;
  // Phase-1 additions (per-market caps from Supabase). Optional / additive —
  // existing consumers (loading/blocked/isNode/level/limits/status) unchanged.
  hlCap: number | null;
  pmCap: number | null;
  hlMin: number | null;
  pmMin: number | null;
  source: NodeGateSource;
  canOpen: boolean;
}

/**
 * Resolve the node-gating decision for a wallet.
 *
 * Source of truth is chosen by `VITE_NODE_GATING_SOURCE` ("supabase" default |
 * "backend"). In "supabase" mode we read the RUNE node tables (rune_purchases /
 * trading_auth_codes via `useSupabaseNodeGate`) and fall back to the backend
 * `node.status` on any Supabase error / missing config. In "backend" mode we use
 * the original `useNodeStatus`-only logic verbatim (one-flip rollback valve).
 *
 * INVARIANT — `blocked` is true ONLY when we have a definite "no node + no code"
 * verdict: Supabase source="none", or (backend path) an explicit isNode:false.
 * Any loading / query error / missing wallet → blocked=false (fall back to
 * allow) so the gate never bricks open-account. Real enforcement is the
 * backend's job (onboard rejects non-node wallets regardless of this gate).
 */
export function useNodeGate(wallet: string | undefined): NodeGateResult {
  const mode =
    (import.meta.env.VITE_NODE_GATING_SOURCE as string | undefined) ?? "supabase";
  const useSupabase = mode === "supabase";

  const supa = useSupabaseNodeGate(wallet, useSupabase);
  const eng = useNodeStatus(wallet);

  // Backend-only path: original behaviour, zero change.
  const backendResult = (source: NodeGateSource): NodeGateResult => {
    const status = eng.data;
    return {
      loading: eng.isLoading,
      blocked: status ? status.isNode === false : false,
      isNode: status?.isNode ?? true, // optimistic until told otherwise
      level: status?.level ?? 0,
      limits: status?.limits ?? null,
      status,
      hlCap: null,
      pmCap: null,
      hlMin: null,
      pmMin: null,
      source,
      canOpen: status ? status.isNode !== false : true,
    };
  };

  if (!useSupabase) return backendResult("backend");

  // Supabase mode — wait for the Supabase query, fall back to backend on error.
  if (supa.isLoading) {
    return {
      loading: true,
      blocked: false,
      isNode: true,
      level: 0,
      limits: null,
      status: undefined,
      hlCap: null,
      pmCap: null,
      hlMin: null,
      pmMin: null,
      source: "supabase-none",
      canOpen: true,
    };
  }

  // Supabase errored (network / RLS / unconfigured) → fall back to backend.
  if (supa.isError || !supa.data) return backendResult("backend-fallback");

  const g = supa.data;
  // Supabase 命中节点/已兑换码 → 用它(放行 + 分市场额度)。
  if (g.isNode) {
    return {
      loading: false,
      blocked: false,
      isNode: true,
      level: g.level,
      limits: g.limits,
      status: { isNode: g.isNode, level: g.level, limits: g.limits },
      hlCap: g.hlCap,
      pmCap: g.pmCap,
      hlMin: g.hlMin,
      pmMin: g.pmMin,
      source: g.source === "purchase" ? "purchase" : "authcode",
      canOpen: true,
    };
  }
  // Supabase 判定"无节点无码"(source=none)。**不单凭这个就挡** —— 要求后端也判否
  // (both-sources-deny):仅当后端也明确 isNode:false 才 blocked;后端放行/加载中/无数据 → 乐观放行。
  // 修复 HIGH:防止授权码授权 / 后端手动授权 / 智能钱包≠EOA 地址 / 链ID不符 / authcode 表 RLS 未开
  // 这些 Supabase 看不到但后端认可的合法用户被误挡(deny-on-empty 回归)。backendResult 走后端裁决。
  return backendResult("backend-fallback");
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
          // 只保留一个充值地址(EVM = Polygon)。币种是 **pUSD**(0xC011a7…,Polymarket V2 抵押币;
          // USDC.e 已弃用)—— 标成笼统 "USDC" 会让用户充原生 USDC,Polymarket 不收 → 卡住拿不回。
          const evm = (addrObj as Record<string, unknown>).evm;
          if (typeof evm === "string" && evm.length > 0) {
            rows = [{ chain: "pUSD", address: evm }];
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

  function afterDeposit() {
    queryClient.invalidateQueries({ queryKey: ["engine", "pusd-balance", userId] });
    queryClient.invalidateQueries({ queryKey: ["engine", "open-orders", userId] });
  }

  async function onCopy(addr: string) {
    const ok = await copyText(addr);
    toast(ok ? { title: t("common.copied") } : { title: t("common.error"), variant: "destructive" });
  }

  // 三个 Tab 的收款地址来源 —— 红线:唯一合法地址 = seller prop(= 引擎
  // pusd-balance.smartWallet,用户专属入金钱包)。
  //   Tab1 钱包转账  → transfer(seller, amount)         ← smartWalletAddress
  //   Tab2 地址/扫码  → 展示/二维码 = seller             ← smartWalletAddress
  //   Tab3 跨链充值   → PayEmbed sellerAddress = seller  ← smartWalletAddress
  // seller 未就绪 → 各 Tab 内显示「地址准备中」守卫(DepositBuyPanel / 转账面板 / 扫码面板各自处理)。
  const seller = smartWalletAddress;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border w-[calc(100vw-1.5rem)] max-w-md p-4 rounded-2xl max-h-[85vh] overflow-y-auto">
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

        <Tabs defaultValue="transfer" className="mt-1">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="transfer" className="text-[11.5px] sm:text-[12px] px-1 py-1.5 gap-1">
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("deposit.tabTransfer", "钱包转账")}</span>
            </TabsTrigger>
            <TabsTrigger value="address" className="text-[11.5px] sm:text-[12px] px-1 py-1.5 gap-1">
              <QrCode className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("deposit.tabAddress", "地址/扫码")}</span>
            </TabsTrigger>
            <TabsTrigger value="bridge" className="text-[11.5px] sm:text-[12px] px-1 py-1.5 gap-1">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("deposit.tabBridge", "跨链充值")}</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1 — 钱包转账:连接钱包直接把 pUSD transfer 给 seller。 */}
          <TabsContent value="transfer" className="space-y-3">
            <DepositTransferPanel seller={seller} cap={cap} onSuccess={afterDeposit} onCopy={onCopy} />
          </TabsContent>

          {/* Tab 2 — 地址/扫码:展示 seller 地址 + 二维码(内容=纯地址)。 */}
          <TabsContent value="address" className="space-y-3">
            <DepositAddressPanel seller={seller} cap={cap} onCopy={onCopy} />
          </TabsContent>

          {/* Tab 3 — 跨链充值:现有 PayEmbed 流程原样搬入。
              seller 必须 = user.smartWalletAddress(后端从该地址读 pUSD 余额/交易),
              缺失则面板内显示「地址准备中」守卫,绝不回退到连接钱包。 */}
          <TabsContent value="bridge" className="space-y-3">
            <DepositBuyPanel
              chain={polygon}
              token={PUSD_POLYGON}
              seller={seller}
              assetLabel="pUSD"
              cap={cap}
              onSuccess={() => {
                afterDeposit();
                // 成功后自动关闭弹窗(留 1.5s 让 PayEmbed 成功态可见),余额已失效→重读。
                window.setTimeout(() => handleOpenChange(false), 1500);
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── gas 检查 + 领取 ─────────────────────────────────────────────────────────
// 直转前查连接钱包的原生币(POL / Arb ETH)够不够付转账费;不够 → 调引擎
// gas-grant(绑授权码+限次,服务端钱包代发)→ 轮询到账 → 继续转账。
// 引擎端点未部署/总开关关闭/超限 → 抛错,调用方 toast「联系客服」。
const GAS_MIN_WEI: Record<"arbitrum" | "polygon", bigint> = {
  arbitrum: 20_000_000_000_000n,      // 0.00002 ETH ≈ 一笔 ERC20 transfer 的几倍余量
  polygon: 10_000_000_000_000_000n,   // 0.01 POL
};
async function ensureNativeGas(
  chain: Chain,
  gasChain: "arbitrum" | "polygon",
  address: string,
  onGranting: () => void,
): Promise<void> {
  const rpc = getRpcClient({ client: thirdwebClient, chain });
  const min = GAS_MIN_WEI[gasChain];
  const bal = await eth_getBalance(rpc, { address: address as `0x${string}` });
  if (bal >= min) return;
  onGranting(); // 告知 UI:正在补 gas
  await engineGas.grant(address, gasChain);
  // 轮询到账(每 4s,最多 60s)。grant tx 已发出,链上确认通常几秒。
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const b = await eth_getBalance(rpc, { address: address as `0x${string}` });
    if (b >= min) return;
  }
  throw new Error("gas_grant_timeout");
}

// ─── Tab 1:钱包转账面板(连接钱包 → transfer 代币给 seller)────────────────────
// PM 默认:Polygon pUSD → 引擎 smartWallet;HL 复用:Arbitrum USDC → 托管 EOA /
// HL Bridge2(agent 模式)。流程:切链 → gas 检查/领取 → 拉起 transfer 授权签名。
// 读连接钱包代币余额、按 min/remaining 校验金额,成功后 invalidate 余额查询。
export function DepositTransferPanel({
  seller, cap, onSuccess, onCopy,
  chain = polygon,
  tokenAddress = PUSD_POLYGON,
  tokenLabel = "pUSD",
  chainLabel = "Polygon",
  gasChain = "polygon",
  minHard,
  hint,
}: {
  seller?: string;
  cap: { remaining: number; minPerTx: number; hasCode: boolean; loading: boolean; cap: number; deposited: number };
  onSuccess: () => void;
  onCopy: (addr: string) => void;
  /** 目标链(默认 Polygon)。 */
  chain?: Chain;
  /** 转账代币合约(默认 pUSD;HL 传 Arbitrum USDC)。6 位小数。 */
  tokenAddress?: `0x${string}`;
  tokenLabel?: string;
  chainLabel?: string;
  /** gas-grant 的链参数;传 null 关闭 gas 检查。 */
  gasChain?: "arbitrum" | "polygon" | null;
  /** 业务硬性最低单笔(如 HL Bridge 最低 5 USDC),与授权码 minPerTx 取较大者。 */
  minHard?: number;
  /** 底部说明文案(默认 PM 文案)。 */
  hint?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const account = useActiveAccount();
  // 转账前主动把钱包切到目标链,切完链立刻拉起 transfer 授权签名 ——
  // 不要求用户自己去钱包里换网络。
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const [switching, setSwitching] = useState(false);
  const [granting, setGranting] = useState(false);
  const [amount, setAmount] = useState("");
  const { mutate: sendTx, isPending } = useSendTransaction();

  // 连接钱包代币余额(6 位小数)。
  const token = getContract({ client: thirdwebClient, chain, address: tokenAddress });
  const balQ = useReadContract({
    contract: token,
    method: "function balanceOf(address) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
    queryOptions: { enabled: !!account?.address },
  });
  const walletBal = balQ.data != null ? Number(toTokens(balQ.data, 6)) : 0;

  // 限额(与 DepositBuyPanel 同口径;再叠加业务硬下限,如 HL Bridge 最低 5 USDC)。
  const minPerTx = Math.max(cap.minPerTx, minHard ?? 0);
  const remaining = cap.remaining;
  const noCode = !cap.loading && !cap.hasCode;
  const capExhausted = !cap.loading && cap.hasCode && remaining < minPerTx;
  const capBlocked = noCode || capExhausted;

  const amt = Number(amount);
  const amountValid = amt > 0 && !cap.loading && amt >= minPerTx && amt <= remaining;
  // 「全部」= min(钱包余额, 剩余额度),向下取整到 2 位小数避免余额不足。
  const maxFill = Math.min(walletBal, remaining);

  function onMax() {
    const v = Math.floor(maxFill * 100) / 100;
    setAmount(v > 0 ? String(v) : "");
  }

  if (!account) {
    return (
      <div className="rounded-2xl p-3.5 text-[12px] text-muted-foreground text-center"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {t("deposit.connectFirst", "请先连接钱包")}
      </div>
    );
  }
  if (!seller) {
    return (
      <div className="rounded-2xl p-3.5 flex items-center gap-2 text-[12px] text-muted-foreground"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}
        data-testid="deposit-addr-preparing">
        <Loader2 className="h-4 w-4 animate-spin text-amber-300 shrink-0" />
        {t("deposit.addrPreparing", "正在准备充值地址,请稍候…")}
      </div>
    );
  }
  if (capBlocked) {
    return (
      <div className="rounded-2xl p-3.5 space-y-2"
        style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.3)" }}
        data-testid="deposit-cap-blocked">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-300" />
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-red-200">
              {noCode ? t("deposit.capNoCodeTitle", "暂不可充值") : t("deposit.capReachedTitle", "已达充值上限")}
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

  async function onSubmit() {
    if (!seller || !amountValid || !account) return;
    // ① 钱包不在目标链 → 主动切链(用户在钱包里确认),失败就停,不发交易。
    if (activeChain?.id !== chain.id) {
      setSwitching(true);
      try {
        await switchChain(chain);
      } catch (e: any) {
        toast({
          title: t("deposit.switchChainFailed", "请切换到 {{chain}} 网络", { chain: chainLabel }),
          description: String(e?.shortMessage ?? e?.message ?? e),
          variant: "destructive",
        });
        return;
      } finally {
        setSwitching(false);
      }
    }
    // ② gas 检查:原生币不够付转账费 → 引擎代发一笔 gas,等到账再继续。
    if (gasChain) {
      try {
        await ensureNativeGas(chain, gasChain, account.address, () => {
          setGranting(true);
          toast({ title: t("deposit.gasGranting", "检测到 gas 不足,正在为您补充…"), description: t("deposit.gasGrantingDesc", "无需操作,到账后将自动继续转账(约 10–30 秒)。") });
        });
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        toast({
          title: t("deposit.gasGrantFailed", "gas 不足,自动补充失败"),
          description: /not_eligible/.test(msg)
            ? t("deposit.gasNotEligible", "该钱包未绑定授权码,无法自动领取 gas。")
            : /limit_reached/.test(msg)
              ? t("deposit.gasLimitReached", "gas 领取次数已用完,请联系客服。")
              : t("deposit.gasGrantFailedDesc", "请向该钱包充值少量 {{native}} 作为手续费,或联系客服。", { native: gasChain === "polygon" ? "POL" : "Arbitrum ETH" }),
          variant: "destructive",
        });
        setGranting(false);
        return;
      }
      setGranting(false);
    }
    // ③ 链与 gas 就绪 → 立刻拉起 transfer 授权签名。
    const tx = prepareContractCall({
      contract: token,
      method: "function transfer(address,uint256)",
      params: [seller as `0x${string}`, toUnits(String(amt), 6)],
    });
    sendTx(tx, {
      onSuccess: () => {
        toast({ title: t("deposit.transferSent", "转账已提交"), description: t("deposit.transferSentDesc", "链上确认后余额将自动刷新") });
        setAmount("");
        // 立即 + 轮询刷新,容忍链上确认延迟(复用跨链充值同款轮询)。
        startDepositRefreshPolling(onSuccess);
      },
      onError: (e: any) => toast({ title: t("common.error"), description: String(e?.shortMessage ?? e?.message ?? e), variant: "destructive" }),
    });
  }

  return (
    <div className="rounded-2xl p-3.5 space-y-3"
      style={{ background: "linear-gradient(155deg, rgba(251,191,36,0.10), rgba(245,158,11,0.02))", border: "1px solid rgba(251,191,36,0.20)" }}>
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 grid place-items-center shrink-0">
          <Send className="h-3.5 w-3.5 text-black" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight">{t("deposit.transferTitle", "钱包转账")}</div>
          <div className="text-[11px] text-muted-foreground leading-tight truncate">{t("deposit.transferDescToken", "从已连接钱包直接转入 {{token}}", { token: tokenLabel })}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{t("deposit.walletBalance", "钱包余额")}</span>
        <span className="font-semibold tabular-nums text-foreground/80">
          {balQ.isLoading ? "…" : `$${walletBal.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${tokenLabel}`}
        </span>
      </div>

      {!cap.loading && (
        <div className="text-[11px] text-foreground/55 leading-snug tabular-nums" data-testid="deposit-cap-hint">
          {t("deposit.capRange", "单笔 ≥ ${{min}},本次最多可充 ${{max}}", { min: minPerTx, max: Math.floor(remaining) })}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {BUY_PRESETS.map((p) => {
          const presetDisabled = !cap.loading && (p < minPerTx || p > remaining);
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
        <span className="text-[11px] text-muted-foreground ml-1 shrink-0">{tokenLabel}</span>
        <button
          type="button"
          onClick={onMax}
          disabled={maxFill < minPerTx}
          className="ml-2 shrink-0 text-[11px] font-bold text-amber-300 hover:underline disabled:opacity-30 disabled:no-underline"
        >
          {t("deposit.max", "全部")}
        </button>
      </div>

      {!cap.loading && amt > 0 && !amountValid && (
        <p className="text-[11px] text-red-400 leading-snug" data-testid="deposit-cap-error">
          {amt < minPerTx
            ? t("deposit.capBelowMin", "单笔充值不能低于 ${{min}}", { min: minPerTx })
            : t("deposit.capAboveRemaining", "超出可充额度(最多 ${{max}})", { max: Math.floor(remaining) })}
        </p>
      )}
      {!cap.loading && amt > 0 && amountValid && amt > walletBal && (
        <p className="text-[11px] text-red-400 leading-snug">
          {t("deposit.insufficientWalletToken", "钱包 {{token}} 余额不足", { token: tokenLabel })}
        </p>
      )}

      <button
        type="button"
        className="gold-button w-full h-12 rounded-xl inline-flex items-center justify-center gap-1.5 text-[15px] font-extrabold disabled:opacity-40 disabled:saturate-50"
        disabled={!amountValid || amt > walletBal || isPending || switching || granting || cap.loading}
        onClick={onSubmit}
      >
        {isPending || switching || granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {switching
          ? t("deposit.switchingChainTo", "切换到 {{chain}}…", { chain: chainLabel })
          : granting
            ? t("deposit.gasGrantingShort", "补充 gas 中…")
            : isPending
              ? t("deposit.transferring", "转账中…")
              : amt > 0
                ? `${t("deposit.transferNow", "立即转账")} $${amt}`
                : t("deposit.enterAmount", "输入或选择金额")}
      </button>

      <p className="text-[10px] leading-snug text-amber-300/80">
        {hint ?? t("deposit.transferHint", "仅支持 Polygon 网络的 pUSD,资金将直接转入您的交易账户。")}
      </p>
    </div>
  );
}

// ─── Tab 2:地址/扫码面板(展示 seller 地址 + 二维码,内容=纯地址)──────────────
// PM 默认(Polygon pUSD);HL 托管模式复用(Arbitrum USDC → 托管 EOA)。
// 注意:HL **agent 模式不要用这个面板**(HL 把发送地址记为账户,第三方扫码打款
// 会把钱记到对方的 HL 账户),agent 模式用引导面板。
export function DepositAddressPanel({
  seller, cap, onCopy, warnText,
}: {
  seller?: string;
  cap: { remaining: number; minPerTx: number; hasCode: boolean; loading: boolean };
  onCopy: (addr: string) => void;
  /** 红色警示文案(默认 PM:仅 Polygon pUSD)。 */
  warnText?: string;
}) {
  const { t } = useTranslation();
  const [qr, setQr] = useState<string>("");

  // 二维码内容 = 纯地址字符串(钱包扫码识别为收款地址)。seller 变化时重生成。
  useEffect(() => {
    let alive = true;
    if (!seller) { setQr(""); return; }
    QRCode.toDataURL(seller, { width: 220, margin: 1 })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(""); });
    return () => { alive = false; };
  }, [seller]);

  if (!seller) {
    return (
      <div className="rounded-2xl p-3.5 flex items-center gap-2 text-[12px] text-muted-foreground"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}
        data-testid="deposit-addr-preparing">
        <Loader2 className="h-4 w-4 animate-spin text-amber-300 shrink-0" />
        {t("deposit.addrPreparing", "正在准备充值地址,请稍候…")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-3">
      {/* 二维码居中。 */}
      <div className="flex justify-center">
        {qr ? (
          <div className="rounded-xl bg-white p-2.5">
            <img src={qr} alt={t("deposit.tabAddress", "地址/扫码")} className="h-[180px] w-[180px] sm:h-[200px] sm:w-[200px]" />
          </div>
        ) : (
          <div className="h-[180px] w-[180px] grid place-items-center rounded-xl bg-white/[0.03]">
            <Loader2 className="h-5 w-5 text-amber-300 animate-spin" />
          </div>
        )}
      </div>

      {/* 地址(等宽、换行 break-all、一键复制)。 */}
      <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/[0.06]">
        <div className="text-[10px] uppercase tracking-wide text-amber-300/70 mb-1">{t("deposit.depositAddress", "充值地址")}</div>
        <div className="flex items-center gap-2">
          <code className="text-[11px] font-mono text-foreground/80 break-all flex-1 min-w-0">{seller}</code>
          <button onClick={() => onCopy(seller)} aria-label={t("common.copy", "复制")} className="shrink-0 h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors">
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 剩余可充额度提示。 */}
      {!cap.loading && cap.hasCode && (
        <div className="text-[11px] text-foreground/55 leading-snug tabular-nums" data-testid="deposit-cap-hint">
          {t("deposit.remainingHint", "剩余可充额度:${{max}}", { max: Math.floor(cap.remaining) })}
        </div>
      )}

      {/* 显著警示。 */}
      <div className="rounded-xl p-2.5 flex items-start gap-2"
        style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.25)" }}>
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-300" />
        <p className="text-[11px] leading-snug text-red-100/85">
          {warnText ?? t("deposit.addressWarn", "仅支持 Polygon 网络的 pUSD,转入其他代币 / 其他链将无法找回。")}
        </p>
      </div>
    </div>
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
  const account = useActiveAccount();
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [confirming, setConfirming] = useState(false);

  // 默认把提现目标地址填成「当前连接的钱包」——最常见就是提回自己钱包(仍可改)。
  // reset() 在关闭时清空,所以每次重新打开都会重新预填最新连接地址。
  useEffect(() => {
    if (open && !dest && account?.address) setDest(account.address);
  }, [open, account?.address]);

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
            {/* 链提醒:pUSD 提现只发 Polygon —— 目标地址必须支持 Polygon,否则资金会丢。 */}
            <p className="mt-1.5 text-[11px] text-amber-300/85 flex items-start gap-1 leading-snug">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>{t("copyTrading.withdrawChainNotePm", "仅提现到 Polygon 网络(pUSD)。请确认目标地址支持 Polygon,否则资金可能丢失。默认已填入你当前连接的钱包地址。")}</span>
            </p>
          </div>

          {confirming && amountValid && destValid && (
            <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)" }}>
              <div className="flex items-center gap-1.5 text-[12px] text-amber-300 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" /> {t("copyTrading.withdrawReviewTitle")}
              </div>
              <div className="flex justify-between text-[12px]"><span className="text-muted-foreground">{t("copyTrading.withdrawAmountLabel")}</span><span className="font-bold tabular-nums">{fmtUsd(amt)}</span></div>
              <div className="flex justify-between text-[12px]"><span className="text-muted-foreground">{t("copyTrading.withdrawNetwork", "网络")}</span><span className="font-semibold text-amber-200">Polygon · pUSD</span></div>
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

// ─── 跟单前风险提示弹窗(PM)───────────────────────────────────────────────────
//
// 在确认跟单前展示策略关键参数 + 红色风险文案。激进档(镜像≥10% 或 日上限较高)
// 强制勾选「我已知悉高风险并自愿承担」才放行;保守/稳健档只需普通确认。
// 观感对齐 HL 侧的二次确认(packRiskLine):金黄边框 + 红色风险行。

export interface CopyRiskParams {
  /** 跟单档:用于决定是否强制勾选高风险确认。 */
  tier: "conservative" | "balanced" | "aggressive";
  /** 镜像比例(整数百分比,如 8 表示 8%)。 */
  ratioPct: number;
  /** 单笔上限(USD)。 */
  perTradeCapUsd: number;
  /** 日上限(USD)。null = 随单/不限。 */
  dailyCapUsd?: number | null;
  /** 最少资金要求(USD)。null = 无门槛。 */
  minBalanceUsd?: number | null;
}

/**
 * 判定是否「激进档」:显式 tier=aggressive,或可见参数偏激进(镜像≥10% 或日上限较高)。
 * 阈值据可见参数自洽判断,真实限额由后端执行。
 */
export function isAggressiveRisk(p: CopyRiskParams): boolean {
  if (p.tier === "aggressive") return true;
  if (p.ratioPct >= 10) return true;
  if ((p.dailyCapUsd ?? 0) >= 1000) return true;
  return false;
}

export function CopyRiskDialog({
  open, onOpenChange, params, onConfirm, busy = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  params: CopyRiskParams;
  /** 用户勾选(若激进)并点确认后触发——调用方在此真正启用跟单/跳转。 */
  onConfirm: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const aggressive = isAggressiveRisk(params);
  const [acked, setAcked] = useState(false);

  // 每次重新打开都重置勾选,避免上一次的「已勾选」残留放行。
  useEffect(() => { if (!open) setAcked(false); }, [open]);

  const canConfirm = (!aggressive || acked) && !busy;

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-bold text-foreground/85 tabular-nums">{v}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[calc(100vw-1.5rem)] max-w-md p-4 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-black" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] font-bold leading-tight">
                {t("copyTrading.riskDialogTitle", "跟单前风险提示")}
              </DialogTitle>
              <DialogDescription className="text-[12px] leading-tight">
                {aggressive
                  ? t("copyTrading.riskDialogDescAggressive", "激进策略波动较大,请确认你已了解风险。")
                  : t("copyTrading.riskDialogDesc", "请确认以下跟单参数后再继续。")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {/* 关键参数 */}
          <div className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.20)" }}>
            {row(t("copyTrading.riskParamRatio", "镜像比例"), `${params.ratioPct}%`)}
            {row(t("copyTrading.riskParamCap", "单笔上限"), fmtUsd(params.perTradeCapUsd, 0))}
            {row(
              t("copyTrading.riskParamDaily", "日上限"),
              params.dailyCapUsd != null && params.dailyCapUsd > 0
                ? fmtUsd(params.dailyCapUsd, 0)
                : t("copyTrading.riskParamAuto", "随单"),
            )}
            {row(
              t("copyTrading.riskParamMinBal", "最少资金要求"),
              params.minBalanceUsd != null && params.minBalanceUsd > 0
                ? fmtUsd(params.minBalanceUsd, 0)
                : t("copyTrading.riskParamNone", "无门槛"),
            )}
          </div>

          {/* 满仓保护提示(真实限额后端执行) */}
          <div className="flex items-start gap-1.5 rounded-lg px-3 py-2 text-[11px] leading-snug text-foreground/65"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400/80" />
            <span>{t("copyTrading.riskMaxExposure", "满仓保护:单笔下单最多使用账户可用余额的 20%。")}</span>
          </div>

          {/* 红色风险文案 */}
          <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)" }}>
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" />{t("copyTrading.riskWarnTitle", "风险提示")}
            </div>
            <p className="text-[11px] leading-relaxed text-red-300/90">
              {t("copyTrading.riskWarnLine", "预测市场存在亏损风险,行情不利时可能损失全部本金。跟单不保证盈利,请理性参与、量力而行。")}
            </p>
          </div>

          {/* 激进档:强制勾选 */}
          {aggressive && (
            <label className="flex items-start gap-2 cursor-pointer rounded-lg px-3 py-2.5"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <Checkbox
                checked={acked}
                onCheckedChange={(v) => setAcked(v === true)}
                className="mt-0.5 shrink-0"
                data-testid="checkbox-risk-ack"
              />
              <span className="text-[12px] leading-snug text-foreground/85">
                {t("copyTrading.riskAck", "我已知悉高风险并自愿承担")}
              </span>
            </label>
          )}
        </div>

        <DialogFooter className="gap-2 mt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "取消")}
          </Button>
          <Button
            size="sm"
            disabled={!canConfirm}
            onClick={onConfirm}
            className="bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold disabled:opacity-50"
            data-testid="button-risk-confirm"
          >
            {busy
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : t("copyTrading.riskConfirm", "我已知悉,继续跟单")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
