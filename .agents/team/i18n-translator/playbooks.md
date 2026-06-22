# PLAYBOOKS · 多语言/翻译工程师(可复用技能)

> 跨页/跨仓复用的 i18n 打法。每次照这套,越做越快、越不漏。

## P1 · 审计:找出所有缺 key / 硬编码 / parity 缺口
1. **缺 key(/app json)**:node 脚本 walk `src/app/**/*.tsx`,正则抓 `t("key","默认")` + 对象式 `{k:"key",fb:"默认"}`/`{labelKey,labelFb}`/`{kKey,kEn}`,对每个 key 在 `en.json` 做**嵌套** `split(".").reduce` 存在性检查。缺的就是 bug,记 key+中文默认+file:line。
2. **动态 key**:`t(\`ns.${id}.label\`, fb)` 静态扫不到——枚举 id 列表(如 `hl.executor.{mirror,steady,aggressive,smart}`、`node.err.{...}`)手工核。
3. **裸中文**:抓含 CJK 的 JSX 文本/`placeholder=`/`title=`/`toast({title})`,排除注释、`data-testid`、`labelFb/fb` 等 fallback 实参。
4. **营销站 Dict parity**:解析 `contexts/i18n/*.ts` 每文件 key 集,算谁缺谁(en.ts 为基)。`ko.md`/`index.ts`/`types.ts` 跳过。
5. **内联 `tt({...})` 缺语言**:抓 `tt({...})` 与 `{label:{en,zh,...}}` 数据对象,看缺哪些语言(recruit.tsx 典型只有 7 语缺 es/ru/fr/de/ar/pt)。
6. **跨语言 parity**:flatten 12 个 json,union 全 key,逐语言列 `missing_vs_union`。理想全 0。
> 分区并行:大仓拆给多 subagent(按目录/系统)同时扫,回结构化 file:line 清单。

## P2 · 修复:manifest + deep-merge(绝不手改 JSON)
1. 建 manifest:`{ "dotted.key": "源文案" }`(扁平)或嵌套;en=源、zh=参照(zh 常等于现有中文 fallback,直接用)。
2. **flat deep-merge 脚本**:读 `locales/<lang>.json` → 把 dotted key 展开成嵌套 → deep-merge(只增不删既有 key)→ 写回 → **校验**:全 key resolve + 每 key 的 `{{...}}` 占位符集与源一致(mismatch 即 `exit 2`)。
3. en/zh 直接合(无需译);**多 subagent 并行**翻其余 10 语言,每 agent 3 语言写各自 `/tmp/i18n-<lang>.json` 再跑 merge——不同 locale 文件无写冲突,不用 worktree。
4. 内联 `tt({...})` 缺语言:直接编辑组件,给每个对象补上缺的语言键(批量可让 subagent 按文件改)。

## P3 · 翻译铁律
- **占位符逐字保留**:`{{n}}`/`{{count}}`/`{{amount}}`/`{{min}}`/`{{val}}`/`{{token}}`/`{{chain}}`/`{{native}}`——位置可挪、拼写不可变。
- **不译 token**:Hyperliquid · USDC · Arbitrum · Polygon · Bridge2 · Meme · P&L · Sharpe · Top · 币种代码(BTC/SOL/…)· `$`。
- **AI 助手名**「小符 AI」→ 各语言统一(en 用 "Rune AI")。
- **zh-TW** 从 zh 简→繁转换(非从英译);**ar** 是 RTL,token 留拉丁。
- **`t(key,{opts},fallback)` 是坏的**(会渲染裸 key)→ **fallback 放 options 之前**。

## P4 · 验证清单(交付前必跑)
- 12 语言 × 目标 key 全 resolve(parity 脚本=0 缺口)。
- 每 key 的占位符在每语言都在(merge 脚本 placeholder 校验过)。
- 目标页实际切到 ja/ar/ru 等抽查无残留中文。
- 生产构建过(`build:mainnet`,PORT 必填)——裸 key/JSON 损坏会暴露。
- 没手改 JSON,全经脚本。

## P5 · 已知大块 backlog(硬编码迁移,逐步清)
- 营销站全硬编码页:`b18.tsx`(~83)、`legend-atm.tsx`(~50)、`hyperliquid.tsx`、`rune.tsx` 的 `isEn?:` 中文分支、`auth-code-manager.tsx`(22)、`referrer-gate.tsx`(13)、`not-found.tsx`。
- `recruit.tsx` 52 处内联 `tt`/lang-map 缺 es/ru/fr/de/ar/pt。
- `admin-funds.tsx` 整页未 i18n(运营内部,低优先)。
> 迁移时:先抽中文进 Dict(`mr.*`)或 json key,再补全语言,别只做 en/zh。
