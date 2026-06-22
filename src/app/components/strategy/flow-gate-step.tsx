/**
 * /strategy/hl gated-wizard — Step 1: 资格验证 + 激活交易账户.
 *
 * Self-contained step rendered by the wizard parent. It renders EXACTLY ONE of:
 *   1. no wallet            → connect-first prompt (connecting handled in header)
 *   2. nodeGate.loading     → skeleton card
 *   3. NOT eligible         → 验证资格 heading + <NodeGateCard/> (买节点 / 授权码)
 *   4. eligible, no account → 激活交易账户 card (custodial / agent onboarding)
 *   5. eligible + account   → confirmed success card
 *
 * The activation UI mirrors HlAccountStrip (hl-copy-section.tsx) and reuses the
 * SAME onboarding hooks — no rebuilt logic:
 *   - custodial (agentMode=false) → useOnboardFlow      (@app/components/copy-trading/shared)
 *   - agent     (agentMode=true)  → useAgentOnboardFlow (@app/components/strategy/hl-copy-section)
 * Both invalidate the engine-user query on success; the parent passes
 * `onActivated` to refetch the user and auto-advance the wizard.
 */

import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import { Wallet, KeyRound, Zap, CheckCircle2, Circle, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@app/lib/utils";
import type { HlNetwork } from "@app/lib/engine";
import {
  useOnboardFlow,
  NodeGateCard,
  type NodeGateResult,
} from "@app/components/copy-trading/shared";
import { useAgentOnboardFlow } from "@app/components/strategy/hl-copy-section";

export function GateStep({
  wallet,
  network,
  nodeGate,
  userId,
  agentMode,
  onActivated,
}: {
  wallet?: string;
  network: HlNetwork;
  nodeGate: NodeGateResult; // already-fetched node gate result, passed by parent
  userId?: string; // engine trading-account id; undefined = no account yet
  agentMode: boolean;
  onActivated: () => void; // call after a successful onboard so parent refetches user
}) {
  const { t } = useTranslation();

  // ── 1) No wallet → connect-first prompt ────────────────────────────────────
  if (!wallet) {
    return (
      <div className="premium-card rounded-2xl p-7 text-center space-y-2.5">
        <div
          className="mx-auto flex items-center justify-center rounded-xl h-12 w-12"
          style={{
            background: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(180,90,10,0.12))",
            border: "1px solid rgba(251,191,36,0.4)",
            boxShadow: "0 0 18px rgba(251,191,36,0.18)",
          }}
        >
          <Wallet className="h-6 w-6 text-amber-300" />
        </div>
        <h2 className="font-display text-base font-bold text-foreground">
          {t("flow.gate.connectTitle", "请先连接钱包")}
        </h2>
        <p className="text-[12px] text-foreground/55 leading-relaxed max-w-xs mx-auto">
          {t("flow.gate.connectDesc", "连接钱包后即可验证资格并激活交易账户。")}
        </p>
      </div>
    );
  }

  // ── 2) Node gate still resolving → skeleton ────────────────────────────────
  if (nodeGate.loading) {
    return <div className="premium-card rounded-2xl h-44" data-testid="flow-gate-loading" />;
  }

  // ── 3) NOT eligible (no node + no redeemed code) → verify + NodeGateCard ────
  if (!nodeGate.canOpen) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            {t("flow.gate.verifyTitle", "验证资格")}
          </h2>
          <p className="mt-1 text-[12.5px] text-foreground/55 leading-relaxed">
            {t("flow.gate.verifyDesc", "跟单需要节点权限。购买节点或输入授权码即可解锁开户与跟单。")}
          </p>
        </div>
        {/* 复用既有兑换逻辑 —— 切勿重建。 */}
        <NodeGateCard wallet={wallet} grantedLevel={nodeGate.level} />
      </div>
    );
  }

  // ── 4) Eligible but no account → 激活交易账户 ───────────────────────────────
  if (!userId) {
    return <ActivateCard wallet={wallet} network={network} agentMode={agentMode} onActivated={onActivated} />;
  }

  // ── 5) Eligible AND has account → confirmed success ────────────────────────
  return (
    <div className="premium-card rounded-2xl p-5" data-testid="flow-gate-activated">
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[14px] font-bold text-foreground/90">
            {t("flow.gate.activatedTitle", "交易账户已激活")}
          </h2>
          <p className="mt-0.5 text-[12px] text-foreground/55 leading-snug">
            {agentMode
              ? t("flow.gate.activatedDescAgent", "非托管账户已开通,资金留在你自己的钱包,引擎仅持有不能提现的下单密钥。")
              : t("flow.gate.activatedDesc", "你的交易账户已就绪,可以继续配置跟单了。")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 激活交易账户 card — replicates HlAccountStrip's !userId branch ────────────
// agentMode decides which onboarding hook drives the activation, matching
// HlAccountStrip (custodial = useOnboardFlow, agent = useAgentOnboardFlow).
function ActivateCard({
  wallet,
  network,
  agentMode,
  onActivated,
}: {
  wallet: string;
  network: HlNetwork;
  agentMode: boolean;
  onActivated: () => void;
}) {
  const { t } = useTranslation();

  // Same hooks HlAccountStrip uses. Both are always called (hook rules); only
  // the agentMode-selected one is triggered/rendered.
  const custodial = useOnboardFlow(wallet);
  const agent = useAgentOnboardFlow(network);

  const isAgent = agentMode;
  const steps = isAgent ? agent.steps : custodial.steps;
  const busy = isAgent ? agent.isPending : custodial.isPending;
  const run = isAgent ? agent.run : custodial.run;
  const error = isAgent ? agent.error : null;

  // 步骤标签 —— 与 HlAccountStrip 一致。
  const stepLabels = [
    t("hl.openStep1", "创建引擎签名账户"),
    t("hl.openStep2", "确认链上授权"),
    t("hl.openStep3", "启用交易"),
  ];
  const agentStepLabels = [
    t("hl.agentStep1", "创建 agent 下单密钥"),
    t("hl.agentStep2", "钱包签名:授权下单(不能提现)"),
    t("hl.agentStep3", "钱包签名:授权手续费(可选)"),
  ];
  const labels = isAgent ? agentStepLabels : stepLabels;

  // 全部步骤完成(custodial 三步 done / agent 末步 done|skipped)→ 通知父组件刷新 user。
  // 两个 hook 内部都已在 onSuccess invalidate engine-user query;这里只触发父级 refetch + 自动前进。
  const allDone =
    !busy &&
    steps[0] === "done" &&
    steps[1] === "done" &&
    (steps[2] === "done" || steps[2] === "skipped");
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (allDone && !notifiedRef.current) {
      notifiedRef.current = true;
      onActivated();
    }
  }, [allDone, onActivated]);

  return (
    <div className="premium-card rounded-2xl p-5 space-y-4" data-testid="flow-gate-activate">
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-xl h-11 w-11"
          style={{
            background: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(180,90,10,0.12))",
            border: "1px solid rgba(251,191,36,0.4)",
            boxShadow: "0 0 18px rgba(251,191,36,0.18)",
          }}
        >
          {isAgent ? <KeyRound className="h-5 w-5 text-amber-300" /> : <ShieldCheck className="h-5 w-5 text-amber-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-foreground">
            {t("flow.gate.activateTitle", "激活交易账户")}
          </h2>
          <p className="mt-0.5 text-[12px] text-foreground/55 leading-snug">
            {isAgent
              ? t("hl.agentOpenCtaDesc", "授权引擎用一把只能下单不能提现的密钥替你跟单;资金始终留在你自己的钱包。")
              : t("hl.openCtaDesc", "一次性开通交易账户即可一键跟单,约需 10 秒。")}
          </p>
        </div>
      </div>

      {/* Per-step progress — shown while pending. */}
      {busy && (
        <div className="space-y-1.5 rounded-lg bg-black/30 border border-white/[0.06] px-3 py-2.5">
          {labels.map((label, i) => {
            const s = steps[i];
            return (
              <div key={i} className="flex items-center gap-2">
                {s === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : s === "skipped" ? (
                  <Circle className="h-3.5 w-3.5 text-foreground/35 shrink-0" />
                ) : s === "error" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                ) : s === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 text-amber-300 animate-spin shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-foreground/25 shrink-0" />
                )}
                <span
                  className={cn(
                    "text-[11px]",
                    s === "idle" ? "text-foreground/40" : s === "skipped" ? "text-foreground/45" : "text-foreground/80",
                  )}
                >
                  {label}
                  {s === "skipped" ? ` · ${t("hl.agentStepSkipped", "已跳过")}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* agent 流程报错 → 行内提示(不阻断重试)。 */}
      {isAgent && error && !busy && <p className="text-[11px] text-red-400 leading-snug">{error}</p>}

      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="gold-button w-full flex items-center justify-center gap-1.5 rounded-xl py-3 min-h-[44px] text-[13px] font-extrabold disabled:opacity-50"
        data-testid="button-flow-gate-activate"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isAgent ? (
          <KeyRound className="h-3.5 w-3.5" />
        ) : (
          <Zap className="h-3.5 w-3.5" />
        )}
        {busy
          ? t("hl.opening", "开通中…")
          : isAgent
            ? t("hl.agentOpenCta", "开通自托管账户")
            : t("hl.openCta", "开通交易账户")}
      </button>
    </div>
  );
}
