import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@app/lib/queryClient";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, Flame, Sparkles, Clock, TrendingUp, Zap, ChevronRight, AlertCircle } from "lucide-react";
import { useRunePrice } from "@app/hooks/use-rune-price";
import { cn } from "@app/lib/utils";
import { apiPost } from "@app/lib/api";
import { useToast } from "@app/hooks/use-toast";

type PosTab = "lock" | "burn" | "ember";

interface RuneLockPosition {
  id: string;
  usdtAmount?: string;
  runeAmount: string;
  lockDays: number;
  veRune: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface EmberBurnPosition {
  id: string;
  usdtAmount?: string;
  runeAmount: string;
  dailyRate: string;
  totalClaimedEmber: string;
  pendingEmber?: string;
  lastClaimAt: string;
  status: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function fmtRune(v: string | number) {
  const n = Number(v);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(2);
}

function calcPendingEmber(pos: EmberBurnPosition) {
  const daysSince = Math.max(0, (Date.now() - new Date(pos.lastClaimAt).getTime()) / (1000 * 60 * 60 * 24));
  return Number(pos.runeAmount) * Number(pos.dailyRate) * daysSince;
}

function calcDaysLeft(endDate: string) {
  const msLeft = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
}

export default function ProfileVaultPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const wallet = account?.address || "";
  const isConnected = !!wallet;
  const { price: runePrice } = useRunePrice();
  const [activeTab, setActiveTab] = useState<PosTab>("lock");

  const { data: lockPositions = [], isLoading: lockLoading } = useQuery<RuneLockPosition[]>({
    queryKey: ["/api/rune-lock", wallet],
    queryFn: () => fetch(`/api/rune-lock?wallet=${wallet}`).then(r => r.json()),
    enabled: isConnected,
  });

  const { data: burnPositions = [], isLoading: burnLoading } = useQuery<EmberBurnPosition[]>({
    queryKey: ["/api/ember-burn", wallet],
    queryFn: () => fetch(`/api/ember-burn?wallet=${wallet}`).then(r => r.json()),
    enabled: isConnected,
  });

  const claimMutation = useMutation({
    mutationFn: (positionId: string) =>
      apiPost("/api/ember-burn/claim", { walletAddress: wallet, positionId }),
    onSuccess: (_, positionId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn", wallet] });
      toast({ title: t("profileVault.claimed", "领取成功"), description: t("profileVault.claimedDesc", "FIRE 已领取") });
    },
    onError: () => toast({ title: t("profileVault.claimFailed", "领取失败"), variant: "destructive" }),
  });

  const TABS: Array<{ key: PosTab; icon: React.ElementType; label: string; accent: string; count: number }> = [
    { key: "lock",  icon: Lock,     label: t("profileVault.tabLock", "锁仓RUNE"),  accent: "rgba(212,168,50,0.9)", count: lockPositions.filter(p => p.status === "ACTIVE").length },
    { key: "burn",  icon: Flame,    label: t("profileVault.tabBurn", "销毁RUNE"),  accent: "rgba(239,68,68,0.9)",  count: burnPositions.filter(p => p.status === "ACTIVE").length },
    { key: "ember", icon: Sparkles, label: t("profileVault.tabEmber", "锁仓FIRE"), accent: "rgba(251,146,60,0.9)", count: 0 },
  ];

  const activeTabData = TABS.find(t => t.key === activeTab)!;

  return (
    <div className="pb-24 lg:pb-8">
      {/* Header */}
      <div className="px-4 lg:px-6 pt-4 pb-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={() => navigate("/profile")}
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 hover:bg-white/10 transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          data-testid="button-back-profile"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div>
          <h2 className="text-sm font-bold tracking-tight">
            {t("profileVault.headerTitle", "我的金库仓位")}
          </h2>
          <p className="text-[10px] text-muted-foreground">
            {t("profileVault.headerSubtitle", "锁仓 · 销毁 · FIRE锁仓")}
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 lg:px-6 pt-4">
        <div className="grid grid-cols-3 gap-1.5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all text-center",
                  isActive ? "" : "opacity-45 hover:opacity-65"
                )}
                style={isActive ? {
                  background: `${tab.accent}12`,
                  border: `1px solid ${tab.accent}30`,
                } : {
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                data-testid={`tab-profile-vault-${tab.key}`}
              >
                <Icon className="h-4 w-4" style={{ color: isActive ? tab.accent : "rgba(255,255,255,0.35)" }} />
                <span className="text-[10px] font-bold leading-none"
                  style={{ color: isActive ? tab.accent : "rgba(255,255,255,0.4)" }}>
                  {tab.label}
                </span>
                {tab.count > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: `${tab.accent}20`, color: tab.accent }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 lg:mx-6 mt-3"
        style={{ borderTop: `1px solid ${activeTabData.accent}20` }} />

      {/* ─── LOCK RUNE positions ─── */}
      {activeTab === "lock" && (
        <div className="px-4 lg:px-6 pt-4 space-y-3">
          {!isConnected ? (
            <NotConnected />
          ) : lockLoading ? (
            [1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : lockPositions.length === 0 ? (
            <EmptyState
              icon={Lock}
              accent="rgba(212,168,50,0.9)"
              title={t("profileVault.emptyLockTitle", "暂无锁仓记录")}
              desc={t("profileVault.emptyLockDesc", "前往金库锁仓RUNE获得veRUNE权益")}
              onAction={() => navigate("/vault")}
              action={t("profileVault.emptyLockAction", "去锁仓")}
            />
          ) : (
            lockPositions.map(pos => {
              const daysLeft = calcDaysLeft(pos.endDate);
              const pct = pos.lockDays > 0 ? Math.min(100, ((pos.lockDays - daysLeft) / pos.lockDays) * 100) : 100;
              const isExpired = daysLeft === 0;
              return (
                <div
                  key={pos.id}
                  className="rounded-xl p-3.5 space-y-2.5"
                  style={{
                    background: "linear-gradient(135deg, rgba(212,168,50,0.06), rgba(180,130,30,0.03))",
                    border: "1px solid rgba(212,168,50,0.18)",
                  }}
                  data-testid={`card-lock-position-${pos.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(212,168,50,0.15)", border: "1px solid rgba(212,168,50,0.25)" }}>
                        <Lock className="h-3.5 w-3.5" style={{ color: "rgba(212,168,50,0.9)" }} />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold" style={{ color: "rgba(212,168,50,0.9)" }}>
                          {fmtRune(pos.runeAmount)} RUNE
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {pos.lockDays}D · {fmtDate(pos.startDate)} → {fmtDate(pos.endDate)}
                        </div>
                      </div>
                    </div>
                    <Badge
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                      style={isExpired
                        ? { background: "rgba(100,116,139,0.2)", color: "rgb(148,163,184)" }
                        : { background: "rgba(212,168,50,0.15)", color: "rgba(212,168,50,0.9)", border: "1px solid rgba(212,168,50,0.25)" }}
                    >
                      {isExpired ? t("profileVault.expired", "已到期") : `${daysLeft}d`}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <StatChip
                      label={t("profileVault.veRune", "veRUNE")}
                      value={Number(pos.veRune).toFixed(4)}
                      accent="rgba(212,168,50,0.7)"
                    />
                    <StatChip
                      label={t("profileVault.usdtIn", "USDT入金")}
                      value={pos.usdtAmount ? `$${Number(pos.usdtAmount).toFixed(0)}` : "—"}
                      accent="rgba(255,255,255,0.4)"
                    />
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="h-1 rounded-full overflow-hidden bg-white/10">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: "rgba(212,168,50,0.7)" }} />
                    </div>
                    <div className="text-[8px] text-muted-foreground text-right">
                      {pct.toFixed(0)}% {t("profileVault.elapsed", "已过")}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── BURN RUNE positions ─── */}
      {activeTab === "burn" && (
        <div className="px-4 lg:px-6 pt-4 space-y-3">
          {!isConnected ? (
            <NotConnected />
          ) : burnLoading ? (
            [1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : burnPositions.length === 0 ? (
            <EmptyState
              icon={Flame}
              accent="rgba(239,68,68,0.9)"
              title={t("profileVault.emptyBurnTitle", "暂无销毁记录")}
              desc={t("profileVault.emptyBurnDesc", "前往金库销毁RUNE获得每日FIRE")}
              onAction={() => navigate("/vault")}
              action={t("profileVault.emptyBurnAction", "去销毁")}
            />
          ) : (
            burnPositions.map(pos => {
              const pending = calcPendingEmber(pos);
              const dailyEmber = Number(pos.runeAmount) * Number(pos.dailyRate);
              return (
                <div
                  key={pos.id}
                  className="rounded-xl p-3.5 space-y-2.5"
                  style={{
                    background: "linear-gradient(135deg, rgba(239,68,68,0.07), rgba(220,38,38,0.03))",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                  data-testid={`card-burn-position-${pos.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)" }}>
                        <Flame className="h-3.5 w-3.5" style={{ color: "rgba(239,68,68,0.9)" }} />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold" style={{ color: "rgba(239,68,68,0.9)" }}>
                          {fmtRune(pos.runeAmount)} RUNE {t("profileVault.burned", "已销毁")}
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {(Number(pos.dailyRate) * 100).toFixed(1)}%/d · {fmtDate(pos.lastClaimAt)} {t("profileVault.lastClaim", "最近领取")}
                        </div>
                      </div>
                    </div>
                    <Badge
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.9)", border: "1px solid rgba(239,68,68,0.25)" }}
                    >
                      ACTIVE
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <StatChip
                      label={t("profileVault.daily", "每日FIRE")}
                      value={dailyEmber.toFixed(2)}
                      accent="rgba(239,68,68,0.7)"
                    />
                    <StatChip
                      label={t("profileVault.pending", "待领取")}
                      value={pending.toFixed(2)}
                      accent="rgba(251,146,60,0.8)"
                    />
                    <StatChip
                      label={t("profileVault.claimedLabel", "已领取")}
                      value={Number(pos.totalClaimedEmber).toFixed(2)}
                      accent="rgba(255,255,255,0.4)"
                    />
                  </div>

                  <Button
                    size="sm"
                    onClick={() => claimMutation.mutate(pos.id)}
                    disabled={claimMutation.isPending || pending < 0.01}
                    className="w-full h-8 text-[11px] font-bold rounded-lg"
                    style={{
                      background: pending >= 0.01
                        ? "linear-gradient(135deg, rgba(239,68,68,0.8), rgba(220,38,38,0.6))"
                        : "rgba(255,255,255,0.06)",
                      color: pending >= 0.01 ? "white" : "rgba(255,255,255,0.3)",
                      border: "none",
                    }}
                    data-testid={`button-claim-ember-${pos.id}`}
                  >
                    {claimMutation.isPending
                      ? t("profileVault.claiming", "领取中...")
                      : t("profileVault.claimAmount", "领取 {{amount}} FIRE", { amount: pending.toFixed(2) })}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── LOCK FIRE (Coming Soon) ─── */}
      {activeTab === "ember" && (
        <div className="px-4 lg:px-6 pt-4">
          <div
            className="rounded-xl p-6 flex flex-col items-center gap-3 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(251,146,60,0.06), rgba(234,88,12,0.03))",
              border: "1px solid rgba(251,146,60,0.18)",
            }}
          >
            <div className="h-12 w-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)" }}>
              <Sparkles className="h-6 w-6" style={{ color: "rgba(251,146,60,0.85)" }} />
            </div>
            <div>
              <div className="text-sm font-bold mb-1" style={{ color: "rgba(251,146,60,0.9)" }}>
                {t("profileVault.fireLockTitle", "锁仓FIRE")}
              </div>
              <div className="text-[11px] text-muted-foreground max-w-[240px] leading-relaxed">
                {t("profileVault.fireLockDesc", "将FIRE销毁收益锁仓，获得更高权益加成与协议分红。合约部署后开放。")}
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)" }}>
              <Clock className="h-3 w-3" style={{ color: "rgba(251,146,60,0.8)" }} />
              <span className="text-[10px] font-semibold" style={{ color: "rgba(251,146,60,0.8)" }}>
                {t("profileVault.comingSoon", "即将上线")}
              </span>
            </div>
            <div className="mt-2 space-y-2 w-full max-w-[260px]">
              {[
                t("profileVault.benefitRevenue", "协议分红 · 更高比例"),
                t("profileVault.benefitGovernance", "veFIRE 治理权重"),
                t("profileVault.benefitIdo", "IDO白名单加成"),
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Zap className="h-3 w-3 shrink-0" style={{ color: "rgba(251,146,60,0.6)" }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg px-2 py-1.5 text-center"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="text-[8px] text-muted-foreground mb-0.5">{label}</div>
      <div className="text-[11px] font-bold tabular-nums" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function NotConnected() {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl p-6 flex flex-col items-center gap-2 text-center"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {t("profileVault.notConnected", "请先连接钱包")}
      </p>
    </div>
  );
}

function EmptyState({
  icon: Icon, accent, title, desc, onAction, action,
}: {
  icon: React.ElementType; accent: string; title: string;
  desc: string; onAction: () => void; action: string;
}) {
  return (
    <div className="rounded-xl p-6 flex flex-col items-center gap-3 text-center"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center"
        style={{ background: `${accent}12`, border: `1px solid ${accent}25` }}>
        <Icon className="h-5 w-5" style={{ color: accent }} />
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground/70">
          {title}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {desc}
        </div>
      </div>
      <Button
        size="sm"
        onClick={onAction}
        className="h-8 text-[11px] font-bold rounded-lg px-4"
        style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}30` }}
        data-testid="button-go-vault"
      >
        {action}
        <ChevronRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}
