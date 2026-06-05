import { useQuery } from "@tanstack/react-query";
import { supabase, w } from "@app/lib/supabase-client";
import { runeChain } from "@/lib/thirdweb/chains";

/**
 * 节点身份(Supabase 真源)—— 判定某钱包是否为节点用户,供「开通交易账户」门控。
 *
 * 背景:引擎 `GET /v1/node/status` 读的是引擎自己的 RDS(`node_access` /
 * 已兑换 `auth_codes`)+ 链上 `NodePresell.levelOf`。但真实节点买家的购买与
 * 自动分配的授权码都落在**主网 Supabase**,且 0xF327 的 `levelOf` 会 revert、
 * `balanceOf` 不授等级 —— 所以引擎对真买家返回 `isNode:false`。节点身份必须
 * 基于 Supabase 识别。
 *
 * 数据源(任一为真即算节点,优先用授权码行,因为它带额度/档位):
 *   (a) `rune_auth_codes` 有 `assigned_to = lower(wallet)` 的行 —— 管理员分配
 *       给该钱包的授权码(含 node_id 档位 + pm/hl 充值上限)。这是首选信号。
 *   (b) `rune_purchases` 有 `user = lower(wallet)` 且 `chain_id = 56`(BSC 主网)
 *       的购买行 —— 已下单买节点但尚未分配到码的兜底。
 *
 * 读取方式与 `usePredictionCode` / `useDepositCap` 完全一致:复用既有
 * supabase-client(anon key + 显式 WHERE),不另造连接。地址一律小写。
 *
 * RLS:同其它 rune_* 读,目前 anon key + 显式 `assigned_to` / `user` WHERE;
 * thirdweb→JWT 桥接到位后收紧成 `auth.jwt()->>'wallet'` 即可。
 */

/** node_id → 节点档位等级(1–5)。授权码 node_id 编码档位:个位/百位为档,
 *  这里只需「是不是节点 + 一个 ≥1 的档位过门控」,取 1–5 的安全映射:
 *  101/201/301/401/501 → 1..5。取不到映射 → 1(够放行)。 */
function levelFromNodeId(nodeId: number | null | undefined): number {
  if (nodeId == null || !Number.isFinite(nodeId)) return 1;
  // 节点清单里档位编码为 hundreds digit(1xx..5xx);clamp 到 1–5。
  const tier = Math.floor(nodeId / 100);
  if (tier >= 1 && tier <= 5) return tier;
  return 1;
}

export interface SupabaseNode {
  /** Supabase 是否认为该钱包是节点(有 assigned 授权码 或 chain-56 购买)。 */
  isNode: boolean;
  /** 节点档位(1–5);无 → 0。来自分配授权码的 node_id;仅有购买行 → 1。 */
  level: number;
  /** 查询是否进行中。 */
  loading: boolean;
}

/**
 * 解析 wallet 的 Supabase 节点身份。无钱包 → enabled=false,isNode=false。
 */
export function useSupabaseNode(wallet: string | undefined): SupabaseNode {
  const q = useQuery<{ isNode: boolean; level: number }>({
    queryKey: ["rune", "supabaseNode", wallet ? w(wallet) : null],
    enabled: !!wallet,
    staleTime: 60_000,
    queryFn: async () => {
      const lc = w(wallet!);

      // (a) 首选:分配到该钱包的授权码(带 node_id 档位)。
      const codeRes = await supabase
        .from("rune_auth_codes")
        .select("node_id")
        .eq("assigned_to", lc)
        .maybeSingle();
      if (codeRes.error) throw codeRes.error;
      if (codeRes.data) {
        return { isNode: true, level: levelFromNodeId(codeRes.data.node_id) };
      }

      // (b) 兜底:BSC 主网(chain_id=runeChain.id=56)的节点购买行(尚未分配码)。
      const buyRes = await supabase
        .from("rune_purchases")
        .select("node_id")
        .eq("user", lc)
        .eq("chain_id", runeChain.id)
        .limit(1);
      if (buyRes.error) throw buyRes.error;
      if (buyRes.data && buyRes.data.length > 0) {
        return { isNode: true, level: 1 };
      }

      return { isNode: false, level: 0 };
    },
  });

  return {
    isNode: q.data?.isNode ?? false,
    level: q.data?.level ?? 0,
    loading: q.isLoading,
  };
}
