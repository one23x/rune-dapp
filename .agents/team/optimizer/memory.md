# MEMORY · 优化师 Optimizer

> 先查这里 + `docs/journey/LESSONS.md` + `docs/ops/RUNBOOK.md`。

## 限流 / 容量（429 是头号敌人）
- **L007 第三方节点按类型路由**：Alchemy HL 只代理 clearinghouseState/spot/meta，userFills/allMids/exchange 404/422。架构=按 host 分桶限流 + 按类型路由（支持的走镜像降官方压力）。
- **HL_API_RATE 4/s + 按类型分流**（L005）：公共 API 429 是六层瘫痪之一。
- **批量下单权重**：IP 限流 1+floor(n/40)，address 级 1 USDC=1 请求，两个都要对。
- **HL 余额/标记价走 sync 脚本进 Supabase**，别实时打引擎撞每日 cap（曾 10517/10000）。临时把 apiDailyCap 调 1 亿解封是治标，护栏关了要盯消耗。

## 推理接线
- **shadow 模式 = 调 endpoint + 记 ai_inferences + 永远 return null**（mirror-only），`HL_COPY_MIN_RANKER_SCORE=0` 不拦单。已验证延迟 80–120ms、0 错误。开 gate（设 0.45）要 ml-trainer 的 shadow 验证 + 用户拍板。
- **ONNX in-process**：导出 XGBoost 到 ONNX 干掉 SageMaker 往返，是 P4 的延迟优化项（可选）。

## DB / 池
- **PgBouncer 必 `prepare:false`**（transaction pooling 下 prepared statement 会爆）。
- **pm2 改 env** `restart --update-env` 不生效 → `pm2 delete && start && save`。

## 单实例铁律（别为并行牺牲正确性）
- HL copy executor 跨机无去重，分片要保证每副本独占 shard。PM 走 SQS FIFO 去重。worker 角色 `replicas:1`。

## 链接
- ml-trainer memory（训练侧）/ data-engineer memory（RDS/Redis）
- RUNBOOK「跟单执行器拓扑 + 运维定时器」
