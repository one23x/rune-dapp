/**
 * Prediction AI Lab — the Polymarket-side mirror of the Hyperliquid AI hub.
 *
 * Gives prediction markets the same transparency the HL side has: a list of
 * autonomous models, each opening into a detail sheet with its recent
 * markets, a live reasoning console, and a log of simulated place/close
 * orders annotated with the model's own reasoning. A unified live console
 * sits at the bottom so the page reads as an always-on feed.
 *
 * All numbers are synthesized deterministically (see `prediction-ai-data`)
 * — there is no Polymarket worker yet — so the feed is stable across
 * reloads and consistent for every viewer.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Brain, Eye, Layers, Search as SearchIcon, Zap, X, ChevronRight,
  Target, List, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  pmOrders, pmStats, type PmOrder, type PmModelStats,
} from "@app/lib/prediction-ai-data";
import {
  PredictionAiConsole, PredictionAiConsoleButton,
} from "@app/components/strategy/prediction-ai-console";

// ─── Models ─────────────────────────────────────────────────────────────────────

interface ModelMeta {
  key: string;
  name: string;
  desc: string;
  color: string;
  icon: React.ElementType;
}

const MODELS: ModelMeta[] = [
  { key: "RUNE", name: "RUNE AI", desc: "Consensus engine · Cross-market edge", color: "#d4a832", icon: Brain },
  { key: "GPT-4o", name: "GPT-4o", desc: "Narrative trader · News & momentum", color: "#4ade80", icon: Brain },
  { key: "Claude", name: "Claude", desc: "Base-rate analyst · Calibrated odds", color: "#a78bfa", icon: Eye },
  { key: "Gemini", name: "Gemini", desc: "Order-flow reader · Liquidity shifts", color: "#60a5fa", icon: Layers },
  { key: "DeepSeek", name: "DeepSeek", desc: "Quant resolver · Probability modeling", color: "#fbbf24", icon: SearchIcon },
  { key: "Llama", name: "Llama", desc: "Sentiment scanner · Crowd signals", color: "#fb923c", icon: Zap },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function shortStamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ─── Outcome / Action badges ──────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: "YES" | "NO" }) {
  const yes = outcome === "YES";
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5 ${
        yes ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
      }`}
    >
      {yes ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {outcome}
    </span>
  );
}

function ActionBadge({ action, color }: { action: "PLACE" | "CLOSE"; color: string }) {
  const { t } = useTranslation();
  const place = action === "PLACE";
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
      style={{
        color: place ? color : "#94a3b8",
        background: place ? `${color}1a` : "rgba(148,163,184,0.12)",
      }}
    >
      {place ? t("pmLab.place", "PLACE") : t("pmLab.close", "CLOSE")}
    </span>
  );
}

// ─── Hit-rate bar ──────────────────────────────────────────────────────────────────

function HitRateBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-[11px] tabular-nums font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── Model card ────────────────────────────────────────────────────────────────────

function ModelCard({ meta, stats, orders, onOpen }: {
  meta: ModelMeta;
  stats: PmModelStats;
  orders: PmOrder[];
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const latest = orders[0];
  const isActive = !!latest && Date.now() - new Date(latest.openedAt).getTime() < 6 * 3600_000;

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl p-4 transition-all duration-200 hover:scale-[1.015] active:scale-[0.99] group"
      style={{
        background: "linear-gradient(145deg, rgba(22,16,8,0.98), rgba(14,10,4,0.99))",
        border: `1px solid ${isActive ? `${meta.color}30` : "rgba(255,255,255,0.08)"}`,
        boxShadow: isActive ? `0 0 20px ${meta.color}0a` : "0 2px 12px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}35` }}>
            <meta.icon className="h-5 w-5" style={{ color: meta.color }} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-foreground/90 leading-tight">{meta.name}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{meta.desc.split("·")[0].trim()}</div>
          </div>
        </div>
        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
      </div>

      <HitRateBar pct={stats.hitRatePct} color={meta.color} />

      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{t("pmLab.resolvedLabel", "Resolved")}</div>
          <div className="text-[13px] font-bold tabular-nums">{stats.resolved}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{t("pmLab.openLabel", "Open")}</div>
          <div className="text-[13px] font-bold tabular-nums">{stats.open}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{t("pmLab.edgeLabel", "Edge")}</div>
          <div className="text-[13px] font-bold tabular-nums">{stats.avgEdgePct.toFixed(1)}%</div>
        </div>
      </div>

      {latest && (
        <div className="mt-2.5 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-1.5 min-w-0">
            <Target className="h-3 w-3 shrink-0" style={{ color: meta.color }} />
            <span className="text-[11px] text-muted-foreground truncate">{latest.market}</span>
          </div>
          <OutcomeBadge outcome={latest.outcome} />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/40">{t("pmLab.confLabel", "Conf")} {stats.avgConfidence.toFixed(0)}%</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
}

// ─── Orders dialog ─────────────────────────────────────────────────────────────────

function OrdersButton({ model, color }: { model: string; color: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const orders = pmOrders(model);
  const closed = orders.filter((o) => o.status === "CLOSED");
  const wins = closed.filter((o) => (o.pnlPct ?? 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
  const avgPnl = closed.length > 0 ? closed.reduce((s, o) => s + (o.pnlPct ?? 0), 0) / closed.length : 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-bold transition-all active:scale-[0.98]"
        style={{ background: `${color}12`, border: `1px solid ${color}25`, color }}
      >
        <List className="h-3.5 w-3.5" />
        {t("pmLab.orders", "Orders")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden"
          style={{ background: "linear-gradient(160deg, hsl(22,20%,4%), hsl(20,15%,3%))", border: `1px solid ${color}22`, maxHeight: "85vh" }}>
          <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-sm font-bold">{model} {t("pmLab.orders", "Orders")}</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>

          <div className="px-4 py-2 grid grid-cols-3 gap-1.5">
            {[
              { l: t("pmLab.win", "Win"), v: `${winRate.toFixed(0)}%`, c: winRate >= 50 ? "#4ade80" : "#f87171" },
              { l: t("pmLab.avgPnl", "Avg PnL"), v: `${avgPnl >= 0 ? "+" : ""}${avgPnl.toFixed(1)}%`, c: avgPnl >= 0 ? "#4ade80" : "#f87171" },
              { l: t("pmLab.total", "Total"), v: orders.length.toString(), c: color },
            ].map((s) => (
              <div key={s.l} className="rounded-lg p-1.5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="text-[12px] font-bold tabular-nums" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[8px] text-muted-foreground uppercase">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="overflow-y-auto max-h-[58vh] px-4 pb-4 space-y-1.5">
            {orders.map((o, i) => (
              <div key={o.id} className="rounded-lg px-3 py-2"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", animation: `fadeSlideIn 0.25s ease-out ${i * 0.03}s both` }}>
                <div className="flex items-center gap-2">
                  <ActionBadge action={o.action} color={color} />
                  <OutcomeBadge outcome={o.outcome} />
                  <span className="text-[11px] font-bold text-foreground/80 truncate flex-1 min-w-0">{o.market}</span>
                  {o.status === "OPEN" ? (
                    <span className="text-[10px] font-bold shrink-0" style={{ color }}>{t("pmLab.statusOpen", "OPEN")}</span>
                  ) : (
                    <span className={`text-[11px] font-bold tabular-nums shrink-0 ${(o.pnlPct ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {(o.pnlPct ?? 0) > 0 ? "+" : ""}{(o.pnlPct ?? 0).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-muted-foreground/55 mt-1">
                  {o.entryCents}¢{o.exitCents ? ` → ${o.exitCents}¢` : ""} · {o.shares} {t("pmLab.shares", "shares")}
                  <span className="text-muted-foreground/40">
                    {" · "}{t("pmLab.opened", "Opened")} {shortStamp(o.openedAt)}
                    {o.closedAt && <> · {t("pmLab.closed", "Closed")} {shortStamp(o.closedAt)}</>}
                  </span>
                </div>
                <div className="text-[10px] text-foreground/55 mt-1 leading-snug flex gap-1">
                  <Brain className="h-3 w-3 mt-0.5 shrink-0" style={{ color: `${color}cc` }} />
                  <span>{o.rationale}</span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Recent markets panel (inside detail) ───────────────────────────────────────────

function RecentMarketsPanel({ color, orders }: { color: string; orders: PmOrder[] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const resolved = orders.filter((o) => o.status === "CLOSED");
  const wins = resolved.filter((o) => (o.pnlPct ?? 0) > 0).length;
  const shown = expanded ? orders : orders.slice(0, 4);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${color}12` }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${color}08` }}>
        <div className="flex items-center gap-1.5">
          <Target className="h-3 w-3" style={{ color }} />
          <span className="text-[11px] font-bold" style={{ color }}>{t("pmLab.recentMarkets", "Recent Markets")}</span>
        </div>
        <span className="text-[9px] text-muted-foreground">
          {t("pmLab.resolvedSummary", "{{wins}}/{{total}} hit · {{open}} open", {
            wins, total: resolved.length, open: orders.length - resolved.length,
          })}
        </span>
      </div>

      <div className="divide-y divide-white/[0.03]">
        {shown.map((o) => {
          const isOpen = o.status === "OPEN";
          const hit = (o.pnlPct ?? 0) > 0;
          return (
            <div key={o.id} className="flex items-center gap-2 px-3 py-2">
              <div className={`h-2 w-2 rounded-full shrink-0 ${isOpen ? "bg-yellow-400 animate-pulse" : hit ? "bg-emerald-400" : "bg-red-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[8px] px-1 rounded bg-white/[0.06] text-muted-foreground">{o.category}</span>
                  <OutcomeBadge outcome={o.outcome} />
                </div>
                <div className="text-[10px] text-foreground/70 truncate mt-0.5">{o.market}</div>
              </div>
              <div className="text-right shrink-0">
                {isOpen ? (
                  <span className="text-[10px] font-bold" style={{ color }}>{o.entryCents}¢</span>
                ) : (
                  <span className={`text-[10px] font-bold ${hit ? "text-emerald-400" : "text-red-400"}`}>
                    {(o.pnlPct ?? 0) >= 0 ? "+" : ""}{(o.pnlPct ?? 0).toFixed(1)}%
                  </span>
                )}
                <div className="text-[8px] text-muted-foreground/30">{timeSince(o.openedAt)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {orders.length > 4 && (
        <button onClick={() => setExpanded((v) => !v)}
          className="w-full py-1.5 text-[10px] text-center transition-colors flex items-center justify-center gap-1"
          style={{ color, borderTop: `1px solid ${color}08` }}>
          {expanded ? (
            <>{t("pmLab.collapse", "Collapse")} <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>{t("pmLab.expandMore", "Show {{count}} more", { count: orders.length - 4 })} <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Model detail sheet ──────────────────────────────────────────────────────────────

function ModelDetail({ meta, stats, orders, onClose }: {
  meta: ModelMeta;
  stats: PmModelStats;
  orders: PmOrder[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolved = orders.filter((o) => o.status === "CLOSED");
  const hits = resolved.filter((o) => (o.pnlPct ?? 0) > 0).length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-full p-0 overflow-hidden"
        style={{ background: "linear-gradient(160deg, hsl(22,20%,5%), hsl(20,15%,4%))", border: `1px solid ${meta.color}22`, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="px-4 pt-4 pb-3 sticky top-0 z-10" style={{ background: "hsl(20,15%,4%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}35` }}>
                <meta.icon className="h-5 w-5" style={{ color: meta.color }} />
              </div>
              <div>
                <div className="text-sm font-bold">{meta.name}</div>
                <div className="text-[11px] text-muted-foreground">{meta.desc}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="px-4 py-3 grid grid-cols-3 gap-2">
          {[
            { label: t("pmLab.hitRateLabel", "Hit Rate"), value: `${stats.hitRatePct.toFixed(1)}%`, color: stats.hitRatePct >= 60 ? "#4ade80" : "hsl(43,74%,52%)" },
            { label: t("pmLab.resolvedLabel", "Resolved"), value: `${stats.resolved}`, color: "hsl(43,74%,52%)" },
            { label: t("pmLab.openLabel", "Open"), value: `${stats.open}`, color: "#60a5fa" },
          ].map((s) => (
            <div key={s.label} className="text-center rounded-lg py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[13px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="px-4 pb-3">
          <div className="rounded-lg p-3 space-y-2" style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}18` }}>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{t("pmLab.confLabel", "Conf")}</span>
              <span className="font-bold" style={{ color: meta.color }}>{stats.avgConfidence.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{t("pmLab.avgEdge", "Avg Edge")}</span>
              <span className="font-bold text-foreground/70">{stats.avgEdgePct.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{t("pmLab.marketsHit", "Markets hit")}</span>
              <span className="font-bold text-foreground/70">{hits}/{resolved.length}</span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-3">
          <RecentMarketsPanel color={meta.color} orders={orders} />
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <div className="flex-1"><PredictionAiConsoleButton model={meta.key} color={meta.color} /></div>
          <div className="flex-1"><OrdersButton model={meta.key} color={meta.color} /></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Global stats ────────────────────────────────────────────────────────────────────

function GlobalStats({ allStats }: { allStats: PmModelStats[] }) {
  const { t } = useTranslation();
  const avgHit = allStats.reduce((s, a) => s + a.hitRatePct, 0) / allStats.length;
  const resolved = allStats.reduce((s, a) => s + a.resolved, 0);
  const open = allStats.reduce((s, a) => s + a.open, 0);

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {[
        { label: t("pmLab.modelsLabel", "Models"), value: `${MODELS.length}`, color: "hsl(43,74%,52%)" },
        { label: t("pmLab.hitRateLabel", "Hit Rate"), value: `${avgHit.toFixed(1)}%`, color: avgHit >= 60 ? "#4ade80" : "hsl(43,74%,52%)" },
        { label: t("pmLab.resolvedLabel", "Resolved"), value: `${resolved}`, color: "#4ade80" },
        { label: t("pmLab.openLabel", "Open"), value: `${open}`, color: "#60a5fa" },
      ].map((s) => (
        <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[14px] font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────────────

export function PredictionAiLab() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [consoleModel, setConsoleModel] = useState<string>(MODELS[0].key);

  const statsByModel = MODELS.map((m) => pmStats(m.key));
  const selectedMeta = MODELS.find((m) => m.key === selected) ?? null;
  const consoleMeta = MODELS.find((m) => m.key === consoleModel) ?? MODELS[0];

  return (
    <div className="px-4 pt-3 pb-6 space-y-4" data-testid="prediction-ai-lab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(212,168,50,0.15)", border: "1px solid rgba(212,168,50,0.25)" }}>
            <Brain className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-foreground/90">{t("pmLab.title", "Prediction AI Lab")}</h2>
            <p className="text-[10px] text-muted-foreground">{t("pmLab.subtitle", "6 models reading prediction markets")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-medium">{t("pmLab.live", "Live")}</span>
        </div>
      </div>

      {/* Global stats */}
      <GlobalStats allStats={statsByModel} />

      {/* Model cards */}
      <div className="grid grid-cols-2 gap-3">
        {MODELS.map((meta, i) => (
          <ModelCard
            key={meta.key}
            meta={meta}
            stats={statsByModel[i]}
            orders={pmOrders(meta.key)}
            onOpen={() => setSelected(meta.key)}
          />
        ))}
      </div>

      {/* Unified live reasoning console */}
      <div className="rounded-2xl p-3 space-y-2" style={{ background: "linear-gradient(145deg, rgba(22,16,8,0.95), rgba(14,10,4,0.98))", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-foreground/90">{t("pmLab.liveConsole", "Live Reasoning Console")}</span>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {MODELS.map((m) => {
              const active = m.key === consoleModel;
              return (
                <button
                  key={m.key}
                  onClick={() => setConsoleModel(m.key)}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap transition-all"
                  style={{
                    color: active ? "#000" : m.color,
                    background: active ? m.color : `${m.color}14`,
                    border: `1px solid ${m.color}33`,
                  }}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
        <PredictionAiConsole key={consoleModel} model={consoleMeta.key} color={consoleMeta.color} isVisible />
      </div>

      {/* Detail */}
      {selected && selectedMeta && (
        <ModelDetail
          meta={selectedMeta}
          stats={pmStats(selected)}
          orders={pmOrders(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
