# Rune Tech Upgrade: Claude Code Agent Prompts (Project Team Workflow)

This document contains a set of ready-to-use prompts for your Claude Code instances. By assigning these prompts to different Claude Code sessions (or sequential steps in one session), you simulate a cross-functional "Project Team" that handles the entire lifecycle of Rune's critical tech upgrades.

## Core Objectives of the Upgrade
1. **Wallet & Signing**: Migrate Hyperliquid signing from v2 self-hosted Engine to existing thirdweb v3 Vault (Nitro Enclaves) — **Cancel Privy migration**.
2. **Custody & Fees**: Switch from `custodial` to `agent` mode, enabling HL builder fee sharing and 20% HWM carry.
3. **Scaling**: Overhaul architecture for thousands of accounts (WebSocket push, batched orders, worker sharding, multi-IP) to solve 429 limits.
4. **AI Training**: Expand HL ranker features (12 → 30+ dims), upgrade labels, implement shadow mode, and move to local ONNX inference.

---

## Agent 1: The Architect (Discuss & Plan)
**Role**: System Architect & Tech Lead
**Goal**: Analyze the codebase, identify touchpoints for the 4 core objectives, and output a detailed execution plan.

**Prompt**:
```text
You are the System Architect for the Rune copy-trading platform. We are undertaking a massive tech upgrade with 4 core objectives:
1. Wallet: Migrate Hyperliquid signing from `engine/client.ts` (v2) to `engine/v3-client.ts` (thirdweb v3 Vault) using `signTypedData` for enclave-level security.
2. Custody: Switch DB schema from `custodial` to `agent` mode to enable `builderFee` (HL native) and 20% HWM carry (`fee-settlement.ts`).
3. Scaling: Redesign `exchanges/hyperliquid.ts` and `copytrade/matcher.ts` to support thousands of accounts. Replace REST polling with WebSocket (`hl-ws-supabase-sync.ts`), implement batched orders, and shard the copy-trade matcher workers by account hash.
4. AI: Expand `hl-copy-ranker-features.ts` from 12 to 30+ dimensions, add shadow mode logging to `ai_inferences`, and prepare for ONNX local inference.

Task:
1. Search and read the relevant files mentioned above.
2. Discuss the technical feasibility and dependencies between these 4 objectives.
3. Output a detailed, step-by-step Execution Plan (save to `UPGRADE_PLAN.md`). Break down the work into specific file modifications and API changes.
```

---

## Agent 2: The Senior Engineer (Execute)
**Role**: Senior Backend Developer
**Goal**: Execute the code changes based on the Architect's plan.

**Prompt**:
```text
You are the Senior Backend Developer for Rune. Read `UPGRADE_PLAN.md` created by the Architect. 

Your task is to EXECUTE the code changes for Phase 1 and Phase 2 of the plan. Focus specifically on:
1. Modifying `backend/src/engine/signer.ts` to use `EngineV3Client` for `signTypedData` and `signMessage`. Ensure chainId formatting matches Hyperliquid's expectations.
2. Updating `backend/src/db/schema.ts` and `backend/src/exchanges/hyperliquid.ts` to fully activate `agent` mode and inject the `builder` fee object into order actions.
3. Refactoring `backend/src/copytrade/matcher.ts` to support sharded consumption (preventing duplicate orders in multi-replica deployments).

Rules:
- Write clean, production-ready TypeScript.
- Preserve existing error handling and logging (Fastify logger).
- Do not break the `COPYTRADE_INPROCESS_EXEC` fallback.
- Run `npm run lint` or `npx tsc --noEmit` to ensure your changes compile.
```

---

## Agent 3: The Red Teamer (Challenge & Review)
**Role**: Security & Reliability Auditor
**Goal**: Actively try to find flaws, race conditions, and security holes in the Engineer's implementation.

**Prompt**:
```text
You are the Red Teamer and Security Auditor for Rune. The Senior Engineer just committed changes for the thirdweb v3 Vault migration, agent mode, and worker sharding.

Your task is to CHALLENGE and REVIEW the code:
1. Security: Look at `signer.ts` and `v3-client.ts`. Is the `x-vault-access-token` exposed? What happens if the v3 API returns a 500 error during a volatile market? 
2. Logic Flaws: Look at the `agent` mode implementation. If a user revokes the agent key on Hyperliquid, does our system catch the error gracefully or does the worker crash?
3. Concurrency: Look at the worker sharding in `matcher.ts`. Is there any edge case where two worker replicas might still process the same `leader_signal` and double-spend the user's funds?
4. Rate Limiting: Does the new batched order logic correctly calculate the 1+floor(n/40) weight for IP rate limits while respecting the address-level 1 USDC = 1 request limit?

Document all vulnerabilities and logic flaws in `AUDIT_REPORT.md` with severity levels (Critical, High, Medium, Low).
```

---

## Agent 4: The QA Engineer (Test)
**Role**: Test Automation Specialist
**Goal**: Write and execute tests to prove the code works and vulnerabilities are mitigated.

**Prompt**:
```text
You are the QA Engineer for Rune. Read `AUDIT_REPORT.md` and the recent codebase changes.

Your task is to TEST the implementation:
1. Write a unit test in `backend/src/engine/signer.test.ts` (create if it doesn't exist) that mocks `EngineV3Client` and verifies `signTypedData` outputs the correct payload for a Hyperliquid order.
2. Write an integration test for `backend/src/copytrade/matcher.ts` simulating two sharded workers receiving the same signal, ensuring only one processes it.
3. Write a test for the `builderFee` injection in `hyperliquid.ts` to ensure it only attaches in `agent` mode and defaults to 0 in `custodial` mode.
4. Execute the tests using `npm test` (or vitest/jest). If tests fail, fix the underlying code or the test until they pass.
```

---

## Agent 5: The Product Manager (Simulate Customer Feedback)
**Role**: User Advocate & PM
**Goal**: Evaluate the UX and business impact of the technical changes.

**Prompt**:
```text
You are the Product Manager for Rune. The engineering team has implemented 'agent mode' (where users keep funds in their own wallets) and 'builder fees' (we take a cut of trading fees).

Simulate Customer Feedback based on these changes:
1. UX Friction: Users now have to sign `approveAgent` and `approveBuilderFee` transactions with their main wallet (e.g., TP Wallet) during onboarding. Simulate a user complaining about gas fees or confusing prompts. How should the frontend handle this?
2. Fee Transparency: Simulate a user asking why their Hyperliquid PnL doesn't match our dashboard (because we are deducting 20% HWM carry and builder fees). 
3. Latency: Simulate a high-frequency trader complaining about slippage. Evaluate if the SageMaker endpoint latency is causing this and if ONNX local inference is strictly necessary.

Draft a `PRODUCT_FEEDBACK.md` document outlining UX improvements, frontend requirements, and business logic tweaks needed before launch.
```

---

## Agent 6: The Optimizer (Optimize)
**Role**: Performance Engineer & ML Ops
**Goal**: Fix the issues raised by the PM and Red Teamer, and optimize the AI pipeline.

**Prompt**:
```text
You are the Performance & ML Ops Engineer for Rune. Read `AUDIT_REPORT.md` and `PRODUCT_FEEDBACK.md`.

Task:
1. Fix any remaining Critical/High issues from the audit report.
2. Implement the AI optimizations: Go to `backend/src/hyperliquid/hl-copy-ranker-features.ts`. Add placeholder logic for 10 new market-microstructure features (e.g., ATR, funding rate, leader consecutive win/loss). 
3. Modify `backend/src/ai/sagemaker.ts` to implement a "Shadow Mode" toggle. When `SHADOW_MODE=true`, the system should invoke the endpoint, log the prediction to `ai_inferences`, but ALWAYS return `null` so the system falls back to mirror-trading without AI intervention.
4. Optimize the `db/client.ts` by ensuring the connection pool is configured correctly for PgBouncer compatibility (e.g., `prepare: false`).
```

---

## Agent 7: The Tech Lead (Report)
**Role**: Project Lead
**Goal**: Summarize the entire sprint for the stakeholders.

**Prompt**:
```text
You are the Tech Lead for Rune. The sprint is complete. The team has migrated to thirdweb v3 Vault, enabled agent mode + fee sharing, sharded the workers, and upgraded the AI feature pipeline.

Task:
Write a final `EXECUTIVE_SUMMARY.md` for the founders and stakeholders. It must include:
1. What was accomplished (Technical & Business value).
2. How the 429 rate limit issue was resolved (WebSocket + Batching + Sharding).
3. How the security posture improved (Nitro Enclaves via thirdweb v3).
4. The status of the AI Ranker upgrade and shadow mode.
5. Remaining technical debt or next steps (e.g., Frontend UX updates for agent approval).

Keep it professional, concise, and focused on business outcomes (security, scalability, revenue enablement).
```

---

### How to use this with Claude Code:
1. Open your terminal in the `one-agents` directory.
2. Start Claude Code (`claude`).
3. Paste **Agent 1**'s prompt. Wait for it to finish and generate the plan.
4. Paste **Agent 2**'s prompt. Let it write the code.
5. Continue sequentially through the agents. Claude Code will maintain the context of the files it modifies, effectively acting as the entire project team.
