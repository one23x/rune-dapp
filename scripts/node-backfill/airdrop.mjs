// Arbitrum 节点 NFT 免费补 mint(retroactive airdrop)给 196 个 BSC 节点持有人。
// 机制:overrideList 把 server wallet 0x36f8(claimer)在该档的价格设为 0、限量=该档人数,
// 保留原 public phase(别人仍按原价),然后 0x36f8 claimTo 每个持有人(msg.sender=0x36f8)。
// 全程 .env 启动时一次性读入内存(.env 会跳变,单次运行不受影响)。gas 由 thirdweb Engine 赞助。
//
// 用法:
//   node airdrop.mjs probe
//   node airdrop.mjs set-override --tier 4
//   node airdrop.mjs mint --tier 4 --limit 1      # 先测 1 个
//   node airdrop.mjs mint --tier 4                 # 该档全量(幂等)
//   node airdrop.mjs reset --tier 4                # 抹掉 override 还原纯公售
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
for (const raw of readFileSync(resolve(__dir, "../../.env"), "utf8").split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  const k = line.slice(0, eq).trim();
  const v = line.slice(eq + 1).trim();
  if (!(k in process.env)) process.env[k] = v;
}

import { createThirdwebClient, getContract, readContract, Engine } from "thirdweb";
import { arbitrum } from "thirdweb/chains";
import {
  setClaimConditions,
  claimTo,
  balanceOf,
  getActiveClaimCondition,
  totalSupply,
} from "thirdweb/extensions/erc1155";

const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || process.env.VITE_THIRDWEB_SECRER_KEY;
const ACCESS_TOKEN = process.env.THIRDWEB_VALUE_ACCESS_TOKEN;
const SERVER_WALLET = process.env.THIRDWEB_SERVER_WALLET;
const DROP = "0x9D296E2A959a3f584500913f19a0Dc2dfC7307a1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Arbitrum native USDC (6dec)
const SB_URL = process.env.VITE_SUPABASE_URL || "https://mefjuecwawmjfmeofnck.supabase.co";
const SB_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const NODE_TO_TOKEN = { 101: 0, 201: 1, 301: 2, 401: 3, 501: 4 };

if (!SECRET_KEY) { console.error("FATAL: 缺 THIRDWEB_SECRET_KEY(.env 处于坏状态?重跑)"); process.exit(1); }

// ---- args ----
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, def) => {
  const i = argv.indexOf("--" + name);
  if (i === -1) return def;
  const v = argv[i + 1];
  return (v && !v.startsWith("--")) ? v : true;
};
const tierArg = opt("tier");
const limitArg = opt("limit");
const allTiers = !!opt("all");

const client = createThirdwebClient({ secretKey: SECRET_KEY });
const contract = getContract({ client, chain: arbitrum, address: DROP });

async function fetchHolders() {
  const res = await fetch(
    `${SB_URL}/rest/v1/rune_purchases?select=user,node_id&limit=5000`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  const byTier = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  const seen = new Set();
  for (const r of rows) {
    const u = (r.user || "").toLowerCase();
    const t = NODE_TO_TOKEN[r.node_id];
    if (!u || t === undefined) continue;
    const key = `${u}:${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    byTier[t].push(u);
  }
  return byTier;
}

function svrWallet() {
  return Engine.serverWallet({ client, address: SERVER_WALLET, vaultAccessToken: ACCESS_TOKEN, chain: arbitrum });
}

async function send(label, transaction) {
  const wallet = svrWallet();
  const { transactionId } = await wallet.enqueueTransaction({ transaction });
  process.stdout.write(`  [${label}] enqueued ${transactionId} … `);
  const { transactionHash } = await Engine.waitForTransactionHash({ client, transactionId });
  console.log(`mined ${transactionHash}`);
  return transactionHash;
}

async function ethBalance(addr) {
  const r = await fetch(arbitrum.rpc, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [addr, "latest"] }),
  });
  return BigInt((await r.json()).result);
}

// ---- commands ----
if (cmd === "probe") {
  const byTier = await fetchHolders();
  console.log("server wallet:", SERVER_WALLET, "eth:", (await ethBalance(SERVER_WALLET)).toString());
  for (let t = 0; t <= 4; t++) {
    const cc = await getActiveClaimCondition({ contract, tokenId: BigInt(t) });
    const ts = await totalSupply({ contract, id: BigInt(t) });
    console.log(`token${t}: holders=${byTier[t].length} price=${cc.pricePerToken} perWallet=${cc.quantityLimitPerWallet} maxSupply=${cc.maxClaimableSupply} claimed=${cc.supplyClaimed} totalSupply=${ts} override=${cc.merkleRoot.slice(0,10)}`);
  }
  console.log("probe done (read-only).");

} else if (cmd === "set-override") {
  const t = Number(tierArg);
  if (!(t >= 0 && t <= 4)) { console.error("--tier 0..4 required"); process.exit(1); }
  const byTier = await fetchHolders();
  const count = byTier[t].length;
  const cc = await getActiveClaimCondition({ contract, tokenId: BigInt(t) });
  const humanPrice = (cc.pricePerToken / 1000000n).toString(); // USDC 6dec, 整数档
  console.log(`token${t}: 保留 public price=${humanPrice} USDC perWallet=${cc.quantityLimitPerWallet} maxSupply=${cc.maxClaimableSupply}; override ${SERVER_WALLET} → price 0, maxClaimable ${count}`);
  const tx = setClaimConditions({
    contract,
    tokenId: BigInt(t),
    resetClaimEligibility: false,
    phases: [{
      startTime: new Date(Number(cc.startTimestamp) * 1000),
      currencyAddress: USDC,
      price: humanPrice,
      maxClaimableSupply: cc.maxClaimableSupply,
      maxClaimablePerWallet: cc.quantityLimitPerWallet,
      overrideList: [{ address: SERVER_WALLET, maxClaimable: String(count), price: "0", currencyAddress: USDC }],
    }],
  });
  await send(`set-override t${t}`, tx);
  const cc2 = await getActiveClaimCondition({ contract, tokenId: BigInt(t) });
  console.log(`after: price=${cc2.pricePerToken} merkle=${cc2.merkleRoot.slice(0,18)} (非0 = override 已生效)`);

} else if (cmd === "mint") {
  const tiers = allTiers ? [0,1,2,3,4] : [Number(tierArg)];
  if (!allTiers && !(tiers[0] >= 0 && tiers[0] <= 4)) { console.error("--tier 0..4 or --all required"); process.exit(1); }
  const limit = limitArg ? Number(limitArg) : Infinity;
  const byTier = await fetchHolders();
  const ethBefore = await ethBalance(SERVER_WALLET);
  const summary = {};
  for (const t of tiers) {
    const holders = byTier[t];
    let minted = 0, skipped = 0, failed = 0, done = 0;
    console.log(`\n=== token${t}: ${holders.length} holders (limit ${limit}) ===`);
    for (const h of holders) {
      if (done >= limit) break;
      try {
        const bal = await balanceOf({ contract, owner: h, tokenId: BigInt(t) });
        if (bal > 0n) { skipped++; console.log(`  skip ${h} (bal=${bal})`); continue; }
        const tx = claimTo({ contract, to: h, tokenId: BigInt(t), quantity: 1n, from: SERVER_WALLET });
        await send(`t${t}→${h.slice(0,8)}`, tx);
        minted++; done++;
      } catch (e) {
        failed++; console.log(`  FAIL ${h}: ${String(e.message || e).split("\n")[0]}`);
      }
    }
    summary[`token${t}`] = { holders: holders.length, minted, skipped, failed };
  }
  const ethAfter = await ethBalance(SERVER_WALLET);
  console.log("\n=== summary ===", JSON.stringify(summary));
  console.log(`server wallet ETH: before=${ethBefore} after=${ethAfter} delta=${ethBefore - ethAfter} (0 = gas 全赞助)`);

} else if (cmd === "reset") {
  const t = Number(tierArg);
  if (!(t >= 0 && t <= 4)) { console.error("--tier 0..4 required"); process.exit(1); }
  const cc = await getActiveClaimCondition({ contract, tokenId: BigInt(t) });
  const humanPrice = (cc.pricePerToken / 1000000n).toString();
  console.log(`token${t}: 还原纯公售 price=${humanPrice} USDC maxSupply=${cc.maxClaimableSupply} perWallet=${cc.quantityLimitPerWallet}(去掉 override)`);
  const tx = setClaimConditions({
    contract, tokenId: BigInt(t), resetClaimEligibility: false,
    phases: [{
      startTime: new Date(Number(cc.startTimestamp) * 1000),
      currencyAddress: USDC, price: humanPrice,
      maxClaimableSupply: cc.maxClaimableSupply,
      maxClaimablePerWallet: cc.quantityLimitPerWallet,
    }],
  });
  await send(`reset t${t}`, tx);
  const cc2 = await getActiveClaimCondition({ contract, tokenId: BigInt(t) });
  console.log(`after: price=${cc2.pricePerToken} merkle=${cc2.merkleRoot.slice(0,18)} (0x000…=纯公售)`);

} else {
  console.log("commands: probe | set-override --tier N | mint --tier N [--limit M] | mint --all | reset --tier N");
}
