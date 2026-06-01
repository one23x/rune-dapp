/**
 * F17 — AI 跟单决策卡。把"跟单 = 选交易员 + ratio"升级成可见的智能管线:
 *   leader 动作 → AI 判断(跟/不跟 + 置信度 + 理由)→ 新闻/评分上下文 → 调参(倍数/杠杆)。
 * 数据来自 GET /v1/users/:id/hl/copy-decisions(ai_inferences)。开关关时这里通常为空(纯镜像不产 AI 决策)。
 */
import { useTranslation } from "react-i18next";
import { Sparkles, Check, X, Newspaper, Gauge, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@app/lib/utils";
import { shortAddr } from "@app/components/hl/shared";
import { useHlCopyDecisions } from "@app/lib/engine-hooks";
import type { HlCopyDecision } from "@app/lib/engine";

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

export function AiDecisionCards({ userId }: { userId?: string }) {
  const { t } = useTranslation();
  const q = useHlCopyDecisions(userId);
  const decisions = q.data?.decisions ?? [];
  if (!userId || decisions.length === 0) return null;

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-violet-300" />
        <span className="text-[11px] uppercase tracking-wider text-foreground/50 font-semibold">
          {t("hl.aiDecisions", "AI 跟单决策")}
        </span>
        <Badge className="text-[9px] px-1.5 py-0 border-0 bg-violet-500/15 text-violet-300 no-default-hover-elevate no-default-active-elevate ml-auto">
          {decisions.length}
        </Badge>
      </div>
      <div className="space-y-2 max-h-[360px] overflow-auto">
        {decisions.slice(0, 30).map((d) => <DecisionRow key={d.id} d={d} />)}
      </div>
    </div>
  );
}

function DecisionRow({ d }: { d: HlCopyDecision }) {
  const { t } = useTranslation();
  const acted = d.act === true;
  const news = d.sentiment?.[0];
  const newsMood = news?.mood ?? news?.classification;
  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/20 p-2.5 space-y-1.5 text-[12px]">
      {/* leader 动作 + AI 裁决 */}
      <div className="flex items-center gap-2">
        <span className="font-mono font-semibold text-foreground/90">{d.symbol ?? "—"}</span>
        <span className={cn("text-[11px]", d.side === "LONG" ? "text-emerald-300" : "text-rose-300")}>{d.side}</span>
        <span className="text-foreground/40 text-[10px]">· {shortAddr(d.leader ?? "")}</span>
        <Badge
          className={cn(
            "ml-auto text-[9px] px-1.5 py-0 border-0 no-default-hover-elevate no-default-active-elevate inline-flex items-center gap-0.5",
            acted ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-300",
          )}
        >
          {acted ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
          {acted ? t("hl.aiActed", "跟单") : t("hl.aiSkipped", "跳过")}
          {d.confidence != null && <span className="opacity-70">· {Math.round(d.confidence * 100)}%</span>}
        </Badge>
      </div>

      {/* 调参 + 上下文 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-foreground/55">
        {acted && d.notionalMult != null && (
          <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" />{t("hl.aiSize", "仓位")} ×{d.notionalMult.toFixed(2)}</span>
        )}
        {acted && d.leverage != null && (
          <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" />{d.leverage}x</span>
        )}
        {d.leaderScore != null && <span>{t("hl.aiScore", "评分")} {d.leaderScore}</span>}
        {newsMood && (
          <span className={cn("inline-flex items-center gap-1", news!.value > 0 ? "text-emerald-300/70" : news!.value < 0 ? "text-rose-300/70" : "")}>
            <Newspaper className="h-3 w-3" />{newsMood}
          </span>
        )}
        <span className="ml-auto text-foreground/35">{ago(d.at)}</span>
      </div>

      {/* 理由 */}
      {d.rationale && <p className="text-[11px] text-foreground/65 leading-snug">{d.rationale}</p>}
    </div>
  );
}
