/**
 * Smart Copy-Trading — shared building blocks.
 *
 * Everything the /copy-trading/* pages reuse: loose engine-shape normalizers,
 * the sub-tab nav, the account-opening (开户) flow, and the deposit / withdraw
 * dialogs. All data flows through the typed engine client (`@app/lib/engine`)
 * and the react-query hooks (`@app/lib/engine-hooks`) — no mocked arrays.
 */

import { useState } from "react";
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
import { funding, users } from "@app/lib/engine";
import { useActiveAccount, PayEmbed } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb/client";
import { polygon } from "@/lib/thirdweb/chains";
import {
  LayoutDashboard, Zap, Activity, History as HistoryIcon,
  Wallet, Copy, CheckCircle2, Circle, Loader2, ArrowDownToLine, ArrowUpFromLine, AlertTriangle,
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
  { href: "/copy-trading/history", labelKey: "copyTrading.tabHistory",  fallback: "History",   icon: HistoryIcon },
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
  const { t } = useTranslation();
  const { steps, run, isPending } = useOnboardFlow(wallet);
  const labels = [t("copyTrading.onboardStep1"), t("copyTrading.onboardStep2"), t("copyTrading.onboardStep3")];

  return (
    <div className="premium-card rounded-2xl p-5 space-y-4">
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
  open, onOpenChange, userId,
}: { open: boolean; onOpenChange: (v: boolean) => void; userId: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<{ chain: string; address: string }[]>([]);
  const [assets, setAssets] = useState<string[]>([]);

  const load = useMutation({
    mutationFn: async () => {
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
          rows = Object.entries(addrObj)
            .filter(([, a]) => typeof a === "string" && (a as string).length > 0)
            .map(([chain, a]) => ({ chain: chain.toUpperCase(), address: String(a) }));
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

  // Lazy-load contents the first time the dialog opens.
  function handleOpenChange(v: boolean) {
    if (v && addresses.length === 0 && !load.isPending) load.mutate();
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
          {/* 主路径:用卡 / 跨链一键买入(冲动买单) */}
          <DepositBuyPanel chain={polygon} token={PUSD_POLYGON} assetLabel="pUSD" />

          {/* 次路径:转账到地址 */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground/70">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t("deposit.manualTransfer", "或转账到地址")}
            </div>
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

export function DepositBuyPanel({
  chain, token, seller, assetLabel,
}: {
  chain: any; // thirdweb Chain（polygon / arbitrum）
  token: `0x${string}`;
  seller?: string; // 不传 = 连接钱包（Polymarket 直充本钱包）
  assetLabel: string;
}) {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const amt = Number(amount);
  const sellerAddr = seller ?? account?.address;
  if (!account || !sellerAddr) return null;

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

      {!confirmed || !(amt > 0) ? (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {BUY_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={cn(
                  "h-11 rounded-xl text-[13px] font-bold tabular-nums transition active:scale-95",
                  amt === p
                    ? "bg-gradient-to-br from-amber-400 to-yellow-600 text-black border border-amber-400"
                    : "bg-white/[0.04] text-foreground/80 border border-white/10 hover:border-amber-400/40",
                )}
              >
                ${p}
              </button>
            ))}
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
          <Button
            className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 text-black text-[15px] font-extrabold hover:opacity-95 disabled:opacity-40 active:scale-[0.99]"
            disabled={!(amt > 0)}
            onClick={() => setConfirmed(true)}
          >
            <Zap className="h-4 w-4 mr-1.5" />
            {amt > 0 ? `${t("deposit.buyNow", "立即买入")} $${amt}` : t("deposit.enterAmount", "输入或选择金额")}
          </Button>
        </>
      ) : (
        <div className="w-full">
          <button
            className="mb-2 inline-flex items-center gap-1 text-[12px] text-amber-300 hover:underline"
            onClick={() => setConfirmed(false)}
          >
            ← {t("common.back", "改数量")} · <span className="font-bold tabular-nums">${amt}</span>
          </button>
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
