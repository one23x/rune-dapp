# MEMORY · 架构师 Architect

> 岗位专属记忆。先查这里 + `docs/journey/LESSONS.md` + `docs/ops/memos/`。新坑修完追加。

## 架构既成事实（以代码为准，别照搬 plan doc）
- **dual-write 是 watermark-poll 不是 outbox**：`position-sync.ts` 按 `(projectId,table)` 水位 SELECT 新行 + PostgREST upsert，幂等可重启。**决定保留 watermark，扩表覆盖，别造平行 outbox**（v2 blueprint §1 已拍板）。
- **两库**：引擎=共享主库（RDS `trading`）；每 project 一个 Supabase。信号/价格/AI 读引擎，客户数据落 project 库。
- **RDS 双库**：`rune`（生产引擎读写）vs `postgres`（旧引擎遗留停在 5 月底）。读 trading 必连 `/rune`（CHARTER §1.5 / L002）。

## 依赖与排序教训
- **升级 4 目标的硬依赖**：签名(P1)稳→才开 agent 模式(P2)；规模化(P3)的 WS/分片要在小 cohort 稳了再上；AI(P4) 默认 shadow，AUC 不过保持 shadow。验证阶梯永远 testnet→10 户 canary→全量。
- **HIP-3 builder DEX 是独立子宇宙**（L006）：asset id=100000+dexIdx×10000+i；meta/allMids/clearinghouseState 必须带 `dex` 参数单查合并；下单前 sendAsset 划 USDC 进该 dex（独立保证金）。设计任何"统一 API 子宇宙"先实测：怎么列资源、id 怎么算、余额在哪个视图。
- **第三方节点别假设全兼容**（L007）：Alchemy HL 只代理 clearinghouseState/spot/meta，其余 404/422。架构预留"按 host 分桶限流 + 按类型路由"。

## 数据归属设计
- **归属必须有归属字段**（L009）：用集合交集推断"策略包归属"迟早误判 → `pack_key` 落库。
- **会员视图绑 `login_wallet`**（L002）：引擎记 smart/hl_master/login 三键，会员连登录钱包，面向用户视图按 login_wallet 绑。
- **会员账本虚拟化**：余额/持仓/盈亏全由 `member_ledger` 推导，唯一真锚=充值；admin 不直接写余额（member-ledger 设计 memo）。

## 链接
- 共享记忆：`.agents/memory/`（reskin-data-bindings 等）
- 蓝图：`docs/v2-master-execution-blueprint.md`（F1–F16 + critical path）
