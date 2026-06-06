// hl-marks.mjs — Hyperliquid 主/测网 mid 价 → Supabase trading_mark_prices。
// 跑在美东生产机(与 trading-sync 同目录,复用同一 .env 的 SUPABASE_DB_URL)。
// pm2 单实例,每 MARKS_INTERVAL_MS(默认 60s)全量 upsert;浮盈计算
// (trading_rollup_daily / v_wallet_open_positions)按 venue='hl_<network>' 取价。
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

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const INTERVAL_MS = Number(process.env.MARKS_INTERVAL_MS || 60000);
const ONCE = process.env.ONCE === "1";
if (!SUPABASE_DB_URL) { console.error("FATAL: need SUPABASE_DB_URL"); process.exit(1); }

const SOURCES = [
  { venue: "hl_mainnet", url: "https://api.hyperliquid.xyz/info" },
  { venue: "hl_testnet", url: "https://api.hyperliquid-testnet.xyz/info" },
];

async function fetchMids(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json(); // { BTC: "97123.0", ... } (含 @<index> 的现货对,跳过)
}

async function runOnce() {
  const t0 = Date.now();
  const dst = new pg.Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await dst.connect();
  const report = {};
  try {
    for (const { venue, url } of SOURCES) {
      const mids = await fetchMids(url);
      const rows = Object.entries(mids)
        .filter(([coin, px]) => !coin.startsWith("@") && Number.isFinite(Number(px)))
        .map(([coin, px]) => [coin, Number(px)]);
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const params = [];
        const values = slice.map(([coin, px]) => {
          params.push(venue, coin, px);
          return `($${params.length - 2},$${params.length - 1},$${params.length},now())`;
        }).join(",");
        await dst.query(
          `insert into public.trading_mark_prices (venue,symbol,px,as_of) values ${values}
           on conflict (venue,symbol) do update set px=excluded.px, as_of=now()`,
          params,
        );
      }
      report[venue] = rows.length;
    }
  } finally {
    await dst.end().catch(() => {});
  }
  console.log(`[${new Date().toISOString()}] marks ${Date.now() - t0}ms`, JSON.stringify(report));
}

async function loop() {
  try { await runOnce(); } catch (e) { console.error(`[${new Date().toISOString()}] marks error:`, e.message); }
  if (ONCE) return;
  setTimeout(loop, INTERVAL_MS);
}
loop();
