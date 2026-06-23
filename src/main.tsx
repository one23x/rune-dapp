import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThirdwebProvider } from "thirdweb/react";
import { LanguageProvider } from "@/contexts/language-context";
import { Toaster } from "@/components/ui/toaster";
// MUST be the shared singleton — module-level `queryClient.invalidateQueries`
// calls across the dashboard import this instance; providing a different
// client here silently turns them all into no-ops.
import { queryClient } from "@app/lib/queryClient";
// 顶层错误边界:防任意组件渲染抛错(如某地区被墙资源失败)导致整页黑屏。
import { AppErrorBoundary } from "@app/components/error-boundary";
// 缓存持久化(#1):首屏/重进页面秒显上次的净值·持仓·余额,后台静默刷新。
import { hydratePersistedCache, startPersistingCache } from "@app/lib/query-persist";
// iOS Safari/WKWebView 旧 SPA 常驻内存拿不到新版 → 切回前台比对构建号自动刷新,
// 并兜住旧 chunk 404(vite:preloadError)防白屏。
import { installVersionCheck } from "@app/lib/version-check";

import AppRouter from "./app-router";
import "@app/lib/i18n"; // initializes i18next (used by format.ts and dashboard)
import "./index.css";

installVersionCheck();

// 注水必须在首次 render 前(同步):首屏即拿到上次缓存的账户数据,不白屏。
hydratePersistedCache(queryClient);
startPersistingCache(queryClient);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThirdwebProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AppRouter />
            <Toaster />
          </LanguageProvider>
        </QueryClientProvider>
      </ThirdwebProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
