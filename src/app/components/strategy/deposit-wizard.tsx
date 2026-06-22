/**
 * DeposITWizard — HL 充值分步向导(独立组件)。
 *
 * 三步:① 选择金额包(DepositTierPicker:绑定 交易次数 / 止盈止损 / 单笔金额)
 *       → ② 选择支付方式(钱包转账 / 地址·扫码 / 跨链充值,三选一)
 *       → ③ 支付 · 确认等待 · 关闭(复用既有支付面板,成功后自动关闭)。
 *
 * 复用既有逻辑、不重建:DepositTierPicker / DepositTransferPanel / DepositAddressPanel /
 * DepositBuyPanel / HlDepositGuide。本组件只负责「分步编排 + 状态机」。
 * 自身持有 picked/step/method;`open` 变 true 时重置成干净的第一步。
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Wallet, QrCode, Zap, ChevronRight, ArrowLeft, AlertTriangle } from "lucide-react";
import { cn } from "@app/lib/utils";
import { queryClient } from "@app/lib/queryClient";
import type { HlNetwork } from "@app/lib/engine";
import type { DepositCap } from "@/hooks/rune/use-deposit-cap";
import { arbitrum } from "@/lib/thirdweb/chains";
import { DepositBuyPanel, DepositTransferPanel, DepositAddressPanel } from "@app/components/copy-trading/shared";
import { HlDepositGuide } from "@app/components/hl/hl-deposit-guide";
import { DepositTierPicker } from "@app/components/strategy/deposit-tier-picker";

const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`;

type DepStep = "amount" | "method" | "pay";
type DepMethod = "transfer" | "address" | "bridge";

export function DepositWizard({
  open,
  network,
  agentMode,
  depositTarget,
  transferTarget,
  level,
  cap,
  onCopy,
  onClose,
}: {
  open: boolean;
  network: HlNetwork;
  agentMode: boolean;
  /** 收款方:custodial = 托管 EOA;agent = 用户自己的钱包(= HL 账户)。Tab3 跨链买入落点。 */
  depositTarget: string;
  /** 钱包直转的收款方:agent = HL Bridge2;custodial = 托管 EOA。 */
  transferTarget: string;
  /** 节点等级 —— 决定开放的固定金额包。 */
  level: number;
  /** useDepositCap 结果(限额 / 剩余可充),透传给各支付面板。 */
  cap: DepositCap;
  onCopy: (addr: string) => void;
  /** 支付成功后关闭弹窗。 */
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<number | null>(null);
  const [step, setStep] = useState<DepStep>("amount");
  const [method, setMethod] = useState<DepMethod | null>(null);

  // 弹窗每次打开 → 回到干净的第一步。
  useEffect(() => {
    if (open) { setStep("amount"); setMethod(null); setPicked(null); }
  }, [open]);

  function settleAndClose() {
    queryClient.invalidateQueries({ queryKey: ["engine", "hl", "account"] });
    window.setTimeout(() => onClose(), 1500);
  }

  return (
    <div className="space-y-3">
      {/* 进度:① 金额包 → ② 支付方式 → ③ 支付 */}
      {(() => {
        const order: DepStep[] = ["amount", "method", "pay"];
        const ci = order.indexOf(step);
        const labels = [t("deposit.stepAmount", "金额包"), t("deposit.stepMethod", "支付方式"), t("deposit.stepPay", "支付")];
        return (
          <div className="flex items-center gap-1.5">
            {labels.map((label, i) => {
              const done = i < ci, cur = i === ci;
              return (
                <div key={i} className="flex items-center gap-1.5 min-w-0">
                  <div className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap transition",
                    cur ? "bg-amber-500/20 text-amber-200 border border-amber-400/40"
                      : done ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.04] text-foreground/40",
                  )}>
                    <span className={cn("grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-bold",
                      cur ? "bg-amber-400 text-black" : done ? "bg-emerald-400 text-black" : "bg-white/10 text-foreground/50")}>
                      {done ? "✓" : i + 1}
                    </span>
                    {label}
                  </div>
                  {i < 2 && <div className={cn("h-px w-2.5 sm:w-3 shrink-0", done ? "bg-emerald-400/50" : "bg-white/10")} />}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Step 1 · 选择金额包(绑定 交易次数 / 止盈止损 / 单笔金额)── */}
      {step === "amount" && (
        <div className="space-y-3">
          <DepositTierPicker
            level={level}
            remaining={cap.remaining}
            selected={picked ?? undefined}
            onPick={setPicked}
          />
          <button
            type="button"
            disabled={picked == null}
            onClick={() => setStep("method")}
            className="gold-button w-full flex items-center justify-center gap-1.5 rounded-xl py-3 min-h-[44px] text-[13px] font-extrabold disabled:opacity-50"
            data-testid="button-deposit-next-method"
          >
            <span className="truncate">{t("deposit.nextMethod", "下一步 · 选择支付方式")}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
          {picked == null && (
            <p className="text-[11px] leading-snug text-amber-300/70" data-testid="hl-deposit-pick-first">
              {t("deposit.pickAmountFirst", "请先选择充值金额包,再选择支付方式。")}
            </p>
          )}
        </div>
      )}

      {/* ── Step 2 · 选择支付方式(三选一)── */}
      {step === "method" && (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setStep("amount")}
            className="inline-flex items-center gap-1 text-[11px] text-foreground/55 hover:text-foreground/80 transition"
            data-testid="button-deposit-back-amount"
          >
            <ArrowLeft className="h-3 w-3" />{t("deposit.back", "上一步")} · {t("deposit.selectedAmount", "已选")} ${picked}
          </button>
          <p className="text-[12px] text-foreground/60">{t("deposit.chooseMethod", "选择一种支付方式")}</p>
          {([
            { id: "transfer" as const, icon: Wallet, label: t("deposit.tabTransfer", "钱包转账"), desc: t("deposit.methodTransferDesc", "从你连接的钱包直接转 USDC(Arbitrum)") },
            { id: "address" as const, icon: QrCode, label: agentMode ? t("hl.tabDepositGuide", "充值引导") : t("deposit.tabAddress", "地址/扫码"), desc: agentMode ? t("deposit.methodGuideDesc", "查看非托管充值引导") : t("deposit.methodAddressDesc", "复制地址 / 扫码,从任意钱包或交易所打款") },
            { id: "bridge" as const, icon: Zap, label: t("deposit.tabBridge", "跨链充值"), desc: t("deposit.methodBridgeDesc", "用其他链资产或银行卡跨链买入并充值") },
          ]).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setMethod(m.id); setStep("pay"); }}
              className="w-full flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:border-amber-400/40 hover:bg-amber-500/[0.05] active:scale-[0.99] transition p-3 text-left"
              data-testid={`button-deposit-method-${m.id}`}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/[0.1] border border-amber-400/25">
                <m.icon className="h-4 w-4 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-foreground/90">{m.label}</div>
                <div className="text-[11px] text-foreground/55 leading-snug">{m.desc}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" />
            </button>
          ))}
        </div>
      )}

      {/* ── Step 3 · 支付 / 确认等待 / 关闭 ── */}
      {step === "pay" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setStep("method")}
            className="inline-flex items-center gap-1 text-[11px] text-foreground/55 hover:text-foreground/80 transition"
            data-testid="button-deposit-back-method"
          >
            <ArrowLeft className="h-3 w-3" />{t("deposit.back", "上一步")} · {t("deposit.selectedAmount", "已选")} ${picked}
          </button>

          {method === "transfer" && (
            <DepositTransferPanel
              seller={transferTarget || undefined}
              cap={cap}
              lockedAmount={picked ?? undefined}
              chain={arbitrum}
              tokenAddress={USDC_ARBITRUM}
              tokenLabel="USDC"
              chainLabel="Arbitrum"
              gasChain="arbitrum"
              minHard={5}
              hint={agentMode
                ? t("hl.transferHintAgent", "USDC 将由你连接的钱包直接发往 HL Bridge2,HL 会把发送地址(=你的钱包)记为你的 HL 账户。最低 5 USDC,约 1 分钟到账。")
                : t("hl.transferHintCustodial", "仅支持 Arbitrum 网络的 USDC,资金将进入你的托管交易地址并自动转入 HL 账户。最低 5 USDC。")}
              onSuccess={settleAndClose}
              onCopy={onCopy}
            />
          )}

          {method === "address" && (
            agentMode ? (
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
                lockedAmount={picked ?? undefined}
                onCopy={onCopy}
                warnText={t("hl.addressWarn", "仅支持 Arbitrum 网络的 USDC,转入其他代币 / 其他链将无法找回。")}
              />
            )
          )}

          {method === "bridge" && (
            depositTarget ? (
              <DepositBuyPanel
                chain={arbitrum}
                token={USDC_ARBITRUM}
                seller={depositTarget}
                assetLabel="USDC"
                cap={cap}
                lockedAmount={picked ?? undefined}
                onSuccess={settleAndClose}
              />
            ) : (
              <p className="text-[12px] text-muted-foreground text-center py-3">{t("hl.addressNeedOnboard", "暂无地址 —— 请先开通账户")}</p>
            )
          )}
        </div>
      )}

      {/* 风控绑定说明:所选金额绑定的风控将由后端自动应用到跟单订阅。 */}
      <p className="mt-1 text-[11px] leading-snug text-foreground/50" data-testid="hl-deposit-risk-note">
        {t("deposit.riskBindNote", "该金额绑定的风控(单笔限额 / 杠杆上限 / 止盈止损)将自动应用到你的跟单。")}
      </p>
    </div>
  );
}

export default DepositWizard;
