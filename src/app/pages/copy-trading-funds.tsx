/**
 * Strategy copy-trading — Funds (充值 / 提现 / 分成盈利), at /copy-trading/funds.
 * Reuses the deposit + withdraw dialogs from the overview; profit-share shows
 * fee-ledger data if present on orders, else a clear "0 / no data" state.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { ArrowDownToLine, ArrowUpFromLine, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumCard } from "@app/components/premium-card";
import { useEngineUser, usePusdBalance, useOrders } from "@app/lib/engine-hooks";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import {
  CopyGate, DepositDialog, WithdrawDialog, asArray, asNumber, pusdAmount, fmtUsd,
} from "@app/components/copy-trading/shared";

function FundsInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const balanceQ = usePusdBalance(userId);
  const ordersQ = useOrders(userId);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const balance = pusdAmount(balanceQ.data);
  const fees = useMemo(
    () => asArray(ordersQ.data).reduce((s, o: any) => s + asNumber(o?.fee ?? o?.fees ?? o?.profitShare), 0),
    [ordersQ.data],
  );

  return (
    <div className="space-y-4">
      <PremiumCard className="p-5 text-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("copyTrading.statBalance")}</div>
        {balanceQ.isLoading ? (
          <Skeleton className="h-8 w-32 mx-auto rounded" />
        ) : (
          <div className="text-3xl font-black tabular-nums num-gold">{fmtUsd(balance)}</div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button onClick={() => setDepositOpen(true)} className="bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold">
            <ArrowDownToLine className="h-4 w-4 mr-1.5" />{t("copyTrading.deposit")}
          </Button>
          <Button variant="outline" onClick={() => setWithdrawOpen(true)} className="border-amber-500/30">
            <ArrowUpFromLine className="h-4 w-4 mr-1.5" />{t("copyTrading.withdraw")}
          </Button>
        </div>
      </PremiumCard>

      <PremiumCard className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-amber-300/80" />
          <h3 className="text-[13px] font-bold text-foreground/85">{t("copyTrading.profitShareTitle")}</h3>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{t("copyTrading.profitShareDesc")}</p>
        {fees > 0 ? (
          <div className="flex justify-between text-[13px] pt-1">
            <span className="text-muted-foreground">{t("copyTrading.profitShareTitle")}</span>
            <span className="font-bold tabular-nums">{fmtUsd(fees)}</span>
          </div>
        ) : (
          <p className="text-[12px] text-foreground/45 pt-1">{t("copyTrading.profitShareNoData")}</p>
        )}
      </PremiumCard>

      <DepositDialog open={depositOpen} onOpenChange={setDepositOpen} userId={userId} />
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} userId={userId} available={balance} />
    </div>
  );
}

export default function CopyTradingFundsPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;
  const userQ = useEngineUser(wallet);
  const userId = userQ.data?.id ? String(userQ.data.id) : undefined;
  return (
    <CopyTradingLayout title={t("copyTrading.tabFunds")}>
      <CopyGate wallet={wallet} userLoading={userQ.isLoading} userId={userId}>
        {(uid) => <FundsInner userId={uid} />}
      </CopyGate>
    </CopyTradingLayout>
  );
}
