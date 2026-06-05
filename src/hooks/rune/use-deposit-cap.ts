import { useQuery } from "@tanstack/react-query";
import { supabase, w } from "@app/lib/supabase-client";

/**
 * 充值限额(cap)——绑定到当前钱包的授权码上的单 venue 累计充值上限。
 *
 * 规则(产品):
 *   - 单笔金额须落在该授权码的区间 [min, max] 内(逐 venue):
 *       max = PM `pm_cap_usd` / HL `hl_cap_usd`(累计充值上限);
 *       min = PM `pm_min_usd` / HL `hl_min_usd`(单笔最低,取不到/空 → 回退 `MIN_PER_TX`=10)。
 *   - 累计充值 ≤ 该钱包绑定授权码的 venue 上限:PM = `pm_cap_usd`,HL = `hl_cap_usd`。
 *   - 「累计已充值」由调用方传入(用各 venue 的资金 proxy):
 *       PM → pUSD 余额(usePusdBalance / pusdAmount);
 *       HL → HL 账户净值(useHlAccount 的 accountValue)。
 *   - 剩余可充 = cap − deposited(下限 0)。
 *
 * 数据源:主网 Supabase `rune_auth_codes`。`assigned_to` 列存小写 EVM 地址,
 * 一个钱包最多绑一条码 → maybeSingle()。**查不到行(没绑授权码 / 没买节点)
 * → hasCode=false 且 cap 视为 0 → 禁止充值**(由 UI 用 hasCode + remaining<10 判定)。
 *
 * 复用既有 supabase-client(anon key + 显式 assigned_to WHERE)与 usePredictionCode
 * 完全一致的读取方式,不另造连接。
 */

/** 单笔最低充值(USDC)默认回退值,PM / HL 通用。授权码未配置 min 列时使用。 */
export const MIN_PER_TX = 10;

export type DepositVenue = "pm" | "hl";

export interface DepositCap {
  /** 该 venue 的累计充值上限(USDC)。无授权码 → 0。 */
  cap: number;
  /** 调用方传入的「累计已充值」proxy(PM=pUSD 余额,HL=账户净值)。 */
  deposited: number;
  /** 剩余可充 = max(0, cap − deposited)。 */
  remaining: number;
  /** 单笔最低充值 = 该授权码的 min(pm_min_usd / hl_min_usd),空/无码 → 回退 MIN_PER_TX。 */
  minPerTx: number;
  /** 钱包是否绑定了授权码(查到行)。false → 必须先绑码 / 买节点。 */
  hasCode: boolean;
  /** cap 查询是否进行中。 */
  loading: boolean;
}

/**
 * 读取 wallet 在 `venue` 上的充值限额。`deposited` 由调用方提供(已充值的资金 proxy)。
 * 无钱包 → enabled=false,cap=0、hasCode=false。
 */
export function useDepositCap(
  wallet: string | undefined,
  venue: DepositVenue,
  deposited: number,
): DepositCap {
  const capCol = venue === "pm" ? "pm_cap_usd" : "hl_cap_usd";
  const minCol = venue === "pm" ? "pm_min_usd" : "hl_min_usd";

  const q = useQuery<{ cap: number; min: number; hasCode: boolean }>({
    queryKey: ["rune", "depositCap", venue, wallet ? w(wallet) : null],
    enabled: !!wallet,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rune_auth_codes")
        .select(`${capCol}, ${minCol}`)
        .eq("assigned_to", w(wallet!))
        .maybeSingle();
      if (error) throw error;
      // 查不到行 → 没绑授权码 → cap 0,禁止充值。
      if (!data) return { cap: 0, min: MIN_PER_TX, hasCode: false };
      const row = data as Record<string, unknown>;
      const rawCap = row[capCol];
      const cap = typeof rawCap === "number" ? rawCap : Number(rawCap ?? 0);
      // min 列(pm_min_usd / hl_min_usd):取不到 / 为空 / 非有限值 → 回退 MIN_PER_TX。
      const rawMin = row[minCol];
      const min = rawMin == null ? MIN_PER_TX : Number(rawMin);
      return {
        cap: Number.isFinite(cap) ? cap : 0,
        min: Number.isFinite(min) && min > 0 ? min : MIN_PER_TX,
        hasCode: true,
      };
    },
  });

  const cap = q.data?.cap ?? 0;
  const dep = Number.isFinite(deposited) ? deposited : 0;
  const remaining = Math.max(0, cap - dep);

  return {
    cap,
    deposited: dep,
    remaining,
    minPerTx: q.data?.min ?? MIN_PER_TX,
    hasCode: q.data?.hasCode ?? false,
    loading: q.isLoading,
  };
}
