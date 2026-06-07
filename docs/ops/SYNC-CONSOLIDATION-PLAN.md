# 同步脚本整合计划:trading-sync (.mjs) → one-agents 后端 worker fleet

> 状态:**计划(未开工)**。前置 = split-brain reconcile。创建 2026-06-07。
> 背景见 memory `rune-hl-display-fixes-and-split-brain` 与本仓库 `scripts/trading-sync/`。

## 为什么做

当前 4 个同步任务以独立 pm2 `.mjs` 脚本跑在 **API 机 10.0.1.159**(`~/trading-sync/`),scp 直部署、不版本化、各自重造 HL 客户端逻辑。真正该归属 **one-agents 后端 worker fleet**——那里已有完整 HL 客户端(`getUserStateForDex`/`getUserStateMerged`/`listBuilderDexs`/`getUserFills`/`getMidsCovering`,带限流/缓存/builder dex)、RDS + HL API + Supabase 三方可达、以及现成的 `hl-supabase-direct-sync.ts` 同步 worker + ROLE 门控 fleet。

**不选 Supabase Edge Functions**:`sync.mjs` 要读私网 RDS(10.0.12.75),Edge Function 在 Supabase 云够不到;且 Edge Function 有执行时长上限(hl-marks 一轮 ~40s、随 follower 线性增长会撞墙)、冷启动无缓存(HL 429 更易触发)、要重写 Deno 并重造 HL 客户端。

## 目标架构

| 机器 | ROLE | 职责 |
|---|---|---|
| backend/API 机 10.0.1.159 | `api` | 纯 HTTP:`/v1/hl/account`(已聚合 builder dex)、`/users` 等。**不跑 pollers/sync** |
| worker 机 10.0.2.125 | `worker` | copy-executor + 所有 pollers + **新增 4 个 sync worker** + RDS→Supabase |

> ⚠️ 现状 API 机 `ROLE=all`(也跑 worker)→ 与 worker 机重复执行(重复下单风险)。整合**必须**把 API 机改 `ROLE=api`,sync/pollers **只在 worker 机单实例**跑。

## 设计原则

1. **单一版本化代码**(one-agents),容器部署,复用现成 HL 客户端
2. **单实例**:sync flag 只在 worker 机开,API 机永不开 → 杜绝重复写 / HL 429 风暴
3. **手动层零侵犯**:worker 只动 `source='sync'` / 真实表,绝不碰 `trading_*_overrides` / `trading_*_manual_positions` / `source='manual'` 的 `trade_records` / `trading_record_hidden`(沿用现脚本守卫)
4. **additive flag + 暗发 + 并行对账**后再切,可秒回滚

## 脚本 → worker 映射

| 现 pm2 脚本 | 数据流 | 落成 worker | flag |
|---|---|---|---|
| `sync.mjs` | RDS `trading.*` → Supabase `trading_*`(8 表) | 扩展 `hl-supabase-direct-sync.ts` | `SUPABASE_TABLE_SYNC_ENABLED` |
| `hl-marks.mjs` | HL allMids(主+builder)→ `trading_mark_prices` | `hl-marks-sync` | `HL_MARKS_SYNC_ENABLED` |
| `hl-fills.mjs` | RDS订阅→follower→HL userFills→ `trading_trade_records`(close) | `hl-fills-sync` | `HL_FILLS_SYNC_ENABLED` |
| `hl-positions.mjs` | follower→HL clearinghouseState(主+dex)→ `trading_hl_real_positions` | `hl-realpos-sync` | `HL_REALPOS_SYNC_ENABLED` |

> 后端里 follower 列表直接读 **RDS** `trading.hl_copy_subscriptions`(比脚本现在绕 Supabase 读更直接)。Supabase 写走 `CUSTOMER_SUPABASE_DB_URL`(`hl-supabase-direct-sync` 已在用)。
> `node-access-sync`(节点门控同步,另一 pm2)是否一并折入 = 待定(见决策 3)。

## 阶段

### Phase 0 — Reconcile split-brain(前置)
- 扫密钥 → API 机 `gas-grant-prod` 7 提交 commit→分支→PR→合 main(解 `hyperliquid.ts`/`config.ts` 冲突;含本次 `088ce93` buildAccount 聚合)
- worker 机未提交(`hl-supabase-direct-sync.ts` + config.ts/server.ts/constants.ts)→ commit 进 main
- 两台对齐统一 main、`docker compose -f docker-compose.engine.yml build/up backend`
- **API 机改 `ROLE=api`、worker 机 `ROLE=worker`**
- 验证:无重复下单、`/v1/hl/account` 仍聚合、worker 机现在**含 HIP-3 客户端**(positions/fills worker 的前提)

### Phase 1 — 写 4 个 worker(代码,flag 默认关)
- Supabase pg pool helper(读 `CUSTOMER_SUPABASE_DB_URL`)
- 每个 worker:复用 HL 客户端 + 注册进 fleet(ROLE 门控 + registry 监控)+ interval env
- 守卫:只写 `source='sync'`/真实表;realpos worker 报错(429)时跳过该 follower **不删**
- typecheck + 单测;合 main、部署(flag 全关 → 零行为变化)

### Phase 2 — 暗发 + 并行对账(逐个切)
- worker 机开**一个** flag(先 `HL_MARKS_SYNC_ENABLED`)→ 与同名 pm2 脚本**并行**(幂等 upsert 写同样行)
- 对账 N 轮:Supabase 行数/新鲜度一致 → **停对应 pm2 脚本**,保留 worker
- 逐个推进 marks → fills → realpos → table-sync;盯 HL 429(单实例后应更稳)

### Phase 3 — 切换完成 + 退役
- 全部走后端 worker;pm2 脚本停 + 移出 `pm2 save` / `~/.pm2/dump.pm2`
- `.mjs` 在 repo/机器留一段时间作应急回退,稳定后归档
- 更新 memory / RUNBOOK

## 风险与回滚
- **单实例**:flag 只 worker 机开,API 机永不开 → 防双写 / 429
- **回滚**:flag 关 + 重启对应 pm2 脚本(整个 Phase 2 保留脚本作 fallback)
- **凭证**:确认 worker 机 .env 有 `CUSTOMER_SUPABASE_DB_URL`(RDS 已有)
- **手动层**:任何 worker 不得 delete/ update `source='manual'` 或 override/manual 表

## 待拍板决策
1. **API 机 `all→api`**(停跑 workers)—— 确认 API 机不需 pollers?(要 HA 需另设单实例选主,现为单机)
2. **镜像 `trading_hl_positions`** 同步:真实持仓已取代它做显示,Supabase 这张是否继续同步?(console/admin 可能在用 → 默认保留)
3. **`node-access-sync`** 是否一并折入 worker?

## 参照
- 现脚本:`scripts/trading-sync/{sync,hl-marks,hl-fills,hl-positions,apply-sql}.mjs` + `hl-real-positions.sql` / `hl-view-swap.sql`
- 后端复用点:`backend/src/exchanges/hyperliquid.ts`(HL 客户端)、`backend/src/sync/hl-supabase-direct-sync.ts`、`backend/src/sync/position-sync.ts`、ROLE 门控 fleet
- 视图:`v_wallet_open_positions` HL 段读 `trading_hl_real_positions`(2026-06-07 改);手动层在 dapp `applyHlAdjustments` 顶上叠加
