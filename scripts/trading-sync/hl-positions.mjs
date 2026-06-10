// hl-positions.mjs — Hyperliquid 真实账户持仓 → Supabase trading_hl_real_positions。
// 跑在美东机(与 trading-sync 同目录,复用 .env 的 SUPABASE_DB_URL)。
// 背景:v_wallet_open_positions 旧版读 copy-executor 镜像 trading_hl_positions,该镜像会
//   漂移(真实账户平仓后镜像不更新)→ dapp 显示幽灵持仓(实测 114 仓里 112 是 >1天的陈旧行)。
// 本脚本逐 follower 拉**真实** clearinghouseState(主 dex + builder dex),把当前真实持仓
//   upsert 进 trading_hl_real_positions,并删掉该 follower 已不再持有的币(=真实已平)。
//   视图改读这张真实表(见 hl-real-positions.sql)。
// ⚠️ 只增量维护**真实**表;手动层(trading_hl_manual_positions / *_overrides / source='manual'
//   的 trade_records)完全不碰——那些由 dapp applyHlAdjustments 在顶上叠加。
// builder dex 默认只查 POS_BUILDER_DEXES(默认 "xyz",平台唯一在用的 HIP-3 dex);
//   只管理"主+这些 dex"的币 → 不会误删未检查 dex 的仓(那些从不写入)。
// env: SUPABASE_DB_URL / POS_INTERVAL_MS(默认 60000)/ POS_REQ_GAP_MS(默认 200)/
//   POS_BUILDER_DEXES(逗号分隔,默认 xyz)/ ONCE=1 / DRY=1 / POS_FOLLOWER+POS_NET(定向)
// 注:写 Supabase 的 follower_address 列在 getFollowers / POS_FOLLOWER 处已统一小写,
//   根治大小写再污染;coin 非地址不动;HL info 用小写地址 OK(大小写不敏感)。
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
const INTERVAL_MS = Number(process.env.POS_INTERVAL_MS || 60000);
const REQ_GAP_MS = Number(process.env.POS_REQ_GAP_MS || 200);
const BUILDER_DEXES = (process.env.POS_BUILDER_DEXES || "xyz").split(",").map((s) => s.trim()).filter(Boolean);
const ONCE = process.env.ONCE === "1";
const DRY = process.env.DRY === "1";
if (!SUPABASE_DB_URL && !DRY) { console.error("FATAL: need SUPABASE_DB_URL"); process.exit(1); }

const HOSTS = {
  mainnet: "https://api.hyperliquid.xyz/info",
  testnet: "https://api.hyperliquid-testnet.xyz/info",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postInfo(host, body) {
  const res = await fetch(host, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${host} ${body.type}${body.dex ? "/" + body.dex : ""} → HTTP ${res.status}`);
  return res.json();
}

function mapPos(p) {
  const szi = Number(p.szi ?? 0);
  return {
    coin: String(p.coin ?? ""),
    size: szi,
    entry_px: p.entryPx != null ? Number(p.entryPx) : null,
    position_value: p.positionValue != null ? Number(p.positionValue) : null,
    unrealized_pnl: p.unrealizedPnl != null ? Number(p.unrealizedPnl) : null,
    leverage: p.leverage?.value != null ? Number(p.leverage.value) : null,
  };
}

// 真实持仓 = 主 dex + 各 builder dex 的 clearinghouseState(只取 szi≠0)
async function fetchRealPositions(host, follower) {
  const out = [];
  // 账户层汇总(跨主 dex + builder dex 累加)→ 写 trading_hl_accounts,admin/dapp 读表不实时打 HL
  const acct = { accountValue: 0, marginUsed: 0, withdrawable: 0 };
  const main = await postInfo(host, { type: "clearinghouseState", user: follower });
  acct.accountValue += Number(main.marginSummary?.accountValue ?? 0);
  acct.marginUsed += Number(main.marginSummary?.totalMarginUsed ?? 0);
  acct.withdrawable += Number(main.withdrawable ?? 0);
  for (const a of main.assetPositions ?? []) { const m = mapPos(a.position ?? {}); if (m.size !== 0) out.push(m); }
  for (const dex of BUILDER_DEXES) {
    try {
      const st = await postInfo(host, { type: "clearinghouseState", user: follower, dex });
      acct.accountValue += Number(st.marginSummary?.accountValue ?? 0);
      acct.marginUsed += Number(st.marginSummary?.totalMarginUsed ?? 0);
      acct.withdrawable += Number(st.withdrawable ?? 0);
      for (const a of st.assetPositions ?? []) { const m = mapPos(a.position ?? {}); if (m.size !== 0) out.push(m); }
    } catch (e) { /* 单 dex 失败跳过,不连累主 dex/其它 */ }
    await sleep(REQ_GAP_MS);
  }
  return { positions: out, account: acct };
}

async function getFollowers(dst) {
  const { rows } = await dst.query(`
    select distinct lower(s.follower_address) as follower_address, s.network, s.user_id
    from public.trading_hl_copy_subscriptions s
    where s.follower_address is not null and s.user_id is not null`);
  return rows;
}

async function syncFollower(dst, follower, network, userId) {
  const host = HOSTS[network === "testnet" ? "testnet" : "mainnet"];
  const { positions, account } = await fetchRealPositions(host, follower);
  const coins = positions.map((p) => p.coin);
  if (DRY) {
    console.log(`  [DRY] ${network} ${follower} → 持仓 ${positions.length} 净值 $${account.accountValue.toFixed(2)} 保证金 $${account.marginUsed.toFixed(2)}`);
    return positions.length;
  }
  // 账户层汇总 upsert
  await dst.query(
    `insert into public.trading_hl_accounts (follower_address, network, user_id, account_value, margin_used, withdrawable, positions_count, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,now())
     on conflict (follower_address, network) do update set
       user_id=excluded.user_id, account_value=excluded.account_value, margin_used=excluded.margin_used,
       withdrawable=excluded.withdrawable, positions_count=excluded.positions_count, updated_at=now()`,
    [follower, network, userId, account.accountValue, account.marginUsed, account.withdrawable, positions.length],
  );
  for (const p of positions) {
    await dst.query(
      `insert into public.trading_hl_real_positions
         (follower_address, network, coin, user_id, size, entry_px, position_value, unrealized_pnl, leverage, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       on conflict (follower_address, network, coin) do update set
         user_id=excluded.user_id, size=excluded.size, entry_px=excluded.entry_px,
         position_value=excluded.position_value, unrealized_pnl=excluded.unrealized_pnl,
         leverage=excluded.leverage, updated_at=now()`,
      [follower, network, p.coin, userId, p.size, p.entry_px, p.position_value, p.unrealized_pnl, p.leverage],
    );
  }
  // 删掉真实已平的币(只删本 follower/network 在真实表里、但当前真实账户已无的——纯真实表,不碰手动层)
  if (coins.length) {
    await dst.query(`delete from public.trading_hl_real_positions where follower_address=$1 and network=$2 and not (coin = any($3))`, [follower, network, coins]);
  } else {
    await dst.query(`delete from public.trading_hl_real_positions where follower_address=$1 and network=$2`, [follower, network]);
  }
  return positions.length;
}

async function runOnce() {
  const t0 = Date.now();
  let dst = null;
  if (!DRY) { const { default: pg } = await import("pg"); dst = new pg.Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } }); await dst.connect(); }
  try {
    let followers;
    if (process.env.POS_FOLLOWER) {
      followers = [{ follower_address: process.env.POS_FOLLOWER.toLowerCase(), network: process.env.POS_NET || "mainnet", user_id: null }];
    } else {
      followers = await getFollowers(dst);
    }
    let totalOpen = 0;
    for (const f of followers) {
      try { totalOpen += await syncFollower(dst, f.follower_address, f.network === "testnet" ? "testnet" : "mainnet", f.user_id); }
      catch (e) { console.error(`  ${f.network} ${f.follower_address} error: ${e.message}`); }
      await sleep(REQ_GAP_MS);
    }
    console.log(`[${new Date().toISOString()}] hl-positions ${Date.now() - t0}ms followers=${followers.length} openPositions=${totalOpen} dexes=[main,${BUILDER_DEXES.join(",")}]${DRY ? " (DRY)" : ""}`);
  } finally {
    if (dst) await dst.end().catch(() => {});
  }
}

async function loop() {
  try { await runOnce(); } catch (e) { console.error(`[${new Date().toISOString()}] hl-positions error:`, e.message); }
  if (ONCE) return;
  setTimeout(loop, INTERVAL_MS);
}
loop();
