# MEMORY · 多语言/翻译工程师 i18n Translator

> 先查这里 + `.agents/memory/`(i18n 条目)+ 用户记忆 `rune-dapp-i18n-missing-key-fallback`。

## 双系统(头等大事,别混)
- **`/app` 交易 dapp** = react-i18next,locale 在 `src/app/locales/*.json`(**嵌套** JSON,12 语言),组件 `useTranslation()`/`t("ns.key","中文默认")`。
- **营销站**(home/projects/rune/recruit/resources/b18/legend-atm/hyperliquid)= 自定义 Dict,`useLanguage()` from `@/contexts/language-context`,字典 `src/contexts/i18n/*.ts`(**扁平** `"mr.x.y":"v"`,另含 th)。少数组件用内联 `tt({zh,en,...})`。
- 判断:看组件 import 的是 `react-i18next` 还是 `@/contexts/language-context`。

## 头号根因:缺 key → 中文穿帮
- `t("key","中文默认")` 的 key 不在 locale → react-i18next **静默回退到中文默认** → 所有语言显示中文。「切语言没用」99% 是这个。
- **对象式 key 会绕过 `t("...")` 正则**:`{ k:"strategyHero.statLive", fb:"执行" }` 这种要专门扫(P1#1)。本会话漏过一次(hero 统计标签)。
- 动态 key `t(\`hl.executor.${id}.label\`)` 静态扫不到,枚举 id 核。

## parity 现状(2026-06-21 审计)
- json 系统:en/zh=2712 key 全。**其余 10 语言曾缺同样 41 个 key**(多为 `deposit.*` PM/HL 充值流 + 几个 `hl.*` + `node.connectFirst`,只加进 en+zh)。已补齐。
- json `/app` 还曾缺(全语言都没):`profile.node.*`(25,node-overview)、`hl.executor.*`(8)、`node.err.*`(10,nodes.tsx 错误映射)、`signalSector.{crypto,equity,meme}`、`support.toast*`(4)。
- 裸中文(全语言中文):`dashboard-shell.tsx` 连接钱包 gate(2 行)、`admin-funds.tsx`(整页~38,运营内部)。
- 营销站:`contexts/i18n` 17 个 `mr.dash.codeMgr.*` 是**孤儿 key**(en 也没、组件没用,auth-code-manager 反而硬编码)——要么接上要么删。`recruit.tsx` 52 处内联 map 缺 es/ru/fr/de/ar/pt。大块裸中文页见 playbook P5。

## 工具链(本会话验证好用)
- `/tmp/merge-i18n-flat.mjs`:`node merge-i18n-flat.mjs <lang> <flat.json>` 展开 dotted→嵌套 deep-merge + 校验 resolve + placeholder mismatch。
- manifest `/tmp/i18n-manifest.json`(en+zh)+ 多 subagent 并行翻译,每 agent 写各自 locale 无冲突。
- parity 一行脚本:flatten 12 json → union → 逐语言 `missing_vs_union`。

## 占位符 / token(P3)
- 保留:`{{n}}{{count}}{{amount}}{{min}}{{val}}{{token}}{{chain}}{{native}}`。
- 不译:Hyperliquid/USDC/Arbitrum/Polygon/Bridge2/Meme/P&L/Sharpe/Top/币种/`$`。小符 AI→各语言统一(en="Rune AI")。
- `t(key,{opts},fallback)` 顺序坏 → fallback 必在 options 前(`.agents/memory/i18n-t-wrapper`)。

## 构建/部署
- `build:mainnet` 带 `BASE_PATH=/ PORT=8080`(**PORT 必填**否则 vite config 报错)+ Supabase/thirdweb env。部署 `wrangler pages deploy dist/public --project-name rune-lastest --branch main`。pnpm 闸直调 `node_modules/.bin/{vite,wrangler}` 绕过。
- `tsc --noEmit` 本 repo 一堆 pre-existing 报错(depth-bar/dashboard/layout…),只看自己改的文件。

## 链接
[[rune-dapp-i18n-missing-key-fallback]] · `.agents/memory/` 的 i18n-dual-systems / i18n-t-wrapper · uiux-engineer/playbooks.md P5。
