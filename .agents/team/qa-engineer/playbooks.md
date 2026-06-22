# PLAYBOOKS · 测试 QA（可复用技能）

> 端到端验证的标准打法。在 SG dev 验，不 apply/不部署生产。

## P1 · 验一次提交
1. 读改动 + `AUDIT_REPORT.md` + 当前 Phase 验证门条件。
2. 写测试覆盖红队报的每个 Critical（能复现 + 验证修复后不复现）。
3. 跑：单测/集成测（vitest/jest）+ 端点 smoke + 构建检查 + 两库核对。
4. 逐项 PASS/FAIL + **实际命令输出片段**；FAIL 交回 engineer；跳过/未覆盖说明。

## P2 · 引擎端点 smoke
`pnpm db:migrate` 成功 → `curl` 带 Bearer 测 `/health`、`/v1/signals/*`、`/v1/hl/*`、`/v1/rune/*` 200+数据；API 角色 env 下确认 worker 不启动（角色隔离）。

## P3 · 前端验证（防假绿）
`pnpm exec next-on-pages` 无 edge/`fs`/`pg` 报错；grep 路由无 `pg`/`lib/db`；**admin 验代理看 JSON 而非 SPA、POST 非 405**（L015）；移动端 320px。

## P4 · 两库一致性
模拟一笔成交 → 核对 Master（RDS `trading.*` 连 `/rune`）与 Project（Supabase）各落一条订单/持仓/PnL。对不上先查连对库/watermark/RLS。

## P5 · 升级验证门（每 Phase 的连续通过条件）
- P1 签名：50 连续 testnet 单 + 10 户 canary 24h 0 拒绝、p95<1s。
- P2 agent：testnet 单带 builder fee+HWM；canary 全周期（开→平→HWM→invoice）。
- P3 规模化：3000 模拟账户 <1% 429、无停滞、0 漏/重单。
- P4 AI：shadow online-AUC ≥ offline gate、drift 在线。

## 防假绿清单（别被骗）
GET 200≠通（看 JSON/POST 405）/ 能 build≠能跑（grep 冲突+tsc）/ 无报错≠在工作（核真实落库行数）/ "real" 列按 source=sync 过滤。
