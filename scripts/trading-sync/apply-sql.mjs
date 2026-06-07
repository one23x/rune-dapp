// apply-sql.mjs <file> — 用 .env 的 SUPABASE_DB_URL 执行一个 SQL 文件。
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const __dir = dirname(fileURLToPath(import.meta.url));
try { for (const raw of readFileSync(resolve(__dir, ".env"), "utf8").split("\n")) { const l = raw.trim(); if (!l || l.startsWith("#")) continue; const i = l.indexOf("="); if (i < 0) continue; const k = l.slice(0, i).trim(); if (!(k in process.env)) process.env[k] = l.slice(i + 1).trim(); } } catch {}
const file = process.argv[2];
if (!file) { console.error("usage: node apply-sql.mjs <file>"); process.exit(1); }
const sql = readFileSync(file, "utf8");
const { default: pg } = await import("pg");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try { await c.query(sql); console.log("applied:", file); }
finally { await c.end().catch(() => {}); }
