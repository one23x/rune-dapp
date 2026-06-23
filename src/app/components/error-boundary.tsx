import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * 顶层错误边界 —— 防「整页黑屏」。
 * 之前全 app 没有任何 ErrorBoundary:任意组件渲染期抛错(如某地区被墙的请求失败后
 * 在未守卫的 .map/解构上炸)就会让 React 卸载整棵树 → 用户看到纯黑屏、无从恢复。
 * 现在:捕获后展示可读的兜底页 + 「重新加载」,并把错误打到 console(便于用户回传定位)。
 * 注:这是 class 组件(React 错误边界只能用 class 实现)。
 */
interface State {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 打到 console,方便用户把报错回传(尤其某地区黑屏的现场定位)。
    console.error("[AppErrorBoundary] uncaught render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "#0a0a0b",
          color: "#e5e7eb",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>页面加载出错 · Something went wrong</div>
        <div style={{ fontSize: 13, color: "#9ca3af", maxWidth: 420, lineHeight: 1.6 }}>
          请刷新重试。若多次出现,可能是网络/地区限制导致部分资源无法加载。
          <br />
          Please reload. If it persists, a network/region restriction may be blocking some resources.
        </div>
        <button
          onClick={() => {
            // 清掉可能损坏的本地缓存后硬刷,带 cache-bust。
            try {
              localStorage.removeItem("rune-rq-cache-v2");
            } catch { /* noop */ }
            window.location.replace(`${window.location.pathname}?_r=${Date.now()}`);
          }}
          style={{
            marginTop: 4,
            padding: "10px 24px",
            borderRadius: 10,
            border: "1px solid rgba(251,191,36,0.4)",
            background: "rgba(251,191,36,0.12)",
            color: "#fbbf24",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          重新加载 · Reload
        </button>
        {this.state.error?.message && (
          <code style={{ fontSize: 11, color: "#6b7280", marginTop: 8, maxWidth: 480, wordBreak: "break-all" }}>
            {this.state.error.message}
          </code>
        )}
      </div>
    );
  }
}
