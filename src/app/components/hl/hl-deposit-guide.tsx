import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownToLine, Copy, CheckCircle2, ExternalLink, Info, Wallet } from "lucide-react";
import { copyText } from "@app/lib/copy";

/**
 * HL 直充引导(非托管 agent 模式)。
 *
 * 非托管下用户**自己的连接钱包就是 HL 账户**:用户从自己钱包把 USDC(Arbitrum)发到
 * HL Bridge2,HL 会把发送地址(= 用户钱包)记为永续账户。平台只持 agent key 代下单,
 * 碰不到资金(approveAgent 不含提现权)。
 *
 * 这是纯引导 + 可复制地址(不替用户签转账)——用户自己那笔入金由其钱包付 Arbitrum gas,
 * 与在任何地方往 HL 入金一致。最低 5 USDC,<1 分钟到账。
 */

// HL Bridge2 入金合约(Arbitrum One 主网)。发 USDC 到这里 = 入金。
const HL_BRIDGE2_MAINNET = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
// 原生 USDC(Arbitrum One)。
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (await copyText(value)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="group w-full flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-2 text-left transition hover:border-amber-400/30 active:scale-[0.995]"
    >
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-amber-300/70">{label}</span>
      <code className="flex-1 min-w-0 font-mono text-[11px] leading-relaxed text-foreground/80 break-all">{value}</code>
      <span className={`shrink-0 ${copied ? "text-emerald-400" : "text-muted-foreground/60 group-hover:text-amber-300"}`}>
        {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

export function HlDepositGuide({ network = "mainnet" }: { network?: "mainnet" | "testnet" }) {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;

  if (network === "testnet") {
    return (
      <Card className="border-sky-500/20 bg-card/70 backdrop-blur">
        <CardContent className="p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <ArrowDownToLine className="h-4 w-4 text-sky-400" /> {t("hl.deposit.testnetTitle", "Hyperliquid 测试网充值")}
          </div>
          <p className="text-xs text-muted-foreground/85 leading-relaxed">
            {t("hl.deposit.testnetDesc", "测试网请用官方入金口领取/充入测试 USDC:")}
          </p>
          <a
            href="https://app.hyperliquid-testnet.xyz/drip"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200"
          >
            app.hyperliquid-testnet.xyz <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/20 bg-card/70 backdrop-blur">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ArrowDownToLine className="h-4 w-4 text-amber-400" /> {t("hl.deposit.titleNonCustodial", "Hyperliquid 充值(非托管)")}
        </div>

        {/* 你的 HL 账户 = 连接的钱包 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground/70">
            <Wallet className="h-3 w-3 text-amber-300/70" /> {t("hl.deposit.accountLabel", "你的 HL 账户(= 你连接的钱包)")}
          </div>
          {wallet ? (
            <CopyRow label={t("hl.deposit.accountTag", "HL 账户")} value={wallet} />
          ) : (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-2 text-xs text-muted-foreground/70">
              {t("hl.deposit.connectFirst", "请先连接钱包")}
            </div>
          )}
        </div>

        {/* 步骤 */}
        <ol className="space-y-2.5 text-xs text-foreground/85">
          <li className="flex gap-2">
            <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[10px] grid place-items-center">1</span>
            <span>{t("hl.deposit.step1", "在 Arbitrum One 上准备 USDC(从交易所提币到 Arbitrum,或用桥/支付服务跨链到你自己钱包)。")}</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[10px] grid place-items-center">2</span>
            <span>{t("hl.deposit.step2", "从你的钱包把 USDC 转给 HL Bridge2 合约(下方地址)。HL 会把发送地址(= 你的钱包)记为 HL 永续账户。")}</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[10px] grid place-items-center">3</span>
            <span>{t("hl.deposit.step3", "约 <1 分钟到账(最低 5 USDC,低于会被拒)。到账后即可开始跟单。")}</span>
          </li>
        </ol>

        <div className="space-y-1.5">
          <CopyRow label="Bridge2" value={HL_BRIDGE2_MAINNET} />
          <CopyRow label="USDC" value={USDC_ARBITRUM} />
        </div>

        {/* 提示 */}
        <div className="flex gap-2 rounded-lg bg-sky-500/[0.06] border border-sky-500/20 px-3 py-2 text-[11px] text-sky-200/90 leading-relaxed">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{t("hl.deposit.note", "这笔转账由你自己钱包发出、付一点 Arbitrum ETH 当 gas(几分钱,和在任何地方充 HL 一样)。非托管:资金始终在你自己的 HL 账户里,平台只代下单、无法提现你的资金。")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
