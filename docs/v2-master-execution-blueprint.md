# Rune v2 — MASTER EXECUTION BLUEPRINT

> Program-lead synthesis of the F1–F16 5-role packages. This is the document the team executes from. Every claim is grounded in source; file paths are absolute. Iron rule: **dev-first** — dev → testnet → prod, prod only inside a user-gated window.

---

## 1. Executive Summary — current state + critical path

### What v2 actually is today
- **Backend (`/home/ec2-user/projects/one-agents/backend`)** is the strong half. Polymarket (F1–F5) and Hyperliquid (F6–F10) CRUD + reads are **fully live and Bearer-gated**; copy-trade (F11) and signals/marketplace (F12/F15) routes are live. The dual-write *engine* already exists as a watermark-poll worker (`src/sync/position-sync.ts` + `src/sync/project-connector.ts`), NOT a from-scratch outbox.
- **Dapp (`/home/ec2-user/projects/rune-dapp`, branch v2)** is the weak half. The customer-facing surfaces are the bulk of remaining work: no Supabase trading read path, no PM-Lab real data, fake "Follow" in the signal center, half-wired HL subscription management, broken Polymarket order/withdraw/redeem UI, no strategy-pack catalog, dialog/mobile inconsistencies.
- **Console (`/home/ec2-user/projects/rune-console`)** strategy-pack management is fully built but **completely disconnected** from the dapp (no shared table/endpoint), and has no mobile layout.

### The single biggest correction vs the original plan
The plan doc §1.41 calls for a **`project_mirror` outbox written in the same transaction**. The built reality is a **watermark-poll worker** (`position-sync.ts`) that SELECTs new rows per `(projectId, table)` watermark and PostgREST-upserts (`Prefer: resolution=merge-duplicates`) to the customer Supabase. It is idempotent, restart-safe, and avoids same-tx coupling. **Decision: keep the watermark worker, extend its table coverage, and amend the plan doc §1.41.** Do NOT build a parallel outbox. (One exception is documented in §3 for the Polymarket dev-spec author who proposed a `mirror_outbox` — that is reconciled to the watermark model below to avoid two divergent mirror paths.)

### Critical path (strict ordering)
```
F14 dual-write foundation (credentials→encrypted DB, extend mirror coverage, customer DDL)
        │
        ├─► F6–F10  Hyperliquid strategy (subs/positions/signals mirror + manage-follow UI)
        │
        ├─► F1–F5   Polymarket (real order path, withdraw fix, cancel/redeem UI, order/fill mirror)
        │
        ├─► F11–F12 Copy-trade + signal center (real Follow, leader picker, signal mirror)
        │
        └─► F13     AI/PM Lab (PM Lab real data, lab table mirror)

Cross-cutting, parallelizable, no F14 dependency:
   F15  Strategy-pack console↔dapp consistency (own mirror extension, lands after F14 infra)
   F16  Design system + mobile (pure UI, zero data dependency — can land anytime)
```

**Why this order:** F14 is the shared substrate; F6–F15 dual-write all extend the same `position-sync.ts` worker + `project-connector.ts`. The *functional UI* halves of F6–F12 (manage-follow, real Follow, real orders) have **no F14 dependency** and can ship in parallel against our DB — only the *mirror to customer Supabase* halves block on F14.

---

## 2. Prioritized, sequenced backlog by milestone (M1–M4)

> Milestones map to the plan doc. Each task cites its dev spec. "BE" = backend, "DAPP" = rune-dapp, "CON" = rune-console. Tasks marked **[no-F14]** can start immediately in parallel.

### M1 — Dual-write foundation + the fast functional wins

**F14 backend foundation** (Dev Spec: F14 §1–§6)
1. **BE Migration 0020 — projects credentials.** Add `supabaseUrl text`, `supabaseServiceKeyEnc text` to `trading.projects` (`src/db/schema.ts:59-78`). Reuse `src/lib/secret.ts` (`encryptSecret`/`decryptSecret`, AES-256-GCM, key `EXCHANGE_API_ENCRYPTION_KEY`) — **do NOT** create `crypto.ts`/pgcrypto. `npm run db:generate`, apply in-container.
2. **BE Credentials source swap.** Rewrite `src/sync/project-connector.ts` `loadRegistry()` → async DB-backed + TTL cache + `invalidateRegistry()`, env `PROJECT_SUPABASE_REGISTRY` as migration-window fallback. `await` all 4 call sites in `position-sync.ts` (`:83,:90,:160,:315`) — **highest-risk regression**: unawaited Promise silently dry-runs everything.
3. **BE Admin config routes** (`src/routes/admin.ts`, `requireAdmin`): `PUT/GET(masked)/POST-test /admin/projects/:id/supabase`. Service add `setProjectSupabase` in `src/services/projects.ts`. PUT returns 503 if `EXCHANGE_API_ENCRYPTION_KEY` unset.
4. **BE Customer-side DDL** `backend/sql/customer-supabase-schema.sql` (orders/fills/positions/subscriptions/signals + `__rune_healthcheck`); onConflict keys: `orders.id`, `fills.id`, `positions(user_id,token_id)`, `subscriptions.id`, `signals.id`.
5. **BE Enablement.** Add `.env`: `POSITION_SYNC_ENABLED=false`, `POSITION_SYNC_INTERVAL_S=30`, `PROJECT_SUPABASE_REGISTRY=`, `EXCHANGE_API_ENCRYPTION_KEY=<64-hex>`.

**Fast functional wins [no-F14], ship against our DB immediately:**
6. **DAPP F5 withdraw body fix** (F1–F5 Dev Spec B1): `src/app/components/copy-trading/shared.tsx:468` send `{ amountUsd, destination }` not `{ amount, to, destination }` — currently always 400. **One-line, do first.**
7. **DAPP F4/F5 mutation hooks** (F1–F5 B2): add `usePlaceOrder`/`useCancelOrder`/`useRedeem`/`useMarketTokens` to `src/app/lib/engine-hooks.ts`.
8. **DAPP F9 HL manage-follow** (F6–F10 Dev Spec A1–A4): add `subscriptionPatch`/`subscriptionDelete` to `engine.ts hyperliquid` (PATCH/DELETE routes already live `hl-read.ts:588/616`); `useHlSubMutations` hook; pause/resume/cancel + confirm dialog in `ActiveSubs` (`hl-copy-section.tsx:986`); `insufficient_funds` funds-gate toast in `shared.tsx categorize`.
9. **DAPP F11/F12 real Follow** (F11/F12 Dev Spec File A): `copy-trading-signals.tsx` — replace fake `toggleFollow` (local state+toast) with real `copySubscriptions.create/delete`; add `extractWallet(r)` helper, `useEngineUser`+`useCopySubs`, button state machine (disabled when no wallet / not connected).
10. **DAPP i18n backfill** (F11/F12 + F6–F10): add missing keys — `follow`, `following`, `copyStopped`, `copyThisTrader`, `noWalletForFollow`, `connectToFollow`, `leaderSignalsTitle`, `aiIntelligenceTitle`, `leaderboardTitle` (zh+en); `hl.needFunds*`, `hl.pause/resume/cancelFollow*`, `common.confirm/cancel`; **all `hl.*` keys** are currently fallback-only (Customer-Ops finding). Add `pmLab.*` to all 12 locales.

### M2 — HL + Polymarket dual-write mirror

**F14 mirror coverage extension** (F14 Dev Spec §3, F6–F10 Dev Spec B):
11. **BE Subscriptions sync** (`position-sync.ts`): `syncHlSubscriptions` (`hl_copy_subscriptions`, watermark `updatedAt`, dest `subscriptions`/`hl_copy_subscriptions`, onConflict `id`), `syncCopySubscriptions` (`copy_subscriptions`), `syncOfficialSubscriptions` (`official_subscriptions`) — distinct watermark keys `subs_hl`/`subs_copy`/`subs_official` to avoid starvation.
12. **BE HL positions sync** `syncHlPositions` — JOIN `hl_positions`→`hl_copy_subscriptions` for project scope + `user_id`; onConflict `subscription_id,coin` (matches `hl_positions_sub_coin_uniq`).
13. **BE Signals sync** `syncSignals`/`syncHlSignals` — `leader_signals`(`sig_leader`)/`hl_copy_signals`(`sig_hl`, **scoped to subscribed leaders only**, watermark `created_at`)/`quant_signals`(`sig_quant`). NOTE: signal tables have NO `project_id` — leader/quant fan out globally to all configured projects (product sign-off required); HL signals scoped per B4 Option 1.
14. **BE Extend `distinctProjectIds()`** UNION to include subscription tables + `listConfiguredProjectIds()` (so signals-only / subs-only projects sync).
15. **BE Customer HL DDL** (F6–F10 B6): `hl_copy_subscriptions`/`hl_positions`(PK `subscription_id,coin`)/`hl_copy_signals` for customer Supabase.
16. **BE `syncProject` per-table try/catch** (F6–F10 Test Plan top risk): `position-sync.ts:163-166` calls are NOT individually wrapped — one poison HL batch aborts the whole project tick. Wrap each `syncHl*` so it can't starve Polymarket mirroring.

**F1–F5 Polymarket** (F1–F5 Dev Spec A/B):
17. **BE A3 tokens endpoint** `GET /v1/markets/polymarket/:conditionId/tokens` in `src/routes/markets.ts` (reads `markets` then `hotMarkets` fallback) — unblocks real order UI.
18. **DAPP B2c** `fetchPolymarkets` (`src/app/lib/api.ts`) must surface `conditionId` (currently dropped; `id` is often Gamma id). Add `conditionId` to `PolymarketMarket` (`trade.tsx:31`).
19. **DAPP B3 real order path** `trade.tsx` — replace `openBet` stub (`:754`), branch `BetDialog` on `marketType==="polymarket"`: resolve `tokenId` via `useMarketTokens`, `size = usd/price`, validate `0<price<1`, submit via `usePlaceOrder`. **Gate behind `VITE_POLYMARKET_LIVE` (default off).** AI/news stay on legacy paper API.
20. **DAPP B4/B5/B6** cancel button on open orders, redeem action, deposit-status polling (`shared.tsx`).
21. **BE Polymarket mirror.** Reconciled to watermark model (see §3): add `syncOrders`(exists)/`syncFills`(exists) coverage + a `withdrawals` table (migration) and `syncWithdrawals`. The F1–F5 dev spec's `mirror_outbox`+`mirror-worker.ts` is **superseded** by the watermark worker — implement order/fill/withdrawal mirroring as `position-sync.ts` sync fns, NOT a second worker. Add natural keys where missing.
22. **BE hardcoded-zh i18n** in `trade.tsx` hero (Customer-Ops P2).

### M3 — Signals center + AI/PM Lab + strategy packs

**F11/F12 mirror** (F11/F12 Dev Spec §2):
23. **BE `syncCopySubscriptions`** already in #11. Signal mirroring for `leader_signals` is **deferred** (no `project_id` → global fan-out documented).
24. **DAPP F12 leader picker** (F11/F12 Plan B): per-row "跟单此交易员" on leaderboard (Section 3) + signal cards; funds-gate toast + deposit affordance.

**F13 AI/PM Lab** (F13 Dev Spec):
25. **BE Migration `0020_pm_lab_mirror.sql`** (note collision with F14 0020 — **renumber to next free**): CREATE `trading.pm_orders`/`pm_console_logs`; CREATE `trading.ai_*` (they do NOT exist in RDS today — Test Plan confirmed); add natural keys (`pm_order_uid`/`pm_tick_uid`/`trade_uid`/`prediction_uid`/`tick_id`), unique indexes after backfill.
26. **BE Extend `position-sync.ts`** with `syncPmOrders`/`syncPmConsoleLogs`/`syncAiPaperTrades`/`syncAiPredictions`/`syncAiConsoleLogs` (onConflict = natural key, NEVER integer `id`).
27. **DAPP `pm-bot-feed.ts`** (new) — `usePmConsoleLogs`/`usePmOrders`/`usePmStats`, realtime, `uid()` channel uniqueness. Wire `prediction-ai-lab.tsx`/`prediction-ai-console.tsx` behind `VITE_PM_LAB_LIVE` with synthetic fallback.
28. **DAPP P0 honest "Live" badge** (F13 Customer-Ops): badge must reflect `LIVE && !loading && rows>0`; add "simulated data" disclaimer. P&L calendar/headline stats stay curated — disclose.
29. **EXTERNAL** cf-worker PM producer must land RDS rows with natural keys (out of workspace; gates Lab going live, fallback covers until then).

**F15 strategy packs** (F15 Dev Spec):
30. **BE Migration** `official_strategies` +`owner_type`/`project_id`; new `official_strategy_selections` (PK `(project_id, strategy_slug)`); new `src/lib/pack-params.ts` (shared zod, 8-field `PackParams`).
31. **BE `GET /v1/marketplace/catalog`** (project-scoped, pricing-stripped) + admin `PUT /admin/projects/:id/pack-selections/:slug` (validated write, the console→backend bridge).
32. **CON bridge** `api/packs/[slug]/route.ts` also calls backend admin endpoint (drop `apiKeyId` dimension); fix `strategy-data.ts:201` live-mode to read `official_strategies` not leaders. Needs `ENGINE_BASE_URL`+`ENGINE_ADMIN_TOKEN` env.
33. **DAPP marketplace client + hooks + Packs tab** (`engine.ts marketplace`, `marketplace-hooks.ts`, `strategy.tsx` `"packs"` tab, new `official-packs-section.tsx`). Only `notionalRatio`+`notionalCapUsd` editable (Phase 0).
34. **BE `syncPacks`** mirror to customer `strategy_packs`/`strategy_pack_selections`; extend `distinctProjectIds` UNION with selections.

### M4 — Cross-cutting polish + multi-tenant rollout

35. **F16 radius reconcile** (F16 Dev Spec 1A): `src/index.css:160` `--radius: 0.375rem`→`0.5rem`. **[no-F14]**
36. **F16 `ResponsiveDialog`** (1B): new `src/hooks/use-media-query.ts` + `src/components/ui/responsive-dialog.tsx` (Drawer<640px / Dialog≥640px, reuse existing primitives). Migrate **8** dialogs: `strategy.tsx` ×5, `trade.tsx` ×1, `shared.tsx` ×2 (`:338` AND `:485` — the under-counted withdraw dialog), `hl-copy-section.tsx` ×2. **[no-F14]**
37. **F16 responsive grids** (1C): `copy-trading.tsx:174/:223`, `strategy.tsx:381` heatmap scroll-wrap, sub-components. **Drawer z-index > bottom-nav z-50** (Customer-Ops P0 — confirm button must not hide behind nav). **[no-F14]**
38. **F16 console mobile nav** (F16 §3): `sidebar.tsx` `hidden lg:flex`; new `mobile-nav.tsx` (hand-rolled `glass` panel — console has NO `Sheet`/`vaul`); wire `(app)/layout.tsx`. **[no-F14]**
39. **Multi-tenant prod rollout**: onboard real customer via admin API (encrypted creds), `test` green, `POSITION_SYNC_ENABLED=true` one project at a time, flip dapp read flags per deployment.

---

## 3. Unified dual-write design (one canonical spec)

**Mechanism: watermark-poll worker, NOT outbox.** Supersedes plan doc §1.41 and the F1–F5 dev-spec `mirror_outbox`. Rationale: the worker already exists, is idempotent + restart-safe, and avoids same-transaction coupling. Building an outbox in parallel would create two divergent mirror paths (auditor risk).

### Components (all in `/home/ec2-user/projects/one-agents/backend`)
- **`src/sync/project-connector.ts`** — per-project Supabase resolver + `upsertToProject(conn, table, rows, onConflict)`: raw PostgREST `POST {url}/rest/v1/{table}?on_conflict={key}` with headers `apikey`/`Authorization: Bearer <service_key>`, `Prefer: resolution=merge-duplicates,return=minimal`. **Credentials → encrypted DB column** `projects.supabase_service_key_enc` (decrypt via `src/lib/secret.ts`, server-side only, never in any response/log/browser); env `PROJECT_SUPABASE_REGISTRY` is the migration-window fallback.
- **`src/sync/position-sync.ts`** — `startPositionSync(log)` registered at `server.ts:107`. Per tick: `distinctProjectIds()` → per project `syncProject()` → per table a `syncX()` that SELECTs rows `gt(watermarkCol, since)` `asc` `limit BATCH` → `emit()` → `upsertToProject` → `advanceWatermark`.
- **`trading.sync_watermarks`** (`schema.ts:452`, PK `(project_id, table_name)`) — cursor store; reload on restart = no rescan, no dupes.

### Idempotency (onConflict natural keys — NEVER integer `id`)
| Source table | Dest table | Conflict key | Watermark |
|---|---|---|---|
| `orders` | `orders` | `id` | `updated_at` |
| `polymarket_fills` | `fills` | `id` | time col |
| `positions` | `positions` | `user_id,token_id` | `updated_at` |
| `withdrawals` (new) | `withdrawals` | `id` | `created_at` |
| `hl_copy_subscriptions` | `subscriptions`/`hl_copy_subscriptions` | `id` | `updated_at` (`subs_hl`) |
| `copy_subscriptions` | `subscriptions` | `id` | `updated_at` (`subs_copy`) |
| `official_subscriptions` | `subscriptions` | `id` | `updated_at` (`subs_official`) |
| `hl_positions` ⨝ subs | `hl_positions` | `subscription_id,coin` | `updated_at` |
| `leader_signals` | `signals` | `id` | `last_seen_at` (`sig_leader`, global) |
| `hl_copy_signals` | `signals`/`hl_copy_signals` | `id` | `created_at` (`sig_hl`, subscribed-leaders only) |
| `quant_signals` | `signals` | `id` | `issued_at` (`sig_quant`, global) |
| `official_strategy_selections` ⨝ strategies | `strategy_pack_selections`/`strategy_packs` | `project_id,slug` / `slug` | `updated_at` (`packs`) |
| `pm_orders` | `pm_orders` | `pm_order_uid` | `updated_at` |
| `pm_console_logs` | `pm_console_logs` | `pm_tick_uid` | `ts` |
| `ai_paper_trades` | `ai_paper_trades` | `trade_uid` | `updated_at` |
| `ai_predictions` | `ai_predictions` | `prediction_uid` | time col |
| `ai_console_logs` | `ai_console_logs` | `tick_id` | `ts` |

### Per-project config & safety
- `POSITION_SYNC_ENABLED` (safe-string bool, NOT `z.coerce.boolean`) + `PROJECT_SUPABASE_REGISTRY`/DB creds gate everything; unconfigured project → **dry-run** (logs sample, writes nothing) → safe dev verification.
- **Failure semantics:** `upsertToProject` throws on non-2xx → caught per-PROJECT in `runOnce` → watermark NOT advanced for that table → retried next tick (self-healing). Master DB never mutated. **Wrap each table's `syncX` in try/catch** (M2 #16) so one poison batch can't abort sibling tables.
- **Customer reads:** their own dapp build (env vars = tenancy) reads `public.*` via anon key, filtered by `user_id`; signals are anon-readable public feeds. Per-customer dapp **build** is the recommended tenancy model — no runtime `getProjectSupabase` factory needed.
- Mirror is **upsert-only**: hard-deletes do not emit tombstones → orphaned customer rows on cancel are a documented follow-up.

---

## 4. Cross-cutting

### Strategy-pack consistency (console ↔ dapp) — F15
The loop "select pack in console → appears in dapp" does not exist (no shared table/endpoint). Bridge of truth: `official_strategies` is canonical; console writes selections into backend via admin endpoint → backend `official_strategy_selections` (PK `project_id,slug`) → project-scoped `/v1/marketplace/catalog` (pricing-stripped) → dapp Packs tab → `syncPacks` mirrors to customer Supabase. **Pricing (`cost`/`monthlyPriceUsd`) must never leave the backend to dapp or customer Supabase.** Shared zod `PackParams` (`src/lib/pack-params.ts`) is the validation gate the console currently lacks.

### Design system + mobile — F16 (pure UI, zero data dependency)
- **Token reconcile:** duplicate `--radius` (`src/index.css:160`=0.375 vs `src/app/index.css:57`=0.5) → unify to 0.5rem. Tailwind v4, no JS config — edits go in CSS `@theme`/`:root`.
- **`ResponsiveDialog`:** single shared wrapper (bottom-sheet <640px via vaul `Drawer`, centered `Dialog` ≥640px) replaces 8 hand-rolled dialog widths across strategy/trade/copy-trading. Keep `dialog.tsx`/`drawer.tsx` base unchanged.
- **Responsive grids:** `copy-trading.tsx` (0 breakpoints), `strategy.tsx` heatmap scroll-wrap, sub-components.
- **Console mobile nav:** greenfield — `hidden lg:flex` sidebar + `lg:hidden` hamburger top bar (hand-rolled `glass` panel; console has no `Sheet`/`vaul`). LiveToggle/LanguageToggle/logout must move into mobile panel.
- **Z-index:** Drawer must sit above the floating bottom-nav (`bottom-nav.tsx:32` z-50) or the deposit/withdraw confirm button is unreachable on short viewports.
- Verify all dapp changes via `?preview=1` (`dashboard-shell.tsx:171`).

---

## 5. Risks + dev-first rollout

### Top risks
1. **Unawaited async `getProjectConnector`** (F14) — 4 call sites; a missed `await` silently dry-runs every mirror. Static grep + runtime "actually wrote" assertion required.
2. **`syncProject` per-table failure isolation** — currently one throw aborts a project's whole tick. Wrap each `syncX` (M2 #16).
3. **Integer `id` cross-tenant collision** — mirror MUST use natural keys; `ai_*`/`pm_*` need new natural-key columns + backfill before unique indexes.
4. **Migration 0020 number collision** — F14 and F13 both claim `0020`. Renumber sequentially; F13's must `CREATE` `trading.ai_*` (they don't exist in RDS).
5. **Real-money paths** — Polymarket order/withdraw + HL active-subscribe hit real relayers. `requireApiKey` has no read/write scope split. Keep `VITE_POLYMARKET_LIVE` off and dev project key only until the prod window.
6. **No test runner in dapp/console** — vitest must be stood up or gate falls back to `typecheck` (snapshot the dirty `rune.tsx` baseline first) + manual matrix.
7. **External cf-worker PM producer** — gates F13 Lab going live; synthetic fallback covers until then. Honest "Live" badge mandatory.
8. **Curated P&L** — calendar/headline stats synthetic; disclose before any customer ship.

### Rollout sequence (per feature)
- **Dev:** worker dry-run (flag off / project unconfigured) → verify payloads log correct snake_case + onConflict. Functional UI behind feature flags (`VITE_POLYMARKET_LIVE`, `VITE_PM_LAB_LIVE`, `VITE_READ_FROM_SUPABASE` all default off).
- **Testnet:** apply customer DDL to a throwaway Supabase, register one project, `POSITION_SYNC_ENABLED=true`; verify end-to-end consistency (our DB == customer Supabase) + idempotency on replay/restart.
- **Prod (user-gated window only):** onboard real customer via admin API (encrypted creds, never env in prod), `test` endpoint green, enable worker for that one project, flip dapp read flag for that deployment only. Rollback = flag off (instant) / `POSITION_SYNC_ENABLED=false` (idempotent resume). Ship dapp + console as separate deploys.

---

## 6. First 5 concrete steps to start now

1. **DAPP one-liner, zero risk:** fix `src/app/components/copy-trading/shared.tsx:468` → `funding.walletWithdraw(userId, { amountUsd: amt, destination: dest.trim() })`. (F1–F5 currently 400s every withdraw.)
2. **BE F14 migration:** add `supabaseUrl`/`supabaseServiceKeyEnc` to `trading.projects` (`src/db/schema.ts:59`), `npm run db:generate`, apply on dev; add a `src/lib/secret.test.ts` round-trip test. Confirm `EXCHANGE_API_ENCRYPTION_KEY` is set.
3. **BE F14 credentials swap:** rewrite `src/sync/project-connector.ts loadRegistry()` async DB-backed + `invalidateRegistry()`; **`await` all 4 call sites** in `position-sync.ts` (`:83,:90,:160,:315`) — add the static grep guard now to prevent the silent-dry-run regression.
4. **DAPP F9 manage-follow:** add `subscriptionPatch`/`subscriptionDelete` to `engine.ts hyperliquid` + `useHlSubMutations` + pause/resume/cancel in `ActiveSubs` (`hl-copy-section.tsx:986`). Backend routes (`hl-read.ts:588/616`) already live — pure dapp work, no F14 dependency. Remove the stale "route does not exist" comment in `engine.ts:236`.
5. **DAPP F12 real Follow:** in `copy-trading-signals.tsx` build `extractWallet(r)` + replace the fake `toggleFollow` with real `copySubscriptions.create/delete` gated on resolved wallet + connected user. Headline fix, no F14 dependency.

> Steps 1, 4, 5 are dapp-only functional wins shippable today; steps 2–3 lay the F14 substrate every mirror task depends on.
