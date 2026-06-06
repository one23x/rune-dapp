# 生产引擎库是 `rune` 不是 `postgres`

状态:**已修复(长期注意)**

## 问题
对生产 RDS 查询/写入时连到默认 `postgres` 库 → 看到的是一份**旧的/不全的拷贝**
(缺列、行数不对),或把同步数据写进引擎根本不读的库。
后果案例:node_access 同步写进 `postgres` → 引擎门控看到 0 行 →
onboard 全员 403 / 账户卡 `pending`。

## 根因
同一台 RDS(rune-prod-pg…us-east-1)上 `postgres` 和 `rune` 两个库都有
`trading` schema。引擎 `DATABASE_URL` 指向 **`/rune`**。psql 不带 `-d rune`
默认连 `postgres`,一切看起来都对,数据全是错的。

## 解决方案 / 纪律
- 一切对引擎数据的 psql / 脚本连接 **必须显式 `-d rune`**。
- `~/trading-sync/.env` 的 `RDS_URL` 已指向 `/rune`,脚本读它,别手写连接串。
- 2026-06-06 已重跑 node-access-sync 到 rune 库(202 行)。

## 验证
```sql
-- 连对了的话:
select count(*) from trading.node_access;   -- rune 库 ≈ 202+;postgres 库的是脏数据
\du  -- 或 select current_database();  -- 必须返回 rune
```

## 进度
- [x] 2026-06-06:误写 postgres 的 201 行废弃,rune 库重同步完成
- [ ] (可选)把 postgres 库里的镜像 trading schema 改名/清掉,杜绝再连错
