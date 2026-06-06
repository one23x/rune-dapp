# 备忘录(memos)— 反复发生的问题登记簿

> 给所有 agents(dev / audit / test)与人共用的同步点。**动手前先扫一眼这里**,
> 避免重新踩同一个坑或把已修复的问题再次回归。

## 用法约定
- 一个反复出现的问题 = 一个文件,命名 `YYYY-MM-<slug>.md`。
- 每个文件固定四段:**问题**(现象)、**根因**、**解决方案**(含验证命令)、**进度/状态**。
- 状态枚举:`待办` / `已修复未上线` / `已上线` / `复发中`(被回归时改回此状态并追加记录)。
- 修复或复发时**就地更新原文件**(追加日期行),不要另开新文件。
- 详细运维踩坑仍记 `../RUNBOOK.md`;这里只放「反复发生、跨会话要同步」的问题。

## 索引
| 文件 | 问题一句话 | 状态 |
|---|---|---|
| [2026-06-deploy-overwrite.md](2026-06-deploy-overwrite.md) | 双机部署互盖,已修复的代码被旧构建覆盖回归 | 已缓解(纪律+部署后验证) |
| [2026-06-pm-balance-display.md](2026-06-pm-balance-display.md) | PM 交易账户余额显示 0(`balanceUsd` 字段漏读) | 已上线(2026-06-06 二次) |
| [2026-06-toast-not-rendering.md](2026-06-toast-not-rendering.md) | 全站 toast 不显示 →「授权码点了没反应」 | 已上线 |
| [2026-06-dual-queryclient.md](2026-06-dual-queryclient.md) | 双 QueryClient 实例,模块级 invalidate 全部无效 | 已上线 |
| [2026-06-auth-code-gate.md](2026-06-auth-code-gate.md) | 授权码门控:真表 `rune_auth_codes` vs 空镜像;引擎 node_access 同步 | 已上线(待真实用户复测) |
| [2026-06-engine-db-rune-not-postgres.md](2026-06-engine-db-rune-not-postgres.md) | 生产引擎库是 `rune` 不是 `postgres`,查错库 = 看到旧/空数据 | 已修复(长期注意) |
| [2026-06-onboard-predict-500.md](2026-06-onboard-predict-500.md) | 新用户开户 500:thirdweb-engine 参数名 + lookup 单列匹配 + 缺工厂头(3 处) | 已上线 |
