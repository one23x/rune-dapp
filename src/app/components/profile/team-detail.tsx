/**
 * Native app-style rewrite of the marketing dashboard's Team + Rewards tabs.
 *
 * Same data + functionality as `@/pages/dashboard`'s `TeamTab` / `RewardsTab`
 * (drill-down referral tree, tier composition, KPI strip, commission list)
 * but rebuilt in the app's own design language — clean `Card` surfaces,
 * `text-neon-value` numbers, shadcn `Badge` tier pills, `Skeleton` loaders —
 * so the page no longer pulls the entire marketing dashboard module graph.
 *
 * Data hooks are the shared Supabase-backed ones under `@/hooks/rune/*`;
 * those are leaf libs (not pages) so importing them keeps the /app bundle
 * decoupled from the marketing `/dashboard` route.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Users, Coins, TrendingUp, Gift, ChevronRight, Copy, Check,
  Search, ArrowDownUp, ExternalLink,
} from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTeam, usePersonalStats, useRewards,
  type ReferrerRow, type RewardRow, type PersonalStats,
} from "@/hooks/rune/use-team";
import { NODE_META, type NodeId } from "@/lib/thirdweb/contracts";
import { copyText } from "@app/lib/copy";

// Apex → entry order so tier strips always read 符主 → 符胚.
const TIER_ORDER: NodeId[] = [101, 201, 301, 401, 501];

/** 18-decimal bigint/string → human USDT string. */
function fmtUsdt(raw: string | bigint | undefined | null, dec = 2): string {
  if (raw === undefined || raw === null) return "—";
  let v: bigint;
  try { v = typeof raw === "string" ? BigInt(raw) : raw; } catch { return "—"; }
  const base = 10n ** 18n;
  const whole = v / base;
  if (dec === 0) return whole.toLocaleString("en-US");
  const fracStr = (v % base).toString().padStart(18, "0").slice(0, dec).replace(/0+$/, "");
  return fracStr ? `${whole.toLocaleString("en-US")}.${fracStr}` : whole.toLocaleString("en-US");
}

const short = (a: string | undefined) =>
  !a ? "—" : `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Copyable short-address chip — app surface styling. */
function AddressChip({ address, accent = false }: { address: string; accent?: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  async function onCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (await copyText(address)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  }
  return (
    <span
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${
        accent ? "border-amber-500/40 bg-amber-500/10 text-amber-100" : "border-border/50 bg-card/50 text-foreground/80"
      }`}
    >
      {short(address)}
      <button type="button" onClick={onCopy} aria-label={t("common.copyAddress", "Copy address")}
        className={`shrink-0 transition-colors ${copied ? "text-emerald-400" : "opacity-60 hover:opacity-100 hover:text-amber-400"}`}>
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

/** Tier pill from on-chain nodeId, or a muted "no node" chip. */
function TierBadge({ nodeId }: { nodeId: number | null | undefined }) {
  const { t } = useTranslation();
  const meta = nodeId ? NODE_META[nodeId as NodeId] : null;
  if (!meta) {
    return (
      <Badge variant="secondary" className="text-[10px] opacity-60 shrink-0">
        {t("profile.team.noNode", "未持节点")}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] shrink-0 gap-1">
      <span className={meta.color}>{meta.nameCn}</span>
      <span className="opacity-80">${(meta.priceUsdt / 1000).toFixed(meta.priceUsdt % 1000 ? 1 : 0)}K</span>
    </Badge>
  );
}

/** Compact stat tile — premium motion card: fade-up entrance, hover lift,
 *  gradient surface + a radial glow aurora that blooms on hover. */
function KpiTile({
  icon: Icon, label, value, sub, highlight = false, delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string; highlight?: boolean; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
      whileHover={{ y: -3 }}
      className={`group relative overflow-hidden rounded-xl p-3 sm:p-4 transition-colors duration-300 ${
        highlight
          ? "border border-amber-500/55 bg-gradient-to-br from-amber-900/40 via-card/70 to-card/80 shadow-[0_0_30px_-6px_rgba(251,191,36,0.45)]"
          : "premium-card"
      }`}
    >
      <div aria-hidden className={`pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
        highlight
          ? "bg-[radial-gradient(circle_at_78%_-20%,rgba(251,191,36,0.22),transparent_55%)]"
          : "bg-[radial-gradient(circle_at_78%_-20%,rgba(251,191,36,0.10),transparent_55%)]"}`} />
      <div className="relative flex items-center justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground/85">{label}</span>
        <Icon className={`h-4 w-4 transition-colors ${highlight ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "text-muted-foreground/70 group-hover:text-amber-400/70"}`} />
      </div>
      <div className={`relative text-xl sm:text-2xl font-bold tabular-nums leading-tight ${highlight ? "num-gold" : "text-neon-value"}`}>{value}</div>
      {sub && <div className="relative text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </motion.div>
  );
}

/** Gradient section header — amber icon chip + label, used to top each card. */
function SectionTitle({
  icon: Icon, children, extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-lg ring-1 ring-amber-400/40 shrink-0"
        style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.30),rgba(180,90,10,0.16))" }}>
        <Icon className="h-3.5 w-3.5 text-amber-200" />
      </span>
      <span className="text-[12px] font-bold tracking-wide">{children}</span>
      {extra}
    </div>
  );
}

/** Three inline badges per tree row: tier · headcount · umbrella volume. */
function RowBadges({ stats }: { stats: PersonalStats | undefined }) {
  if (!stats) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <TierBadge nodeId={stats.ownedNodeId} />
      <Badge variant="secondary" className="text-[10px] shrink-0">👥 {stats.totalDownstreamCount}</Badge>
      <Badge variant="secondary" className="text-[10px] shrink-0">💰 ${fmtUsdt(stats.totalDownstreamInvested, 0)}</Badge>
    </div>
  );
}

/** Tier composition — direct vs full-team toggle, 5 horizontal bars. */
function TierComposition({ stats }: { stats: PersonalStats }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"direct" | "team">("direct");
  const rows = useMemo(() => {
    const src = mode === "direct" ? stats.directByTier : stats.teamByTier;
    const byId = new Map(src.map((r) => [r.nodeId, r.count]));
    return TIER_ORDER.map((id) => ({ id, count: byId.get(id) ?? 0, meta: NODE_META[id] }));
  }, [stats, mode]);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <Card className="premium-card border-border">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle icon={Coins} extra={<span className="text-[11px] font-mono text-muted-foreground ml-1">{total}</span>}>
            {t("profile.team.composition", "团队构成")}
          </SectionTitle>
          <div className="inline-flex rounded-full border border-border/60 bg-background/50 p-0.5 text-[10px]">
            {(["direct", "team"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`px-2.5 py-0.5 rounded-full transition-colors ${
                  mode === m ? "bg-amber-500/20 text-amber-200" : "text-muted-foreground hover:text-foreground"
                }`}>
                {m === "direct" ? t("profile.team.direct", "直推") : t("profile.team.full", "伞下")}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className={`w-12 text-[11px] font-mono shrink-0 ${r.meta.color}`}>{r.meta.nameCn}</span>
              <div className="flex-1 h-2.5 rounded-full bg-card/80 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(r.count / max) * 100}%`, backgroundColor: `rgb(${r.meta.rgb})` }} />
              </div>
              <span className="w-8 text-right text-[11px] font-mono tabular-nums text-muted-foreground">{r.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** One direct-downline row — clicking drills into that wallet. */
function TreeRow({ row, onDrill }: { row: ReferrerRow; onDrill: () => void }) {
  const { data: stats } = usePersonalStats(row.user);
  return (
    <button type="button" onClick={onDrill}
      className="w-full flex items-center gap-2 py-2.5 px-3 rounded-lg border border-border/50 bg-card/40 hover:border-amber-500/45 hover:bg-amber-500/[0.06] transition-colors flex-wrap text-left group">
      <AddressChip address={row.user} />
      <RowBadges stats={stats} />
      <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1.5">
        <span className="tabular-nums">{new Date(row.boundAt).toLocaleDateString()}</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 group-hover:text-amber-400 transition-all" />
      </span>
    </button>
  );
}

// ── Team panel ────────────────────────────────────────────────────────────
export function TeamPanel({ address }: { address: string }) {
  const { t } = useTranslation();
  // path[0] = connected root; path[last] = wallet under inspection.
  const [path, setPath] = useState<string[]>([address.toLowerCase()]);
  useEffect(() => { setPath([address.toLowerCase()]); }, [address]);

  const current = path[path.length - 1];
  const { data: focusStats } = usePersonalStats(current);
  const { data: rootStats } = usePersonalStats(path[0]);
  const { data: children, isLoading } = useTeam(current);

  return (
    <div className="space-y-4">
      {/* Root KPIs — always the connected wallet, never the drill focus. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiTile icon={Users} delay={0.02} label={t("profile.team.directCount", "直推人数")}
          value={rootStats ? String(rootStats.directCount) : "…"} sub={t("profile.team.firstLayer", "第一层")} />
        <KpiTile icon={Users} delay={0.06} label={t("profile.team.totalCount", "团队总人数")}
          value={rootStats ? String(rootStats.totalDownstreamCount) : "…"} sub={t("profile.team.recursive", "全部下级")} />
        <KpiTile icon={Coins} delay={0.10} label={t("profile.team.directInvested", "直推业绩")}
          value={rootStats ? `$${fmtUsdt(rootStats.directTotalInvested, 0)}` : "…"} sub="USDT" />
        <KpiTile icon={TrendingUp} delay={0.14} label={t("profile.team.teamInvested", "团队业绩")}
          value={rootStats ? `$${fmtUsdt(rootStats.totalDownstreamInvested, 0)}` : "…"} sub="USDT" highlight />
      </div>

      {rootStats && (rootStats.directByTier.length > 0 || rootStats.teamByTier.length > 0) && (
        <TierComposition stats={rootStats} />
      )}

      {/* Drill-down referral tree */}
      <Card className="premium-card border-border">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <SectionTitle icon={Users}>{t("profile.team.tree", "推荐网络")}</SectionTitle>

          {/* Breadcrumb: Root (You) › 0x… › current */}
          <div className="flex items-center gap-1 flex-wrap text-xs">
            {path.map((addr, i) => {
              const isLast = i === path.length - 1;
              const isRoot = i === 0;
              const label = isRoot ? t("profile.team.rootSelf", "我（根）") : short(addr);
              return (
                <div key={`${addr}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/70" />}
                  {isLast ? (
                    <span className={`font-mono px-2 py-1 rounded-md text-[11px] ${
                      isRoot ? "bg-amber-500/15 border border-amber-500/40 text-amber-200"
                             : "bg-card/70 border border-border/50 text-foreground"}`}>{label}</span>
                  ) : (
                    <button type="button" onClick={() => setPath((p) => p.slice(0, i + 1))}
                      className="font-mono px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-amber-300 hover:bg-amber-500/10 transition-colors">{label}</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Focus header */}
          <div className={`rounded-lg border p-3 flex items-center gap-2 flex-wrap ${
            current === path[0] ? "border-amber-500/45 bg-amber-500/[0.06]" : "border-border/50 bg-card/40"}`}>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest shrink-0">
              {current === path[0] ? t("profile.team.rootSelf", "我（根）") : `L${path.length - 1}`}
            </Badge>
            <AddressChip address={current} accent={current === path[0]} />
            <RowBadges stats={focusStats} />
            <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
              {focusStats ? `${focusStats.directCount} ${t("profile.team.directShort", "直推")}` : ""}
            </span>
          </div>

          {/* Direct downlines of current focus */}
          <div className="space-y-1.5">
            {isLoading ? (
              <div className="space-y-1.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : !children || children.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Users className="h-6 w-6 mx-auto mb-2 opacity-30" />
                {current === path[0] ? t("profile.team.noInvitees", "暂无直推成员") : t("profile.team.noDownstream", "该成员暂无下级")}
              </div>
            ) : (
              children.map((c) => <TreeRow key={c.user} row={c} onDrill={() => setPath((p) => [...p, c.user.toLowerCase()])} />)
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground/80 text-center">
        {t("profile.team.treeNote", "点击任意成员可向下钻取，点击面包屑可返回上层")}
      </p>
    </div>
  );
}

// ── Rewards panel ─────────────────────────────────────────────────────────
function RewardRowItem({ row }: { row: RewardRow }) {
  const { t } = useTranslation();
  const meta = NODE_META[row.nodeId as NodeId];
  const hasTx = row.txHash.startsWith("0x");
  const explorer = (row.chainId === 56 ? "https://bscscan.com/tx/" : "https://testnet.bscscan.com/tx/") + row.txHash;
  return (
    <Card className="border-border bg-card/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-mono uppercase w-14 shrink-0 ${meta?.color ?? "text-muted-foreground"}`}>
            {meta?.nameEn ?? `#${row.nodeId}`}
          </span>
          <AddressChip address={row.downline} />
          <span className="ml-auto text-sm font-bold tabular-nums text-neon-value shrink-0">+${fmtUsdt(row.commission, 4)}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-1.5 pl-[3.75rem] text-[11px] text-muted-foreground">
          <span className="tabular-nums">{new Date(row.paidAt).toLocaleString()}</span>
          <span className="font-mono tabular-nums opacity-80">{(row.directRate / 100).toFixed(row.directRate % 100 === 0 ? 0 : 1)}%</span>
          {hasTx && (
            <a href={explorer} target="_blank" rel="noopener noreferrer"
              className="ml-auto hover:text-amber-400 transition-colors" title={t("profile.team.viewTx", "查看交易")}>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function RewardsPanel({ address }: { address: string }) {
  const { t } = useTranslation();
  const { data: stats } = usePersonalStats(address);
  const { data: rewards, isLoading } = useRewards(address);

  const [q, setQ] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const filtered = useMemo(() => {
    if (!rewards) return [];
    const needle = q.trim().toLowerCase();
    const list = rewards.filter((r) => !needle || r.downline.toLowerCase().includes(needle));
    list.sort((a, b) => {
      const d = new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime();
      return order === "desc" ? -d : d;
    });
    return list;
  }, [rewards, q, order]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <KpiTile icon={Users} delay={0.02} label={t("profile.team.validDirect", "有效直推")}
          value={stats ? String(stats.directPurchaseCount) : "…"} sub={t("profile.team.validDirectSub", "已购节点直推")} />
        <KpiTile icon={Gift} delay={0.06} label={t("profile.team.cumulative", "累计佣金")}
          value={stats ? `$${fmtUsdt(stats.directCommission, 2)}` : "…"} sub="USDT" highlight />
      </div>

      <Card className="premium-card border-border">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <SectionTitle icon={Gift}>{t("profile.team.rewardList", "佣金明细")}</SectionTitle>

          {/* Filter row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={t("profile.team.searchAddr", "搜索下级地址")}
                className="w-full h-9 pl-7 pr-2 rounded-md border border-border/50 bg-background/60 text-xs font-mono focus:border-amber-500/60 focus:outline-none transition-colors" />
            </div>
            <button type="button" onClick={() => setOrder((o) => (o === "desc" ? "asc" : "desc"))}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border/50 bg-background/60 text-xs hover:border-amber-500/50 hover:text-amber-200 transition-colors">
              <ArrowDownUp className="h-3.5 w-3.5" />
              {order === "desc" ? t("profile.team.newest", "最新") : t("profile.team.oldest", "最早")}
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}</div>
          ) : !rewards || rewards.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Gift className="h-8 w-8 mx-auto mb-3 opacity-30" />
              {t("profile.team.rewardEmpty", "暂无佣金记录")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Search className="h-6 w-6 mx-auto mb-2 opacity-40" />
              {t("profile.team.noMatch", "无匹配记录")}
            </div>
          ) : (
            <div className="space-y-2">{filtered.map((r) => <RewardRowItem key={r.txHash} row={r} />)}</div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground/80 text-center">
        {t("profile.team.rewardNote", "佣金按链上直推关系实时结算")}
      </p>
    </div>
  );
}
