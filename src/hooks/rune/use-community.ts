import { useReadContract } from "thirdweb/react";
import { communityContract, COMMUNITY_ROOT } from "@/lib/thirdweb/contracts";
import { useDemoStore } from "@/lib/demo-store";
import { DEMO_REFERRER } from "@/lib/demo-mock-data";

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * The caller's on-chain referrer. Three possible outcomes:
 *   - zero address → not bound yet; UI should prompt the user
 *   - COMMUNITY_ROOT (0x…0001) → top of the tree
 *   - any other 0x… → their upstream referrer
 */
export function useReferrerOf(address?: string) {
  const { isDemoMode } = useDemoStore.getState();
  const query = useReadContract({
    contract: communityContract,
    method: "function referrerOf(address) view returns (address)",
    params: [address ?? ZERO],
    queryOptions: { enabled: !!address && !isDemoMode },
  });

  if (isDemoMode) {
    const referrer = DEMO_REFERRER.toLowerCase();
    return {
      ...query,
      data: DEMO_REFERRER,
      referrer,
      isBound: true,
      isRoot: referrer === COMMUNITY_ROOT.toLowerCase(),
    };
  }

  const referrer = (query.data as string | undefined)?.toLowerCase();
  return {
    ...query,
    referrer,
    isBound: !!referrer && referrer !== ZERO.toLowerCase(),
    isRoot: !!referrer && referrer === COMMUNITY_ROOT.toLowerCase(),
  };
}
