/**
 * DecisionLog — 对话流式「决策日志」(交易引擎页)。
 *
 * 像 agent 在一条条说话:旧的在上、新的在下、自动滚到底(聊天式)。每条 = 一个
 * 时间戳 + 符号 + 一句话。四类:
 *   watch  灰 · 被动观察(行情安静 / setup 形成中)
 *   review 蓝 · agent 对这笔交易的判断(带 conviction)
 *   trade  绿 · 执行结果(成交/调整出场)—— 以「↳ ✓ …」挂在判断下面,
 *               所以「下单决策」读起来 = 判断 + 执行结果 一体
 *   passed 琥珀 · 看了没下(skip,给用户看为什么)
 *
 * 数据来自 decision-log-hooks(复用现有 ai_console_logs 流)。响应式:窄屏 meta
 * 换行不挤,message 折行不截断;高度 viewport 比例 + 大屏封顶。
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Radio, Check, Ban } from "lucide-react";
import {
  useDecisionLog,
  useActionsFeed,
  clockLabel,
  type DecisionKind,
  type DecisionEntry,
} from "@app/lib/decision-log-hooks";

type View = "stream" | "actions";

const DOT: Record<DecisionKind, string> = {
  watch: "bg-muted-foreground/35",
  review: "bg-sky-400",
  trade: "bg-emerald-400",
  passed: "bg-amber-400/70",
};
const MSG: Record<DecisionKind, string> = {
  watch: "text-muted-foreground/55",
  review: "text-foreground/85",
  trade: "text-emerald-300",
  passed: "text-amber-300/85",
};

/** 一条对话流消息。trade 以「↳ ✓」挂在上一条判断下,读作"判断→执行结果"。 */
function Bubble({ e, last }: { e: DecisionEntry; last: boolean }) {
  const isTrade = e.kind === "trade";
  const isPassed = e.kind === "passed";
  return (
    <li className="relative pl-5">
      {/* 时间线:圆点 + 连接竖线 */}
      <span className={`absolute left-1 top-1.5 h-2 w-2 rounded-full ${DOT[e.kind]}`} />
      {!last && <span className="absolute left-[7px] top-3.5 bottom-0 w-px bg-white/[0.06]" />}

      <div className={isTrade ? "pb-2.5" : "pb-3"}>
        {/* meta 行:时间 + 符号 + conviction(窄屏 wrap) */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-mono text-[10px] text-muted-foreground/45 tabular-nums">{clockLabel(e.ts)}</span>
          {e.symbol && <span className="font-mono text-[10px] font-semibold text-foreground/75">{e.symbol}</span>}
          {e.conviction != null && (
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-foreground/65">conv {e.conviction.toFixed(2)}</span>
          )}
        </div>
        {/* 正文:trade=↳✓执行结果;passed=⊘;其余直叙(窄屏长消息折行不截断) */}
        <p className={`mt-0.5 text-[12px] leading-relaxed break-words ${MSG[e.kind]}`}>
          {isTrade && <Check className="inline h-3 w-3 mr-1 -mt-0.5 text-emerald-400" />}
          {isPassed && <Ban className="inline h-3 w-3 mr-1 -mt-0.5 text-amber-400/70" />}
          {isTrade && <span className="text-emerald-400/60">↳ </span>}
          {e.message}
        </p>
      </div>
    </li>
  );
}

export function DecisionLog({ model, symbols, entries: entriesProp, className = "" }: {
  model?: string; symbols?: string[]; entries?: DecisionEntry[]; className?: string;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("stream");
  // entriesProp(如客户端 HL feed)给定时用它,完全不依赖 ai_console_logs(Binance bot)。
  const live = useDecisionLog(model);
  const liveActions = useActionsFeed(model);
  const allEntries = entriesProp ?? live.entries;
  const loading = entriesProp ? false : live.loading;
  const actionEntries = entriesProp
    ? entriesProp.filter((e) => e.kind === "trade" || e.kind === "passed")
    : liveActions.actions.filter((a) => a.kind === "trade" || a.kind === "passed");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 按策略 universe 过滤:只显示该策略盯盘币种的决策(null-symbol 的全局心跳保留为氛围)。
  const universe = symbols && symbols.length ? new Set(symbols.map((s) => s.toUpperCase())) : null;
  const inUniverse = (sym: string | null) =>
    !universe || sym == null || universe.has(sym.replace(/-PERP$/i, "").toUpperCase());

  // 全部 = 整条对话(含 watch/review);动作 = 只看成交+跳过(trade/passed)。
  const source = view === "stream" ? allEntries : actionEntries;
  // 对话流:旧→新(reverse,因 source 是 newest-first),自动滚到底。
  const rows = source.filter((e) => inUniverse(e.symbol)).slice().reverse();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rows.length, view]);

  const empty = !loading && rows.length === 0;

  return (
    <section className={`flex flex-col rounded-xl border border-white/[0.06] bg-black/40 overflow-hidden ${className}`}>
      <header className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-black/30">
        <Activity className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <h3 className="text-xs font-semibold tracking-wide truncate">{t("decisionLog.title", "Decision log")}</h3>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400/90 shrink-0">
          <Radio className="h-2.5 w-2.5 animate-pulse" /> live
        </span>
        <div className="flex-1 min-w-1" />
        <div className="flex shrink-0 rounded-lg bg-white/5 p-0.5 text-[10px] font-medium">
          {([["stream", t("decisionLog.all", "全部")], ["actions", t("decisionLog.actions", "动作")]] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1.5 transition-colors ${view === v ? "bg-white/10 text-foreground" : "text-muted-foreground/60 hover:text-foreground/80"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide max-h-[55vh] sm:max-h-[460px] min-h-[200px] px-3 py-3">
        {loading && <p className="py-6 text-center text-[11px] text-muted-foreground/40 animate-pulse">loading decision stream…</p>}
        {empty && <p className="py-6 text-center text-[11px] text-muted-foreground/40">Markets quiet · no actionable signal yet</p>}
        <ul>
          {rows.map((e, i) => (
            <Bubble key={e.id} e={e} last={i === rows.length - 1} />
          ))}
        </ul>
      </div>
    </section>
  );
}

export default DecisionLog;
