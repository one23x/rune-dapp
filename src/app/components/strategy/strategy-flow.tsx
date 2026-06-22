/**
 * StrategyFlow — /strategy/hl 的「分步门槛」向导(gated funnel)。
 *
 * 一步一步推进:
 *   1. 资格验证 + 激活交易账户  (节点 / 授权码 → 开户)        ← GateStep
 *   2. 钱包 · 充值 / 提现        (充值可选,不阻断)            ← WalletStep
 *   3. 选择策略                  (3 个板块策略,选中写 ?strategy) ← StrategySelect
 *   4. 一键跟单                  (自动优选 / 手动跟顶级交易员)    ← EngineFollow
 *   5. 数据台                    (余额+持仓 / 信号·持仓·风控 / 智能对话) ← EngineConsole
 *
 * 门槛由**真实账户状态**推导:qualified(节点/授权码)+ hasAccount(userId)。
 * 已放开「充值」硬门槛:有账户 + 选好策略即可进跟单 / 数据台(不充值不会真实下单)。
 * 顶部 FlowStepper 展示 5 步进度;可点已解锁步骤前后跳。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearch } from "wouter";
import { useActiveAccount } from "thirdweb/react";
import { ShieldCheck, Wallet, Layers, Users, Gauge, ChevronRight } from "lucide-react";
import type { HlNetwork } from "@app/lib/engine";
import { useEngineUser, useHlAccount, useSetStrategyMarket } from "@app/lib/engine-hooks";
import { useNodeGate } from "@app/components/copy-trading/shared";
import { FlowStepper, type FlowStep } from "./flow-stepper";
import { GateStep } from "./flow-gate-step";
import { WalletStep } from "./flow-wallet-step";
import { StrategySelect } from "./strategy-select";
import { LeaderWatchlist } from "./leader-watchlist";
import { EngineStats } from "./engine-live";
import { EngineFollow } from "./engine-follow";
import { EngineConsole } from "./engine-console";

export function StrategyFlow() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const network: HlNetwork = "mainnet";

  const search = useSearch();
  const strategyId = useMemo(() => new URLSearchParams(search).get("strategy"), [search]);

  // ── 真实状态来源 ──────────────────────────────────────────────────────────
  const nodeGate = useNodeGate(wallet);
  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  const hlUser = userQ.data as { engineEoaAddress?: string; hlMode?: string; hlMasterAddress?: string } | undefined;
  const agentMode = hlUser?.hlMode === "agent";
  const engineEoa = hlUser?.engineEoaAddress ?? "";
  const hlAddress = (agentMode ? (hlUser?.hlMasterAddress ?? wallet) : engineEoa) ?? "";
  const acctQ = useHlAccount(hlAddress || undefined, network);
  const acct = acctQ.data;
  const loading = !!wallet && acctQ.isLoading;

  // ── 门槛推导 ──────────────────────────────────────────────────────────────
  const qualified = nodeGate.canOpen;
  const hasAccount = !!userId;
  const funded = !!acct?.funded || (acct?.accountValue ?? 0) > 0;
  const hasStrategy = !!strategyId;

  const step0Done = qualified && hasAccount;   // 资格 + 激活账户 = 唯一硬门槛

  // 解锁范围:有账户 → 可达「选策略」(2);已选策略 → 可达「跟单」(3)/「数据台」(4)。
  const maxReached = !step0Done ? 0 : !hasStrategy ? 2 : 4;
  // 默认聚焦:无账户→资格;有账户未选策略→钱包(鼓励充值,可跳过);已选策略→一键跟单。
  const defaultStep = !step0Done ? 0 : !hasStrategy ? 1 : 3;

  // 当前步骤:默认跟随 defaultStep;用户可点 stepper 在已解锁范围内自由前后(manualStep)。
  const [manualStep, setManualStep] = useState<number | null>(null);
  const current = Math.min(manualStep ?? defaultStep, maxReached);
  // 仅当手动步越界(超过可达范围)时回收;允许停留在较前的已解锁步。
  useEffect(() => {
    if (manualStep != null && manualStep > maxReached) setManualStep(null);
  }, [maxReached, manualStep]);

  // 选好策略(strategyId 新出现/变化)→ 自动从「选策略」(2)推进到「一键跟单」(3)。
  // 用 ref 只在策略真正变化时推进一次,避免把手动跳回「选策略」重选的用户又弹走。
  // 选定/切换策略市场 = 把该用户全部 HL 订阅约束到该板块币种宇宙(单选,真约束交易)。
  const setMarket = useSetStrategyMarket(userId);
  const prevStrategy = useRef<string | null>(null);
  const appliedMarketRef = useRef<string | null>(null);
  useEffect(() => {
    if (!strategyId) return;
    // 选好策略(真正变化时)→ 推进到「一键跟单」(3)。
    if (strategyId !== prevStrategy.current) {
      setManualStep((m) => (m == null || m < 3 ? 3 : m));
      prevStrategy.current = strategyId;
    }
    // 应用板块约束:每个 (user, strategy) 组合只应用一次(兼容 strategyId 先于 userId 就位的情况)。
    if (userId) {
      const key = `${userId}|${strategyId}`;
      if (appliedMarketRef.current !== key) {
        appliedMarketRef.current = key;
        setMarket.mutate(strategyId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyId, userId]);

  const steps: FlowStep[] = [
    { key: "qualify", label: t("flow.step.qualify", "资格"), icon: ShieldCheck },
    { key: "wallet", label: t("flow.step.wallet", "钱包"), icon: Wallet },
    { key: "strategy", label: t("flow.step.strategy", "策略"), icon: Layers },
    { key: "follow", label: t("flow.step.follow", "跟单"), icon: Users },
    { key: "console", label: t("flow.step.console", "数据台"), icon: Gauge },
  ];

  // 「继续」按钮:资格步(激活后)→ 钱包;钱包步 → 选策略;跟单步 → 数据台。
  // 选策略(2)靠选中策略推进;数据台(4)是终点,无继续。
  const showContinue = (current === 0 && step0Done) || current === 1 || current === 3;
  const continueLabel =
    current === 0 ? t("flow.continueWallet", "下一步 · 钱包充值")
      : current === 1 ? t("flow.continueStrategy", "下一步 · 选择策略")
        : t("flow.continueConsole", "进入数据台");

  // 跟单 / 数据台步顶部的策略名小标。
  const stratHeader = (
    <div className="flex items-center gap-2 px-1">
      <span className="font-display text-[14px] font-bold text-foreground/90 truncate">
        {t(`strategyName.${strategyId}`, strategyId ?? "")}
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        {t("engine.running", "交易引擎 · 链上实时")}
      </span>
    </div>
  );

  return (
    <div className="space-y-4 pb-8" style={{ animation: "fadeSlideIn 0.35s ease-out both" }}>
      <FlowStepper steps={steps} current={current} maxReached={maxReached} onJump={setManualStep} />

      <div className="min-w-0" style={{ animation: "fadeSlideIn 0.25s ease-out" }}>
        {current === 0 && (
          <GateStep
            wallet={wallet}
            network={network}
            nodeGate={nodeGate}
            userId={userId}
            agentMode={agentMode}
            onActivated={() => userQ.refetch()}
          />
        )}

        {current === 1 && userId && (
          <WalletStep
            userId={userId}
            network={network}
            agentMode={agentMode}
            depositAddress={engineEoa}
            hlAddress={hlAddress}
            acct={acct}
            wallet={wallet}
            funded={funded}
          />
        )}

        {current === 2 && (
          <div className="space-y-3">
            <div className="px-1">
              <h2 className="font-display text-lg font-bold text-foreground">
                {t("flow.strategy.title", "选择策略")}
              </h2>
              <p className="mt-1 text-[12.5px] text-foreground/55 leading-relaxed">
                {t("flow.strategy.desc", "选定板块策略后,引擎会按该策略匹配顶级交易员的实时信号并展示决策对话。")}
              </p>
            </div>
            {/* 顶级交易员正在交易的币种(live ticker)—— 给选策略提供实时盘面语境。 */}
            <LeaderWatchlist network={network} />
            <StrategySelect />
          </div>
        )}

        {current === 3 && (
          <div className="space-y-4">
            {stratHeader}
            {/* 链上真实账户总览 */}
            <EngineStats acct={acct} loading={loading} updating={!!wallet && acctQ.isFetching && !loading} />
            {/* 一键跟单(自动优选 / 手动跟顶级交易员)。跟单成功 → 自动进数据台(4)。 */}
            <EngineFollow userId={userId} network={network} onFollowed={() => setManualStep(4)} />
          </div>
        )}

        {current === 4 && strategyId && (
          <div className="space-y-3">
            {stratHeader}
            <EngineConsole userId={userId} strategyId={strategyId} network={network} acct={acct} loading={loading} onSwitchStrategy={() => setManualStep(2)} />
          </div>
        )}
      </div>

      {/* 「继续」按钮 —— 资格/钱包/跟单步显示;选策略与数据台不显示。 */}
      {showContinue && (
        <button
          type="button"
          onClick={() => setManualStep(current + 1)}
          className="gold-button w-full flex items-center justify-center gap-1.5 rounded-xl py-3.5 min-h-[48px] text-[13px] font-extrabold active:scale-[0.99]"
          data-testid="button-flow-continue"
        >
          <span className="truncate">{continueLabel}</span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      )}
    </div>
  );
}

export default StrategyFlow;
