/**
 * iOS 拿不到新版的根治 — 版本检测自动刷新。
 *
 * 根因:iOS Safari / 钱包内置 WKWebView 不回收后台标签页,用户「重开」浏览器
 * 时跑的仍是内存里的旧 SPA,index.html 的 `must-revalidate` 缓存头根本没机会
 * 生效(安卓 Chrome 会杀后台标签 → 重开整页重载 → 自然拿到新版)。
 *
 * 两个补救,都装在 installVersionCheck() 里:
 *  1. 切回前台(visibilitychange→visible / bfcache pageshow)时拉
 *     /version.json 比对构建号(vite.config.ts 的 define + emit-version-json
 *     插件产出),不一致整页 reload;
 *  2. vite:preloadError(旧页面引用的懒加载 chunk 已被新部署替换 → 404)
 *     直接 reload,防点路由白屏。
 *
 * sessionStorage 防 reload 死循环:CDN 边缘还没刷新时 reload 后可能依旧
 * 版本不一致,30s 内不重复刷,等下一次切前台再查。
 */

declare const __BUILD_ID__: string;

const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;
const MIN_CHECK_INTERVAL_MS = 60_000; // 切前台最多每分钟查一次
const RELOAD_GUARD_KEY = "rune:version-reloaded-at";
const RELOAD_GUARD_MS = 30_000;

let lastCheck = 0;

function safeReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage 不可用(隐私模式等)→ 仍然刷,只是少了循环保护 */
  }
  // iOS Safari / 钱包 WKWebView 下 location.reload() 常被内存/磁盘缓存命中,
  // index.html 仍是旧的 → 拿不到新版。改为带 cache-bust 参数的整页导航:
  // 改变 URL(_v=时间戳)= 浏览器视作新地址,强制重新拉取 index.html(进而引用
  // 新 hash 的 chunk)。每次刷新覆盖同一个 _v 参数,不累积;路由忽略未知 query。
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_v", String(Date.now()));
    window.location.replace(url.toString());
    return;
  } catch {
    /* URL 构造失败(极老 WebView)→ 退回普通 reload */
  }
  window.location.reload();
}

async function checkVersion() {
  const now = Date.now();
  if (now - lastCheck < MIN_CHECK_INTERVAL_MS) return;
  lastCheck = now;
  try {
    const res = await fetch(`${VERSION_URL}?_=${now}`, { cache: "no-store" });
    if (!res.ok) return;
    const { buildId } = (await res.json()) as { buildId?: string };
    if (buildId && buildId !== __BUILD_ID__) safeReload();
  } catch {
    /* 网络抖动忽略,下次切前台再查 */
  }
}

export function installVersionCheck() {
  if (import.meta.env.DEV) return; // dev 没有 version.json

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkVersion();
  });
  // bfcache 恢复(iOS 后退/重开标签页的常见路径)不触发 visibilitychange
  window.addEventListener("pageshow", (e) => {
    if ((e as PageTransitionEvent).persisted) void checkVersion();
  });
  // 旧 chunk 404(新部署替换了带 hash 的文件名)→ 自动整页刷新
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault(); // 吞掉 Vite 的报错,直接刷
    safeReload();
  });
}
