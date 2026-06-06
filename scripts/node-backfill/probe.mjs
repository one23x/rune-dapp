// Read-only probe for the Arbitrum node-NFT backfill task.
// Verifies: which thirdweb server wallets exist, who is admin/owner of the
// Edition Drop, the current active claim condition per tier (price must stay
// intact), and per-tier totalSupply. NO transactions are sent here.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// minimal .env loader (no dotenv dependency) — reads repo-root .env
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
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { arbitrum } from "thirdweb/chains";
import {
  getActiveClaimCondition,
  totalSupply,
  balanceOf,
} from "thirdweb/extensions/erc1155";

const SECRET_KEY =
  process.env.THIRDWEB_SECRET_KEY || process.env.VITE_THIRDWEB_SECRER_KEY;
const ACCESS_TOKEN = process.env.THIRDWEB_VALUE_ACCESS_TOKEN;
const ENV_SERVER_WALLET = process.env.THIRDWEB_SERVER_WALLET;
const DROP = "0x9D296E2A959a3f584500913f19a0Dc2dfC7307a1";
const BRIEF_WALLET = "0x36f870980a8a4b951714399e0131B6486eE013A8";

const client = createThirdwebClient({ secretKey: SECRET_KEY });
const contract = getContract({ client, chain: arbitrum, address: DROP });

console.log("=== ENV ===");
console.log("VITE_THIRDWEB_SECRER_KEY present:", !!SECRET_KEY);
console.log("THIRDWEB_VALUE_ACCESS_TOKEN present:", !!ACCESS_TOKEN);
console.log("THIRDWEB_SERVER_WALLET (env):", ENV_SERVER_WALLET);
console.log("brief wallet            :", BRIEF_WALLET);

// 1) List the project's server wallets via thirdweb API
console.log("\n=== thirdweb server wallets (API) ===");
try {
  const res = await fetch("https://api.thirdweb.com/v1/wallets/server", {
    headers: { "x-secret-key": SECRET_KEY },
  });
  console.log("status", res.status);
  const body = await res.text();
  console.log(body.slice(0, 2000));
} catch (e) {
  console.log("server-wallet list error:", e.message);
}

// 2) On-chain owner / DEFAULT_ADMIN_ROLE holder check for both candidate wallets
console.log("\n=== on-chain admin/owner ===");
try {
  const owner = await readContract({
    contract,
    method: "function owner() view returns (address)",
  });
  console.log("owner():", owner);
} catch (e) {
  console.log("owner() error:", e.message);
}
const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
for (const w of [ENV_SERVER_WALLET, BRIEF_WALLET]) {
  try {
    const has = await readContract({
      contract,
      method:
        "function hasRole(bytes32 role, address account) view returns (bool)",
      params: [DEFAULT_ADMIN_ROLE, w],
    });
    console.log(`hasRole(DEFAULT_ADMIN, ${w}):`, has);
  } catch (e) {
    console.log(`hasRole check ${w} error:`, e.message);
  }
}

// 3) Per-tier active claim condition (price/supply) + totalSupply
console.log("\n=== per-tier state (tokenId 0..5) ===");
for (let id = 0n; id <= 5n; id++) {
  let line = `token ${id}: `;
  try {
    const cc = await getActiveClaimCondition({ contract, tokenId: id });
    line += `price=${cc.pricePerToken} currency=${cc.currency} perWallet=${cc.quantityLimitPerWallet} maxSupply=${cc.maxClaimableSupply} claimed=${cc.supplyClaimed} merkle=${cc.merkleRoot.slice(0, 10)}`;
  } catch (e) {
    line += `getActiveClaimCondition ERROR: ${e.message.split("\n")[0]}`;
  }
  try {
    const ts = await totalSupply({ contract, id });
    line += ` | totalSupply=${ts}`;
  } catch (e) {
    line += ` | totalSupply ERROR`;
  }
  console.log(line);
}

console.log("\nProbe done (read-only, no tx sent).");
