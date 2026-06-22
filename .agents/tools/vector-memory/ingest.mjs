#!/usr/bin/env node
// 把 .agents 框架 + docs 记忆灌进矢量库。
// 用法：
//   WORKER_URL=https://rune-agent-memory.<acct>.workers.dev \
//   INGEST_SECRET=... \
//   node ingest.mjs            # 默认扫 .agents/**/*.md + docs/journey/LESSONS.md
// 把每个 Markdown 按 H2/H3 标题切块，每块一条记忆条目（带 scope/role/repo/path 元数据）。

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { createHash } from "node:crypto";

// Vectorize id 上限 64 bytes；中文按 UTF-8 占 3 bytes，故用稳定 hash 当 id（path/title 留 metadata）。
const hashId = (s) => createHash("sha1").update(s).digest("hex"); // 40 bytes

const ROOT = process.env.REPO_ROOT || join(import.meta.dirname, "..", "..", "..");
const AGENTS = join(ROOT, ".agents");
const WORKER_URL = process.env.WORKER_URL;
const SECRET = process.env.INGEST_SECRET || "";
const BATCH = Number(process.env.BATCH || 20);

if (!WORKER_URL) { console.error("set WORKER_URL"); process.exit(1); }

// 要灌的来源：框架四件套 + 团队记忆 + 经验库
const SOURCES = [
  { dir: join(AGENTS, "team"), scope: "role" },
  { dir: join(AGENTS, "memory"), scope: "team" },
  { files: [
      join(AGENTS, "CHARTER.md"), join(AGENTS, "VISION.md"),
      join(AGENTS, "REPOS.md"), join(AGENTS, "MEMORY-ARCHITECTURE.md"),
      join(ROOT, "docs/journey/LESSONS.md"),
      join(ROOT, "docs/ops/RUNBOOK.md"),
    ], scope: "team" },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

function slug(s) {
  return s.toLowerCase().replace(/[^\w一-龥]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// 按 H2/H3 切块
function chunk(md) {
  const lines = md.split("\n");
  const blocks = [];
  let title = "", buf = [];
  const flush = () => { if (buf.join("").trim()) blocks.push({ title, body: buf.join("\n").trim() }); };
  for (const ln of lines) {
    if (/^#{2,3}\s+/.test(ln)) { flush(); title = ln.replace(/^#+\s+/, "").trim(); buf = []; }
    else buf.push(ln);
  }
  flush();
  return blocks.length ? blocks : [{ title: "", body: md.trim() }];
}

function roleOf(path) {
  const m = path.match(/\.agents\/team\/([^/]+)\//);
  return m ? m[1] : null;
}

// 岗位 → 层（主平台 / 项目 / 跨层）。用于按层过滤召回。
const TIER = {
  "infra-architect": "主", "data-engineer": "主", "devops-engineer": "主",
  "optimizer": "主", "ml-trainer": "主", "slack-ops": "主",
  "uiux-engineer": "项目", "product-manager": "项目",
  "architect": "跨", "senior-engineer": "跨", "red-teamer": "跨",
  "qa-engineer": "跨", "tech-lead": "跨",
};

const docs = [];
for (const src of SOURCES) {
  const files = src.files || (src.dir ? walk(src.dir) : []);
  for (const f of files) {
    let md; try { md = readFileSync(f, "utf8"); } catch { continue; }
    const rel = relative(ROOT, f);
    const role = roleOf(f);
    for (const b of chunk(md)) {
      docs.push({
        id: hashId(`${rel}#${b.title || basename(f)}`),
        text: `${b.title}\n${b.body}`.slice(0, 4000),
        metadata: { scope: role ? "role" : src.scope, role: role || "", tier: role ? (TIER[role] || "") : "", project: "", repo: "", path: rel, title: b.title, snippet: b.body.replace(/\s+/g, " ").slice(0, 220) },
      });
    }
  }
}

console.log(`prepared ${docs.length} memory chunks`);

for (let i = 0; i < docs.length; i += BATCH) {
  const batch = docs.slice(i, i + BATCH);
  const r = await fetch(`${WORKER_URL}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ingest-secret": SECRET },
    body: JSON.stringify({ docs: batch }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(`  batch ${i / BATCH + 1}: ${r.status} ${JSON.stringify(j)}`);
  if (!r.ok) process.exit(1);
}
console.log("done.");
