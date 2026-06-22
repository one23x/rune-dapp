# 记忆架构 · 矢量记忆库 + 数据库（MEMORY-ARCHITECTURE）

> 目标（老板）：把这套 agents 的记忆**接入矢量记忆库 + 数据库**，并**优化"做 project 的技能"**。
> 现状记忆是分散的 Markdown（`.agents/memory/`、各岗位 `memory.md`、`docs/journey/LESSONS.md`、用户级 `~/.claude/.../memory/`）。本文档定义如何把它们升级成**可语义检索、跨仓共享、越用越强**的记忆系统。

---

## 0. 三层记忆（现在就有，先用好）

| 层 | 落点 | 范围 | 谁写 |
|---|---|---|---|
| **岗位记忆** | `.agents/team/<role>/memory.md` | 单岗位的坑与打法 | 该岗位修完坑 |
| **岗位技能** | `.agents/team/<role>/playbooks.md` | 单岗位可复用操作剧本 | 该岗位沉淀 |
| **团队记忆** | `.agents/memory/`（MD + 索引）+ `docs/journey/LESSONS.md` | 跨岗位的根因/架构事实/编号经验 | 谁踩谁记 |
| **平台记忆** | 用户级 `~/.claude/.../memory/` | 跨会话的基础设施/账号/拓扑 | 长期事实 |

**写入规则不变**（CHARTER §6）：修完非平凡坑 → LESSONS 追一条（编号 L###）+ 岗位相关固化进 `<role>/memory.md`。

---

## 1. 升级目标：矢量记忆库（语义召回，不靠 grep）

痛点：现在靠人 grep `LESSONS.md` 找前人踩没踩过。坑多了 grep 不全、关键词对不上就漏。
方案：把所有记忆条目 **embedding 化**，按语义相似度召回——"这个签名报错"能召回 L004/L017 即使措辞不同。

### 存哪（已定：Cloudflare Vectorize）
- **选型决定（2026-06-16）**：**Cloudflare Vectorize**（原生向量库，serverless，便宜）+ Workers AI `@cf/baai/bge-m3`（多语言 1024 维，适合中英混合记忆）。
  - **✅ 已上线（2026-06-16）**：索引 `rune-agent-memory`（1024 维 cosine，363 条记忆）+ Worker `https://rune-agent-memory.one-deploy.workers.dev`（`/recall` 语义召回，已验证中英文 + role 过滤；如 "429 限流"→optimizer 0.69、"费用透明"→product-manager 0.72）。
  - 元数据索引 `role`/`scope`/`tier` 支持按岗位/层（主/项目/跨）过滤召回；凭证在 gitignored `tools/vector-memory/.env`。
  - 重灌/增量：改了记忆重跑 `node ingest.mjs`（id=`sha1(path#title)`，upsert 幂等）。实现见 [`tools/vector-memory/`](./tools/vector-memory/)。
- **备选（若改走 DB）**：① AWS pgvector（rune-prod-pg 独立 schema `agent_mem`，零新成本但动生产库需授权）；② Supabase pgvector（与交易库物理隔离，符合 supabase-direct 偏好，需 project 凭证）。表结构建议：`id · scope · role · repo · title · body · source_path · lesson_id · tags[] · embedding · ts`，RLS public_read + admin_write + NOTIFY pgrst。

### 怎么进库（同步，不取代 MD）
- **MD 仍是真相源**（人可读、git 可 diff、可移植）。一个同步脚本把 MD 条目 upsert 进 `agent_memory` + 算 embedding（watermark 幂等，复用 data-engineer 的同步模式）。
- 触发：commit hook 或 pm2 定时；只对变更的 MD 重算 embedding。

### 怎么召回（写进岗位流程）
- agent 开工时，把"当前任务描述"embedding → 查 `agent_memory` top-K（按 scope/role/repo 过滤）→ 注入上下文。
- 等价于现在的"先查 memory.md + LESSONS"，但语义化、跨仓、不漏。

---

## 2. 优化"做 project 的技能"（playbooks → 技能库）

`playbooks.md` 是技能的 MD 形态。升级方向：

- **技能即记忆条目**：每个 playbook 的 P# 步骤作为一条 `agent_memory`（scope=role, tags=[skill, <repo>]），可被语义召回——"怎么安全部署 admin"直接召回 senior-engineer P2 + L015。
- **跨 project 复用**：技能按 `repo=null`（通用）或 `repo=<仓>`（专项）标注。换仓时召回通用技能 + 目标仓专项，打法一致、越做越快（这就是"统一行动"的技能侧）。
- **技能进化闭环**：playbook 用一次踩到新坑 → 更新 MD → 同步进库 → 下次召回的是更新版。LESSONS 的 L### 与 playbook 步骤交叉引用。

---

## 3. 落地分批（务实，别一步到位）

1. **第一批 ✅**：MD 三层记忆 + 4 件套已就位，写入/召回靠人按 CHARTER §6 流程。
2. **第二批 ✅（2026-06-16 已上线）**：CF Vectorize 索引 + Worker `/recall` + `ingest.mjs`（363 条已灌）。改了记忆重跑 ingest。
3. **第三批 ✅（2026-06-16）**：`recall-hook.sh`（Claude Code **UserPromptSubmit** hook，按 prompt 自动召回 top-K>0.55 注入上下文 + snippet，已注册 local + box `one-agents/.claude/settings.json`）；`reingest.sh` 挂 pm2 `vec-reingest`（每日 03:30 UTC 增量重灌，box 无 crontab 故用 pm2 --cron）。各项目仓要自动召回：把 hook 加进该仓 `.claude/settings.json`（命令同上）。

> 不破坏可移植性：MD 永远是真相源（ADOPT.md 的复制/同步照旧）；矢量库是**派生加速层**，丢了能从 MD 重建（同 DECISIONS D3 缓存哲学：派生数据可重建）。

---

## 4. 与现有系统的边界

- **不与交易数据混库**：`agent_memory` 是团队工具记忆，和 `trading.*` / `member_ledger` 业务数据分开（可同 Supabase 不同 schema）。
- **凭证不进记忆**：记忆里 0 明文 key（CHARTER §4），embedding 也不喂密钥。
- **平台记忆仍走用户级 `~/.claude/.../memory/`**：那是跨项目的，不进本 project 的 `agent_memory`（除非显式提升）。

## 链接
- 写入流程：[CHARTER.md](./CHARTER.md) §6 · 召回顺序：各 `team/<role>/memory.md` 头部
- 同步模式参考：data-engineer `playbooks.md` P1/P2 · 用户偏好：`rune-data-access-prefer-supabase-direct`
