#!/usr/bin/env bash
# Claude Code UserPromptSubmit hook：按用户 prompt 从矢量库召回相关团队记忆/技能，注入上下文。
# 注册（各仓 .claude/settings.json）：
#   { "hooks": { "UserPromptSubmit": [ { "hooks": [
#       { "type": "command", "command": "bash .agents/tools/vector-memory/recall-hook.sh" } ] } ] } }
# 失败一律静默退出（exit 0），绝不阻塞会话。
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ENVF="$HERE/.env"
[ -f "$ENVF" ] && { set -a; . "$ENVF"; set +a; }
[ -z "${WORKER_URL:-}" ] && exit 0

INPUT="$(cat)"
Q="$(INPUT="$INPUT" python3 <<'PY'
import os, json
try:
    print(json.loads(os.environ.get("INPUT", "")).get("prompt", "")[:500])
except Exception:
    pass
PY
)"
[ -z "${Q:-}" ] && exit 0

ROLEQ=""
[ -n "${RECALL_ROLE:-}" ] && ROLEQ="--data-urlencode role=$RECALL_ROLE"

RES="$(curl -sG --max-time 5 "$WORKER_URL/recall" --data-urlencode "q=$Q" --data-urlencode "topK=4" $ROLEQ 2>/dev/null)" || exit 0

CTX="$(RES="$RES" python3 <<'PY'
import os, json
try:
    d = json.loads(os.environ.get("RES", "") or "[]")
except Exception:
    d = []
hits = [m for m in d if m.get("score", 0) > 0.55]
if hits:
    out = ["相关团队记忆/技能（矢量库召回，仅供参考；要用先读原文）："]
    for m in hits:
        tag = m.get("role") or m.get("scope") or ""
        snip = (m.get("snippet") or "")[:160]
        out.append(f"- [{tag}] {m.get('title') or ''} — {snip} ({m.get('path')})")
    print("\n".join(out))
PY
)"
[ -z "${CTX:-}" ] && exit 0

CTX="$CTX" python3 <<'PY'
import os, json
ctx = os.environ.get("CTX", "")
print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": ctx}}))
PY
exit 0
