# 北极星 · 完整系统目标（VISION）

> 这套 agents 不是为某一次升级服务的。它服务于**一个完整系统的全生命周期**。任何 agent 在判断"这件事重不重要"时，先对照这里。

---

## 我们要建成的东西（一句话）

**一个从前端 UIUX，到高并发、低延迟的 AI 智能交易跟单引擎，支撑智能体持续训练升级、承载数千会员真金跟单交易的完整系统。**

拆成四条贯穿全栈的主轴：

| 主轴 | 含义 | 主责岗位 |
|---|---|---|
| **① 前端 UIUX** | 会员能看懂、信任、顺畅操作的界面：设计系统、移动端、动效、费用透明、防穿帮 | uiux-engineer · product-manager · senior-engineer |
| **② 高并发低延迟 AI 交易跟单** | 数千账户的信号→下单链路秒级、429<1%、不漏不重；AI ranker 在线辅助 | optimizer · senior-engineer · infra-architect · data-engineer · ml-trainer |
| **③ 智能体训练升级** | 模型/智能体可持续训练、评估、灰度、上线：特征→标签→重训→drift→ONNX | ml-trainer · optimizer |
| **④ 数千会员跟单交易** | 真金、零资金事故、可结算（builder fee + HWM carry）、可运营、**可监控** | infra-architect · data-engineer · red-teamer · slack-ops · tech-lead |

> **主/项目分层**：**one-agents 是主平台**（引擎/ML/Worker/监控/运营，服务所有项目）；**Rune 等是跑在其上的项目**（租户皮肤 + 独立 Supabase + 会员）。监控面板 dashboard 属**主平台**（跨项目，⚠️待重建，横跨 ②④）；发布管线（devops-engineer）横跨全栈。详见 [REPOS.md](./REPOS.md)。

---

## Mission 与 Phase 的关系（别把战役当成全部）

- **VISION = 不变的北极星**（上面四主轴）。
- **Mission = 通往北极星的一场战役**，放在 `missions/`。当前在打的 **Tech Upgrade**（v3 Vault 签名 / agent 模式+费用 / 规模化 / AI）就是其中一个 mission，**不是终点**。
- **Phase = mission 内部的阶段**（P1→P2→P3→P4），由 `docs/journey/ROADMAP.md` 跟踪。

> 提醒：当一份文档（如 `missions/tech-upgrade/`）只覆盖某次升级，**不要把它当成系统的全部目标**。它是四主轴在某个时间点的切片。

---

## 系统全景（四主轴 × 4 仓）

```
                    ┌─────────────── 北极星：完整系统 ───────────────┐
   ① 前端 UIUX        ② 高并发低延迟 AI 跟单      ③ 智能体训练       ④ 数千会员跟单
        │                      │                      │                  │
  rune-lastest(dapp)     one-agents(引擎)         one-agents/ml      infra + data + 运营
  admin-panel            ├ matcher 分片            ├ ranker 特征      ├ RDS/Redis 扩容
  rune-console           ├ WS 推送/批量            ├ 标签/重训        ├ worker 分片/多IP
  (设计系统/移动端)       ├ 429 熔断                ├ shadow→gate      ├ 会员账本/结算
                         └ v3 Vault 签名           └ ONNX 本地推理    └ Slack 运营中枢
```

四仓拓扑详见 [REPOS.md](./REPOS.md)；铁律/护栏见 [CHARTER.md](./CHARTER.md)。

---

## 每个岗位的标准四件套（"够用"的定义）

每个岗位一个文件夹，**4 个文件**：

| 文件 | 装什么 | 一句话 |
|---|---|---|
| `SOUL.md` | 人格与信念 | 我是谁、为何存在、绝不做什么 |
| `role.md` | 职责 + 就绪提示词 + 交接门 + DoD | 我干什么、怎么交接、什么算完成 |
| `playbooks.md` | 可复用操作剧本与技能 | 这类活的标准打法（"做 project 的技能"沉淀在这） |
| `memory.md` | 岗位记忆（接矢量记忆库） | 这个坑我踩过（详见 [MEMORY-ARCHITECTURE.md](./MEMORY-ARCHITECTURE.md)） |

> `playbooks.md` 是这次从 3 件套扩到 4 件套新增的——它承载**跨 project 复用的技能**，让团队在 one-agents/admin/console/dapp 之间换仓时打法一致、越做越快。

---

## 完成度自检（任何时候问自己）

- ① UIUX：会员能不能看懂费用、信不信得过数字、移动端顺不顺？
- ② 跟单：3000 账户负载下 429<1%、无停滞、不漏不重单？信号→下单秒级？
- ③ 训练：模型能不能持续重训、灰度、在线评估、drift 告警？
- ④ 会员：真金零事故、结算正确（builder fee+HWM）、可运营？

四条都能拍胸脯=逼近北极星。任一条心虚=那就是下一个 mission 的起点。
