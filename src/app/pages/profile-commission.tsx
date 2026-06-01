import { useActiveAccount } from "thirdweb/react";
import { RewardsPanel } from "@app/components/profile/team-detail";

/**
 * 奖励历史 page — reuses the Referral & Team RewardsPanel. Reads the
 * wallet's commission events / rewards from the existing data pipeline.
 * No separate UI to maintain.
 */
export default function ProfileCommission() {
  const account = useActiveAccount();
  const address = account?.address;
  if (!address) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        请先连接钱包
      </div>
    );
  }
  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <RewardsPanel address={address} />
    </div>
  );
}
