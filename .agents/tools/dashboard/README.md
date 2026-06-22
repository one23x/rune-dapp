# rune-dashboard · 平台监控面板（projects + workers）

> one-agents 主平台级监控（REPOS 主-4）：站点状态 + Worker/pm2 健康 + 引擎指标 + 矢量记忆健康。
> **✅ MVP 已上线（2026-06-16）**：`https://rune-dashboard.one-deploy.workers.dev`

## 架构
```
box 收集器 (pm2 dash-collect, 每5min)              CF Worker (rune-dashboard)
  pm2 jlist ───┐                              ┌── GET /     → HTML 面板
  站点 ping  ───┼─► POST /push (x-push-secret) ─┤   GET /api  → 原始 JSON
  引擎 DB    ───┤        写 KV(DASH)            │   POST /push → 写 KV
  矢量 /health ─┘                              └── GET /health
```

## 组成
- `src/worker.js` — Worker（HTML 面板 + /push + /api），KV `DASH` 存最新快照，dark/amber 主题、移动响应。
- `collect.mjs` — 收集器：pm2 jlist + 站点 ping + 引擎 DB 指标（best-effort）+ 矢量 /health → POST /push。
- `dash-collect.sh` — pm2 包装（source 引擎 DB env + dashboard .env）。
- `.env`（gitignored，box）：`DASH_PUSH_URL` / `PUSH_SECRET` / `VECTOR_URL` / `SITES`(逗号分隔)。

## 部署 / 运维
```bash
# Worker（已部署）
wrangler kv namespace create DASH          # → 填进 wrangler.jsonc
wrangler secret put PUSH_SECRET
wrangler deploy
# 收集器（box pm2，每5min）
pm2 start dash-collect.sh --name dash-collect --no-autorestart --cron "*/5 * * * *" --interpreter bash && pm2 save
```

## 面板（全部真实，收集器经 `PROD_SSH=worker` 取 prod docker/log 源）
- 💡 **优化建议**（置顶）：启发式规则，内嵌 RUNBOOK/optimizer 经验为实时告警（429 偏高→IP 分片；0 开仓→查 funded×活跃 leader 配对非 bug；容器不健康/重启高→查根因）。
- 🚦 **API 429**：`docker logs one-agents-backend --since 30m | grep 429` 计数 + green/amber/red 分级。
- 🤖 **执行器**：解析引擎 ws 心跳行（`"mode":"ws"` 的 pushes/signals/filtered）+ opened/skip/error/30m + alive。
- 🐳 **容器 Fleet** + ⏱ **systemd 定时器**：`docker ps` 健康 + `systemctl list-timers`（ranker-eval/auto-subscribe/copy-pnl）。
- ⚙️ **pm2**（dev box）· 🌐 **站点** ping · 🧠 **矢量记忆** `/health`。

## 待办
- 引擎 DB 指标（`usage_counters`/`ranker_eval_daily`/账户数）：dev box 不可达 prod RDS（最小权限网络）→ 在 prod 侧查或经 ssh 取；SQL 入 `collect.mjs`。
- 站点巡检对接 Slack `ops-site-monitoring`；收集器迁 prod worker 看完整 fleet；迁出独立 repo `one23x/rune-dashboard`。

## 监控项（目标全景，REPOS 主-4）
① 站点巡检（对接 Slack ops-site-monitoring）② pm2 worker 健康 ③ 引擎（429率/usage_counters/跟单开仓）④ ranker shadow/drift（ranker_eval_daily）。
