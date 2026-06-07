# Reconcile 执行单:split-brain → 统一 main

> P0 of `SYNC-CONSOLIDATION-PLAN.md`。基于 2026-06-07 三个并行只读 agent 的产出。
> 现状:**API 机 10.0.1.159 = `gas-grant-prod`(7 提交未上 GitHub)** / **worker 机 10.0.2.125 = `main` + 未提交**。
> 结论:**干净合并、无密钥、1 个迁移**。可执行。⚠️ 动生产 + 真实资金 flag,逐步确认。

## 0. 并行准备结论(已验证)
- **密钥**:7 提交 + worker 改动**零硬编码密钥**(rune-audit PASS)。两处 hex = HL 公开 token-id / EIP-712 零地址,非密钥。凭证全 env。
- **冲突**:`git merge-tree origin/main gas-grant-prod` = **零冲突**(tree `cb20473`)。唯一重叠 `config.ts` 三方不同区段纯新增,取并集。
- **迁移**:仅 `backend/drizzle/0030_gas_grants.sql`(建 `trading.gas_grants`,IF NOT EXISTS 幂等)+ `meta/_journal.json` idx 30。

## 1. 被带入 main 的内容
**gas-grant-prod 7 提交**(已 commit,在 API 机):
| # | commit | 内容 | 注意 |
|---|---|---|---|
| 1 | e55cc70 | gas-grant faucet(`POST /v1/rune/gas-grant`)+ 迁移 0030 + 6 个 GAS_GRANT_* env | **动真实资金**,默认关 |
| 2 | 286c85c | `HYPERLIQUID_INFO_URL`/`_TESTNET_INFO_URL` /info 分流 | 未配=零变化 |
| 3 | fd5f464 | NODE_GATING 等级用主人钱包解析 | **生产"跟单不执行"根因修复,优先级高** |
| 4 | ec13b2f | HIP-3 builder DEX 支持(parseCoin/getUserStateForDex/getMidsCovering) | 4~7 一套,勿拆 |
| 5 | 343fd4c | HIP-3 独立保证金 `ensureDexCollateral`(transferToDex 签名) | **动真实资金/链上划转** |
| 6 | d7bf640 | `getUserStateMerged` + TP/SL/supervisor 保护 builder 仓 | flag 关零变化 |
| 7 | 088ce93 | buildAccount 跨 dex 聚合(`/v1/hl/account`) | 已部署在 API 机 |

**worker 机未提交**(成套带,缺一启动报错):
- `config.ts`:+`HL_SUPABASE_SYNC_ENABLED`(默认false)/`CUSTOMER_SUPABASE_DB_URL`(默认空)/`HL_SUPABASE_SYNC_INTERVAL_S`(默认30)+(gas-grant 块,与 commit1 重复→**去重**)
- `polymarket/constants.ts`:`CLOB_HOST` 读 `process.env.POLYMARKET_CLOB_HOST ??` 公网(下单+auth 走 relay 绕地封)
- `server.ts`:worker fleet 启动 `startHlSupabaseSync`
- `sync/hl-supabase-direct-sync.ts`(新文件):RDS `trading.hl_copy_subscriptions`/`hl_positions` → 客户 Supabase 同名表(只读镜像,不动资金)。依赖 `db/client.js` 的 `sqlClient` 导出 + `postgres` 包

## 2. 执行步骤

### Step A — gas-grant-prod 上 GitHub(API 机)
若 API 机有 push 凭证(PAT):
```
ssh API: cd ~/one-agents && git push origin gas-grant-prod
```
若无 push 凭证 → bundle 到 dev 机:
```
ssh API: cd ~/one-agents && git bundle create /tmp/ggp.bundle origin/main..gas-grant-prod
scp API:/tmp/ggp.bundle /tmp/
dev:  cd one-agents && git fetch /tmp/ggp.bundle gas-grant-prod:gas-grant-prod
```

### Step B — 在 dev 机 reconcile 进 main
```
dev: git checkout main && git fetch origin && git reset --hard origin/main
     git merge gas-grant-prod        # merge-tree 已证干净;config.ts 自动并集
```
再**手工补 worker 三件套**(worker 的 config patch 基线不同,别整体 apply,只加增量):
- config.ts 末尾加 3 个 `HL_SUPABASE_SYNC_*` key(gas-grant 块已由 merge 带入,**勿重复**)
- 复制 `/tmp/reconcile/worker/untracked/backend/src/sync/hl-supabase-direct-sync.ts`
- constants.ts 的 `CLOB_HOST` 改动 + server.ts 的 `startHlSupabaseSync` 注册(单侧,直接打)
- 确认 `db/client.js` 导出 `sqlClient`
```
dev: (cd backend && npx tsc --noEmit | grep -c "error TS")   # 仅看是否新增错误
     git add <指定文件,非 -A,排除任何 .env>
     git commit -m "reconcile: gas-grant-prod 7 commits + worker HL-supabase-sync/CLOB-relay 入 main"
     git push origin main
```

### Step C — 两台部署统一 main
⚠️ 部署前**再确认 worker 机无残留未提交**(已并入则干净)。
```
两台各自: cd ~/one-agents && git fetch origin && git checkout main && git reset --hard origin/main
迁移(只一台跑): docker compose -f docker-compose.engine.yml run --rm --no-deps backend pnpm db:migrate   # 0030
两台: docker compose -f docker-compose.engine.yml build backend
两台: docker compose -f docker-compose.engine.yml up -d --no-deps backend
```
worker 机看日志 `worker fleet started`;API 机 `Server listening`。

### Step D — ROLE 分工(消除 split-brain 重复执行)
- **API 机 .env `ROLE=api`**(只 HTTP,不跑 worker/pollers)→ 重启容器
- **worker 机 .env `ROLE=worker`**(跑所有 pollers/executor)
- 验证:copy-executor 只在 worker 机跑(`docker logs` 看 matcher/executor 只一台有);**无重复下单**(盯一阵下单日志)。

### Step E — 配 env(部署前两台 .env)
| key | 值 | 哪台 |
|---|---|---|
| GAS_GRANT_* (6) | 默认即可,`GAS_GRANT_ENABLED=false` 先关 | 两台(需 `TREASURY_SERVER_WALLET` 才生效) |
| HYPERLIQUID_INFO_URL / _TESTNET | 可空(零变化)或填只读节点 | API 机 |
| HL_SUPABASE_SYNC_ENABLED | 现状=true(worker 已在跑) | **worker 机** |
| CUSTOMER_SUPABASE_DB_URL | (现有值,勿入 git) | worker 机 |
| POLYMARKET_CLOB_HOST | (现有 relay 值) | 下单的那台(worker) |

## 3. 验证清单(部署后)
- [ ] `/v1/hl/account?address=0x522226…` 仍聚合(净值含 builder dex)
- [ ] copy-executor 只在 worker 机跑,无重复下单
- [ ] gas-grant 关:`POST /v1/rune/gas-grant` 返回 503/disabled
- [ ] worker 机 HL_SUPABASE_SYNC 仍同步(`trading_hl_copy_subscriptions` synced_at 新鲜)
- [ ] 跟单仍执行(NODE_GATING 等级修复在 main 后,custodial 开仓不再静默跳过)
- [ ] `trading.gas_grants` 表已建(迁移 0030 跑过)

## 4. 风险与回滚
- **真实资金 flag**(gas-grant / ensureDexCollateral):保持默认关 / 验证后再开;ensureDexCollateral 仅 builder 开仓触发,已在 API 机 prod 跑过。
- **ROLE 改**:改错(两台都 worker)→ 重复下单。改前确认只 worker 机有 executor flag。
- **回滚**:Step C 前各机 `git reset --hard <旧 HEAD>` + rebuild(API 旧=d7bf640/088ce93,worker 旧=47340cc+stash);镜像 `rune-backend:rollback`。Step B 推 main 前不影响 prod。
- **db/client.js sqlClient 导出**:带 hl-supabase-direct-sync 前必确认,否则 worker 启动 crash。

## 5. 原料位置(本次并行准备产出)
`/tmp/reconcile/`(dev 机):`api/api-commits.patch`(7提交)、`api/merge-tree.txt`、`api/*SIDE__*config.ts.diff`、`worker/worker-uncommitted.diff`、`worker/untracked/…/hl-supabase-direct-sync.ts`。
