// 引擎 DB 指标查询 —— 在 prod 容器内跑（有 postgres-js + DATABASE_URL + RDS SSL 可达）。
// 收集器经 `ssh worker "docker exec -i one-agents-backend node --input-type=commonjs" < engine-metrics.cjs` 喂进来。
// 输出一行 JSON。每条查询独立 try，schema 不符就跳过该项。
(async () => {
  let postgres;
  try { postgres = require("postgres"); } catch { return console.log(JSON.stringify({ error: "no postgres-js" })); }
  const sql = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 3, connect_timeout: 6, ssl: { rejectUnauthorized: false } });
  const out = {};
  const one = async (k, fn) => { try { out[k] = await fn(); } catch {} };
  await one("跟单账户", async () => (await sql`select count(*)::int n from trading.users`)[0].n);
  await one("HL订阅", async () => (await sql`select count(*)::int n from trading.hl_copy_subscriptions`)[0].n);
  await one("近1h信号", async () => (await sql`select count(*)::int n from trading.hl_copy_signals where happened_at > now() - interval '1 hour'`)[0].n);
  await one("今日API用量", async () => (await sql`select coalesce(sum(value),0)::float8 n from trading.usage_counters where updated_at::date = current_date`)[0].n);
  await one("rankerShadow", async () => {
    const r = (await sql`select day::text, model, n, auc::float8, edge_pnl::float8, pass_winrate::float8 from trading.ranker_shadow_daily order by day desc limit 1`)[0];
    return r || null;
  });
  await one("rankerEval", async () => {
    const r = (await sql`select day::text, gate, auc::float8, lift::float8, blocked_frac::float8 from trading.ranker_eval_daily order by day desc limit 1`)[0];
    return r || null;
  });
  console.log(JSON.stringify(out));
  await sql.end();
})().catch((e) => console.log(JSON.stringify({ error: String(e).slice(0, 120) })));
