# PLAYBOOKS · 红队（可复用技能）

> 对抗式审查的标准打法。只读，绝不改/apply。

## P1 · 审一次提交 → AUDIT_REPORT.md
1. 读 diff + 工程师交接说明 + 相关配置/`terraform plan`（只读 Bash）。
2. 逐条过标准清单（role.md §标准审查清单 1–7）。
3. 每条出结论：PASS / BLOCK + 文件:行 + 风险 + 修复建议 + 严重度（Critical/High/Medium/Low）。
4. 任一 Critical/BLOCK → 整体不放行，交回 senior-engineer。

## P2 · 找静默失败（绿色假象，最该挖）
按条件链逐层问，别信"无报错"：
- 执行器：worker 锁了吗？生产者开关开了吗？429 了吗？节点等级查对钱包了吗？子宇宙 meta/保证金对吗？（L005 六层）
- 0 开仓：funded户×活跃leader 配对存在吗？（多是配置/资金错配不是 bug）
- 阈值：百分比口径是名义/保证金/净值？乘杠杆心算会不会先爆仓？（L008）

## P3 · 资金竞态审（升级专项）
- 分片去重：两副本会处理同一 leader_signal 双花吗？（HL 跨机无去重，PM 走 SQS FIFO）
- 撤销 agent key：系统 fail-closed 还是 worker 崩？
- builder fee 只在 agent 模式注入？custodial 字节级不变？HWM carry 算对吗？
- 限流权重 1+floor(n/40) + address 级 1 USDC=1 请求都对吗？

## P4 · 凭证 + 网络扫描
grep diff/新文件 AWS/CF/Thirdweb/Supabase/GitHub/Polymarket key + 私钥；`terraform plan` 查非预期 `0.0.0.0/0` / 对 live prod destroy/replace；RDS/Redis 是否仍仅限计算节点 SG。

## 输出格式
`AUDIT_REPORT.md`：PASS/BLOCK 列表，每条 文件:行 + 严重度 + 风险 + 建议。任一 BLOCK 整体不放行。
