# UPGRADE_PLAN.md — Rune Tech Upgrade 执行计划

> **architect 产出**（2026-06-16），基于 SG dev `~/projects/one-agents/backend/src` 真实代码现状。engineer 照此执行；每步标 flag(默认旧行为) + 验证门 + 回滚。护栏见 [../../CHARTER.md](../../CHARTER.md) §2。
> 安全窗口：**当前执行器关闭（不跟单，`HL_COPY_EXECUTOR_ENABLED=false`）**——改签名/引擎不影响真实下单，是做 P1/P2 的好时机；但验证仍走 testnet→canary。

四目标 / 四阶段（连续，无日历，门过即进下一阶段）：**P1 签名迁移 → P2 agent 模式+费用 → P3 规模化 → P4 AI**。

---

## 现状评估（以代码为准，勿照搬文档）

| 主题 | 真实现状 | 差距 |
|---|---|---|
| **签名** | `engine/signer.ts` `engineAccount()` = viem LocalAccount，签名转发**v2 自托管 Engine**（`engine/client.ts`）；已有 in-process `local-signer` 优化（`HL_LOCAL_SIGNER_ENABLED`，绕 scrypt 重导）。被 6+ 模块用（testnet-trader/hl-spot-sweep/position-guard/risk-guardian/tpsl/execution-adapter）。 | `EngineV3Client`（`engine/v3-client.ts`）已存在但**仅 treasury 用**，**无 `signMessage`/`signTypedData` 方法**。 |
| **v3 配置** | `ENGINE_V3_URL`(默认 cloud)、`TREASURY_TW_SECRET_KEY`、`THIRDWEB_VAULT_ACCESS_TOKEN`、`TREASURY_SERVER_WALLET`(0x36f8) 都在 config。 | 需确认 HL 签名用哪个 v3 server wallet（每个 follower 钱包 vs 统一）。 |
| **HL EIP-712** | domain chainId **恒 1337**（主/测网靠 `source` 区分，非真实链 id）；`signatureChainId`(testnet `0x66eee`/mainnet `0xa4b1`)**只附在 action 体，不进签名 types/message**。 | v3 签名必须**字节级复刻**这套，否则 HL 拒签。 |
| **agent 模式/builder fee** | hyperliquid.ts 有完整 **HIP-3 builder DEX** 支持（这是 builder *DEX*，≠ 订单级 builder *fee*）。 | 未见订单级 `builder:{b,f}` 注入 / `agent` 模式分支 / `approveAgent`（P2 触点，进 P2 再细读）。 |
| **规模化** | `hl-ws-supabase-sync.ts`(143行) 已存在 WS 同步；`copytrade/matcher.ts`(542行)。 | 分片/批量/Redis 计数/429 熔断 待评估（进 P3 细读）。 |
| **AI** | `hl-copy-ranker-features.ts`(115行) + `ai/sagemaker.ts`(186行) 已上线 shadow，AUC 0.477（dashboard 实时监控）。 | 特征 12→30+ / 标签升级 / drift（部分已有 `ranker_shadow_daily`）。 |

---

## Phase 1 — thirdweb v3 Vault 签名迁移（安全）🎯 下一步

**Goal**：HL/PM 签名从 v2 自托管 Engine 迁到 v3 Vault（Nitro Enclaves）。无新供应商（取消 Privy）。

**入口条件**：v3 reachable（`ENGINE_V3_URL`）；`THIRDWEB_VAULT_ACCESS_TOKEN`+`TREASURY_TW_SECRET_KEY` 已配；v3 server wallet 已开通。

**步骤（文件级）**
1. **`engine/v3-client.ts`：加 `signMessage()` + `signTypedData()`**。
   - ⚠️ **先验证 v3 Cloud 签名端点**（thirdweb docs / `/v1/...sign...`）——这是唯一未定项，实现前 WebFetch 确认端点与 body 形状（server wallet sign typed-data/message via Vault）。
   - 接口对齐 v2：`signTypedData({ walletAddress, domain, types, primaryType, value, chainId })` → 返回 `0x` 签名；`signMessage({ walletAddress, message, isBytes })`。
2. **`engine/signer.ts`：加 `signerBackend` 开关**。
   - `engineAccount()` 内：`signTypedData`/`signMessage` 按 `config.HL_SIGNER_BACKEND`(`v2`|`v3`，**默认 `v2`**) 路由。`v3` → `engineV3().signTypedData(...)`；否则保持现状（含 local-signer 优化分支不动）。
   - 新增 `config.ts`：`HL_SIGNER_BACKEND: z.enum(["v2","v3"]).default("v2")`。
3. **HL EIP-712 chainId 复刻**：v3 路径必须保持 domain.chainId=1337、`signatureChainId` 只在 action 体——不改 `exchanges/hyperliquid.ts` 的签名构造，只换"谁来签"。v3 签出的地址必须 == follower 钱包。
4. **testnet dry-run**：`HL_SIGNER_BACKEND=v3` 在全新 testnet 账户签一笔 HL order，确认 HL `/exchange` 接受（签名地址匹配）。

**Flag**：`HL_SIGNER_BACKEND`（默认 `v2`）。
**出口条件**：testnet 50 连续单 via v3 签名（地址匹配、0 拒绝），THEN 10 户 mainnet canary 24h 0 拒绝、签名 p95<1s。
**回滚**：任何签名被 HL 拒 / 延迟 p95>1s → `HL_SIGNER_BACKEND=v2`（瞬时，无状态）。
**验证门**：50 testnet + 24h canary 0 拒绝 → 进 P2。
**交接**：engineer 改 v3-client/signer/config + tsc → red-teamer 审（vault token 暴露面 / v3 500 容错 / 签名地址校验）→ qa 写 signer.test.ts（mock v3，验 payload）+ testnet smoke。

---

## Phase 2 — Agent 模式 + 费用分成（营收）

**Goal**：账户 `custodial`→`agent`；启用 builder fee + 20% HWM carry。
**前置**：P1 稳；前端能引导 `approveAgent`+`approveBuilderFee`（主钱包签）。
**触点（进 P2 细读确认）**：`exchanges/hyperliquid.ts buildOrderAction()` 加 `agent` 分支，**仅 `mode=agent` 时**附顶层 `builder:{b,f}`（custodial 路径字节级不变）；`db/schema.ts` 接 `hlBuilderApprovedAt`/`hlBuilderMaxFeeBps`；`copytrade/fee-settlement.ts` 确认 HWM worker 跑 + 累计 `feeRateBps`(默认 2000=20%)；初始 builder fee 保守 0.03–0.05%（远低于 0.1% 上限）。
**Flag**：`HL_MODE`(account 级 custodial|agent)。**回滚**：账户回 custodial（自动丢 builder 字段）。
**门**：canary 全周期（开→平→HWM 累计→invoice）验证 → 进 P3。

---

## Phase 3 — 规模化引擎（可靠）

**Goal**：撑数千账户，灭 429 风暴 + 执行器停滞。
**步骤（按影响）**：①**今日/0 代码**：`HL_INFO_HOST` 指独立 info 节点 + 账户快照 TTL 15s。② `matcher.ts`/SQS 信号 dedup/merge + 批量下单（`HL_BATCH_ORDERS`）。③ REST→WS（`hl-ws-supabase-sync.ts`，部分已有）。④ 按账户 hash 分片（每副本独占 shard + 专属出口 IP）+ in-memory 日计数迁 Redis + 自适应 429 熔断。⑤ PgBouncer transaction pooling + `db/client.ts` 保 `prepare:false`。
**Flag**：`HL_WS_PUSH`/`HL_BATCH_ORDERS`。**门**：3000 模拟账户 <1% 429、无停滞、0 漏/重单 + canary 24h → 进 P4。
**铁律**：Worker 单实例（HL executor 跨机无去重）；dashboard 已监控 429/执行器/信号源。

---

## Phase 4 — AI 训练与推理（边际）

**Goal**：更强 ranker、安全灰度、低延迟。
**步骤**：① `hl-copy-ranker-features.ts` 12→30+ 维（市场态/leader 时序/微结构/拥挤/延迟）。② 标签 binary→风险调整收益（R-multiple）。③ `ai/sagemaker.ts` Shadow Mode（已部分有；invoke+记 `ai_inferences` 但 return null）。④ online-AUC drift（`ranker_shadow_daily` 已有，dashboard 已监控 AUC 0.477<0.5）。⑤ 可选 XGBoost→ONNX in-process。
**Flag**：`SHADOW_MODE`。**回滚**：AUC<基线→保持 shadow（当前正是此态，dashboard 告警中）。**门**：shadow online-AUC≥offline gate + drift 在线。

---

## 执行纪律
- dev(`ssh rune-sg ~/projects/one-agents`)→testnet→10 户 canary→全量；生产部署**用户开窗确认**（CHARTER §3）。
- 每阶段：engineer 落码(flag 默认旧) → red-teamer `AUDIT_REPORT.md` → qa 测+验证门 → (P2 涉费用)product-manager → optimizer/ml-trainer → 用户确认上生产。
- custodial 路径字节级不变 / fail-closed / 每步可回滚 / tsc 0 错 / 仅用户要求时提交推送。

## 下一步
**P1 步骤 1**：WebFetch 确认 thirdweb v3 Cloud 签名端点 → 在 `v3-client.ts` 加 `signMessage`/`signTypedData` → `signer.ts` 加 `HL_SIGNER_BACKEND` 开关 → testnet dry-run。
