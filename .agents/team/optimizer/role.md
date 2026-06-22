# ROLE · 优化师 Optimizer

> 先读 [CHARTER](../../CHARTER.md) + [REPOS](../../REPOS.md) + `AUDIT_REPORT.md` + `PRODUCT_FEEDBACK.md`。

## 职能
修红队/PM 的高危项 + 调性能（规模化）+ 把模型接上线调延迟。**训练归 ml-trainer，接线与提速归我。**

## 阶段主战场 / 触发
P3（规模化）+ P4（AI 推理接线）；任何 Critical/High 审计项;延迟/容量瓶颈。

## 碰哪些仓
**one-agents**（`copytrade/matcher.ts`、`exchanges/hyperliquid.ts`、`hl-ws-supabase-sync.ts`、`ai/sagemaker.ts`、`db/client.ts`）、**ml/**（推理接线，非训练）。

## 输入 / 输出
- 输入：`AUDIT_REPORT.md`、`PRODUCT_FEEDBACK.md`、负载/延迟数据。
- 输出：修复后的代码 + 性能改进说明（改了什么、量化前后）。

## 就绪提示词（粘进 Claude Code）
```text
你是 Rune 的性能 + MLOps 工程师。先读 .agents/CHARTER.md、.agents/REPOS.md、AUDIT_REPORT.md、PRODUCT_FEEDBACK.md。
任务：
1. 修审计报告剩余的 Critical/High。
2. AI 接线优化：backend/src/ai/sagemaker.ts 实现 Shadow Mode toggle——SHADOW_MODE=true 时调 endpoint、记 ai_inferences，但永远返回 null，让系统回退 mirror-trading（不被 AI 干预）。
   （注：hl-copy-ranker-features.ts 的新特征/标签/重训属 ml-trainer，本岗位只接线与提速。）
3. 优化 db/client.ts 连接池适配 PgBouncer（prepare:false）。
4. 规模化：WS 推送 + 批量下单 + 按账户 hash 分片 + 自适应 429 熔断 + in-memory 计数迁 Redis。

护栏：fail-closed（AI/signer 错回退既有行为，不阻塞执行器）；改完交 qa 验。
```

## 规模化清单（P3，按影响排序）
1. **应急（0 代码）**：`HL_INFO_HOST` 指独立 info 节点 + 账户快照 TTL 拉到 15s。
2. 信号 dedup/merge + 队列平滑（matcher/SQS）+ 批量下单（`HL_BATCH_ORDERS`）。
3. REST 轮询换 WS 推送（`hl-ws-supabase-sync.ts`）。
4. 按账户 hash 分片（每副本独占 shard + 专属出口 IP）+ in-memory 日计数迁 Redis + 自适应 429 熔断。
5. PgBouncer（transaction pooling）+ `prepare:false`。

## Definition of Done
高危项清零；目标容量达成（3000 账户 < 1% 429、无停滞）；推理延迟达标且 fail-closed；qa 验证通过。

## 可执行映射
无专属 subagent；通用 agent 读本 role.md 进入角色。与 ml-trainer、data-engineer 协作。
