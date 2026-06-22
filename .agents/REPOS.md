# 作战地图 · 主平台 + 项目拓扑（REPOS）

> **第一性区分：主（one-agents 平台） vs 项目（跑在平台上的租户，Rune 只是其一）。**
> - **主 = one-agents**：一套引擎 / Worker Fleet / ML / 监控面板 / 运营中枢 / AWS 主库，**服务所有项目**。
> - **项目 = 平台上的租户皮肤**：各自前端 + 各自 Supabase + 各自会员。Rune、demo-rune… 都是项目。
>
> 这条线就是**两库模型**：信号/价格/AI 判断/执行在**主库**（RDS `trading`，one-agents 读写）；每个项目的客户数据落**各自 Supabase**。
>
> 铁律：**代码与执行在 SG dev 服务器**（`ssh rune-sg`=13.250.210.12，`~/projects/`），**生产在 us-east-1**，前端在 CF Pages。本地 `Rune-final/` 是镜像 + 框架编辑入口；**框架真相源 = `one-agents/.agents/`（主）**，项目去 adopt（见 ADOPT.md）。不在本地副本上 build 部署（常落后/缺二进制，L014）。

---

## 机器拓扑（已 AWS 核实 2026-06-16）

| 环境 | 位置 | 角色 | 实况 |
|---|---|---|---|
| **SG dev** | `ssh rune-sg`=13.250.210.12（ap-southeast-1） | 开发+构建+测试 | `rune-prod-dev` c7i.2xlarge / 10.1.1.180；仓在 `~/projects/`；引擎 pm2 `one-engine` :4000 |
| **US prod API** | us-east-1a | ROLE=all/api（多副本） | `rune-prod-api` c7i.xlarge / 10.0.1.159 / 52.86.40.41 |
| **US prod Worker** | us-east-1b | ROLE=worker（**单副本**） | `rune-prod-worker` c7i.2xlarge / 10.0.2.125 / 98.90.179.97 |
| **主库 RDS** | us-east-1 | 共享主库（`trading`） | `rune-prod-pg` db.r7g.large · postgres 18.3 · Multi-AZ · **非公网** ✓ |
| **缓存 Redis** | us-east-1 | 共享缓存 | `rune-prod-redis-001` cache.r7g.large · redis 7.1.0 |
| **CF Pages** | Cloudflare（acct 303796ff…） | 各项目前端 | 每项目独立 project；部署前必 `deployment list` 防互盖 |
| **项目数据 Supabase** | 托管 | 每项目一库 | RLS public_read + admin_write；新表补 select policy + NOTIFY pgrst |

> ⚠️ 安全债（red-teamer 持续标记）：两台 prod EC2 都绑公网 IP（应逐步收敛走 CF Tunnel）；AWS 用 root key（账号 113725432444）。

---

# 主 · one-agents 平台（服务所有项目）

### 主-1. `one-agents/backend` — 引擎（多租户）
- **是什么**：Fastify 后端 + flag 门控的 poller/matcher/executor + 签名。**所有项目共用这一套引擎**。pnpm monorepo。
- **SG dev**：`~/projects/one-agents`（**框架真相源 `.agents/` 住这**）。生产 Docker `one-agents-backend`，`docker compose -f docker-compose.engine.yml ... --no-deps backend`；备份 GitHub `prod-live`，**生产机禁 `git pull main`**。GitHub `one23x/one-agents`。
- **主要岗位**：senior-engineer · red-teamer（签名/网络/单实例铁律）· data-engineer（主库 schema）· infra-architect（容量/分片）· qa。
- **关键文件**（升级触点）：`engine/signer.ts`·`engine/v3-client.ts`、`db/schema.ts`·`exchanges/hyperliquid.ts`、`copytrade/matcher.ts`·`fee-settlement.ts`、`hl-ws-supabase-sync.ts`、`db/client.ts`（PgBouncer `prepare:false`）。

### 主-2. `one-agents/ml` — 模型训练 / 推理
- ranker 训练管线（export/train）+ SageMaker/ONNX 推理。服务所有项目的 AI 跟单。
- **主要岗位**：ml-trainer（训练）· optimizer（推理接线/延迟）。

### 主-3. Worker Fleet — pm2 常驻进程
- `hl-account-state` / `hl-marks` / `pm-positions-sync` / `sync` / `slack-agent` 等；worker 机 systemd timer（`ranker-eval` / `auto-subscribe-quality` / `copy-pnl-report`）。**单实例铁律**：HL executor 跨机无去重，只能一台机器跑。
- **主要岗位**：data-engineer（同步脚本）· infra-architect（拓扑/IP 分片）· ml-trainer（ranker timer）。

### 主-4. 监控面板 dashboard（属 one-agents，✅ MVP 已上线 2026-06-16）
- **是什么**：one-agents 平台级监控面板，**跨所有项目**：站点状态 + Worker/pm2 健康 + 引擎指标 + AI shadow/drift。不是某个项目专属。
- **MVP 实况**：Worker `https://rune-dashboard.one-deploy.workers.dev`（HTML 面板 + `/api` + `/push` + `/health`，KV 存快照，dark/amber 移动响应）；收集器 box pm2 `dash-collect`（每 5min）。脚手架 `.agents/tools/dashboard/`（待迁出为独立 repo `one23x/rune-dashboard`）。
- **已接真实**（收集器 dev box，经 `ssh worker`/`ssh synchost`/`docker exec node` 取 prod）：① 站点 ping ② **API 429**（`docker logs` 30m + 分级）③ **信号源 leader-watch**（引擎 ws 心跳 pushes/signals/filtered）④ **引擎角色 Roles**（leader-watch/signals-consumer/matcher/**copy-executor** on-off flags）⑤ **引擎指标 RDS `rune`**（跟单账户/HL订阅/近1h信号/今日API用量 + **ranker shadow AUC/edge_pnl** 漂移；经容器内 postgres-js SSL 查，dev box 不可达 RDS）⑥ **容器 Fleet** + **systemd 定时器**（ranker-eval/auto-subscribe/copy-pnl）⑦ **Fleet pm2 = synchost 14 进程**（trading-sync/hl-marks/hl-account-state/pm-positions-sync/account-monitor/hl·pm-deposits·withdrawals…）⑧ 矢量记忆 `/health` ⑨ **优化建议**（实时告警，内嵌 RUNBOOK/optimizer/ml-trainer 经验：**executor-off→不开仓**、429偏高→IP分片、ranker AUC<0.5→保持shadow、进程非online→查单实例）。
- **拓扑实况（2026-06-16 监控发现）**：信号源/消费/matcher 在 prod worker `one-agents-backend` 容器（ON）；**`HL_COPY_EXECUTOR_ENABLED=false`**（执行器关，dashboard 已告警）；sync fleet 在 **prod API 机 synchost**（pm2 14 进程）；ML 无常驻 worker（SG 仅 `one-agents/ml` 代码库；训练=云 SageMaker serverless + prod worker `ranker-eval` systemd timer 跑 ml-runner）。
- **待接**：站点巡检对接 Slack `ops-site-monitoring`（收集器 `SLACK_WEBHOOK` 机制就绪，待填 webhook）；迁出独立 repo `one23x/rune-dashboard`；引擎错误/429 也可入库做趋势。
- **主要岗位**：senior-engineer（重建/迭代）· uiux-engineer（面板 UIUX）· infra-architect（指标源/告警）· data-engineer（引擎 DSN/指标落库）· slack-ops（巡检对接）。

### 主-5. `slack-agent` — 公司运营中枢（跨项目）
- Bolt + Claude，读写公司运营 Lists（工资/报销/客户/订阅/各项目进度）。设计见 `docs/ops/SLACK-WORKSPACE-DESIGN.md`。
- **主要岗位**：slack-ops。

### 主-6. AWS 基础设施
- 主库 RDS `rune-prod-pg`(`trading`) · Redis · EC2 api/worker · VPC/peering · S3。`infra/terraform/`。
- **主要岗位**：infra-architect · data-engineer · red-teamer（网络/破坏性审）。

---

# 项目 · 跑在 one-agents 平台上的租户

> 每个项目 = 一套前端皮肤 + 独立 Supabase（客户数据）+ 会员。共用主平台的引擎/ML/监控/运营。

### 项目-A. **Rune**（当前主力项目）
三个前端仓 + 自己的 Supabase：
- **rune-dapp**（= CF `rune-lastest`，包名 `rune-final`）：客户 dapp。`~/projects/rune-dapp`。纯 edge；会员展示走虚拟账本、链上 explorer 跳转恒 null 防穿帮。主岗：uiux-engineer · senior-engineer · product-manager · qa。
- **rune-admin-panel**（CF `rune-admin-mainnet`）：运营后台。`~/projects/rune-admin-panel`。**部署必带 `functions/`**（L015）；admin 必登录 `admin_users` 才能写。主岗：senior-engineer · uiux-engineer · red-teamer（RLS/admin_write）· data-engineer · qa。
- **rune-console**（CF 独立 project）：策略包控制台。`~/projects/rune-console`。历史与 dapp 脱节 → `pack_key` 落库；缺移动端。主岗：senior-engineer · architect（共享表）· uiux-engineer。
- **Rune 数据真相**：钱包三键 smart/hl_master/`login_wallet`（视图按 login_wallet 绑，L002）；会员账本虚拟（`member_ledger` 推导，真锚=充值）；统计双轨 `sync_*`(真实) vs show（L013）。

### 项目-B. `demo-rune` — 另一个 one-agents skin
- 独立 portable One-Agents 皮肤（vendored `@one-agents/*`）。`~/projects/demo-rune`。见 `.agents/HANDOFF.md`。

### 项目-C. 其它项目（按需登记）
- 平台上若有 football-edge / coinmax 等其它租户项目，按本节同样格式登记（前端仓 / Supabase / 主岗）。

---

## 部署 / 记录落点速记

| 层 | 仓/app | 构建机 | 生产目标 | GitHub | 记录落点 |
|---|---|---|---|---|---|
| 主 | one-agents（引擎/ML/worker） | SG `~/projects/one-agents` | US prod Docker | one23x/one-agents（+`prod-live`） | 全栈统一 `docs/`（CHARTER §6） |
| 主 | dashboard（监控，待重建） | SG（待建） | CF 独立 project | one23x/...（待定） | 同上 |
| 主 | slack-agent | — | US prod pm2 单副本 | one23x/one-agents | 同上 |
| 项目·Rune | rune-dapp | SG `~/projects/rune-dapp` | CF rune-lastest | one23x/…（本仓） | 同上 |
| 项目·Rune | rune-admin-panel | SG `~/projects/rune-admin-panel` | CF rune-admin-mainnet | one23x/rune-admin-panel | 同上 |
| 项目·Rune | rune-console | SG `~/projects/rune-console` | CF 独立 project | one23x/rune-console | 同上 |

> **框架真相源 = `one-agents/.agents/`（主）**；项目仓按 [ADOPT.md](./ADOPT.md) 从主同步或引用。记录落点全栈同名（CHARTER §6），换主/换项目都一致。
