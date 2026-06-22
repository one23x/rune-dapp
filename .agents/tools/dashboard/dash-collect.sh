#!/usr/bin/env bash
# rune-dashboard 收集器 pm2 包装：source 引擎 DB env（DATABASE_URL，需指向 /rune 库）+ dashboard .env，跑 collect.mjs。
# 部署（box，每 5min）：
#   pm2 start dash-collect.sh --name dash-collect --no-autorestart --cron "*/5 * * * *" --interpreter bash && pm2 save
# ⚠️ 引擎指标要真实：DB_ENV_FILE 里的 DATABASE_URL 必须是引擎的 /rune 库（L002：连错库=空指标）。
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DB_ENV_FILE="${DB_ENV_FILE:-$HOME/projects/prod-backend-api.env}"
set -a
[ -f "$DB_ENV_FILE" ] && . "$DB_ENV_FILE"
. "$HERE/.env"
set +a
exec node "$HERE/collect.mjs"
