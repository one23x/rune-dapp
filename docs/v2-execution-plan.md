# Rune dapp v2 — 执行 Goal:交易/策略功能接入新 UI + 双写数据(客户 Supabase + 我们后端)

> 2026-06-01。目标:把 **Polymarket / Hyperliquid 交易、跟单、信号** 完整接入 v2 新 UI/UX,并让每笔
> 数据**同时回流到 ① project 客户的 Supabase ② 我们自己的后端 DB**。用**多角色 subagent**
> (开发/审计/测试/规划/客户操作)协作逐功能完成。

---

## 0. 现状(Explore 实测)

**v2 页面**(`src/app/pages/`):`trade.tsx` = Polymarket 预测下单;`copy-trading.tsx` = Polymarket 跟单总览(余额/充提/挂单);`strategy.tsx` = **Hyperliquid 跟单中心**(4 tab:strategies / ailab / prediction / pmlab);`strategy-vault.tsx`、`market.tsx`、`copy-trading-*.tsx`(auto/signals/history)。

**引擎 API**(`src/app/lib/engine.ts`,经 `/engine` 代理 dev / Supabase `engine-proxy` Edge Fn prod,Bearer 服务端注入):
- Polymarket:`trade/polymarket/users/:id/{api-key,pusd-balance,deposit-addresses,orders,open-orders,orders/:oid(DELETE),redeem,withdraw,wallet-withdraw}` + `trade/polymarket/{supported-assets,deposit-status/:q}`。
- Hyperliquid:`v1/hl/{leaders,signals,account,positions}`、`v1/users/:id/hl/subscriptions(GET/POST)`、`trade/hyperliquid/users/:id/withdraw`。
- 通用跟单:`v1/users/:id/copy-subscriptions(GET/POST/PATCH/DELETE)`。
- 信号:`v1/hl/signals`、`signals.leadersTop`、`leaderSignalsLatest`、`fusionByMarket`、`hotMarkets`。
- 用户:`users?smartWalletAddress=`、`users/onboard`、`users/:id/confirm`。

**Supabase**(`src/app/lib/supabase-client.ts`):只读 `ai_console_logs/ai_paper_trades/ai_predictions`(AI lab 实时)、`rune_purchases/rune_members/rune_referrers`(代币/节点)。**交易/跟单数据目前完全不进 Supabase。**

**当前数据流(关键)**:Polymarket + HL 交易/跟单 → **只进我们后端**(api.one-agents.com);AI 信号 + RUNE → **只进 Supabase**。**两者今天是分离的,没有任何"同时双写"。**

**身份**:thirdweb 钱包地址 → `useEngineUser` 自动 onboard → engine userId + engineEoaAddress。**dapp 无多 project 概念**,project 身份只在代理层的 Bearer key 体现。

---

## 1. 双写架构(本 Goal 的核心设计)

**目标**:客户在 v2 dapp 的每个交易/跟单/信号动作,数据**同时**落到「客户自己的 Supabase」和「我们的后端 DB」。

**选定方案 = 后端权威 + 镜像到客户 Supabase(Option A)**,而非客户端双写:
1. **我们后端 = 唯一写权威**(下单/成交/持仓/跟单订阅仍写自己的 DB,不变)。
2. 每个 `projects` 行新增 **客户 Supabase 凭证**(`supabase_url` + `supabase_service_key`,加密存),后台可配。
3. 后端在**写成功后**(order/fill/position/hl_subscription/copy_subscription 落库的同一事务后),**异步镜像** upsert 到该 project 客户的 Supabase 对应表(`orders/fills/positions/subscriptions/signals`),带 `project_id + user_id + 时间`,幂等(按 venueOrderId/fillHash)。失败进重试队列,不阻塞主交易。
4. **客户的 dapp**(他们用自己的 Supabase 凭证)直接读自己的 Supabase 看交易/持仓/跟单;**我们的 console/后端**读我们自己的 DB。两边最终一致。
5. 信号(`hl_signals/leader_signals/quant_signals`)同理镜像一份到客户 Supabase(只读流),驱动客户 UI 的信号面板。

**为什么不客户端双写**:客户端写两处不可靠(掉线/篡改/竞态),且客户 Supabase service key 不能进浏览器。后端镜像 = 单一真相源 + 安全 + 幂等。

**最小落地**:后端加 `project_mirror`(订阅 outbox 表 + worker),写 DB 时同事务塞 outbox,worker 消费 → 客户 Supabase REST upsert。

---

## 2. 功能清单(逐个要"接入新 UI + 跑通 + 双写")

| # | 功能域 | dapp 页面 | 引擎端点 | 双写表 |
|---|---|---|---|---|
| F1 | Polymarket 开户/Key | copy-trading | `…/api-key` | users |
| F2 | Polymarket 充值(跨链地址+状态) | copy-trading | `…/deposit-addresses`,`deposit-status` | deposits |
| F3 | Polymarket 余额 pUSD | copy-trading/trade | `…/pusd-balance` | (读) |
| F4 | Polymarket 下单/挂单/撤单/历史 | trade | `…/orders`,`open-orders`,`orders/:oid` | orders, fills |
| F5 | Polymarket 赎回/提现 | copy-trading | `…/redeem`,`withdraw`,`wallet-withdraw` | withdrawals |
| F6 | HL 账户/持仓 | strategy | `v1/hl/{account,positions}` | positions |
| F7 | HL leaders/金库 | strategy | `v1/hl/leaders` | (读) |
| F8 | HL 信号流 | strategy/signals | `v1/hl/signals` | signals |
| F9 | HL 跟单订阅(建/列/改/删)+ 参数(比例/杠杆/TP/SL) | strategy | `v1/users/:id/hl/subscriptions` | subscriptions |
| F10 | HL 充值/提现 | strategy | `trade/hyperliquid/…/withdraw` | withdrawals |
| F11 | 通用 leader 跟单 | copy-trading | `v1/users/:id/copy-subscriptions` | subscriptions |
| F12 | 信号中心(top/consensus/fusion/hot) | signals/pmlab | `signals.*` | signals |
| F13 | AI Lab / PM Lab(实时) | strategy(ailab/pmlab) | Supabase 实时 | ai_* |
| F14 | **双写镜像基础设施** | — | 后端 outbox+worker | 全部 |
| F15 | **策略包优化**(呈现/参数/定价/可信度,console+dapp 一致) | strategy + console | official_strategies / console packs | — |
| F16 | **设计系统 + 手机布局优化**(全 dapp 响应式/视觉一致) | 全部 | — | — |
| F17 | **AI 智能跟单(把"选交易员"升级成 AI 决策)** | strategy/copy-trading | 见下 | signal_trades/ai_inferences |

### F17 · AI 智能跟单(核心产品修正)

**问题(实测)**:今天系统是**两条割裂的路**:① 平台 Polymarket **AI agent**(`ai/agent-loop.ts`)= 真智能(LLM 判断 signal + leader 共识 + 新闻/情绪 `market_sentiment` + 历史结果 → action + 置信度 → 置信度缩放下单额);② **跟单**(`copytrade/matcher.ts` + `hyperliquid/copy-executor.ts`)= **纯确定性镜像**(`leader 名义额 × ratio × 各种 cap + 风控门`),**没有任何 AI 判断 / 新闻 / 训练调参**。用户要的"根据交易员信号→AI 判断→结合策略+训练+新闻→调整下单参数"= **AI 大脑已存在但没接到跟单路径**。

**修正 A · 后端(把已有大脑接进跟单)**:
1. leader 信号 → 复用 `agent-loop`/`multi-model` 的 **AI 判断层**:给信号打分、决定跟/不跟、产出 confidence。
2. 叠加 **fusion/训练权重**(`fusion_source_weights` 该 leader 学到的准确率,`fusion/learning.ts`)+ **新闻/情绪**(`market_sentiment`,`sentiment/news-cryptopanic.ts`)—— 这俩当前都没进跟单。
3. confidence + 策略方法 → **调整下单参数**(名义额按置信度缩放=agent 已有做法;杠杆 / TP-SL / 滑点 / 甚至 act-skip)—— 取代静态 ratio。
4. 保留"纯镜像"作为可选模式(开关),给想要原样跟的用户。
5. 每步写 `signal_trades`/`ai_inferences` 审计(已有表)→ 驱动 UI 决策卡 + 双写客户 Supabase。

**修正 B · UI/UX(跟单重设计)**:
- 跟单不再是"选交易员 + ratio",而是展示管线:**信号 → AI 判断 →(新闻·训练·策略)→ 调整后的下单**。
- **逐信号决策卡**:leader 做了 X → AI 判断(置信度+理由)→ 新闻/情绪上下文 → 该 leader 的 fusion 权重 → **最终调整参数**(实际下单 vs 原始镜像)→ 结果。
- 策略"方法"做成可选透镜(动量/均值回归/新闻驱动/套利),各自塑形调参。

**复用已有**:`ai/agent-loop.ts`(判断+置信度缩放)、`ai/multi-model.ts`(多模型投票)、`fusion/learning.ts`+`fusion/engine.ts`(训练权重)、`sentiment/news-cryptopanic.ts`(新闻)、`risk/checker.ts`(自适应/风控)。**缺的只是把它们接进 copy 路径 + UI 呈现**。

**已定模式(用户决策 2026-06-01)= AI 全权调参 + 可跳过**:AI 判断每个 leader 信号 → 可决定跟/不跟 → 按 置信度+新闻+训练权重 调整 名义额/杠杆/TP-SL/滑点;**用户设的是上限/风控边界,AI 在边界内自由发挥**。

**后端架构(具体)**:新模块 `src/ai/copy-decision.ts`,坐在 leader-watch/matcher → executor 之间,开关 `AI_COPY_DECISION_ENABLED`(默认 off,dev-first)+ 每订阅 `mode: 'ai' | 'mirror'`:
1. 取上下文:leader 信号 + 该 leader 的 `fusion_source_weights`(训练准确率)+ 该 coin 近期 `market_sentiment`(新闻/情绪)+ 订阅配置(= 用户上限:maxNotional/maxLeverage/dailyCap)。
2. 调 AI judge(复用 `multiModelJudge`/单模型)→ `{ act, confidence, rationale, paramAdjust:{ notionalMult, leverage?, tpPct?, slPct?, slippageBps? } }`。
3. `!act` → 跳过(记 `ai_inferences` + `signal_trades` skipped,UI 显示"AI 判定不跟+理由")。
4. `act` → 把 paramAdjust 应用到下单参数,**全部 clamp 到订阅上限**(置信度缩放名义额=agent 已有;杠杆≤maxLeverage;等)。
5. 记 `ai_inferences`(input/output/confidence)+ `signal_trades`(originKind=copy + 调参结果)→ 驱动 UI 决策卡 + 双写客户 Supabase。
6. `mode='mirror'` 或开关 off → 原确定性镜像(向后兼容,零行为变化)。

**前端**:订阅配置加 ① AI/镜像 模式开关 ② 风控上限(最大名义额/杠杆/日额 = AI 的天花板);新增**逐信号决策卡**(leader 动作 → AI 判断+置信度+理由 → 新闻/fusion 权重上下文 → 最终调参 vs 原始镜像 → 结果)。

**先做哪步**:① `copy-decision.ts`(judge + clamp,先 HL 路径,dev-first,flag off)→ ② 接 `copy-executor.ts`(enabled 时调它,否则镜像)→ ③ 决策记录到 ai_inferences/signal_trades → ④ dapp 决策卡 + 模式开关 → ⑤ testnet 验证 → ⑥ 灰度。**依赖**:训练闭环(task #7)产出的 `fusion_source_weights` 越准,调参越好(可并行加强)。

---

## 3. 多角色 subagent 执行模型(本 Goal 的"怎么做")

每个功能域 **F#** 过一条流水线,角色间用上游产物通信:

1. **审计 Auditor**:读 v2 dapp + 后端现状 → 该功能"已有什么/缺什么/坏在哪/端点是否 live"(如 `subscribeCreate` 标注 not-yet-live)。
2. **规划 Planner**:据审计 → 实现方案(dapp 改哪些组件 + 后端改哪些路由/表 + 双写镜像点),分解可执行步骤。
3. **开发 Developer**:据规划 → 具体改动(组件/hook/路由/迁移/outbox 镜像),**先 dev 验证不碰实盘**(遵循既定 dev-first 铁律)。
4. **测试 Tester**:据开发 → 测试方案 + 实测(dev 引擎 + 测试网),验证"接入新 UI 正常 + 双写两边一致 + 幂等"。
5. **客户操作 Customer-Ops**:从客户视角走查(充值→跟单→看持仓→看信号的完整旅程),UX/缺口/文案/语言(中英),回灌问题给规划。

**通信**:流水线下游收上游结构化产物(审计报告→规划→开发 diff→测试结论→客户走查);客户-ops 发现的问题回环成下一轮 Planner 输入。**最终 synthesis** 汇总每个 F# 的执行包 + 总进度。

**安全铁律(全程)**:dev → 测试网 → 实盘窗口由用户控;后端镜像加幂等;客户 Supabase service key 只在后端;绝不在实盘做探索性改动。

---

## 4. 里程碑

- **M1 双写地基(F14)** + **F6/F7/F8/F9(HL 跟单+信号,strategy 页)** 先打通(HL 是 strategy 核心)。
- **M2 Polymarket(F1–F5,trade/copy-trading 页)**。
- **M3 通用跟单 F11 + 信号中心 F12 + AI/PM Lab F13**。
- **M4 全量回归 + 客户旅程走查(中英)+ 实盘灰度**。
