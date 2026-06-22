# MEMORY · 前端/UX 工程师 UIUX Engineer

> 先查这里 + `.agents/memory/`（UI 类条目最多）+ `docs/journey/LESSONS.md`。

## 设计系统（用户记忆 rune-ui-design-conformance）
- **amber/dark 主题** + motion.div 淡入 + 移动优先从 320px 起。这是老板明确 call-out 的一致性要求。

## 防穿帮（会员端铁律）
- **链上 explorer 跳转恒 null**：会员展示=虚拟账本，真实交易账户是公司混合资金，给链接会穿帮（member-ledger 设计）。
- **reskin/port 后必复核 live 绑定**（`.agents/memory/reskin-data-bindings`）：subagent 会静默把 mockup 占位字面量烤进真实数据位。

## glass / 动效（`.agents/memory/glass-interaction-utils`）
- 全局 `.glass-panel` sheen/depth；opt-in `.glass-interactive`/`.tap-press`/`.glass-sheen` 在 index.css。
- **无全局 MotionConfig** → 每组件 `useReducedMotion` gate Framer Motion。

## 对话框 / PayEmbed（`.agents/memory/payembed-dialog-overflow`）
- thirdweb PayEmbed 溢出 max-w-sm 对话框 → 包 `w-full + 内层 overflow-x-auto`（HL & pUSD 充值弹窗都要）。

## i18n（`.agents/memory/i18n-t-wrapper` + `i18n-dual-systems`）
- `t(key,{opts},fallback)` 坏 → fallback 放 options 之前。
- 双系统：react-i18next(`app/locales/*.json`) for /app vs language-context(`contexts/i18n/*.ts`,`mr.*`) for mainnet。

## 预览 / 截图（`.agents/memory/app-preview-gating` + `mockup-screenshot-quirk`）
- app 在 `/app` 下，`?preview=1` 绕过未连接重定向（CopyGate 仍要真钱包）。
- app_preview 截图打主 app(5000) 不是 mockup 沙箱 → 用 subagent 截图或 curl HTML 验 mockup。

## iOS（L001）
- 构建注入 `__BUILD_ID__` + `/version.json`(no-store)，切前台 reload + cache-bust。老用户首次需手动刷一次。

## 链接
- `.agents/memory/` 全部 UI 条目 / `docs/ops/member-ledger-design.md`（口径与防穿帮）
