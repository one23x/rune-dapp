import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { useActiveAccount } from "thirdweb/react";
import { ArrowLeft, Activity, Loader2, Zap, CheckCircle2, ShieldCheck, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@app/lib/utils";
import {
  useEngineUser, useHlLeaders, useHlSignals, useHlSubs,
} from "@app/lib/engine-hooks";
import { useHlAccountAdjusted } from "@app/lib/hl-display-overrides";
import { useWalletTodayStats, numOrZero, type StatsVenue } from "@app/lib/trading-stats-hooks";
import type { HlNetwork } from "@app/lib/engine";
import {
  TIER_META, tierOf, shortAddr, fmtUsd, fmtHold, fmtScore,
  HL_DEFAULT_FOLLOW, type HlFollowConfig, useHlCopy, HlEmpty,
} from "@app/components/hl/shared";
import { ConfigPanel, SignalRow } from "@app/components/strategy/hl-copy-section";

/**
 * StrategyVault — full detail page for a single Hyperliquid leader ("vault").
 * Reached from the 跟单 tab's hot-vaults list (`/strategy/vault/:network/:address`).
 * Shows: leader info card · my honest account stats · 参数配置 · single 开启跟单 ·
 * leader-scoped 跟单信号 feed. No membership/points/AI-gauge chrome.
 */
export default function StrategyVault({ network, address }: { network: string; address: string }) {
  const { t } = useTranslation();
  const reduce = !!useReducedMotion();
  const net: HlNetwork = network === "testnet" ? "testnet" : "mainnet";
  const addrLc = address.toLowerCase();

  const account = useActiveAccount();
  const wallet = account?.address;

  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;

  const leadersQ = useHlLeaders(net);
  const leader = (leadersQ.data?.leaders ?? []).find((l) => l.address.toLowerCase() === addrLc);

  // HL 账户地址解析(custodial=托管 EOA / agent=主账户)+ overwrite 合并层 —— 不能拿连接钱包
  // 当 HL 地址(custodial 用户 HL 账户不在连接钱包上),否则账户净值/浮盈/可提全显示 0。
  const hlUser = userQ.data as { engineEoaAddress?: string; hlMode?: string; hlMasterAddress?: string } | undefined;
  const hlAddress = hlUser?.hlMode === "agent" ? (hlUser?.hlMasterAddress ?? wallet) : hlUser?.engineEoaAddress;
  const acctQ = useHlAccountAdjusted(hlAddress, net, wallet);
  const acct = acctQ.data;

  const subsQ = useHlSubs(userId);
  const subscribed = (subsQ.data?.subscriptions ?? []).some(
    (s) => (s as { status?: string }).status !== "stopped" &&
      String((s as { leaderAddress?: string }).leaderAddress ?? "").toLowerCase() === addrLc,
  );

  const sigQ = useHlSignals(net, { limit: 40, leader: address });
  const signals = sigQ.data?.signals ?? [];

  const { copy, pendingFor } = useHlCopy(userId, net);
  const copying = pendingFor?.toLowerCase() === addrLc;

  const [cfg, setCfg] = useState<HlFollowConfig>(HL_DEFAULT_FOLLOW);

  // 未实现盈亏走 Supabase show 当日视图(与 HL hub MyPositionsTab/HubStatsBar 同口径)——
  // 不再用引擎 acct.unrealizedPnl(那条与 hub 的 Supabase 口径打架,且不反映 admin 调控)。
  // 账户净值/可提保持引擎 acct(余额现金类)。
  const todayStatsQ = useWalletTodayStats(wallet);
  const venue: StatsVenue = (`hl_${net}` as StatsVenue);
  const todayRow = (todayStatsQ.data ?? []).find((d) => d.venue === venue);
  const unrealizedPnl = numOrZero(todayRow?.unrealized_pnl_usd);
  const pnlPos = unrealizedPnl >= 0;
  const canFollow = !!userId && !subscribed && !copying;

  return (
    <div className="min-h-screen pb-28 lg:pb-12">
      {/* Back header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-white/10">
        <div className="px-4 h-14 flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/strategy" data-testid="link-back-strategy">
            <button className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-foreground/80 hover:bg-white/10 active:scale-95 transition">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-foreground truncate leading-tight">{t("hl.vaultDetail", "金库详情")}</h1>
            <p className="text-[11px] text-foreground/45 font-mono truncate">{shortAddr(address)}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto" style={{ animation: "fadeSlideIn 0.4s ease-out" }}>
        {leadersQ.isLoading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : !leader ? (
          <HlEmpty icon={Activity} title={t("hl.vaultNotFound", "金库不存在")} desc={t("hl.vaultNotFoundDesc", "该金库可能已下线或不在当前网络。")} />
        ) : (
          <>
            {/* Leader info card */}
            <motion.div
              {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring", stiffness: 220, damping: 26 } })}
              className="glass-panel-strong relative p-5 overflow-hidden"
            >
              <div className="shimmer-sweep" />
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                {(() => {
                  const meta = TIER_META[tierOf(leader)];
                  const Icon = meta.icon;
                  return (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}40`, color: meta.color }}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base font-bold text-foreground truncate">{leader.label || shortAddr(leader.address)}</span>
                            {leader.isHft && <Badge className="text-[8px] px-1 py-0 border-0 bg-red-500/20 text-red-300 no-default-hover-elevate no-default-active-elevate">HFT</Badge>}
                          </div>
                          <div className="text-[11px] text-foreground/50 mt-1 flex items-center gap-2">
                            <Badge className="text-[8px] px-1.5 py-0 border-0 no-default-hover-elevate no-default-active-elevate" style={{ background: `${meta.color}1f`, color: meta.color }}>{t(meta.labelKey)}</Badge>
                            <code className="font-mono truncate">{shortAddr(leader.address)}</code>
                          </div>
                        </div>
                      </div>
                      {subscribed && (
                        <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[11px] font-medium">
                          <CheckCircle2 className="w-3 h-3" />{t("hl.copying", "跟单中")}
                        </span>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-white/10">
                  <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
                    <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hl.score", "评分")}</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{fmtScore(leader.score)}</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
                    <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hl.medHold", "中位持仓")}</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{fmtHold(leader.medianHoldingS)}</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
                    <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hl.style", "风格")}</p>
                    <p className="text-sm font-bold text-foreground">{leader.isHft ? t("hl.styleHft", "高频") : t("hl.styleSwing", "波段")}</p>
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-foreground/40 flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-emerald-400/70 shrink-0" />
                  {t("hl.heroTrust", "资金托管 · Arbitrum USDC · Hyperliquid 引擎")}
                </p>
              </div>
            </motion.div>

            {/* My account mini stats (honest PNL) */}
            <div className="glass-panel p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-medium text-foreground/90">{t("hl.myAccount", "我的账户")}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
                  <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hl.accountValue", "账户净值")}</p>
                  {!!wallet && acctQ.isLoading
                    ? <Skeleton className="h-5 w-14 rounded" />
                    : <p className="text-sm font-bold text-foreground tabular-nums num-gold truncate">{wallet ? fmtUsd(acct?.accountValue ?? 0) : "—"}</p>}
                </div>
                <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
                  <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hl.unrealized", "未实现盈亏")}</p>
                  {!!wallet && todayStatsQ.isLoading
                    ? <Skeleton className="h-5 w-14 rounded" />
                    : <p className={cn("text-sm font-bold tabular-nums truncate", pnlPos ? "text-emerald-400" : "text-red-400")}>{wallet ? `${pnlPos ? "+" : ""}${fmtUsd(unrealizedPnl)}` : "—"}</p>}
                </div>
                <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
                  <p className="text-[9px] text-foreground/50 uppercase mb-0.5">{t("hl.withdrawable", "可提现")}</p>
                  {!!wallet && acctQ.isLoading
                    ? <Skeleton className="h-5 w-14 rounded" />
                    : <p className="text-sm font-bold text-foreground tabular-nums truncate">{wallet ? fmtUsd(acct?.withdrawable ?? 0) : "—"}</p>}
                </div>
              </div>
            </div>

            {/* 参数配置 */}
            <ConfigPanel cfg={cfg} setCfg={setCfg} reduce={reduce} />

            {/* 开启跟单 — single follow */}
            <motion.button
              type="button"
              disabled={!canFollow}
              onClick={() => leader && copy(leader, cfg)}
              {...(reduce ? {} : { whileTap: canFollow ? { scale: 0.98 } : undefined })}
              className={cn(
                "w-full relative overflow-hidden rounded-xl font-bold text-sm py-4 flex items-center justify-center gap-2 transition-all",
                subscribed
                  ? "glass-panel text-emerald-400 border-emerald-500/20"
                  : canFollow
                    ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                    : "glass-panel text-foreground/50 cursor-not-allowed border-white/10",
              )}
              data-testid="button-vault-follow"
            >
              {canFollow && <span className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />}
              {copying ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                : subscribed ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                : <Zap className="h-4 w-4" strokeWidth={2.5} />}
              <span className="relative">
                {subscribed ? t("hl.copying", "跟单中")
                  : !userId ? t("hl.openAccountFirst", "请先开通交易账户")
                  : t("hl.startCopy", "开启跟单")}
              </span>
            </motion.button>

            {/* leader-scoped 跟单信号 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Radio className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-medium text-foreground/90">{t("hl.copySignals", "跟单信号")}</h3>
              </div>
              {sigQ.isLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
              ) : signals.length === 0 ? (
                <HlEmpty icon={Activity} title={t("hl.noSignals")} desc={t("hl.noSignalsDesc")} />
              ) : (
                <div className="space-y-2">{signals.map((s) => <SignalRow key={s.id} s={s} />)}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
