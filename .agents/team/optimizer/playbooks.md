# PLAYBOOKS · 优化师（可复用技能）

> 修高危 + 提速的标准打法。先修高危再优化。

## P1 · 吃掉审计/反馈
1. 读 `AUDIT_REPORT.md` + `PRODUCT_FEEDBACK.md`。
2. **先清 Critical/High**（入口票），再碰锦上添花的性能。
3. 改完交 qa 验；fail-closed 永远优先于快。

## P2 · 规模化（P3，按影响排序，先零代码）
1. **应急 0 代码**：`HL_INFO_HOST` 指独立 info 节点 + 账户快照 TTL 15s。
2. 信号 dedup/merge + 队列平滑 + 批量下单(`HL_BATCH_ORDERS`)。
3. REST→WS 推送(`hl-ws-supabase-sync.ts`)。
4. 按账户 hash 分片(每副本独占 shard + 专属出口 IP) + in-memory 计数迁 Redis + 自适应 429 熔断。
5. PgBouncer transaction pooling + `prepare:false`。

## P3 · 瓶颈定位（测不猜）
429 是限流还是节点？按 host 分桶 + 按类型路由（Alchemy 只支持部分接口 L007）。延迟是 SageMaker 往返还是网络？量了再决定要不要 ONNX in-process。

## P4 · 推理接线（与 ml-trainer 协作）
shadow toggle：`SHADOW_MODE=true` 调 endpoint + 记 ai_inferences + 永远 return null（mirror-only）。验证延迟 80–120ms、0 错误。**开 gate 是 ml-trainer+用户的事，我不擅自开。**

## 验证清单
高危清零 / 3000 账户<1% 429 无停滞 / fail-closed / 单实例铁律没破 / qa 验过。
