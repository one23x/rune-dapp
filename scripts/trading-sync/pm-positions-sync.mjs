// pm-positions-sync.mjs — Polymarket 真实持仓同步(替代不可靠的 fills 推导)。
//
// 背景:引擎源表 trading.positions 空;fills 不可信(token/份额/价都能记错 —— 实测
//   一笔 fill 记成对手 token + 虚高份额)。唯一准确源 = 链上代理钱包 / Polymarket data-api。
//
// 流程(每个 PM 用户):
//   1) 引擎 pusd-balance → 拿 Polymarket 代理钱包(proxyWallet)+ pUSD 现金余额。
//      代理地址确定且稳定 → 缓存进 trading_pm_account_state.proxy_wallet,有缓存就不再打引擎。
//   2) Polymarket data-api positions?user=<代理> → 真实持仓(token=asset / 份额=size /
//      均价=avgPrice / 现价=curPrice / 已实现=realizedPnl / 是否可赎=redeemable)。
//   3) 写 Supabase:
//      - trading_positions:全量替换该用户的行(data-api 不再返回的=已赎回/平仓→自动删除)。
//      - trading_mark_prices(venue=polymarket, symbol=token, px=curPrice)→ 视图按此估值。
//      - trading_pm_account_state:代理 + 现金余额 + 持仓市值。
//   现有视图/rollup/admin 读 trading_positions 自动生效,前端无需改。
//
// 跑在美东生产机 pm2 单实例(复用 trading-sync/.env 的 SUPABASE_DB_URL)。ONCE=1 单次。

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
// 引擎代理(注入 ONE_AGENTS_API_KEY 的同源 CF Pages Function);可用直连 api.one-agents.com + key 覆盖。
const ENGINE_PROXY = (process.env.PM_ENGINE_PROXY || "https://rune-admin-mainnet.pages.dev/api/engine").replace(/\/+$/, "");
const DATA_API = "https://data-api.polymarket.com";
const INTERVAL_MS = Number(process.env.PM_INTERVAL_MS || 120000);
const CONCURRENCY = Number(process.env.PM_CONCURRENCY || 3);
const ONCE = process.env.ONCE === "1";
if (!SUPABASE_DB_URL) { console.error("FATAL: need SUPABASE_DB_URL"); process.exit(1); }

const num = (v) => (v == null || v === "" ? null : Number(v));

async function fetchJson(url, opts) {
  const res = await fetch(url, { ...opts, headers: { "user-agent": "rune-pm-sync", accept: "application/json", ...(opts?.headers || {}) } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/** 引擎拿 { proxyWallet, balanceUsd };失败返回 null(不中断整轮)。 */
async function getEngineAccount(userId) {
  try {
    const r = await fetchJson(`${ENGINE_PROXY}/trade/polymarket/users/${userId}/pusd-balance`);
    const proxy = r.smartWallet || r.proxyWallet || null;
    return { proxy: proxy ? String(proxy) : null, balanceUsd: num(r.balanceUsd) };
  } catch { return null; }
}

/** data-api 真实持仓;失败返回 null。 */
async function getPositions(proxy) {
  try {
    const r = await fetchJson(`${DATA_API}/positions?user=${proxy}`);
    return Array.isArray(r) ? r : [];
  } catch { return null; }
}

async function syncUser(client, u) {
  // 有缓存代理就复用,否则打引擎(代理地址稳定);余额每轮刷新。
  let proxy = u.proxy_wallet, balanceUsd = null;
  const acct = await getEngineAccount(u.user_id);
  if (acct) { proxy = acct.proxy || proxy; balanceUsd = acct.balanceUsd; }
  if (!proxy) return { user: u.user_id, skipped: "no_proxy" };

  const positions = await getPositions(proxy);
  if (positions === null) return { user: u.user_id, skipped: "data_api_fail" };

  await client.query("begin");
  try {
    // 全量替换该用户 PM 持仓(data-api 不返回的 = 已赎回/平仓 → 删掉)
    await client.query("delete from trading_positions where user_id=$1", [u.user_id]);
    let posVal = 0;
    for (const p of positions) {
      const size = num(p.size);
      if (size == null || Math.abs(size) < 1e-9) continue; // 0 份额不写(视图也会滤)
      posVal += num(p.currentValue) || 0;
      // 持仓行
      await client.query(
        `insert into trading_positions
           (user_id, token_id, market_id, net_shares, avg_entry_price, realized_pnl_usd,
            total_bought_usd, total_sold_usd, last_fill_at, settlement_status, updated_at, synced_at)
         values ($1,$2,$3,$4,$5,$6,$7,0,now(),$8,now(),now())
         on conflict (user_id, market_id, token_id) do update set
           net_shares=excluded.net_shares, avg_entry_price=excluded.avg_entry_price,
           realized_pnl_usd=excluded.realized_pnl_usd, total_bought_usd=excluded.total_bought_usd,
           settlement_status=excluded.settlement_status, updated_at=now(), synced_at=now()`,
        [u.user_id, String(p.asset), String(p.conditionId || ""), size, num(p.avgPrice),
         num(p.realizedPnl), num(p.initialValue), p.redeemable ? "resolved" : null]
      );
      // 标记价(供视图估值)
      if (num(p.curPrice) != null) {
        await client.query(
          `insert into trading_mark_prices (venue, symbol, px, as_of)
           values ('polymarket',$1,$2,now())
           on conflict (venue, symbol) do update set px=excluded.px, as_of=now()`,
          [String(p.asset), num(p.curPrice)]
        );
      }
    }
    // 账户状态(代理 + 现金 + 持仓市值)
    await client.query(
      `insert into trading_pm_account_state (user_id, wallet, proxy_wallet, balance_usd, positions_value_usd, as_of)
       values ($1,$2,$3,$4,$5,now())
       on conflict (user_id) do update set
         wallet=excluded.wallet, proxy_wallet=excluded.proxy_wallet,
         balance_usd=coalesce(excluded.balance_usd, trading_pm_account_state.balance_usd),
         positions_value_usd=excluded.positions_value_usd, as_of=now()`,
      [u.user_id, u.smart_wallet_address, proxy, balanceUsd, posVal]
    );
    await client.query("commit");
    return { user: u.user_id, positions: positions.length, balance: balanceUsd };
  } catch (e) {
    await client.query("rollback");
    return { user: u.user_id, error: String(e).slice(0, 120) };
  }
}

async function runOnce() {
  const t0 = Date.now();
  const client = new pg.Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    // PM 用户集 = 有过 PM fills 或 现有 PM 持仓 或 已建账户状态 的用户。
    const { rows: users } = await client.query(`
      select u.id as user_id, u.smart_wallet_address,
             s.proxy_wallet
      from trading_users u
      join (
        select user_id from trading_polymarket_fills where user_id is not null
        union select user_id from trading_positions
        union select user_id from trading_pm_account_state
      ) pm on pm.user_id = u.id
      left join trading_pm_account_state s on s.user_id = u.id
    `);
    const results = [];
    for (let i = 0; i < users.length; i += CONCURRENCY) {
      const batch = users.slice(i, i + CONCURRENCY);
      results.push(...await Promise.all(batch.map((u) => syncUser(client, u))));
    }
    const ok = results.filter((r) => r.positions != null).length;
    const fail = results.filter((r) => r.error || r.skipped).length;
    console.log(`[${new Date().toISOString()}] pm-positions-sync ${Date.now() - t0}ms users=${users.length} ok=${ok} fail=${fail}`);
    for (const r of results.filter((x) => x.error || x.skipped)) console.log("   skip/err:", JSON.stringify(r));
  } finally {
    await client.end();
  }
}

async function main() {
  await runOnce();
  if (ONCE) return;
  for (;;) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
    try { await runOnce(); } catch (e) { console.error("cycle error:", String(e).slice(0, 200)); }
  }
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
