# PLAYBOOKS · 基础设施架构工程师（可复用技能）

> 来自爱尔兰→美东大迁移沉淀的运维剧本（`docs/ops/RUNBOOK.md`）。换机换区照这套。

## P1 · 基础设施盘点（只读，先摸清再动）
- EC2：`describe-instances`（角色/AZ/vCPU）；RDS/Redis：`describe-db-instances`/`describe-replication-groups`（Multi-AZ？公网？SG？）。
- 网络：VPC/子网/路由表/NAT/IGW/SG；查 `0.0.0.0/0`；peering 状态。
- 配额：vCPU（Worker EC2 L-1216C47A）、SageMaker 训练配额。
- **aws CLI 用 `~/.local/bin/aws`**（Homebrew 版因 pyexpat 崩）；脚本里 `--region` 直写不要用变量（沙箱不 word-split）。

## P2 · 删除整个 VPC 栈（依赖顺序，别乱删）
1. 应用层（可并行）：Lambda、EC2 terminate、RDS delete（**先关 deletion protection** + 留 `--final-db-snapshot-identifier`）、ElastiCache、SQS/SNS、CloudWatch、S3（版本桶先删 version）、EBS 快照。
2. 等 EC2/RDS/Cache 删完 + ENI 释放（轮询，RDS ~10min）。
3. NAT gateway（按小时收费，优先）→ 等 deleted。4. 释放 EIP。5. 子网。6. IGW detach+delete。7. 路由表（留 main）、SG（**互引的先 revoke 规则再 delete**）。8. VPC。

## P3 · 跨私网迁 RDS（逻辑迁移进现有库）
临时给旧库开公网（`--publicly-accessible`）→ **改子网路由 0.0.0.0/0 NAT→IGW**（用完改回 NAT）→ SG 放行源 IP 5432 → docker `postgres:18` `pg_dump -Fc | pg_restore --no-owner --no-acl`（版本匹配）→ 撤销公网+SG+路由。

## P4 · 不稳 EC2（sshd 反复挂起）
症状：running + TCP 22 通但 banner timeout + uptime 冻结。根因常是 `acpid` 拦 power key 关机。根治：`systemctl mask acpid + sleep/suspend/hibernate targets`。临时：`reboot-instances` 给干净窗口 → 每 3s 抢 ssh → `setsid <长任务> &` 脱离会话。

## P5 · EBS 取 stopped 机器文件（绕坏 sshd）
`stop` → `create-snapshot` → `copy-snapshot` 跨区 → `create-volume`（同 AZ）→ `attach /dev/sdf`（Nitro=`/dev/nvme1n1`）→ mount 最大分区读文件 → 用完 umount/detach/delete。

## P6 · 部署拓扑铁律
- **Worker 单实例**：含执行器/matcher 的 Worker 角色 `replicas:1`（HL executor 跨机无去重）。API 角色无状态可多副本。
- 引擎生产：`docker compose -f docker-compose.engine.yml up -d --no-deps --force-recreate backend`；两机 `git log -1` 必须一致；生产机禁 `git pull main`，备份 `prod-live`。

## 验证清单
plan 无非预期 `0.0.0.0/0` / 无 live prod 裸 destroy / 快照与原值已留 / Worker 单实例 / 红队 PASS / 用户确认。
