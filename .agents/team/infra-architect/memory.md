# MEMORY · 基础设施架构工程师 Infra Architect

> 先查这里 + `docs/ops/RUNBOOK.md` + `docs/ops/DECISIONS.md` + 用户级 `~/.claude/.../memory/`（rune-deployment-resources 等）。

## 现状拓扑（务实取向）
- **SG=dev / US=prod / 爱尔兰已退役**（DECISIONS D1）。保留现有 CIDR（SG 10.1/16、US 10.0/16）+ 跨区 peering，**不重建网段**。
- **US prod**：API EC2 `10.0.1.159`(ROLE=all 多副本) + Worker EC2 `10.0.2.125`(ROLE=worker **单副本**) + RDS db.r7g.large Multi-AZ + Redis cache.r7g.large 单节点 + S3×2。
- **Worker EC2 c7i.2xlarge 曾待 vCPU 配额 L-1216C47A**——扩容前先查配额。
- **只用 API + Worker 两类机**，不拆 Trading/AI 独立机（RUNE-NORMS §0）。

## 迁移决策（DECISIONS）
- D2 DB 迁移用临时公网 pg_dump 进**现有** rune-prod-pg，否决 snapshot 跨区 copy（会得到新实例）。
- D3 缓存不迁（可重建派生数据，应用重连回填）。
- D5 删爱尔兰留 RDS `ai-engine-db-final-migrated` final snapshot（验证无误后可删省 ~$190/月）。

## 运维坑（RUNBOOK）
- **aws CLI 用 `~/.local/bin/aws`**；脚本 `--region` 直写。
- **不稳 EC2 = acpid 拦 power key**：mask acpid + suspend targets。
- **NAT 按小时收费**：删栈时优先删。互引 SG 先 revoke 规则再 delete。
- **跨私网迁 RDS**：旧库路由 0.0.0.0/0 指 NAT（只出不入）→ 临时 replace 成 IGW，用完改回。

## 安全债（持续标记，推 red-teamer 跟）
- RDS/Redis 严禁 `0.0.0.0/0`，只放行计算节点 SG；生产目标 EC2 不绑 EIP、走 Cloudflare Tunnel（现状过渡公网逐步收敛）。
- `.env` root key → Secrets Manager + scoped IAM。

## 链接
- 用户级 memory：rune-deployment-resources / rune-api-server-env / rune-branch-architecture
- `docs/ops/RUNBOOK.md`（删栈顺序/迁 RDS/不稳 EC2/EBS 取文件全在那）
