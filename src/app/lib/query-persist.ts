/**
 * Lightweight TanStack-Query cache persistence (zero extra deps — uses the
 * built-in dehydrate/hydrate). Goal: 净值/持仓/余额 等账户数据在刷新/重进页面时
 * **秒显上次值**,后台再静默刷新,而不是白屏/闪 $0 等一次慢的引擎往返。
 *
 * - 只持久化「每账户展示类」查询(queryKey[0]==="engine" 的 hl/user/余额/订单/节点),
 *   不存体量大或高频波动的行情流,也不存失败/无数据的查询。
 * - 用构建号(__BUILD_ID__)作 buster:新部署后旧形状缓存自动失效。
 * - maxAge 1h:更久的缓存视为过期丢弃(避免显示陈旧账户数)。
 * 注:hydrate 进来的查询 dataUpdatedAt 保留 → 挂载即判为 stale → 立刻后台 refetch,
 * 所以「秒显旧值 + 自动刷新」同时成立,绝不会卡在旧数。
 */
import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

declare const __BUILD_ID__: string;
const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const KEY = "rune-rq-cache-v1";
const MAX_AGE_MS = 60 * 60_000; // 1h

/**
 * 只持久化「每账户/Performance 展示类」数据 —— 秒显上次值、后台刷新。
 * - engine.hl.*(账户/净值/持仓/平仓 fills/净值曲线 equity-curve)、engine.user、余额、订单、节点。
 * - stats.*(useHlAccountAdjusted 的 admin 覆盖/手动持仓/手动成交叠加层 —— 否则 Performance
 *   每次进都要等这层冷加载才定型)。
 * - hl-marks(持仓估值的标记价 —— 否则持仓「市值/浮盈」列会慢慢冒出来)。
 * 不持久化行情流/排行榜等大体量或高频数据。
 */
function shouldPersist(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  if (root === "stats" || root === "hl-marks") return true;
  if (root !== "engine") return false;
  const k = queryKey[1];
  return k === "hl" || k === "user" || k === "pusd-balance" || k === "open-orders" || k === "node-status";
}

/** 启动时同步注水:首屏即有上次的净值/持仓,不白屏。务必在 render 前调用。 */
export function hydratePersistedCache(qc: QueryClient): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { buildId: string; ts: number; state: unknown };
    if (saved.buildId !== BUILD_ID || Date.now() - saved.ts > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return;
    }
    hydrate(qc, saved.state as Parameters<typeof hydrate>[1]);
  } catch {
    // 损坏/解析失败 → 忽略,当作无缓存。
    try { window.localStorage.removeItem(KEY); } catch { /* noop */ }
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** 订阅缓存变更,防抖 1s 后把白名单查询落 localStorage。 */
export function startPersistingCache(qc: QueryClient): void {
  if (typeof window === "undefined") return;
  const save = () => {
    try {
      const state = dehydrate(qc, {
        shouldDehydrateQuery: (q) =>
          q.state.status === "success" &&
          q.state.data !== undefined &&
          shouldPersist(q.queryKey as readonly unknown[]),
      });
      window.localStorage.setItem(KEY, JSON.stringify({ buildId: BUILD_ID, ts: Date.now(), state }));
    } catch {
      // 配额/序列化失败 → 跳过本次,不影响运行。
    }
  };
  qc.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 1000);
  });
}
