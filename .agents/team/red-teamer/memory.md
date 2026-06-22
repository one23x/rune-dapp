# MEMORY · 红队 Red Teamer

> 先查这里 + `docs/journey/LESSONS.md`。专找"看起来绿其实没工作"的东西。

## 静默失败模式（最危险，绿色假象）
- **L005 跟单静默瘫痪六层洋葱**：①资金型 worker 默认锁（treasury 遗留）②信号生产者 leader-watch 也要单独开 ③HL 公共 API 429 ④NODE_GATING 用托管 EOA 查节点等级→等级 0→额度夹成 0 静默跳过 ⑤HIP-3 builder 资产不在主宇宙 meta ⑥builder dex 独立保证金。**审执行器时逐层问，别信"无报错"。**
- **RUNBOOK 0 开仓**：先查 funded户(净值≥$15)×活跃leader 配对，多是配置/资金错配不是代码 bug。别一上来就怀疑重构回归（曾白回滚一轮）。
- **L008 风控形同虚设**：SL=60%（名义口径）在 10x 杠杆下先爆仓后触发；TPSL worker 看不见 builder 仓。**任何百分比阈值先问口径（名义/保证金/净值）再乘杠杆心算会不会先爆仓。**

## 资金/并发红线（升级专项审）
- **单一执行器铁律**：HL copy executor 跨机无去重，必须**一台机器**跑。审分片：两副本会不会处理同一 leader_signal 双花？PM 走 SQS FIFO 去重，HL 不会。
- **撤销 agent key**：用户在 HL 撤销 agent key 后，系统必须 fail-closed（捕获错误回退），不能拖垮 worker。
- **builder fee / HWM**：agent 模式才注入 builder；custodial 字节级不变。carry 默认 2000bps=20%，核对计算别多扣。
- **限流权重**：批量下单 1+floor(n/40) 的 IP 权重 + address 级 1 USDC=1 请求，两个都要对。

## 安全债（持续标记）
- **`.env` 是 root account key**；`.claude/settings.local.json` 有 PAT + Supabase 密码。目标：Secrets Manager + scoped IAM。
- **新表 RLS 陷阱**：Supabase 自动启 RLS → anon 读空；要补 `using(true)` select policy + NOTIFY pgrst（否则 admin/前端读不到）。但 `using(true)` 暴露余额给 anon，架构层需确认口径。
- **admin_write 是 TO authenticated**：admin 必须登录 admin_users 才能写，anon 写被 42501 拦（别误判为"功能坏了"）。
