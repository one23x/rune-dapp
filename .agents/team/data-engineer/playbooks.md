# PLAYBOOKS · 数据工程师（可复用技能）

> schema/同步/缓存的标准打法。换 project 库照这套。

## P1 · 加新表/视图（幂等 + 不破坏既有）
1. 脚本放 `scripts/trading-sync/*.sql`，写成**幂等**（`create table if not exists` / `create or replace view`）。
2. **视图改列只能末尾追加**（`create or replace` 不许中插或改名）——要插中间就先 drop 再建（注意依赖）。
3. 新表必补 RLS：`alter table enable rls` 后加 `using(true)` select policy（public_read）+ admin_write（TO authenticated 校验 admin_users）+ `NOTIFY pgrst, 'reload schema'`（否则 anon/前端读空）。
4. apply 前后核验行数；记进 PROGRESS 流水。

## P2 · 同步脚本（pm2 常驻）
- 模式：拉源（引擎/HL 公共 API/链上）→ upsert Supabase（`Prefer: resolution=merge-duplicates`）→ 每 N 秒。
- **HL 余额/标记价直接打 HL 公共 info API**（clearinghouseState/allMids）写 Supabase，**别经引擎**（撞每日 cap）。
- **pm2 改 env**：`restart --update-env` 不生效（env 烤在 dump）→ `pm2 delete <name> && pm2 start ... && pm2 save`。
- 单实例：写同一张表的 sync 脚本只跑一个 pm2 实例。

## P3 · 双库一致性核对
模拟一笔成交 → 核对 Master（RDS `trading.*` 连 `/rune`）与 Project（Supabase）各落一条订单/持仓/PnL。对不上先查：连对库了吗？watermark 卡住了吗？RLS 挡了读吗？

## P4 · 连接池 / 缓存扩容
- PgBouncer transaction pooling → 必 `prepare:false`（否则 prepared statement 爆）。
- worker in-memory 计数（日额度等）→ 迁 Redis（多副本一致 + 重启不丢）。
- 本机连 Supabase：走 `aws-1-ap-northeast-2.pooler.supabase.com:5432`（用户名 `postgres.<ref>`）+ `gssencmode=disable`（直连 IPv6-only 不通）。

## P5 · 统计双轨（别被 "real" 骗）
- `sync_*`（source=sync 真实）vs show（sync+manual 展示）。真实轨必须按 `source=sync` 过滤，别用"主列减覆盖"反推。
- 会员账本虚拟：余额/持仓/盈亏由 `member_ledger` 流水推导，admin 永不直接写余额，唯一真锚=充值。

## 验证清单
连对 `/rune` / 视图末尾追加 / 新表有 select policy+NOTIFY / 双库一致 / PgBouncer prepare:false / 无直接写余额。
