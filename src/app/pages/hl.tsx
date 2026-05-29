/**
 * Hyperliquid 合约跟单 (HL contract copy-trading), at /app/hl.
 *
 * Repurposes the old AI "strategy" surface into a real HL copy-trading product
 * wired to the engine's Bearer-plane HL reads:
 *   - GET /v1/hl/leaders        → useHlLeaders   (策略包 by risk tier)
 *   - GET /v1/hl/signals        → useHlSignals   (数据源 leader feed)
 *   - GET /v1/hl/account        → useHlAccount   (持仓 / 历史 for the wallet)
 *   - GET /v1/users/:id/hl/subscriptions → useHlSubs (active follows)
 *
 * Top-level mainnet/testnet segmented toggle drives the `network` param
 * everywhere. One-click copy attempts POST .../hl/subscriptions and degrades
 * gracefully when that create route isn't shipped yet (see useHlCopy).
 *
 * The legacy AI-strategy page lives untouched at /app/strategy; this is a
 * NEW page + nav entry, so nothing breaks.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import {
  Sparkles, Users, Activity, Layers, History as HistoryIcon, ChevronDown, ChevronRight,
  Wallet, TrendingUp, TrendingDown, Zap, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PremiumCard, GoldCard } from "@app/components/premium-card";
import { cn } from "@app/lib/utils";
import {
  useEngineUser, useHlLeaders, useHlSignals, useHlAccount, useHlSubs,
} from "@app/lib/engine-hooks";
import type { HlLeader, HlNetwork, HlPosition, HlSignal } from "@app/lib/engine";
import {
  NetworkToggle, HlEmpty, useHlCopy, groupByTier, HL_TIERS, TIER_META,
  shortAddr, fmtUsd, fmtHold, fmtScore, fmtTimeAgo,
} from "@app/components/hl/shared";

// ── Hero / layout chrome (mirrors copy-trading layout) ───────────────────────

function HlHero({ network, onNetwork, actions }: { network: HlNetwork; onNetwork: (n: HlNetwork) => void; actions?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <GoldCard className="rounded-2xl">
      <div
        className="relative overflow-hidden rounded-2xl p-4 lg:p-5"
        style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.14) 0%, rgba(180,90,10,0.06) 60%, transparent 100%)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Hyperliquid · One-Agents
              </span>
            </div>
            <h1 className="text-lg lg:text-xl font-bold text-foreground truncate" style={{ fontFamily: "'Orbitron', 'Space Grotesk', sans-serif" }}>
              {t("hl.title")}
            </h1>
            <p className="mt-1 text-[12px] text-foreground/55 leading-relaxed max-w-md">{t("hl.subtitle")}</p>
          </div>
          {actions}
        </div>
        <div className="mt-3">
          <NetworkToggle value={network} onChange={onNetwork} />
        </div>
      </div>
    </GoldCard>
  );
}

// ── Account stat strip (持仓 totals) ─────────────────────────────────────────

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <PremiumCard className="p-3 text-center min-w-0">
      <div className="text-[15px] font-black tabular-nums truncate num-gold" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide truncate">{label}</div>
    </PremiumCard>
  );
}

// ── Leader card (策略包 tier list) ───────────────────────────────────────────

function LeaderCard({
  leader, onCopy, copying, subscribed,
}: { leader: HlLeader; onCopy: (l: HlLeader) => void; copying: boolean; subscribed: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "linear-gradient(145deg, rgba(22,16,8,0.98), rgba(14,10,4,0.99))",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <code className="text-[12px] font-mono font-bold text-foreground/85 truncate">{leader.label || shortAddr(leader.address)}</code>
          {leader.isHft && <Badge className="text-[8px] px-1 py-0 border-0 bg-red-500/20 text-red-300 no-default-hover-elevate no-default-active-elevate">HFT</Badge>}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{shortAddr(leader.address)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mt-2.5">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.score")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtScore(leader.score)}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.medHold")}</div><div className="text-[12px] font-bold tabular-nums">{fmtHold(leader.medianHoldingS)}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.style")}</div><div className="text-[12px] font-bold">{leader.isHft ? t("hl.styleHft") : t("hl.styleSwing")}</div></div>
      </div>
      <button
        onClick={() => onCopy(leader)}
        disabled={copying || subscribed}
        className={cn(
          "w-full mt-2.5 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold transition-all active:scale-[0.98] disabled:opacity-60",
          subscribed
            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
            : "bg-gradient-to-r from-amber-500 to-yellow-600 text-black border border-amber-500/50",
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        {subscribed ? t("hl.copying") : copying ? t("hl.starting") : t("hl.copyNow")}
      </button>
    </div>
  );
}

// ── 策略包 tab — leaders grouped into expandable risk-tier categories ────────

function StrategyPacksTab({
  network, userId, subscribedLeaders,
}: { network: HlNetwork; userId?: string; subscribedLeaders: Set<string> }) {
  const { t } = useTranslation();
  const leadersQ = useHlLeaders(network);
  const { copy, pendingFor } = useHlCopy(userId, network);
  const [open, setOpen] = useState<Record<string, boolean>>({ conservative: true, steady: true });

  const grouped = useMemo(() => groupByTier(leadersQ.data?.leaders ?? []), [leadersQ.data]);

  if (leadersQ.isLoading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }
  const total = (leadersQ.data?.leaders ?? []).length;
  if (total === 0) {
    return <HlEmpty icon={Users} title={t("hl.noLeaders")} desc={t("hl.noLeadersDesc")} />;
  }

  return (
    <div className="space-y-2.5">
      {HL_TIERS.map((tier) => {
        const list = grouped[tier];
        const meta = TIER_META[tier];
        const Icon = meta.icon;
        const isOpen = open[tier] ?? false;
        return (
          <PremiumCard key={tier} className="overflow-hidden">
            <button
              onClick={() => setOpen((s) => ({ ...s, [tier]: !isOpen }))}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
            >
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}35` }}>
                <Icon className="h-4 w-4" style={{ color: meta.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-foreground/90">{t(meta.labelKey)}</span>
                  <Badge className="text-[9px] px-1.5 py-0 border-0 no-default-hover-elevate no-default-active-elevate" style={{ background: `${meta.color}1f`, color: meta.color }}>{list.length}</Badge>
                </div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{t(meta.descKey)}</div>
              </div>
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>
            {isOpen && (
              <div className="px-2.5 pb-2.5 pt-0.5 space-y-2 border-t border-border/30">
                {list.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground/60 text-center py-4">{t("hl.tierEmpty")}</p>
                ) : (
                  list.map((l) => (
                    <LeaderCard
                      key={l.address}
                      leader={l}
                      onCopy={copy}
                      copying={pendingFor?.toLowerCase() === l.address.toLowerCase()}
                      subscribed={subscribedLeaders.has(l.address.toLowerCase())}
                    />
                  ))
                )}
              </div>
            )}
          </PremiumCard>
        );
      })}
    </div>
  );
}

// ── 数据源 tab — live leader signal feed ─────────────────────────────────────

function SignalRow({ s }: { s: HlSignal }) {
  const { t } = useTranslation();
  const long = s.side === "LONG";
  return (
    <PremiumCard className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
            {long ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {s.side}
          </span>
          <span className="text-[13px] font-bold text-foreground/90">{s.coin}</span>
          {s.isClose && <Badge className="text-[8px] px-1 py-0 border-0 bg-white/[0.06] text-foreground/50 no-default-hover-elevate no-default-active-elevate">{t("hl.close")}</Badge>}
        </div>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtTimeAgo(s.happenedAt, t)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mt-2 text-center">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.price")}</div><div className="text-[12px] font-bold tabular-nums">{s.px > 0 ? s.px.toLocaleString() : "—"}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.notional")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtUsd(s.notionalUsd)}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.leader")}</div><div className="text-[11px] font-mono font-bold truncate">{shortAddr(s.leaderAddress)}</div></div>
      </div>
    </PremiumCard>
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

function PositionRow({ p }: { p: HlPosition }) {
  const { t } = useTranslation();
  const long = p.side === "LONG";
  return (
    <PremiumCard className="p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-foreground/90">{p.coin}</span>
          <span className={cn("inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
            {p.side}
          </span>
          {p.leverage != null && <Badge className="text-[9px] px-1 py-0 border-0 bg-amber-500/15 text-amber-300 no-default-hover-elevate no-default-active-elevate">{p.leverage}x</Badge>}
        </div>
        <span className={cn("text-[12px] font-bold tabular-nums", p.upnl >= 0 ? "text-emerald-400" : "text-red-400")}>{fmtUsd(p.upnl)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.size")}</div><div className="text-[12px] font-bold tabular-nums">{Math.abs(p.size).toLocaleString()}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.entry")}</div><div className="text-[12px] font-bold tabular-nums">{p.entryPx != null ? p.entryPx.toLocaleString() : "—"}</div></div>
        <div><div className="text-[8px] text-muted-foreground uppercase tracking-wide">{t("hl.value")}</div><div className="text-[12px] font-bold tabular-nums num-gold">{fmtUsd(p.positionValue)}</div></div>
      </div>
    </PremiumCard>
  );
}

function HistoryRow({ s }: { s: HlSignal }) {
  const { t } = useTranslation();
  const long = s.side === "LONG";
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0", long ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>{s.side}</span>
        <span className="text-[12px] font-bold text-foreground/85">{s.coin}</span>
        <Badge className="text-[8px] px-1 py-0 border-0 bg-white/[0.06] text-foreground/50 no-default-hover-elevate no-default-active-elevate">{s.isClose ? t("hl.close") : t("hl.open")}</Badge>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[11px] tabular-nums num-gold">{fmtUsd(s.notionalUsd)}</span>
        <span className="text-[10px] text-muted-foreground/60">{fmtTimeAgo(s.happenedAt, t)}</span>
      </div>
    </div>
  );
}

function MyPositionsTab({ network }: { network: HlNetwork }) {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const acctQ = useHlAccount(wallet, network);
  // History = recent close fills across leaders on this network (the engine
  // doesn't expose a per-follower fill history on the Bearer plane, so we use
  // the leader signal close-feed as the network activity record).
  const sigQ = useHlSignals(network, { limit: 40 });

  if (!wallet) {
    return <HlEmpty icon={Wallet} title={t("hl.connectTitle")} desc={t("hl.connectDesc")} />;
  }

  const positions = acctQ.data?.positions ?? [];
  const history = (sigQ.data?.signals ?? []).filter((s) => s.isClose);

  return (
    <Tabs defaultValue="open" className="w-full">
      <TabsList className="w-full grid grid-cols-2 mb-3">
        <TabsTrigger value="open" className="text-xs">{t("hl.subTabOpen")}</TabsTrigger>
        <TabsTrigger value="history" className="text-xs">{t("hl.subTabHistory")}</TabsTrigger>
      </TabsList>

      <TabsContent value="open" className="space-y-2 mt-0">
        {acctQ.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : acctQ.isError ? (
          <HlEmpty icon={Layers} title={t("hl.acctError")} desc={t("hl.acctErrorDesc")} />
        ) : positions.length === 0 ? (
          <HlEmpty icon={Layers} title={t("hl.noPositions")} desc={t("hl.noPositionsDesc")} />
        ) : (
          positions.map((p, i) => <PositionRow key={`${p.coin}-${i}`} p={p} />)
        )}
      </TabsContent>

      <TabsContent value="history" className="space-y-1.5 mt-0">
        {sigQ.isLoading ? (
          <div className="space-y-1.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : history.length === 0 ? (
          <HlEmpty icon={HistoryIcon} title={t("hl.noHistory")} desc={t("hl.noHistoryDesc")} />
        ) : (
          history.map((s) => <HistoryRow key={s.id} s={s} />)
        )}
      </TabsContent>
    </Tabs>
  );
}

// ── Active subscriptions strip ───────────────────────────────────────────────

function ActiveSubs({ userId }: { userId?: string }) {
  const { t } = useTranslation();
  const subsQ = useHlSubs(userId);
  const subs = (subsQ.data?.subscriptions ?? []).filter((s: any) => s.status !== "stopped");
  if (!userId || subsQ.isLoading || subs.length === 0) return null;
  return (
    <PremiumCard className="p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Crown className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-[11px] uppercase tracking-wider text-foreground/50 font-semibold">{t("hl.activeFollows")}</span>
        <Badge className="text-[9px] px-1.5 py-0 border-0 bg-amber-500/15 text-amber-300 no-default-hover-elevate no-default-active-elevate ml-auto">{subs.length}</Badge>
      </div>
      <div className="space-y-1.5">
        {subs.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
            <code className="font-mono text-foreground/80 truncate">{shortAddr(s.leaderAddress)}</code>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground/70">{(Number(s.ratio) * 100).toFixed(0)}% · {s.maxLeverage}x</span>
              <Badge className="text-[9px] px-1.5 py-0 border-0 bg-emerald-500/15 text-emerald-300 no-default-hover-elevate no-default-active-elevate">{s.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </PremiumCard>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type TopTab = "packs" | "data" | "positions";

export default function HlPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const [network, setNetwork] = useState<HlNetwork>("mainnet");
  const [tab, setTab] = useState<TopTab>("packs");

  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;

  const acctQ = useHlAccount(wallet, network);
  const subsQ = useHlSubs(userId);

  const subscribedLeaders = useMemo(() => {
    const set = new Set<string>();
    for (const s of subsQ.data?.subscriptions ?? []) {
      if ((s as any).status !== "stopped") set.add(String((s as any).leaderAddress).toLowerCase());
    }
    return set;
  }, [subsQ.data]);

  const acct = acctQ.data;
  const openPnl = acct?.unrealizedPnl ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 lg:pb-8" data-testid="page-hl">
      <div className="max-w-lg lg:max-w-4xl mx-auto px-4 py-5 space-y-4">
        <HlHero network={network} onNetwork={setNetwork} />

        {/* Account stat strip — real HL account state for the connected wallet */}
        {wallet && (
          acctQ.isLoading ? (
            <div className="grid grid-cols-4 gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              <StatTile label={t("hl.accountValue")} value={fmtUsd(acct?.accountValue ?? 0)} />
              <StatTile label={t("hl.openPositions")} value={String(acct?.positions.length ?? 0)} />
              <StatTile label={t("hl.unrealized")} value={fmtUsd(openPnl)} accent={openPnl >= 0 ? "#4ade80" : "#f87171"} />
              <StatTile label={t("hl.follows")} value={String(subscribedLeaders.size)} accent="#60a5fa" />
            </div>
          )
        )}

        <ActiveSubs userId={userId} />

        {/* Top tabs: 策略包 / 数据源 / 持仓 */}
        <div className="flex gap-1.5 rounded-xl border border-border/55 bg-card/60 p-1 surface-3d">
          {([
            { id: "packs", labelKey: "hl.tabPacks", icon: Users },
            { id: "data", labelKey: "hl.tabData", icon: Activity },
            { id: "positions", labelKey: "hl.tabPositions", icon: Layers },
          ] as const).map((x) => {
            const Icon = x.icon;
            const active = tab === x.id;
            return (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                className={cn(
                  "flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-[12px] font-bold tracking-wide transition-all",
                  active
                    ? "bg-gradient-to-br from-amber-500/20 via-amber-600/15 to-amber-700/10 ring-1 ring-amber-500/35 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/80",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate">{t(x.labelKey)}</span>
              </button>
            );
          })}
        </div>

        <div style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
          {tab === "packs" && <StrategyPacksTab network={network} userId={userId} subscribedLeaders={subscribedLeaders} />}
          {tab === "data" && <DataSourceTab network={network} />}
          {tab === "positions" && <MyPositionsTab network={network} />}
        </div>
      </div>
    </div>
  );
}
