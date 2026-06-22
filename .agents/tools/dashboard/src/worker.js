// rune-dashboard — one-agents 平台监控面板
// GET / → HTML · GET /api → JSON · POST /push(x-push-secret) → 写 KV · GET /health
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const dot = (ok) => `<span class="d ${ok ? "g" : "r"}"></span>`;
const dotc = (ok) => `<td class="dc">${dot(ok)}</td>`;
const empty = (n) => `<tr><td colspan="${n}" class="muted">无数据</td></tr>`;

function render(s) {
  if (!s) return page("<p class='muted'>暂无快照。box pm2 <code>dash-collect</code> 尚未 push。</p>", null);
  const ago = s.ts ? Math.round((Date.now() - Date.parse(s.ts)) / 1000) : null;

  // 优化建议（置顶）
  const sug = (s.suggestions || []).map((x) => `<li class="sg ${x.lv}">${esc(x.t)}</li>`).join("");
  const sugCard = `<section class="full"><h2>💡 优化建议</h2><ul class="sug">${sug || "<li class='muted'>—</li>"}</ul></section>`;

  // API 429
  const a = s.api429;
  const a429 = a ? `<div class="big ${a.level}">${a.count}<small>/${esc(a.window)}</small></div><p class="muted">${a.level === "green" ? "正常" : a.level === "amber" ? "有压力" : "偏高，建议加 IP 分片"}</p>` : "<p class='muted'>未采集（需 PROD_SSH）</p>";

  // 信号源（leader-watch ws 心跳）
  const e = s.executor;
  const exec = e ? `
    <p>${dot(e.alive)} ${e.alive ? "leader-watch 心跳正常 (ws)" : "心跳缺失"}</p>
    <table>
      <tr><td>pushes</td><td class="num">${e.pushes ?? "-"}</td><td>signals</td><td class="num">${e.signals ?? "-"}</td></tr>
      <tr><td>filtered</td><td class="num">${e.filtered ?? "-"}</td><td>opened/30m</td><td class="num">${e.opened ?? "-"}</td></tr>
      <tr><td>skip/30m</td><td class="num">${e.skip ?? "-"}</td><td>error/30m</td><td class="num ${e.error >= 50 ? "warn" : ""}">${e.error ?? "-"}</td></tr>
    </table>` : "<p class='muted'>未采集（需 PROD_SSH）</p>";

  // 引擎角色（role-gated workers）
  const R = s.roles || {};
  const roleRow = (label, key, expectOn = true) => R[key] === undefined ? "" : `<tr>${dotc(R[key] === expectOn)}<td>${label}</td><td class="num ${R[key] === expectOn ? "" : "warn"}">${R[key] ? "ON" : "OFF"}</td></tr>`;
  const rolesPanel = Object.keys(R).length ? `<table>
      ${roleRow("信号源 leader-watch", "LEADER_WATCH_ENABLED", true)}
      ${roleRow("信号消费 signals-consumer", "SIGNALS_CONSUMER_ENABLED", true)}
      ${roleRow("PM matcher", "COPYTRADE_MATCHER_ENABLED", true)}
      ${roleRow("HL 执行器 copy-executor", "COPY_EXECUTOR_ENABLED", true)}
    </table>` : "<p class='muted'>未采集</p>";

  // fleet：containers + timers + pm2
  const cont = (s.fleet?.containers || []).map((c) => `<tr>${dotc(c.ok)}<td>${esc(c.name)}</td><td class="muted">${esc(c.status)}</td></tr>`).join("");
  const tim = (s.fleet?.timers || []).map((t) => `<tr><td>⏱ ${esc(t.name)}</td><td class="muted num">${esc(t.ago)}</td></tr>`).join("");
  const pm2 = (s.fleet?.pm2 || []).map((w) => `<tr>${dotc(w.status === "online")}<td>${esc(w.name)}</td><td class="num">↺${esc(w.restarts)}</td></tr>`).join("");

  // 引擎 DB 指标
  const en = s.engine;
  let engPanel = "<p class='muted'>未采集（需 PROD_SSH + 容器可达 RDS）</p>";
  if (en && !en.error) {
    const kvr = ["跟单账户", "HL订阅", "近1h信号", "今日API用量"].filter((k) => en[k] != null).map((k) => `<tr><td>${k}</td><td class="num ${k === "近1h信号" && en[k] === 0 ? "warn" : ""}">${esc(en[k])}</td></tr>`).join("");
    const sh = en.rankerShadow;
    const shr = sh ? `<tr><td>ranker shadow AUC</td><td class="num ${sh.auc != null && +sh.auc < 0.5 ? "warn" : ""}">${sh.auc != null ? (+sh.auc).toFixed(3) : "-"} <span class="muted">edge ${sh.edge_pnl != null ? (+sh.edge_pnl).toFixed(1) : "-"} · ${esc(sh.day || "")}</span></td></tr>` : "";
    engPanel = `<table>${kvr}${shr}</table>`;
  } else if (en && en.error) engPanel = `<p class="muted">db: ${esc(en.error)}</p>`;

  // sites + memory
  const sites = (s.sites || []).map((x) => `<tr>${dotc(x.ok)}<td>${esc(x.url.replace(/^https?:\/\//, ""))}</td><td class="num">${esc(x.status || x.error || "-")}</td><td class="num">${x.ms != null ? x.ms + "ms" : "-"}</td></tr>`).join("");
  const mem = s.memory ? `${dot(true)} ${esc(s.memory.index || "ok")} · ${esc(s.memory.model || "")}` : `${dot(false)} 离线`;

  return page(`
    ${sugCard}
    <div class="grid">
      <section><h2>🚦 API 429 限流</h2>${a429}</section>
      <section><h2>📡 信号源 (leader-watch)</h2>${exec}</section>
      <section><h2>🧩 引擎角色 Roles</h2>${rolesPanel}</section>
      <section><h2>🔧 引擎指标 (RDS rune)</h2>${engPanel}</section>
      <section><h2>🐳 容器 Fleet</h2><table>${cont || empty(3)}</table></section>
      <section><h2>⏱ 定时器 Timers</h2><table>${tim || empty(2)}</table></section>
      <section><h2>⚙️ Fleet pm2 (${esc(s.fleet?.fleetHost || s.host || "box")})</h2><table>${pm2 || empty(3)}</table></section>
      <section><h2>🌐 站点 Sites</h2><table>${sites || empty(4)}</table></section>
      <section><h2>🧠 矢量记忆</h2><p>${mem}</p></section>
    </div>`, ago);
}

function page(body, ago) {
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rune 平台监控</title>
<style>
:root{--bg:#0c0a09;--card:#1c1917;--amber:#f59e0b;--g:#22c55e;--a:#f59e0b;--r:#ef4444;--muted:#78716c;--tx:#e7e5e4}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto}
header{padding:16px 20px;border-bottom:1px solid #292524;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
h1{font-size:18px;margin:0;color:var(--amber)}.upd{color:var(--muted);font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;padding:0 20px 20px}
section{background:var(--card);border:1px solid #292524;border-radius:12px;padding:14px 16px}
section.full{margin:16px 20px 0}
h2{font-size:14px;margin:0 0 10px}
table{width:100%;border-collapse:collapse}td{padding:5px 8px;border-bottom:1px solid #292524}tr:last-child td{border-bottom:0}
.num{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}.warn{color:var(--a)}
.dc{width:22px}.d{display:inline-block;width:9px;height:9px;border-radius:50%}.g{background:var(--g)}.r{background:var(--r)}
.muted{color:var(--muted)}code{background:#292524;padding:1px 5px;border-radius:4px}
.big{font-size:42px;font-weight:700;line-height:1}.big small{font-size:14px;color:var(--muted);font-weight:400}
.big.green{color:var(--g)}.big.amber{color:var(--a)}.big.red{color:var(--r)}
.sug{list-style:none;margin:0;padding:0}.sg{padding:7px 10px;border-radius:8px;margin-bottom:6px;border-left:3px solid var(--muted)}
.sg.warn{border-color:var(--r);background:#2a1414}.sg.info{border-color:var(--a);background:#2a2110}.sg.ok{border-color:var(--g);background:#0f2417}
@media(max-width:480px){.grid{padding:0 12px 12px}section.full{margin:12px}}
</style></head><body>
<header><h1>🛰 Rune 平台监控</h1><span class="upd">${ago != null ? "更新于 " + ago + "s 前" : "无快照"} · 自动刷新 30s</span></header>
${body}
<script>setTimeout(()=>location.reload(),30000)</script>
</body></html>`;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/health") return Response.json({ ok: true });
    if (url.pathname === "/push" && req.method === "POST") {
      if (env.PUSH_SECRET && req.headers.get("x-push-secret") !== env.PUSH_SECRET) return new Response("unauthorized", { status: 401 });
      await env.DASH.put("snapshot", await req.text());
      return Response.json({ ok: true });
    }
    const snap = await env.DASH.get("snapshot", "json");
    if (url.pathname === "/api") return Response.json(snap || {});
    return new Response(render(snap), { headers: { "content-type": "text/html; charset=utf-8" } });
  },
};
