/**
 * Cloudflare Pages Function — same-origin `/engine/*` proxy.
 *
 * On Cloudflare Pages there is no Vite dev server, so the SPA's default
 * `VITE_ENGINE_PROXY=/engine` is served HERE. This injects the One-Agents
 * project API key SERVER-SIDE (from the Pages env var ONE_AGENTS_API_KEY) and
 * forwards to the engine — the key never reaches the browser bundle.
 *
 * Required Cloudflare Pages env vars (Project → Settings → Environment variables):
 *   - ONE_AGENTS_API_KEY   (secret, server-only)   e.g. oa_live_...
 *   - ONE_AGENTS_API_BASE  (optional, default https://api.one-agents.com)
 *
 * Mirrors the demo-rune Next route + the Supabase engine-proxy: only the
 * project-key-scoped roots are allowlisted.
 */
interface Env {
  ONE_AGENTS_API_KEY?: string;
  ONE_AGENTS_API_BASE?: string;
}

const ALLOWED_ROOTS = new Set(["users", "trade", "v1"]);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const onRequest = async (ctx: {
  request: Request;
  env: Env;
  params: { path?: string[] | string };
}): Promise<Response> => {
  const { request, env, params } = ctx;
  const url = new URL(request.url);

  const parts = Array.isArray(params.path)
    ? params.path
    : params.path
      ? [params.path]
      : [];
  if (parts.length === 0 || !ALLOWED_ROOTS.has(parts[0])) {
    return json(403, { error: "forbidden_path" });
  }

  const key = env.ONE_AGENTS_API_KEY?.trim();
  if (!key) {
    return json(503, {
      error: "unconfigured",
      message: "ONE_AGENTS_API_KEY is not set on the Pages project",
    });
  }

  const base = (env.ONE_AGENTS_API_BASE ?? "https://api.one-agents.com").replace(/\/+$/, "");
  const target = `${base}/${parts.map(encodeURIComponent).join("/")}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${key}`);
  headers.delete("cookie");
  headers.delete("host");

  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(target, init);
    const respHeaders = new Headers(upstream.headers);
    respHeaders.delete("set-cookie");
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  } catch (e) {
    return json(502, { error: "upstream_unreachable", message: String((e as Error)?.message ?? e) });
  }
};
