/**
 * 金库 — recommended **Hyperliquid protocol vaults** with live data.
 *
 * Purely informational (mirrors hyperliquid.xyz/vaults): real-time TVL / APR /
 * all-time PnL + a sparkline, deep-linking out to HL. NO follow / copy CTA —
 * the smart-contract copy-trading flow lives in the HL hub, reached from the
 * 智能合约跟单 hero above this panel. Data: useHlVaults → HL public info API.
 */

import { useTranslation } from "react-i18next";
import { ExternalLink, Layers, Sparkles, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@app/lib/utils";
import { formatCompact } from "@app/lib/constants";
import { shortAddr } from "@app/components/hl/shared";
import { HlEmpty } from "@app/components/hl/shared";
import { useHlVaults, hlVaultUrl, type HlVault } from "@app/lib/hl-vaults";
import type { HlNetwork } from "@app/lib/engine";

/** Minimal dependency-free sparkline from a value series. */
function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const W = 100;
  const H = 28;
  const step = W / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(H - ((p - min) / span) * H).toFixed(2)}`)
    .join(" ");
  const stroke = positive ? "#34d399" : "#fb7185";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function VaultCard({ v, network }: { v: HlVault; network: HlNetwork }) {
  const { t } = useTranslation();
  const aprPct = v.apr * 100;
  const aprPos = aprPct >= 0;
  const pnlPos = v.allTimePnl >= 0;
  const isHlp = /\bHLP\b|Hyperliquidity/i.test(v.name);

  return (
    <a
      href={hlVaultUrl(v.address, network)}
      target="_blank"
      rel="noopener noreferrer"
      className="block glass-panel p-4 transition-all hover:border-white/20 active:scale-[0.99]"
      data-testid={`hl-vault-${v.address}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.30)" }}
          >
            {isHlp ? <Crown className="h-4 w-4 text-amber-300" /> : <Layers className="h-4 w-4 text-amber-300" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-foreground truncate">{v.name}</span>
              {v.isClosed && (
                <Badge className="text-[8px] px-1 py-0 border-0 bg-white/[0.06] text-foreground/50 no-default-hover-elevate no-default-active-elevate">
                  {t("hlVaults.closed", "已关闭")}
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-foreground/50">
              <span className="shrink-0">{t("hlVaults.leader", "管理者")}</span>
              <code className="font-mono truncate">{shortAddr(v.leader)}</code>
            </div>
          </div>
        </div>
        <span className="shrink-0 flex items-center gap-0.5 text-[11px] text-amber-300/90 font-medium">
          {t("hlVaults.viewOnHl", "Hyperliquid")}
          <ExternalLink className="w-3 h-3" />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
        <div className="bg-black/20 rounded-lg p-2 border border-white/5">
          <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hlVaults.apr", "年化")}</p>
          <p className={cn("text-xs font-bold tabular-nums", aprPos ? "text-emerald-400" : "text-red-400")}>
            {aprPos ? "+" : ""}{aprPct.toFixed(1)}%
          </p>
        </div>
        <div className="bg-black/20 rounded-lg p-2 border border-white/5">
          <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hlVaults.tvl", "TVL")}</p>
          <p className="text-xs font-bold text-foreground tabular-nums num-gold">{formatCompact(v.tvl)}</p>
        </div>
        <div className="bg-black/20 rounded-lg p-2 border border-white/5">
          <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hlVaults.allTimePnl", "累计盈亏")}</p>
          <p className={cn("text-xs font-bold tabular-nums", pnlPos ? "text-emerald-400" : "text-red-400")}>
            {pnlPos ? "+" : ""}{formatCompact(v.allTimePnl)}
          </p>
        </div>
      </div>

      {v.sparkline.length >= 2 && (
        <div className="mt-2.5">
          <Sparkline points={v.sparkline} positive={pnlPos} />
        </div>
      )}
    </a>
  );
}

/**
 * HlVaultsPanel — the 金库 surface: a live, informational list of recommended
 * Hyperliquid vaults. Drop-in body; no page chrome.
 */
export function HlVaultsPanel({ network }: { network: HlNetwork }) {
  const { t } = useTranslation();
  const { vaults, isLoading, isError } = useHlVaults(network);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <h3 className="text-sm font-medium text-foreground/90 truncate">{t("hlVaults.title", "推荐金库")}</h3>
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            {t("hlVaults.live", "实时")}
          </span>
        </div>
        <span className="text-[10px] text-foreground/50 truncate ml-2">{t("hlVaults.subtitle", "Hyperliquid 链上金库数据")}</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : vaults.length === 0 ? (
        <HlEmpty
          icon={Layers}
          title={isError ? t("hlVaults.errorTitle", "暂时无法加载金库") : t("hlVaults.emptyTitle", "暂无推荐金库")}
          desc={isError ? t("hlVaults.errorDesc", "Hyperliquid 数据源连接失败,请稍后重试。") : t("hlVaults.emptyDesc", "当前网络暂无精选金库,可切换到主网查看。")}
        />
      ) : (
        <div className="space-y-3">
          {vaults.map((v) => <VaultCard key={v.address} v={v} network={network} />)}
        </div>
      )}
    </div>
  );
}

export default HlVaultsPanel;
