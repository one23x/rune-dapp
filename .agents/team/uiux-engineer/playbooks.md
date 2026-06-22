# PLAYBOOKS · 前端/UX 工程师（可复用技能）

> 跨 project 复用的前端打法。换仓（dapp/admin/console）也照这套，越做越快。

## P1 · 新页面/改版上线流程
1. 读 `PRODUCT_FEEDBACK.md` + 现有同类页（贴风格不另造）。
2. 实现：amber/dark 主题 + glass 工具类（`.glass-panel` 全局 sheen/depth，`.glass-interactive`/`.tap-press` opt-in）。
3. 数据绑定走真实 hook（**reskin/port 后必复核**，防 mockup 占位字面量被烤进）。
4. 移动端：320px 起逐断点查；PayEmbed/对话框 `w-full + 内层 overflow-x-auto` 防溢出。
5. edge 自检：grep 路由无 `pg`/`fs`/`node:*`；`pnpm exec next-on-pages` 构建无报错。
6. 交 qa：列改了哪些组件 + 数据来源 + 断点。

## P2 · 防穿帮检查（会员端必跑）
- 链上跳转：`explorerTx`/`explorerAddr` 恒 null（虚拟账本，真实交易账户=公司混合资金，给链接会穿帮）。
- 口径：净值=余额+Σ未实现；可用=余额−保证金；可提=不含浮盈；全部钳 ≥0。
- 历史/持仓：手动单去 explorer 链接；`record_hidden` 过滤。

## P3 · iOS 版本检测（SPA 必带）
构建注入 `__BUILD_ID__` + `/version.json`(no-store) → 切前台比对自动 reload + `vite:preloadError` 兜底 + `safeReload` 带 cache-bust 导航（`location.replace(url+?_v=ts)`）。**老 iOS 用户上线后仍需手动刷一次进新机制**。

## P4 · 动效与无障碍
- 无全局 `MotionConfig` → 每组件 `useReducedMotion()` gate Framer Motion。
- glass 交互 opt-in，别全局开（性能 + 晕动）。

## P5 · i18n（双系统，别混）
- `/app`：react-i18next（`app/locales/*.json`）。
- mainnet：language-context（`contexts/i18n/*.ts`，`mr.*`）。
- `t()` 参数序：`t(key, {opts}, fallback)` 是坏的会渲染裸 key → **fallback 放 options 之前**。
- JSON reserialize 字节一致，脚本化剪 key diff 干净。

## 验证清单（交付前）
桌面 + 320px 移动端 / edge 构建通过 / live 绑定无 mockup 残留 / 无穿帮入口 / 费用口径一致 / 动效 reducedMotion 生效。
