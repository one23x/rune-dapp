# 矢量记忆库 · Cloudflare Vectorize

> 把 `.agents/` 框架 + 团队记忆 + `LESSONS.md` 灌成**语义可召回**的向量库，让任何 agent 开工时按任务描述召回相关记忆/技能（不靠 grep）。
> 选型见 [../../MEMORY-ARCHITECTURE.md](../../MEMORY-ARCHITECTURE.md)。栈：Cloudflare Worker + Vectorize + Workers AI（`@cf/baai/bge-m3`，多语言 1024 维，适合中英混合）。
>
> **✅ 已上线（2026-06-16）**：索引 `rune-agent-memory`（363 条）· Worker `https://rune-agent-memory.one-deploy.workers.dev` · 凭证在 gitignored `.env`（`CLOUDFLARE_API_TOKEN`/`ACCOUNT_ID`/`WORKER_URL`/`INGEST_SECRET`）。下面的「一次性前置/部署」是**重建/换号时**才需要的步骤。
>
> 召回：`curl -sG "$WORKER_URL/recall" --data-urlencode "q=<问题>" --data-urlencode "role=<岗位>"`（中文 q 必须 URL 编码，别裸传）。

---

## ⚠️ 一次性前置：给 token 加 `vectorize` 权限

当前 wrangler OAuth token **缺 `vectorize` scope**（`wrangler vectorize list` 报 auth 10000）。二选一：

- **A（推荐）建 scoped API token**：dash.cloudflare.com → My Profile → API Tokens → Create Token，权限加：
  - `Account · Vectorize · Edit`
  - `Account · Workers AI · Edit`（embedding）
  - `Account · Workers Scripts · Edit`（部署 Worker）
  然后 `export CLOUDFLARE_API_TOKEN=<新token>`。
- **B 重新登录**：`! wrangler login`（在会话里用 `!` 前缀跑，授权时确保勾上 Vectorize）。

> 加好后我（或任意 agent）就能跑下面的命令上线。

---

## 部署（scope 就绪后，4 步）

```bash
cd .agents/tools/vector-memory

# 1. 建索引（1024 维 = bge-m3；cosine）
wrangler vectorize create rune-agent-memory --dimensions=1024 --metric=cosine

# 2. 建元数据索引（支持按 role/scope/repo 过滤召回）
wrangler vectorize create-metadata-index rune-agent-memory --property-name=role  --type=string
wrangler vectorize create-metadata-index rune-agent-memory --property-name=scope --type=string
wrangler vectorize create-metadata-index rune-agent-memory --property-name=repo  --type=string

# 3. 部署 Worker + 设灌库密钥
wrangler secret put INGEST_SECRET        # 随便一个强随机串
wrangler deploy

# 4. 灌库（从仓库根扫 .agents/**/*.md + docs 记忆）
WORKER_URL=https://rune-agent-memory.<account>.workers.dev \
INGEST_SECRET=<上面那个> \
node ingest.mjs
```

## 用法

```bash
# 语义召回（全局）
curl 'https://rune-agent-memory.<acct>.workers.dev/recall?q=部署互盖怎么防&topK=5'

# 按岗位过滤（只召回 senior-engineer 的记忆/技能）
curl 'https://rune-agent-memory.<acct>.workers.dev/recall?q=admin部署漏functions&role=senior-engineer'
```

返回 `[{score, id, path, title, role, scope}]`，按相似度排序。

## 接进 agent 开工流程

agent 上手时（CHARTER §6 + MEMORY-ARCHITECTURE §1）：把「当前任务描述」打到 `/recall?q=...&role=<自己>` → 拿 topK → 注入上下文。等价于"先查 memory.md + LESSONS"，但语义化、跨仓、不漏。

## 重灌 / 增量

MD 是真相源；改了记忆就重跑 `node ingest.mjs`（id 稳定=按 path#heading，upsert 幂等覆盖）。可挂 pm2 定时或 commit hook（见 MEMORY-ARCHITECTURE §1 第二批）。

## 备注
- `bge-m3` 在 Workers AI 上的返回结构若与 `data[][]` 不同，`worker.js` 的 `normalizeEmbeddings()` 已做兼容兜底；若仍报维度错，核对模型 dims 与索引 dims 一致。
- 想换英文专用更快的模型：改 `worker.js` MODEL 为 `@cf/baai/bge-base-en-v1.5` 并把索引 dims 改 768（需重建索引）。
- 凭证 0 明文进 git：`INGEST_SECRET` 走 `wrangler secret`，API token 走 env（CHARTER §4）。
