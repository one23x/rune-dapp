// hl-account-state.mjs — Hyperliquid 账户现金状态 → Supabase trading_hl_account_state。
// 跑在美东生产机(与 hl-marks/sync 同目录,复用同一 .env 的 SUPABASE_DB_URL)。
// 直接 POST HL 公共 info API({type:"clearinghouseState"}),免费、不经引擎、不受引擎 cap。
// pm2 单实例,每 ACCT_INTERVAL_MS(默认 120s)对去重后的 (address, network) 全量 upsert。
//
// 解析查询地址集:trading_hl_copy_subscriptions(active) join trading_users,
//   HL 账户地址 = hl_mode='agent' ? hl_master_address : engine_eoa_address(custodial),
//   network 取 sub.network('mainnet'/'testnet')。按 (address, network) 去重。
// env:
//   SUPABASE_DB_URL   postgresql://postgres:***@db.<ref>.supabase.co:5432/postgres
//   ACCT_INTERVAL_MS  默认 120000(2 分钟);ONCE=1 跑一次即退出。
//   ACCT_CONCURRENCY  并发上限,默认 5。
//   ACCT_SUB_STATUSES 纳入的订阅状态(逗号分隔),默认 'active'。生产建议 'active,paused'
//                     以覆盖 paused-但已注资 的账户(admin 余额面板也要显示),成本极小。
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
const INTERVAL_MS = Number(process.env.ACCT_INTERVAL_MS || 120000);
const CONCURRENCY = Math.max(1, Number(process.env.ACCT_CONCURRENCY || 2)); // dex 查询使调用翻倍,降并发防 429
const SUB_STATUSES = (process.env.ACCT_SUB_STATUSES || "active")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ONCE = process.env.ONCE === "1";
if (!SUPABASE_DB_URL) { console.error("FATAL: need SUPABASE_DB_URL"); process.exit(1); }

const INFO_HOST = {
  mainnet: "https://api.hyperliquid.xyz/info",
  testnet: "https://api.hyperliquid-testnet.xyz/info",
};

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 单地址最多重试一次(应对 HL info 偶发 429),退避 800ms。
async function fetchStateRetry(wallet, network) {
  try { return await fetchState(wallet, network); }
  catch (e) { if (!/HTTP 429/.test(e.message)) throw e; await sleep(800); return fetchState(wallet, network); }
}

// 从 Supabase 读去重后的 (address, network)。地址按 dapp 口径解析,统一小写。
async function loadTargets(dst) {
  const { rows } = await dst.query(`
    select distinct
      lower(case when u.hl_mode = 'agent' then u.hl_master_address else u.engine_eoa_address end) as wallet,
      s.network as network
    from public.trading_hl_copy_subscriptions s
    join public.trading_users u on u.id = s.user_id
    where s.status = any($1::text[])
      and (case when u.hl_mode = 'agent' then u.hl_master_address else u.engine_eoa_address end) is not null
      and s.network in ('mainnet','testnet')
  `, [SUB_STATUSES]);
  return rows.filter((r) => r.wallet && r.wallet.startsWith("0x"));
}

// 只对**当前持有 builder dex(xyz:)仓**的钱包查 dex —— 多数户没有 dex,main 即全部。
// 大幅减少 HL 调用(避免 dex 翻倍触发 429)。查不到表则返回 null → 退回「全部查 dex」兜底。
async function loadDexWallets(dst) {
  const set = new Set();
  let any = false;
  // follower_address = engine_eoa(account_state 的 target 口径),最直接;再 union 视图各地址列兜全。
  for (const sql of [
    `select distinct lower(follower_address) w from public.trading_hl_real_positions where coin like 'xyz:%'`,
    `select distinct lower(engine_eoa_address) w from public.v_wallet_open_positions where symbol like 'xyz:%' and engine_eoa_address is not null`,
    `select distinct lower(wallet) w from public.v_wallet_open_positions where symbol like 'xyz:%'`,
  ]) {
    try {
      const { rows } = await dst.query(sql);
      for (const r of rows) if (r.w) set.add(r.w);
      any = true;
    } catch { /* 跳过该源 */ }
  }
  return any ? set : null; // 全失败→null→全查兜底
}

async function fetchClearing(url, address, dex) {
  const body = { type: "clearinghouseState", user: address };
  if (dex) body.dex = dex;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 主 perp + HIP-3 builder dex(xyz)聚合。账户把保证金划进 builder dex 交易(xyz:XYZ100 等)时,
// 主 clearinghouseState 看不到那部分 → 净值被严重低估(健康账户显示成巨亏)。聚合两者得真实总额。
// builder dex 仅主网有;查询失败/无则按 0,不影响主账户(2026-06-10 修)。
let dexWallets = null; // runOnce 填充:当前持 builder dex 仓的钱包集合(null=未知→全查兜底)

async function fetchState(address, network) {
  const url = INFO_HOST[network];
  const main = await fetchClearing(url, address);
  let dex = null;
  // 仅主网、且(未知集合 或 该钱包确有 dex 仓)才查 dex —— 省掉绝大多数无 dex 户的翻倍调用。
  if (network === "mainnet" && (dexWallets === null || dexWallets.has(address.toLowerCase()))) {
    // ⚠️ builder dex 查询失败(429/网络)时**不要**吞掉错误回退主-only —— 那会让净值在
    // 「主+dex 聚合 ↔ 主-only」间闪烁、误报巨亏。让错误抛出 → fetchStateRetry 按 429 重试 →
    // 仍失败则整账户本轮被 fetchAll 跳过(保留上次已聚合的值,不覆盖成低值)。
    // 无 dex 资金的账户:xyz 查询返回正常 200(accountValue 0),不抛错,照常聚合。
    await sleep(150); // 主/dex 两次调用间隔,平滑速率
    dex = await fetchClearing(url, address, "xyz");
  }
  const ms = main.marginSummary || {};
  const dms = (dex && dex.marginSummary) || {};
  const add = (a, b) => {
    const x = num(a), y = num(b);
    if (x === null && y === null) return null;
    return (x ?? 0) + (y ?? 0);
  };
  return {
    account_value_usd: add(ms.accountValue, dms.accountValue),
    withdrawable_usd: add(main.withdrawable, dex && dex.withdrawable),
    margin_used_usd: add(ms.totalMarginUsed, dms.totalMarginUsed),
    total_ntl_pos_usd: add(ms.totalNtlPos, dms.totalNtlPos),
  };
}

async function upsertOne(dst, wallet, network, s) {
  await dst.query(
    `insert into public.trading_hl_account_state
       (wallet, network, account_value_usd, withdrawable_usd, margin_used_usd, total_ntl_pos_usd, as_of)
     values ($1,$2,$3,$4,$5,$6,now())
     on conflict (wallet, network) do update set
       account_value_usd = excluded.account_value_usd,
       withdrawable_usd  = excluded.withdrawable_usd,
       margin_used_usd   = excluded.margin_used_usd,
       total_ntl_pos_usd = excluded.total_ntl_pos_usd,
       as_of             = now()`,
    [wallet, network, s.account_value_usd, s.withdrawable_usd, s.margin_used_usd, s.total_ntl_pos_usd],
  );
}

// 小并发池跑 HTTP 拉取(≤CONCURRENCY 并发,单地址失败 try/catch 跳过不中断整轮);
// DB upsert 全程串行走单连接(避免 pg 单 client 并发查询告警)。
async function fetchAll(targets) {
  const results = []; let i = 0, fail = 0;
  async function next() {
    while (i < targets.length) {
      const t = targets[i++];
      try { results.push({ ...t, state: await fetchStateRetry(t.wallet, t.network) }); }
      catch (e) { fail++; console.error(`  skip ${t.wallet}/${t.network}: ${e.message}`); }
      await sleep(280); // 间隔(dex 翻倍调用后加大,防 429;cycle 2min 足够)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, next));
  return { results, fail };
}

async function runOnce() {
  const t0 = Date.now();
  const dst = new pg.Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await dst.connect();
  try {
    const targets = await loadTargets(dst);
    dexWallets = await loadDexWallets(dst); // 只对持 dex 仓的钱包查 dex
    const { results, fail } = await fetchAll(targets);
    for (const { wallet, network, state } of results) await upsertOne(dst, wallet, network, state);
    console.log(`[${new Date().toISOString()}] acct ${Date.now() - t0}ms`,
      JSON.stringify({ targets: targets.length, dexWallets: dexWallets ? dexWallets.size : "all", ok: results.length, fail }));
  } finally {
    await dst.end().catch(() => {});
  }
}

async function loop() {
  try { await runOnce(); } catch (e) { console.error(`[${new Date().toISOString()}] acct error:`, e.message); }
  if (ONCE) return;
  setTimeout(loop, INTERVAL_MS);
}
loop();
