
# demo-rune — build handoff (2026-05-28)

Standalone, portable One-Agents skin ("Rune"). Self-contained pnpm workspace;
the 5 `@one-agents/*` packages are VENDORED under `packages/*`. Runs on any
Node 20+/pnpm box with network reach to the engine. Refresh packages with
`SOURCE_REPO=/home/ubuntu/thirdweb-engine scripts/sync-packages.sh`.

## Run
- engine (source of truth) on `:4000` (pm2 `engine`).
- this skin: `pnpm install && pnpm dev` (→ :3100) or prod `pnpm build && pnpm start`.
- currently running under pm2 as `rune` on **:3101** (baseline polypilot-demo holds :3100).
- env: `.env.local` (gitignored) — `ONE_AGENTS_API_KEY`, `ONE_AGENTS_API_BASE=http://127.0.0.1:4000`, `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`.

## Centers (all wired to real engine data via @one-agents/react hooks + SDK; no mocks)
- `/` Trading — 开户 gate (onboard→confirm→enableApiKey) + pUSD balance + open orders + manual order panel (place/cancel, non-filling test affordance).
- `/strategy` Strategy — SDK `STRATEGY_PACKS` one-click create (`strategiesApi.create(userId, pack.build())`) + the structured `@one-agents/strategies` `PRESET_CATALOG` browsed by risk tier (保守/稳健/激进) + leader/consensus signals + existing strategies & copy-subscriptions.
- `/training` Training — quant signals+performance, crypto predictions, fusion-by-market, predictions feeds.
- `/earnings` Earnings — summary derived from real orders + quant performance (no fabricated PnL).
- `/profile` Profile — account status, smart-wallet + engine-EOA, pUSD balance, guarded withdraw.

## Verification (2026-05-28, via skin proxy → live engine)
- All 5 routes HTTP 200. Build + typecheck clean.
- Security: API key server-side only, absent from client bundle; proxy roots = users/trade/v1 (no admin). PASS.
- Portability: no engine-monorepo path refs in src/config; lockfile pins @one-agents to local `link:`. PASS.
- Real data confirmed: leaders/top, signals/leaders/latest, sentiment, crypto predictions (6 horizons), fusion (score 87.97), arbitrage; user 43efb7ca → 16 strategies, 7 copy-subs, real orders, pUSD $0.35, presets catalog.
- **Empty (producer/ingest-fed, no active producer):** quant signals/performance/strategies, political/sports predictions, whales. Skin renders empty states correctly. → follow-up: run the producers / ML pipeline to populate.
- **NOT executed (needs user go-ahead):** live/dry-run order WRITE (placeOrder) — gated because the only onboarded user is a real account with real pUSD. Plumbing verified; execution awaits consent.
