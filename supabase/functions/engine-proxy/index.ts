/**
 * Supabase Edge Function — One-Agents Engine proxy (PRODUCTION).
 *
 * The SPA must never hold the Engine project API key. In production the client
 * calls this Edge Function (same-origin-ish, via VITE_ENGINE_PROXY pointing at
 * `https://<ref>.functions.supabase.co/engine-proxy`); this function reads the
 * key from Deno.env and injects the Bearer header on the upstream call. Mirrors
 * the demo-rune `@one-agents/proxy` semantics: first-path-segment allowlist,
 * body forwarding, status passthrough.
 *
 * Deploy:
 *   supabase functions deploy engine-proxy --project-ref <ref> --no-verify-jwt
 *   supabase secrets set ONE_AGENTS_API_KEY=<project-key> --project-ref <ref>
 *   # optional override (defaults to https://api.one-agents.com):
 *   supabase secrets set ONE_AGENTS_API_BASE=https://api.one-agents.com --project-ref <ref>
 *
 * Then in the SPA prod env:
 *   VITE_ENGINE_PROXY=https://<ref>.functions.supabase.co/engine-proxy
 *
 * NOTE: deployed with --no-verify-jwt because end-users are wallet-auth'd, not
 * Supabase-Auth'd. The Engine key is the real secret and stays server-side; the
 * allowlist keeps the surface to the project-scoped bearer plane only.
 */

const ENGINE_BASE =
  (Deno.env.get("ONE_AGENTS_API_BASE") || "https://api.one-agents.com").replace(/\/+$/, "");
const ENGINE_KEY = Deno.env.get("ONE_AGENTS_API_KEY") || "";

// First-segment allowlist — only the project-scoped bearer-key surface an
// end-user app needs. Anything else → 403.
const ALLOWED_ROOTS = new Set(["users", "trade", "v1"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!ENGINE_KEY) {
    return json(
      {
        error: "unconfigured",
        message: "Set ONE_AGENTS_API_KEY secret to enable live Engine calls.",
      },
      503,
    );
  }

  const url = new URL(req.url);
  // Strip the function-name prefix: `/engine-proxy/v1/leaders/top` → `v1/...`
  const segments = url.pathname.split("/").filter(Boolean);
  const fnIdx = segments.indexOf("engine-proxy");
  const path = fnIdx >= 0 ? segments.slice(fnIdx + 1) : segments;

  if (path.length === 0 || !ALLOWED_ROOTS.has(path[0])) {
    return json(
      { error: "forbidden_path", message: `proxy only forwards ${[...ALLOWED_ROOTS].join("/")}/*` },
      403,
    );
  }

  const target = `${ENGINE_BASE}/${path.map(encodeURIComponent).join("/")}${url.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${ENGINE_KEY}`,
    Accept: "application/json",
  };
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.text();
    if (body) {
      init.body = body;
      headers["Content-Type"] = "application/json";
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    return json({ error: "upstream_unreachable", message: String(e).slice(0, 200) }, 502);
  }

  const text = await upstream.text();
  return new Response(text || "{}", {
    status: upstream.status,
    headers: {
      ...CORS,
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
});
