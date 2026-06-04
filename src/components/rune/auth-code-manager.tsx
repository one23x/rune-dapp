import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound, Search, Filter, Copy, CheckCircle2, Plus, RefreshCw, Loader2 } from "lucide-react";
import { NODE_META, type NodeId } from "@/lib/thirdweb/contracts";
import { ENGINE_BASE } from "@app/lib/engine";

/**
 * 子页 · 授权码管理（admin 视角，接后端 /admin/node/codes，X-Admin-Token 鉴权）。
 *
 * - 按节点等级分桶：101 / 201 / 301 / 401 / 501（= nodeId）。
 * - 生成:输入数量 + **总充值额度(= 节点价格,默认填该等级 priceUsdt)** → POST 批量生成。
 * - 列表:验证码 · 额度 · 状态 · **兑换后绑定的钱包地址**(redeemedByWallet) + 兑换时间。
 * - token 由运营员输入,仅存 sessionStorage(与资金台共用 rune.adminToken)。
 *
 * 后端约定(routes/admin.ts):
 *   POST /admin/node/codes { count, nodeId, totalDepositLimitUsd?, ttlDays?, note? }
 *   GET  /admin/node/codes?nodeId=&status=&limit= → { codes: [...] }
 */

const BASE = ENGINE_BASE.replace(/\/+$/, "");
const TIER_ORDER: NodeId[] = [101, 201, 301, 401, 501];
const CODE_GATED_TIERS: NodeId[] = TIER_ORDER;
const TOKEN_KEY = "rune.adminToken";

type CodeStatus = "unused" | "redeemed" | "expired" | "revoked";
type StatusFilter = "ALL" | "unused" | "redeemed";

interface CodeRowData {
  id: string;
  code: string;
  level: number;
  nodeId: number | null;
  totalDepositLimitUsd: number | null;
  redeemedByWallet: string | null;
  redeemedAt: string | null;
  status: CodeStatus;
  createdAt: string;
}

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "redeemed", label: "已分发" },
  { key: "unused", label: "未分发" },
];

const fmt$ = (v: number | null) => (v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
const shortAddr = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

export function AuthCodeManager() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [authed, setAuthed] = useState(false);
  const [tier, setTier] = useState<NodeId>(501);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [q, setQ] = useState("");
  const [codes, setCodes] = useState<CodeRowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // generate form
  const [genCount, setGenCount] = useState("10");
  const [genLimit, setGenLimit] = useState<string>(String(NODE_META[501].priceUsdt));
  const [genBusy, setGenBusy] = useState(false);

  const meta = NODE_META[tier];

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(`${BASE}/admin/node/codes${path}`, {
        ...init,
        headers: { "content-type": "application/json", "X-Admin-Token": token, ...(init?.headers ?? {}) },
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    [token],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await api<{ codes: CodeRowData[] }>(`?nodeId=${tier}&limit=500`);
      setCodes(data.codes ?? []);
      setAuthed(true);
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      const s = String(e);
      setErr(s.includes("401") || s.includes("403") ? "Admin token 无效" : "加载失败(检查 token / CORS / 后端)");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, [api, tier, token]);

  // 切换等级时把生成额度默认填成该等级价格;已 authed 则拉取该桶。
  useEffect(() => {
    setGenLimit(String(NODE_META[tier].priceUsdt));
    if (authed) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  async function generate() {
    setGenBusy(true);
    setErr(null);
    try {
      const count = Math.max(1, Math.min(1000, Number(genCount) || 0));
      const totalDepositLimitUsd = genLimit.trim() === "" ? undefined : Number(genLimit);
      await api(``, {
        method: "POST",
        body: JSON.stringify({ count, nodeId: tier, totalDepositLimitUsd }),
      });
      await refresh();
    } catch (e) {
      setErr("生成失败:" + String(e));
    } finally {
      setGenBusy(false);
    }
  }

  const rows = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return codes.filter((c) => {
      if (status === "redeemed" && c.status !== "redeemed") return false;
      if (status === "unused" && c.status !== "unused") return false;
      if (
        lq &&
        !c.code.toLowerCase().includes(lq) &&
        !(c.redeemedByWallet ?? "").toLowerCase().includes(lq)
      )
        return false;
      return true;
    });
  }, [codes, status, q]);

  const counts = useMemo(() => {
    const total = codes.length;
    const distributed = codes.filter((c) => c.status === "redeemed").length;
    return { total, distributed, undistributed: total - distributed };
  }, [codes]);

  // ── token gate ──
  if (!authed) {
    return (
      <Card className="border-amber-500/20 bg-card/70 backdrop-blur">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-amber-400" /> 授权码管理 — 管理员登录
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="X-Admin-Token"
            className="w-full px-3 py-2 rounded-md bg-black/30 border border-border/40 text-sm outline-none focus:border-amber-500/45"
            data-testid="admin-token-input"
          />
          {err && <div className="text-xs text-rose-400">{err}</div>}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!token || loading}
            className="px-3 py-1.5 rounded-md bg-amber-500/15 text-amber-200 border border-amber-500/40 text-sm disabled:opacity-50"
          >
            {loading ? "验证中…" : "登录"}
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tier picker */}
      <Card className="border-amber-500/20 bg-card/70 backdrop-blur">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
            <Filter className="h-3 w-3 text-amber-400" /> 节点等级
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {TIER_ORDER.map((id) => {
              const m = NODE_META[id];
              const isActive = tier === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTier(id)}
                  className={`rounded-lg border px-2 py-2 text-center transition-all ${
                    isActive ? "border-amber-500/55 bg-amber-500/15" : "border-border/40 bg-card/40 hover:border-amber-500/35"
                  }`}
                  data-testid={`tier-button-${id}`}
                >
                  <div className={`text-[10px] font-mono uppercase tracking-widest ${isActive ? "text-amber-200" : "text-muted-foreground/70"}`}>#{id}</div>
                  <div className={`text-xs sm:text-sm font-semibold mt-0.5 ${m.color}`}>{m.nameCn}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5 tabular-nums">{fmt$(m.priceUsdt)}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Generate */}
      <Card className="border-border/40 bg-card/70 backdrop-blur">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
            生成授权码 · <span className={meta.color}>{meta.nameCn} #{tier}</span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground/80 space-y-1">
              <span>数量</span>
              <input value={genCount} onChange={(e) => setGenCount(e.target.value)} type="number" min={1} max={1000}
                className="block w-24 px-2 py-1.5 rounded-md bg-black/30 border border-border/40 text-sm outline-none focus:border-amber-500/45" data-testid="gen-count" />
            </label>
            <label className="text-xs text-muted-foreground/80 space-y-1">
              <span>总充值额度 (USD) = 节点价格</span>
              <input value={genLimit} onChange={(e) => setGenLimit(e.target.value)} type="number" min={0}
                className="block w-40 px-2 py-1.5 rounded-md bg-black/30 border border-border/40 text-sm outline-none focus:border-amber-500/45" data-testid="gen-limit" />
            </label>
            <button type="button" onClick={() => void generate()} disabled={genBusy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-amber-500/15 text-amber-200 border border-amber-500/40 text-sm disabled:opacity-50" data-testid="gen-submit">
              {genBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} 生成
            </button>
            <button type="button" onClick={() => void refresh()} disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-md bg-white/[0.03] text-foreground/60 border border-white/[0.06] text-sm">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Status filter + search + counts */}
      <Card className="border-border/40 bg-card/70 backdrop-blur">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button key={f.key} type="button" onClick={() => setStatus(f.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    status === f.key ? "bg-amber-500/15 text-amber-200 border border-amber-500/40" : "bg-white/[0.03] text-foreground/55 border border-white/[0.06] hover:text-foreground/80"
                  }`} data-testid={`status-filter-${f.key}`}>{f.label}</button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground/85 tabular-nums">
              共 <span className="text-foreground">{counts.total}</span> · 已分发 <span className="text-emerald-300">{counts.distributed}</span> · 未分发 <span className="text-amber-300">{counts.undistributed}</span>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索验证码 / 钱包"
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-black/30 border border-border/40 text-xs placeholder:text-muted-foreground/50 outline-none focus:border-amber-500/45" />
          </div>
          {err && <div className="text-xs text-rose-400">{err}</div>}
        </CardContent>
      </Card>

      {/* Rows */}
      {rows.length === 0 ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <KeyRound className="h-8 w-8 mx-auto mb-3 opacity-30" />
            {loading ? "加载中…" : "暂无授权码 — 用上方生成"}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_1.4fr] gap-3 px-3 py-2 border-b border-border/40 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            <span>验证码</span>
            <span>额度</span>
            <span>状态</span>
            <span>绑定钱包 / 兑换时间</span>
          </div>
          <ul className="divide-y divide-border/20">
            {rows.map((c) => (
              <CodeRow key={c.id} c={c} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CodeRow({ c }: { c: CodeRowData }) {
  const [copied, setCopied] = useState(false);
  const distributed = c.status === "redeemed";
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <li className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_1.4fr] gap-2 sm:gap-3 px-3 py-2.5 items-center hover:bg-white/[0.025] transition-colors">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-[12px] sm:text-[13px] text-amber-100 truncate select-all">{c.code}</span>
        <button type="button" onClick={copyCode} className={`shrink-0 ${copied ? "text-emerald-400" : "text-muted-foreground/60 hover:text-amber-300"}`} aria-label="复制验证码">
          {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <span className="hidden sm:inline text-[11px] font-mono text-foreground/80 tabular-nums">{fmt$(c.totalDepositLimitUsd)}</span>
      <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${
        distributed ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : c.status === "revoked" ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
          : c.status === "expired" ? "border-slate-500/40 bg-slate-500/10 text-slate-300"
          : "border-amber-500/30 bg-amber-500/[0.06] text-amber-200/80"
      }`}>
        {distributed ? "已分发" : c.status === "revoked" ? "已作废" : c.status === "expired" ? "已过期" : "未分发"}
      </span>
      <div className="col-span-2 sm:col-span-1 min-w-0 text-[11px] text-muted-foreground/85 leading-tight break-all">
        {distributed ? (
          <>
            <div className="font-mono text-foreground/85 truncate" title={c.redeemedByWallet ?? ""}>{c.redeemedByWallet ?? "—"}</div>
            {c.redeemedAt && <div className="opacity-70 mt-0.5">{new Date(c.redeemedAt).toLocaleString()}</div>}
          </>
        ) : (
          <span className="opacity-50">—</span>
        )}
      </div>
    </li>
  );
}

export { TIER_ORDER, CODE_GATED_TIERS };
