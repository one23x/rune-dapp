import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { copyText } from "@app/lib/copy";
import { useEngineUser } from "@app/lib/engine-hooks";
import { useDailyPnl } from "@app/lib/ai-bot-feed";
import { getCalendarDays as getCalendarDaysReal } from "@app/components/strategy/strategy-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@app/hooks/use-toast";
import {
  getProfile, getSubscriptions, getHedgePositions,
  getInsurancePool, getHedgePurchases, subscribeStrategy, purchaseHedge,
} from "@app/lib/api";
import { queryClient } from "@app/lib/queryClient";
import { formatCompact, formatUSD } from "@app/lib/constants";
import {
  Shield, CheckCircle2, TrendingUp, TrendingDown,
  Minus, Clock, Brain, Info, RefreshCw, Wallet, ChevronLeft, ChevronRight,
  Search, RotateCcw, Copy, Eye, EyeOff, Key, Link2, MessageCircle,
  DollarSign, Zap, Gauge, ArrowLeftRight, Flame, Waves, Sparkles, Activity, Crown,
} from "lucide-react";
import type { Strategy, StrategySubscription, Profile, HedgePosition, InsurancePurchase } from "@app-shared/types";
import { StrategyHeader } from "@app/components/strategy/strategy-header";
import { AiLab } from "@app/components/strategy/ai-lab";
import { SmartPredictionHero } from "@app/components/strategy/smart-prediction-hero";
import { TradingVaultBanner } from "@app/components/strategy/trading-vault-banner";
import { HlCopySection } from "@app/components/strategy/hl-copy-section";
// "strategies" now hosts the Hyperliquid copy-trading product (risk-tier
// one-click-follow leaders + HL 开户 + 持仓/历史) — Strategy = Hyperliquid.
// "ailab" keeps the AI model lab + signals; "prediction" hosts the Polymarket
// smart-prediction hero.
type TabId = "strategies" | "ailab" | "prediction";

const TABS: { id: TabId; labelKey: string }[] = [
  { id: "strategies", labelKey: "hl.navTitle" },
  { id: "ailab", labelKey: "strategy.aiLab" },
  { id: "prediction", labelKey: "strategy.smartPredictionTab" },
];

import { EXCHANGES, HEDGE_CONFIG } from "@app/lib/data";

export default function StrategyPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const { toast } = useToast();
  const walletAddr = account?.address || "";
  const [activeTab, setActiveTab] = useState<TabId>("strategies");
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [capitalAmount, setCapitalAmount] = useState("");
  const [hedgeAmount, setHedgeAmount] = useState<string>(HEDGE_CONFIG.defaultAmount);
  const [investmentOpen, setInvestmentOpen] = useState(false);
  const [investmentExchange, setInvestmentExchange] = useState("Aster");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [copyFilterType, setCopyFilterType] = useState("all");
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [bindApiOpen, setBindApiOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apiPassphrase, setApiPassphrase] = useState("");
  const [depositNetwork, setDepositNetwork] = useState("ERC-20");
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showApiPassphrase, setShowApiPassphrase] = useState(false);
  const [bindTelegramOpen, setBindTelegramOpen] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState("");


  const { data: profile } = useQuery<Profile>({
    queryKey: ["profile", walletAddr],
    queryFn: () => getProfile(walletAddr),
    enabled: !!walletAddr,
  });

  // HL/合约充值地址 = 用户的 engine 托管 EOA(链上 HL 账户 / 签名者),不是连接钱包。
  // useEngineUser 现在对未开户钱包**自动开户(幂等)**,保证连接后 EOA/充值地址恒存在并直接显示
  // (修"充值地址生成不出来")。
  const { data: engineUser } = useEngineUser(walletAddr);
  const hlDepositAddress = ((engineUser as { engineEoaAddress?: string } | undefined)?.engineEoaAddress) || "";

  const { data: subscriptions = [] } = useQuery<(StrategySubscription & { strategyName?: string })[]>({
    queryKey: ["subscriptions", walletAddr],
    queryFn: () => getSubscriptions(walletAddr),
    enabled: !!walletAddr,
  });

  const { data: hedgePositions = [] } = useQuery<HedgePosition[]>({
    queryKey: ["hedge-positions", walletAddr],
    queryFn: () => getHedgePositions(walletAddr),
    enabled: !!walletAddr,
  });

  const { data: insurancePool } = useQuery<{ poolSize: string; totalPolicies: number; totalPaid: string; payoutRate: string }>({
    queryKey: ["insurance-pool"],
    queryFn: getInsurancePool,
  });

  const { data: purchases = [] } = useQuery<InsurancePurchase[]>({
    queryKey: ["hedge-purchases", walletAddr],
    queryFn: () => getHedgePurchases(walletAddr),
    enabled: !!walletAddr,
  });

  const subscribeMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; strategyId: string; amount: number }) => {
      return subscribeStrategy(data.walletAddress, data.strategyId, data.amount);
    },
    onSuccess: () => {
      toast({ title: t("strategy.subscribed"), description: t("strategy.subscriptionActivated") });
      queryClient.invalidateQueries({ queryKey: ["subscriptions", walletAddr] });
      setSubscribeOpen(false);
      setCapitalAmount("");
      setSelectedStrategy(null);
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const hedgeMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; amount: number }) => {
      return purchaseHedge(data.walletAddress, data.amount);
    },
    onSuccess: () => {
      toast({ title: t("strategy.hedgeSuccess"), description: t("strategy.hedgeSuccessDesc") });
      queryClient.invalidateQueries({ queryKey: ["hedge-positions", walletAddr] });
      queryClient.invalidateQueries({ queryKey: ["hedge-purchases", walletAddr] });
      queryClient.invalidateQueries({ queryKey: ["insurance-pool"] });
      setHedgeAmount(HEDGE_CONFIG.defaultAmount);
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });


  const handleSubscribeClick = (strategy: Strategy) => {
    if (!walletAddr) {
      toast({ title: t("common.connectWallet"), description: t("strategy.connectWalletDesc"), variant: "destructive" });
      return;
    }
    if (strategy.isVipOnly && !profile?.isVip) {
      toast({ title: t("strategy.vipRequired"), description: t("strategy.vipRequiredDesc"), variant: "destructive" });
      return;
    }
    setSelectedStrategy(strategy);
    setSubscribeOpen(true);
  };

  const handleConfirmSubscribe = () => {
    toast({ title: t("common.comingSoon") });
    return;
  };

  const handleHedgePurchase = () => {
    toast({ title: t("common.comingSoon") });
    return;
  };

  const totalPremium = hedgePositions.reduce((sum, h) => sum + Number(h.amount || 0), 0);
  const totalPayout = hedgePositions.reduce((sum, h) => sum + Number(h.purchaseAmount || 0), 0);
  const avgPnl = hedgePositions.length > 0
    ? hedgePositions.reduce((sum, h) => sum + Number(h.currentPnl || 0), 0) / hedgePositions.length
    : 0;

  const handleInvestmentClick = () => {
    setInvestmentOpen(true);
  };

  // Refresh trigger: changes every 30s to give live feel
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setRefreshTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Real bot PnL by day from ai_paper_trades; seeded mock fills only the
  // days the bot hasn't yet covered. The shared `getCalendarDaysReal`
  // also drives the vault calendar + banner so the numbers match.
  const { byDay: realByDayCal } = useDailyPnl();
  const calendarDays = getCalendarDaysReal(calendarMonth, refreshTick, realByDayCal);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const calendarLabel = `${monthNames[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`;

  return (
    <div className="space-y-4 pb-24 lg:pb-8 lg:px-6 lg:pt-4" data-testid="page-strategy">
      <StrategyHeader />

      <TradingVaultBanner />

      <div className="px-4 space-y-3">
        <div className="flex gap-1.5 rounded-xl border border-border/55 bg-card/60 p-1 surface-3d" data-testid="strategy-tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`flex-1 min-w-0 py-2.5 px-2 sm:px-3 rounded-lg text-[12px] font-bold tracking-wide whitespace-nowrap truncate transition-all ${
                  isActive
                    ? "bg-gradient-to-br from-amber-500/20 via-amber-600/15 to-amber-700/10 ring-1 ring-amber-500/35 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/80"
                }`}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
              >
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {activeTab === "strategies" && <HlCopySection />}

        {activeTab === "ailab" && (
          <div className="px-0">
            <AiLab />
          </div>
        )}

        {activeTab === "prediction" && (
          <SmartPredictionHero />
        )}

      </div>

      <Dialog open={investmentOpen} onOpenChange={setInvestmentOpen}>
        <DialogContent className="bg-card border-border max-w-sm overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(212,168,50,0.3)" }}>
                <Wallet className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold" data-testid="text-investment-dialog-title">
                  {t("strategy.investmentDialog")}
                </DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground">
                  {t("strategy.investmentDesc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full grid grid-cols-3 mb-3">
              <TabsTrigger value="overview" className="text-xs">{t("strategy.overviewTab")}</TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs">{t("strategy.calendarTab")}</TabsTrigger>
              <TabsTrigger value="records" className="text-xs">{t("strategy.recordsTab")}</TabsTrigger>
            </TabsList>

            <div className="overflow-y-auto max-h-[calc(85vh-10rem)] pr-1">
              <TabsContent value="overview" className="space-y-4 mt-0">
                <div className="flex flex-wrap gap-1.5" data-testid="investment-exchange-tabs">
                  {EXCHANGES.map((ex) => (
                    <Badge
                      key={ex.name}
                      variant={investmentExchange === ex.name ? "default" : "outline"}
                      className={`text-[12px] cursor-pointer ${investmentExchange === ex.name ? "bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black" : ""}`}
                      onClick={() => setInvestmentExchange(ex.name)}
                      data-testid={`badge-inv-exchange-${ex.tag}`}
                    >
                      {ex.tag}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-[12px] cursor-pointer" data-testid="badge-inv-exchange-more">
                    {t("common.more")}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-border bg-background">
                    <CardContent className="p-3">
                      <div className="text-[12px] text-muted-foreground mb-0.5">{t("strategy.positionAmount")}</div>
                      <div className="text-lg font-bold tabular-nums" data-testid="text-inv-position">0.00</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-background">
                    <CardContent className="p-3">
                      <div className="text-[12px] text-muted-foreground mb-0.5">{t("vault.pnl")}</div>
                      <div className="text-lg font-bold tabular-nums" data-testid="text-inv-pnl">
                        0.00 <span className="text-emerald-400 text-[12px]">(0.00%)</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border bg-background">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-[12px] text-muted-foreground font-medium uppercase tracking-wider">{t("strategy.totalAssets")}</div>
                      <RefreshCw className="h-3 w-3 text-muted-foreground cursor-pointer" />
                    </div>
                    <div className="text-2xl font-bold mt-1 bg-gradient-to-r text-primary" data-testid="text-inv-total-assets">$0</div>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>{t("strategy.unrealizedPnl")}</span>
                        <span className="font-medium text-foreground tabular-nums">$0.00</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>{t("strategy.completedTrades")}</span>
                        <span className="font-medium text-foreground">--</span>
                      </div>
                      <div className="border-t border-border/50 pt-1.5 mt-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{t("strategy.perpetual")}</span>
                          <span className="font-medium text-foreground tabular-nums">$0</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{t("strategy.spot")}</span>
                          <span className="font-medium text-foreground">--</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {walletAddr && subscriptions.length > 0 && (
                  <Card className="border-border bg-background">
                    <CardContent className="p-3">
                      <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5" data-testid="text-my-subs-title">
                        <Copy className="h-3.5 w-3.5 text-emerald-400" />
                        {t("strategy.mySubscriptions")}
                      </h4>
                      <div className="space-y-2">
                        {subscriptions.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 border border-border/30"
                            data-testid={`inv-sub-${sub.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">
                                {sub.strategyName || sub.strategyId}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {formatUSD(Number(sub.allocatedCapital || 0))}
                              </div>
                            </div>
                            <Badge
                              className={`text-[10px] shrink-0 ${
                                sub.status === "ACTIVE"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {sub.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <Button size="icon" variant="ghost" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} data-testid="button-cal-prev">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-bold" data-testid="text-cal-label">{calendarLabel}</span>
                    <Button size="icon" variant="ghost" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} data-testid="button-cal-next">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-px text-center">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                      <div key={d} className="text-[10px] text-muted-foreground font-medium py-0.5">{d}</div>
                    ))}
                    {calendarDays.map((cell, idx) => (
                      <div
                        key={idx}
                        className={`rounded-sm py-1 text-center ${cell.day === 0 ? "" : "bg-muted/30 border border-border/30"}`}
                        data-testid={cell.day > 0 ? `cal-day-${cell.day}` : undefined}
                      >
                        {cell.day > 0 && (
                          <>
                            <div className="text-[12px] font-medium">{cell.day}</div>
                            <div className={`text-[11px] ${cell.pnl > 0 ? "text-emerald-400" : cell.pnl < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                              {cell.pnl !== 0 ? `${cell.pnl > 0 ? "+" : ""}${cell.pnl.toFixed(2)}%` : "--"}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const activeDays = calendarDays.filter(c => c.day > 0 && c.pnl !== 0);
                    const calWins = activeDays.filter(c => c.pnl > 0).length;
                    const calLosses = activeDays.filter(c => c.pnl < 0).length;
                    const calTotalPnl = activeDays.reduce((s, c) => s + c.pnl, 0);
                    const calWinRate = activeDays.length > 0 ? (calWins / activeDays.length * 100) : 0;
                    return (
                      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/30">
                        <div className="text-center">
                          <div className={`text-sm font-bold tabular-nums ${calTotalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {calTotalPnl >= 0 ? "+" : ""}{calTotalPnl.toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">{t("strategy.cumulativeReturn", "累计收益")}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-emerald-400 tabular-nums">{calWins}</div>
                          <div className="text-[10px] text-muted-foreground">{t("strategy.winCount", "盈利次数")}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-red-400 tabular-nums">{calLosses}</div>
                          <div className="text-[10px] text-muted-foreground">{t("strategy.lossCount", "亏损次数")}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold tabular-nums">{calWinRate.toFixed(0)}%</div>
                          <div className="text-[10px] text-muted-foreground">{t("strategy.winRate", "胜率")}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </TabsContent>

              <TabsContent value="records" className="space-y-4 mt-0">
                <Card className="border-border bg-background">
                  <CardContent className="p-3">
                    <h4 className="text-xs font-bold mb-3 flex items-center gap-1.5" data-testid="text-copy-records-title">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      {t("strategy.copyTradingRecords")}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {(() => {
                        const activeDays = calendarDays.filter(c => c.day > 0 && c.pnl !== 0);
                        const wins = activeDays.filter(c => c.pnl > 0).length;
                        const losses = activeDays.filter(c => c.pnl < 0).length;
                        const totalPnl = activeDays.reduce((s, c) => s + c.pnl, 0);
                        return (
                          <>
                            <div>
                              <div className={`text-lg font-bold tabular-nums ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`} data-testid="text-cumulative-return">{totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(1)}%</div>
                              <div className="text-[12px] text-muted-foreground">{t("strategy.cumulativeReturn")}</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold tabular-nums" data-testid="text-total-profit">{wins + losses}</div>
                              <div className="text-[12px] text-muted-foreground">{t("strategy.totalProfit")}</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-emerald-400 tabular-nums" data-testid="text-win-count">{wins}</div>
                              <div className="text-[12px] text-muted-foreground">{t("strategy.winCount")}</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-red-400 tabular-nums" data-testid="text-loss-count">{losses}</div>
                              <div className="text-[12px] text-muted-foreground">{t("strategy.lossCount")}</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-background">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge
                        variant={copyFilterType === "all" ? "default" : "outline"}
                        className={`text-[12px] cursor-pointer ${copyFilterType === "all" ? "bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black" : ""}`}
                        onClick={() => setCopyFilterType("all")}
                        data-testid="badge-filter-all"
                      >
                        {t("strategy.allStrategyTypes")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-2 flex-wrap">
                      <Clock className="h-3 w-3" />
                      <span>{t("strategy.selectDateRange")}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="gold" className="text-xs" data-testid="button-filter-search">
                        <Search className="h-3 w-3 mr-1" />
                        {t("common.search")}
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs" data-testid="button-filter-reset">
                        <RotateCcw className="h-3 w-3 mr-1" />
                        {t("common.reset")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
            <Button
              variant="gold"
              className="text-xs"
              data-testid="button-inv-deposit"
              onClick={() => toast({ title: t("common.comingSoon") })}
            >
              <Wallet className="h-3.5 w-3.5 mr-1" />
              {t("common.deposit")}
            </Button>
            <Button
              className="text-xs bg-gradient-to-r from-cyan-600 to-blue-500 border-cyan-500/50 text-white"
              data-testid="button-inv-bind-api"
              onClick={() => {
                if (!walletAddr) {
                  toast({ title: t("common.connectWallet"), description: t("strategy.connectWalletDesc"), variant: "destructive" });
                  return;
                }
                setBindApiOpen(true);
              }}
            >
              <Key className="h-3.5 w-3.5 mr-1" />
              {t("strategy.bindApi")}
            </Button>
            <Button
              className="text-xs bg-gradient-to-r from-blue-600 to-indigo-500 border-blue-500/50 text-white"
              data-testid="button-inv-bind-telegram"
              onClick={() => setBindTelegramOpen(true)}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1" />
              {t("strategy.bindTg")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(212,168,50,0.3)" }}>
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold" data-testid="text-subscribe-dialog-title">
                  {t("strategy.subscribeToStrategy")}
                </DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground">
                  {t("strategy.subscribeDesc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedStrategy && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-bold mb-2">{selectedStrategy.name}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Card className="border-border bg-background">
                    <CardContent className="p-2 text-center">
                      <div className="text-[12px] text-muted-foreground">{t("strategy.leverage")}</div>
                      <div className="text-sm font-bold" data-testid="text-dialog-leverage">
                        {selectedStrategy.leverage}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-background">
                    <CardContent className="p-2.5 text-center">
                      <div className="text-[12px] text-muted-foreground">{t("strategy.winRateLabel")}</div>
                      <div className="text-sm font-bold text-emerald-400" data-testid="text-dialog-winrate">
                        {Number(selectedStrategy.winRate).toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-background">
                    <CardContent className="p-2.5 text-center">
                      <div className="text-[12px] text-muted-foreground">{t("strategy.monthly")}</div>
                      <div className="text-sm font-bold text-emerald-400" data-testid="text-dialog-return">
                        +{Number(selectedStrategy.monthlyReturn).toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">{t("strategy.capitalAmount")}</label>
                <Input
                  type="number"
                  placeholder={t("vault.enterAmount")}
                  value={capitalAmount}
                  onChange={(e) => setCapitalAmount(e.target.value)}
                  data-testid="input-capital-amount"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSubscribeOpen(false)} data-testid="button-cancel-subscribe">
              {t("common.cancel")}
            </Button>
            <Button
              variant="gold"
              onClick={handleConfirmSubscribe}
              disabled={subscribeMutation.isPending}
              data-testid="button-confirm-subscribe"
            >
              <TrendingUp className="mr-1 h-4 w-4" />
              {subscribeMutation.isPending ? t("strategy.subscribing") : t("strategy.confirmSubscribe")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(212,168,50,0.3)" }}>
                <Wallet className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold" data-testid="text-deposit-dialog-title">{t("strategy.depositFunds")}</DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground">
                  {t("strategy.depositTransferDesc", { exchange: investmentExchange })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{t("strategy.network")}</label>
              <div className="flex gap-1.5 flex-wrap">
                {["ERC-20", "TRC-20", "BEP-20", "SOL"].map((net) => (
                  <Badge
                    key={net}
                    variant={depositNetwork === net ? "default" : "outline"}
                    className={`text-[12px] cursor-pointer ${depositNetwork === net ? "bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black" : ""}`}
                    onClick={() => setDepositNetwork(net)}
                    data-testid={`badge-network-${net}`}
                  >
                    {net}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{t("strategy.depositAddress")}</label>
              <div className="flex items-center gap-2">
                <Input
                  value={
                    hlDepositAddress ||
                    (!walletAddr
                      ? t("strategy.connectWalletFirstInput")
                      : t("strategy.openAccountFirst", "请先在跟单页开通交易账户"))
                  }
                  readOnly
                  className="text-xs font-mono"
                  data-testid="input-deposit-address"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (!hlDepositAddress) return;
                    const ok = copyText(hlDepositAddress);
                    toast(
                      ok
                        ? { title: t("common.copied"), description: t("common.copiedDesc") }
                        : { title: t("common.copyFailed", "Copy failed"), description: t("common.copyFailedDesc", "Long-press to select manually."), variant: "destructive" }
                    );
                  }}
                  data-testid="button-copy-address"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{t("vault.amountUSDT")}</label>
              <Input
                type="number"
                placeholder="Min 100 USDT"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                data-testid="input-deposit-amount"
              />
            </div>
            <div className="space-y-1 text-[12px] text-muted-foreground">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span>{t("strategy.minDeposit")}</span><span className="font-medium text-foreground">100 USDT</span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span>{t("strategy.fee")}</span><span className="font-medium text-foreground">0 USDT</span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span>{t("strategy.expectedArrival")}</span><span className="font-medium text-foreground">{t("strategy.fiveMin")}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDepositOpen(false)} data-testid="button-cancel-deposit">{t("common.cancel")}</Button>
            <Button
              variant="gold"
              onClick={() => {
                toast({ title: t("common.comingSoon") });
              }}
              data-testid="button-confirm-deposit"
            >
              <Wallet className="mr-1 h-4 w-4" />
              {t("strategy.confirmDepositBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bindApiOpen} onOpenChange={setBindApiOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(6,182,212,0.3)" }}>
                <Key className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold" data-testid="text-bind-api-dialog-title">{t("strategy.bindApiTitle", { exchange: investmentExchange })}</DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground">
                  {t("strategy.bindApiDesc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="border-border bg-background">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground flex-wrap">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span dangerouslySetInnerHTML={{ __html: t("strategy.apiPermissionNote") }} />
                </div>
              </CardContent>
            </Card>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{t("strategy.apiKey")}</label>
              <Input
                placeholder={t("strategy.enterApiKey")}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="text-xs font-mono"
                data-testid="input-api-key"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{t("strategy.apiSecret")}</label>
              <div className="flex items-center gap-2">
                <Input
                  type={showApiSecret ? "text" : "password"}
                  placeholder={t("strategy.enterApiSecret")}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="text-xs font-mono"
                  data-testid="input-api-secret"
                />
                <Button size="icon" variant="ghost" onClick={() => setShowApiSecret(v => !v)} data-testid="button-toggle-secret">
                  {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{t("strategy.passphrase")}</label>
              <div className="flex items-center gap-2">
                <Input
                  type={showApiPassphrase ? "text" : "password"}
                  placeholder={t("strategy.optional")}
                  value={apiPassphrase}
                  onChange={(e) => setApiPassphrase(e.target.value)}
                  className="text-xs font-mono"
                  data-testid="input-api-passphrase"
                />
                <Button size="icon" variant="ghost" onClick={() => setShowApiPassphrase(v => !v)} data-testid="button-toggle-passphrase">
                  {showApiPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[11px] no-default-hover-elevate no-default-active-elevate">
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 text-emerald-400" />{t("strategy.read")}
              </Badge>
              <Badge variant="outline" className="text-[11px] no-default-hover-elevate no-default-active-elevate">
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 text-emerald-400" />{t("nav.trade")}
              </Badge>
              <Badge variant="outline" className="text-[11px] no-default-hover-elevate no-default-active-elevate">
                <Shield className="h-2.5 w-2.5 mr-0.5 text-red-400" />{t("strategy.noWithdraw")}
              </Badge>
            </div>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3 space-y-2">
                <div className="text-xs font-semibold text-primary">{t("strategy.subscriptionCost")}</div>
                <div className="flex gap-3">
                  <div className="flex-1 text-center rounded-lg border border-border/30 bg-background/50 py-2 px-2">
                    <div className="text-lg font-bold text-foreground">$49</div>
                    <div className="text-[10px] text-muted-foreground">{t("strategy.perMonth")}</div>
                  </div>
                  <div className="flex-1 text-center rounded-lg border border-primary/30 bg-primary/10 py-2 px-2 relative">
                    <div className="absolute -top-1.5 right-1 text-[8px] bg-primary text-white px-1 rounded font-bold">{t("strategy.discount")}</div>
                    <div className="text-lg font-bold text-foreground">$249</div>
                    <div className="text-[10px] text-muted-foreground">{t("strategy.perHalfYear")}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBindApiOpen(false)} data-testid="button-cancel-bind-api">{t("common.cancel")}</Button>
            <Button
              className="bg-gradient-to-r from-cyan-600 to-blue-500 border-cyan-500/50 text-white"
              onClick={() => {
                if (!walletAddr) {
                  toast({ title: t("common.connectWallet"), description: t("strategy.connectWalletDesc"), variant: "destructive" });
                  return;
                }
                if (!apiKey.trim() || !apiSecret.trim()) {
                  toast({ title: t("strategy.missingFields"), description: t("strategy.missingFieldsDesc"), variant: "destructive" });
                  return;
                }
                toast({ title: t("strategy.apiBound"), description: t("strategy.apiBoundDesc", { exchange: investmentExchange }) });
                setApiKey("");
                setApiSecret("");
                setApiPassphrase("");
                setBindApiOpen(false);
              }}
              data-testid="button-confirm-bind-api"
            >
              <Link2 className="mr-1 h-4 w-4" />
              {t("strategy.bindApiBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bindTelegramOpen} onOpenChange={setBindTelegramOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(59,130,246,0.3)" }}>
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold" data-testid="text-bind-telegram-dialog-title">{t("strategy.bindTelegram")}</DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground">
                  {t("strategy.bindTelegramDesc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="border-border bg-background">
              <CardContent className="p-3">
                <div className="space-y-2 text-[12px] text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="bg-primary/20 text-primary rounded-full h-4 w-4 flex items-center justify-center shrink-0 text-[11px] font-bold">1</span>
                    <span dangerouslySetInnerHTML={{ __html: t("strategy.tgStep1") }} />
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-primary/20 text-primary rounded-full h-4 w-4 flex items-center justify-center shrink-0 text-[11px] font-bold">2</span>
                    <span dangerouslySetInnerHTML={{ __html: t("strategy.tgStep2") }} />
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-primary/20 text-primary rounded-full h-4 w-4 flex items-center justify-center shrink-0 text-[11px] font-bold">3</span>
                    <span dangerouslySetInnerHTML={{ __html: t("strategy.tgStep3") }} />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{t("strategy.telegramUsername")}</label>
              <Input
                placeholder="@your_username"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value)}
                className="text-xs"
                data-testid="input-telegram-username"
              />
            </div>
            <div className="space-y-1 text-[12px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                <span>{t("strategy.tgAlertTrades")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                <span>{t("strategy.tgAlertPnl")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                <span>{t("strategy.tgAlertRisk")}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBindTelegramOpen(false)} data-testid="button-cancel-bind-telegram">{t("common.cancel")}</Button>
            <Button
              className="bg-gradient-to-r from-blue-600 to-indigo-500 border-blue-500/50 text-white"
              onClick={() => {
                toast({ title: t("common.comingSoon") });
              }}
              data-testid="button-confirm-bind-telegram"
            >
              <MessageCircle className="mr-1 h-4 w-4" />
              {t("strategy.bindTelegramBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
