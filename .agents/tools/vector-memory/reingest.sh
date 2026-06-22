#!/usr/bin/env bash
# 定时增量重灌矢量库（id=sha1(path#title)，upsert 幂等；改了记忆就重跑）。
# 部署（box，每日 03:30 UTC）：
#   crontab -e →  30 3 * * * REPO_ROOT=$HOME/projects/one-agents bash $HOME/projects/one-agents/.agents/tools/vector-memory/reingest.sh >> $HOME/reingest.log 2>&1
# 或 pm2：pm2 start reingest.sh --name vec-reingest --cron "30 3 * * *" --no-autorestart
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
set -a; . "$HERE/.env"; set +a
: "${REPO_ROOT:=$(cd "$HERE/../../.." && pwd)}"
export REPO_ROOT
echo "[$(date -u +%FT%TZ)] reingest from $REPO_ROOT"
node "$HERE/ingest.mjs"
