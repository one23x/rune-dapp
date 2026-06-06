/**
 * Smart Copy-Trading — Stats (交易数据), at /copy-trading/stats.
 *
 * First-screen content is the reusable TradeRecordsDetail (三 Tab 当前持仓 / 当日平仓
 * / 历史记录 + 交易记录三分类), reading the NEW Supabase stats layer
 * (v_wallet_open_positions / v_wallet_today_closed / v_wallet_daily_history /
 * v_trade_records / v_wallet_today_stats) via trading-stats-hooks — NOT the engine
 * API and NOT the raw synced trading_* tables.
 *
 * Scoped to the CONNECTED wallet only — the account-wide 亏损监控 (loss monitor) is
 * an internal/operations view and is intentionally NOT shown to end users here.
 */

import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { CopyTradingLayout } from "@app/components/copy-trading/layout";
import { TradeRecordsDetail } from "@app/components/copy-trading/trade-records-detail";

export default function CopyTradingStatsPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address;

  return (
    <CopyTradingLayout title={t("copyTrading.statsTitle", "交易数据")}>
      <TradeRecordsDetail wallet={wallet} />
    </CopyTradingLayout>
  );
}
