// demo-seed-608b.mjs — 一次性:给 demo 账户(user 6adec238 / wallet 0x608b)写入
//   ① N 笔复制自真实盈利平仓单的 manual close(带真实 tx 链接,时间打散在今天 SGT)
//   ② trading_hl_overrides 头条覆盖 = 本金 $999 上 +0.5%(净值 1004 / 当日 +5)
// 仅用于 demo/样板账户展示,不碰真实客户钱包。SEED_N 控制笔数(默认 8);
// UNSEED=1 撤销(删 manual 行 + 清 override)。读 .env 的 SUPABASE_DB_URL。
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

const URL = process.env.SUPABASE_DB_URL;
if (!URL) { console.error("FATAL: need SUPABASE_DB_URL"); process.exit(1); }

const USER = "6adec238-05c2-4ba2-89ce-d9261921213a";
const WALLET = "0x608bb3CbDb6fA89f1Efa6078194C5726c62aC830";
const TX = "0x7d69ce9ec2e9b4f17ee3043d23f4b202093c00845decd3c3213279f181ed8edc"; // 真实 BTC 盈利平仓 tx
const N = Number(process.env.SEED_N || 8);
const UNSEED = process.env.UNSEED === "1";

const { default: pg } = await import("pg");
const c = new pg.Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  if (UNSEED) {
    const d = await c.query(`delete from public.trading_trade_records where record_id like 'manual:demo608b:%'`);
    await c.query(`delete from public.trading_hl_overrides where lower(wallet)=lower($1) and network='mainnet'`, [WALLET]);
    console.log(`UNSEED: removed ${d.rowCount} manual rows + override`);
  } else {
    const now = Date.now();
    let inserted = 0;
    for (let i = 0; i < N; i++) {
      // 打散在过去 ~3 小时(保证落在今天 SGT)
      const t = new Date(now - (i * 19 + 7) * 60_000).toISOString();
      await c.query(
        `insert into public.trading_trade_records
           (record_id,source,venue,record_type,user_id,wallet,symbol,side,price,size,notional_usd,realized_pnl_usd,happened_at,tx_hash)
         values ($1,'manual','hl_mainnet','close',$2,$3,'BTC','long',61459,0.00024,14.75016,0.23616,$4,$5)
         on conflict (record_id) do update set realized_pnl_usd=excluded.realized_pnl_usd, happened_at=excluded.happened_at, tx_hash=excluded.tx_hash`,
        [`manual:demo608b:${i + 1}`, USER, WALLET, t, TX],
      );
      inserted++;
    }
    await c.query(
      `insert into public.trading_hl_overrides
         (wallet,network,account_value_usd,withdrawable_usd,unrealized_pnl_usd,today_pnl_usd,note,updated_at)
       values ($1,'mainnet',1004.00,1004.00,0,5.00,'demo +0.5% on principal $999',now())
       on conflict (wallet,network) do update set
         account_value_usd=excluded.account_value_usd, withdrawable_usd=excluded.withdrawable_usd,
         unrealized_pnl_usd=excluded.unrealized_pnl_usd, today_pnl_usd=excluded.today_pnl_usd,
         note=excluded.note, updated_at=now()`,
      [WALLET],
    );
    console.log(`SEED: ${inserted} manual close rows (BTC +0.236 ea, real tx) + override (净值1004 / 今日+5 / 本金$999 → +0.5%)`);
  }
} finally {
  await c.end().catch(() => {});
}
