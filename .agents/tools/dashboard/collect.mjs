#!/usr/bin/env node
// rune-dashboard 收集器：站点 + 矢量 + (prod via ssh) API 429 / 执行器 / fleet 健康 + 优化建议 → POST /push。
// env：DASH_PUSH_URL, PUSH_SECRET, SITES, VECTOR_URL, PROD_SSH(如 worker)
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const env = process.env;
const sh = (cmd, t = 12000) => { try { return execSync(cmd, { timeout: t, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; } };

// pm2 fleet（优先 prod sync 机 FLEET_SSH=synchost；否则本地）。这是真实 worker fleet（trading-sync/hl-marks/hl-account-state/...）。
let pm2 = [], fleetHost = "local";
try {
  const cmd = env.FLEET_SSH ? `ssh -o ConnectTimeout=8 ${env.FLEET_SSH} pm2 jlist` : "pm2 jlist";
  pm2 = JSON.parse(sh(cmd, 15000)).map((p) => ({ name: p.name, status: p.pm2_env?.status, restarts: p.pm2_env?.restart_time }));
  fleetHost = env.FLEET_SSH || "local";
} catch {}

// 站点 ping
const SITES = (env.SITES || "https://rune-ai.io").split(",").map((s) => s.trim()).filter(Boolean);
const sites = [];
for (const url of SITES) { const t = Date.now(); try { const r = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(8000) }); sites.push({ url, status: r.status, ok: r.status < 500, ms: Date.now() - t }); } catch (e) { sites.push({ url, ok: false, error: String(e).slice(0, 50) }); } }

// 矢量记忆
let memory = null;
if (env.VECTOR_URL) { try { memory = await (await fetch(env.VECTOR_URL + "/health", { signal: AbortSignal.timeout(6000) })).json(); } catch {} }

// prod 指标（ssh worker → docker logs + docker ps + systemd）
let api429 = null, executor = null;
const roles = {};
const fleet = { containers: [], timers: [], pm2, fleetHost };
if (env.PROD_SSH) {
  const REMOTE = `
L=$(docker logs one-agents-backend --since 30m 2>&1)
echo "C429=$(echo "$L" | grep -ciE '429|rate.?limit')"
echo "CERR=$(echo "$L" | grep -ciE '\\\\berror\\\\b|\\"level\\":50')"
echo "CSKIP=$(echo "$L" | grep -ci skip)"
echo "COPEN=$(echo "$L" | grep -ciE 'placed order|opened (order|position)')"
echo "HEARTBEAT=$(echo "$L" | grep -oE '\\"mode\\":\\"ws\\"[^}]*' | tail -1)"
docker ps --format 'CONTAINER={{.Names}}|{{.Status}}' 2>/dev/null
systemctl list-timers --all 2>/dev/null | grep -iE 'ranker|subscribe|pnl' | awk '{print "TIMER="$NF"|"$(NF-3)" "$(NF-2)" "$(NF-1)}'
docker exec one-agents-backend printenv 2>/dev/null | grep -E 'LEADER_WATCH_ENABLED|SIGNALS_CONSUMER_ENABLED|COPYTRADE_MATCHER_ENABLED|HL_COPY_EXECUTOR_ENABLED' | sed 's/^/ROLE_/'
`;
  const out = sh(`ssh -o ConnectTimeout=8 ${env.PROD_SSH} bash -s <<'RMT'\n${REMOTE}\nRMT`, 25000);
  const kv = {};
  for (const line of out.split("\n")) {
    const m = line.match(/^(\w+)=(.*)$/); if (!m) continue;
    if (m[1] === "CONTAINER") { const [name, ...st] = m[2].split("|"); const status = st.join("|"); fleet.containers.push({ name, status, ok: /healthy|Up/.test(status) }); }
    else if (m[1] === "TIMER") { const [name, ago] = m[2].split("|"); fleet.timers.push({ name, ago }); }
    else if (m[1].startsWith("ROLE_")) roles[m[1].replace(/^ROLE_(HL_)?/, "")] = m[2].trim() === "true";
    else kv[m[1]] = m[2];
  }
  const hb = (kv.HEARTBEAT || "").match(/pushes":(\d+).*?signals":(\d+).*?filtered":(\d+)/);
  api429 = { window: "30m", count: +(kv.C429 || 0) };
  api429.level = api429.count >= 30 ? "red" : api429.count >= 10 ? "amber" : "green";
  executor = { alive: !!kv.HEARTBEAT, pushes: hb ? +hb[1] : null, signals: hb ? +hb[2] : null, filtered: hb ? +hb[3] : null, opened: +(kv.COPEN || 0), skip: +(kv.CSKIP || 0), error: +(kv.CERR || 0) };
}

// 引擎 DB 指标（容器内 postgres-js → RDS rune；dev box 不可达 RDS，故走容器）
let engine = null;
if (env.PROD_SSH) {
  const ep = `${import.meta.dirname}/engine-metrics.cjs`;
  const out = sh(`ssh -o ConnectTimeout=8 ${env.PROD_SSH} "docker exec -i one-agents-backend node --input-type=commonjs" < ${ep}`, 20000);
  const last = out.split("\n").filter(Boolean).pop();
  try { engine = JSON.parse(last); } catch {}
}

// 优化建议（启发式，对齐 optimizer/red-teamer/RUNBOOK）
const sug = [];
if (api429) {
  if (api429.count >= 30) sug.push({ lv: "warn", t: `API 429 偏高（${api429.count}/30m）→ 加 IP 分片 + 提高账户快照 TTL（optimizer P2 规模化）` });
  else if (api429.count >= 10) sug.push({ lv: "info", t: `API 429 有压力（${api429.count}/30m）→ 关注；必要时 HL_INFO_HOST 指独立 info 节点` });
}
if (Object.keys(roles).length) {
  if (roles.COPY_EXECUTOR_ENABLED === false) sug.push({ lv: "warn", t: "⚠️ HL_COPY_EXECUTOR_ENABLED=false → HL 跟单不会开仓！确认是否有意（RUNBOOK：唯一执行器须单机 enabled）" });
  if (roles.LEADER_WATCH_ENABLED === false) sug.push({ lv: "warn", t: "信号源 LEADER_WATCH 关闭 → 无新信号产出（L005 第②层）" });
  if (roles.SIGNALS_CONSUMER_ENABLED === false) sug.push({ lv: "warn", t: "SIGNALS_CONSUMER 关闭 → 信号不被消费" });
}
if (executor) {
  if (!executor.alive) sug.push({ lv: "warn", t: "信号源 ws 心跳缺失（30m 无 ws 摘要）→ 查 leader-watch / 429" });
  if (executor.error >= 50) sug.push({ lv: "warn", t: `引擎错误偏多（${executor.error}/30m）→ docker logs one-agents-backend | grep error 查根因` });
  if (executor.alive && executor.opened === 0 && roles.COPY_EXECUTOR_ENABLED !== false) sug.push({ lv: "info", t: "近 30m 0 开仓 → 查 funded户(净值≥$15)×活跃 leader 配对（RUNBOOK），多为配置/资金错配非代码 bug" });
}
if (engine && engine["近1h信号"] === 0) sug.push({ lv: "warn", t: "近 1h 0 leader 信号 → 信号生产者(leader-watch)停 或 leader 都在睡（L005 第②层）" });
if (engine?.rankerShadow && engine.rankerShadow.auc != null && engine.rankerShadow.auc < 0.5) sug.push({ lv: "info", t: `ranker shadow AUC ${(+engine.rankerShadow.auc).toFixed(3)} < 0.5 基线 → 保持 shadow，别开 gate（ml-trainer）` });
for (const c of fleet.containers) if (!c.ok) sug.push({ lv: "warn", t: `容器 ${c.name} 不健康 → 查 autoheal / docker logs` });
for (const w of pm2) { if (w.status !== "online" && w.name !== "launch-check") sug.push({ lv: "warn", t: `fleet 进程 ${w.name} 非 online（${w.status}）→ 查 pm2 logs / 单实例铁律` }); else if (w.restarts >= 20) sug.push({ lv: "info", t: `${w.name} 重启 ${w.restarts} 次 → 查根因（pm2 logs）` }); }
if (!sug.length) sug.push({ lv: "ok", t: "✅ 暂无告警，各项指标正常" });

// 站点巡检对接 Slack（ops-site-monitoring）：仅在站点 up/down 状态变化时推，去重防刷屏。
if (env.SLACK_WEBHOOK) {
  const down = sites.filter((s) => !s.ok).map((s) => s.url);
  const stateFile = `${import.meta.dirname}/.sites-state`;
  let prev = []; try { prev = JSON.parse(readFileSync(stateFile, "utf8")); } catch {}
  if (JSON.stringify(down) !== JSON.stringify(prev)) {
    const text = down.length ? `🔴 站点巡检告警：${down.join(", ")} 不可达` : "🟢 站点巡检：全部站点已恢复正常";
    try { await fetch(env.SLACK_WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }); } catch {}
    try { writeFileSync(stateFile, JSON.stringify(down)); } catch {}
  }
}

const snapshot = { ts: new Date().toISOString(), host: env.HOSTNAME || sh("hostname") || "box", sites, memory, api429, executor, roles, engine, fleet, suggestions: sug };
if (!env.DASH_PUSH_URL) { console.log(JSON.stringify(snapshot, null, 2)); process.exit(0); }
const r = await fetch(env.DASH_PUSH_URL, { method: "POST", headers: { "content-type": "application/json", "x-push-secret": env.PUSH_SECRET || "" }, body: JSON.stringify(snapshot) });
console.log(`[${snapshot.ts}] push ${r.status} · 429:${api429?.count} exec_alive:${executor?.alive} err:${executor?.error} sugg:${sug.length}`);
