# `engine-proxy` — One-Agents Engine proxy (production)

The SPA must never hold the Engine **project API key**. This Edge Function
holds it server-side (Supabase secret) and injects the `Authorization: Bearer`
header on every upstream call to the One-Agents Engine
(`https://api.one-agents.com`).

In **dev** the equivalent is the Vite `server.proxy` entry in `vite.config.ts`
(`/engine` → engine, key from `process.env.ONE_AGENTS_API_KEY`). This function
is the **prod** equivalent.

## Behaviour

- Forwards `<method> /engine-proxy/<path>` → `${ONE_AGENTS_API_BASE}/<path>`.
- Injects `Authorization: Bearer ${ONE_AGENTS_API_KEY}`.
- First-segment allowlist: `users` / `trade` / `v1` only (everything else → 403).
- Forwards request body for non-GET/HEAD, passes upstream status through.
- Permissive CORS (the SPA is a separate origin in prod).

## Deploy

```bash
# 1. Set the secrets (NEVER commit these)
supabase secrets set ONE_AGENTS_API_KEY=<project-key> --project-ref <ref>
# optional — defaults to https://api.one-agents.com
supabase secrets set ONE_AGENTS_API_BASE=https://api.one-agents.com --project-ref <ref>

# 2. Deploy. --no-verify-jwt because end-users are wallet-auth'd, not Supabase-Auth'd;
#    the Engine key is the real secret and the allowlist keeps the surface narrow.
supabase functions deploy engine-proxy --project-ref <ref> --no-verify-jwt
```

## Wire the SPA to it

Set the prod build env so the typed client (`src/app/lib/engine.ts`) targets the
function instead of the dev `/engine` proxy:

```
VITE_ENGINE_PROXY=https://<ref>.functions.supabase.co/engine-proxy
```
