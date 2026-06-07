/**
 * PM 显示覆盖层 — 对齐 hl-display-overrides 的模式,让 PM 区块显示的余额等
 * 数字可以在 Supabase 手动调控(admin 面板「交易账户」页写入):
 *
 *   trading_pm_overrides   余额/浮盈/当日盈亏覆盖(非 null 字段替换真实值)
 *
 * 真实余额仍来自引擎 `usePusdBalance`(/trade/polymarket/users/:id/pusd-balance,
 * 返回 { smartWallet, balanceRaw, balanceUsd });本层把 balance_usd 覆盖叠到
 * `balanceUsd` 字段上(pusdAmount() 第一优先读它),其余字段(smartWallet 等)
 * 原样保留。引擎查询失败但存在覆盖时合成纯覆盖对象 —— 覆盖优先于报错。
 *
 * 用 `usePusdBalanceAdjusted(userId, wallet)` 替换 `usePusdBalance(userId)`
 * 即可,返回对象保持 react-query 语义。
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@app/lib/supabase-client";
import { usePusdBalance } from "@app/lib/engine-hooks";

interface PmOverrideRow {
  wallet: string;
  balance_usd: number | null;
  unrealized_pnl_usd: number | null;
  today_pnl_usd: number | null;
}

/** trading_pm_overrides 按连接钱包(大小写不敏感)取一行;无表/无行都安静返回 null。 */
export function usePmOverrides(wallet: string | undefined) {
  return useQuery<PmOverrideRow | null>({
    queryKey: ["stats", "pm-overrides", wallet?.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_pm_overrides")
        .select("*")
        .ilike("wallet", wallet!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PmOverrideRow | null;
    },
    enabled: !!wallet,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

/**
 * usePusdBalance 的可调控版本 — 同形状返回(data 喂给 pusdAmount() 解析)。
 * `wallet` 是用户连接的钱包(覆盖表按它索引);`userId` 是引擎 user id。
 */
export function usePusdBalanceAdjusted(userId: string | undefined, wallet: string | undefined) {
  const balQ = usePusdBalance(userId);
  const ovQ = usePmOverrides(wallet);

  const data = useMemo(() => {
    const ov = ovQ.data;
    if (ov?.balance_usd == null) return balQ.data;
    const base =
      balQ.data && typeof balQ.data === "object" && !Array.isArray(balQ.data)
        ? (balQ.data as Record<string, unknown>)
        : {};
    return { ...base, balanceUsd: Number(ov.balance_usd) };
  }, [balQ.data, ovQ.data]);

  return {
    ...balQ,
    data,
    isError: balQ.isError && ovQ.data?.balance_usd == null,
  };
}
