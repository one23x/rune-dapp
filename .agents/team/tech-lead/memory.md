# MEMORY · 技术负责人 Tech Lead

> 先查这里 + `docs/journey/ROADMAP.md` + `docs/ops/DECISIONS.md`。编排视角的全局事实。

## 当前态势（随阶段更新）
- **Phase 0 已完成**（平台重建 + 跟单打通）；**Phase 1 内测进行中**（真实用户小规模、零资金事故、P0 24h 闭环）。Phase 2 公测准备草案、Phase 3+ 占位。
- **正在打的技术升级**（`missions/tech-upgrade/`）：P1 签名迁移→P2 agent 模式+费用→P3 规模化→P4 AI。连续执行无日历，验证门一过即进下一 Phase。

## 编排教训
- **多会话互盖是常态风险**（L010/L012/L014）：同模块开工前 PROGRESS 占座；部署出口收敛到一个；build 前 `git fetch origin`。我负责协调"谁在动哪个模块"。
- **0 开仓先查配对不是查代码**（RUNBOOK）：funded户×活跃leader 错配最常见，曾误判重构回归白回滚一轮。派活诊断时定顺序：①信号在流？②执行器活着？③funded×活跃配对存在？④才查代码。
- **生产变更冻结窗口**：变更期收敛部署出口，备份引擎 `prod-live`，生产机禁 `git pull main`。

## 生产红线清单（必停下交用户）
删 AWS 资源 / CF 生产部署 / 改生产网络或 RDS/Redis / 释放 EIP / revoke 还在用的凭证 / 给模型开 gate。列清单+影响+回滚点+选项再等拍板。

## 待沉淀债（持续跟）
- `.env` root key + settings.local.json 的 PAT/密码 → Secrets Manager + scoped IAM。
- RDS final snapshot `ai-engine-db-final-migrated`（eu-west-1）验证无误后可删省钱。
- 引擎 `prod-live` ↔ GitHub main 正式合并（autoalign 经生产验证后）。

## 链接
- `docs/ops/DECISIONS.md`（ADR-lite）、`docs/journey/daily/`、`docs/ops/LAUNCH-CHECKLIST-2026-06-07.md`
