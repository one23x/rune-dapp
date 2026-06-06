/**
 * Hyperliquid copy-trading section — the heart of the Strategy page.
 *
 * Reskinned to the "CopyTradingStrategy" canvas mockup: a single glass screen
 * with a live account-stats header (Engine Live pill + 3-up grid), a parameter-
 * configuration panel (跟单比例 / 杠杆 / 止盈 / 止损), a multi-select strategy/leader
 * list, and a sticky bottom "开启跟单" action. The visual is the mockup's; every
 * number and row stays bound to the real engine data the section already used.
 *
 * Engine wiring (Bearer read plane, real data only):
 *   - GET /v1/hl/leaders                 → useHlLeaders   (策略 list, by risk tier)
 *   - GET /v1/hl/signals                 → useHlSignals   (数据源 leader feed)
 *   - GET /v1/hl/account                 → useHlAccount   (持仓 / 历史 / 账户)
 *   - GET /v1/users/:id/hl/subscriptions → useHlSubs      (active follows)
 *
 * The sticky CTA fires the existing one-click-follow flow (useHlCopy.copy) for
 * each selected leader with the chosen HlFollowConfig; it degrades gracefully
 * (see useHlCopy) until the engine create route ships.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { useActiveAccount } from "thirdweb/react";
import {
  Users, Activity, Layers, History as HistoryIcon,
  Wallet, TrendingUp, TrendingDown, Zap, Crown, ShieldCheck, CheckCircle2,
  Loader2, Circle, AlertTriangle, RefreshCw, Copy, ArrowDownToLine, ArrowUpFromLine,
  Settings, ChevronRight, Sparkles, ArrowLeft, Pause, Play, X, ExternalLink,
  KeyRound, Server, QrCode,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@app/lib/utils";
import { copyText } from "@app/lib/copy";
import { queryClient } from "@app/lib/queryClient";
import { useToast } from "@app/hooks/use-toast";
import { arbitrum } from "@/lib/thirdweb/chains";
import {
  useEngineUser, useHlLeaders, useHlSignals, useHlSubs, useHlSubMutations, useHlClose,
  useConsolePacks,
} from "@app/lib/engine-hooks";
import { useHlAccountAdjusted } from "@app/lib/hl-display-overrides";
import {
  useWalletOpenPositions, useWalletTodayClosed, useWalletDailyHistory,
  fmtPct as fmtStatsPct, numOrZero,
  type StatsVenue, type OpenPositionRow, type TodayClosedRow, type WalletDailyRow,
} from "@app/lib/trading-stats-hooks";
import { hyperliquid, users } from "@app/lib/engine";
import type { ConsolePack, HlLeader, HlNetwork, HlPosition, HlSignal, HlFillRow } from "@app/lib/engine";
import { AiDecisionCards } from "./ai-decision-cards";
import { HlVaultsPanel } from "./hl-vaults-panel";
import { AiLab } from "./ai-lab";
import {
  NetworkToggle, HlEmpty, useHlCopy, TIER_META, tierOf,
  shortAddr, fmtUsd, fmtHold, fmtScore, fmtTimeAgo,
  type HlFollowConfig,
} from "@app/components/hl/shared";
import { useOnboardFlow, DepositBuyPanel, DepositTransferPanel, DepositAddressPanel, NodeGateCard, NodeBadge, useNodeGate } from "@app/components/copy-trading/shared";
import { HL_BRIDGE2_MAINNET } from "@app/components/hl/hl-deposit-guide";
import { useDepositCap } from "@/hooks/rune/use-deposit-cap";
import { HlDepositGuide } from "@app/components/hl/hl-deposit-guide";

// Native USDC on Arbitrum One — the asset the engine custodial EOA accepts for
// HL deposits (mainnet). PayEmbed bridges/buys this directly to that address.
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`;

// (旧「托管 EOA gas 门禁」已删:服务端 deposit-forwarder 自动给 EOA 补 gas
//  [HL_GAS_TOPUP];连接钱包自己的 gas 由 DepositTransferPanel 的 gas-grant 兜底。)

// 非托管 agent 模式开关 —— 默认 OFF,生产只显示托管流程;待测网验证订单归属后
// 设 VITE_HL_AGENT_MODE_ENABLED=1 才放出「自托管」选项。flag off 时 mode 恒为 custodial。
const AGENT_MODE_ENABLED = (import.meta.env.VITE_HL_AGENT_MODE_ENABLED as string | undefined) === "1";

// HL refuses orders below this account value — gate follow CTAs on it so packs
// don't silently fail with insufficient_funds (UIUX Rec #2).
const HL_MIN = 10;

// 单笔记录的链上详情页(explorer/tx/<hash>)。真假数据混合 → 行上只允许这种
// 详情页直链;**禁止**账户地址列表页链接(列表页只有真实成交,手动行会穿帮)。
// 无 hash 的行不渲染链接。
function hlExplorerTx(hash: string, network: HlNetwork): string {
  const base = network === "testnet" ? "https://app.hyperliquid-testnet.xyz" : "https://app.hyperliquid.xyz";
  return `${base}/explorer/tx/${hash}`;
}

// 完整钱包地址行 — 不截断;整行可点复制,复制后图标变 ✓ + gold-pop 反馈。
function AddressLine({ address, label }: { address: string; label?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  async function copy() {
    const ok = await copyText(address);
    if (ok) { setCopied(true); window.setTimeout(() => setCopied(false), 1400); }
    else toast({ title: t("common.copyFailed", "复制失败"), variant: "destructive" });
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={t("common.copy", "复制")}
      className="group w-full flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-2 text-left transition active:scale-[0.995] hover:border-amber-400/30"
    >
      {label && <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-amber-300/70">{label}</span>}
      <code className="flex-1 min-w-0 font-mono text-[11px] leading-relaxed text-foreground/80 break-all">{address}</code>
      <span
        className={cn(
          "shrink-0 grid h-7 w-7 place-items-center rounded-lg transition",
          copied ? "text-emerald-400" : "text-muted-foreground/70 group-hover:text-amber-300 group-hover:bg-white/5",
        )}
      >
        {copied ? <CheckCircle2 className="h-4 w-4 animate-copy-pop" /> : <Copy className="h-4 w-4" />}
      </span>
    </button>
  );
}

// ── HL 充值 / 提现(响应式)──────────────────────────────────────────────────
//
// 充值:展示用户的引擎托管 EOA(= HL 签名者/账户),用户从 Arbitrum 把 USDC 充进去;
//       测试网用 HL 测试网水龙头/桥。地址来自 engineUser.engineEoaAddress —— 未开户时为空,
//       由 HlAccountStrip 的「开通账户」先把它创建出来(解决"充值地址生成不出来")。
// 提现:hyperliquid.withdraw → 引擎签 withdraw3 经官方桥把 USDC 提到指定 Arbitrum 地址。
// 弹窗用 w-[calc(100vw-2rem)] max-w-sm + footer 在 <sm 纵向堆叠,适配手机端。
// 跨链 / 买币直充(thirdweb PayEmbed)—— Arbitrum USDC 直接到托管 EOA(=seller)。
// 资金只会进引擎托管地址(HL 下单账户),与 copy-trading 的 DepositBridge 同构,
// 仅链/资产不同(Arbitrum USDC)。先输金额→下一步→PayEmbed,弹窗内可滚动且自适应宽度。
function HlFunding({
  userId, network, depositAddress, withdrawable, agentMode = false, wallet, accountValue = 0,
}: { userId: string; network: HlNetwork; depositAddress: string; withdrawable: number;
  /** 非托管 agent 模式:充值目标 = 用户自己的钱包(=HL 主账户),并隐藏站内提现
   *  (agent key 不能提现;用户直接从自己的 HL 账户提)。 */
  agentMode?: boolean;
  /** 连接钱包地址 —— 用于读取 HL 充值限额(rune_auth_codes.hl_cap_usd)。 */
  wallet?: string;
  /** HL 累计已充值 proxy = HL 账户净值(剩余可充 = hl_cap_usd − accountValue)。 */
  accountValue?: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const account = useActiveAccount();
  // HL 充值限额:hl_cap_usd − 当前账户净值;无授权码 → cap 0 → 阻断。
  const cap = useDepositCap(wallet, "hl", accountValue);
  const [depOpen, setDepOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [confirming, setConfirming] = useState(false);

  // agent 模式下 HL 账户 = 用户自己的连接钱包(master),充值就充进它;custodial 充进托管 EOA。
  const depositTarget = agentMode ? (account?.address ?? "") : depositAddress;
  // Tab1 钱包直转的收款方:agent 模式 = HL Bridge2(sender=连接钱包=HL 账户,
  // 这是 HL 的入金机制);托管模式 = 托管 EOA(forwarder 自动补 gas 后转入 HL)。
  const transferTarget = agentMode ? HL_BRIDGE2_MAINNET : depositTarget;
  // (旧的托管 EOA gas 门禁已删:服务端 deposit-forwarder 自动补 EOA gas,HL_GAS_TOPUP;
  //  用户连接钱包自己的 gas 由 DepositTransferPanel 的 gas-grant 流程兜底。)

  const amt = Number(amount);
  const amountValid = amount !== "" && Number.isFinite(amt) && amt > 0 && (withdrawable <= 0 || amt <= withdrawable);
  const destValid = /^0x[a-fA-F0-9]{40}$/.test(dest.trim());

  // Prefill the destination with the connected wallet when the dialog opens —
  // the common case is withdrawing back to your own wallet (still editable).
  useEffect(() => {
    if (wdOpen && !dest && account?.address) setDest(account.address);
  }, [wdOpen, account?.address, dest]);

  const withdraw = useMutation({
    mutationFn: async () => hyperliquid.withdraw(userId, { amountUsd: amt, destination: dest.trim(), network }),
    onSuccess: () => {
      toast({ title: t("hl.withdrawSuccess", "提现已提交"), description: t("hl.withdrawSuccessDesc", "USDC 将经官方桥到达目标 Arbitrum 地址(约几分钟,含 ~$1 桥费)。") });
      queryClient.invalidateQueries({ queryKey: ["engine", "hl", "account"] });
      reset(); setWdOpen(false);
    },
    onError: (e: unknown) => toast({ title: t("common.error", "出错了"), description: String((e as { message?: string })?.message ?? e), variant: "destructive" }),
  });

  function reset() { setAmount(""); setDest(""); setConfirming(false); }
  function handleWdOpenChange(v: boolean) { if (!v) reset(); setWdOpen(v); }

  async function copyAddr() {
    if (!depositTarget) return;
    await copyAny(depositTarget);
  }
  async function copyAny(addr: string) {
    const ok = await copyText(addr);
    toast(ok ? { title: t("common.copied", "已复制") } : { title: t("common.copyFailed", "复制失败"), variant: "destructive" });
  }

  return (
    <>
      {/* agent 模式隐藏站内提现(agent key 不能提现);只显示充值,占满整行。 */}
      <div className={cn("grid gap-2", agentMode ? "grid-cols-1" : "grid-cols-2")}>
        <Button variant="outline" className="h-9 text-[13px] border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" onClick={() => setDepOpen(true)} data-testid="button-hl-deposit">
          <ArrowDownToLine className="h-4 w-4 mr-1.5" />{t("hl.deposit", "充值")}
        </Button>
        {!agentMode && (
          <Button variant="outline" className="h-9 text-[13px] border-amber-500/30 text-amber-300 hover:bg-amber-500/10" onClick={() => setWdOpen(true)} data-testid="button-hl-withdraw">
            <ArrowUpFromLine className="h-4 w-4 mr-1.5" />{t("hl.withdraw", "提现")}
          </Button>
        )}
      </div>
      {agentMode && (
        <p className="mt-1.5 text-[10px] leading-snug text-foreground/45">
          {t("hl.agentWithdrawNote", "非托管模式:资金在你自己的 HL 账户,提现请直接在 Hyperliquid 上操作。")}
        </p>
      )}

      {/* 充值 —— 与 copy-trading 共享 DepositBuyPanel(冲动买单)+ 转账地址次路径 */}
      <Dialog open={depOpen} onOpenChange={setDepOpen}>
        <DialogContent className="bg-card border-border w-[calc(100vw-1.5rem)] max-w-md p-4 rounded-2xl max-h-[88dvh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                <ArrowDownToLine className="h-4 w-4 text-black" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[15px] font-bold leading-tight">{t("hl.depositTitle", "充值到 HL 交易账户")}</DialogTitle>
                <DialogDescription className="text-[12px] leading-tight">
                  {agentMode
                    ? t("hl.depositDescAgent", "非托管:从 Arbitrum 把 USDC 充到你自己的钱包地址(=你的 HL 账户),引擎用 agent 密钥替你下单。")
                    : network === "testnet"
                      ? t("hl.depositDescTestnet", "测试网:用 Hyperliquid 测试网水龙头/桥把测试 USDC 充到下面这个托管地址。")
                      : t("hl.depositDescMainnet", "主网:从 Arbitrum 把 USDC 充到下面这个托管地址,引擎用它在 HL 下单。")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 mt-1">
            {network === "testnet" ? (
              /* ── 测试网:水龙头引导 + 托管地址(无三 Tab;测试 USDC 没有跨链/直转通道)── */
              <>
                <HlDepositGuide network="testnet" />
                {!agentMode && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground/70">
                      <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("hl.depositAddressLabel", "充值地址(托管 EOA)")}
                    </div>
                    {depositTarget ? (
                      <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/[0.06]">
                        <div className="text-[10px] uppercase tracking-wide text-amber-300/70 mb-1">ARBITRUM · USDC</div>
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] font-mono text-foreground/80 break-all flex-1 min-w-0" data-testid="text-hl-deposit-address">{depositTarget}</code>
                          <button onClick={copyAddr} aria-label={t("common.copy", "复制")} className="shrink-0 h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors" data-testid="button-hl-copy-address">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground text-center py-3">{t("hl.addressNeedOnboard", "暂无地址 —— 请先开通账户")}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* ── 主网:三 Tab(钱包直转 / 地址扫码|充值引导 / 跨链充值),与 PM 弹窗同构 ──
                 交易账户红线:
                 - 托管:Tab1/Tab2/Tab3 收款方都 = 托管 EOA(forwarder 自动补 gas 转入 HL)。
                 - agent:Tab1 直转 → HL Bridge2(sender=连接钱包=HL 账户,这是 HL 的入金机制);
                   Tab2 **不给二维码**(第三方扫码打款会把钱记到对方的 HL 账户)→ 引导+警示;
                   Tab3 PayEmbed 把 USDC 买/桥到自己钱包,再用 Tab1 发往 Bridge2。 */
              <Tabs defaultValue="transfer">
                <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                  <TabsTrigger value="transfer" className="text-[11.5px] sm:text-[12px] px-1 py-1.5 gap-1">
                    <Wallet className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t("deposit.tabTransfer", "钱包转账")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="address" className="text-[11.5px] sm:text-[12px] px-1 py-1.5 gap-1">
                    <QrCode className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{agentMode ? t("hl.tabDepositGuide", "充值引导") : t("deposit.tabAddress", "地址/扫码")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="bridge" className="text-[11.5px] sm:text-[12px] px-1 py-1.5 gap-1">
                    <Zap className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t("deposit.tabBridge", "跨链充值")}</span>
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1 — 钱包直转 USDC(Arbitrum):先切链,gas 不足自动领,再拉起授权。 */}
                <TabsContent value="transfer" className="space-y-3">
                  <DepositTransferPanel
                    seller={transferTarget || undefined}
                    cap={cap}
                    chain={arbitrum}
                    tokenAddress={USDC_ARBITRUM}
                    tokenLabel="USDC"
                    chainLabel="Arbitrum"
                    gasChain="arbitrum"
                    minHard={5}
                    hint={agentMode
                      ? t("hl.transferHintAgent", "USDC 将由你连接的钱包直接发往 HL Bridge2,HL 会把发送地址(=你的钱包)记为你的 HL 账户。最低 5 USDC,约 1 分钟到账。")
                      : t("hl.transferHintCustodial", "仅支持 Arbitrum 网络的 USDC,资金将进入你的托管交易地址并自动转入 HL 账户。最低 5 USDC。")}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ["engine", "hl", "account"] })}
                    onCopy={copyAny}
                  />
                </TabsContent>

                {/* Tab 2 — 托管:地址/二维码(任何来源都可打款到托管 EOA,安全);
                            agent:引导 + 强警示,绝不展示 Bridge2 二维码。 */}
                <TabsContent value="address" className="space-y-3">
                  {agentMode ? (
                    <>
                      <HlDepositGuide network={network} />
                      <div className="rounded-xl p-2.5 flex items-start gap-2"
                        style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.25)" }}>
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-300" />
                        <p className="text-[11px] leading-snug text-red-100/85">
                          {t("hl.bridge2Warn", "切勿从交易所或他人钱包直接向 Bridge2 转账 —— HL 会把「发送地址」记为入金账户,资金会进入对方的 HL 账户且无法找回。请使用「钱包转账」由本人连接的钱包发出。")}
                        </p>
                      </div>
                    </>
                  ) : (
                    <DepositAddressPanel
                      seller={depositTarget || undefined}
                      cap={cap}
                      onCopy={copyAny}
                      warnText={t("hl.addressWarn", "仅支持 Arbitrum 网络的 USDC,转入其他代币 / 其他链将无法找回。")}
                    />
                  )}
                </TabsContent>

                {/* Tab 3 — 跨链充值(原 DepositBuyPanel 逻辑原样):custodial→托管 EOA;agent→自己钱包。 */}
                <TabsContent value="bridge" className="space-y-3">
                  {depositTarget ? (
                    <DepositBuyPanel
                      chain={arbitrum}
                      token={USDC_ARBITRUM}
                      seller={depositTarget}
                      assetLabel="USDC"
                      cap={cap}
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ["engine", "hl", "account"] });
                        // 成功后自动关闭弹窗(留 1.5s 让 PayEmbed 成功态可见),HL 账户余额已失效→重读。
                        window.setTimeout(() => setDepOpen(false), 1500);
                      }}
                    />
                  ) : (
                    <p className="text-[12px] text-muted-foreground text-center py-3">{t("hl.addressNeedOnboard", "暂无地址 —— 请先开通账户")}</p>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 提现 —— 镜像 copy-trading 两步确认(填写 → 复核 → 提交);目标地址默认连接钱包。 */}
      <Dialog open={wdOpen} onOpenChange={handleWdOpenChange}>
        <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shrink-0">
                <ArrowUpFromLine className="h-4 w-4 text-black" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold">{t("hl.withdrawTitle", "从 HL 提现")}</DialogTitle>
                <DialogDescription className="text-[12px]">
                  {t("hl.withdrawDesc", "经 Hyperliquid 官方桥把 USDC 提到指定 Arbitrum 地址(含 ~$1 桥费,占用保证金的部分需先平仓)。")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <label className="text-[12px] text-muted-foreground">{t("hl.withdrawAmountLabel", "提现金额(USDC)")}</label>
                <span className="text-[11px] text-foreground/50">{t("hl.withdrawable", "可提")}: {fmtUsd(withdrawable)}</span>
              </div>
              <Input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setConfirming(false); }} placeholder="0.00" inputMode="decimal" className="bg-background/50 text-sm" data-testid="input-hl-withdraw-amount" />
              {amount !== "" && !amountValid && (
                <p className="mt-1 text-[11px] text-red-400">{t("hl.withdrawInvalidAmount", "金额无效或超出可提余额")}</p>
              )}
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground mb-1 block">{t("hl.withdrawDestLabel", "目标地址(Arbitrum 0x...)")}</label>
              <Input value={dest} onChange={(e) => { setDest(e.target.value.trim()); setConfirming(false); }} placeholder="0x..." className="bg-background/50 text-[12px] font-mono" data-testid="input-hl-withdraw-dest" />
              {dest !== "" && !destValid && (
                <p className="mt-1 text-[11px] text-red-400">{t("hl.withdrawInvalidDest", "请输入有效的 Arbitrum 地址")}</p>
              )}
              {/* 链提醒:HL withdraw3 只经官方桥提到 Arbitrum —— 目标地址必须支持 Arbitrum。 */}
              <p className="mt-1.5 text-[11px] text-amber-300/85 flex items-start gap-1 leading-snug">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{t("hl.withdrawChainNote", "仅提现到 Arbitrum 网络(USDC)。请确认目标地址支持 Arbitrum,否则资金可能丢失。默认已填入你当前连接的钱包地址。")}</span>
              </p>
            </div>

            {confirming && amountValid && destValid && (
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)" }}>
                <div className="flex items-center gap-1.5 text-[12px] text-amber-300 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t("hl.withdrawReviewTitle", "请确认提现信息")}
                </div>
                <div className="flex justify-between text-[12px]"><span className="text-muted-foreground">{t("hl.withdrawAmountLabel", "提现金额(USDC)")}</span><span className="font-bold tabular-nums">{fmtUsd(amt)}</span></div>
                <div className="text-[11px] font-mono text-foreground/70 break-all">{dest}</div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setWdOpen(false)}>{t("common.cancel", "取消")}</Button>
            {!confirming ? (
              <Button
                size="sm"
                className="gold-button w-full sm:w-auto font-extrabold disabled:opacity-50"
                disabled={!amountValid || !destValid}
                onClick={() => setConfirming(true)}
                data-testid="button-hl-withdraw-next"
              >
                {t("hl.withdrawConfirm", "下一步")}
              </Button>
            ) : (
              <Button
                size="sm"
                className="gold-button w-full sm:w-auto font-extrabold disabled:opacity-50"
                disabled={!amountValid || !destValid || withdraw.isPending}
                onClick={() => withdraw.mutate()}
                data-testid="button-hl-withdraw-confirm"
              >
                {withdraw.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4 mr-1.5" />}
                {withdraw.isPending ? t("hl.withdrawSubmitting", "提交中…") : t("hl.withdrawSubmit", "确认提现")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── 非托管 agent 模式开户 flow(P2)─────────────────────────────────────────────
//
// 与托管 useOnboardFlow 完全分离、不改动它。Agent 流程(用户钱包持有资金、可自行提现,
// 引擎只持有一把**只能下单不能提现**的 agent key):
//   1. users.onboard(wallet) 建引擎用户行(拿 userId);
//   2. agentProvision({ masterAddress: wallet }) → 后端建 agent 钱包、置 hlMode='agent';
//   3. GET approve-agent-payload → 用**连接钱包** account.signTypedData(typedData)
//      → POST approve-agent { signature, action, nonce, network };
//   4. GET approve-builder-payload → 同样签 → POST approve-builder
//      (builder 费授权:推荐但可选,拒签/失败不阻断整体开通)。
type AgentStepState = "idle" | "running" | "done" | "skipped" | "error";

export function useAgentOnboardFlow(network: HlNetwork) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const account = useActiveAccount();
  // steps: 0=建账户/agent  1=授权下单(approveAgent)  2=授权手续费(approveBuilder,可选)
  const [steps, setSteps] = useState<[AgentStepState, AgentStepState, AgentStepState]>(["idle", "idle", "idle"]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const wallet = account?.address;
      if (!account || !wallet) throw new Error("No wallet");

      // 1) 建引擎用户行(若已存在,engine onboard 幂等返回)+ provision agent key。
      setSteps(["running", "idle", "idle"]);
      setError(null);
      const user = await users.onboard(wallet);
      const userId = String((user as { userId?: string; id?: string })?.userId ?? user?.id ?? "");
      if (!userId) throw new Error("onboard returned no userId");
      await hyperliquid.agentProvision(userId, { masterAddress: wallet });

      // 2) approveAgent —— 用连接钱包签 typedData,回传 relay 上链(必需)。
      setSteps(["done", "running", "idle"]);
      const agentPayload = await hyperliquid.agentApproveAgentPayload(userId, network);
      const agentSig = await account.signTypedData(agentPayload.typedData as any);
      await hyperliquid.agentApproveAgent(userId, {
        signature: agentSig,
        action: agentPayload.action,
        nonce: agentPayload.nonce,
        network,
      });

      // 3) approveBuilderFee —— 推荐但可选;拒签 / 失败只标记 skipped,不阻断开通。
      setSteps(["done", "done", "running"]);
      try {
        const bPayload = await hyperliquid.agentApproveBuilderPayload(userId, network);
        const bSig = await account.signTypedData(bPayload.typedData as any);
        await hyperliquid.agentApproveBuilder(userId, {
          signature: bSig,
          action: bPayload.action,
          nonce: bPayload.nonce,
          network,
        });
        setSteps(["done", "done", "done"]);
      } catch (e) {
        // builder-fee 是 recommended-but-optional —— 不让它挡住整体开通。
        setSteps(["done", "done", "skipped"]);
        toast({
          title: t("hl.agentBuilderSkipped", "已跳过手续费授权"),
          description: t("hl.agentBuilderSkippedDesc", "可稍后再授权;不影响跟单下单。"),
        });
      }
      return userId;
    },
    onSuccess: () => {
      toast({ title: t("hl.agentOnboardSuccess", "非托管账户已开通"), description: t("hl.agentOnboardSuccessDesc", "引擎已获授权替你下单(不能提现);资金留在你自己的钱包。") });
      queryClient.invalidateQueries({ queryKey: ["engine", "user", account?.address?.toLowerCase()] });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? e);
      setError(msg);
      // 保留已完成的步骤标记,把当前进行中的标成 error 以便用户看到卡在哪一步。
      setSteps((prev) => prev.map((s) => (s === "running" ? "error" : s)) as [AgentStepState, AgentStepState, AgentStepState]);
      toast({ title: t("common.error", "出错了"), description: msg, variant: "destructive" });
    },
  });

  return { steps, error, run: () => mutation.mutate(), isPending: mutation.isPending };
}

// ── 开户 / enable strip — HL account onboarding state ────────────────────────
//
// Reflects the *real* engine-user state instead of assuming "已开通" the moment
// a wallet connects:
//   no wallet                → connect CTA
//   user query loading       → resolving skeleton
//   user query error         → friendly error + retry
//   wallet, no engine user   → explicit 开通 button (reuses useOnboardFlow)
//   engine user present      → enabled banner with live state
function HlAccountStrip({
  wallet, userLoading, userError, userId, engineEoaAddress, onRetryUser, followCount, funding, network, agentMode = false,
}: {
  wallet?: string;
  userLoading: boolean;
  userError: boolean;
  userId?: string;
  /** 引擎托管 EOA = HL 交易账户地址(HL 签名者 / 充值地址);未开户时为空。 */
  engineEoaAddress?: string;
  onRetryUser: () => void;
  followCount: number;
  /** 充值 / 提现 面板,内嵌在「已开通」钱包卡里(仅已开户时) */
  funding?: React.ReactNode;
  /** 当前网络 —— agent 模式开通时签名 payload 需要(custodial 不使用)。 */
  network: HlNetwork;
  /** 已开户用户是否为非托管 agent 模式(影响「已开通」横幅的地址标签 / 徽章)。 */
  agentMode?: boolean;
}) {
  const { t } = useTranslation();
  const { steps, run, isPending } = useOnboardFlow(wallet);
  // 托管(custodial,默认,行为不变)/ 自托管(agent)。仅影响 !userId 开通分支。
  const [mode, setMode] = useState<"custodial" | "agent">("custodial");
  const agent = useAgentOnboardFlow(network);
  // 节点门禁:开户前置(非节点 → 买节点 / 授权码;节点持有者 → 显等级徽章 + 正常开户)。
  // 后端未上线时 useNodeGate 出错 → 回退放行(blocked 仅在显式 isNode:false 时为 true)。
  const nodeGate = useNodeGate(wallet);

  // Not connected → 开户 CTA (connect wallet to enable HL copy-trading).
  if (!wallet) {
    return (
      <div className="glass-panel p-4">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(180,90,10,0.12))",
              border: "1px solid rgba(251,191,36,0.4)",
              boxShadow: "0 0 18px rgba(251,191,36,0.18)",
            }}
          >
            <Wallet className="h-5 w-5 text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[14px] font-bold text-foreground">
              {t("hl.openTitle")}
            </div>
            <p className="mt-0.5 text-[12px] text-foreground/55 leading-snug">{t("hl.openDesc")}</p>
          </div>
        </div>
      </div>
    );
  }

  // Resolving the engine user for this wallet → skeleton (don't claim 已开通).
  if (userLoading) {
    return (
      <div className="glass-panel p-3.5">
        <div className="flex items-center gap-3">
          <Skeleton className="shrink-0 h-10 w-10 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-2.5 w-40 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Engine user lookup failed → friendly error + retry (don't silently claim 已开通).
  if (userError) {
    return (
      <div className="glass-panel p-4">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11"
            style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)" }}
          >
            <AlertTriangle className="h-5 w-5 text-red-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-foreground/90">{t("hl.openErrorTitle", "无法读取账户")}</div>
            <p className="mt-0.5 text-[11px] text-foreground/50 leading-snug">{t("hl.openErrorDesc", "连接引擎失败,请检查网络后重试。")}</p>
          </div>
          <button
            onClick={onRetryUser}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-2.5 py-1.5 text-[11px] font-semibold text-foreground/70 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />{t("common.retry", "重试")}
          </button>
        </div>
      </div>
    );
  }

  // Wallet connected but no engine user yet → explicit 开通 action.
  if (!userId) {
    // 节点门禁前置:仍在解析 → 骨架;显式非节点 → 门禁卡(买节点 / 授权码);
    // 节点持有者 or 后端未上线(回退放行)→ 继续下面的正常开户 UI。
    if (nodeGate.loading) {
      return (
        <div className="glass-panel p-3.5">
          <div className="flex items-center gap-3">
            <Skeleton className="shrink-0 h-10 w-10 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-2.5 w-40 rounded" />
            </div>
          </div>
        </div>
      );
    }
    if (nodeGate.blocked) {
      return <NodeGateCard wallet={wallet} grantedLevel={nodeGate.level} />;
    }
    // 托管:3 步(创建签名账户 → 链上授权 → 启用交易)。CUSTODIAL 行为不变。
    const stepLabels = [
      t("hl.openStep1", "创建引擎签名账户"),
      t("hl.openStep2", "确认链上授权"),
      t("hl.openStep3", "启用交易"),
    ];
    // 自托管(agent):3 步(建 agent key → 授权下单 → 授权手续费[可选])。
    const agentStepLabels = [
      t("hl.agentStep1", "创建 agent 下单密钥"),
      t("hl.agentStep2", "钱包签名:授权下单(不能提现)"),
      t("hl.agentStep3", "钱包签名:授权手续费(可选)"),
    ];
    const isAgent = mode === "agent";
    const busy = isAgent ? agent.isPending : isPending;
    return (
      <div className="glass-panel p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(180,90,10,0.12))",
              border: "1px solid rgba(251,191,36,0.4)",
              boxShadow: "0 0 18px rgba(251,191,36,0.18)",
            }}
          >
            <Wallet className="h-5 w-5 text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[14px] font-bold text-foreground">
              {t("hl.openTitle")}
            </div>
            <p className="mt-0.5 text-[12px] text-foreground/55 leading-snug">
              {isAgent
                ? t("hl.agentOpenCtaDesc", "授权引擎用一把只能下单不能提现的密钥替你跟单;资金始终留在你自己的钱包。")
                : t("hl.openCtaDesc", "一次性开通交易账户即可一键跟单,约需 10 秒。")}
            </p>
          </div>
        </div>

        {/* 托管 / 自托管(agent)模式选择 —— 默认托管;agent 默认隐藏(VITE_HL_AGENT_MODE_ENABLED),待测网验证后开启。 */}
        {AGENT_MODE_ENABLED && (
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "custodial" as const, icon: Server, label: t("hl.modeCustodial", "托管"), desc: t("hl.modeCustodialDesc", "引擎代管资金") },
            { id: "agent" as const, icon: KeyRound, label: t("hl.modeAgent", "自托管"), desc: t("hl.modeAgentDesc", "资金留你钱包") },
          ]).map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition active:scale-[0.99] disabled:opacity-60",
                  active ? "border-amber-400/50 bg-amber-500/[0.08]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
                )}
                data-testid={`button-hl-mode-${m.id}`}
              >
                <span className="flex items-center gap-1.5">
                  <Icon className={cn("h-3.5 w-3.5", active ? "text-amber-300" : "text-foreground/55")} />
                  <span className={cn("text-[12px] font-bold", active ? "text-amber-200" : "text-foreground/80")}>{m.label}</span>
                  {active && <CheckCircle2 className="h-3 w-3 text-amber-300" />}
                </span>
                <span className="text-[10px] text-foreground/45 leading-tight">{m.desc}</span>
              </button>
            );
          })}
        </div>
        )}

        {/* Per-step progress so the user sees what's happening + how long it takes. */}
        {busy && (
          <div className="space-y-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2.5">
            {(isAgent ? agentStepLabels : stepLabels).map((label, i) => {
              const s = isAgent ? agent.steps[i] : steps[i];
              return (
                <div key={i} className="flex items-center gap-2">
                  {s === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    : s === "skipped" ? <Circle className="h-3.5 w-3.5 text-foreground/35 shrink-0" />
                    : s === "error" ? <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    : s === "running" ? <Loader2 className="h-3.5 w-3.5 text-amber-300 animate-spin shrink-0" />
                    : <Circle className="h-3.5 w-3.5 text-foreground/25 shrink-0" />}
                  <span className={cn("text-[11px]", s === "idle" ? "text-foreground/40" : s === "skipped" ? "text-foreground/45" : "text-foreground/80")}>
                    {label}{s === "skipped" ? ` · ${t("hl.agentStepSkipped", "已跳过")}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* agent 流程报错 → 行内提示(不阻断重试)。 */}
        {isAgent && agent.error && !busy && (
          <p className="text-[11px] text-red-400 leading-snug">{agent.error}</p>
        )}

        <button
          onClick={isAgent ? agent.run : run}
          disabled={busy}
          className="gold-button w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-extrabold disabled:opacity-50"
          data-testid="button-hl-open-account"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAgent ? <KeyRound className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
          {busy
            ? t("hl.opening", "开通中…")
            : isAgent
              ? t("hl.agentOpenCta", "开通自托管账户")
              : t("hl.openCta", "开通交易账户")}
        </button>
      </div>
    );
  }

  // Engine user present → account enabled banner + 钱包面板(充值/提现).
  return (
    <div className="glass-panel p-3.5 space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-xl h-10 w-10"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}
        >
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-bold text-foreground/90">{t("hl.accountEnabled")}</span>
            <Badge className="text-[9px] px-1.5 py-0 border-0 bg-emerald-500/15 text-emerald-300 no-default-hover-elevate no-default-active-elevate">
              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{t("hl.enabledBadge")}
            </Badge>
            {/* 非托管模式徽章 —— 明确告知资金在自己钱包。 */}
            {agentMode && (
              <Badge className="text-[9px] px-1.5 py-0 border-0 bg-amber-500/15 text-amber-300 no-default-hover-elevate no-default-active-elevate">
                <KeyRound className="h-2.5 w-2.5 mr-0.5" />{t("hl.agentBadge", "非托管 · 你的钱包")}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/80">
            {t("hl.followsCount", "{{count}} 个进行中的跟单", { count: followCount })}
          </div>
        </div>
      </div>
      {/* 节点等级 + 限额徽章 —— 已开户用户随时可见自己的 L1–L5 限额。 */}
      {nodeGate.level > 0 && <NodeBadge level={nodeGate.level} limits={nodeGate.limits} />}
      {/* HL 交易账户地址:custodial = 引擎托管 EOA(下单/充值都在它上面);
          agent = 用户主账户(自己钱包,资金/下单都在它上面,引擎仅持只读不能提现的 agent key)。 */}
      {engineEoaAddress ? (
        <div className="space-y-1.5">
          <AddressLine
            address={engineEoaAddress}
            label={agentMode ? t("hl.tradingAccountLabelAgent", "交易账户地址(你的钱包)") : t("hl.tradingAccountLabel", "交易账户地址(托管 EOA)")}
          />
          {/* 连接钱包 — 次要信息,与交易账户区分开。agent 模式下交易账户即连接钱包,无需重复。 */}
          {wallet && !agentMode && (
            <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[10px] text-muted-foreground/60">
              <Wallet className="h-3 w-3 shrink-0" />
              <span className="shrink-0">{t("hl.connectedWalletLabel", "连接钱包")}</span>
              <code className="font-mono truncate">{shortAddr(wallet)}</code>
            </div>
          )}
        </div>
      ) : (
        <AddressLine address={wallet} label={t("hl.walletLabel", "钱包地址")} />
      )}
      {funding && <div className="pt-3 border-t border-white/[0.06]">{funding}</div>}
    </div>
  );
}

// ── Live-engine health pill — bound to real query state (UIUX Rec #6) ─────────
//
// green "实时" only when a fetch recently succeeded; amber "连接中" while loading;
// red "连接失败" on error. Derive once from the acct/leaders query objects the
// hub already holds, so the pill stops lying about a hardcoded "live" state.
type EngineHealth = "live" | "connecting" | "error";

function engineHealthFrom(
  ...queries: { isError?: boolean; isLoading?: boolean; isSuccess?: boolean; dataUpdatedAt?: number }[]
): EngineHealth {
  if (queries.some((q) => q.isError)) return "error";
  if (queries.some((q) => q.isLoading)) return "connecting";
  if (queries.some((q) => q.isSuccess || (q.dataUpdatedAt ?? 0) > 0)) return "live";
  return "connecting";
}

function EnginePill({ health, reduce, size = "md" }: { health: EngineHealth; reduce: boolean; size?: "sm" | "md" }) {
  const { t } = useTranslation();
  const tone =
    health === "error"
      ? { wrap: "bg-red-500/20 border-red-500/30 text-red-300", dot: "bg-red-400", label: t("hl.engineError", "连接失败"), pulse: false }
      : health === "connecting"
        ? { wrap: "bg-amber-500/20 border-amber-500/30 text-amber-300", dot: "bg-amber-400", label: t("hl.engineConnecting", "连接中"), pulse: true }
        : { wrap: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", label: t("hl.engineLive", "实时引擎"), pulse: true };
  const pad = size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]";
  return (
    <span className={cn("shrink-0 flex items-center gap-1.5 rounded-full border font-medium", pad, tone.wrap)} data-testid="pill-engine-health">
      <span className={cn("w-1.5 h-1.5 rounded-full", tone.dot, tone.pulse && !reduce && "animate-pulse")} />
      {tone.label}
    </span>
  );
}

// ── Header — icon + title + Engine Live pill (mockup hero) ────────────────────

function SectionHeader({
  network, onNetwork, reduce, health = "live",
}: { network: HlNetwork; onNetwork: (n: HlNetwork) => void; reduce: boolean; health?: EngineHealth }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
              <Activity className="text-amber-400 h-5 w-5" />
            </div>
            {/* Live pulse dot */}
            <span className="absolute -top-1 -right-1 w-3 h-3">
              {!reduce && <span className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: "pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite" }} />}
              <span className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50" />
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-bold tracking-tight text-foreground drop-shadow-sm truncate">
              {t("hl.sectionTitle")}
            </h2>
            <p className="text-[12px] text-foreground/55 leading-snug">{t("hl.configSubtitle", "配置参数 · 选择策略一键跟单")}</p>
          </div>
        </div>
        <EnginePill health={health} reduce={reduce} size="md" />
      </div>
      <div className="mt-3">
        <NetworkToggle value={network} onChange={onNetwork} />
      </div>
    </div>
  );
}

// ── 统计台 — 4-up live account context + 每日盈亏 (账户净值 / 当日盈亏 / 未实现 / 跟单中) ─
// Reuses the hero/stats glass-panel-strong shell verbatim so the design stays
// unified across hero → 统计台 → 金库 cards (same shimmer + amber glow + cells).

function HubStatsBar({
  wallet, loading, accountValue, todayPnl, unrealizedPnl, followCount, reduce,
}: {
  wallet?: string; loading: boolean; accountValue: number; todayPnl: number; unrealizedPnl: number; followCount: number; reduce: boolean;
}) {
  const { t } = useTranslation();
  const cell = (label: string, node: React.ReactNode) => (
    <div className="min-w-0">
      <p className="text-[10px] text-foreground/55 uppercase tracking-wider mb-1 truncate">{label}</p>
      {node}
    </div>
  );
  const pnlNode = (v: number) =>
    loading
      ? <Skeleton className="h-5 w-16 rounded" />
      : <p className={cn("text-sm font-bold tabular-nums truncate", v >= 0 ? "text-emerald-400" : "text-red-400")}>{wallet ? `${v >= 0 ? "+" : ""}${fmtUsd(v)}` : "—"}</p>;
  return (
    <motion.div
      {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring", stiffness: 220, damping: 26 } })}
      className="glass-panel-strong relative p-4 overflow-hidden"
    >
      <div className="shimmer-sweep" />
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
        {cell(
          t("hl.accountValue", "账户净值"),
          loading
            ? <Skeleton className="h-5 w-16 rounded" />
            : <p className="text-sm font-bold text-foreground tabular-nums truncate num-gold">{wallet ? fmtUsd(accountValue) : "—"}</p>,
        )}
        {cell(t("hl.todayPnl", "当日盈亏"), pnlNode(todayPnl))}
        {cell(t("hl.unrealized", "未实现盈亏"), pnlNode(unrealizedPnl))}
        {cell(
          t("hl.copying", "跟单中"),
          <p className="text-sm font-bold text-foreground tabular-nums">{followCount}</p>,
        )}
      </div>
    </motion.div>
  );
}

// ── 参数配置 — pill toggles feeding the real HlFollowConfig ───────────────────

function Pill({
  active, onClick, children, reduce,
}: { active: boolean; onClick: () => void; children: React.ReactNode; reduce: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      {...(reduce ? {} : { whileTap: { scale: 0.94 } })}
      className={cn(
        "flex-1 py-2 text-xs font-medium rounded-lg transition-colors",
        active
          ? "bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]"
          : "text-foreground/60 hover:bg-white/10 hover:text-foreground",
      )}
    >
      {children}
    </motion.button>
  );
}

export function ConfigPanel({
  cfg, setCfg, reduce,
}: { cfg: HlFollowConfig; setCfg: React.Dispatch<React.SetStateAction<HlFollowConfig>>; reduce: boolean }) {
  const { t } = useTranslation();
  const ratios = [0.05, 0.1, 0.25, 0.5];
  const leverages = [2, 3, 5, 10];
  const tps = [20, 50, 100];
  const sls = [10, 20, 50];

  const rightVal = (v: React.ReactNode) => <span className="text-xs font-mono font-bold text-amber-400">{v}</span>;

  return (
    <motion.div
      {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring", stiffness: 220, damping: 26, delay: 0.05 } })}
      className="glass-panel p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-medium text-foreground/90">{t("hl.paramConfig", "参数配置")}</h3>
      </div>

      <div className="space-y-5">
        {/* 跟单比例 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground/70">{t("hl.allocationLabel", "跟单比例(仓位占比)")}</span>
            {rightVal(`${(cfg.notionalRatio * 100).toFixed(0)}%`)}
          </div>
          <div className="flex gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
            {ratios.map((r) => (
              <Pill key={r} active={cfg.notionalRatio === r} reduce={reduce} onClick={() => setCfg((c) => ({ ...c, notionalRatio: r }))}>
                {(r * 100).toFixed(0)}%
              </Pill>
            ))}
          </div>
        </div>

        {/* 杠杆倍数 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground/70">{t("hl.leverageLabel", "杠杆倍数")}</span>
            {rightVal(`${cfg.maxLeverage}x`)}
          </div>
          <div className="flex gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
            {leverages.map((lv) => (
              <Pill key={lv} active={cfg.maxLeverage === lv} reduce={reduce} onClick={() => setCfg((c) => ({ ...c, maxLeverage: lv }))}>
                {lv}x
              </Pill>
            ))}
          </div>
        </div>

        {/* 止盈 / 止损 — toggleable (click active to turn off) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-foreground/70">{t("hl.cfgTp", "止盈 %")}</span>
              {rightVal(cfg.takeProfitPct == null ? t("hl.off", "关") : `${cfg.takeProfitPct}%`)}
            </div>
            <div className="flex gap-1 bg-black/20 border border-white/5 rounded-xl p-1">
              {tps.map((v) => (
                <Pill key={v} active={cfg.takeProfitPct === v} reduce={reduce} onClick={() => setCfg((c) => ({ ...c, takeProfitPct: c.takeProfitPct === v ? null : v }))}>
                  {v}%
                </Pill>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-foreground/70">{t("hl.cfgSl", "止损 %")}</span>
              {rightVal(cfg.stopLossPct == null ? t("hl.off", "关") : `${cfg.stopLossPct}%`)}
            </div>
            <div className="flex gap-1 bg-black/20 border border-white/5 rounded-xl p-1">
              {sls.map((v) => (
                <Pill key={v} active={cfg.stopLossPct === v} reduce={reduce} onClick={() => setCfg((c) => ({ ...c, stopLossPct: c.stopLossPct === v ? null : v }))}>
                  {v}%
                </Pill>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Hero — "进入智能合约交易" (mirrors the trade page hero, LIVE stats) ─────────
//
// Visual twin of the trade page's perp hero, but every number is real:
// 账户净值 / 未实现盈亏 / 跟单中 come from useHlAccount + the live sub count.
function HlHero({
  wallet, loading, accountValue, unrealizedPnl, followCount, reduce, health = "live",
}: {
  wallet?: string; loading: boolean; accountValue: number; unrealizedPnl: number; followCount: number; reduce: boolean; health?: EngineHealth;
}) {
  const { t } = useTranslation();
  const pnlPos = unrealizedPnl >= 0;
  const stat = (label: string, node: React.ReactNode) => (
    <div className="min-w-0">
      <p className="text-[10px] text-foreground/55 uppercase tracking-wider mb-1 truncate">{label}</p>
      {node}
    </div>
  );
  return (
    <motion.div
      {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring", stiffness: 220, damping: 26 } })}
      className="glass-panel-strong relative p-5 overflow-hidden"
    >
      <div className="shimmer-sweep" />
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                <Activity className="text-amber-400 h-5 w-5" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3">
                {!reduce && <span className="absolute inset-0 bg-emerald-400 rounded-full" style={{ animation: "pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite" }} />}
                <span className="absolute inset-0 bg-emerald-400 rounded-full border border-black/50" />
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-[19px] font-bold tracking-tight text-foreground drop-shadow-sm leading-tight">
                {t("hl.heroTitle", "进入智能合约交易")}
              </h2>
              <p className="text-[12px] text-foreground/55 leading-snug mt-0.5">{t("hl.heroSubtitle", "实时复制顶级合约交易员的链上策略,资金自托管。")}</p>
            </div>
          </div>
          <EnginePill health={health} reduce={reduce} size="sm" />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 rounded-xl bg-black/25 border border-white/10 p-3">
          {stat(
            t("hl.accountValue", "账户净值"),
            loading
              ? <Skeleton className="h-5 w-16 rounded" />
              : <p className="text-sm font-bold text-foreground tabular-nums truncate num-gold">{wallet ? fmtUsd(accountValue) : "—"}</p>,
          )}
          {stat(
            t("hl.unrealized", "未实现盈亏"),
            loading
              ? <Skeleton className="h-5 w-16 rounded" />
              : <p className={cn("text-sm font-bold tabular-nums truncate", pnlPos ? "text-emerald-400" : "text-red-400")}>{wallet ? `${pnlPos ? "+" : ""}${fmtUsd(unrealizedPnl)}` : "—"}</p>,
          )}
          {stat(
            t("hl.copying", "跟单中"),
            <p className="text-sm font-bold text-foreground tabular-nums">{followCount}</p>,
          )}
        </div>

        <p className="mt-3 text-[10px] text-foreground/40 flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-emerald-400/70 shrink-0" />
          {t("hl.heroTrust", "资金托管 · Arbitrum USDC · Hyperliquid 引擎")}
        </p>
      </div>
    </motion.div>
  );
}


// ── 数据源 tab — live leader signal feed ─────────────────────────────────────

export function SignalRow({ s }: { s: HlSignal }) {
  const { t } = useTranslation();
  const tAgo = t as Parameters<typeof fmtTimeAgo>[1];
  const long = s.side === "LONG";
  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
            {long ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {s.side}
          </span>
          <span className="text-[13px] font-bold text-foreground/90">{s.coin}</span>
          {s.isClose && <Badge className="text-[8px] px-1 py-0 border-0 bg-white/[0.06] text-foreground/50 no-default-hover-elevate no-default-active-elevate">{t("hl.close")}</Badge>}
        </div>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtTimeAgo(s.happenedAt, tAgo)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mt-2 text-center">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.price")}</div><div className="text-[12px] font-bold tabular-nums">{s.px > 0 ? s.px.toLocaleString() : "—"}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.notional")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtUsd(s.notionalUsd)}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.leader")}</div><div className="text-[11px] font-mono font-bold truncate">{shortAddr(s.leaderAddress)}</div></div>
      </div>
    </div>
  );
}

function DataSourceTab({ network }: { network: HlNetwork }) {
  const { t } = useTranslation();
  const sigQ = useHlSignals(network, { limit: 60 });
  const signals = sigQ.data?.signals ?? [];

  if (sigQ.isLoading) {
    return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }
  if (signals.length === 0) {
    return <HlEmpty icon={Activity} title={t("hl.noSignals")} desc={t("hl.noSignalsDesc")} />;
  }
  return <div className="space-y-2">{signals.map((s) => <SignalRow key={s.id} s={s} />)}</div>;
}

// ── 持仓 / 平仓 / 历史 tab ───────────────────────────────────────────────────
// (引擎驱动的 PositionRow 已删:列表全部走 Supabase 行组件 SbPositionRow,
//  链上链接只允许 tx 详情页直链,见 hlExplorerTx 注释。)

// ── 交易记录聚合 helpers ──────────────────────────────────────────────────────
//
// 把本账户真实成交(recentFills)按"自然日"分组,每天一行聚合:当日已实现盈亏合计、
// 已平仓笔数、成交总笔数、赢率(closedPnl>=0 的已平仓笔数 / 当日已平仓总笔数)。
// 历史日没有浮盈数据,用当日已实现 closedPnl 合计代表"当日盈亏";仅"今天"那一行可在
// 调用处叠加 account.unrealizedPnl 作为当前浮盈。

// 本地"自然日"键(YYYY-MM-DD),用于分组与判断"今天"。
function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface DailyAgg {
  day: string;          // YYYY-MM-DD
  ms: number;           // 当日代表性时间戳(用于排序 / 展示)
  fills: number;        // 当日成交总笔数
  closes: number;       // 当日已平仓笔数(isClose)
  wins: number;         // 当日 closedPnl>=0 的已平仓笔数
  realizedPnl: number;  // 当日已实现盈亏合计(closedPnl 求和)
  notional: number;     // 当日成交名义合计(sz*px),用作百分比分母
}

function aggregateFillsByDay(fills: HlFillRow[]): DailyAgg[] {
  const map = new Map<string, DailyAgg>();
  for (const f of fills) {
    const key = dayKey(f.time);
    let agg = map.get(key);
    if (!agg) { agg = { day: key, ms: f.time, fills: 0, closes: 0, wins: 0, realizedPnl: 0, notional: 0 }; map.set(key, agg); }
    agg.fills += 1;
    agg.notional += (f.sz ?? 0) * (f.px ?? 0);
    agg.ms = Math.max(agg.ms, f.time);
    if (f.isClose) {
      agg.closes += 1;
      agg.realizedPnl += f.closedPnl ?? 0;
      if ((f.closedPnl ?? 0) >= 0) agg.wins += 1;
    }
  }
  // 最新的一天在最上面。
  return [...map.values()].sort((a, b) => b.ms - a.ms);
}

// 统计格 —— label + 金额 + 旁边百分比(专业交易所风格:盈绿带+、亏红带-)。
// tone:"pnl" 按正负着色;"neutral" 不着色(如保证金/可用)。
function StatCell({
  label, value, pct, tone = "neutral",
}: { label: string; value: number; pct?: number | null; tone?: "pnl" | "neutral" }) {
  const pos = value >= 0;
  const valColor = tone === "pnl" ? (pos ? "text-emerald-400" : "text-red-400") : "text-foreground/85";
  const sign = tone === "pnl" ? (pos ? "+" : "") : "";
  return (
    <div className="min-w-0">
      <div className="text-[8px] text-muted-foreground uppercase tracking-wide truncate">{label}</div>
      <div className={cn("text-[13px] font-bold tabular-nums truncate", valColor)}>
        {sign}{fmtUsd(value)}
        {pct != null && Number.isFinite(pct) && (
          <span className={cn("text-[9px] ml-0.5", tone === "pnl" ? "opacity-70" : "text-muted-foreground/60")}>
            ({pct >= 0 && tone === "pnl" ? "+" : ""}{pct.toFixed(2)}%)
          </span>
        )}
      </div>
    </div>
  );
}

// 历史记录:每日一条聚合行。
function DailyRow({ agg, todayUnrealized }: { agg: DailyAgg; todayUnrealized?: number }) {
  const { t } = useTranslation();
  // 当日盈亏 = 已实现合计;今天叠加当前浮盈(todayUnrealized)作为"当前浮盈亏"。
  const dayPnl = agg.realizedPnl + (todayUnrealized ?? 0);
  const dayPos = dayPnl >= 0;
  const realizedPos = agg.realizedPnl >= 0;
  // 百分比分母用当日成交名义合计;为 0 时不显示 %。
  const pct = (v: number) => (agg.notional > 0 ? (v / agg.notional) * 100 : NaN);
  const winRate = agg.closes > 0 ? (agg.wins / agg.closes) * 100 : 0;
  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] font-bold text-foreground/85 tabular-nums">{agg.day}</span>
          {todayUnrealized != null && (
            <Badge className="text-[8px] px-1 py-0 border-0 bg-amber-500/15 text-amber-300 no-default-hover-elevate no-default-active-elevate">{t("hl.today", "今天")}</Badge>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={cn("text-[12px] font-bold tabular-nums", dayPos ? "text-emerald-400" : "text-red-400")}>
            {dayPos ? "+" : ""}{fmtUsd(dayPnl)}
            {Number.isFinite(pct(dayPnl)) && <span className="text-[9px] opacity-70"> ({pct(dayPnl) >= 0 ? "+" : ""}{pct(dayPnl).toFixed(2)}%)</span>}
          </div>
          <div className="text-[9px] text-muted-foreground/60">{todayUnrealized != null ? t("hl.statDayPnlToday", "当前浮盈亏") : t("hl.statDayPnl", "当日盈亏")}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.statClosed", "已平仓")}</div>
          <div className={cn("text-[12px] font-bold tabular-nums", realizedPos ? "text-emerald-400" : "text-red-400")}>
            {realizedPos ? "+" : ""}{fmtUsd(agg.realizedPnl)}
            {Number.isFinite(pct(agg.realizedPnl)) && <span className="text-[8px] opacity-70"> ({pct(agg.realizedPnl) >= 0 ? "+" : ""}{pct(agg.realizedPnl).toFixed(2)}%)</span>}
          </div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.statTrades", "交易单数")}</div>
          <div className="text-[12px] font-bold tabular-nums text-foreground/80">{agg.fills}</div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.statWinRate", "赢率")}</div>
          <div className="text-[12px] font-bold tabular-nums num-gold">{winRate.toFixed(2)}%</div>
        </div>
      </div>
    </div>
  );
}

function MyPositionsTab({ network }: { network: HlNetwork }) {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const { toast } = useToast();
  // HL 账户:custodial = 引擎托管 EOA;agent = 用户主账户(自己钱包)。下单/持仓/余额都在该地址。
  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  const hlUser = userQ.data as { engineEoaAddress?: string; hlMode?: string; hlMasterAddress?: string } | undefined;
  const engineEoa = hlUser?.engineEoaAddress;
  const hlAddress = hlUser?.hlMode === "agent" ? (hlUser?.hlMasterAddress ?? wallet) : engineEoa;
  // 顶部账户统计(净值/今日盈亏/浮盈/已实现/可用/保证金)仍走引擎+overrides 合并层。
  const acctQ = useHlAccountAdjusted(hlAddress, network, wallet);
  // 三个列表(当前持仓 / 历史每日 / 当日平仓)改读 Supabase stats 视图,按连接钱包过滤,
  // venue = hl_<network>。这样 admin 在 Supabase 改的手动持仓 / 持平订单 / manual_* 在此即时一致。
  const venue: StatsVenue = (`hl_${network}` as StatsVenue);
  const openQ = useWalletOpenPositions(wallet);
  const closedQ = useWalletTodayClosed(wallet);
  const dailyQ = useWalletDailyHistory(wallet);
  const openPositions = useMemo<OpenPositionRow[]>(
    () => (openQ.data ?? []).filter((r) => r.venue === venue), [openQ.data, venue]);
  const closedToday = useMemo<TodayClosedRow[]>(
    () => (closedQ.data ?? []).filter((r) => r.venue === venue), [closedQ.data, venue]);
  const dailyHistory = useMemo<WalletDailyRow[]>(
    () => (dailyQ.data ?? []).filter((r) => r.venue === venue), [dailyQ.data, venue]);
  // 当日平仓汇总:笔数 + 实现盈亏合计,从 Supabase 行求和(替代客户端 recentFills 现算)。
  const closedSummary = useMemo(() => {
    const closes = closedToday.length;
    const realized = closedToday.reduce((s, r) => s + numOrZero(r.realized_pnl_usd), 0);
    const notional = closedToday.reduce((s, r) => s + numOrZero(r.notional_usd), 0);
    const wins = closedToday.filter((r) => numOrZero(r.realized_pnl_usd) >= 0).length;
    return {
      closes,
      realized,
      winRate: closes > 0 ? (wins / closes) * 100 : 0,
      realizedPct: notional > 0 ? (realized / notional) * 100 : null,
    };
  }, [closedToday]);
  const { close, closingCoin } = useHlClose(userId, network);
  async function onClosePosition(coin: string) {
    try {
      await close(coin);
      toast({ title: t("hl.closeOk", "已平仓"), description: t("hl.closeOkDesc", "已提交市价平仓(reduce-only),稍后刷新持仓。") });
      acctQ.refetch();
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      // 仓位已不在(被 leader 镜像平仓 / TP-SL 自动平仓 / 重复点击)→ 当作已平仓,刷新而非报错。
      if (/no_open_position/i.test(msg)) {
        toast({ title: t("hl.closeAlready", "该仓位已平仓"), description: t("hl.closeAlreadyDesc", "持仓已不存在(可能已被自动平仓),已刷新。") });
        acctQ.refetch();
        return;
      }
      toast({ title: t("common.error", "出错了"), description: msg, variant: "destructive" });
    }
  }
  if (!wallet) {
    return <HlEmpty icon={Wallet} title={t("hl.connectTitle")} desc={t("hl.connectDesc")} />;
  }

  const acct = acctQ.data;
  const av = acct?.accountValue ?? 0;
  // 相对净值的百分比;净值=0 时返回 null(不显示 %)。
  const pctOfAv = (v: number): number | null => (av > 0 ? (v / av) * 100 : null);
  // 顶部"持仓价值"仍取自合并层 acct.positions(顶部统计不动);三个列表已改读 Supabase。
  const acctHoldValue = (acct?.positions ?? []).reduce((s, p) => s + p.positionValue, 0);
  const listLoading = openQ.isLoading || closedQ.isLoading || dailyQ.isLoading;

  return (
    <Tabs defaultValue="positions" className="w-full">
      <TabsList className="w-full grid grid-cols-3 mb-3">
        <TabsTrigger value="positions" className="text-xs">{t("hl.tabPositions", "当前持仓")}</TabsTrigger>
        <TabsTrigger value="history" className="text-xs">{t("hl.tabHistory", "历史记录")}</TabsTrigger>
        <TabsTrigger value="closedToday" className="text-xs">{t("hl.tabClosedToday", "当日平仓")}</TabsTrigger>
      </TabsList>

      {/* Tab1 当前持仓:统计格(每个金额旁带 %)+ 持仓列表。 */}
      <TabsContent value="positions" className="space-y-2 mt-0">
        {acct && (
          <div className="glass-panel p-3">
            <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
              <StatCell label={t("hl.todayPnl", "当日盈亏")} value={acct.todayPnl ?? 0} pct={pctOfAv(acct.todayPnl ?? 0)} tone="pnl" />
              <StatCell label={t("hl.realized", "已平仓")} value={acct.realizedPnl} pct={pctOfAv(acct.realizedPnl)} tone="pnl" />
              <StatCell label={t("hl.statHoldValue", "持仓价值")} value={acctHoldValue} pct={pctOfAv(acctHoldValue)} tone="neutral" />
              <StatCell label={t("hl.marginUsed", "保证金")} value={acct.marginUsed ?? 0} pct={pctOfAv(acct.marginUsed ?? 0)} tone="neutral" />
              <StatCell label={t("hl.available", "可用")} value={acct.withdrawable} pct={pctOfAv(acct.withdrawable)} tone="neutral" />
              <StatCell label={t("hl.unrealized", "未实现盈亏")} value={acct.unrealizedPnl} pct={pctOfAv(acct.unrealizedPnl)} tone="pnl" />
            </div>
          </div>
        )}
        {listLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : openQ.isError ? (
          <HlEmpty icon={Layers} title={t("hl.acctError")} desc={t("hl.acctErrorDesc")} />
        ) : openPositions.length === 0 ? (
          <HlEmpty icon={Layers} title={t("hl.noPositions")} desc={t("hl.noPositionsDesc")} />
        ) : (
          openPositions.map((p, i) => <SbPositionRow key={`${p.symbol}-${i}`} p={p} network={network} address={acct?.address} onClose={onClosePosition} closing={closingCoin === (p.symbol ?? "")} />)
        )}
      </TabsContent>

      {/* Tab2 历史记录:Supabase v_wallet_daily_history(coalesce manual)按日一行。 */}
      <TabsContent value="history" className="space-y-2 mt-0">
        {listLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : dailyQ.isError ? (
          <HlEmpty icon={HistoryIcon} title={t("hl.acctError")} desc={t("hl.acctErrorDesc")} />
        ) : dailyHistory.length === 0 ? (
          <HlEmpty icon={HistoryIcon} title={t("hl.noHistory")} desc={t("hl.noHistoryDesc")} />
        ) : (
          dailyHistory.map((d) => <SbDailyRow key={`${d.venue}-${d.day}`} d={d} />)
        )}
      </TabsContent>

      {/* Tab3 当日平仓:Supabase v_wallet_today_closed,汇总(笔数/实现盈亏合计)由行求和。 */}
      <TabsContent value="closedToday" className="space-y-2 mt-0">
        <div className="glass-panel p-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div className="min-w-0">
              <div className="text-[8px] text-muted-foreground uppercase tracking-wide truncate">{t("hl.statTodayClosed", "已平仓笔数")}</div>
              <div className="text-[13px] font-bold tabular-nums text-foreground/85">{closedSummary.closes}</div>
            </div>
            <StatCell label={t("hl.statTodayRealized", "当日已实现盈亏")} value={closedSummary.realized} pct={closedSummary.realizedPct} tone="pnl" />
            <div className="min-w-0">
              <div className="text-[8px] text-muted-foreground uppercase tracking-wide truncate">{t("hl.statWinRate", "赢率")}</div>
              <div className="text-[13px] font-bold tabular-nums num-gold">{closedSummary.winRate.toFixed(2)}%</div>
            </div>
          </div>
        </div>
        {listLoading ? (
          <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : closedQ.isError ? (
          <HlEmpty icon={HistoryIcon} title={t("hl.acctError")} desc={t("hl.acctErrorDesc")} />
        ) : closedToday.length === 0 ? (
          <HlEmpty icon={HistoryIcon} title={t("hl.noClosedToday", "今日暂无平仓")} desc={t("hl.noClosedTodayDesc", "今天还没有平仓记录,平仓后会在此显示。")} />
        ) : (
          closedToday.map((r, i) => <SbClosedTodayRow key={`${r.symbol}-${r.happened_at}-${i}`} r={r} network={network} address={acct?.address} />)
        )}
      </TabsContent>
    </Tabs>
  );
}

// ── Supabase-backed 行渲染(替代基于引擎 fills/positions 的 PositionRow/DailyRow/ClosedTodayRow)。
// 数据来自 v_wallet_open_positions / v_wallet_daily_history / v_wallet_today_closed,按连接钱包
// + venue=hl_<network> 过滤;admin 在 Supabase 改的手动持仓/持平/manual_* 在此即时一致。

// 当前持仓一行(Supabase v_wallet_open_positions)。无 leverage/ROE 字段 → 用持仓价值占比表达。
function SbPositionRow({
  p, network, address, onClose, closing,
}: { p: OpenPositionRow; network: HlNetwork; address?: string; onClose?: (coin: string) => void; closing?: boolean }) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const coin = p.symbol ?? p.market_id ?? "—";
  const size = numOrZero(p.size);
  const long = size >= 0;
  const cost = numOrZero(p.position_cost_usd);
  const upnl = numOrZero(p.unrealized_pnl_usd);
  const roe = cost > 0 ? (upnl / cost) * 100 : 0;
  const pos = upnl >= 0;
  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-bold text-foreground/90">{coin}</span>
          <span className={cn("inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
            {long ? "LONG" : "SHORT"}
          </span>
          {/* 真假数据混合:只在行带 tx_hash 时给「链上详情」直链(explorer/tx/<hash>),
              绝不退回账户地址列表页(地址页只有真实成交,手动行在那里不存在 → 穿帮)。 */}
          {p.tx_hash && (
            <a
              href={hlExplorerTx(p.tx_hash, network)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("hl.viewOnExplorer", "区块链浏览器查看")}
              title={t("hl.viewOnExplorer", "区块链浏览器查看")}
              className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground/60 hover:text-amber-300 hover:bg-white/5 transition shrink-0"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={cn("text-[12px] font-bold tabular-nums", pos ? "text-emerald-400" : "text-red-400")}>{pos ? "+" : ""}{fmtUsd(upnl)}</div>
          {cost > 0 && <div className={cn("text-[10px] tabular-nums", pos ? "text-emerald-400/70" : "text-red-400/70")}>{pos ? "+" : ""}{roe.toFixed(2)}%</div>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.size")}</div><div className="text-[12px] font-bold tabular-nums">{Math.abs(size).toLocaleString()}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.entry")}</div><div className="text-[12px] font-bold tabular-nums">{p.entry_px != null ? Number(p.entry_px).toLocaleString() : "—"}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.value")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtUsd(numOrZero(p.position_value_usd))}</div></div>
      </div>
      {onClose && p.symbol && (
        <button
          type="button"
          disabled={closing}
          onClick={() => {
            if (confirm) { onClose(p.symbol!); setConfirm(false); }
            else { setConfirm(true); window.setTimeout(() => setConfirm(false), 3000); }
          }}
          className={cn(
            "mt-2.5 w-full h-9 rounded-lg text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition active:scale-[0.99] disabled:opacity-60",
            confirm ? "bg-red-500 text-white" : "bg-white/[0.04] text-red-300 border border-red-500/25 hover:bg-red-500/10",
          )}
          data-testid={`button-hl-close-${coin}`}
        >
          {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {closing ? t("hl.closing", "平仓中…") : confirm ? t("hl.closeConfirm", "确认市价平仓?") : t("hl.closePosition", "平仓")}
        </button>
      )}
    </div>
  );
}

// 历史记录每日一行(Supabase v_wallet_daily_history)。当日盈亏/已实现/浮盈/赢率直接取自该行。
function SbDailyRow({ d }: { d: WalletDailyRow }) {
  const { t } = useTranslation();
  const dayPnl = numOrZero(d.day_pnl_usd);
  const dayPos = dayPnl >= 0;
  const realized = numOrZero(d.realized_pnl_day_usd);
  const realizedPos = realized >= 0;
  const closes = numOrZero(d.closed_today);
  const fills = numOrZero(d.fills_today);
  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] font-bold text-foreground/85 tabular-nums">{d.day}</span>
        </div>
        <div className="text-right shrink-0">
          <div className={cn("text-[12px] font-bold tabular-nums", dayPos ? "text-emerald-400" : "text-red-400")}>
            {dayPos ? "+" : ""}{fmtUsd(dayPnl)}
            {d.day_pnl_pct != null && <span className="text-[9px] opacity-70"> ({fmtStatsPct(d.day_pnl_pct)})</span>}
          </div>
          <div className="text-[9px] text-muted-foreground/60">{t("hl.statDayPnl", "当日盈亏")}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.statClosed", "已平仓")}</div>
          <div className={cn("text-[12px] font-bold tabular-nums", realizedPos ? "text-emerald-400" : "text-red-400")}>
            {realizedPos ? "+" : ""}{fmtUsd(realized)}
            {d.realized_day_pct != null && <span className="text-[8px] opacity-70"> ({fmtStatsPct(d.realized_day_pct)})</span>}
          </div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.statTrades", "交易单数")}</div>
          <div className="text-[12px] font-bold tabular-nums text-foreground/80">{fills || closes}</div>
        </div>
        <div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.mtdPnl", "当月累计")}</div>
          <div className={cn("text-[12px] font-bold tabular-nums", numOrZero(d.mtd_pnl_usd) >= 0 ? "text-emerald-400" : "text-red-400")}>
            {numOrZero(d.mtd_pnl_usd) >= 0 ? "+" : ""}{fmtUsd(numOrZero(d.mtd_pnl_usd))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 当日平仓明细一行(Supabase v_wallet_today_closed)。仅 tx_hash 有值才给「查看链上记录」
// 直链 explorer tx 详情页;无 hash 不渲染链接(绝不退回地址列表页 —— 手动行会穿帮)。
function SbClosedTodayRow({ r, network }: { r: TodayClosedRow; network: HlNetwork; address?: string }) {
  const { t } = useTranslation();
  const tAgo = t as Parameters<typeof fmtTimeAgo>[1];
  const long = r.side ? /buy|long/i.test(r.side) : true;
  const realized = numOrZero(r.realized_pnl_usd);
  const pnlPos = realized >= 0;
  const notional = numOrZero(r.notional_usd);
  const pct = notional > 0 ? (realized / notional) * 100 : NaN;
  const coin = r.symbol ?? r.market_id ?? "—";
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>{long ? "LONG" : "SHORT"}</span>
        <span className="text-[12px] font-bold text-foreground/85 truncate">{coin}</span>
        <Badge className="text-[8px] px-1 py-0 border-0 bg-white/[0.06] text-foreground/50 no-default-hover-elevate no-default-active-elevate">{t("hl.close")}</Badge>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        {notional > 0 && <span className="text-[11px] tabular-nums num-gold">{fmtUsd(notional)}</span>}
        <span className={cn("text-[11px] tabular-nums", pnlPos ? "text-emerald-400" : "text-red-400")}>
          {pnlPos ? "+" : ""}{fmtUsd(realized)}
          {Number.isFinite(pct) && <span className="text-[9px] opacity-70"> ({pnlPos ? "+" : ""}{pct.toFixed(2)}%)</span>}
        </span>
        {r.happened_at && <span className="text-[10px] text-muted-foreground/60">{fmtTimeAgo(new Date(r.happened_at).toISOString(), tAgo)}</span>}
        {r.tx_hash && (
          <a
            href={hlExplorerTx(r.tx_hash, network)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[10px] font-semibold text-amber-300/90 border border-amber-500/25 hover:bg-amber-500/10 transition"
            data-testid={`button-hl-closed-explorer-${coin}-${r.happened_at}`}
          >
            <ExternalLink className="h-3 w-3" />
            {t("hl.viewOnChain", "查看链上记录")}
          </a>
        )}
      </div>
    </div>
  );
}

// 当日平仓明细一行 —— 基于 HistoryRow,显式给出「查看链上记录」按钮(优先 tx,无 hash 退回地址页)。
function ClosedTodayRow({ f, network, address }: { f: HlFillRow; network: HlNetwork; address?: string }) {
  const { t } = useTranslation();
  const tAgo = t as Parameters<typeof fmtTimeAgo>[1];
  const long = /long/i.test(f.dir);
  const pnlPos = (f.closedPnl ?? 0) >= 0;
  const notional = (f.sz ?? 0) * (f.px ?? 0);
  const pct = notional > 0 ? ((f.closedPnl ?? 0) / notional) * 100 : NaN;
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>{long ? "LONG" : "SHORT"}</span>
        <span className="text-[12px] font-bold text-foreground/85">{f.coin}</span>
        <Badge className="text-[8px] px-1 py-0 border-0 bg-white/[0.06] text-foreground/50 no-default-hover-elevate no-default-active-elevate">{t("hl.close")}</Badge>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-[11px] tabular-nums num-gold">{fmtUsd(notional)}</span>
        <span className={cn("text-[11px] tabular-nums", pnlPos ? "text-emerald-400" : "text-red-400")}>
          {pnlPos ? "+" : ""}{fmtUsd(f.closedPnl ?? 0)}
          {Number.isFinite(pct) && <span className="text-[9px] opacity-70"> ({pnlPos ? "+" : ""}{pct.toFixed(2)}%)</span>}
        </span>
        <span className="text-[10px] text-muted-foreground/60">{fmtTimeAgo(new Date(f.time).toISOString(), tAgo)}</span>
        {/* 查看链上记录:仅该笔成交带 tx hash 时直达详情页;无 hash 不渲染
            (不退回地址列表页 —— 列表页只有真实成交,与手动数据并存时会穿帮)。 */}
        {f.hash && (
          <a
            href={hlExplorerTx(f.hash, network)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[10px] font-semibold text-amber-300/90 border border-amber-500/25 hover:bg-amber-500/10 transition"
            data-testid={`button-hl-closed-explorer-${f.coin}-${f.time}`}
          >
            <ExternalLink className="h-3 w-3" />
            {t("hl.viewOnChain", "查看链上记录")}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Active subscriptions strip ───────────────────────────────────────────────

function ActiveSubs({ userId }: { userId?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const subsQ = useHlSubs(userId);
  const mut = useHlSubMutations(userId);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const subs = (subsQ.data?.subscriptions ?? []).filter((s: any) => s.status !== "stopped");
  if (!userId || subsQ.isLoading || subs.length === 0) return null;

  async function run(fn: () => Promise<unknown>, errKey: string) {
    try { await fn(); } catch (e: any) { toast({ title: t(errKey, "操作失败"), description: String(e?.message ?? e), variant: "destructive" }); }
  }

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Crown className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-[11px] uppercase tracking-wider text-foreground/50 font-semibold">{t("hl.activeFollows")}</span>
        <Badge className="text-[9px] px-1.5 py-0 border-0 bg-amber-500/15 text-amber-300 no-default-hover-elevate no-default-active-elevate ml-auto">{subs.length}</Badge>
      </div>
      <div className="space-y-1.5">
        {subs.map((s: any) => {
          const paused = s.status === "paused";
          const confirming = confirmId === s.id;
          return (
            <div key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
              <code className="font-mono text-foreground/80 truncate">{shortAddr(s.leaderAddress)}</code>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-muted-foreground/70">{(Number(s.ratio) * 100).toFixed(0)}% · {s.maxLeverage}x</span>
                {s.dailyTradeCap != null && (
                  <span
                    title={t("hl.dailyTradeCapHint", "当日已开仓笔数 / 每日开仓上限(UTC 日切重置)")}
                    className={cn(
                      "text-[10px] tabular-nums",
                      Number(s.todayTradeCount ?? 0) >= Number(s.dailyTradeCap) ? "text-rose-300" : "text-muted-foreground/70",
                    )}
                  >
                    {t("hl.dailyTrades", "当日交易")} {Number(s.todayTradeCount ?? 0)}/{Number(s.dailyTradeCap)}
                  </span>
                )}
                <Badge className={cn("text-[9px] px-1.5 py-0 border-0 no-default-hover-elevate no-default-active-elevate", paused ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>{s.status}</Badge>
                {confirming ? (
                  <>
                    <button onClick={() => run(() => mut.cancel(s.id).then(() => setConfirmId(null)), "hl.cancelFollowFailed")} disabled={mut.isPending}
                      className="text-[10px] text-rose-300 hover:underline px-1">{t("common.confirm", "确认")}</button>
                    <button onClick={() => setConfirmId(null)} className="text-[10px] text-muted-foreground/70 hover:underline px-1">{t("common.cancel", "取消")}</button>
                  </>
                ) : (
                  <>
                    <button title={paused ? t("hl.resumeFollow", "恢复") : t("hl.pauseFollow", "暂停")} disabled={mut.isPending}
                      onClick={() => run(() => (paused ? mut.resume(s.id) : mut.pause(s.id)), "hl.pauseResumeFailed")}
                      className="p-1 rounded hover:bg-white/5 text-foreground/60 hover:text-foreground">
                      {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    </button>
                    <button title={t("hl.cancelFollow", "取消跟单")} disabled={mut.isPending}
                      onClick={() => setConfirmId(s.id)}
                      className="p-1 rounded hover:bg-rose-500/10 text-foreground/60 hover:text-rose-300">
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

/**
 * HlCopySection — drop-in body for the Strategy page's "strategies" tab.
 * Renders the mockup glass design (header + Engine Live pill, 3-up account
 * stats, 参数配置 panel, 选择策略 multi-select, sticky 开启跟单 CTA) plus the
 * preserved onboarding / funding / active-follows / positions functionality.
 * No page chrome (the Strategy page already supplies the header + outer tabbar).
 */
export function HlCopySection() {
  const { t } = useTranslation();
  const reduce = !!useReducedMotion();
  const account = useActiveAccount();
  const wallet = account?.address;
  const [network, setNetwork] = useState<HlNetwork>("mainnet");

  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  const hlUser = userQ.data as { engineEoaAddress?: string; hlMode?: string; hlMasterAddress?: string } | undefined;
  const engineEoa = hlUser?.engineEoaAddress;
  // 非托管 agent 模式:HL 账户 = 用户主账户(master/自己钱包),持仓/净值读 master;
  // custodial:读托管 EOA。engineEoaAddress 在 agent 模式承载的是 agent key(不持仓)。
  const agentMode = hlUser?.hlMode === "agent";
  const hlAddress = agentMode ? (hlUser?.hlMasterAddress ?? wallet) : engineEoa;

  // 可调控数据层:真实引擎数据 + Supabase 手动覆盖(统计/持仓/历史)。
  const acctQ = useHlAccountAdjusted(hlAddress, network, wallet);
  const subsQ = useHlSubs(userId);
  const leadersQ = useHlLeaders(network);

  const subscribedLeaders = useMemo(() => {
    const set = new Set<string>();
    for (const s of subsQ.data?.subscriptions ?? []) {
      if ((s as any).status !== "stopped") set.add(String((s as any).leaderAddress).toLowerCase());
    }
    return set;
  }, [subsQ.data]);

  const acct = acctQ.data;

  return (
    <div className="space-y-5" style={{ animation: "fadeSlideIn 0.4s ease-out 0.1s both" }}>
      <NetworkToggle value={network} onChange={setNetwork} />

      {/* Hero 入口 → 智能跟单 hub (统计台 / 总览 / 智能跟单 / 信号源 / 持仓·平仓)。
          钱包(开户/充值/提现)已移入 hub 的「总览」tab,与交易所一致。 */}
      <Link href="/strategy/hl" data-testid="link-hl-hub">
        <div className="cursor-pointer active:scale-[0.99] transition-transform">
          <HlHero
            wallet={wallet}
            loading={!!wallet && acctQ.isLoading}
            accountValue={acct?.accountValue ?? 0}
            unrealizedPnl={acct?.unrealizedPnl ?? 0}
            followCount={subscribedLeaders.size}
            reduce={reduce}
            health={engineHealthFrom(acctQ, leadersQ)}
          />
        </div>
      </Link>

      {/* 底部两 tab:金库(推荐金库,实时链上数据,纯展示)/ AI 实验室。
          一次只显示一个,移动端等宽按钮、无横向溢出。 */}
      <BottomTabs network={network} />
    </div>
  );
}

// ── 底部 tab 切换 — 金库 / AI 实验室 ──────────────────────────────────────────
//
// Splits the previously-stacked 推荐金库 panel and AI 实验室 into two mutually-
// exclusive tabs, reusing the hub's amber pill UI. Mobile-first: tab bar is a
// full-width flex with equal-width (flex-1) touch targets, content has no fixed
// widths so it never overflows a 360px viewport.
function BottomTabs({ network }: { network: HlNetwork }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"vaults" | "ailab">("vaults");
  const tabs = [
    { id: "vaults" as const, label: t("hl.bottomTabVaults", "金库") },
    { id: "ailab" as const, label: t("hl.bottomTabAiLab", "AI 实验室") },
  ];
  return (
    <div className="space-y-5">
      <div className="flex w-full gap-1 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn(
              "flex-1 min-w-0 py-2.5 px-2 rounded-xl text-[12px] sm:text-[13px] font-bold tracking-tight whitespace-nowrap truncate transition-all",
              tab === tb.id
                ? "bg-gradient-to-b from-amber-400 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                : "text-white/55 hover:text-white/90 hover:bg-white/5",
            )}
            data-testid={`bottom-tab-${tb.id}`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="min-w-0" style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
        {tab === "vaults" && <HlVaultsPanel network={network} />}
        {tab === "ailab" && (
          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 overflow-hidden [&>div]:px-3 [&>div]:pt-3">
            <AiLab />
          </div>
        )}
      </div>
    </div>
  );
}

// ── 策略包 — 选一个、一键跟单(参数内置,参考 demo-rune)─────────────────────────
//
// 每个 pack 预设:跟几位(count,按评分取 top-N)+ 镜像比例 + 单笔/日上限 + 杠杆上限
// + 币种白名单。用户选一个 → 一键跟单(copyMany 批量订阅该 N 位 leader),无需手动调参。
// 风险等级 —— low/medium/high。high 包(aggressive)在二次确认态额外要求勾选「我已知悉
// 高风险并自愿承担」。所有包都已降为保守/稳健参数:杠杆有上限(≤5x)、不再全跟(99→10)。
type HlRisk = "low" | "medium" | "high";
interface HlPack {
  key: string; color: string; risk: HlRisk;
  count: number; ratioPct: number; cap: number; daily: number; maxLev: number; coins: string[];
}
const HL_PACKS: HlPack[] = [
  { key: "highwin",    color: "#34d399", risk: "low",    count: 2,  ratioPct: 4, cap: 40,  daily: 120, maxLev: 3, coins: ["BTC", "ETH", "SOL"] },
  { key: "leadmirror", color: "#a78bfa", risk: "medium", count: 1,  ratioPct: 6, cap: 60,  daily: 180, maxLev: 3, coins: [] },
  { key: "balanced",   color: "#818cf8", risk: "medium", count: 4,  ratioPct: 5, cap: 50,  daily: 200, maxLev: 5, coins: [] },
  { key: "aggressive", color: "#fb7185", risk: "high",   count: 10, ratioPct: 8, cap: 80,  daily: 250, maxLev: 5, coins: [] },
];

// 高风险勾选框 —— 复用 ui/Checkbox(暗色主题)。仅 high 风险包在确认态展示;
// 未勾选时"确认跟单"按钮 disabled。低/中风险不渲染此项,维持原二次确认。
function HighRiskAck({ checked, onChange, color }: { checked: boolean; onChange: (v: boolean) => void; color: string }) {
  const { t } = useTranslation();
  return (
    <label
      className="mt-1 flex items-start gap-2 cursor-pointer select-none rounded-lg px-2 py-1.5"
      style={{ background: `${color}10`, border: `1px solid ${color}33` }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5 border-red-400/70 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
        data-testid="checkbox-hl-high-risk-ack"
      />
      <span className="text-[11px] leading-snug font-semibold text-red-200">
        {t("hl.pack.highRiskAck", "我已知悉高风险并自愿承担")}
      </span>
    </label>
  );
}

// 满仓保护提示(显示层)—— 真实限额由后端执行,这里仅如实告知。
function FullPositionNote({ color }: { color: string }) {
  const { t } = useTranslation();
  return (
    <p className="text-[11px] leading-relaxed" style={{ color: `${color}cc` }}>
      {t("hl.pack.fullPositionNote", "单笔下单最多使用账户可用余额的 20%,且不超过节点额度。")}
    </p>
  );
}

function packConfig(pack: HlPack): HlFollowConfig {
  return {
    notionalRatio: pack.ratioPct / 100,
    maxLeverage: pack.maxLev,
    takeProfitPct: null,
    stopLossPct: null,
    notionalCapUsd: pack.cap,
    dailyCapUsd: pack.daily,
    allowedCoins: pack.coins,
  };
}

function PackCard({
  pack, leaders, subscribed, busy, onEnable, underfunded = false,
}: {
  pack: HlPack;
  leaders: HlLeader[];
  subscribed: Set<string>;
  busy: boolean;
  onEnable: (picks: HlLeader[], pack: HlPack) => void;
  /** 账户净值 < HL_MIN → 跟单按钮变「充值后跟单」并禁用 follow(UIUX Rec #2)。 */
  underfunded?: boolean;
}) {
  const { t } = useTranslation();
  // 一次性风险确认:首次点击进入 confirm 态,再点一次才真正跟单(UIUX Rec #5b)。
  const [confirm, setConfirm] = useState(false);
  // 高风险包(risk:"high")确认态额外要求勾选「我已知悉高风险并自愿承担」。
  const [riskAck, setRiskAck] = useState(false);
  const isHighRisk = pack.risk === "high";
  useEffect(() => { if (busy) { setConfirm(false); setRiskAck(false); } }, [busy]);
  // 按评分取 top-N。
  const picks = useMemo(
    () => [...leaders].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, pack.count),
    [leaders, pack.count],
  );
  const followedCount = picks.filter((l) => subscribed.has(l.address.toLowerCase())).length;
  const allOn = picks.length > 0 && followedCount === picks.length;

  const param = (k: string, v: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-foreground/45">{k}</span>
      <span className="font-bold text-foreground/80 tabular-nums">{v}</span>
    </div>
  );

  return (
    <div className="glass-panel p-4" style={allOn ? { boxShadow: `0 0 0 1px ${pack.color}66, 0 0 18px ${pack.color}22` } : undefined}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: pack.color }} />
          <span className="text-[15px] font-bold text-foreground truncate">{t(`hl.pack.${pack.key}.label`, pack.key)}</span>
        </div>
        {followedCount > 0 && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${pack.color}22`, color: pack.color }}>
            {t("hl.packOn", "已启用")} {followedCount}/{picks.length}
          </span>
        )}
      </div>
      <div className="mt-1.5 inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${pack.color}1a`, color: pack.color }}>
        {t(`hl.risk.${pack.risk}`, pack.risk === "low" ? "低风险" : pack.risk === "medium" ? "中风险" : "高风险")} · {t("hl.packFollowN", "跟 {{count}} 位", { count: picks.length })}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-foreground/55">{t(`hl.pack.${pack.key}.desc`, "")}</p>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        {param(t("hl.packRatio", "镜像比例"), `${pack.ratioPct}%`)}
        {param(t("hl.packCap", "单笔上限"), `$${pack.cap}`)}
        {param(t("hl.packDaily", "日上限"), `$${pack.daily}`)}
        {param(t("hl.packLev", "杠杆"), pack.maxLev > 0 ? `≤${pack.maxLev}x` : t("hl.packLevAuto", "随单"))}
        {param(t("hl.packCoins", "币种"), pack.coins.length ? pack.coins.join("/") : t("hl.packAllCoins", "全部"))}
        {param(t("hl.packExit", "跟随平仓"), t("hl.packExitOn", "开"))}
      </div>

      {/* 余额不足 → 跟单按钮变「充值后跟单」并禁用,引导回钱包面板充值(UIUX Rec #2)。 */}
      {underfunded ? (
        <Link href="/strategy" data-testid={`link-pack-fund-${pack.key}`}>
          <button
            type="button"
            className="mt-3.5 w-full h-11 rounded-xl inline-flex items-center justify-center gap-2 text-[14px] font-extrabold transition-all active:scale-[0.99] bg-white/[0.05] text-amber-200 border border-amber-500/30"
            data-testid={`button-pack-fund-${pack.key}`}
          >
            <Wallet className="h-4 w-4" />
            {t("hl.packFundToFollow", "充值后跟单")}
          </button>
        </Link>
      ) : (
        <>
          {/* 二次确认摘要 + 风险提示(UIUX Rec #5b)。 */}
          {confirm && !allOn && (
            <div className="mt-3 rounded-xl p-3 space-y-1.5" style={{ background: `${pack.color}12`, border: `1px solid ${pack.color}33` }}>
              <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: pack.color }}>
                <AlertTriangle className="h-3.5 w-3.5" />{t("hl.packConfirmTitle", "确认跟单参数")}
              </div>
              <p className="text-[11px] leading-relaxed text-foreground/70">
                {t("hl.packConfirmSummary", "跟随 {{n}} 个策略 · 镜像比例 {{ratio}}% · 杠杆 {{lev}} · 单笔上限 ${{cap}}", {
                  n: picks.length,
                  ratio: pack.ratioPct,
                  lev: pack.maxLev > 0 ? `≤${pack.maxLev}x` : t("hl.packLevAuto", "随单"),
                  cap: pack.cap,
                })}
              </p>
              <p className="text-[11px] leading-relaxed text-red-300/90">
                {t("hl.packRiskLine", "杠杆交易可能亏损全部本金,爆仓后无法追回。")}
              </p>
              {/* 满仓保护(显示层):如实告知单笔下单上限。 */}
              <FullPositionNote color={pack.color} />
              {/* 高风险包:必须勾选「已知悉高风险并自愿承担」,否则按钮 disabled。 */}
              {isHighRisk && <HighRiskAck checked={riskAck} onChange={setRiskAck} color={pack.color} />}
            </div>
          )}

          <button
            type="button"
            disabled={busy || picks.length === 0 || (confirm && !allOn && isHighRisk && !riskAck)}
            onClick={() => {
              if (allOn) { onEnable(picks, pack); return; }
              if (confirm) { onEnable(picks, pack); setConfirm(false); setRiskAck(false); }
              else setConfirm(true);
            }}
            className={cn(
              "mt-3.5 w-full h-11 rounded-xl inline-flex items-center justify-center gap-2 text-[14px] font-extrabold transition-all active:scale-[0.99] disabled:opacity-50",
              allOn ? "bg-white/[0.06] text-foreground/80 border border-white/10" : "text-black",
            )}
            style={allOn ? undefined : { background: `linear-gradient(135deg, ${pack.color}, ${pack.color}cc)`, boxShadow: `0 0 18px ${pack.color}40` }}
            data-testid={`button-pack-enable-${pack.key}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {busy ? t("hl.packEnabling", "启用中…")
              : allOn ? t("hl.packReapply", "重新应用参数")
              : confirm ? t("hl.packConfirmFollow", "确认跟单")
              : followedCount > 0 ? t("hl.packTopUp", "补齐剩余 {{n}} 位", { n: picks.length - followedCount })
              : t("hl.oneClickFollow", "一键跟单")}
          </button>
        </>
      )}
    </div>
  );
}

// ── CONSOLE 策略包 — 项目方在控制台配置的 pack(替代硬编码预设)──────────────────
//
// 每个 console pack 绑定 ONE leaderAddress(项目方指定要复制的 HL 交易员)+ 一套
// 风险参数(params)。跟单 = 订阅该 pack 的 leaderAddress + 用 params 构建 cfg。
// params 的 key 命名两种风格都兼容(ratioPct|notionalRatio, cap|notionalCapUsd,
// daily|dailyCapUsd, coins|allowedCoins, maxLeverage)。

/** Pick the first finite number among candidate keys (tolerant of naming). */
function pickNum(params: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = params[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return undefined;
}

/** Coin whitelist — tolerant of array or comma/space string. */
function pickCoins(params: Record<string, unknown>, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = params[k];
    if (Array.isArray(v)) return v.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    if (typeof v === "string" && v.trim() !== "") return v.split(/[,\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  }
  return [];
}

/**
 * Map a console pack's `params` → the engine HlFollowConfig.
 *   ratioPct (whole %, e.g. 5) OR notionalRatio (fraction, e.g. 0.05) → notionalRatio
 *   maxLeverage (0 = 随单/auto) ; cap|notionalCapUsd ; daily|dailyCapUsd ;
 *   coins|allowedCoins ; takeProfitPct|tpPct ; stopLossPct|slPct.
 */
function consolePackConfig(pack: ConsolePack): HlFollowConfig {
  const p = pack.params ?? {};
  // ratio: prefer an explicit fraction (notionalRatio/ratio ≤1), else whole-% (ratioPct).
  const ratioFrac = pickNum(p, "notionalRatio", "ratio");
  const ratioPct = pickNum(p, "ratioPct", "notionalRatioPct", "mirrorPct");
  const notionalRatio =
    ratioFrac != null ? (ratioFrac > 1 ? ratioFrac / 100 : ratioFrac)
      : ratioPct != null ? ratioPct / 100
      : 0.05;
  return {
    notionalRatio,
    maxLeverage: pickNum(p, "maxLeverage", "maxLev", "leverage") ?? 0,
    takeProfitPct: pickNum(p, "takeProfitPct", "tpPct") ?? null,
    stopLossPct: pickNum(p, "stopLossPct", "slPct") ?? null,
    notionalCapUsd: pickNum(p, "notionalCapUsd", "cap", "perTradeCapUsd"),
    dailyCapUsd: pickNum(p, "dailyCapUsd", "daily", "dailyCap"),
    allowedCoins: pickCoins(p, "allowedCoins", "coins"),
  };
}

/** Console tier → display meta (label + color). null tier = neutral. */
const CONSOLE_TIER_META: Record<NonNullable<ConsolePack["tier"]>, { label: string; color: string }> = {
  entry: { label: "Entry", color: "#34d399" },
  advanced: { label: "Advanced", color: "#818cf8" },
  pro: { label: "Pro", color: "#fb7185" },
};

/**
 * One CONSOLE pack card. Mirrors PackCard's visual + one-tap confirm UX, but
 * follows the pack's single bound leaderAddress with the pack's params.
 * No leaderAddress → disabled "项目方未绑定 leader" state.
 */
function ConsolePackCard({
  pack, subscribed, busy, onEnable, underfunded = false,
}: {
  pack: ConsolePack;
  subscribed: Set<string>;
  busy: boolean;
  onEnable: (pack: ConsolePack) => void;
  underfunded?: boolean;
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const [riskAck, setRiskAck] = useState(false);
  useEffect(() => { if (busy) { setConfirm(false); setRiskAck(false); } }, [busy]);

  const cfg = useMemo(() => consolePackConfig(pack), [pack]);
  // 高风险判定(由解析后的参数推断):杠杆 ≥8 或 镜像比例 ≥10% 视为高风险,
  // 确认态额外要求勾选「已知悉高风险并自愿承担」。
  const isHighRisk = cfg.maxLeverage >= 8 || cfg.notionalRatio >= 0.10;
  const tierMeta = pack.tier ? CONSOLE_TIER_META[pack.tier] : null;
  const color = tierMeta?.color ?? "#a78bfa";
  const leaderBound = !!pack.leaderAddress;
  const isOn = leaderBound && subscribed.has(pack.leaderAddress!.toLowerCase());

  const minBal = pack.minBalanceUsd;
  // perf — show a compact summary if the console attached a number-ish field.
  const perfWin = pack.perf && typeof pack.perf === "object"
    ? pickNum(pack.perf as Record<string, unknown>, "winRate", "win", "winRatePct")
    : undefined;
  const perfRoi = pack.perf && typeof pack.perf === "object"
    ? pickNum(pack.perf as Record<string, unknown>, "roi", "roiPct", "pnlPct")
    : undefined;

  const param = (k: string, v: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-foreground/45">{k}</span>
      <span className="font-bold text-foreground/80 tabular-nums">{v}</span>
    </div>
  );

  return (
    <div className="glass-panel p-4" style={isOn ? { boxShadow: `0 0 0 1px ${color}66, 0 0 18px ${color}22` } : undefined}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-[15px] font-bold text-foreground truncate">{pack.name || pack.slug}</span>
        </div>
        {isOn && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${color}22`, color }}>
            {t("hl.packOn", "已启用")}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {tierMeta && (
          <span className="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${color}1a`, color }}>
            {t(`hl.consoleTier.${pack.tier}`, tierMeta.label)}
          </span>
        )}
        {pack.category && (
          <span className="inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-white/[0.05] text-foreground/60">
            {pack.category}
          </span>
        )}
        {(perfWin != null || perfRoi != null) && (
          <span className="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-300">
            {perfWin != null ? t("hl.consolePerfWin", "胜率 {{v}}%", { v: perfWin }) : ""}
            {perfWin != null && perfRoi != null ? " · " : ""}
            {perfRoi != null ? t("hl.consolePerfRoi", "收益 {{v}}%", { v: perfRoi }) : ""}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        {param(t("hl.packRatio", "镜像比例"), `${(cfg.notionalRatio * 100).toFixed(0)}%`)}
        {param(t("hl.packCap", "单笔上限"), cfg.notionalCapUsd != null ? `$${cfg.notionalCapUsd}` : t("hl.packAuto", "随单"))}
        {param(t("hl.packDaily", "日上限"), cfg.dailyCapUsd != null ? `$${cfg.dailyCapUsd}` : t("hl.packAuto", "随单"))}
        {param(t("hl.packLev", "杠杆"), cfg.maxLeverage > 0 ? `≤${cfg.maxLeverage}x` : t("hl.packLevAuto", "随单"))}
        {param(t("hl.packCoins", "币种"), (cfg.allowedCoins && cfg.allowedCoins.length) ? cfg.allowedCoins.join("/") : t("hl.packAllCoins", "全部"))}
        {minBal != null ? param(t("hl.packMinBal", "最低余额"), `$${minBal}`) : param(t("hl.packExit", "跟随平仓"), t("hl.packExitOn", "开"))}
      </div>

      {/* 项目方未绑定 leader → 禁用,提示需在控制台绑定。 */}
      {!leaderBound ? (
        <button
          type="button"
          disabled
          className="mt-3.5 w-full h-11 rounded-xl inline-flex items-center justify-center gap-2 text-[13px] font-bold bg-white/[0.04] text-foreground/40 border border-white/10 cursor-not-allowed"
          data-testid={`button-console-pack-unbound-${pack.slug}`}
        >
          <AlertTriangle className="h-4 w-4" />
          {t("hl.consolePackUnbound", "项目方未绑定 leader")}
        </button>
      ) : underfunded ? (
        <Link href="/strategy" data-testid={`link-console-pack-fund-${pack.slug}`}>
          <button
            type="button"
            className="mt-3.5 w-full h-11 rounded-xl inline-flex items-center justify-center gap-2 text-[14px] font-extrabold transition-all active:scale-[0.99] bg-white/[0.05] text-amber-200 border border-amber-500/30"
            data-testid={`button-console-pack-fund-${pack.slug}`}
          >
            <Wallet className="h-4 w-4" />
            {t("hl.packFundToFollow", "充值后跟单")}
          </button>
        </Link>
      ) : (
        <>
          {confirm && !isOn && (
            <div className="mt-3 rounded-xl p-3 space-y-1.5" style={{ background: `${color}12`, border: `1px solid ${color}33` }}>
              <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color }}>
                <AlertTriangle className="h-3.5 w-3.5" />{t("hl.packConfirmTitle", "确认跟单参数")}
              </div>
              <p className="text-[11px] leading-relaxed text-foreground/70">
                {t("hl.consolePackConfirmSummary", "复制 {{leader}} · 镜像比例 {{ratio}}% · 杠杆 {{lev}} · 单笔上限 {{cap}}", {
                  leader: shortAddr(pack.leaderAddress!),
                  ratio: (cfg.notionalRatio * 100).toFixed(0),
                  lev: cfg.maxLeverage > 0 ? `≤${cfg.maxLeverage}x` : t("hl.packLevAuto", "随单"),
                  cap: cfg.notionalCapUsd != null ? `$${cfg.notionalCapUsd}` : t("hl.packAuto", "随单"),
                })}
              </p>
              <p className="text-[11px] leading-relaxed text-red-300/90">
                {t("hl.packRiskLine", "杠杆交易可能亏损全部本金,爆仓后无法追回。")}
              </p>
              {/* 满仓保护(显示层):如实告知单笔下单上限。 */}
              <FullPositionNote color={color} />
              {/* 高风险参数(杠杆≥8 或 镜像≥10%):必须勾选才可确认跟单。 */}
              {isHighRisk && <HighRiskAck checked={riskAck} onChange={setRiskAck} color={color} />}
            </div>
          )}

          <button
            type="button"
            disabled={busy || (confirm && !isOn && isHighRisk && !riskAck)}
            onClick={() => {
              if (isOn) { onEnable(pack); return; }
              if (confirm) { onEnable(pack); setConfirm(false); setRiskAck(false); }
              else setConfirm(true);
            }}
            className={cn(
              "mt-3.5 w-full h-11 rounded-xl inline-flex items-center justify-center gap-2 text-[14px] font-extrabold transition-all active:scale-[0.99] disabled:opacity-50",
              isOn ? "bg-white/[0.06] text-foreground/80 border border-white/10" : "text-black",
            )}
            style={isOn ? undefined : { background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 0 18px ${color}40` }}
            data-testid={`button-console-pack-enable-${pack.slug}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {busy ? t("hl.packEnabling", "启用中…")
              : isOn ? t("hl.packReapply", "重新应用参数")
              : confirm ? t("hl.packConfirmFollow", "确认跟单")
              : t("hl.oneClickFollow", "一键跟单")}
          </button>
        </>
      )}
    </div>
  );
}

// ── 智能跟单HL — full hub page reached from the Strategy hero ─────────────────
//
// 统计台 (HubStatsBar:每日盈亏) always on top, then 4 exchange-style tabs:
//   总览 (钱包:开户/充值/提现 + 跟单中) · 智能跟单 (策略包 + 一键跟单 + AI 决策)
//   · 信号源 (DataSourceTab) · 持仓·平仓 (MyPositionsTab). Honest live engine data only.
export function HlHubPage() {
  const { t } = useTranslation();
  const reduce = !!useReducedMotion();
  const account = useActiveAccount();
  const wallet = account?.address;
  const [network, setNetwork] = useState<HlNetwork>("mainnet");

  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  const hlUser = userQ.data as { engineEoaAddress?: string; hlMode?: string; hlMasterAddress?: string } | undefined;
  const engineEoa = hlUser?.engineEoaAddress;
  // 非托管 agent 模式:净值/持仓读 master(自己钱包);custodial 读托管 EOA。
  const agentMode = hlUser?.hlMode === "agent";
  const hlAddress = agentMode ? (hlUser?.hlMasterAddress ?? wallet) : engineEoa;
  // 可调控数据层:真实引擎数据 + Supabase 手动覆盖(统计/持仓/历史)。
  const acctQ = useHlAccountAdjusted(hlAddress, network, wallet);
  const subsQ = useHlSubs(userId);
  const leadersQ = useHlLeaders(network);
  const packsQ = useConsolePacks();
  const { copy, copyMany } = useHlCopy(userId, network);

  // CONSOLE packs drive the list when the project client has configured them.
  // Empty list OR fetch error → fall back to the hardcoded HL_PACKS presets so
  // nothing regresses for projects that haven't curated packs yet.
  const consolePacks = packsQ.data?.packs ?? [];
  const useConsole = packsQ.isSuccess && consolePacks.length > 0;

  const subscribedLeaders = useMemo(() => {
    const set = new Set<string>();
    for (const s of subsQ.data?.subscriptions ?? []) {
      if ((s as any).status !== "stopped") set.add(String((s as any).leaderAddress).toLowerCase());
    }
    return set;
  }, [subsQ.data]);

  const acct = acctQ.data;
  const leaders = leadersQ.data?.leaders ?? [];

  // 实时引擎健康(UIUX Rec #6)+ 余额门槛(UIUX Rec #2)。
  const engineHealth = engineHealthFrom(acctQ, leadersQ);
  // 账户净值 < HL_MIN → 跟单会以 insufficient_funds 静默失败,改为引导充值。
  // 仅在账户已成功读取后判定,避免加载/未连接时误报余额不足。
  const underfunded = !!wallet && !!hlAddress && acctQ.isSuccess && (acct?.accountValue ?? 0) < HL_MIN;

  // 选一个策略包 → 一键跟单(copyMany 批量订阅该 pack 的 top-N leader)。每张卡独立 busy。
  const [busyPack, setBusyPack] = useState<string | null>(null);
  // 交易所式四 tab:总览(账户/钱包/跟单中)· 智能跟单(策略包)· 信号源 · 持仓·平仓。
  const [hubTab, setHubTab] = useState<"overview" | "copy" | "signals" | "positions">("overview");
  async function onEnablePack(picks: HlLeader[], pack: HlPack) {
    if (busyPack) return;
    setBusyPack(pack.key);
    try { await copyMany(picks, packConfig(pack)); } finally { setBusyPack(null); }
  }

  // CONSOLE pack → follow its single bound leaderAddress with its params.
  // Synthesize the minimal HlLeader shape copy() needs (it only reads .address).
  async function onEnableConsolePack(pack: ConsolePack) {
    if (busyPack || !pack.leaderAddress) return;
    setBusyPack(pack.slug);
    try {
      const leaderObj: HlLeader = {
        address: pack.leaderAddress,
        label: pack.name || pack.slug,
        active: true,
        network,
        score: null,
        medianHoldingS: null,
        isHft: null,
      };
      await copy(leaderObj, consolePackConfig(pack));
    } finally {
      setBusyPack(null);
    }
  }

  return (
    <div className="min-h-screen pb-28 lg:pb-12">
      {/* Back header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-white/10">
        <div className="px-4 h-14 flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/strategy" data-testid="link-back-strategy-hub">
            <button className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-foreground/80 hover:bg-white/10 active:scale-95 transition">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <h1 className="text-[15px] font-bold text-foreground truncate">{t("hl.hubTitle", "智能跟单 HL")}</h1>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto" style={{ animation: "fadeSlideIn 0.4s ease-out" }}>
        <SectionHeader network={network} onNetwork={setNetwork} reduce={reduce} health={engineHealth} />

        {/* 统计台 — 每日盈亏 + 账户概览,始终置顶(交易所式)。 */}
        <HubStatsBar
          wallet={wallet}
          loading={!!wallet && acctQ.isLoading}
          accountValue={acct?.accountValue ?? 0}
          todayPnl={acct?.todayPnl ?? 0}
          unrealizedPnl={acct?.unrealizedPnl ?? 0}
          followCount={subscribedLeaders.size}
          reduce={reduce}
        />

        {/* 四 tab:总览 / 智能跟单 / 信号源 / 持仓·平仓 */}
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-1">
          {([
            { id: "overview" as const, label: t("hl.hubTabOverview", "总览") },
            { id: "copy" as const, label: t("hl.hubTabCopy", "智能跟单") },
            { id: "signals" as const, label: t("hl.hubTabSignals", "信号源") },
            { id: "positions" as const, label: t("hl.hubTabPositions", "持仓·平仓") },
          ]).map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setHubTab(tb.id)}
              className={cn(
                "flex-1 min-w-0 py-2.5 px-1.5 rounded-xl text-[11px] sm:text-[12px] font-bold tracking-tight whitespace-nowrap truncate transition-all",
                hubTab === tb.id ? "bg-gradient-to-b from-amber-400 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]" : "text-white/55 hover:text-white/90 hover:bg-white/5",
              )}
              data-testid={`hub-tab-${tb.id}`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        <div style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
          {/* ── 总览 — 钱包(开户/充值/提现)+ 跟单中 ─────────────────────────── */}
          {hubTab === "overview" && (
            <div className="space-y-5">
              <HlAccountStrip
                wallet={wallet}
                userLoading={!!wallet && userQ.isLoading}
                userError={!!wallet && userQ.isError}
                userId={userId}
                network={network}
                agentMode={agentMode}
                engineEoaAddress={(agentMode ? hlAddress : engineEoa) ?? ""}
                onRetryUser={() => userQ.refetch()}
                followCount={subscribedLeaders.size}
                funding={userId ? (
                  <HlFunding
                    userId={userId}
                    network={network}
                    agentMode={agentMode}
                    depositAddress={engineEoa ?? ""}
                    withdrawable={acct?.withdrawable ?? 0}
                    wallet={wallet}
                    accountValue={acct?.accountValue ?? 0}
                  />
                ) : undefined}
              />
              <ActiveSubs userId={userId} />
            </div>
          )}

          {/* ── 智能跟单 — 策略包 + 一键跟单 + AI 决策 ──────────────────────── */}
          {hubTab === "copy" && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-medium text-foreground/90">{t("hl.strategyPacks", "策略包")}</h3>
                  <span className="text-[11px] text-foreground/40">· {t("hl.packHint", "选一个,一键跟单")}</span>
                </div>

                {/* 余额不足 → 醒目横幅,切到「总览」tab 充值。 */}
                {underfunded && (
                  <button
                    type="button"
                    onClick={() => setHubTab("overview")}
                    className="mb-3 w-full flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-3 text-left transition active:scale-[0.99] hover:border-amber-400/50"
                    data-testid="button-fund-banner"
                  >
                    <div className="shrink-0 grid h-9 w-9 place-items-center rounded-lg bg-amber-500/15 border border-amber-500/30">
                      <Wallet className="h-4 w-4 text-amber-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-amber-200">{t("hl.underfundedTitle2", "余额不足,去「总览」充值")}</div>
                      <p className="mt-0.5 text-[11px] leading-snug text-foreground/55">
                        {t("hl.underfundedDesc", "HL 最低需 ${{min}} 才能跟单;当前账户净值 {{val}}。点此回钱包充值。", { min: HL_MIN, val: fmtUsd(acct?.accountValue ?? 0) })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-amber-300/80" />
                  </button>
                )}

                {useConsole ? (
                  <div className="space-y-3">
                    {consolePacks.map((p) => (
                      <ConsolePackCard
                        key={p.slug}
                        pack={p}
                        subscribed={subscribedLeaders}
                        busy={busyPack === p.slug}
                        onEnable={onEnableConsolePack}
                        underfunded={underfunded}
                      />
                    ))}
                  </div>
                ) : packsQ.isLoading || leadersQ.isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>
                ) : leaders.length === 0 ? (
                  <HlEmpty icon={Users} title={t("hl.noLeaders")} desc={t("hl.noLeadersDesc")} />
                ) : (
                  <div className="space-y-3">
                    {HL_PACKS.map((p) => (
                      <PackCard
                        key={p.key}
                        pack={p}
                        leaders={leaders}
                        subscribed={subscribedLeaders}
                        busy={busyPack === p.key}
                        onEnable={onEnablePack}
                        underfunded={underfunded}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* F17 — AI 跟单决策卡 */}
              <AiDecisionCards userId={userId} />
            </div>
          )}

          {/* ── 信号源 — leader 实时信号 feed ──────────────────────────────── */}
          {hubTab === "signals" && <DataSourceTab network={network} />}

          {/* ── 持仓·平仓 — 持仓 + 平仓记录 ───────────────────────────────── */}
          {hubTab === "positions" && <MyPositionsTab network={network} />}
        </div>
      </div>
    </div>
  );
}

export default HlCopySection;
