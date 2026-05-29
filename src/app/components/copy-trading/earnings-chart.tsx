/**
 * Lazy-loaded cumulative realized-PnL area chart. Kept in its own module so
 * recharts is code-split out of the copy-trading bundle (see the React.lazy
 * import in copy-trading-earnings.tsx).
 */

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function EarningsChart({ data }: { data: { i: number; pnl: number }[] }) {
  const last = data.length ? data[data.length - 1].pnl : 0;
  const up = last >= 0;
  const stroke = up ? "#4ade80" : "#f87171";
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="ctPnl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="i" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            contentStyle={{ background: "hsl(22,20%,8%)", border: "1px solid rgba(212,168,50,0.2)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.5)" }}
            formatter={(v: number) => [`$${Number(v).toLocaleString()}`, "PnL"]}
          />
          <Area type="monotone" dataKey="pnl" stroke={stroke} strokeWidth={2} fill="url(#ctPnl)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
