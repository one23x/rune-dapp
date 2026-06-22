/**
 * 客户端 HL 原生决策 feed(规则版)——浏览器直连 Hyperliquid `candleSnapshot`
 * (CORS 开放、无地理封锁,替代被 Binance 403 卡死的 cf-worker-ai-bot),按所选策略
 * 的 universe 跑 strategy-lab 的规则(机制 / 十日突破 / 4h 20/50 回踩),产出真实
 * HL 数据驱动的决策对话流(watch / review / passed)。
 *
 * 多语言:analyze() 返回 i18n key + 变量,hook 用 t() 渲染 → en/zh/各国语言都正确。
 * 这是 leader 无关、HL 原生的真实来源;LLM 版需后端,见 strategy-executor(待部署)。
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecisionEntry, DecisionKind } from "./decision-log-hooks";

const HL_INFO = "https://api.hyperliquid.xyz/info";
const POLL_MS = 90_000;

interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }
interface Read { kind: DecisionKind; key: string; vars: Record<string, string>; conviction: number | null }

const _cache = new Map<string, { at: number; data: Candle[] }>();
async function fetchCandles(coin: string, interval: string, days: number): Promise<Candle[]> {
  // HIP-3 builder 永续(coin 含 ":",如 XYZ:CBRS / km:PLTR)candleSnapshot 不支持 → 直接跳过,
  // 避免对 HL /info 发出注定 500 的请求(控制台噪音)。
  if (coin.includes(":")) return [];
  const ck = `${coin}:${interval}:${days}`;
  const hit = _cache.get(ck);
  if (hit && Date.now() - hit.at < 300_000) return hit.data;
  const now = Date.now();
  const r = await fetch(HL_INFO, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "candleSnapshot", req: { coin, interval, startTime: now - days * 86400000, endTime: now } }),
  });
  // 非 HL 上市币(如 PEPE→应为 kPEPE)→ candleSnapshot 500;优雅跳过(缓存空,analyze 走 warmup),不抛错刷屏。
  if (!r.ok) { _cache.set(ck, { at: Date.now(), data: [] }); return []; }
  const raw = (await r.json()) as Array<Record<string, unknown>>;
  const data = (raw ?? []).map((c) => ({ t: +(c.t as number), o: +(c.o as string), h: +(c.h as string), l: +(c.l as string), c: +(c.c as string), v: +(c.v as string) }));
  _cache.set(ck, { at: Date.now(), data });
  return data;
}

function sma(xs: number[], n: number): number | null { if (xs.length < n) return null; let s = 0; for (let i = xs.length - n; i < xs.length; i++) s += xs[i]; return s / n; }
function ema(xs: number[], n: number): number | null { if (xs.length < n) return null; const k = 2 / (n + 1); let e = xs[0]; for (let i = 1; i < xs.length; i++) e = xs[i] * k + e * (1 - k); return e; }
function px(n: number): string { return n >= 100 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : Number(n.toPrecision(4)).toString(); }

function analyze(strategyId: string, coin: string, d: Candle[], h4: Candle[]): Read {
  if (d.length < 30) return { kind: "watch", key: "hlFeed.warmup", vars: { coin }, conviction: null };
  const dc = d.map((x) => x.c), dh = d.map((x) => x.h), dl = d.map((x) => x.l);
  const last = dc[dc.length - 1];
  const sma200 = sma(dc, Math.min(dc.length, 200));
  const regime = sma200 != null ? (last > sma200 ? "up" : "down") : "?";
  const tenHigh = Math.max(...dh.slice(-11, -1));
  const tenLow = Math.min(...dl.slice(-11, -1));
  const h4c = h4.map((x) => x.c);
  const e20 = ema(h4c, 20), e50 = ema(h4c, 50);
  const trend4 = e20 != null && e50 != null ? (e20 > e50 ? "up" : "down") : "?";
  const ch24 = dc.length >= 2 ? ((last - dc[dc.length - 2]) / dc[dc.length - 2]) * 100 : 0;
  // crypto-trend 双向(下行做空);股票/meme 偏多(下行空仓观望)。
  const bidir = strategyId === "crypto-trend";

  if (regime === "up") {
    if (last >= tenHigh * 0.995) return { kind: "review", key: "hlFeed.breakout", vars: { coin, level: px(tenHigh) }, conviction: 0.6 };
    if (trend4 === "up" && e20 != null && e50 != null && last <= e20 * 1.01 && last >= e50 * 0.99)
      return { kind: "review", key: "hlFeed.pullback", vars: { coin, lo: px(e50), hi: px(e20) }, conviction: 0.55 };
    return { kind: "watch", key: "hlFeed.watchUp", vars: { coin, high: px(tenHigh), low: px(tenLow) }, conviction: null };
  }
  if (regime === "down") {
    if (bidir) {
      if (last <= tenLow * 1.005) return { kind: "review", key: "hlFeed.breakdown", vars: { coin, level: px(tenLow) }, conviction: 0.6 };
      if (trend4 === "down" && e20 != null && e50 != null && last >= e20 * 0.99 && last <= e50 * 1.01)
        return { kind: "review", key: "hlFeed.bounceShort", vars: { coin, lo: px(e20), hi: px(e50) }, conviction: 0.55 };
      return { kind: "watch", key: "hlFeed.watchDown", vars: { coin, low: px(tenLow) }, conviction: null };
    }
    return { kind: "passed", key: "hlFeed.downAside", vars: { coin, chg: `${ch24 >= 0 ? "+" : ""}${ch24.toFixed(1)}` }, conviction: null };
  }
  return { kind: "watch", key: "hlFeed.warmup", vars: { coin }, conviction: null };
}

/** 拉取 + 分析 universe,累积成决策对话流(newest-first,与 DecisionLog 约定一致)。 */
export function useHlStrategyDecisions(strategyId: string, universe: string[]): { entries: DecisionEntry[]; loading: boolean } {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DecisionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const idRef = useRef(1);
  const uniKey = `${strategyId}:${universe.join(",")}`;

  useEffect(() => {
    let active = true;
    setEntries([]); setLoading(true);
    async function tick() {
      for (const coin of universe) {
        if (!active) return;
        try {
          const [d, h4] = await Promise.all([fetchCandles(coin, "1d", 260), fetchCandles(coin, "4h", 80)]);
          if (!active) return;
          const r = analyze(strategyId, coin, d, h4);
          const entry: DecisionEntry = {
            id: idRef.current++, ts: new Date().toISOString(), kind: r.kind,
            symbol: `${coin}-PERP`, message: t(r.key, r.vars), conviction: r.conviction,
          };
          setEntries((prev) => [entry, ...prev].slice(0, 200));
        } catch {
          /* 单币失败跳过(不像 Binance 那样整条 403) */
        }
      }
      if (active) setLoading(false);
    }
    void tick();
    const timer = setInterval(() => { void tick(); }, POLL_MS);
    return () => { active = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniKey]);

  return { entries, loading };
}
