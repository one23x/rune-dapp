// Rune agent 矢量记忆库 Worker
// 路由：
//   GET  /recall?q=...&role=&scope=&repo=&topK=5   语义召回（query → embed → Vectorize.query）
//   POST /ingest   { docs: [{ id, text, metadata }] }   灌库（需 x-ingest-secret）
//   GET  /health
// embedding：@cf/baai/bge-m3（多语言，1024 维，适合中英混合）。

const MODEL = "@cf/baai/bge-m3";

// Workers AI 不同模型/版本返回结构略有差异，统一归一化成 number[][]。
function normalizeEmbeddings(out) {
  if (!out) return [];
  if (Array.isArray(out.data)) return out.data;                 // bge-*-en-v1.5 风格
  if (out.response && Array.isArray(out.response)) return out.response;
  if (out.data && out.data.embedding) return [out.data.embedding];
  throw new Error("unexpected embeddings shape: " + JSON.stringify(Object.keys(out)));
}

async function embed(env, texts) {
  const out = await env.AI.run(MODEL, { text: texts });
  const vecs = normalizeEmbeddings(out);
  if (vecs.length !== texts.length) throw new Error(`embed count mismatch ${vecs.length}/${texts.length}`);
  return vecs;
}

export default {
  async fetch(req, env) {
   try {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, model: MODEL, index: "rune-agent-memory" });
    }

    // 语义召回
    if (url.pathname === "/recall") {
      const q = url.searchParams.get("q");
      if (!q) return Response.json({ error: "missing q" }, { status: 400 });
      const topK = Math.min(+(url.searchParams.get("topK") || 5), 20);
      const filter = {};
      for (const k of ["role", "scope", "repo"]) {
        const v = url.searchParams.get(k);
        if (v) filter[k] = v;
      }
      const [vec] = await embed(env, [q]);
      const res = await env.VECTORIZE.query(vec, {
        topK,
        returnMetadata: "all",
        ...(Object.keys(filter).length ? { filter } : {}),
      });
      return Response.json(
        (res.matches || []).map((m) => ({ score: m.score, id: m.id, ...m.metadata }))
      );
    }

    // 灌库（受 secret 保护）
    if (url.pathname === "/ingest" && req.method === "POST") {
      if (env.INGEST_SECRET && req.headers.get("x-ingest-secret") !== env.INGEST_SECRET) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      const body = await req.json();
      const docs = body.docs || [];
      if (!docs.length) return Response.json({ upserted: 0 });
      const vecs = await embed(env, docs.map((d) => d.text));
      const vectors = docs.map((d, i) => ({
        id: d.id,
        values: vecs[i],
        metadata: d.metadata || {},
      }));
      const r = await env.VECTORIZE.upsert(vectors);
      return Response.json({ upserted: vectors.length, mutationId: r.mutationId });
    }

    return new Response(
      "rune-agent-memory · GET /recall?q=&role=&scope=&repo=&topK= · POST /ingest · GET /health",
      { status: 200 }
    );
   } catch (e) {
    return Response.json({ error: String((e && e.stack) || e) }, { status: 500 });
   }
  },
};
