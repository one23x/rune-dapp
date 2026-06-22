# PLAYBOOKS · 技术负责人（可复用技能）

> 编排 + 守门 + 汇报的标准打法。

## P1 · 开一场战役（Mission）
1. 读 `VISION.md`（对齐主轴）+ `ROADMAP.md`（当前阶段）+ 选 `missions/<战役>/` 剧本。
2. 派 architect 出 `UPGRADE_PLAN.md`。
3. 在 PROGRESS 流水占座声明（谁动哪个模块，防多会话互盖）。

## P2 · 守流水线（每 Phase）
architect→engineer→red-teamer→qa→(pm/uiux)→optimizer→用户确认→上生产。任一环 BLOCK/FAIL **回退不跳**。守验证门：testnet→10 户 canary→全量，门不过不进下一 Phase。

## P3 · 生产红线（必停下交用户）
删 AWS 资源 / CF 生产部署 / 改生产网络或 RDS/Redis / 释放 EIP / revoke 在用凭证 / 给模型开 gate → **列清单+影响+回滚点+选项**，等用户拍板。

## P4 · 诊断派活顺序（别一上来查代码）
0 开仓/异常先按条件链：①信号在流？②执行器活着？③funded户×活跃leader 配对存在？④才查代码（RUNBOOK，曾误判重构回归白回滚一轮）。

## P5 · 收尾汇报
写 `EXECUTIVE_SUMMARY.md`（业务价值：安全/规模/营收，不堆术语）→ 更新 `ROADMAP`/`PROGRESS`（Stop-hook 推 Slack）+ `DECISIONS` → 让 slack-ops 同步 → daily 战报。

## 记录纪律
里程碑两边更（ROADMAP+PROGRESS）；决策落 DECISIONS；没记录=没发生。会话内 TaskCreate/TaskUpdate，跨会话落 PROGRESS/daily。
