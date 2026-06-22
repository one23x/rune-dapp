/**
 * ActionsLog — withengine 风格的「动作」信息流(交易引擎页)。
 *
 * 子标签 [全部 | 风险 | 关注 | 成交],每行 = 加粗标题 — 截断细节"…" +
 * 一个 TYPE chip + 相对时间"· 56m ago"。最新在上。
 *
 * 三类(契约口径):
 *   风险 risk   ← 止损 / 持仓币剧烈波动(来自执行器真实决策 entry.category==="risk",
 *                 如 stop-loss 平仓亏损)。点=rose。
 *   关注 watch  ← 准备下单的币,**含被门控挡下的开仓**(如「跳过开仓 · 恐慌挡多」,
 *                 来自 ai_console_logs 真实执行器 skip-open 行);也含客户端规则的 setup
 *                 (突破/回踩等)。点=sky。
 *   成交 trade  ← 真实开 / 平仓 fills(acct.recentFills,链上回填)+ 执行器真实开/平仓行。
 *                 平仓带 realized 盈亏 chip,有 tx hash 时链到 HL explorer。点=emerald。
 *   全部        ← 以上合并,按时间倒序。
 *
 * 数据真:成交来自链上 fills;风险/关注来自真实 ai_console_logs 执行器决策流 + HL 原生
 * 规则 feed。skip-open 行显式渲染为「跳过开仓 · 原因」,绝不再当成模糊 setup。
 *
 * NOTE: `DecisionEntry` / `customerCategory` 的真实导出在 `@app/lib/decision-log-hooks`。
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, ShieldAlert, Eye, TrendingUp } from "lucide-react";
import { cn } from "@app/lib/utils";
import type { HlFillRow, HlNetwork, HlPosition } from "@app/lib/engine";
import { customerCategory, type DecisionEntry } from "@app/lib/decision-log-hooks";

type Cat = "risk" | "watch" | "trade";
type SubTab = "all" | "risk" | "watch" | "trades";

/** 统一行模型:Trades 与 Risk/Notables 归一成同一种渲染结构。 */
interface Row {
  key: string;
  cat: Cat;
  ms: number;
  title: string;
  /** 标题里"—"之后的弱化细节(可空)。 */
  detail?: string;
  /** 第二行(如成交明细)。 */
  sub?: string;
  /** 右侧小 chip:realized 盈亏 / conviction。 */
  chip?: { text: string; tone: "pos" | "neg" | "neutral" };
  href?: string;
  /** 额外标签 chip(如「动荡」)— 排在分类 chip 之后。 */
  tag?: { text: string; cls: string };
  /** 排序权重(同 cat、同时间段时优先级,越大越靠前)。默认 0。 */
  weight?: number;
}

/** |ROE| ≥ 此阈值(%)视为「动荡」(adverse 或剧烈波动)。 */
const VOLATILE_ROE_PCT = 20;

/** 价格格式:≥100 用千分位整数,否则 4 位有效数字。 */
function fmtPx(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n >= 100
    ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : Number(n.toPrecision(4)).toString();
}

function fmtUsd(n: number): string {
  const a = Math.abs(n);
  return a >= 100
    ? a.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : a.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** "HYPE" → "HYPE-PERP";已带 -PERP 则原样。 */
function withPerp(coin: string): string {
  return /-PERP$/i.test(coin) ? coin.toUpperCase() : `${coin.toUpperCase()}-PERP`;
}

/** 相对时间:m/h/d ago,走 Intl.RelativeTimeFormat(随语言)。 */
function relTime(ms: number, lang: string): string {
  const diff = ms - Date.now(); // 过去 → 负
  const sec = Math.round(diff / 1000);
  const abs = Math.abs(sec);
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(lang || "en", { numeric: "auto" });
  } catch {
    rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }
  if (abs < 60) return rtf.format(Math.round(sec / 1), "second");
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  return rtf.format(Math.round(sec / 86400), "day");
}

/** "Open Long" → 取方向词;side fallback。 */
function sideLabel(fill: HlFillRow): string {
  const dir = (fill.dir || "").toLowerCase();
  if (dir.includes("long")) return "long";
  if (dir.includes("short")) return "short";
  return (fill.side || "").toLowerCase() || "long";
}

const CAT_DOT: Record<Cat, string> = {
  risk: "bg-rose-400",
  watch: "bg-sky-400",
  trade: "bg-emerald-400",
};

// chip label is an i18n key resolved at render time (so 风险/关注/成交 localize).
const CAT_CHIP: Record<Cat, { labelKey: string; labelFb: string; cls: string; Icon: typeof TrendingUp }> = {
  risk: { labelKey: "actions.catRisk", labelFb: "风险", cls: "bg-rose-400/10 text-rose-300", Icon: ShieldAlert },
  watch: { labelKey: "actions.catWatch", labelFb: "关注", cls: "bg-sky-400/10 text-sky-300", Icon: Eye },
  trade: { labelKey: "actions.catTrade", labelFb: "成交", cls: "bg-emerald-400/10 text-emerald-300", Icon: TrendingUp },
};

/** F&G 阈值 → 风险分级 + chip tone。极端(≤25 / ≥75)= 高风险红;边缘 amber;中性 muted。 */
function fgLevel(value: number): {
  levelKey: string;
  levelFb: string;
  chipCls: string;
  /** 极端时给一句门控提示 key(挡多/挡空);非极端为 null。 */
  hintKey: string | null;
  hintFb: string;
} {
  if (value <= 25)
    return { levelKey: "actions.fgExtremeFear", levelFb: "极度恐慌", chipCls: "bg-rose-400/15 text-rose-200", hintKey: "actions.fgBlocksLong", hintFb: "挡做多" };
  if (value >= 75)
    return { levelKey: "actions.fgExtremeGreed", levelFb: "极度贪婪", chipCls: "bg-rose-400/15 text-rose-200", hintKey: "actions.fgBlocksShort", hintFb: "挡做空" };
  if (value <= 45)
    return { levelKey: "actions.fgFear", levelFb: "恐慌", chipCls: "bg-amber-400/15 text-amber-200", hintKey: null, hintFb: "" };
  if (value >= 55)
    return { levelKey: "actions.fgGreed", levelFb: "贪婪", chipCls: "bg-amber-400/15 text-amber-200", hintKey: null, hintFb: "" };
  return { levelKey: "actions.fgNeutral", levelFb: "中性", chipCls: "bg-emerald-400/12 text-emerald-200/80", hintKey: null, hintFb: "" };
}

export function ActionsLog({ entries, fills, positions, network, fearGreed }: {
  entries: DecisionEntry[];
  fills: HlFillRow[];
  positions?: HlPosition[];
  network: HlNetwork;
  /** 全局 F&G(门控同源 GLOBAL 值)→ 钉在「风险」tab(及全部)最顶部。 */
  fearGreed?: { value: number; label: string } | null;
}) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<SubTab>("all");

  const explorerBase = `https://app.hyperliquid${network === "testnet" ? "-testnet" : ""}.xyz/explorer/tx/`;

  // Trades ← 真实 fills
  const tradeRows = useMemo<Row[]>(() => {
    return (fills ?? []).map((f, i) => {
      const coin = withPerp(f.coin);
      const px = fmtPx(f.px);
      const href = f.hash ? `${explorerBase}${f.hash}` : undefined;
      if (f.isClose) {
        const pos = f.closedPnl >= 0;
        return {
          key: `fill-${f.hash ?? i}-${f.time}`,
          cat: "trade",
          ms: f.time,
          title: t("actions.closeAt", "平仓 {{coin}} @ ${{px}}", { coin, px }),
          chip: {
            text: `${pos ? "+" : "-"}$${fmtUsd(f.closedPnl)} ${t("actions.realized", "已实现")}`,
            tone: pos ? "pos" : "neg",
          },
          href,
        };
      }
      const side = sideLabel(f);
      return {
        key: `fill-${f.hash ?? i}-${f.time}`,
        cat: "trade",
        ms: f.time,
        title: t("actions.opened", "开{{side}} · {{coin}}", { side, coin }),
        sub: `${t("actions.filled", "成交 {{sz}} {{coin}} @ {{px}}", { sz: f.sz, coin, px })} · fee —`,
        href,
      };
    });
  }, [fills, explorerBase, t]);

  // 持仓货币动荡 ← acct.positions。每个在持仓位一行(cat:risk),按 |浮盈| 的剧烈程度排序,
  // |ROE| ≥ VOLATILE_ROE_PCT 额外打「动荡」标签。最不利(浮亏最大)排最前。
  const positionRiskRows = useMemo<Row[]>(() => {
    const now = Date.now();
    return (positions ?? [])
      .filter((p) => Number.isFinite(p.size) && Math.abs(p.size) > 0)
      .map((p, i) => {
        const coin = withPerp(p.coin);
        const sideKey = p.side === "SHORT" ? "short" : "long";
        const sideLbl = t(`actions.side_${sideKey}`, sideKey === "short" ? "空" : "多");
        // ROE% = uPnL / 占用保证金;无杠杆信息时用 positionValue 兜底,避免除零。
        const lev = p.leverage && p.leverage > 0 ? p.leverage : 1;
        const notional = Math.abs(p.positionValue) || (Math.abs(p.size) * (p.entryPx ?? 0));
        const marginUsed = notional > 0 ? notional / lev : 0;
        const roe = marginUsed > 0 ? (p.upnl / marginUsed) * 100 : 0;
        const pos = p.upnl >= 0;
        const volatile = Math.abs(roe) >= VOLATILE_ROE_PCT;
        const roeStr = `${roe >= 0 ? "+" : ""}${roe.toFixed(1)}%`;
        // 排序权重:浮亏越大权重越高(最不利在最前);其次 |ROE|。
        const adverse = p.upnl < 0 ? Math.abs(p.upnl) : 0;
        return {
          key: `pos-${p.coin}-${i}`,
          cat: "risk" as const,
          ms: now, // 持仓为实时态,统一置顶时间;同组内靠 weight 排序
          title: t("actions.heldPosition", "持仓 · {{coin}} {{side}}", { coin, side: sideLbl }),
          detail: t(
            "actions.heldDetail",
            "数量 {{size}} · 浮盈 {{upnl}} · ROE {{roe}}",
            { size: Math.abs(p.size), upnl: `${pos ? "+" : "-"}$${fmtUsd(p.upnl)}`, roe: roeStr },
          ),
          chip: {
            text: `${pos ? "+" : "-"}$${fmtUsd(p.upnl)}`,
            tone: (pos ? "pos" : "neg") as "pos" | "neg",
          },
          tag: volatile
            ? { text: t("actions.volatile", "动荡"), cls: "bg-rose-400/15 text-rose-200" }
            : undefined,
          weight: adverse + (volatile ? 1e6 : 0),
        };
      });
  }, [positions, t]);

  // 决策 entries(真实执行器 ai_console_logs + 客户端 HL 规则 feed)→ 风险/关注 行。
  // 真实成交 fill 已在 tradeRows;这里跳过 entry.action==="open"/"close"(避免与 fills
  // 重复),只保留 skip-open(关注)、stop-loss(风险)、以及客户端 setup(关注)。
  const decisionRows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const e of entries ?? []) {
      if (e.action === "open" || e.action === "close") continue; // 成交走 fills,不重复
      const cat = customerCategory(e);
      const ms = Date.parse(e.ts);

      if (e.action === "skip-open") {
        // 显式「跳过开仓 · 原因」,绝不当成模糊 setup。
        out.push({
          key: `dec-${e.id}-${e.ts}`,
          cat: "watch",
          ms,
          title: e.symbol
            ? t("actions.skipOpenCoin", "跳过开仓 · {{coin}}", { coin: e.symbol })
            : t("actions.skipOpen", "跳过开仓"),
          detail: e.reason || e.message,
          chip: { text: t("actions.gated", "已挡下"), tone: "neutral" },
        });
        continue;
      }
      if (e.action === "stop-loss") {
        out.push({
          key: `dec-${e.id}-${e.ts}`,
          cat: "risk",
          ms,
          title: e.symbol
            ? t("actions.stopLossCoin", "止损 · {{coin}}", { coin: e.symbol })
            : t("actions.stopLoss", "止损"),
          detail: e.reason || e.message,
        });
        continue;
      }
      // 一般 setup / 风险判断(客户端规则或执行器的非动作决策)。
      out.push({
        key: `dec-${e.id}-${e.ts}`,
        cat,
        ms,
        title: e.symbol || "",
        detail: e.message,
        chip:
          e.conviction != null
            ? { text: `conv ${e.conviction.toFixed(2)}`, tone: "neutral" as const }
            : undefined,
      });
    }
    return out;
  }, [entries, t]);

  // 市场情绪 F&G —— 单行,钉在「风险」最顶(weight 极大 + ms=now+ε,稳压一切 position 行)。
  // 极度恐慌/极度贪婪 = 红;边缘 = amber;中性 = muted。极端时附一句门控提示(挡多/挡空)。
  const fearGreedRow = useMemo<Row | null>(() => {
    if (!fearGreed || !Number.isFinite(fearGreed.value)) return null;
    const lvl = fgLevel(fearGreed.value);
    const levelLabel = t(lvl.levelKey, lvl.levelFb);
    let detail = t("actions.fearGreedDetail", "恐慌贪婪指数 F&G {{value}}", { value: fearGreed.value });
    if (lvl.hintKey) detail += ` · ${t(lvl.hintKey, lvl.hintFb)}`;
    return {
      key: "fear-greed",
      cat: "risk",
      ms: Date.now() + 1, // +ε:稳压同为 now 的持仓行
      title: t("actions.fearGreed", "市场情绪 · {{label}}", { label: levelLabel }),
      detail,
      tag: { text: levelLabel, cls: lvl.chipCls },
      weight: Number.MAX_SAFE_INTEGER, // 钉顶
    };
  }, [fearGreed, t]);

  // 风险 = F&G(钉顶)+ 持仓动荡(positions)+ 止损决策(stop-loss)。最动荡/最不利在前,其次按时间。
  const riskRows = useMemo(() => {
    const merged = [
      ...(fearGreedRow ? [fearGreedRow] : []),
      ...positionRiskRows,
      ...decisionRows.filter((r) => r.cat === "risk"),
    ];
    return merged.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || b.ms - a.ms);
  }, [fearGreedRow, positionRiskRows, decisionRows]);
  const watchRows = useMemo(() => decisionRows.filter((r) => r.cat === "watch"), [decisionRows]);

  const rows = useMemo<Row[]>(() => {
    if (tab === "trades") return tradeRows.slice().sort((a, b) => b.ms - a.ms);
    if (tab === "risk") return riskRows; // 已按 weight/时间排序
    if (tab === "watch") return watchRows.slice().sort((a, b) => b.ms - a.ms);
    // 全部:合并所有源,F&G(weight 极大)钉顶,持仓动荡(weight)其次,其余按时间倒序。
    return [...(fearGreedRow ? [fearGreedRow] : []), ...tradeRows, ...decisionRows, ...positionRiskRows]
      .slice()
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || b.ms - a.ms);
  }, [tab, tradeRows, riskRows, watchRows, decisionRows, positionRiskRows, fearGreedRow]);

  const tabs: [SubTab, string][] = [
    ["all", t("actions.all", "全部")],
    ["risk", t("actions.catRisk", "风险")],
    ["watch", t("actions.catWatch", "关注")],
    ["trades", t("actions.catTrade", "成交")],
  ];

  return (
    <section className="flex flex-col rounded-2xl border border-white/[0.06] bg-black/30 overflow-hidden">
      {/* 子标签 pill 行 */}
      <div className="flex shrink-0 gap-1 overflow-x-auto scrollbar-hide p-2 border-b border-white/[0.06]">
        {tabs.map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setTab(v)}
            className={cn(
              "shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
              tab === v
                ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-white/5",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <ul className="flex flex-col divide-y divide-white/[0.04] max-h-[60vh] overflow-y-auto scrollbar-hide">
        {rows.length === 0 ? (
          <li className="px-4 py-10 text-center text-xs text-muted-foreground/50">
            {t("actions.empty", "暂无记录")}
          </li>
        ) : (
          rows.map((r) => <ActionRow key={r.key} row={r} lang={i18n.language} t={t} />)
        )}
      </ul>
    </section>
  );
}

function ActionRow({
  row,
  lang,
  t,
}: {
  row: Row;
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const chip = CAT_CHIP[row.cat];
  const ChipIcon = chip.Icon;
  return (
    <li className="flex gap-2.5 px-3 py-3">
      {/* 左侧状态点 */}
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", CAT_DOT[row.cat])} />

      <div className="min-w-0 flex-1">
        {/* 标题行(加粗,折行;"—"后弱化细节,截断) */}
        <p className="text-[13px] font-semibold leading-snug break-words text-foreground/90">
          {row.title}
          {row.detail && (
            <span className="ml-1 font-normal text-muted-foreground/60">
              — <span className="line-clamp-1 inline align-bottom">{row.detail}</span>
            </span>
          )}
        </p>

        {/* 第二行:成交明细(开仓) */}
        {row.sub && (
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/55">{row.sub}</p>
        )}

        {/* meta 行:TYPE chip + 相对时间 + 可选 realized/conviction chip + tx */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
              chip.cls,
            )}
          >
            <ChipIcon className="h-2.5 w-2.5" />
            {t(chip.labelKey, chip.labelFb)}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/45">
            · {relTime(row.ms, lang)}
          </span>
          {row.tag && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                row.tag.cls,
              )}
            >
              {row.tag.text}
            </span>
          )}
          {row.chip && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                row.chip.tone === "pos" && "bg-emerald-400/10 text-emerald-300",
                row.chip.tone === "neg" && "bg-rose-400/10 text-rose-300",
                row.chip.tone === "neutral" && "bg-white/5 text-foreground/65",
              )}
            >
              {row.chip.text}
            </span>
          )}
          {row.href && (
            <a
              href={row.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300"
            >
              <ExternalLink className="h-3 w-3" />
              {t("actions.viewTx", "查看")}
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
