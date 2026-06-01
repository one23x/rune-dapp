import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Flame, Sparkles, Trophy, Coins, AlertCircle, Loader2, ChevronDown, ChevronUp, ArrowRight, ChevronRight } from "lucide-react";
import { NotReadyDialog } from "./not-ready-dialog";
import { CollapsibleInfoCard } from "@app/components/vault/collapsible-info-card";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@app/lib/queryClient";
import { useToast } from "@app/hooks/use-toast";
import { apiPost } from "@app/lib/api";
import { usePayment, getPaymentStatusLabel } from "@app/hooks/use-payment";
import { useRunePrice } from "@app/hooks/use-rune-price";
import { EMBER_BURN_CONTRACT_ADDRESS } from "@app/lib/contracts";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { cn } from "@app/lib/utils";

const BURN_TIERS: Array<{ minRune: number; maxRune: number; rate: number; rateLabel: string; tierKey: string; tierDefault: string; best?: boolean }> = [
  { minRune: 0,    maxRune: 99,       rate: 0.010, rateLabel: "1.0%", tierKey: "vault.burn.tierStarter",  tierDefault: "Starter" },
  { minRune: 100,  maxRune: 499,      rate: 0.012, rateLabel: "1.2%", tierKey: "vault.burn.tierAdvanced", tierDefault: "Advanced" },
  { minRune: 500,  maxRune: 999,      rate: 0.013, rateLabel: "1.3%", tierKey: "vault.burn.tierPro",      tierDefault: "Pro" },
  { minRune: 1000, maxRune: 4999,     rate: 0.014, rateLabel: "1.4%", tierKey: "vault.burn.tierElite",    tierDefault: "Elite" },
  { minRune: 5000, maxRune: Infinity, rate: 0.015, rateLabel: "1.5%", tierKey: "vault.burn.tierMax",      tierDefault: "Max", best: true },
];

function getBurnRate(runeAmount: number) {
  return BURN_TIERS.find(t => runeAmount >= t.minRune && runeAmount <= t.maxRune) || BURN_TIERS[0];
}

interface EmberBurnStats {
  totalRuneBurned: string;
  dailyEmber: string;
  totalClaimedEmber: string;
}

export function EmberBurnSection() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === "zh" || i18n.language === "zh-TW";
  const account = useActiveAccount();
  const wallet = account?.address || "";
  const { toast } = useToast();
  const payment = usePayment();
  const { price: runePrice, usdcToMA } = useRunePrice();
  const [, navigate] = useLocation();

  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [usdtAmount, setUsdtAmount] = useState("");
  const [showTiers, setShowTiers] = useState(false);

  const { data: stats } = useQuery<EmberBurnStats>({
    queryKey: ["/api/ember-burn/stats", wallet],
    queryFn: () => fetch(`/api/ember-burn/stats?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const burnMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; usdtAmount: number; runeAmount: number }) => {
      let txHash: string | undefined;
      if (EMBER_BURN_CONTRACT_ADDRESS) {
        try {
          txHash = await payment.payEmberBurn(data.usdtAmount);
        } catch (e: any) {
          if (!e.message?.includes("not configured")) throw e;
        }
      }
      payment.markSuccess();
      return apiPost("/api/ember-burn", {
        walletAddress: data.walletAddress,
        usdtAmount: data.usdtAmount,
        runeAmount: data.runeAmount,
        runePrice,
        txHash: txHash || null,
      });
    },
    onSuccess: () => {
      toast({ title: t("vault.burn.success", "Burned!"), description: t("vault.burn.successDesc", "Daily FIRE yield has started.") });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn", wallet] });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn/stats", wallet] });
      setOpen(false);
      setUsdtAmount("");
      setConfirmed(false);
      payment.reset();
    },
    onError: (err: Error) => {
      toast({ title: t("vault.burn.error", "Burn Failed"), description: err.message, variant: "destructive" });
      payment.reset();
    },
  });

  // 暂未开放 — burn-stake 合约还没上线。改用 toast 替代之前的弹窗。
  // 链上 ready 后把 onClick 还原为 burnMutation.mutate(...) 即可恢复。
  const [notReadyOpen, setNotReadyOpen] = useState(false);
  void notReadyOpen;
  const handleBurn = () => {
    toast({
      title: t("vault.burnNotReadyTitle", "Coming soon"),
      description: t("vault.burnNotReadyDesc", "FIRE burn-staking will open after the protocol launch."),
    });
  };

  const usdtNum = parseFloat(usdtAmount) || 0;
  const runeEquiv = usdcToMA(usdtNum);
  const tier = getBurnRate(runeEquiv);
  const dailyEmber = runeEquiv * tier.rate;
  const yearlyEmber = dailyEmber * 365;

  const isPaying = burnMutation.isPending;
  const payLabel = payment.status !== "idle" ? getPaymentStatusLabel(payment.status) : t("vault.burn.confirmBtn", "Confirm Burn");

  const benefits = [
    { icon: Coins,    color: "rgb(251,191,36)",  lk: "vault.burn.benefitRevenue",  ld: "AI Revenue Share",     dk: "vault.burn.benefitRevenueDesc",  dd: "Monthly AI quant profits by FIRE weight" },
    { icon: Trophy,   color: "rgb(167,243,208)", lk: "vault.burn.benefitIdo",      ld: "Exclusive IDO Access", dk: "vault.burn.benefitIdoDesc",      dd: "Monthly launches, avg 50x. FIRE holders only" },
    { icon: Sparkles, color: "rgb(196,181,253)", lk: "vault.burn.benefitScarcity", ld: "Protocol Scarcity",    dk: "vault.burn.benefitScarcityDesc", dd: "Hard cap 1.31M FIRE. External projects compete" },
  ];

  const burnSteps = [
    {
      title: t("vault.burn.stepBuybackTitle", isZh ? "协议回购" : "Protocol Buyback"),
      desc: t("vault.burn.stepBuybackDesc", isZh ? "金库产生的部分收益将用于在公开市场回购代币。" : "A portion of vault revenue is used to buy back tokens on the open market."),
    },
    {
      title: t("vault.burn.stepBurnTitle", isZh ? "永久销毁" : "Permanent Burn"),
      desc: t("vault.burn.stepBurnDesc", isZh ? "回购的代币将被发送至黑洞地址，永久退出流通，形成通缩效应。" : "Bought-back tokens are sent to a burn address, permanently removed from supply for a deflationary effect."),
    },
    {
      title: t("vault.burn.stepValueTitle", isZh ? "价值提升" : "Value Accrual"),
      desc: t("vault.burn.stepValueDesc", isZh ? "随着流通量减少，剩余代币的价值捕获能力将持续增强。" : "As circulating supply shrinks, the value capture of remaining tokens keeps strengthening."),
    },
  ];

  return (
    <div className="px-4 lg:px-6 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-md flex items-center justify-center bg-orange-500/15 border border-orange-500/30">
          <Flame className="h-3 w-3 text-orange-400" />
        </div>
        <h3 className="text-sm font-bold text-white">{t("vault.burn.sectionTitle", "Burn RUNE · Permanent FIRE Yield")}</h3>
        <Badge className="text-[9px] border-0 ml-auto bg-orange-500/15 text-orange-400">
          {t("vault.burn.badge", "Permanent Deflation")}
        </Badge>
      </div>

      {/* Cumulative burn hero */}
      <div className="glass-panel-strong relative overflow-hidden p-5">
        <div className="pointer-events-none absolute top-0 right-0 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl" />
        <div className="flex items-center gap-3 mb-4 relative z-10">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
            <Flame className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <div className="text-white/80 text-sm font-medium">{t("vault.burn.cumulativeBurn", isZh ? "累计销毁 (FIRE)" : "Cumulative Burn (FIRE)")}</div>
            <div className="text-2xl font-bold tracking-tight gold-text tabular-nums">
              {Number(stats?.totalRuneBurned || 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="bg-black/20 border border-white/10 rounded-lg p-3">
            <div className="text-xs text-white/50 mb-1">{isZh ? "每日FIRE" : "Daily FIRE"}</div>
            <div className="text-sm font-bold text-orange-400 tabular-nums">{Number(stats?.dailyEmber || 0).toFixed(4)}</div>
          </div>
          <div className="bg-black/20 border border-white/10 rounded-lg p-3">
            <div className="text-xs text-white/50 mb-1">{isZh ? "已领取" : "Claimed"}</div>
            <div className="text-sm font-bold text-emerald-400 tabular-nums">{Number(stats?.totalClaimedEmber || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Link to positions */}
      {wallet && (
        <button
          onClick={() => navigate("/profile/vault")}
          className="glass-panel w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
          data-testid="button-view-burn-positions"
        >
          <span className="text-xs font-semibold text-white/80">{isZh ? "我的销毁仓位" : "My Burn Positions"}</span>
          <div className="flex items-center gap-1 text-[10px] text-orange-400/70">
            <span>{isZh ? "查看仓位" : "My positions"}</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </button>
      )}

      {/* Benefits — collapsible */}
      <CollapsibleInfoCard
        title={t("vault.burn.benefitsTitle", "FIRE Staking Benefits")}
        accent="red"
        icon={Sparkles}
      >
        {benefits.map(({ icon: Icon, color, lk, ld, dk, dd }) => (
          <div key={lk} className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
              <Icon className="h-3 w-3" style={{ color }} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-white">{t(lk, ld)}</div>
              <div className="text-[10px] text-white/60">{t(dk, dd)}</div>
            </div>
          </div>
        ))}
      </CollapsibleInfoCard>

      {/* Rate Tiers */}
      <button onClick={() => setShowTiers(v => !v)}
        className="glass-panel w-full flex items-center justify-between px-4 py-2.5 text-xs text-white/60 hover:text-white transition-colors">
        <span>{t("vault.burn.tiersTitle", "Daily Rate Tiers (by RUNE amount burned)")}</span>
        {showTiers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {showTiers && (
        <div className="glass-panel rounded-lg overflow-hidden">
          <table className="w-full text-[10px]">
            <thead><tr className="bg-white/5">
              <th className="text-left px-3 py-2 text-white/50 font-medium">{t("vault.burn.tierAmount", "RUNE Burned")}</th>
              <th className="text-center px-3 py-2 text-white/50 font-medium">{t("vault.burn.tierLevel", "Level")}</th>
              <th className="text-right px-3 py-2 text-white/50 font-medium">{t("vault.burn.tierRate", "Daily")}</th>
            </tr></thead>
            <tbody>
              {BURN_TIERS.map(t2 => (
                <tr key={t2.minRune} className={cn("border-t border-white/5", t2.best ? "text-orange-300" : "text-white/80")}>
                  <td className="px-3 py-1.5 text-white/60">
                    {t2.maxRune === Infinity ? `≥ ${t2.minRune.toLocaleString()}` : `${t2.minRune.toLocaleString()} – ${t2.maxRune.toLocaleString()}`}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {t2.best
                      ? <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-300">{t(t2.tierKey, t2.tierDefault)}</span>
                      : t(t2.tierKey, t2.tierDefault)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold">{t2.rateLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Burn Mechanism — numbered steps */}
      <div className="glass-panel p-4">
        <div className="text-xs font-semibold text-white/80 mb-3">{t("vault.burn.mechanismTitle", isZh ? "销毁机制" : "Burn Mechanism")}</div>
        <div className="space-y-3">
          {burnSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0 text-[11px] font-bold text-orange-400">{i + 1}</div>
              <div className="pt-0.5">
                <div className="text-[11px] font-semibold text-white">{step.title}</div>
                <div className="text-[10px] text-white/60 mt-0.5 leading-relaxed">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Burn Button */}
      <Button className="w-full h-12 text-sm font-bold gold-button rounded-xl"
        onClick={() => { setOpen(true); setConfirmed(false); }} data-testid="button-ember-burn-open">
        <Flame className="mr-2 h-4 w-4" />
        {t("vault.burn.burnButton", "Pay USDT · Burn RUNE → FIRE Yield")}
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={v => { if (!isPaying) { setOpen(v); if (!v) { payment.reset(); setConfirmed(false); } } }}>
        <DialogContent className="glass-panel-strong border-0 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-400">
              <Flame className="h-4 w-4" />
              {t("vault.burn.confirmTitle", "Burn RUNE for FIRE")}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              {t("vault.burn.confirmDesc", "Pay USDT → buy RUNE at market price → burn permanently for daily FIRE yield")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <div className="text-xs text-white/60 mb-1.5">{t("vault.burn.amountLabel", "USDT Amount")}</div>
              <div className="relative">
                <Input type="number" placeholder={t("vault.burn.amountPlaceholder", "Min 10 USDT")}
                  value={usdtAmount} onChange={e => { setUsdtAmount(e.target.value); setConfirmed(false); }}
                  className="bg-black/20 border-white/10 text-white pr-16" data-testid="input-ember-burn-amount" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/60">USDT</span>
              </div>
            </div>

            {usdtNum >= 10 && (
              <div className="rounded-lg p-3 space-y-2 bg-orange-500/5 border border-orange-500/15">
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  <span className="font-bold text-white">${usdtNum.toFixed(2)} USDT</span>
                  <ArrowRight className="h-3 w-3 text-white/50" />
                  <span className="font-bold text-orange-400">{runeEquiv.toFixed(2)} RUNE</span>
                  <span className="text-[10px] text-white/50">(@ ${runePrice.toFixed(4)})</span>
                  <ArrowRight className="h-3 w-3 text-white/50" />
                  <span className="font-bold text-orange-400">{t("vault.burn.burned", "burned")}</span>
                </div>
                <div className="border-t border-white/10 pt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div className="flex justify-between"><span className="text-white/50">{t("vault.burn.currentTier", "Tier")}</span><span className={cn("font-semibold", tier.best ? "text-orange-300" : "text-white")}>{t(tier.tierKey, tier.tierDefault)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">{t("vault.burn.dailyRateLabel", "Rate")}</span><span className="font-bold text-orange-400">{tier.rateLabel}/day</span></div>
                  <div className="flex justify-between"><span className="text-white/50">{t("vault.burn.dailyYield", "Daily FIRE")}</span><span className="font-semibold text-orange-300">{dailyEmber.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">{t("vault.burn.yearlyYield", "Annual Est.")}</span><span className="font-semibold text-orange-300">{yearlyEmber.toFixed(0)}</span></div>
                </div>
                {runeEquiv < 5000 && (
                  <div className="text-[9px] text-white/60 mt-1">
                    {t("vault.burn.tipUpgrade", "Spend more to reach higher tiers — max rate 1.5% at 5,000+ RUNE")}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-start gap-2 text-[10px] rounded-lg p-2.5 bg-red-500/8 border border-red-500/20">
                <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-red-300 space-y-0.5">
                  <div className="font-semibold">{t("vault.burn.irreversible", "Irreversible Action")}</div>
                  <div>{t("vault.burn.irreversibleDesc", "RUNE is permanently removed from circulation. Principal cannot be returned. You receive perpetual daily FIRE yield.")}</div>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="rounded" data-testid="checkbox-burn-confirm" />
                <span className="text-[11px] text-white/60">{t("vault.burn.checkboxLabel", "I understand this is irreversible and confirm")}</span>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); payment.reset(); setConfirmed(false); }} disabled={isPaying} className="glass-button border-0 text-white">{t("common.cancel", "Cancel")}</Button>
            <Button size="sm" onClick={handleBurn}
              disabled={isPaying || !usdtAmount || parseFloat(usdtAmount) < 10 || !confirmed}
              className="gold-button"
              data-testid="button-ember-burn-confirm">
              {isPaying ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{payLabel}</> : <><Flame className="mr-1.5 h-3.5 w-3.5" />{t("vault.burn.confirmBtn", "Confirm Burn")}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NotReadyDialog
        open={notReadyOpen}
        onClose={() => { setNotReadyOpen(false); setOpen(false); }}
        feature={t("vault.burn.runeBurn", "RUNE 销毁")}
      />
    </div>
  );
}
