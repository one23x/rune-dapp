// trading-sync — 美东 RDS rune-prod-pg(trading schema) → rune-dapp Supabase(trading_* 表)。
// 跑在美东生产机(读 RDS 私网、写 Supabase 公网,源主动出站)。pm2 单实例,每 INTERVAL 全量幂等 upsert。
// env(由同目录 .env / pm2 env 注入):
//   RDS_URL          postgresql://rune_admin:***@rune-prod-pg...:5432/postgres
//   SUPABASE_DB_URL  postgresql://postgres:***@db.<ref>.supabase.co:5432/postgres
//   SYNC_INTERVAL_MS 默认 120000(2 分钟);ONCE=1 跑一次即退出(backfill 用)
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
try {
  for (const raw of readFileSync(resolve(__dir, ".env"), "utf8").split("\n")) {
    const l = raw.trim(); if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("="); if (i === -1) continue;
    const k = l.slice(0, i).trim(); if (!(k in process.env)) process.env[k] = l.slice(i + 1).trim();
  }
} catch {}

const RDS_URL = process.env.RDS_URL;
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS || 120000);
const ONCE = process.env.ONCE === "1";
if (!RDS_URL || !SUPABASE_DB_URL) { console.error("FATAL: need RDS_URL + SUPABASE_DB_URL"); process.exit(1); }

// 每张表:目标表 / 冲突键 / 列 / RDS 源查询(列顺序须与 cols 一致)
const SPECS = [
  { target: "trading_users", conflict: ["id"],
    // hl_master_address(会员真实连接钱包/节点钱包)+ hl_mode 必须同步:admin 按 hl_master 搜索/显示「连接钱包」,
    // 缺失会让工厂部署户(smart_wallet≠节点钱包)在后台搜不到、误显示成「待开户」(2026-06-10 补)。
    cols: ["id","smart_wallet_address","engine_eoa_address","hl_master_address","hl_mode","status","project_id","created_at","updated_at"],
    src: `select id, smart_wallet_address, engine_eoa_address, hl_master_address, hl_mode, status::text, project_id, created_at, updated_at from trading.users` },
  { target: "trading_positions", conflict: ["user_id","market_id","token_id"],
    cols: ["user_id","project_id","token_id","market_id","net_shares","avg_entry_price","realized_pnl_usd","total_bought_usd","total_sold_usd","last_fill_at","settlement_status","redeem_proceeds_usd","updated_at"],
    src: `select user_id, project_id, coalesce(token_id,'') token_id, coalesce(market_id,'') market_id, net_shares, avg_entry_price, realized_pnl_usd, total_bought_usd, total_sold_usd, last_fill_at, settlement_status, redeem_proceeds_usd, updated_at from trading.positions where user_id is not null` },
  { target: "trading_hl_positions", conflict: ["id"],
    cols: ["id","subscription_id","coin","size_base","avg_entry_px","last_signal_id","updated_at"],
    src: `select id, subscription_id, coin, size_base, avg_entry_px, last_signal_id, updated_at from trading.hl_positions` },
  { target: "trading_orders", conflict: ["id"],
    cols: ["id","user_id","venue","venue_order_id","market_id","token_id","side","price","size","filled_size","status","created_at","updated_at","project_id"],
    src: `select id, user_id, venue::text, venue_order_id, market_id, token_id, side, price, size, filled_size, status::text, created_at, updated_at, project_id from trading.orders` },
  { target: "trading_signal_trades", conflict: ["id"],
    cols: ["id","source","market_id","token_id","action","side","limit_price","notional_usd","strength","issued_at","pnl_usd","closed_at","created_at","origin_kind","origin_user_id"],
    src: `select id, source, market_id, token_id, action, side, limit_price, notional_usd, strength, issued_at, pnl_usd, closed_at, created_at, origin_kind, origin_user_id from trading.signal_trades` },
  { target: "trading_polymarket_fills", conflict: ["id"],
    cols: ["id","user_id","project_id","market_id","token_id","side","size_shares","price","notional_usd","fee_rate_bps","matched_at","order_id","created_at"],
    src: `select id, user_id, project_id, market_id, token_id, side, size_shares, price, notional_usd, fee_rate_bps, matched_at, order_id, created_at from trading.polymarket_fills` },
  { target: "trading_copy_subscriptions", conflict: ["id"],
    cols: ["id","project_id","user_id","leader_wallet","status","notional_ratio","notional_cap_usd","daily_cap_usd","today_used_usd","created_at","updated_at"],
    src: `select id, project_id, user_id, leader_wallet, status, notional_ratio, notional_cap_usd, daily_cap_usd, today_used_usd, created_at, updated_at from trading.copy_subscriptions` },
  { target: "trading_hl_copy_subscriptions", conflict: ["id"],
    cols: ["id","project_id","user_id","leader_address","follower_address","notional_ratio","notional_cap_usd","daily_cap_usd","today_used_usd","max_leverage","status","network","take_profit_pct","created_at","updated_at"],
    src: `select id, project_id, user_id, leader_address, follower_address, notional_ratio, notional_cap_usd, daily_cap_usd, today_used_usd, max_leverage, status, network, take_profit_pct, created_at, updated_at from trading.hl_copy_subscriptions` },
  // HL 跟单信号流 + leader 榜 → dapp useHlSignals / useHlLeaders 改读 Supabase(降引擎 API 消耗)。
  // 信号量大(数万行/月);前端只读最近 N 条(≤60),只同步最近 3 天的开/平仓 fills 即够用,
  // 既保证 feed 新鲜又把每周期 upsert 量从 ~68k 压到 ~2 万(fills 是 append-only,PK=id 幂等)。
  { target: "trading_hl_copy_signals", conflict: ["id"],
    cols: ["id","leader_address","coin","side","is_close","px","sz","notional_usd","leader_sz_after","fill_hash","happened_at","network","created_at"],
    src: `select id, leader_address, coin, side, is_close, px, sz, notional_usd, leader_sz_after, fill_hash, happened_at, network, created_at from trading.hl_copy_signals where happened_at > now() - interval '3 days'` },
  { target: "trading_hl_leaders", conflict: ["address","network"],
    cols: ["address","network","label","active","score","median_holding_s","is_hft","last_fill_time","created_at","updated_at"],
    src: `select address, network, label, active, score, median_holding_s, is_hft, last_fill_time, created_at, updated_at from trading.hl_leaders` },
];

const CHUNK = 500;

// 写 Supabase 的钱包/地址列统一小写,根治大小写再污染(否则规范化后几分钟又被
// checksummed 整表 upsert 盖回)。链上读取/签名用的地址不在此(那些另取 checksummed)。
const ADDR_COLS = new Set([
  "smart_wallet_address", "engine_eoa_address", "hl_master_address",
  "leader_wallet", "leader_address", "follower_address", "address", "wallet",
  "proxy_wallet", "recv_address", "eoa", "recipient_address",
]);
const lowerAddr = (col, v) => (ADDR_COLS.has(col) && typeof v === "string" && v ? v.toLowerCase() : v);

async function upsert(dst, spec, rows) {
  if (!rows.length) return 0;
  const { target, cols, conflict } = spec;
  const updates = cols.filter((c) => !conflict.includes(c)).map((c) => `${c}=excluded.${c}`);
  const setClause = updates.length ? `do update set ${updates.join(", ")}, synced_at=now()` : "do nothing";
  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const params = [];
    const valuesSql = slice.map((row) => {
      const ph = cols.map((c) => { params.push(row[c] === undefined ? null : lowerAddr(c, row[c])); return `$${params.length}`; });
      return `(${ph.join(",")})`;
    }).join(",");
    const sql = `insert into public.${target} (${cols.join(",")}) values ${valuesSql} on conflict (${conflict.join(",")}) ${setClause}`;
    await dst.query(sql, params);
    n += slice.length;
  }
  return n;
}

async function runOnce() {
  const t0 = Date.now();
  const rds = new pg.Client({ connectionString: RDS_URL, ssl: { rejectUnauthorized: false } });
  const dst = new pg.Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await rds.connect(); await dst.connect();
  const report = {};
  try {
    for (const spec of SPECS) {
      const { rows } = await rds.query(spec.src);
      const n = await upsert(dst, spec, rows);
      report[spec.target] = n;
    }
  } finally {
    await rds.end().catch(() => {}); await dst.end().catch(() => {});
  }
  console.log(`[${new Date().toISOString()}] synced ${Date.now() - t0}ms`, JSON.stringify(report));
}

async function loop() {
  try { await runOnce(); } catch (e) { console.error(`[${new Date().toISOString()}] sync error:`, e.message); }
  if (ONCE) return;
  setTimeout(loop, INTERVAL_MS);
}
loop();
