# MEMORY · 数据工程师 Data Engineer

> 先查这里 + `docs/ops/RUNBOOK.md` + `docs/journey/LESSONS.md` + 用户级 memory（rune-db-schema-management 等）。

## RDS 双库陷阱（头号坑）
- **`rune-prod-pg` 两个库各带一套 trading schema**：`rune`=生产引擎(one-agents-backend `DATABASE_URL`)读写；`postgres`=旧引擎遗留停在 5 月底。**读 trading 必连 `/rune`**（2026-06-06 trading-sync 连错 postgres 导致数据滞后/缺新用户）。
- **钱包三键**（L002）：smart_wallet/hl_master/login_wallet；面向用户视图按 login_wallet 绑（会员连登录钱包）。

## schema / 视图演进
- **Drizzle push 无迁移文件**（用户级 rune-db-schema-management）：Supabase preview 分支不继承 Drizzle-push 的表。
- **视图 create-or-replace 只能末尾追加列**，不许中插/改名（bind-connected-wallet-views 就是末尾追加 login_wallet/engine_eoa）。
- **新表 RLS 陷阱**（用户级 rune-supabase-rls-anon-policy）：Supabase 自动启 RLS 无 policy = anon 读空。补 `using(true)` select policy + NOTIFY pgrst。首次 2026-05-22 在 rune_auth_codes 踩。

## 同步管线
- **watermark-poll 不是 outbox**：`position-sync.ts` 按 `(projectId,table)` 水位 SELECT + PostgREST upsert，幂等可重启。扩表覆盖，别造平行 outbox。
- **HL 余额/标记价独立 sync 脚本**：`trading_hl_account_state`（每 2min POST 公共 clearinghouseState）+ `trading_mark_prices`（allMids），免经引擎撞 cap。
- **PM 持仓走 data-api**（`data-api/positions?user=<代理钱包>`）不靠 fills 推导（fills 不可信，曾记成对手 token）。

## 统计 / 账本
- **L013 "real" 列名骗人**：旧 rollup 把 manual 全算进 real。双轨：`sync_*`(真实) vs show。
- **会员账本虚拟**（member-ledger）：余额/持仓/盈亏由流水推导，admin 不直接写，真锚=充值；可提不含浮盈防穿帮。

## 缓存 / 连接
- **PgBouncer `prepare:false`**；**pm2 改 env 必 delete+start+save**；本机连 Supabase 走 pooler + `gssencmode=disable`。
- Redis 不迁可重建（DECISIONS D3）；worker in-memory 日计数应迁 Redis（规模化）。

## 链接
- 用户级 memory：rune-db-schema-management / rune-supabase-rls-anon-policy / rune-referrer-manual-overrides / rune-data-access-prefer-supabase-direct
- `scripts/trading-sync/`（同步脚本全在这）/ `docs/ops/member-ledger-design.md`
