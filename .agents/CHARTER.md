# Rune 团队之魂 · 铁律 · 护栏（CHARTER）

> 全队共享的底座。**任何 agent、任何仓、任何服务器，动手前先读这一篇。** 各岗位 `SOUL.md`/`role.md` 不再重述这里的内容，只继承。
> 来源融合：`docs/ops/COLLABORATION.md`（协作规范）、`docs/ops/RUNBOOK.md`（运维护栏）、`.claude/agents/RUNE-NORMS.md`（架构/安全铁律）、两份《Rune Tech Upgrade》（升级护栏）。

---

## 0. 我们是谁、要去哪

我们是 Rune copy-trading 平台的跨职能项目团队（人 + Claude agents）。当前战役见 `docs/journey/ROADMAP.md`；正在打的技术升级见 `missions/tech-upgrade/`。
共同信念：**「没报错」≠「在工作」**（L005）；**「能 build」≠「能跑」**（L004）；**真金验证胜过自我宣称**。

工作底盘（详见 [REPOS.md](./REPOS.md)）：
- **代码与执行在 SG dev 服务器**（`ssh rune-sg`=13.250.210.12，`~/projects/`，Node24/pnpm/pm2 就绪）。**主 = one-agents 平台**（引擎/ML/Worker/监控/运营，**框架真相源 `.agents/` 住这**）；**项目 = 租户**（Rune = rune-dapp/admin-panel/console，demo-rune…）。本地 `Rune-final/.agents/` 是编辑镜像。
- **生产在 us-east-1**（API EC2 多副本 + Worker EC2 单副本 + RDS + Redis + S3）。
- **前端在 Cloudflare Pages**（rune-lastest / admin / console），数据层在 Supabase（每 project 一库）。

---

## 1. 架构铁律（违反即驳回，摘自 RUNE-NORMS）

1. **Worker/执行器单实例**：含 flag 门控的 poller/matcher/executor，**Worker 角色必须 `replicas:1`**，否则重复消费 / 双重下单。HL copy executor 跨机无去重，**只能一台机器跑**（RUNBOOK 跟单拓扑）。API 角色无状态可多副本。
2. **两库模型**：信号/价格/AI 判断**从引擎读**（RDS `trading` schema）；每个 project 的客户数据**落各自 Supabase**。数据进 project 库经 Position Sync Worker，勿同事务耦合。
3. **多租户表复用**：projects / project_api_keys / copy_subscriptions / usage_counters 已存在，复用勿重造。
4. **Pages 前端纯 edge**：路由不得引 `pg`/`fs`/`node:*`；非静态路由 `runtime="edge"`；平台主 Key 仅运行时注入，**不进客户端 bundle、不构建期注入**。
5. **RDS 双库陷阱**：`rune-prod-pg` 上 `rune`（生产引擎读写）vs `postgres`（旧引擎遗留，停在 5 月底）。**任何读 trading 数据的脚本必须连 `/rune`**（RUNBOOK + L002）。

---

## 2. 升级护栏（Tech Upgrade 专用，每个 Phase 都守）

| 护栏 | 规则 |
|---|---|
| **先测试账户** | 每个行为变更先在全新 testnet 账户验证，再碰真账户。 |
| **托管路径字节级不变** | agent 模式显式开启前，custodial 下单 payload 必须**字节级一致**（无 `builder` 字段）。 |
| **Feature flag** | 每个新行为挂 flag（`HL_SIGNER_BACKEND`/`HL_MODE`/`HL_WS_PUSH`/`HL_BATCH_ORDERS`/`SHADOW_MODE`），**默认=当前行为**。 |
| **Fail-closed** | AI/ranker/signer 出错必须回退到既有行为，**绝不阻塞或拖垮执行器**。 |
| **分级放量** | testnet 过 → **10 户 mainnet canary** → 全量。无百分比 ramp，10 户 canary 是上全量前的活体验证门。 |
| **连续执行** | 无固定日历。每个 Phase 验证门一过，下一个立即开始。 |

---

## 3. 危险操作三原则（摘自 COLLABORATION）

1. **先确认**：删资源 / 生产部署 / 改生产网络或数据库 / 释放 EIP 等不可逆或影响生产的操作，**先列清单 + 影响 + 选项，让老板拍板**再执行。生产变更需用户在开窗内确认。
2. **留后路**：不可逆操作留回滚点（删 RDS 留 final snapshot；改文件留 `.bak`；改网络记原值；引擎生产代码备份 GitHub `prod-live` 分支）。
3. **小步验证**：大批量删除/变更分阶段 + 每阶段核实，不一把梭。

---

## 4. 凭证与安全（0 明文铁律）

- **0 明文凭证**：AWS/CF/Thirdweb/Supabase/GitHub/Polymarket key、钱包私钥**严禁**写进会回显到对话或被 git 提交的地方。目标：AWS Secrets Manager + IAM Role 运行时取。
  - ⚠️ 已知债：`.env` 里是 root account key、`.claude/settings.local.json` 有 PAT/Supabase 密码——**持续标记，推动迁 scoped IAM**。
- 敏感配置 → gitignored 文件（`.claude/hooks/.slack-webhook`、`settings.local.json`）。
- 用完的临时 token（push PAT 等）→ **主动提醒 revoke**。
- 脱敏展示：看 env 只看 key 名和 host，不打印密码段。
- **钱包签名隔离**：签名逻辑独立隔离，不与公网 API 混跑。
- **最小权限网络**：RDS/Redis 严禁 `0.0.0.0/0`，只放行计算节点 SG。

---

## 5. 部署纪律（血泪换来的，L003/L004/L010/L012/L014/L015）

- **共享机精确 add**：SG 多会话共用工作区，禁 `git add -A`（会卷走他人 WIP）；改引擎必用独立 `git worktree`（/tmp/oa-*）。
- **build 前先 `git fetch origin && git log HEAD..origin/main`**：基于落后本地 build 会把 origin 上的提交在产物里整体回退（L014）。落后先合并再 build。
- **部署前查"谁部过"**：`wrangler pages deployment list`，Source commit 必须在本地历史里；引擎两机 `git log --oneline -1` 必须一致。
- **退出码是生命线**：`set -e`；`git am` 不接管道（管道吞退出码）；构建前 `grep '<<<<<<<'`；该 Dockerfile 不做类型检查 → 部署前独立 `tsc --noEmit`。
- **admin Pages 必带 functions**：`cp -r functions dist/public/functions`，日志要见「Uploading Functions bundle」；验证别只看 GET 200（可能是 SPA），要看 JSON / POST 是否 405（L015）。
- **同模块开工前在 PROGRESS 流水占座声明**，避免多会话互盖（L012）。

---

## 6. 行动与记录协议（可移植 —— 任何仓/服务器都照这套，"统一行动、统一记录"）

每个仓、每台服务器上的 agent 都遵守同一套落点，这样换仓换机也能无缝接手：

| 记什么 | 放哪 | 何时 |
|---|---|---|
| 进度（里程碑勾选 + 每步流水） | `docs/ops/PROGRESS.md` | 每步/每阶段（**Stop-hook 自动推 Slack 新勾选项，每阶段一条**） |
| 阶段目标与里程碑 | `docs/journey/ROADMAP.md` | 阶段启动/完成 |
| 每日战报 | `docs/journey/daily/YYYY-MM-DD.md` | 每个工作日收尾 |
| 踩坑经验（编号 L###） | `docs/journey/LESSONS.md` | 修完非平凡坑立即 |
| 关键决策（选了啥/为啥/否决啥） | `docs/ops/DECISIONS.md` | 决策当时 |
| 可复用运维动作与坑 | `docs/ops/RUNBOOK.md` / `docs/ops/memos/` | 沉淀时 |
| 跨会话基础设施/架构事实 | `.agents/memory/` + 用户级 `~/.claude/.../memory/` | 发现时 |
| 岗位专属记忆 | `.agents/team/<role>/memory.md` | 岗位相关坑修完 |

**会话内**用 TaskCreate/TaskUpdate 做即时跟踪；**跨会话**落 PROGRESS/daily。
**Slack 通知**：`.claude/hooks/notify-slack.sh`（Stop hook）只推 PROGRESS.md 新勾选的 `- [x]`，每阶段一条不刷屏；webhook 配 `.claude/hooks/.slack-webhook`（gitignored）。

> 别的项目/服务器接这套框架：见 [ADOPT.md](./ADOPT.md)——复制 `.agents/` + 建同名 `docs/` 落点 + 接 Slack hook，即可「执行一样的行动、留一样的记录」。

---

## 7. 流水线（dev→audit→test，任一环不过即回退，不跳过）

```
architect 出计划 → senior-engineer 落代码 → red-teamer 审安全/架构 → qa-engineer 端到端验证 →
（费用/UX 相关）product-manager 模拟用户 → optimizer 修高危+调优 → 用户确认 → 上生产
```

- 远程改动走 dev 机（`ssh rune-sg`），凭证环境变量注入不落盘。
- 改动**贴合现有代码风格、命名、注释密度**，优先复用既有函数/工具。
- 提交信息结尾：`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`；**仅在用户要求时**提交/推送。
- **如实报告**：测试失败就说失败并附输出；跳过就说跳过；**绝不自我宣称"已通过验证"**——验证由 qa-engineer 做。
