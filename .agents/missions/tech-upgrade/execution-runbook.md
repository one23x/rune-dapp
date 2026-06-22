# Rune Tech Upgrade — Execution Runbook (执行预案)

This runbook converts the strategic decisions into a phased, time-sequenced execution plan with explicit entry/exit criteria, rollback triggers, and verification gates. It is the single source of truth that the Claude Code agent team follows.

Repo anchor: `one-agents/` (backend at `one-agents/backend`, ML at `one-agents/ml`).

---

## 0. Guardrails (Read Before Any Phase)

| Guardrail | Rule |
|---|---|
| **Test account first** | Every behavior change is validated on a fresh testnet account (to be provisioned by the owner) before any real account. |
| **Byte-for-byte custodial path** | Until agent mode is explicitly enabled, the custodial order payload MUST remain byte-for-byte identical (no `builder` field). |
| **Feature flags** | Every new behavior ships behind a flag (`HL_SIGNER_BACKEND`, `HL_MODE`, `HL_WS_PUSH`, `HL_BATCH_ORDERS`, `SHADOW_MODE`). Default = current behavior. |
| **Fail-closed** | AI/ranker errors and signer errors must fall back to existing behavior, never block or crash the executor. |
| **Staged rollout** | After testnet passes, roll out to a **10-account mainnet canary cohort**. No percentage-based ramp; the 10 mainnet accounts are the live validation gate before full fleet. |
| **Continuous execution** | No fixed calendar timeline. Each phase starts immediately once the previous phase's verification gate passes. |

---

## Phase 1 — thirdweb v3 Vault Signing Migration (Security)
**Goal**: Move HL/PM signing from v2 self-hosted Engine to v3 Vault (Nitro Enclaves). No new vendor.

**Entry criteria**: `v3-client.ts` reachable; `THIRDWEB_VAULT_ACCESS_TOKEN` + `TREASURY_TW_SECRET_KEY` set; a v3 server wallet provisioned.

**Steps**
1. Add a `signTypedData` / `signMessage` method to `EngineV3Client` (v3 Cloud `Signature` endpoint) if not present.
2. In `engine/signer.ts`, add a `signerBackend` switch (`v2` | `v3`) controlled by env `HL_SIGNER_BACKEND` (default `v2`).
3. Validate HL EIP-712 chainId handling (HL mainnet `source` vs `chainId` convention).
4. Dry-run on test account: sign one HL order via v3, confirm HL `/exchange` accepts it.

**Exit criteria**: Order filled on testnet via v3-signed payload (signed address matches expected wallet), THEN 10-account mainnet canary signs live orders with 0 rejections.

**Rollback trigger**: Any signature rejection by HL, or signing latency > 1s p95. → Flip `HL_SIGNER_BACKEND=v2`.

**Verification gate**: 50 consecutive testnet orders + 24h of clean signing across the 10 mainnet canary accounts (0 rejections). On pass → immediately start Phase 2.

---

## Phase 2 — Agent Mode + Fee Sharing (Revenue)
**Goal**: Switch trading accounts from `custodial` to `agent`; enable builder fee + 20% HWM carry.

**Entry criteria**: Phase 1 stable; frontend can prompt `approveAgent` + `approveBuilderFee` via user's main wallet.

**Steps**
1. Activate `agent` branch in `hyperliquid.ts buildOrderAction()` — attach top-level `builder:{b,f}` ONLY when `mode=agent`.
2. Wire `hlBuilderApprovedAt` / `hlBuilderMaxFeeBps` in `schema.ts` to the onboarding flow.
3. Confirm `copytrade/fee-settlement.ts` HWM worker actually runs and accrues `feeRateBps` (default 2000 = 20%).
4. Set initial builder fee conservatively (e.g., 0.03–0.05%, well under the 0.1% perp cap).

**Exit criteria**: Testnet agent-mode order carries builder fee and accrues HWM; THEN the 10 mainnet canary accounts run agent mode with builder fee + HWM accrual verified.

**Rollback trigger**: Builder fee rejected, or carry computed incorrectly. → Set account back to `custodial` (drops `builder` field automatically).

**Verification gate**: Full cycle on canary (open → close → HWM accrual → invoice state) verified. On pass → immediately start Phase 3.

---

## Phase 3 — Scaling Engine (Reliability)
**Goal**: Sustain thousands of accounts; eliminate 429 storms and executor stalls.

**Entry criteria**: Phases 1-2 stable on a small cohort.

**Steps (in order of impact)**
1. **Today/Emergency**: Point `HL_INFO_HOST` to an independent info node; extend account snapshot TTL to 15s. (env-only, 0 code)
2. Signal dedup/merge + queue smoothing in `matcher.ts`/SQS consumer; enable batched orders (`HL_BATCH_ORDERS`).
3. Replace REST polling with WebSocket push (`hl-ws-supabase-sync.ts`) for account/fills.
4. Worker sharding by account hash (each replica owns a disjoint shard + a dedicated egress IP); move in-memory daily counters to Redis; add adaptive 429 circuit breaker.
5. Add PgBouncer (transaction pooling) for DB; keep `prepare:false`.

**Exit criteria**: Load test at 3,000 simulated accounts sustains < 1% 429 rate and no executor stalls; the 10 mainnet canary accounts run on the new path with 0 missed/duplicate orders.

**Rollback trigger**: WS desync causing missed signals, or sharding causing duplicate orders. → Revert to single-consumer + REST polling via flags.

**Verification gate**: Capacity model targets met (WS push + batching + 4-8 IP shards) AND 24h clean on canary. On pass → immediately start Phase 4.

---

## Phase 4 — AI Training & Inference (Edge)
**Goal**: Stronger ranker, safe rollout, lower latency.

**Steps**
1. Expand `hl-copy-ranker-features.ts` 12 → 30+ dims (market state, leader time-series, microstructure, crowding, latency).
2. Upgrade label from binary win/loss to risk-adjusted return (R-multiple / top-quantile).
3. Implement Shadow Mode in `sagemaker.ts`: invoke + log to `ai_inferences`, but return `null` (mirror-only) when `SHADOW_MODE=true`.
4. Add online-AUC monitor: join `ai_inferences` vs `signal_trades` outcomes daily; alert on drift.
5. Optional: export XGBoost to ONNX for in-process inference (kill SageMaker round-trip).

**Exit criteria**: Shadow run shows online AUC ≥ offline gate; drift monitor live.

**Rollback trigger**: Online AUC below mirror baseline. → Keep `SHADOW_MODE=true` (AI disabled, mirror-only).

---

## Execution Order (Continuous — No Calendar)

Phases run **back-to-back**: the moment a phase's verification gate passes, the next phase begins automatically. There is no fixed timeline. Sequence: **Phase 1 → Phase 2 → Phase 3 → Phase 4 → Report**. The Phase 3 emergency step (env-only `HL_INFO_HOST` + snapshot TTL) may be applied at any time as it is zero-code and non-breaking.

Validation ladder for every phase: **fresh testnet account → 10-account mainnet canary → full fleet**.

---

## Definition of Done (whole program)
- thirdweb v3 Vault signs all HL/PM orders; v2 retired or standby only.
- Agent mode default for new accounts; builder fee + HWM carry collecting.
- 3,000-account load test green; 429 < 1%; no executor stalls.
- Ranker at 30+ features with live drift monitoring; shadow→live promotion documented.
- `EXECUTIVE_SUMMARY.md` delivered to founders.
