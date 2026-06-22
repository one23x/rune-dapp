/**
 * AgentChat — a floating button (FAB) that raises a chat panel to talk with the
 * strategy agent. The trading logs (<DecisionLog>) stay exactly as they are;
 * this only ADDS a floating widget on top.
 *
 * The panel is non-modal (fixed, not a Dialog) so the logs stay visible behind
 * it. Scoped by userId so the backend can build a per-user memory / preference
 * bank from the conversation. The `hl/agent/chat` route is pending — until it
 * ships, sends degrade gracefully to an offline bubble (no crash).
 *
 * Responsive: phone = near-full-width bottom sheet clearing the bottom-nav;
 * >=sm = a 370px bottom-right card.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Send, Sparkles, Loader2, Wallet, CheckCircle2, AlertCircle } from "lucide-react";
import { prepareTransaction, sendTransaction } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { agent, type AgentChatAction } from "@app/lib/engine";
import { thirdwebClient } from "@/lib/thirdweb/client";
import { cn } from "@app/lib/utils";

interface Msg { role: "user" | "agent"; text: string; ts: number; actions?: AgentChatAction[] }

/** One Nebula-prepared transaction → a "sign & send" button using the user's connected wallet (non-custodial). */
function TxAction({ action }: { action: AgentChatAction }) {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [hash, setHash] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const d = action.data;
  if (action.type !== "sign_transaction" || !d?.to || !d?.chainId) return null;

  async function run() {
    if (!account) { setErr(t("agentChat.connectFirst", "请先连接钱包")); setState("error"); return; }
    setState("sending"); setErr("");
    try {
      const chain = defineChain(d!.chainId);
      // 多链(BSC 56 / Arbitrum 42161):先把钱包切到交易目标链,再签发。
      if (wallet && wallet.getChain()?.id !== d!.chainId) {
        await wallet.switchChain(chain);
      }
      const tx = prepareTransaction({
        client: thirdwebClient,
        chain,
        to: d!.to,
        ...(d!.value ? { value: BigInt(d!.value) } : {}),
        ...(d!.data && d!.data !== "0x" ? { data: d!.data as `0x${string}` } : {}),
      });
      const res = await sendTransaction({ transaction: tx, account });
      setHash(res.transactionHash); setState("sent");
    } catch (e) {
      setErr(String((e as Error)?.message ?? e).slice(0, 120)); setState("error");
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.06] p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-amber-200/90 font-semibold">
        <Wallet className="h-3.5 w-3.5" />
        {t("agentChat.txTitle", "待签交易")} · chain {d.chainId}
      </div>
      <div className="mt-1 text-[10.5px] text-foreground/55 break-all font-mono">→ {d.to}{d.value ? ` · ${d.value} wei` : ""}</div>
      {state === "sent" ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> {t("agentChat.txSent", "已发送")} · <span className="font-mono break-all">{hash.slice(0, 14)}…</span>
        </div>
      ) : state === "error" ? (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-[11px] text-red-400"><AlertCircle className="h-3.5 w-3.5" /> {err}</div>
          <button onClick={() => void run()} className="mt-1.5 text-[11px] text-amber-300 underline">{t("common.retry", "重试")}</button>
        </div>
      ) : (
        <button
          onClick={() => void run()}
          disabled={state === "sending"}
          className="mt-2 w-full h-9 rounded-lg bg-amber-500/90 text-black text-[12px] font-bold active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("agentChat.signSend", "用钱包签名并发送")}
        </button>
      )}
    </div>
  );
}

export function AgentChat({ userId, strategyId, inline }: { userId?: string; strategyId?: string; inline?: boolean }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const account = useActiveAccount();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed greeting on first open.
  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        role: "agent", ts: Date.now(),
        text: t("agentChat.greeting",
          "嗨,我是小符 AI。可以聊策略、看行情、帮你分析持仓与平仓时机;也能帮你发起转账、查询链上行情、创建合约等链上操作。说说你想做什么?(风控与止损始终是底线,不会被偏好覆盖。)"),
      }]);
    }
  }, [open, msgs.length, t]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text, ts: Date.now() }]);
    setSending(true);
    try {
      const res = await agent.chat({
        userId,
        message: text,
        history: msgs.slice(-10).map((m) => ({ role: m.role, text: m.text })),
        lang: i18n.language,            // 让 agent 按当前语言切换按钮的语言回复
        strategyId,                     // 带上当前策略,agent 围绕该策略对话
        walletAddress: account?.address, // 链上脑(Nebula)上下文 + 非托管签发
        sessionId,                      // Nebula 多轮链上对话上下文
      });
      if (res?.sessionId) setSessionId(res.sessionId);
      setMsgs((m) => [...m, { role: "agent", text: res?.reply || "…", ts: Date.now(), actions: res?.actions }]);
    } catch {
      // Route not live yet → graceful offline bubble (the idea is still captured client-side).
      setMsgs((m) => [...m, {
        role: "agent", ts: Date.now(),
        text: t("agentChat.offline", "对话后端还在接入中,你的想法我先记下了,接通后会纳入你的专属偏好。"),
      }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* 触发按钮:inline=固定内联按钮(放 logs 上方,随页面滚动);否则=右下角浮窗 FAB。 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("agentChat.open", "与小符AI聊聊")}
        style={{ "--neon-rgb": "245,158,11" } as React.CSSProperties}
        className={cn(
          "flex items-center gap-2 text-black font-extrabold tracking-wide whitespace-nowrap",
          "bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600",
          "ring-1 ring-amber-200/70 transition active:scale-95 hover:brightness-105",
          inline
            ? // 固定内联按钮(非浮窗):整宽、随内容流,放在 logs 面板上方
              "relative w-full justify-center h-11 rounded-xl px-4 text-[13px] shadow-[0_4px_14px_-4px_rgba(245,158,11,0.5),inset_0_1px_0_rgba(255,255,255,0.65)]"
            : // 浮窗 FAB(右下角,3D pill + 光圈)
              cn(
                "group fixed z-50 right-4 bottom-20 sm:right-6 sm:bottom-6 h-14 rounded-full pl-4 pr-5 text-[14px]",
                "shadow-[0_10px_28px_-6px_rgba(245,158,11,0.65),inset_0_1.5px_0_rgba(255,255,255,0.75),inset_0_-3px_6px_rgba(146,64,14,0.55)]",
                "animate-[pulseGlow_2.2s_ease-in-out_infinite]",
              ),
        )}
        data-testid={inline ? "btn-agent-chat-inline" : "fab-agent-chat"}
      >
        {/* 动感光圈仅浮窗模式 */}
        {!inline && <span className="pointer-events-none absolute -inset-2 rounded-full bg-amber-400/25 blur-md" />}
        {!inline && <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-amber-300/70 animate-ping" />}
        {open
          ? <X className="relative h-5 w-5" />
          : <Sparkles className="relative h-5 w-5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" />}
        <span className="relative">
          {open ? t("common.close", "关闭") : t("agentChat.open", "与小符AI聊聊")}
        </span>
      </button>

      {/* Panel — portaled to <body> so position:fixed centers on the VIEWPORT
          (inside the strategy-flow/engine-console transformed ancestors, fixed would
          anchor to that box → appeared "below the button"). Portal escapes that. */}
      {open && createPortal(
        <div
          className={cn(
            "fixed z-[60] flex flex-col overflow-hidden border border-white/10 bg-black/85 backdrop-blur-xl shadow-2xl",
            // mobile: 垂直居中(原 bottom 锚定导致偏下)—— 屏幕正中弹出
            "left-2 right-2 top-1/2 -translate-y-1/2 max-h-[72vh] h-[72vh] rounded-2xl",
            // >=sm: bottom-right card(重置居中变换)
            "sm:left-auto sm:right-6 sm:top-auto sm:translate-y-0 sm:bottom-24 sm:w-[370px] sm:h-[520px] sm:max-h-[520px]",
          )}
          data-testid="panel-agent-chat"
        >
          <header className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 bg-black/40">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-500/15">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-bold leading-tight">{t("agentChat.title", "与小符AI聊聊")}</div>
              <div className="text-[10px] text-foreground/45 leading-tight">{t("agentChat.subtitle", "策略 · 行情 · 链上操作")}</div>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label={t("common.close", "关闭")}>
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-3 py-3 space-y-2.5">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed break-words whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-amber-500/15 text-amber-50 rounded-br-sm"
                    : "bg-white/[0.06] text-foreground/85 rounded-bl-sm",
                )}>
                  {m.text}
                </div>
                {m.actions && m.actions.length > 0 && (
                  <div className="w-[88%] max-w-[88%]">
                    {m.actions.map((a, j) => <TxAction key={j} action={a} />)}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white/[0.06] px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/50" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-white/10 p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder={t("agentChat.placeholder", "聊策略 / 行情 / 持仓平仓,或链上操作…")}
              className="flex-1 min-w-0 h-11 rounded-xl bg-white/[0.04] border border-white/10 px-3 text-[14px] outline-none focus:border-amber-400/40"
              data-testid="input-agent-chat"
            />
            <button
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              className="shrink-0 grid h-11 w-11 place-items-center rounded-xl bg-amber-500/90 text-black active:scale-95 transition disabled:opacity-40"
              aria-label={t("agentChat.send", "发送")}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default AgentChat;
