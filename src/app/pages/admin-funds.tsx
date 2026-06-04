import { useCallback, useEffect, useState } from "react";
import { ENGINE_BASE } from "@app/lib/engine";

/**
 * Admin · 资金管理(Treasury)—— 跨链资金金库管理台。
 *
 * 对接后端 /admin/treasury/*(X-Admin-Token 鉴权)。token 由操作员输入,仅存 sessionStorage
 * (刷新页关闭即清,不落盘)。展示:配置/节点到账监控/跨链流水台账;触发 入金·出金 movement。
 * 注:movement 真正执行由后端 flag(TREASURY_ENABLED)控制,这里只入队 + 展示状态。
 */

const BASE = ENGINE_BASE.replace(/\/+$/, "");
const shortAddr = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const fmt$ = (v: string | number | null | undefined) => (v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

interface Cfg { enabled: boolean; monitorEnabled: boolean; serverWallet: string | null; vaultBsc: string | null; vaultArbitrum: string | null; hlVault: string | null; nodeReceiver: string | null }
interface Step { name: string; status: "ok" | "pending" | "failed"; txHash?: string; error?: string; at: string }
interface Movement { id: string; kind: "inflow" | "outflow"; status: string; step: string | null; amountUsd: string; steps: Step[]; lastError: string | null; createdAt: string }
interface NodeDep { id: string; nodeId: string | null; fromAddress: string; amountUsd: string | null; txHash: string; status: string; detectedAt: string }

const TONE: Record<string, string> = {
  completed: "text-emerald-400", ok: "text-emerald-400",
  in_progress: "text-amber-400", pending: "text-amber-400",
  failed: "text-rose-400", detected: "text-sky-400", swept: "text-emerald-400",
};

export default function AdminFunds() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem("rune.adminToken") ?? "");
  const [authed, setAuthed] = useState(false);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [deps, setDeps] = useState<NodeDep[]>([]);
  const [depTotal, setDepTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("100");

  const api = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${BASE}/admin/treasury/${path}`, {
      ...init,
      headers: { "content-type": "application/json", "X-Admin-Token": token, ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }, [token]);

  const refresh = useCallback(async () => {
    setErr(null);
    try {
      const [c, m, d] = await Promise.all([
        api<Cfg>("config"),
        api<{ items: Movement[] }>("movements?limit=50"),
        api<{ items: NodeDep[]; totalUsd: number }>("node-deposits?limit=100"),
      ]);
      setCfg(c); setMoves(m.items); setDeps(d.items); setDepTotal(d.totalUsd); setAuthed(true);
      sessionStorage.setItem("rune.adminToken", token);
    } catch (e) {
      setErr(String(e).includes("401") || String(e).includes("403") ? "Admin token 无效" : "加载失败(检查 token / CORS / TREASURY 配置)");
      setAuthed(false);
    }
  }, [api, token]);

  useEffect(() => { if (token && !authed) void refresh(); /* eslint-disable-next-line */ }, []);

  async function trigger(kind: "inflow" | "outflow") {
    setBusy(true); setErr(null);
    try { await api(kind, { method: "POST", body: JSON.stringify({ amountUsd: Number(amount) }) }); await refresh(); }
    catch (e) { setErr(`发起${kind === "inflow" ? "入金" : "出金"}失败: ${String(e)}`); }
    finally { setBusy(false); }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md p-6 space-y-4">
        <h1 className="text-lg font-bold">资金管理 · 管理员登录</h1>
        <p className="text-sm text-white/50">输入后端 ADMIN_API_KEY(仅存本次会话,不落盘)。</p>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="X-Admin-Token"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-amber-400/60" />
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <button onClick={refresh} disabled={!token} className="w-full rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">进入</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">资金管理 · Treasury</h1>
        <button onClick={refresh} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5">刷新</button>
      </div>
      {err && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{err}</p>}

      {/* config */}
      {cfg && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="执行开关" value={cfg.enabled ? "已开启" : "关闭(只入队)"} tone={cfg.enabled ? "ok" : "pending"} />
          <Stat label="节点监控" value={cfg.monitorEnabled ? "运行中" : "关闭"} tone={cfg.monitorEnabled ? "ok" : "pending"} />
          <Stat label="Server 钱包" value={shortAddr(cfg.serverWallet)} mono />
          <Stat label="HL 金库" value={shortAddr(cfg.hlVault)} mono />
        </div>
      )}

      {/* deposit / withdraw */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <div className="text-sm font-semibold">发起跨链 movement</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">金额 USD</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1"
              className="h-9 w-28 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-amber-400/60" />
          </div>
          <button onClick={() => trigger("inflow")} disabled={busy} className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">
            入金 (USDT@BSC → HL 金库)
          </button>
          <button onClick={() => trigger("outflow")} disabled={busy} className="rounded-lg bg-sky-500/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">
            出金 (金库 → USDT@BSC)
          </button>
        </div>
        {cfg && !cfg.enabled && <p className="text-xs text-amber-400/80">注:TREASURY_ENABLED 关闭中 —— movement 会入队但不自动执行。</p>}
      </div>

      {/* node deposits */}
      <Section title={`节点到账监控 · 合计 ${fmt$(depTotal)}`}>
        <Table head={["时间", "来源", "金额", "状态", "tx"]}>
          {deps.map((d) => (
            <tr key={d.id} className="border-t border-white/5">
              <Td>{new Date(d.detectedAt).toLocaleString()}</Td>
              <Td mono>{shortAddr(d.fromAddress)}</Td>
              <Td>{fmt$(d.amountUsd)}</Td>
              <Td><span className={TONE[d.status] ?? "text-white/60"}>{d.status}</span></Td>
              <Td mono><a className="text-sky-400 hover:underline" href={`https://bscscan.com/tx/${d.txHash}`} target="_blank" rel="noreferrer">{d.txHash.slice(0, 10)}…</a></Td>
            </tr>
          ))}
          {!deps.length && <tr><Td colSpan={5}><span className="text-white/40">暂无到账</span></Td></tr>}
        </Table>
      </Section>

      {/* movements ledger */}
      <Section title="跨链流水台账">
        <Table head={["类型", "金额", "当前腿", "状态", "进度", "时间"]}>
          {moves.map((m) => (
            <tr key={m.id} className="border-t border-white/5 align-top">
              <Td>{m.kind === "inflow" ? "入金" : "出金"}</Td>
              <Td>{fmt$(m.amountUsd)}</Td>
              <Td mono>{m.step ?? "—"}</Td>
              <Td><span className={TONE[m.status] ?? "text-white/60"}>{m.status}</span></Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {(m.steps ?? []).map((s, i) => (
                    <span key={i} title={s.error ?? s.txHash ?? ""} className={`rounded px-1.5 py-0.5 text-[10px] ${s.status === "ok" ? "bg-emerald-500/15 text-emerald-400" : s.status === "failed" ? "bg-rose-500/15 text-rose-400" : "bg-amber-500/15 text-amber-400"}`}>{s.name}</span>
                  ))}
                </div>
                {m.lastError && <div className="mt-1 text-[10px] text-rose-400/80">{m.lastError}</div>}
              </Td>
              <Td>{new Date(m.createdAt).toLocaleString()}</Td>
            </tr>
          ))}
          {!moves.length && <tr><Td colSpan={6}><span className="text-white/40">暂无流水</span></Td></tr>}
        </Table>
      </Section>
    </div>
  );
}

function Stat({ label, value, tone, mono }: { label: string; value: string; tone?: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[11px] text-white/40">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${tone ? TONE[tone] : "text-white"} ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-2.5 text-sm font-semibold border-b border-white/10">{title}</div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full min-w-[640px] text-[13px]">
      <thead className="text-[11px] uppercase tracking-wide text-white/30">
        <tr>{head.map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
function Td({ children, mono, colSpan }: { children: React.ReactNode; mono?: boolean; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-3 py-2 ${mono ? "font-mono text-white/80" : "text-white/70"}`}>{children}</td>;
}
