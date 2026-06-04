import { useReadContract } from "thirdweb/react";
import { getActiveClaimCondition } from "thirdweb/extensions/erc1155";
import { arbNodeDropContract } from "@/lib/thirdweb/contracts";

/**
 * Read the live claim condition for one Edition Drop tier (token id) on
 * Arbitrum One. Returns price (in USDC base units, 6 decimals on this drop),
 * the max claimable supply, and how much has already been claimed — so the UI
 * can show real remaining seats instead of the static snapshot in ARB_NODE_TIERS.
 *
 * Mirrors the BSC `useNodeConfigs` style (thirdweb `useReadContract` with an
 * extension). `getActiveClaimCondition` is the DropERC1155 read; it throws if
 * no active phase is set, which react-query surfaces as `isError` — the
 * component falls back to the static tier table in that case.
 */
export function useArbTierClaimCondition(tokenId: bigint) {
  return useReadContract(getActiveClaimCondition, {
    contract: arbNodeDropContract,
    tokenId,
  });
}
