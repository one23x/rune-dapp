import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Lock, Zap, Vote, TrendingUp, Star, ArrowRight, AlertCircle, Loader2, ChevronRight, Sparkles, Calculator } from "lucide-react";
import { NotReadyDialog } from "./not-ready-dialog";
import { CollapsibleInfoCard } from "@app/components/vault/collapsible-info-card";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@app/lib/queryClient";
import { useToast } from "@app/hooks/use-toast";
import { apiPost } from "@app/lib/api";
import { usePayment, getPaymentStatusLabel } from "@app/hooks/use-payment";
import { useRunePrice } from "@app/hooks/use-rune-price";
import { RUNE_LOCK_CONTRACT_ADDRESS } from "@app/lib/contracts";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { cn } from "@app/lib/utils";

const LOCK_PERIODS: Array<{ days: number; label: string; pctLabel: string; color: string; best?: boolean }> = [
  { days: 30,  label: "30D",  pctLabel: "6.5%",  color: "rgba(100,116,139,0.7)" },
  { days: 90,  label: "90D",  pctLabel: "16.7%", color: "rgba(59,130,246,0.8)" },
  { days: 180, label: "180D", pctLabel: "33.3%", color: "rgba(168,85,247,0.8)" },
  { days: 360, label: "360D", pctLabel: "66.7%", color: "rgba(212,168,50,0.8)" },
  { days: 540, label: "540D", pctLabel: "100%",  color: "rgba(239,68,68,0.8)", best: true },
];

interface RuneLockStats {
  totalRuneLocked: string;
  totalVeRune: string;
  positions: number;
}

export function RuneLockSection() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === "zh" || i18n.language === "zh-TW";
  const account = useActiveAccount();
  const wallet = account?.address || "";
  const { toast } = useToast();
  const payment = usePayment();
  const { price: runePrice, usdcToMA } = useRunePrice();
  const [, navigate] = useLocation();

  const [open, setOpen] = useState(false);
  const [usdtAmount, setUsdtAmount] = useState("");
  const [selectedDays, setSelectedDays] = useState(540);

  const { data: stats } = useQuery<RuneLockStats>({
    queryKey: ["/api/rune-lock/stats", wallet],
    queryFn: () => fetch(`/api/rune-lock/stats?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const lockMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; usdtAmount: number; runeAmount: number; lockDays: number }) => {
      let txHash: string | undefined;
      if (RUNE_LOCK_CONTRACT_ADDRESS) {
        try {
          txHash = await payment.payRuneLock(data.usdtAmount);
        } catch (e: any) {
          if (!e.message?.includes("not configured")) throw e;
        }
      }
      payment.markSuccess();
      return apiPost("/api/rune-lock", {
        walletAddress: data.walletAddress,
        usdtAmount: data.usdtAmount,
        runeAmount: data.runeAmount,
        runePrice,
        lockDays: data.lockDays,
        txHash: txHash || null,
      });
    },
    onSuccess: () => {
      toast({ title: t("vault.lock.success", "Locked!"), description: t("vault.lock.successDesc", "RUNE locked. veRUNE benefits are now active.") });
      queryClient.invalidateQueries({ queryKey: ["/api/rune-lock", wallet] });
      queryClient.invalidateQueries({ queryKey: ["/api/rune-lock/stats", wallet] });
      setOpen(false);
      setUsdtAmount("");
      payment.reset();
    },
    onError: (err: Error) => {
      toast({ title: t("vault.lock.error", "Lock Failed"), description: err.message, variant: "destructive" });
      payment.reset();
    },
  });

  // 暂未开放 — 改用 toast（用户反馈：lock-section 入口要简洁不弹窗）。
  // notReadyOpen state 保留用作 NotReadyDialog 兼容（dialog mounted at
  // bottom of file referenced by ref). 链上 vault 合约 ready 后把
  // onClick 改回真实的 handleLock 即可恢复。
  const [notReadyOpen, setNotReadyOpen] = useState(false);
  void notReadyOpen;
  const handleLock = () => {
    toast({
      title: t("vault.lockNotReadyTitle", "Coming soon"),
      description: t("vault.lockNotReadyDesc", "RUNE locking will open after the protocol launch."),
    });
  };

  const usdtNum = parseFloat(usdtAmount) || 0;
  const runeEquiv = usdcToMA(usdtNum);
  const selectedPeriod = LOCK_PERIODS.find(p => p.days === selectedDays) || LOCK_PERIODS[4];
  const veRunePreview = runeEquiv * 0.35 * (selectedDays / 540);

  const isPaying = lockMutation.isPending;
  const payLabel = payment.status !== "idle" ? getPaymentStatusLabel(payment.status) : t("vault.lock.confirmBtn", "Confirm & Pay");

  const benefits = [
    { icon: Vote,       color: "rgba(168,85,247,0.8)", lk: "vault.lock.benefitVoting",   ld: "Epoch Voting",        dk: "vault.lock.benefitVotingDesc",   dd: "Direct FIRE emissions every 14 days" },
    { icon: TrendingUp, color: "rgba(34,197,94,0.8)",  lk: "vault.lock.benefitDividend", ld: "AI Revenue Share",    dk: "vault.lock.benefitDividendDesc", dd: "Monthly USDT dividends weighted by veRUNE" },
    { icon: Star,       color: "rgba(212,168,50,0.9)", lk: "vault.lock.benefitIdo",      ld: "IDO Launch Access",   dk: "vault.lock.benefitIdoDesc",      dd: "Monthly projects, avg 50x returns" },
    { icon: Zap,        color: "rgba(59,130,246,0.8)", lk: "vault.lock.benefitForge",    ld: "Forge Fee Dividends", dk: "vault.lock.benefitForgeDesc",    dd: "External protocols compete for FIRE flow" },
  ];

  return (
    <div className="px-4 lg:px-6 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-md flex items-center justify-center bg-amber-500/15 border border-amber-400/30">
          <Lock className="h-3 w-3 text-amber-300" />
        </div>
        <h3 className="text-sm font-bold text-white">{t("vault.lock.sectionTitle", "Lock RUNE · Earn veRUNE")}</h3>
        <Badge className="text-[9px] border-0 ml-auto bg-amber-500/15 text-amber-300">
          {t("vault.lock.badge", "ve(3,3) Model")}
        </Badge>
      </div>

      {/* My stats summary (compact) + link to positions */}
      {wallet && (
        <button
          onClick={() => navigate("/profile/vault")}
          className="glass-panel w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
          data-testid="button-view-lock-positions"
        >
          <div className="flex gap-4">
            <div>
              <div className="text-[9px] text-white/50 uppercase mb-0.5">{t("vault.lock.stakedRune", "RUNE Locked")}</div>
              <div className="text-sm font-bold tabular-nums text-amber-300">
                {Number(stats?.totalRuneLocked || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-white/50 uppercase mb-0.5">{t("vault.lock.myVeRune", "My veRUNE")}</div>
              <div className="text-sm font-bold tabular-nums text-amber-300">
                {Number(stats?.totalVeRune || 0).toFixed(2)}
              </div>
            </div>
            {(stats?.positions || 0) > 0 && (
              <div>
                <div className="text-[9px] text-white/50 uppercase mb-0.5">{t("vault.lock.positions", "Positions")}</div>
                <div className="text-sm font-bold tabular-nums text-white">{stats?.positions}</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-amber-300/70">
            <span>{t("common.myPositions", "My positions")}</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </button>
      )}

      {/* Benefits — collapsible */}
      <CollapsibleInfoCard
        title={t("vault.lock.benefitsTitle", "veRUNE Benefits")}
        accent="primary"
        icon={Sparkles}
      >
        {benefits.map(({ icon: Icon, color, lk, ld, dk, dd }) => (
          <div key={lk} className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
              <Icon className="h-3 w-3" style={{ color }} />
            </div>
            <div>
              <div className="text-[11px] font-semibold">{t(lk, ld)}</div>
              <div className="text-[10px] text-white/60">{t(dk, dd)}</div>
            </div>
          </div>
        ))}
      </CollapsibleInfoCard>

      {/* Formula — collapsible */}
      <CollapsibleInfoCard
        title={t("vault.lock.formulaTitle", "veRUNE Formula")}
        accent="primary"
        icon={Calculator}
      >
        <div className="font-mono text-[11px] text-white/85">{t("vault.lock.formulaExpr", "veRUNE = RUNE × 35% × (lock days ÷ 540)")}</div>
        <div className="text-[10px] text-white/60">
          {t("vault.lock.formulaNote", "Lock 540 days")} = <span className="text-amber-300 font-semibold">{t("vault.lock.maxWeight", "maximum veRUNE weight")}</span>
        </div>
      </CollapsibleInfoCard>

      {/* Period Selector */}
      <div className="glass-panel p-4">
        <div className="text-xs text-white/60 mb-2">{t("vault.lock.periodLabel", "Lock Period")}</div>
        <div className="grid grid-cols-5 gap-1.5">
          {LOCK_PERIODS.map(p => {
            const isActive = selectedDays === p.days;
            return (
              <button key={p.days} onClick={() => setSelectedDays(p.days)}
                className={cn(
                  "rounded-lg py-2 px-1 text-center transition-all relative",
                  isActive
                    ? "bg-[#f59e0b] text-black shadow-[0_0_15px_rgba(245,158,11,0.45)]"
                    : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
                )}
                data-testid={`button-lock-period-${p.days}`}
              >
                {p.best && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] px-1 rounded font-bold bg-amber-400 text-black">{t("vault.lock.best", "Best")}</span>}
                <div className="text-[10px] font-bold">{p.label}</div>
                <div className={cn("text-[8px] mt-0.5", isActive ? "text-black/70" : "text-white/40")}>{p.pctLabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lock Button */}
      <Button className="w-full h-12 text-sm font-bold gold-button rounded-xl"
        onClick={() => setOpen(true)} data-testid="button-rune-lock-open">
        <Lock className="mr-2 h-4 w-4" />
        {t("vault.lock.lockButton", "Pay USDT · Lock RUNE for veRUNE")}
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={v => { if (!isPaying) { setOpen(v); if (!v) payment.reset(); } }}>
        <DialogContent className="glass-panel-strong border-0 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Lock className="h-4 w-4 text-amber-300" />
              {t("vault.lock.confirmTitle", "Lock RUNE for veRUNE")}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              {t("vault.lock.confirmDesc", "Pay USDT → buy RUNE at market price → lock for veRUNE benefits")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <div className="text-xs text-white/60 mb-1.5">{t("vault.lock.amountLabel", "USDT Amount")}</div>
              <div className="relative">
                <Input type="number" placeholder={t("vault.lock.amountPlaceholder", "Min 10 USDT")}
                  value={usdtAmount} onChange={e => setUsdtAmount(e.target.value)}
                  className="bg-black/20 border-white/10 text-white pr-16" data-testid="input-rune-lock-amount" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/60">USDT</span>
              </div>
            </div>

            {usdtNum >= 10 && (
              <div className="rounded-lg p-3 space-y-1.5 bg-amber-500/5 border border-amber-400/15">
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  <span className="font-bold text-white">${usdtNum.toFixed(2)} USDT</span>
                  <ArrowRight className="h-3 w-3 text-white/50" />
                  <span className="font-bold text-amber-300">{runeEquiv.toFixed(2)} RUNE</span>
                  <span className="text-[10px] text-white/50">(@ ${runePrice.toFixed(4)})</span>
                  <ArrowRight className="h-3 w-3 text-white/50" />
                  <span className="font-bold text-emerald-400">{veRunePreview.toFixed(4)} veRUNE</span>
                </div>
                <div className="border-t border-white/10 pt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div className="flex justify-between"><span className="text-white/50">{t("vault.lock.previewPeriod", "Lock Period")}</span><span className="font-semibold text-white">{selectedPeriod.label}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">{t("vault.lock.previewWeight", "veRUNE Weight")}</span><span className="font-semibold text-amber-300">{selectedPeriod.pctLabel}</span></div>
                </div>
              </div>
            )}

            <div>
              <div className="text-xs text-white/60 mb-1.5">{t("vault.lock.periodLabel", "Lock Period")}</div>
              <div className="grid grid-cols-5 gap-1">
                {LOCK_PERIODS.map(p => (
                  <button key={p.days} onClick={() => setSelectedDays(p.days)}
                    className={cn(
                      "rounded-lg py-1.5 text-center text-[10px] font-bold transition-all",
                      selectedDays === p.days
                        ? "bg-[#f59e0b] text-black shadow-[0_0_15px_rgba(245,158,11,0.45)]"
                        : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
                    )}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 text-[10px] text-white/60 rounded-lg p-2 bg-red-500/5 border border-red-500/15">
              <AlertCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
              <span>{t("vault.lock.warning", "RUNE cannot be withdrawn during the lock period. veRUNE decays linearly — extend to reset weight.")}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); payment.reset(); }} disabled={isPaying} className="glass-button border-0 text-white">{t("common.cancel", "Cancel")}</Button>
            <Button size="sm" onClick={handleLock} disabled={isPaying || !usdtAmount || parseFloat(usdtAmount) < 10}
              className="gold-button"
              data-testid="button-rune-lock-confirm">
              {isPaying ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{payLabel}</> : t("vault.lock.confirmBtn", "Confirm & Pay")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NotReadyDialog
        open={notReadyOpen}
        onClose={() => { setNotReadyOpen(false); setOpen(false); }}
        feature={t("vault.lock.runeLock", "RUNE 质押")}
      />
    </div>
  );
}
