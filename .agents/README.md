# one-agents 平台 · 智能体小组（Agent Team OS）

> **主平台 one-agents 的项目团队操作系统**：一组分工明确、可被人类和 Claude Code 反复调用的「岗位」，**跨主平台 + 各项目、跨多机统一行动、统一记录**，服务于一个**完整系统目标**（不是某一次升级）。
> **主（one-agents）** = 引擎/Worker/ML/监控/运营，服务所有项目；**项目（Rune、demo-rune…）** = 跑在平台上的租户。Rune 只是其中一个项目。
> **框架真相源 = `one-agents/.agents/`（主）**；各项目仓通过 [ADOPT.md](./ADOPT.md) 同步/引用同一套，做到「同样的行动、同样的记录」。（本地 `Rune-final/.agents/` 是编辑镜像。）

读完顺序（任何 agent 上手前）：**[VISION.md](./VISION.md)（北极星=完整系统目标） → [CHARTER.md](./CHARTER.md)（之魂+铁律+护栏） → [REPOS.md](./REPOS.md)（你在主还是项目、碰什么） → 自己岗位 `team/<role>/{SOUL,role,playbooks,memory}.md` → `docs/journey/ROADMAP.md` 当前阶段。**

---

## 框架结构

| 文件 | 作用 |
|---|---|
| [VISION.md](./VISION.md) | **北极星**：完整系统目标（前端 UIUX → 高并发低延迟 AI 跟单 → 智能体训练 → 数千会员）。 |
| [CHARTER.md](./CHARTER.md) | **团队之魂**：信念 + 铁律 + 护栏 + 行动与记录协议。每岗位继承。 |
| [REPOS.md](./REPOS.md) | **作战地图**：主（one-agents 平台）vs 项目（Rune 等）拓扑 + 部署/记录落点 + 岗位分布。 |
| [MEMORY-ARCHITECTURE.md](./MEMORY-ARCHITECTURE.md) · [tools/vector-memory/](./tools/vector-memory/) | 记忆怎么存/召回：MD 三层 → CF Vectorize 语义召回。 |
| [ADOPT.md](./ADOPT.md) | 项目/服务器怎么从主同步这套框架。 |
| `team/<role>/` | 13 个岗位，每个**四件套**：`SOUL` · `role` · `playbooks` · `memory`。 |
| `missions/` · `memory/` · `HANDOFF.md` | 战役剧本 + 共享记忆 + 上次 handoff。 |

---

## 岗位花名册（14 个岗位）

| # | 岗位 | 一句话职能 | 层 | 主轴 | 可执行 subagent |
|---|---|---|---|---|---|
| 1 | [architect](./team/architect/) | 读码、判依赖、出 `UPGRADE_PLAN.md` | 主/项目 | 全 | Plan/Explore |
| 2 | [infra-architect](./team/infra-architect/) | 盘点+升级基础设施(Terraform/AWS) | 主 | ②④ | — |
| 3 | [data-engineer](./team/data-engineer/) | 主库+Redis+项目 Supabase+同步管线 | 主 | ②④ | — |
| 4 | [devops-engineer](./team/devops-engineer/) | GitHub/PR/Actions+预览+生产部署(opsdev) | 主 | 全 | — |
| 5 | [senior-engineer](./team/senior-engineer/) | 按计划落代码(后端/引擎为主) | 主/项目 | ①② | **rune-dev** |
| 6 | [uiux-engineer](./team/uiux-engineer/) | 前端 UIUX+设计系统+移动端+防穿帮 | 项目 | ① | — |
| 7 | [red-teamer](./team/red-teamer/) | 对抗式找漏洞/竞态/安全洞 | 主/项目 | 全 | **rune-audit** |
| 8 | [qa-engineer](./team/qa-engineer/) | 写/跑测试证明可用+漏洞已堵 | 主/项目 | 全 | **rune-test** |
| 9 | [product-manager](./team/product-manager/) | 模拟用户反馈/UX/费用透明 | 项目 | ①④ | — |
| 10 | [optimizer](./team/optimizer/) | 修高危+调性能(规模化)+推理接线 | 主 | ②③ | — |
| 11 | [ml-trainer](./team/ml-trainer/) | 模型/智能体训练(特征/标签/重训/drift) | 主 | ③ | — |
| 12 | [tech-lead](./team/tech-lead/) | 编排全队/守门/进度/`EXECUTIVE_SUMMARY` | 主/项目 | 全 | Master/主会话 |
| 13 | [slack-ops](./team/slack-ops/) | Slack 运营中枢(Lists/审批/进度同步) | 主 | ④ | `slack-agent/` |
| 14 | [i18n-translator](./team/i18n-translator/) | 多语言覆盖+补缺 key+对齐 parity+防硬编码中文 | 项目 | ① | — |

> 层：**主** = one-agents 平台级（服务所有项目）；**项目** = 某个租户项目内（Rune 等）。主轴见 [VISION](./VISION.md)。
> 岗位 5/7/8 已在 `.claude/agents/` 有可 spawn 的 subagent（rune-dev/audit/test，正文薄壳指回这里）。

---

## 主 vs 项目：谁干主平台的活，谁干项目的活

- **主（one-agents 平台）**：引擎/签名/执行（senior-engineer·red-teamer）、ML 训练（ml-trainer）、性能与规模化（optimizer·infra-architect）、主库与同步（data-engineer）、发布管线（devops-engineer）、监控 dashboard、Slack 运营（slack-ops）。**改一次，所有项目受益。**
- **项目（Rune = rune-dapp/admin/console；demo-rune…）**：各项目前端 UIUX（uiux-engineer）、用户反馈（product-manager）、项目数据落各自 Supabase。**每个项目独立皮肤 + 独立会员。**

**统一记录**（主 + 所有项目同一套，CHARTER §6）：进度 `docs/ops/PROGRESS.md`（Stop-hook 推 Slack）· 战报 `docs/journey/daily/` · 里程碑 `docs/journey/ROADMAP.md` · 踩坑 `docs/journey/LESSONS.md` · 决策 `docs/ops/DECISIONS.md` · 运维 `docs/ops/RUNBOOK.md`。

---

## 生命周期：一场战役（Mission）怎么跑

```
[tech-lead] 立项：VISION 对齐主轴 → ROADMAP 取阶段 → 选 missions/ 剧本
   │
[architect] 读码 → UPGRADE_PLAN.md（拆到文件级，标 feature flag）
   │   （并行：infra-architect 容量 · data-engineer 主库/schema · uiux 设计系统）
   ▼  对每个 Phase：
   ┌────────────────────────────────────────────────────────────────────────┐
   │ [senior-engineer / uiux-engineer] 落代码（flag 默认旧行为；留回滚）      │
   │   → [red-teamer] 对抗审 → AUDIT_REPORT.md（任一 BLOCK 回退）            │
   │   → [qa-engineer] 写/跑测试 → 证明可用 + 漏洞已堵                       │
   │   → [product-manager] 模拟用户反馈（费用/UX 相关阶段）                  │
   │   → [optimizer / ml-trainer] 修高危 + 调性能/训模型                    │
   │   → [devops-engineer] PR→CI→预览→(用户确认)生产部署，防互盖+可回滚      │
   │   → 验证门：testnet → 10 户 canary → 通过即进下一 Phase                 │
   └────────────────────────────────────────────────────────────────────────┘
   │
[tech-lead] EXECUTIVE_SUMMARY.md + 更新 ROADMAP/PROGRESS
   │
[slack-ops] 里程碑/进度同步到 Slack Lists 与频道
```

铁律：**dev → testnet → 10 户 canary → 全量**，生产变更只在用户开窗内做；任一环不过则回退，不跳过。

---

## 给 Agent 的 5 条硬约定（详见 CHARTER）

1. **开工前**读 VISION + CHARTER + REPOS + 自己岗位四件套 + ROADMAP 当前阶段。
2. **遇问题先查**自己 `memory.md`/`playbooks.md` → `LESSONS.md` → `docs/ops/memos/`（或矢量库 `/recall`）。
3. **修完非平凡问题**：`LESSONS.md` 追一条 + 岗位相关固化进自己 `memory.md`/`playbooks.md`。
4. **收尾**：成果写 `daily/`，里程碑勾 `ROADMAP` + `PROGRESS`（两边都更）。
5. **写给零上下文的读者**：地址、分支、文件路径、commit 写全。
