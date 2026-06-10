// hl-fills.mjs — Hyperliquid 真实平仓成交 → Supabase trading_trade_records。
// 跑在美东生产机(与 trading-sync 同目录,复用同一 .env 的 SUPABASE_DB_URL)。
// 背景:sync.mjs/refresh 函数只从镜像持仓产 position_snapshot,从不产真实成交单,
//   导致 v_wallet_today_closed / v_trade_records 的 HL 段恒空 → 前端"平仓"列表空。
// 本脚本对每个有 HL 订阅的 follower 拉 userFillsByTime(跨 dex,含 builder dex 的
//   "xyz:*" 成交),把 **平仓** fills(dir 含 Close,带 closedPnl)幂等写入
//   trading_trade_records(source='sync', record_type='close')。只 insert/守卫自己
//   前缀的行,绝不碰 manual。
// env:
//   SUPABASE_DB_URL    postgresql://postgres:***@db.<ref>.supabase.co:5432/postgres
//   FILLS_INTERVAL_MS  默认 120000(2 分钟)
//   FILLS_LOOKBACK_DAYS 默认 7(每轮回看天数,record_id 幂等去重)
//   FILLS_REQ_GAP_MS   默认 250(每个 follower 请求间隔,防 HL 429)
//   ONCE=1             跑一次即退出(backfill 用);DRY=1 只打印不写库
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

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const INTERVAL_MS = Number(process.env.FILLS_INTERVAL_MS || 120000);
const LOOKBACK_DAYS = Number(process.env.FILLS_LOOKBACK_DAYS || 7);
const REQ_GAP_MS = Number(process.env.FILLS_REQ_GAP_MS || 250);
const ONCE = process.env.ONCE === "1";
const DRY = process.env.DRY === "1";
if (!SUPABASE_DB_URL && !DRY) { console.error("FATAL: need SUPABASE_DB_URL"); process.exit(1); }

// 写 Supabase 的钱包/地址列统一小写(根治大小写再污染);链上读取(HL info user=...)
// 用小写地址也 OK(HL 地址大小写不敏感),签名/链上交互的地址不经此。
const lowerAddr = (v) => (typeof v === "string" && v ? v.toLowerCase() : v);

const HOSTS = {
  mainnet: "https://api.hyperliquid.xyz/info",
  testnet: "https://api.hyperliquid-testnet.xyz/info",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postInfo(host, body) {
  const res = await fetch(host, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${host} ${body.type} → HTTP ${res.status}`);
  return res.json();
}

// userFillsByTime 单页上限 2000;按时间游标翻页(跨 dex,builder dex 成交 coin 形如 "xyz:BRENTOIL")
async function fetchFills(host, user, startTime) {
  const all = [];
  const seen = new Set();
  let cursor = startTime;
  for (let page = 0; page < 20; page++) {
    const batch = await postInfo(host, { type: "userFillsByTime", user, startTime: cursor });
    if (!Array.isArray(batch) || batch.length === 0) break;
    let added = 0;
    for (const f of batch) {
      const k = String(f.tid ?? `${f.hash}:${f.oid}`);
      if (seen.has(k)) continue;
      seen.add(k); all.push(f); added++;
    }
    if (batch.length < 2000) break;
    cursor = Math.max(...batch.map((f) => f.time)) + 1;
    if (added === 0) break;
    await sleep(REQ_GAP_MS);
  }
  return all;
}

function sideFromDir(dir) {
  const d = String(dir || "");
  if (/Long/i.test(d)) return "long";
  if (/Short/i.test(d)) return "short";
  return null;
}

// 把一笔平仓 fill 映射成 trading_trade_records 行
function toRecord(f, network, userId, wallet) {
  const px = Number(f.px), sz = Math.abs(Number(f.sz));
  return {
    record_id: `hlfill:${network}:${String(f.tid ?? `${f.hash}:${f.oid}`)}`,
    source: "sync",
    venue: `hl_${network}`,
    record_type: "close",
    user_id: userId,
    wallet: lowerAddr(wallet), // 写 Supabase 的钱包列统一小写
    market_id: null,
    symbol: f.coin,
    side: sideFromDir(f.dir),
    price: Number.isFinite(px) ? px : null,
    size: Number.isFinite(sz) ? sz : null,
    notional_usd: Number.isFinite(px) && Number.isFinite(sz) ? px * sz : null,
    realized_pnl_usd: f.closedPnl != null ? Number(f.closedPnl) : null,
    happened_at: new Date(Number(f.time)).toISOString(),
    tx_hash: f.hash || null,
  };
}

const COLS = ["record_id","source","venue","record_type","user_id","wallet","market_id","symbol","side","price","size","notional_usd","realized_pnl_usd","happened_at","tx_hash"];

async function upsert(dst, rows) {
  if (!rows.length) return 0;
  const CHUNK = 500;
  let n = 0;
  const updates = COLS.filter((c) => c !== "record_id").map((c) => `${c}=excluded.${c}`).join(", ");
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const params = [];
    const valuesSql = slice.map((row) => {
      const ph = COLS.map((c) => { params.push(row[c] === undefined ? null : row[c]); return `$${params.length}`; });
      return `(${ph.join(",")})`;
    }).join(",");
    // record_id 前缀 'hlfill:' 不与 manual/PM 行冲突 → on conflict 只命中自己,守卫安全
    const sql = `insert into public.trading_trade_records (${COLS.join(",")}) values ${valuesSql}
                 on conflict (record_id) do update set ${updates}`;
    await dst.query(sql, params);
    n += slice.length;
  }
  return n;
}

async function getFollowers(dst) {
  const { rows } = await dst.query(`
    select distinct lower(s.follower_address) as follower_address, s.network, s.user_id, lower(u.smart_wallet_address) as smart_wallet_address
    from public.trading_hl_copy_subscriptions s
    join public.trading_users u on u.id = s.user_id
    where s.follower_address is not null and s.user_id is not null`);
  return rows;
}

async function runOnce() {
  const t0 = Date.now();
  const startTime = Date.now() - LOOKBACK_DAYS * 86400_000;
  let dst = null;
  if (!DRY) { const { default: pg } = await import("pg"); dst = new pg.Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } }); await dst.connect(); }
  try {
    const followers = DRY ? await getFollowersDry() : await getFollowers(dst);
    let totalRows = 0, totalClose = 0;
    for (const f of followers) {
      const network = f.network === "testnet" ? "testnet" : "mainnet";
      const host = HOSTS[network];
      const follower = f.follower_address;
      let fills;
      try { fills = await fetchFills(host, follower, startTime); }
      catch (e) { console.error(`  ${network} ${follower} fills error: ${e.message}`); await sleep(REQ_GAP_MS); continue; }
      const closes = fills.filter((x) => /Close/i.test(String(x.dir)));
      const rows = closes.map((x) => toRecord(x, network, f.user_id, f.smart_wallet_address));
      totalClose += closes.length;
      if (rows.length) {
        if (DRY) { console.log(`  [DRY] ${network} ${follower} → ${rows.length} close rows; sample:`, JSON.stringify(rows[0])); }
        else { totalRows += await upsert(dst, rows); }
      }
      await sleep(REQ_GAP_MS);
    }
    console.log(`[${new Date().toISOString()}] hl-fills ${Date.now() - t0}ms followers=${followers.length} closeFills=${totalClose} upserted=${totalRows}${DRY ? " (DRY)" : ""}`);
  } finally {
    if (dst) await dst.end().catch(() => {});
  }
}

// DRY 模式下从 PostgREST 读 followers(本地无 SUPABASE_DB_URL 口令时用)
async function getFollowersDry() {
  // 定向验证/backfill:FILLS_FOLLOWER=<addr> [FILLS_NET=mainnet|testnet]
  if (process.env.FILLS_FOLLOWER) {
    return [{ follower_address: lowerAddr(process.env.FILLS_FOLLOWER), network: process.env.FILLS_NET || "mainnet", user_id: null, smart_wallet_address: null }];
  }
  const base = process.env.SUPABASE_REST_URL;
  const key = process.env.SUPABASE_REST_KEY;
  if (!base || !key) { console.error("DRY needs SUPABASE_REST_URL + SUPABASE_REST_KEY"); return []; }
  const res = await fetch(`${base}/trading_hl_copy_subscriptions?select=follower_address,network,user_id&follower_address=not.is.null`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  const subs = await res.json();
  // 去重 + 拉 smart_wallet
  const seen = new Map();
  for (const s of subs) {
    const k = `${lowerAddr(s.follower_address)}|${s.network}`;
    if (!seen.has(k)) seen.set(k, { follower_address: lowerAddr(s.follower_address), network: s.network, user_id: s.user_id, smart_wallet_address: null });
  }
  return [...seen.values()];
}

async function loop() {
  try { await runOnce(); } catch (e) { console.error(`[${new Date().toISOString()}] hl-fills error:`, e.message); }
  if (ONCE) return;
  setTimeout(loop, INTERVAL_MS);
}
loop();
