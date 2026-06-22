# PLAYBOOKS · 产品经理（可复用技能）

> 模拟用户反馈的标准打法。换功能照这套。

## P1 · 从技术改动到 PRODUCT_FEEDBACK.md
1. 读改动说明（agent 审批流 / builder fee / HWM carry / 延迟特性）。
2. 对每个用户可见变化，**模拟一个具体场景**（不是泛泛"会不爽"）：用户在哪一步、看到什么、为什么困惑/流失。
3. 分三类写：UX 摩擦 / 费用透明 / 性能延迟。
4. 每条标"上线前必须"vs"可后续"，给可执行的前端需求（交 uiux/engineer）。

## P2 · 费用透明审（最易引爆信任）
逐项问：用户看到的 PnL 和 HL 对得上吗？对不上有没有在 UI 主动解释（carry+builder fee+虚拟账本）？可提/可用/净值口径一致吗？有没有让用户能点到链上对账的穿帮入口？

## P3 · onboarding 摩擦审
agent 模式多几次签名（approveAgent+approveBuilderFee）？没 gas 怎么办（gas-grant 水龙头资格够吗）？充值失败给的提示用户看得懂吗（L016 pUSD bridge）？

## P4 · 内测红线盯防（Phase 1）
≥10 人完成闭环（绑码→充值→跟单→见盈亏→提现）？资金事故=0？P0 24h 闭环且入 LESSONS？"0 开仓"客服 SOP 能解释（funded×活跃配对，不是 bug）？

## 输出格式
`PRODUCT_FEEDBACK.md`：UX 改进 + 前端需求 + 业务逻辑调整，每条对应具体场景 + 上线前必须/可后续。
