import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/language-context";

/**
 * Show Chinese secondary label only when the active language is a Chinese variant.
 * For en/ko/ja/th/vi the calculator chrome falls back to English labels, which
 * is acceptable for this technical tools page (the labels are DeFi jargon and
 * most values are numeric).
 */
function useShowZh() {
  const { language } = useLanguage();
  return language === "zh" || language === "zh-TW";
}
import {
  Activity, TrendingUp, AlertTriangle, Coins, Droplets, BarChart3, Users, Target,
  ChevronRight, Pickaxe,
} from "lucide-react";
import { useCalculateApy, useSimulateInvestment, useCalculateImpermanentLoss, ApyCalculatorInputCompoundFrequency } from "@/lib/queries";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ReferenceLine, Legend,
} from "recharts";
import {
  projectStakingRelease,
  simulateAAMPoolStandalone,
  analyzeCLMMPosition,
  calculateTradingProfitBreakdown,
  calculateBrokerLayerBreakdown,
  calculateBrokerDividendEarnings,
  BROKER_SYSTEMS,
  type BrokerSystem,
} from "@/lib/afx-calculations";

// ─── Shared constants ─────────────────────────────────────────────────────────

const TS = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

function fmt(n: number, d = 2) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(d)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(d)}K`;
  return n.toFixed(d);
}

// ─── Navigation structure ─────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: "defi",
    name: "General DeFi",
    nameZh: "通用 DeFi",
    tools: [
      { id: "apy", name: "APY Calculator", nameZh: "年化收益计算器", Icon: Activity, color: "text-primary" },
      { id: "investment", name: "Investment Simulator", nameZh: "投资模拟器", Icon: TrendingUp, color: "text-chart-2" },
      { id: "il", name: "Impermanent Loss", nameZh: "无常损失", Icon: AlertTriangle, color: "text-destructive" },
    ],
  },
  {
    id: "staking",
    name: "Staking & Liquidity",
    nameZh: "铸造与流动性",
    tools: [
      { id: "staking", name: "Staking Suite", nameZh: "铸造工具套件", Icon: Coins, color: "text-chart-3" },
      { id: "pledge", name: "Pledge & Mining", nameZh: "质押与挖矿", Icon: Pickaxe, color: "text-chart-5" },
      { id: "aam", name: "AAM Pool Simulator", nameZh: "流动性池模拟", Icon: Droplets, color: "text-chart-4" },
      { id: "clmm", name: "CLMM Analyzer", nameZh: "集中流动性分析", Icon: Target, color: "text-primary" },
    ],
  },
  {
    id: "rewards",
    name: "Trading & Rewards",
    nameZh: "交易与奖励",
    tools: [
      { id: "trading", name: "Trading Profit", nameZh: "交易分红计算", Icon: BarChart3, color: "text-primary" },
      { id: "broker", name: "Broker Earnings", nameZh: "推荐层级收益", Icon: Users, color: "text-chart-2" },
    ],
  },
] as const;

type ToolId = "apy" | "investment" | "il" | "staking" | "pledge" | "aam" | "clmm" | "trading" | "broker";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Tools() {
  const [active, setActive] = useState<ToolId>("apy");
  const showZh = useShowZh();

  const allTools = CATEGORIES.flatMap(c => c.tools as readonly any[]);
  const activeTool = allTools.find(t => t.id === active) as any;

  return (
    <div className="container mx-auto px-4 py-8 animate-slide-up space-y-6">
      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-6">
        {showZh && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary/70 zh-only">经济模拟器</span>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
          Economic Simulators
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Advanced calculators for DeFi yields, liquidity analysis, and protocol-level economic simulation.
          {showZh && <span className="hidden sm:inline"> · 高级计算器，涵盖 DeFi 收益、流动性分析及协议经济模拟。</span>}
        </p>
      </div>

      {/* ── Mobile nav ── */}
      <div className="lg:hidden">
        <Select value={active} onValueChange={(v) => setActive(v as ToolId)}>
          <SelectTrigger className="w-full bg-card/50 backdrop-blur-sm border-border shadow-sm h-11">
            <div className="flex items-center gap-2">
              <activeTool.Icon className={`h-4 w-4 shrink-0 ${activeTool.color}`} />
              <span className="font-medium">{activeTool.name}</span>
              {showZh && <span className="text-xs text-muted-foreground ml-1">{activeTool.nameZh}</span>}
            </div>
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <div key={cat.id}>
                <div className="px-2 py-1.5">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
                    {cat.name}{showZh && ` · ${cat.nameZh}`}
                  </p>
                </div>
                {cat.tools.map(tool => (
                  <SelectItem key={tool.id} value={tool.id}>
                    <span className="flex items-center gap-2">
                      <tool.Icon className={`h-3.5 w-3.5 ${tool.color}`} />
                      <span>{tool.name}</span>
                      {showZh && <span className="text-xs text-muted-foreground">{tool.nameZh}</span>}
                    </span>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Sidebar + Content ── */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-0">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col w-52 xl:w-60 shrink-0 gap-1 sticky top-20 h-[calc(100vh-160px)] overflow-y-auto pr-4 border-r border-border/50">
          {CATEGORIES.map((cat, ci) => (
            <div key={cat.id} className={ci > 0 ? "mt-5" : ""}>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-2 px-2">
                <span className="block">{cat.name}</span>
                {showZh && <span className="block text-[10px] normal-case tracking-wide font-normal text-muted-foreground/40 mt-0.5">{cat.nameZh}</span>}
              </p>
              {cat.tools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setActive(tool.id as ToolId)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 mb-0.5 transition-all group
                    ${active === tool.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/40 border border-transparent"
                    }`}
                >
                  <tool.Icon className={`h-4 w-4 shrink-0 ${active === tool.id ? tool.color : "text-muted-foreground group-hover:text-foreground"}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium leading-tight truncate ${active === tool.id ? tool.color : "text-foreground"}`}>
                      {tool.name}
                    </p>
                    {showZh && <p className="text-[11px] text-muted-foreground truncate">{tool.nameZh}</p>}
                  </div>
                  {active === tool.id && <ChevronRight className={`h-3 w-3 ml-auto shrink-0 ${tool.color}`} />}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* ── Tool content ── */}
        <main className="flex-1 min-w-0 lg:pl-6">
          {active === "apy" && <ApyCalculator />}
          {active === "investment" && <InvestmentSimulator />}
          {active === "il" && <ImpermanentLossCalculator />}
          {active === "staking" && <StakingProjector />}
          {active === "pledge" && <PledgeMining />}
          {active === "aam" && <AAMPoolSimulator />}
          {active === "clmm" && <CLMMAnalyzer />}
          {active === "trading" && <TradingProfitCalculator />}
          {active === "broker" && <BrokerEarningsCalculator />}
        </main>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ToolHeader({ icon, title, titleZh, desc, descZh }: {
  icon: React.ReactNode; title: string; titleZh: string; desc: string; descZh: string;
}) {
  const showZh = useShowZh();
  return (
    <div className="flex items-start gap-3 mb-6 pb-5 border-b border-border/50">
      <div className="p-2 rounded-lg bg-muted/30 border border-border/50 mt-0.5">{icon}</div>
      <div>
        <h2 className="text-lg sm:text-xl font-semibold flex flex-wrap items-baseline gap-2">
          {title}{showZh && <span className="text-base font-normal text-muted-foreground">{titleZh}</span>}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}{showZh && <span className="hidden sm:inline"> · {descZh}</span>}</p>
      </div>
    </div>
  );
}

function ParamsCard({ title, titleZh, children }: { title: string; titleZh: string; children: React.ReactNode }) {
  const showZh = useShowZh();
  return (
    <Card className="bg-card/70 backdrop-blur border-border shadow-sm h-fit">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {title}{showZh && <span className="text-xs font-normal text-muted-foreground">{titleZh}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">{children}</CardContent>
    </Card>
  );
}

function SliderRow({ label, labelZh, value, set, min, max, step, display }: {
  label: string; labelZh: string; value: number; set: (v: number) => void;
  min: number; max: number; step: number; display: string;
}) {
  const showZh = useShowZh();
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-xs text-muted-foreground">{label}{showZh && <span className="opacity-60"> {labelZh}</span>}</Label>
        <span className="num text-xs text-foreground">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={v => set(v[0])} />
    </div>
  );
}

function KpiGrid({ items }: { items: { label: string; labelZh: string; value: string; color?: string }[] }) {
  const showZh = useShowZh();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, labelZh, value, color }) => (
        <div key={label} className="bg-card/60 border border-border rounded-xl p-3 sm:p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1 leading-tight">
            {label}
            {showZh && <><br /><span className="opacity-60">{labelZh}</span></>}
          </p>
          <p className={`text-base sm:text-lg num mt-1 leading-tight ${color ?? "text-foreground"}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, msg, sub }: { icon: React.ReactNode; msg: string; sub: string }) {
  const showZh = useShowZh();
  return (
    <div className="h-64 flex items-center justify-center border border-dashed border-border rounded-xl bg-background/20">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center mx-auto">{icon}</div>
        <p className="text-sm text-muted-foreground">
          {msg}
          {showZh && <><br /><span className="text-xs opacity-70">{sub}</span></>}
        </p>
      </div>
    </div>
  );
}

// ─── APY Demo Chart (shown before user runs simulation) ──────────────────────

function ApyDemoChart() {
  const demoData = Array.from({ length: 12 }, (_, i) => ({
    day: (i + 1) * 30,
    amount: Math.round(1000 * Math.pow(1 + 0.15 / 365, (i + 1) * 30)),
  }));
  return (
    <div className="h-64 relative select-none">
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-2 pointer-events-none">
        <div className="rounded-full bg-background/80 backdrop-blur px-4 py-1.5 border border-border/50 shadow text-xs text-muted-foreground">
          Run simulation to view your projection
          <span className="block text-center text-[10px] opacity-60 mt-0.5">运行模拟以查看预测结果</span>
        </div>
      </div>
      <div className="opacity-20 pointer-events-none h-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={demoData}>
            <defs>
              <linearGradient id="gApyDemo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gApyDemo)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── APY Calculator ───────────────────────────────────────────────────────────

function ApyCalculator() {
  const showZh = useShowZh();
  const [principal, setPrincipal] = useState(1000);
  const [apy, setApy] = useState(15);
  const [days, setDays] = useState(365);
  const [freq, setFreq] = useState<ApyCalculatorInputCompoundFrequency>("daily");
  const m = useCalculateApy();

  return (
    <div className="space-y-6">
      <ToolHeader icon={<Activity className="h-4 w-4 text-primary" />} title="APY Calculator" titleZh="年化收益计算器" desc="Project compound yield over time" descZh="复利收益长期预测" />
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <ParamsCard title="Parameters" titleZh="参数设置">
          <SliderRow label="Initial Principal ($)" labelZh="初始本金" value={principal} set={setPrincipal} min={100} max={100000} step={100} display={formatCurrency(principal)} />
          <SliderRow label="Expected APY (%)" labelZh="预期年化" value={apy} set={setApy} min={1} max={200} step={1} display={`${apy}%`} />
          <SliderRow label="Duration (Days)" labelZh="持续时间" value={days} set={setDays} min={7} max={1095} step={7} display={`${days}d`} />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Compound Frequency <span className="opacity-60 zh-only">复利频率</span></Label>
            <Select value={freq} onValueChange={(v: any) => setFreq(v)}>
              <SelectTrigger className="bg-background/50 border-border h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily<span className="zh-only ml-1">每日</span></SelectItem>
                <SelectItem value="weekly">Weekly<span className="zh-only ml-1">每周</span></SelectItem>
                <SelectItem value="monthly">Monthly<span className="zh-only ml-1">每月</span></SelectItem>
                <SelectItem value="yearly">Yearly<span className="zh-only ml-1">每年</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={() => m.mutate({ data: { principal, apy, durationDays: days, compoundFrequency: freq } })} disabled={m.isPending}>
            {m.isPending ? "Calculating..." : (showZh ? "Run Simulation · 运行模拟" : "Run Simulation")}
          </Button>
        </ParamsCard>
        <Card className="bg-card/70 border-border shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">Projection Results <span className="text-xs font-normal text-muted-foreground zh-only">预测结果</span></CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-6">
            {m.data ? (
              <>
                <KpiGrid items={[
                  { label: "Final Amount", labelZh: "最终金额", value: formatCurrency(m.data.finalAmount) },
                  { label: "Total Return", labelZh: "总收益", value: `+${formatCurrency(m.data.totalReturn)}`, color: "text-chart-2" },
                  { label: "ROI", labelZh: "回报率", value: `+${formatPercent(m.data.returnPercent)}`, color: "text-chart-2" },
                  { label: "Principal", labelZh: "本金", value: formatCurrency(m.data.principal), color: "text-muted-foreground" },
                ]} />
                <div className="h-[240px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={m.data.dailyBreakdown}>
                      <defs>
                        <linearGradient id="gApy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v, 0)}`} />
                      <Tooltip contentStyle={TS} formatter={(v: number) => [formatCurrency(v), "Value"]} labelFormatter={l => `Day ${l}`} />
                      <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gApy)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : <ApyDemoChart />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Investment Simulator ─────────────────────────────────────────────────────

function InvestmentSimulator() {
  const showZh = useShowZh();
  const [initial, setInitial] = useState(10000);
  const [monthly, setMonthly] = useState(500);
  const [apy, setApy] = useState(12);
  const [years, setYears] = useState(5);
  const m = useSimulateInvestment();

  return (
    <div className="space-y-6">
      <ToolHeader icon={<TrendingUp className="h-4 w-4 text-chart-2" />} title="Investment Simulator" titleZh="投资模拟器" desc="Long-term compound growth with monthly contributions" descZh="含定投的长期复利增长" />
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <ParamsCard title="Parameters" titleZh="参数设置">
          <SliderRow label="Initial Investment ($)" labelZh="初始投资" value={initial} set={setInitial} min={100} max={100000} step={100} display={formatCurrency(initial)} />
          <SliderRow label="Monthly Contribution ($)" labelZh="每月定投" value={monthly} set={setMonthly} min={0} max={10000} step={50} display={formatCurrency(monthly)} />
          <SliderRow label="Expected APY (%)" labelZh="预期年化" value={apy} set={setApy} min={1} max={100} step={1} display={`${apy}%`} />
          <SliderRow label="Time Horizon (Years)" labelZh="投资年限" value={years} set={setYears} min={1} max={20} step={1} display={`${years} yr`} />
          <Button className="w-full bg-chart-2 hover:bg-chart-2/90 text-white" onClick={() => m.mutate({ data: { initialInvestment: initial, monthlyContribution: monthly, expectedApy: apy, years } })} disabled={m.isPending}>
            {m.isPending ? "Simulating..." : (showZh ? "Run Simulation · 运行模拟" : "Run Simulation")}
          </Button>
        </ParamsCard>
        <Card className="bg-card/70 border-border shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">Growth Trajectory <span className="text-xs font-normal text-muted-foreground zh-only">增长轨迹</span></CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-6">
            {m.data ? (
              <>
                <KpiGrid items={[
                  { label: "Final Value", labelZh: "最终价值", value: formatCurrency(m.data.finalValue) },
                  { label: "Total Contributions", labelZh: "总投入", value: formatCurrency(m.data.totalContributed), color: "text-muted-foreground" },
                  { label: "Total Yield", labelZh: "总收益", value: `+${formatCurrency(m.data.totalReturn)}`, color: "text-chart-2" },
                  { label: "ROI", labelZh: "回报率", value: `+${formatPercent(m.data.returnPercent)}`, color: "text-chart-2" },
                ]} />
                <div className="h-[240px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={m.data.yearlyBreakdown}>
                      <defs>
                        <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `Yr${v}`} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v, 0)}`} />
                      <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [formatCurrency(v), n === "value" ? "Total Value" : "Contributions"]} labelFormatter={l => `Year ${l}`} />
                      <Area type="monotone" dataKey="contributed" stackId="1" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground)/0.15)" />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#gInv)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : <EmptyState icon={<TrendingUp className="h-6 w-6 text-muted-foreground/50" />} msg="Run simulation to view projection." sub="运行模拟以查看预测结果" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Impermanent Loss ─────────────────────────────────────────────────────────

function ImpermanentLossCalculator() {
  const showZh = useShowZh();
  const [initialPrice, setInitialPrice] = useState(100);
  const [currentPrice, setCurrentPrice] = useState(150);
  const [liquidity, setLiquidity] = useState(1000);
  const m = useCalculateImpermanentLoss();

  return (
    <div className="space-y-6">
      <ToolHeader icon={<AlertTriangle className="h-4 w-4 text-destructive" />} title="Impermanent Loss" titleZh="无常损失计算" desc="Quantify LP divergence risk vs holding" descZh={showZh ? "LP · 仓位与持有策略的损失对比" : "LP"} />
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <ParamsCard title="Parameters" titleZh="参数设置">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Initial Asset Price ($) <span className="opacity-60 zh-only">初始资产价格</span></Label>
            <Input type="number" value={initialPrice} onChange={e => setInitialPrice(Number(e.target.value))} className="bg-background/50 border-border font-mono h-9" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Current / Projected Price ($) <span className="opacity-60 zh-only">当前/预期价格</span></Label>
            <Input type="number" value={currentPrice} onChange={e => setCurrentPrice(Number(e.target.value))} className="bg-background/50 border-border font-mono h-9" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Initial Liquidity Value ($) <span className="opacity-60 zh-only">初始流动性价值</span></Label>
            <Input type="number" value={liquidity} onChange={e => setLiquidity(Number(e.target.value))} className="bg-background/50 border-border font-mono h-9" />
          </div>
          <Button variant="destructive" className="w-full" onClick={() => m.mutate({ data: { initialPrice, currentPrice, liquidityValue: liquidity } })} disabled={m.isPending}>
            {m.isPending ? "Calculating..." : (showZh ? "Calculate Risk · 计算风险" : "Calculate Risk")}
          </Button>
        </ParamsCard>
        <Card className="bg-card/70 border-border shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">Risk Analysis <span className="text-xs font-normal text-muted-foreground zh-only">风险分析</span></CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            {m.data ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
                    <p className="text-xs text-destructive uppercase tracking-wider mb-2">IL % <span className="opacity-70 zh-only">无常损失</span></p>
                    <p className="text-3xl font-bold font-mono text-destructive">-{formatPercent(m.data.ilPercent)}</p>
                    <p className="text-xs font-mono text-destructive/80 mt-1">-{formatCurrency(m.data.ilUsd)}</p>
                  </div>
                  <div className="p-5 bg-background/50 border border-border rounded-xl text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">HODL Value <span className="opacity-70 zh-only">持有价值</span></p>
                    <p className="text-2xl font-bold font-mono">{formatCurrency(m.data.hodlValue)}</p>
                  </div>
                  <div className="p-5 bg-background/50 border border-border rounded-xl text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">LP Value <span className="opacity-70 zh-only">池内价值</span></p>
                    <p className="text-2xl font-bold font-mono">{formatCurrency(m.data.lpValue)}</p>
                  </div>
                </div>
                <div className="p-4 bg-card/50 border border-border/50 rounded-xl text-sm text-muted-foreground space-y-1.5">
                  <p>Price <span className="font-mono text-foreground">{formatCurrency(initialPrice)}</span> → <span className="font-mono text-foreground">{formatCurrency(currentPrice)}</span> causes <span className="font-mono text-destructive font-semibold">{formatPercent(m.data.ilPercent)}</span> divergence loss vs HODL.</p>
                  {showZh && <p className="text-xs opacity-70">价格从 {formatCurrency(initialPrice)} 变动至 {formatCurrency(currentPrice)}，LP仓位相比持有损失 {formatPercent(m.data.ilPercent)}。</p>}
                </div>
              </>
            ) : <EmptyState icon={<AlertTriangle className="h-6 w-6 text-muted-foreground/50" />} msg="Enter prices to calculate IL risk." sub="输入价格以计算无常损失" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Staking Suite (5 modes) ──────────────────────────────────────────────────

type StakingMode = "gold" | "coin" | "exit" | "principal_interest" | "maturity";

const STAKING_MODES: { id: StakingMode; name: string; nameZh: string; desc: string }[] = [
  { id: "gold",               name: "Gold Standard",        nameZh: "金本位",   desc: "USDC × multiplier → tokens released daily" },
  { id: "coin",               name: "Coin Standard",        nameZh: "币本位",   desc: "Buy tokens → token qty × multiplier released" },
  { id: "exit",               name: "Multiplier Exit",      nameZh: "倍数出局", desc: "Daily profit until cumulative hits target multiple" },
  { id: "principal_interest", name: "Principal + Interest", nameZh: "本息释放", desc: "Daily release includes both principal & interest" },
  { id: "maturity",           name: "Maturity Return",      nameZh: "到期还本", desc: "Interest released daily, principal returned at end" },
];

function StakingProjector() {
  const showZh = useShowZh();
  const [mode, setMode] = useState<StakingMode>("gold");
  const [tokenName, setTokenName] = useState("MS");
  const [tokenPrice, setTokenPrice] = useState(0.5);
  const [investment, setInvestment] = useState(1000);
  const [multiplier, setMultiplier] = useState(3);
  const [days, setDays] = useState(180);
  // exit mode
  const [dailyProfitRate, setDailyProfitRate] = useState(1);
  const [exitMultiplier, setExitMultiplier] = useState(3);
  // principal+interest / maturity modes
  const [annualRate, setAnnualRate] = useState(36);

  const modeInfo = STAKING_MODES.find(m => m.id === mode)!;

  // ── Derived chart data per mode ──
  const chartData = useMemo(() => {
    if (mode === "gold") {
      const r = projectStakingRelease(investment, tokenPrice, multiplier, days, "gold_standard");
      return r.releaseSchedule.map(p => ({ day: p.day, value: p.cumulativeMs * tokenPrice, tokens: p.cumulativeMs }));
    }
    if (mode === "coin") {
      const r = projectStakingRelease(investment, tokenPrice, multiplier, days, "coin_standard");
      return r.releaseSchedule.map(p => ({ day: p.day, value: p.cumulativeMs * tokenPrice, tokens: p.cumulativeMs }));
    }
    if (mode === "exit") {
      const dailyValue = investment * (dailyProfitRate / 100);
      const target = investment * exitMultiplier;
      const exitDay = Math.ceil(target / dailyValue);
      const pts = [];
      for (let d = 1; d <= exitDay + 10; d++) {
        const cumulative = dailyValue * d;
        pts.push({ day: d, value: cumulative, target });
        if (d >= exitDay) break;
      }
      return pts;
    }
    if (mode === "principal_interest") {
      const totalInterest = investment * (annualRate / 100) * (days / 365);
      const total = investment + totalInterest;
      const daily = total / days;
      const dailyPrincipal = investment / days;
      const dailyInterest = totalInterest / days;
      return Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        principal: dailyPrincipal * (i + 1),
        interest: dailyInterest * (i + 1),
        value: daily * (i + 1),
      }));
    }
    if (mode === "maturity") {
      const dailyInterest = investment * (annualRate / 100) / 365;
      return Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        interest: dailyInterest * (i + 1),
        principal: i + 1 === days ? investment : 0,
        cumulative: dailyInterest * (i + 1) + (i + 1 === days ? investment : 0),
      }));
    }
    return [];
  }, [mode, investment, tokenPrice, multiplier, days, dailyProfitRate, exitMultiplier, annualRate]);

  const display = chartData.filter((_, i) => i % Math.max(1, Math.ceil(chartData.length / 90)) === 0);

  // ── Summary KPIs per mode ──
  const kpis = useMemo(() => {
    if (mode === "gold") {
      const r = projectStakingRelease(investment, tokenPrice, multiplier, days, "gold_standard");
      return [
        { label: "Daily Release", labelZh: "每日释放量", value: `${fmt(r.dailyMs)} ${tokenName}`, color: "text-chart-3" },
        { label: "Total Tokens", labelZh: "总释放量", value: `${fmt(r.totalMs)} ${tokenName}` },
        { label: "Total USDC Out", labelZh: "总USDC价值", value: formatCurrency(r.totalUsdcValue) },
        { label: "Multiplier", labelZh: "倍率", value: `${multiplier}×` },
      ];
    }
    if (mode === "coin") {
      const r = projectStakingRelease(investment, tokenPrice, multiplier, days, "coin_standard");
      const bought = investment / tokenPrice;
      return [
        { label: "Tokens Bought", labelZh: "购入代币", value: `${fmt(bought)} ${tokenName}` },
        { label: "Daily Release", labelZh: "每日释放量", value: `${fmt(r.dailyMs)} ${tokenName}`, color: "text-chart-3" },
        { label: "Total Tokens", labelZh: "总释放量", value: `${fmt(r.totalMs)} ${tokenName}` },
        { label: "Total USDC Value", labelZh: "总USDC价值", value: formatCurrency(r.totalUsdcValue) },
      ];
    }
    if (mode === "exit") {
      const dailyValue = investment * (dailyProfitRate / 100);
      const target = investment * exitMultiplier;
      const exitDay = Math.ceil(target / dailyValue);
      return [
        { label: "Daily Earnings", labelZh: "每日收益", value: formatCurrency(dailyValue), color: "text-chart-2" },
        { label: "Exit Target", labelZh: "出局目标", value: formatCurrency(target) },
        { label: "Exit Day", labelZh: "预计出局天数", value: `Day ${exitDay}`, color: "text-chart-3" },
        { label: "Total ROI", labelZh: "总回报率", value: `${exitMultiplier}×`, color: "text-primary" },
      ];
    }
    if (mode === "principal_interest") {
      const totalInterest = investment * (annualRate / 100) * (days / 365);
      const total = investment + totalInterest;
      return [
        { label: "Total Interest", labelZh: "总利息", value: formatCurrency(totalInterest), color: "text-chart-2" },
        { label: "Total Return", labelZh: "总回收额", value: formatCurrency(total) },
        { label: "Daily Release", labelZh: "每日释放", value: formatCurrency(total / days), color: "text-chart-3" },
        { label: "Effective APY", labelZh: "实际年化", value: `${annualRate}%` },
      ];
    }
    if (mode === "maturity") {
      const dailyInterest = investment * (annualRate / 100) / 365;
      const totalInterest = dailyInterest * days;
      return [
        { label: "Daily Interest", labelZh: "每日利息", value: formatCurrency(dailyInterest), color: "text-chart-2" },
        { label: "Total Interest", labelZh: "总利息", value: formatCurrency(totalInterest) },
        { label: "Principal Returned", labelZh: "到期还本", value: formatCurrency(investment), color: "text-chart-3" },
        { label: "Final Total", labelZh: "最终总额", value: formatCurrency(investment + totalInterest) },
      ];
    }
    return [];
  }, [mode, investment, tokenPrice, multiplier, days, dailyProfitRate, exitMultiplier, annualRate, tokenName]);

  return (
    <div className="space-y-6">
      <ToolHeader icon={<Coins className="h-4 w-4 text-chart-3" />} title="Staking Suite" titleZh="铸造工具套件" desc="Five minting & release models — choose the one that matches your product" descZh="五种铸造与释放模型，匹配不同产品结构" />

      {/* Mode cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5">
        {STAKING_MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`text-left p-3 rounded-xl border transition-all ${mode === m.id ? "bg-chart-3/10 border-chart-3/40" : "bg-card/40 border-border hover:bg-muted/30"}`}>
            <p className={`text-sm font-semibold leading-tight ${mode === m.id ? "text-chart-3" : "text-foreground"}`}>{m.name}</p>
            <p className={`text-xs mt-0.5 ${mode === m.id ? "text-chart-3/70" : "text-muted-foreground"}`}>{m.nameZh}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1.5 leading-tight hidden sm:block">{m.desc}</p>
          </button>
        ))}
      </div>
      <div className="p-3 rounded-lg bg-chart-3/5 border border-chart-3/20 text-xs text-muted-foreground">
        <span className="font-semibold text-chart-3">{modeInfo.nameZh} · {modeInfo.name}</span> — {modeInfo.desc}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        {/* ── Params ── */}
        <ParamsCard title="Parameters" titleZh="参数设置">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token Name <span className="opacity-60 zh-only">代币名称</span></Label>
              <Input value={tokenName} onChange={e => setTokenName(e.target.value)} className="bg-background/50 border-border font-mono h-9 text-sm" />
            </div>
            {(mode === "gold" || mode === "coin") && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Token Price ($) <span className="opacity-60 zh-only">代币价格</span></Label>
                <Input type="number" value={tokenPrice} onChange={e => setTokenPrice(Number(e.target.value))} min={0.0001} step={0.01} className="bg-background/50 border-border font-mono h-9 text-sm" />
              </div>
            )}
          </div>
          <SliderRow label="Investment / Principal ($)" labelZh="投资/本金" value={investment} set={setInvestment} min={100} max={100000} step={100} display={formatCurrency(investment)} />

          {(mode === "gold" || mode === "coin") && (
            <>
              <SliderRow label="Release Multiplier" labelZh="释放倍率" value={multiplier} set={setMultiplier} min={1} max={10} step={0.5} display={`${multiplier}×`} />
              <SliderRow label="Staking Period (Days)" labelZh="铸造天数" value={days} set={setDays} min={30} max={720} step={30} display={`${days}d`} />
            </>
          )}

          {mode === "exit" && (
            <>
              <SliderRow label="Daily Profit Rate %" labelZh="日收益率" value={dailyProfitRate} set={setDailyProfitRate} min={0.1} max={5} step={0.1} display={`${dailyProfitRate.toFixed(1)}%`} />
              <SliderRow label="Exit Multiplier" labelZh="出局倍数" value={exitMultiplier} set={setExitMultiplier} min={1.5} max={10} step={0.5} display={`${exitMultiplier}×`} />
            </>
          )}

          {(mode === "principal_interest" || mode === "maturity") && (
            <>
              <SliderRow label="Annual Interest Rate %" labelZh="年化利率" value={annualRate} set={setAnnualRate} min={1} max={200} step={1} display={`${annualRate}%`} />
              <SliderRow label="Period (Days)" labelZh="产品周期" value={days} set={setDays} min={30} max={720} step={30} display={`${days}d`} />
            </>
          )}

          {/* Mode-specific formula note */}
          <div className="pt-1 p-3 bg-background/30 rounded-lg border border-border/50 text-[11px] text-muted-foreground space-y-1 leading-relaxed">
            {showZh && mode === "gold" && <><p><strong>金本位:</strong> 总释放USDC = 本金 × 倍率</p><p>每日代币 = 总USDC ÷ 天数 ÷ 代币价</p></>}
            {showZh && mode === "coin" && <><p><strong>币本位:</strong> 购入代币 = 本金 ÷ 代币价</p><p>总释放 = 购入量 × 倍率，按天平均</p></>}
            {showZh && mode === "exit" && <><p><strong>倍数出局:</strong> 每日收益 = 本金 × 日收益率</p><p>累计到达 本金 × 出局倍数 时停止</p></>}
            {showZh && mode === "principal_interest" && <><p><strong>本息释放:</strong> 本金 + 利息 每日均匀返还</p><p>本息 = 本金 × (1 + 年化 × 天数/365)</p></>}
            {showZh && mode === "maturity" && <><p><strong>到期还本:</strong> 每日释放利息</p><p>到期日一次性退还全部本金</p></>}
          </div>
        </ParamsCard>

        {/* ── Results ── */}
        <div className="space-y-5">
          <KpiGrid items={kpis} />
          <Card className="bg-card/70 border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">
                {mode === "exit" ? "Cumulative Earnings vs Exit Target" :
                 mode === "maturity" ? "Daily Interest + Maturity Principal" :
                 mode === "principal_interest" ? "Principal vs Interest Release" :
                 "Cumulative Release Curve"}
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  {(() => {
                    const [en, zh] = mode === "exit" ? ["Cumulative vs Target", "累计收益 vs 出局目标"] :
                                     mode === "maturity" ? ["Daily Interest + Principal", "日利息 + 到期还本"] :
                                     mode === "principal_interest" ? ["P+I Breakdown", "本息分解"] :
                                     ["Cumulative Release Curve", "累计释放曲线"];
                    return showZh ? `${en} · ${zh}` : en;
                  })()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[240px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  {mode === "exit" ? (
                    <AreaChart data={display}>
                      <defs>
                        <linearGradient id="gExit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v, 0)}`} />
                      <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [formatCurrency(v), n === "value" ? "Cumulative" : "Exit Target"]} labelFormatter={l => `Day ${l}`} />
                      <ReferenceLine y={investment * exitMultiplier} stroke="hsl(var(--destructive))" strokeDasharray="6 3" label={{ value: `${exitMultiplier}× Exit`, fill: "hsl(var(--destructive))", fontSize: 10, position: "right" }} />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#gExit)" name="value" />
                    </AreaChart>
                  ) : mode === "principal_interest" ? (
                    <AreaChart data={display}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v, 0)}`} />
                      <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [formatCurrency(v), n === "principal" ? (showZh ? "Principal · 本金" : "Principal") : (showZh ? "Interest · 利息" : "Interest")]} labelFormatter={l => `Day ${l}`} />
                      <Area type="monotone" dataKey="principal" stackId="1" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground)/0.2)" name="principal" />
                      <Area type="monotone" dataKey="interest" stackId="1" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2)/0.3)" strokeWidth={2} name="interest" />
                    </AreaChart>
                  ) : mode === "maturity" ? (
                    <AreaChart data={display}>
                      <defs>
                        <linearGradient id="gMat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v, 0)}`} />
                      <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [formatCurrency(v), n === "interest" ? "Cumulative Interest" : "Principal Return"]} labelFormatter={l => `Day ${l}`} />
                      <Area type="monotone" dataKey="interest" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#gMat)" name="interest" />
                      <Bar dataKey="principal" fill="hsl(var(--primary))" name="principal" />
                    </AreaChart>
                  ) : (
                    <AreaChart data={display}>
                      <defs>
                        <linearGradient id="gStake2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v, 0)}`} />
                      <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [n === "tokens" ? `${fmt(v)} ${tokenName}` : formatCurrency(v), n === "tokens" ? `Cum. ${tokenName}` : "USDC Value"]} labelFormatter={l => `Day ${l}`} />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#gStake2)" name="value" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Pledge & Mining ──────────────────────────────────────────────────────────

type PledgeMode = "pledge" | "mining";

function PledgeMining() {
  const [subMode, setSubMode] = useState<PledgeMode>("pledge");

  // ── Buy-Coin Pledge params ──
  const [tokenName, setTokenName] = useState("MS");
  const [usdcIn, setUsdcIn] = useState(5000);
  const [buyPrice, setBuyPrice] = useState(0.5);
  const [stakingApy, setStakingApy] = useState(120);
  const [pledgeDays, setPledgeDays] = useState(365);
  const [rewardName, setRewardName] = useState("MS");
  const [rewardPrice, setRewardPrice] = useState(0.5);
  const [exitPrice, setExitPrice] = useState(1.0);

  // ── Mining params ──
  const [myHash, setMyHash] = useState(100);
  const [poolHash, setPoolHash] = useState(10000);
  const [blockReward, setBlockReward] = useState(1000);
  const [minerTokenName, setMinerTokenName] = useState("BTC");
  const [mineTokenPrice, setMineTokenPrice] = useState(50000);
  const [electricityCost, setElectricityCost] = useState(10);
  const [diffIncreasePct, setDiffIncreasePct] = useState(5);
  const [miningDays, setMiningDays] = useState(365);

  // ── Pledge calcs ──
  const pledgeCalc = useMemo(() => {
    const tokensBought = usdcIn / buyPrice;
    const dailyRewardRate = stakingApy / 100 / 365;
    const dailyRewards = tokensBought * dailyRewardRate;
    const totalRewards = dailyRewards * pledgeDays;
    const rewardValue = totalRewards * rewardPrice;
    const exitValue = tokensBought * exitPrice + rewardValue;
    const roi = (exitValue - usdcIn) / usdcIn * 100;
    const chartData = Array.from({ length: pledgeDays }, (_, i) => ({
      day: i + 1,
      rewards: dailyRewards * (i + 1),
      rewardUsd: dailyRewards * (i + 1) * rewardPrice,
      posValue: tokensBought * exitPrice + dailyRewards * (i + 1) * rewardPrice,
    })).filter((_, i) => i % Math.max(1, Math.ceil(pledgeDays / 90)) === 0);
    return { tokensBought, dailyRewards, totalRewards, rewardValue, exitValue, roi, chartData };
  }, [usdcIn, buyPrice, stakingApy, pledgeDays, rewardPrice, exitPrice]);

  // ── Mining calcs ──
  const mineCalc = useMemo(() => {
    const share = poolHash > 0 ? myHash / poolHash : 0;
    const chartData: { day: number; dailyTokens: number; dailyProfit: number; cumProfit: number }[] = [];
    let cumProfit = 0;
    for (let d = 1; d <= miningDays; d++) {
      const diffFactor = Math.pow(1 + diffIncreasePct / 100, (d - 1) / 30);
      const dailyTokens = blockReward * share / diffFactor;
      const dailyRevenue = dailyTokens * mineTokenPrice;
      const dailyProfit = dailyRevenue - electricityCost;
      cumProfit += dailyProfit;
      if (d % Math.max(1, Math.ceil(miningDays / 90)) === 0)
        chartData.push({ day: d, dailyTokens, dailyProfit, cumProfit });
    }
    const last = chartData[chartData.length - 1];
    const breakEvenPrice = share > 0 && blockReward > 0 ? (electricityCost * 30) / (blockReward * share) : 0;
    return { share, chartData, totalProfit: last?.cumProfit ?? 0, breakEvenPrice };
  }, [myHash, poolHash, blockReward, mineTokenPrice, electricityCost, diffIncreasePct, miningDays]);

  return (
    <div className="space-y-6">
      <ToolHeader icon={<Pickaxe className="h-4 w-4 text-chart-5" />} title="Pledge & Mining" titleZh="质押与挖矿" desc="Buy-coin pledge staking and computational / LP mining calculators" descZh="购币质押与算力/流动性挖矿收益计算" />

      {/* Sub-mode toggle */}
      <div className="flex gap-3">
        {[
          { id: "pledge" as PledgeMode, name: "Buy-Coin Pledge", nameZh: "购币质押", desc: "Buy tokens → stake → earn rewards" },
          { id: "mining" as PledgeMode, name: "Mining Calculator", nameZh: "挖矿计算器", desc: "Hash share → daily block rewards" },
        ].map(m => (
          <button key={m.id} onClick={() => setSubMode(m.id)}
            className={`flex-1 text-left p-3 rounded-xl border transition-all ${subMode === m.id ? "bg-chart-5/10 border-chart-5/40" : "bg-card/40 border-border hover:bg-muted/30"}`}>
            <p className={`text-sm font-semibold ${subMode === m.id ? "text-chart-5" : "text-foreground"}`}>{m.name}</p>
            <p className="text-xs text-muted-foreground">{m.nameZh}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1 hidden sm:block">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* ── Buy-Coin Pledge ── */}
      {subMode === "pledge" && (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
          <ParamsCard title="Parameters" titleZh="参数设置">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Token <span className="opacity-60 zh-only">质押代币</span></Label>
                <Input value={tokenName} onChange={e => setTokenName(e.target.value)} className="bg-background/50 border-border font-mono h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Reward Token <span className="opacity-60 zh-only">奖励代币</span></Label>
                <Input value={rewardName} onChange={e => setRewardName(e.target.value)} className="bg-background/50 border-border font-mono h-9 text-sm" />
              </div>
            </div>
            <SliderRow label="USDC Investment" labelZh="USDC投入" value={usdcIn} set={setUsdcIn} min={100} max={100000} step={100} display={formatCurrency(usdcIn)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Buy Price ($) <span className="opacity-60 zh-only">购入价</span></Label>
                <Input type="number" value={buyPrice} onChange={e => setBuyPrice(Number(e.target.value))} min={0.0001} step={0.01} className="bg-background/50 border-border font-mono h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Exit Price ($) <span className="opacity-60 zh-only">预期退出价</span></Label>
                <Input type="number" value={exitPrice} onChange={e => setExitPrice(Number(e.target.value))} min={0.0001} step={0.01} className="bg-background/50 border-border font-mono h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reward Token Price ($) <span className="opacity-60 zh-only">奖励代币价</span></Label>
              <Input type="number" value={rewardPrice} onChange={e => setRewardPrice(Number(e.target.value))} min={0.0001} step={0.01} className="bg-background/50 border-border font-mono h-9 text-sm" />
            </div>
            <SliderRow label="Staking APY %" labelZh="质押年化收益" value={stakingApy} set={setStakingApy} min={1} max={500} step={5} display={`${stakingApy}%`} />
            <SliderRow label="Pledge Period (Days)" labelZh="质押周期" value={pledgeDays} set={setPledgeDays} min={30} max={720} step={30} display={`${pledgeDays}d`} />
          </ParamsCard>
          <div className="space-y-5">
            <KpiGrid items={[
              { label: `${tokenName} Staked`, labelZh: "质押数量", value: `${fmt(pledgeCalc.tokensBought)} ${tokenName}`, color: "text-chart-5" },
              { label: `Daily ${rewardName}`, labelZh: "每日奖励", value: `${fmt(pledgeCalc.dailyRewards)} ${rewardName}` },
              { label: "Total Reward Value", labelZh: "奖励总价值", value: formatCurrency(pledgeCalc.rewardValue), color: "text-chart-2" },
              { label: "ROI (w/ Exit)", labelZh: "综合回报率", value: `${pledgeCalc.roi >= 0 ? "+" : ""}${pledgeCalc.roi.toFixed(1)}%`, color: pledgeCalc.roi >= 0 ? "text-chart-2" : "text-destructive" },
            ]} />
            <Card className="bg-card/70 border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold">Cumulative Rewards & Portfolio Value <span className="text-xs font-normal text-muted-foreground ml-1 zh-only">累计奖励与总价值</span></CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pledgeCalc.chartData}>
                      <defs>
                        <linearGradient id="gPledge" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v, 0)}`} />
                      <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [formatCurrency(v), n === "posValue" ? "Portfolio Value" : "Reward USD Value"]} labelFormatter={l => `Day ${l}`} />
                      <Area type="monotone" dataKey="rewardUsd" stroke="hsl(var(--chart-2))" strokeWidth={1.5} fill="hsl(var(--chart-2)/0.15)" name="rewardUsd" />
                      <Area type="monotone" dataKey="posValue" stroke="hsl(var(--chart-5))" strokeWidth={2} fill="url(#gPledge)" name="posValue" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="p-3 bg-background/30 rounded-lg border border-border/50 text-xs text-muted-foreground space-y-1">
                  <p>Buy <span className="font-mono text-foreground">{fmt(pledgeCalc.tokensBought)} {tokenName}</span> @ <span className="font-mono">${buyPrice}</span> → Stake for <span className="font-mono">{pledgeDays}d</span> → Earn <span className="font-mono text-chart-2">{fmt(pledgeCalc.totalRewards)} {rewardName}</span> @ <span className="font-mono">${rewardPrice}</span></p>
                  <p>Exit @ <span className="font-mono">${exitPrice}</span>/token → Total value: <span className="font-mono text-chart-2 font-semibold">{formatCurrency(pledgeCalc.exitValue)}</span> · ROI: <span className={`font-mono font-semibold ${pledgeCalc.roi >= 0 ? "text-chart-2" : "text-destructive"}`}>{pledgeCalc.roi >= 0 ? "+" : ""}{pledgeCalc.roi.toFixed(1)}%</span></p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Mining ── */}
      {subMode === "mining" && (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
          <ParamsCard title="Parameters" titleZh="参数设置">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Token <span className="opacity-60 zh-only">挖矿代币</span></Label>
                <Input value={minerTokenName} onChange={e => setMinerTokenName(e.target.value)} className="bg-background/50 border-border font-mono h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Token Price ($) <span className="opacity-60 zh-only">代币价格</span></Label>
                <Input type="number" value={mineTokenPrice} onChange={e => setMineTokenPrice(Number(e.target.value))} min={0.001} step={100} className="bg-background/50 border-border font-mono h-9 text-sm" />
              </div>
            </div>
            <SliderRow label="My Hash Rate (TH/s)" labelZh="我的算力" value={myHash} set={setMyHash} min={1} max={10000} step={10} display={`${fmt(myHash)}TH`} />
            <SliderRow label="Pool Total Hash (TH/s)" labelZh="全网算力" value={poolHash} set={setPoolHash} min={100} max={1000000} step={1000} display={`${fmt(poolHash)}TH`} />
            <SliderRow label="Daily Block Rewards" labelZh="每日区块奖励" value={blockReward} set={setBlockReward} min={1} max={10000} step={10} display={`${fmt(blockReward)}`} />
            <SliderRow label="Electricity Cost ($/day)" labelZh="每日电费" value={electricityCost} set={setElectricityCost} min={0} max={1000} step={5} display={`$${electricityCost}`} />
            <SliderRow label="Monthly Difficulty +" labelZh="月度难度增长" value={diffIncreasePct} set={setDiffIncreasePct} min={0} max={50} step={1} display={`${diffIncreasePct}%/mo`} />
            <SliderRow label="Simulation Days" labelZh="模拟天数" value={miningDays} set={setMiningDays} min={30} max={730} step={30} display={`${miningDays}d`} />
          </ParamsCard>
          <div className="space-y-5">
            <KpiGrid items={[
              { label: "Pool Share", labelZh: "算力占比", value: `${(mineCalc.share * 100).toFixed(3)}%`, color: "text-chart-5" },
              { label: "Break-even Price", labelZh: "盈亏平衡价", value: `$${mineCalc.breakEvenPrice.toFixed(4)}`, color: mineTokenPrice > mineCalc.breakEvenPrice ? "text-chart-2" : "text-destructive" },
              { label: `Total Profit (${miningDays}d)`, labelZh: "总利润", value: formatCurrency(mineCalc.totalProfit), color: mineCalc.totalProfit >= 0 ? "text-chart-2" : "text-destructive" },
              { label: "Status", labelZh: "当前状态", value: mineTokenPrice > mineCalc.breakEvenPrice ? "Profitable" : "Underwater", color: mineTokenPrice > mineCalc.breakEvenPrice ? "text-chart-2" : "text-destructive" },
            ]} />
            <Card className="bg-card/70 border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold">Cumulative Profit Trajectory <span className="text-xs font-normal text-muted-foreground ml-1 zh-only">累计利润曲线（含难度增长）</span></CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mineCalc.chartData}>
                      <defs>
                        <linearGradient id="gMine" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v, 0)}`} />
                      <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [n === "cumProfit" ? formatCurrency(v) : `${fmt(v)} ${minerTokenName}`, n === "cumProfit" ? "Cum. Profit" : "Daily Tokens"]} labelFormatter={l => `Day ${l}`} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <Area type="monotone" dataKey="cumProfit" stroke="hsl(var(--chart-5))" strokeWidth={2} fill="url(#gMine)" name="cumProfit" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Daily Revenue (Day 1)", labelZh: "第1天日收入", val: formatCurrency((mineCalc.chartData[0]?.dailyTokens ?? 0) * mineTokenPrice) },
                    { label: `Daily Revenue (Day ${miningDays})`, labelZh: "最后一天日收入", val: formatCurrency((mineCalc.chartData[mineCalc.chartData.length - 1]?.dailyTokens ?? 0) * mineTokenPrice) },
                    { label: "Break-even Price", labelZh: "盈亏平衡", val: `$${mineCalc.breakEvenPrice.toFixed(4)}` },
                  ].map(({ label, labelZh, val }) => (
                    <div key={label} className="p-3 bg-background/30 rounded-lg border border-border/50">
                      <p className="text-[11px] text-muted-foreground">{label} · {labelZh}</p>
                      <p className="text-sm font-bold font-mono mt-1">{val}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AAM Pool Simulator ───────────────────────────────────────────────────────

function AAMPoolSimulator() {
  const [tokenName, setTokenName] = useState("MS");
  const [initUsdc, setInitUsdc] = useState(50000);
  const [initMs, setInitMs] = useState(200000);
  const [days, setDays] = useState(90);
  const [dailyDeposit, setDailyDeposit] = useState(2000);
  const [lpRatio, setLpRatio] = useState(30);
  const [buybackRatio, setBuybackRatio] = useState(20);
  const [sellPressure, setSellPressure] = useState(500);

  const initialPrice = initMs > 0 ? initUsdc / initMs : 0;
  const data = useMemo(() => simulateAAMPoolStandalone(initUsdc, initMs, days, dailyDeposit, lpRatio, buybackRatio, sellPressure), [initUsdc, initMs, days, dailyDeposit, lpRatio, buybackRatio, sellPressure]);
  const last = data[data.length - 1];
  const priceChg = initialPrice > 0 ? ((last.price - initialPrice) / initialPrice) * 100 : 0;
  const display = data.filter((_, i) => i % Math.max(1, Math.ceil(data.length / 90)) === 0);

  return (
    <div className="space-y-6">
      <ToolHeader icon={<Droplets className="h-4 w-4 text-chart-4" />} title="AAM Pool Simulator" titleZh="流动性池模拟" desc="Simulate constant-product AMM pool dynamics over time" descZh="模拟 AMM 恒积流动性池的价格与TVL动态" />
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <ParamsCard title="Parameters" titleZh="参数设置">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token Name <span className="opacity-60 zh-only">代币名称</span></Label>
              <Input value={tokenName} onChange={e => setTokenName(e.target.value)} className="bg-background/50 border-border font-mono h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sim Days <span className="opacity-60 zh-only">模拟天数</span></Label>
              <Input type="number" value={days} onChange={e => setDays(Math.max(1, Number(e.target.value)))} className="bg-background/50 border-border font-mono h-9 text-sm" />
            </div>
          </div>
          <SliderRow label={`Initial Pool USDC`} labelZh="初始USDC" value={initUsdc} set={setInitUsdc} min={1000} max={1000000} step={1000} display={`$${fmt(initUsdc, 0)}`} />
          <SliderRow label={`Initial Pool ${tokenName}`} labelZh="初始代币" value={initMs} set={setInitMs} min={1000} max={10000000} step={10000} display={`${fmt(initMs, 0)}`} />
          <SliderRow label="Daily Deposit (USDC)" labelZh="每日新增存款" value={dailyDeposit} set={setDailyDeposit} min={0} max={50000} step={500} display={`$${fmt(dailyDeposit, 0)}`} />
          <SliderRow label="LP Add Ratio %" labelZh="LP注入比例" value={lpRatio} set={setLpRatio} min={0} max={80} step={5} display={`${lpRatio}%`} />
          <SliderRow label="Buyback Ratio %" labelZh="回购比例" value={buybackRatio} set={setBuybackRatio} min={0} max={80} step={5} display={`${buybackRatio}%`} />
          <SliderRow label={`Daily Sell (${tokenName})`} labelZh="每日抛压" value={sellPressure} set={setSellPressure} min={0} max={10000} step={100} display={`${fmt(sellPressure)}`} />
        </ParamsCard>
        <div className="space-y-5">
          <KpiGrid items={[
            { label: "Initial Price", labelZh: "初始价格", value: `$${initialPrice.toFixed(4)}`, color: "text-muted-foreground" },
            { label: "Final Price", labelZh: "最终价格", value: `$${last.price.toFixed(4)}`, color: priceChg >= 0 ? "text-chart-2" : "text-destructive" },
            { label: "Price Change", labelZh: "价格变化", value: `${priceChg >= 0 ? "+" : ""}${priceChg.toFixed(2)}%`, color: priceChg >= 0 ? "text-chart-2" : "text-destructive" },
            { label: "Final TVL", labelZh: "最终锁仓", value: `$${fmt(last.tvl)}`, color: "text-chart-4" },
          ]} />
          <Card className="bg-card/70 border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">{tokenName} Price Trajectory <span className="text-xs font-normal text-muted-foreground ml-1 zh-only">价格走势</span></CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              <div className="h-[180px] sm:h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={display}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                    <Tooltip contentStyle={TS} formatter={(v: number) => [`$${v.toFixed(4)}`, `${tokenName} Price`]} labelFormatter={l => `Day ${l}`} />
                    <ReferenceLine y={initialPrice} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.4} />
                    <Line type="monotone" dataKey="price" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[160px] sm:h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={display}>
                    <defs>
                      <linearGradient id="gTvl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v, 0)}`} />
                    <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [`$${fmt(v)}`, n === "tvl" ? "TVL" : "Cum. Buyback"]} labelFormatter={l => `Day ${l}`} />
                    <Area type="monotone" dataKey="tvl" stroke="hsl(var(--chart-4))" strokeWidth={2} fill="url(#gTvl)" name="tvl" />
                    <Line type="monotone" dataKey="cumulativeBuyback" stroke="hsl(var(--chart-2))" strokeWidth={1.5} dot={false} name="cumulativeBuyback" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── CLMM Analyzer ────────────────────────────────────────────────────────────

function CLMMAnalyzer() {
  const [tokenName, setTokenName] = useState("MS");
  const [tokenPrice, setTokenPrice] = useState(0.5);
  const [depositX, setDepositX] = useState(10000);
  const [depositY, setDepositY] = useState(5000);
  const [rangeWidth, setRangeWidth] = useState(20);
  const [feeTier, setFeeTier] = useState(0.003);
  const [dailyVolume, setDailyVolume] = useState(50000);
  const [totalPoolLiq, setTotalPoolLiq] = useState(1000000);
  const [days, setDays] = useState(90);
  const [vol, setVol] = useState(3);
  const [drift, setDrift] = useState(0);

  const analysis = useMemo(() => analyzeCLMMPosition(depositX, depositY, tokenPrice, rangeWidth, feeTier, dailyVolume, totalPoolLiq, days, vol, drift), [depositX, depositY, tokenPrice, rangeWidth, feeTier, dailyVolume, totalPoolLiq, days, vol, drift]);
  const priceLower = tokenPrice * (1 - rangeWidth / 100);
  const priceUpper = tokenPrice * (1 + rangeWidth / 100);
  const depositValue = depositX * tokenPrice + depositY;
  const traj = analysis.priceTrajectory.filter((_, i) => i % Math.max(1, Math.ceil(analysis.priceTrajectory.length / 90)) === 0);

  return (
    <div className="space-y-6">
      <ToolHeader icon={<Target className="h-4 w-4 text-chart-5" />} title="CLMM Analyzer" titleZh="集中流动性分析" desc="Model a Uniswap V3-style concentrated liquidity position" descZh="集中流动性区间仓位的资本效率与手续费预测" />
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <ParamsCard title="Parameters" titleZh="参数设置">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token Name <span className="opacity-60 zh-only">代币名称</span></Label>
              <Input value={tokenName} onChange={e => setTokenName(e.target.value)} className="bg-background/50 border-border font-mono h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token Price ($) <span className="opacity-60 zh-only">代币价格</span></Label>
              <Input type="number" value={tokenPrice} onChange={e => setTokenPrice(Number(e.target.value))} min={0.0001} step={0.01} className="bg-background/50 border-border font-mono h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Deposit {tokenName} <span className="opacity-60 zh-only">代币数量</span></Label>
              <Input type="number" value={depositX} onChange={e => setDepositX(Number(e.target.value))} className="bg-background/50 border-border font-mono h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Deposit USDC <span className="opacity-60 zh-only">USDC数量</span></Label>
              <Input type="number" value={depositY} onChange={e => setDepositY(Number(e.target.value))} className="bg-background/50 border-border font-mono h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fee Tier <span className="opacity-60 zh-only">手续费档位</span></Label>
            <Select value={String(feeTier)} onValueChange={v => setFeeTier(Number(v))}>
              <SelectTrigger className="bg-background/50 border-border h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.0005">0.05%<span className="zh-only ml-1">稳定对</span></SelectItem>
                <SelectItem value="0.003">0.3%<span className="zh-only ml-1">标准</span></SelectItem>
                <SelectItem value="0.01">1%<span className="zh-only ml-1">高波动</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Price Range ±%" labelZh="价格区间宽度" value={rangeWidth} set={setRangeWidth} min={5} max={100} step={5} display={`±${rangeWidth}%`} />
          <SliderRow label="Daily Volume ($)" labelZh="每日交易量" value={dailyVolume} set={setDailyVolume} min={1000} max={500000} step={5000} display={`$${fmt(dailyVolume, 0)}`} />
          <SliderRow label="Sim Days" labelZh="模拟天数" value={days} set={setDays} min={7} max={180} step={7} display={`${days}d`} />
          <SliderRow label="Daily Volatility %" labelZh="每日波动率" value={vol} set={setVol} min={0.5} max={10} step={0.5} display={`${vol}%`} />
          <SliderRow label="Daily Drift %" labelZh="每日趋势漂移" value={drift} set={setDrift} min={-5} max={5} step={0.5} display={`${drift >= 0 ? "+" : ""}${drift}%`} />
        </ParamsCard>
        <div className="space-y-5">
          <KpiGrid items={[
            { label: "Capital Efficiency", labelZh: "资本效率", value: `${analysis.capitalEfficiency.toFixed(1)}×`, color: "text-chart-5" },
            { label: "Fees 30d", labelZh: "30天费用", value: formatCurrency(analysis.feesEarned30d), color: "text-chart-2" },
            { label: "Fees 90d", labelZh: "90天费用", value: formatCurrency(analysis.feesEarned90d), color: "text-chart-2" },
            { label: "Break-even", labelZh: "费用覆盖IL", value: analysis.breakEvenDays > 999 ? ">999d" : `${analysis.breakEvenDays}d`, color: analysis.breakEvenDays < 60 ? "text-chart-2" : "text-muted-foreground" },
          ]} />
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card/60 border-border p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">IL at Lower <span className="opacity-60 zh-only">下界</span></p>
              <p className="text-xl font-bold font-mono text-destructive">-{analysis.ilAtLower.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground mt-1">${priceLower.toFixed(4)}</p>
            </Card>
            <Card className="bg-card/60 border-border p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">IL at Upper <span className="opacity-60 zh-only">上界</span></p>
              <p className="text-xl font-bold font-mono text-destructive">-{analysis.ilAtUpper.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground mt-1">${priceUpper.toFixed(4)}</p>
            </Card>
          </div>
          <Card className="bg-card/70 border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex flex-wrap items-center justify-between gap-2">
                <span>Price + Cumulative Fees <span className="text-xs font-normal text-muted-foreground zh-only">价格 & 累计手续费</span></span>
                <Badge variant="outline" className="text-[11px] border-chart-5/40 text-chart-5">${priceLower.toFixed(3)} – ${priceUpper.toFixed(3)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[220px] sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={traj}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v)}`} />
                    <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [n === "price" ? `$${v.toFixed(4)}` : formatCurrency(v), n === "price" ? `${tokenName} Price` : "Cum. Fees"]} labelFormatter={l => `Day ${l}`} />
                    <ReferenceLine yAxisId="left" y={priceLower} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <ReferenceLine yAxisId="left" y={priceUpper} stroke="hsl(var(--chart-2))" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Line yAxisId="left" type="monotone" dataKey="price" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulativeFees" stroke="hsl(var(--chart-2))" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Deposit: <span className="font-mono">{formatCurrency(depositValue)}</span> · Capital efficiency vs V2: <span className="font-mono text-chart-5">{analysis.capitalEfficiency.toFixed(1)}×</span></p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Trading Profit Calculator ────────────────────────────────────────────────

function TradingProfitCalculator() {
  const showZh = useShowZh();
  const [tokenName, setTokenName] = useState("MS");
  const [capital, setCapital] = useState(10000);
  const [volumePct, setVolumePct] = useState(50);
  const [profitRate, setProfitRate] = useState(5);
  const [feeRate, setFeeRate] = useState(15);
  const [profitShare, setProfitShare] = useState(70);
  const [lpRatio, setLpRatio] = useState(30);
  const [buybackRatio, setBuybackRatio] = useState(20);
  const [reserveRatio, setReserveRatio] = useState(50);

  const daily = useMemo(() => calculateTradingProfitBreakdown(capital, volumePct, profitRate, feeRate, profitShare, lpRatio, buybackRatio, reserveRatio), [capital, volumePct, profitRate, feeRate, profitShare, lpRatio, buybackRatio, reserveRatio]);

  const pieData = [
    { name: (showZh ? "User · 用户" : "User"), value: daily.userProfit, color: "hsl(var(--chart-2))" },
    { name: (showZh ? "Platform · 平台" : "Platform"), value: daily.platformProfit, color: "hsl(var(--primary))" },
    { name: (showZh ? "Broker · 推荐商" : "Broker"), value: daily.brokerProfit, color: "hsl(var(--chart-3))" },
    { name: (showZh ? "Fee · 手续费" : "Fee"), value: daily.tradingFee, color: "hsl(var(--muted-foreground))" },
  ].filter(d => d.value > 0);

  const flowData = [
    { name: "LP Pool", value: daily.lpContributionUsdc, color: "hsl(var(--chart-4))" },
    { name: "Buyback", value: daily.buybackAmount, color: "hsl(var(--chart-2))" },
    { name: "Reserve", value: daily.reserveAmount, color: "hsl(var(--chart-5))" },
  ];

  return (
    <div className="space-y-6">
      <ToolHeader icon={<BarChart3 className="h-4 w-4 text-primary" />} title="Trading Profit" titleZh="交易分红计算" desc="Simulate daily trading capital distribution and profit sharing" descZh="每日交易资本分配与收益分润模拟" />
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <ParamsCard title="Parameters" titleZh="参数设置">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token Name <span className="opacity-60 zh-only">代币</span></Label>
              <Input value={tokenName} onChange={e => setTokenName(e.target.value)} className="bg-background/50 border-border font-mono h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Trading Capital (USDC) <span className="opacity-60 zh-only">交易资本</span></Label>
              <Input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} className="bg-background/50 border-border font-mono h-9 text-sm" />
            </div>
          </div>
          <SliderRow label="Daily Volume %" labelZh="每日交易量%" value={volumePct} set={setVolumePct} min={1} max={200} step={5} display={`${volumePct}%`} />
          <SliderRow label="Daily Profit Rate %" labelZh="日盈利率%" value={profitRate} set={setProfitRate} min={0.1} max={20} step={0.5} display={`${profitRate}%`} />
          <SliderRow label="Trading Fee %" labelZh="手续费率%" value={feeRate} set={setFeeRate} min={0} max={50} step={1} display={`${feeRate}%`} />
          <SliderRow label="User Profit Share %" labelZh="用户分润%" value={profitShare} set={setProfitShare} min={50} max={90} step={5} display={`${profitShare}%`} />
          <Separator />
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Fund Flow<span className="zh-only ml-1">资金流向</span></p>
          <SliderRow label="LP Pool %" labelZh="注入流动池" value={lpRatio} set={setLpRatio} min={0} max={80} step={5} display={`${lpRatio}%`} />
          <SliderRow label="Buyback %" labelZh="回购比例" value={buybackRatio} set={setBuybackRatio} min={0} max={80} step={5} display={`${buybackRatio}%`} />
          <SliderRow label="Reserve %" labelZh="储备金" value={reserveRatio} set={setReserveRatio} min={0} max={80} step={5} display={`${reserveRatio}%`} />
        </ParamsCard>
        <div className="space-y-5">
          <KpiGrid items={[
            { label: "User Profit/Day", labelZh: "用户每日收益", value: formatCurrency(daily.userProfit), color: "text-chart-2" },
            { label: "User Profit/Month", labelZh: "用户月度收益", value: formatCurrency(daily.userProfit * 30), color: "text-chart-2" },
            { label: "Daily ROI", labelZh: "日收益率", value: `${daily.roi.toFixed(3)}%`, color: "text-primary" },
            { label: "Gross/Day", labelZh: "每日毛利", value: formatCurrency(daily.grossProfit), color: "text-muted-foreground" },
          ]} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Card className="bg-card/70 border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50"><CardTitle className="text-sm font-semibold">Daily Profit Split <span className="text-xs font-normal text-muted-foreground ml-1 zh-only">每日收益分配</span></CardTitle></CardHeader>
              <CardContent className="pt-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [formatCurrency(v), n]} />
                      <Legend iconSize={8} iconType="circle" formatter={v => <span className="text-[11px] text-muted-foreground">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/70 border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50"><CardTitle className="text-sm font-semibold">Fund Flow Allocation <span className="text-xs font-normal text-muted-foreground ml-1 zh-only">资金流向</span></CardTitle></CardHeader>
              <CardContent className="pt-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={flowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${fmt(v)}`} />
                      <Tooltip contentStyle={TS} formatter={(v: number) => [formatCurrency(v), "Daily"]} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {flowData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="bg-card/70 border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50"><CardTitle className="text-sm font-semibold">Monthly Summary <span className="text-xs font-normal text-muted-foreground ml-1 zh-only">月度汇总</span></CardTitle></CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Gross", labelZh: "毛利润", val: formatCurrency(daily.grossProfit * 30) },
                  { label: "Fee", labelZh: "手续费", val: formatCurrency(daily.tradingFee * 30) },
                  { label: "User", labelZh: "用户分红", val: formatCurrency(daily.userProfit * 30), hi: true },
                  { label: "Platform", labelZh: "平台", val: formatCurrency(daily.platformProfit * 30) },
                  { label: "Broker", labelZh: "推荐商", val: formatCurrency(daily.brokerProfit * 30) },
                ].map(({ label, labelZh, val, hi }) => (
                  <div key={label} className={`p-3 rounded-lg border ${hi ? "bg-chart-2/10 border-chart-2/30" : "bg-background/30 border-border"}`}>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label} <span className="opacity-60">{labelZh}</span></p>
                    <p className={`text-sm font-bold font-mono mt-1 ${hi ? "text-chart-2" : ""}`}>{val}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Broker Earnings Calculator ───────────────────────────────────────────────

function BrokerEarningsCalculator() {
  const showZh = useShowZh();
  const [tokenName, setTokenName] = useState("MS");
  const [systemId, setSystemId] = useState("afx_v");
  const [brokerLevel, setBrokerLevel] = useState("V3");
  const [msPerLayer, setMsPerLayer] = useState(200);
  const [grossProfit, setGrossProfit] = useState(5000);
  const [feeRate, setFeeRate] = useState(15);
  const [profitShare, setProfitShare] = useState(70);
  const [subLevel, setSubLevel] = useState("none");

  const system = useMemo(() => BROKER_SYSTEMS.find(s => s.id === systemId) ?? BROKER_SYSTEMS[0], [systemId]);

  // Reset level when system changes
  const validLevel = system.levels.includes(brokerLevel) ? brokerLevel : system.levels[Math.floor(system.levels.length / 2)];

  const breakdown = useMemo(() => calculateBrokerLayerBreakdown(msPerLayer, validLevel, system), [msPerLayer, validLevel, system]);
  const dividend = useMemo(() => calculateBrokerDividendEarnings(grossProfit, feeRate, profitShare, validLevel, subLevel === "none" ? null : subLevel, system), [grossProfit, feeRate, profitShare, validLevel, subLevel, system]);

  const maxLayer = system.maxLayersPerLevel[validLevel] ?? 0;
  const barData = breakdown.layers.map(l => ({
    layer: `L${l.layer}`,
    rate: l.rate,
    earnings: l.earningsPerDay,
    accessible: l.accessible,
  }));

  return (
    <div className="space-y-6">
      <ToolHeader icon={<Users className="h-4 w-4 text-chart-2" />} title="Broker Earnings" titleZh="推荐层级收益" desc="Calculate layer-based MS income and dividend pool earnings across different reward systems" descZh="不同推荐制度下的层级收益与分红池计算" />

      {/* System picker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {BROKER_SYSTEMS.map(s => (
          <button
            key={s.id}
            onClick={() => { setSystemId(s.id); setBrokerLevel(s.levels[Math.floor(s.levels.length / 2)]); setSubLevel("none"); }}
            className={`text-left p-3 rounded-xl border transition-all ${systemId === s.id ? "bg-chart-2/10 border-chart-2/40" : "bg-card/40 border-border hover:bg-muted/30"}`}
          >
            <p className={`text-sm font-semibold ${systemId === s.id ? "text-chart-2" : "text-foreground"}`}>{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.nameZh}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1 leading-tight">{s.levels.length} levels · {Math.max(...Object.values(s.maxLayersPerLevel))} layers max</p>
          </button>
        ))}
      </div>

      <div className="p-3 rounded-lg bg-chart-2/5 border border-chart-2/20 text-xs text-muted-foreground">
        <span className="font-semibold text-chart-2">{system.nameZh}</span> — {system.descriptionZh}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <ParamsCard title="Parameters" titleZh="参数设置">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Token Name <span className="opacity-60 zh-only">代币名称</span></Label>
            <Input value={tokenName} onChange={e => setTokenName(e.target.value)} className="bg-background/50 border-border font-mono h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Your Broker Level <span className="opacity-60 zh-only">推荐商等级</span></Label>
            <Select value={validLevel} onValueChange={v => { setBrokerLevel(v); setSubLevel("none"); }}>
              <SelectTrigger className="bg-background/50 border-border h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {system.levels.map(lvl => (
                  <SelectItem key={lvl} value={lvl}>{lvl} (≤{system.maxLayersPerLevel[lvl]} layers)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SliderRow label={`${tokenName}/Layer/Day`} labelZh="每层每日释放量" value={msPerLayer} set={setMsPerLayer} min={10} max={5000} step={50} display={`${fmt(msPerLayer)}`} />
          <Separator />
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Dividend Pool<span className="zh-only ml-1">分红池</span></p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Subordinate Level <span className="opacity-60 zh-only">下级推荐商</span></Label>
            <Select value={subLevel} onValueChange={setSubLevel}>
              <SelectTrigger className="bg-background/50 border-border h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None <span className="zh-only">— 直接下线</span></SelectItem>
                {system.levels.map(lvl => (
                  <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Gross Profit/Day ($)" labelZh="每日毛利润" value={grossProfit} set={setGrossProfit} min={100} max={100000} step={500} display={`$${fmt(grossProfit, 0)}`} />
          <SliderRow label="Trading Fee %" labelZh="手续费率" value={feeRate} set={setFeeRate} min={0} max={50} step={1} display={`${feeRate}%`} />
          <SliderRow label="User Profit Share %" labelZh="用户分润%" value={profitShare} set={setProfitShare} min={50} max={90} step={5} display={`${profitShare}%`} />
        </ParamsCard>

        <div className="space-y-5">
          <KpiGrid items={[
            { label: `${tokenName} Income/Day`, labelZh: "每日层级收益", value: `${fmt(breakdown.totalAccessible)} ${tokenName}`, color: "text-chart-2" },
            { label: "Locked (Upgrade)", labelZh: "需升级解锁", value: `${fmt(breakdown.totalLocked)} ${tokenName}`, color: "text-muted-foreground" },
            { label: "Dividend/Day", labelZh: "每日分红", value: formatCurrency(dividend.earnings), color: "text-primary" },
            { label: "Accessible Layers", labelZh: "可访问层数", value: `${maxLayer} / 20`, color: "text-chart-3" },
          ]} />

          {/* Layer rate info */}
          <Card className="bg-card/60 border-border p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-3">Layer Rate Schedule <span className="opacity-70 zh-only">层级费率表</span></p>
            <div className="flex flex-wrap gap-2">
              {system.layerRates.filter((r, i) => r > 0 || i < maxLayer).map((rate, i) => (
                <div key={i} className={`px-2 py-1 rounded text-[11px] font-mono border ${i < maxLayer ? "bg-chart-2/15 border-chart-2/30 text-chart-2" : "bg-muted/20 border-border text-muted-foreground/50"}`}>
                  L{i + 1}: {rate}%
                </div>
              ))}
            </div>
          </Card>

          {/* Bar chart */}
          <Card className="bg-card/70 border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex flex-wrap items-center justify-between gap-2">
                <span>20-Layer Breakdown <span className="text-xs font-normal text-muted-foreground ml-1 zh-only">层级收益明细</span></span>
                <div className="flex gap-2">
                  <Badge className="text-[11px] bg-chart-2/20 text-chart-2 border-chart-2/30 border">Accessible<span className="zh-only ml-1">已开放</span></Badge>
                  <Badge variant="outline" className="text-[11px] text-muted-foreground/50">Locked<span className="zh-only ml-1">未开放</span></Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[200px] sm:h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="layer" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => fmt(v)} />
                    <Tooltip contentStyle={TS} formatter={(v: number, _, p) => [`${fmt(v)} ${tokenName} (${p.payload.rate}%)`, p.payload.accessible ? "Accessible" : "Locked"]} />
                    <Bar dataKey="earnings" radius={[3, 3, 0, 0]}>
                      {barData.map((e, i) => <Cell key={i} fill={e.accessible ? "hsl(var(--chart-2))" : "hsl(var(--muted-foreground)/0.2)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Dividend details */}
          <Card className="bg-card/70 border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50"><CardTitle className="text-sm font-semibold">Dividend System <span className="text-xs font-normal text-muted-foreground ml-1 zh-only">分红池级差计算</span></CardTitle></CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "User Share", labelZh: "用户分红", val: formatCurrency(dividend.userShare) },
                  { label: "Broker Pool", labelZh: "推荐商分红池", val: formatCurrency(dividend.brokerDividendPool), hi: true },
                  { label: `${validLevel} Rate`, labelZh: "本级分红率", val: `${dividend.brokerRate}%` },
                  { label: "Differential", labelZh: "级差比率", val: `${dividend.differentialRate}%`, hi2: true },
                ].map(({ label, labelZh, val, hi, hi2 }) => (
                  <div key={label} className={`p-3 rounded-lg border ${hi ? "bg-primary/10 border-primary/30" : hi2 ? "bg-chart-2/10 border-chart-2/30" : "bg-background/30 border-border"}`}>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label} <span className="opacity-60">{labelZh}</span></p>
                    <p className={`text-sm font-bold font-mono mt-1 ${hi ? "text-primary" : hi2 ? "text-chart-2" : ""}`}>{val}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground p-3 bg-background/30 rounded-lg border border-border/50 leading-relaxed">
                {validLevel} has <span className="font-mono text-foreground">{maxLayer}</span> accessible layers.
                Dividend rate: <span className="font-mono text-primary">{dividend.brokerRate}%</span>
                {subLevel !== "none" ? ` — Sub ${subLevel}: ${dividend.subRate}%, differential: ${dividend.differentialRate}%` : " (no sub-broker)"}. Daily dividend: <span className="font-mono text-chart-2 font-semibold">{formatCurrency(dividend.earnings)}</span>
                {showZh && <span className="block opacity-70 mt-1">{validLevel} 可访问 {maxLayer} 层，分红率 {dividend.brokerRate}%，级差 {dividend.differentialRate}%，每日分红 {formatCurrency(dividend.earnings)}。</span>}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
