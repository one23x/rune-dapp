import { useReadContract } from "thirdweb/react";
import { nodePresellContract, NODE_IDS } from "@/lib/thirdweb/contracts";
import { useDemoStore } from "@/lib/demo-store";

/** Raw node config shape returned by NodePresell.getNodeConfigs.
 *  `directRate` is a basis-point value out of PREVISION (10000), so
 *  `1500 === 15 %` commission to the direct referrer on each purchase. */
export interface NodeConfig {
  nodeId: bigint;
  payToken: string;
  payAmount: bigint;
  maxLimit: bigint;
  curNum: bigint;
  directRate: bigint;
}

/**
 * Read the 4 node configs in one call. Returns an array aligned with
 * NODE_IDS [101, 201, 301, 401].
 */
export function useNodeConfigs() {
  const q = useReadContract({
    contract: nodePresellContract,
    method:
      "function getNodeConfigs(uint256[]) view returns ((uint256 nodeId, address payToken, uint256 payAmount, uint256 maxLimit, uint256 curNum, uint256 directRate)[])",
    params: [NODE_IDS.map((n) => BigInt(n))],
  });
  return q;
}

/**
 * Read the connected user's purchase record. amount === 0 means they
 * haven't bought anything yet.
 */
export function useUserPurchase(address?: string) {
  const { isDemoMode, demoNodeId } = useDemoStore.getState();
  const q = useReadContract({
    contract: nodePresellContract,
    method:
      "function getUserPurchaseData(address) view returns (address payToken, uint256 amount, uint256 payTime, uint256 nodeId)",
    params: [address ?? "0x0000000000000000000000000000000000000000"],
    queryOptions: { enabled: !!address && !isDemoMode },
  });

  if (isDemoMode && demoNodeId) {
    const PRICES: Record<number, bigint> = {
      101: 50000n * 10n ** 6n,
      201: 10000n * 10n ** 6n,
      301: 5000n * 10n ** 6n,
      401: 2500n * 10n ** 6n,
      501: 1000n * 10n ** 6n,
    };
    return {
      ...q,
      hasPurchased: true,
      payToken: "0x55d398326f99059fF775485246999027B3197955",
      amount: PRICES[demoNodeId] ?? 1000n * 10n ** 6n,
      payTime: BigInt(Math.floor(Date.now() / 1000) - 86400),
      nodeId: demoNodeId,
    };
  }

  const tuple = q.data as readonly [string, bigint, bigint, bigint] | undefined;
  return {
    ...q,
    hasPurchased: !!tuple && tuple[1] > 0n,
    payToken: tuple?.[0],
    amount: tuple?.[1],
    payTime: tuple?.[2],
    nodeId: tuple ? Number(tuple[3]) : undefined,
  };
}
