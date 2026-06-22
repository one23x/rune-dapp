/**
 * Flow Step 2 — 钱包 · 充值 / 提现。
 *
 * Gated wizard 的第二步:用户已开通交易账户,在此为其入金。
 * 复用「真实」资金 UI(HlFunding,来自 hl-copy-section)—— 不重建充值 / 提现。
 *
 * 本组件只渲染:交易账户地址卡(短地址 + HL explorer 链接)、紧凑的已入金概览
 * (净值 / 可提)、真实资金面板、以及一条 gating 提示。「下一步 / 选择策略」按钮
 * 由父级渲染并负责推进。
 *
 * 地址 / explorer 助手:engine-live.tsx 里的 hlAddr / shortAddr / usd **未导出**,
 * 故在此就地复制(small),URL pattern 与 engine-live.tsx 完全一致。
 */
import { useTranslation } from "react-i18next";
import { ExternalLink, CheckCircle2, ArrowDownToLine } from "lucide-react";
import type { HlAccount, HlNetwork } from "@app/lib/engine";
import { HlFunding } from "@app/components/strategy/hl-copy-section";

// ── 地址 / explorer / USD 助手(与 engine-live.tsx 同构,该文件未导出故就地复制)──
function hlAddr(addr: string, network: HlNetwork): string {
  const base = network === "testnet" ? "https://app.hyperliquid-testnet.xyz" : "https://app.hyperliquid.xyz";
  return `${base}/explorer/address/${addr}`;
}
function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
function usd(n: number): string {
  // 余额/可提一律保留 2 位小数(账户口径,别四舍五入掉分)。
  const a = Math.abs(n);
  return `${n < 0 ? "-" : ""}$${a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WalletStep(props: {
  userId: string;
  network: HlNetwork;
  agentMode: boolean;
  /** 引擎 EOA / 充值地址 */
  depositAddress: string;
  /** 交易账户地址 —— 展示 + explorer 链接 */
  hlAddress: string;
  /** 来自 useHlAccount(由父级传入) */
  acct?: HlAccount;
  wallet?: string;
  /** 父级算好的:账户是否已有余额 */
  funded: boolean;
}) {
  const { t } = useTranslation();
  const { network, hlAddress, acct, funded } = props;

  const navTxt = funded ? usd(acct?.accountValue ?? 0) : "—";
  const wdTxt = funded ? usd(acct?.withdrawable ?? 0) : "—";

  return (
    <div className="space-y-3">
      {/* 交易账户地址卡:短地址 + HL explorer/address 链接(诚实展示资金落在哪个账户)。 */}
      <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-foreground/45">
            {t("flow.wallet.account", "交易账户")}
          </span>
          {/* 完整地址(可全选复制),窄屏 break-all 换行不溢出 */}
          <code className="min-w-0 break-all select-all font-mono text-[12px] text-foreground/75">
            {hlAddress}
          </code>
          <a
            href={hlAddr(hlAddress, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] text-amber-300/80 transition hover:text-amber-300 active:scale-95"
            data-testid="link-hl-address"
          >
            {t("flow.wallet.viewOnHl", "在 Hyperliquid 查看")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* 紧凑已入金概览:净值 / 可提(未入金 → 「—」,与 EngineStats 同口径)。 */}
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
          <div className="min-w-0">
            <p className="mb-0.5 truncate text-[10px] uppercase tracking-wider text-foreground/45">
              {t("flow.wallet.nav", "账户净值")}
            </p>
            <p className={funded ? "num-gold text-[16px] font-bold tabular-nums break-all" : "text-[16px] font-bold tabular-nums text-foreground/35"}>
              {navTxt}
            </p>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 truncate text-[10px] uppercase tracking-wider text-foreground/45">
              {t("flow.wallet.withdrawable", "可提")}
            </p>
            <p className={funded ? "text-[16px] font-bold tabular-nums break-all text-foreground" : "text-[16px] font-bold tabular-nums text-foreground/35"}>
              {wdTxt}
            </p>
          </div>
        </div>
      </div>

      {/* 真实资金面板 —— 复用 HlFunding,绝不重建充值 / 提现。 */}
      <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/[0.08] border border-amber-400/25">
            <ArrowDownToLine className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-[14px] font-bold text-foreground">
              {t("flow.wallet.fundTitle", "充值 / 提现")}
            </p>
            <p className="text-[11px] leading-snug text-foreground/55">
              {t("flow.wallet.fundDesc", "把 USDC 充入交易账户即可开始跟单。")}
            </p>
          </div>
        </div>
        <HlFunding
          userId={props.userId}
          network={props.network}
          depositAddress={props.depositAddress}
          withdrawable={props.acct?.withdrawable ?? 0}
          agentMode={props.agentMode}
          wallet={props.wallet}
          accountValue={props.acct?.accountValue ?? 0}
        />
      </div>

      {/* gating 提示:未入金 → 琥珀提示;已入金 → 绿色确认(下一步按钮由父级渲染)。 */}
      {funded ? (
        <div
          className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-2.5"
          data-testid="flow-wallet-funded"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-[12px] leading-snug text-emerald-200/90">
            {t("flow.wallet.fundedNote", "开户成功 · HL 已验证到账,可进入下一步")}
          </p>
        </div>
      ) : (
        <div
          className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-2.5"
          data-testid="flow-wallet-need-deposit"
        >
          <ArrowDownToLine className="h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-[12px] leading-snug text-amber-200/85">
            {t("flow.wallet.depositToContinue", "充值后才能选择策略")}
          </p>
        </div>
      )}
    </div>
  );
}
