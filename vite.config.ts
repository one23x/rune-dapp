import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

const basePath = process.env.BASE_PATH;
if (!basePath) throw new Error("BASE_PATH environment variable is required.");

// ── One-Agents Engine dev proxy ───────────────────────────────────────────────
// Local dev forwards `/engine/*` → the Engine API, injecting the project API
// key Bearer header SERVER-SIDE (this is node context, NOT a VITE_ var) so the
// key never enters the client bundle. In production the SPA points
// VITE_ENGINE_PROXY at the Supabase `engine-proxy` Edge Function instead.
const ENGINE_BASE = process.env.ONE_AGENTS_API_BASE || "https://api.one-agents.com";
const ENGINE_KEY = process.env.ONE_AGENTS_API_KEY || "";

// ── 构建号(iOS 自动刷新用)──────────────────────────────────────────────────
// iOS Safari / 钱包内置 WKWebView 不回收后台标签页:用户「重开」时跑的仍是内存
// 里的旧 SPA,index.html 的 must-revalidate 没机会生效。构建时把 BUILD_ID 编进
// bundle 并产出 /version.json;前端切回前台时比对,不一致整页 reload
// (见 src/app/lib/version-check.ts)。
const BUILD_ID = new Date().toISOString();

export default defineConfig({
  base: basePath,
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ["defaults", "iOS >= 11", "Android >= 6", "not IE 11"],
      modernPolyfills: true,
      renderLegacyChunks: true,
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
    }),
    {
      name: "emit-version-json",
      apply: "build",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ buildId: BUILD_ID }),
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@marketing": path.resolve(import.meta.dirname, "src/marketing"),
      "@app": path.resolve(import.meta.dirname, "src/app"),
      "@app-shared": path.resolve(import.meta.dirname, "src/app-shared"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split the heaviest vendors out of the single 4MB+ entry chunk so
        // the browser can cache them independently and parse less up-front.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("thirdweb") || id.includes("@thirdweb")) return "vendor-thirdweb";
          if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory-vendor")) return "vendor-charts";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@supabase")) return "vendor-supabase";
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    watch: {
      ignored: ["**/node_modules/**", "**/.local/share/pnpm/**", "**/dist/**"],
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/engine": {
        target: ENGINE_BASE,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/engine/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            if (ENGINE_KEY) proxyReq.setHeader("Authorization", `Bearer ${ENGINE_KEY}`);
          });
          proxy.on("error", (err) => {
            // eslint-disable-next-line no-console
            console.warn("[engine-proxy] upstream error:", err?.message);
          });
        },
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
