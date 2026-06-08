-- v_wallet_account_summary v3:余额基数自动取真实同步余额(= 充值金额),override 可手动覆盖。
--   基数 = COALESCE(余额override, 真实同步余额 trading_hl_account_state/trading_pm_account_state)
--   净值 = 基数 + Σ未实现;可用 = 基数 − 保证金;保证金率 = 保证金 / 净值。
--   → 不用每账户手设余额:有真实充值就自动用,做持仓单净值自动联动。
create or replace view public.v_wallet_account_summary as
 WITH pos AS (
         SELECT op.wallet, op.login_wallet, op.engine_eoa_address, op.venue,
            sum(op.position_value_usd) AS position_value_usd,
            sum(op.unrealized_pnl_usd) AS unrealized_pnl_usd,
            sum(op.position_value_usd / NULLIF(GREATEST(op.leverage, 1::numeric), 0::numeric)) AS margin_used_usd
           FROM v_wallet_open_positions op
          GROUP BY op.wallet, op.login_wallet, op.engine_eoa_address, op.venue
        ), base AS (
         SELECT pos.*,
            -- 余额基数:override 优先,否则真实同步余额(= 充值反映的现金)
            CASE
              WHEN pos.venue ~~ 'hl_%'::text THEN COALESCE(hlo.account_value_usd, hlas.account_value_usd)
              WHEN pos.venue = 'polymarket'::text THEN COALESCE(pmo.balance_usd, pmas.balance_usd)
              ELSE NULL::numeric
            END AS base_balance
           FROM pos
             LEFT JOIN trading_hl_overrides hlo ON pos.venue ~~ 'hl_%'::text AND lower(hlo.wallet) = lower(pos.wallet) AND ('hl_'::text || hlo.network) = pos.venue
             LEFT JOIN trading_pm_overrides pmo ON pos.venue = 'polymarket'::text AND lower(pmo.wallet) = lower(pos.wallet)
             LEFT JOIN trading_hl_account_state hlas ON pos.venue ~~ 'hl_%'::text AND lower(hlas.wallet) = lower(pos.engine_eoa_address) AND hlas.network = replace(pos.venue, 'hl_', '')
             LEFT JOIN trading_pm_account_state pmas ON pos.venue = 'polymarket'::text AND lower(pmas.wallet) = lower(pos.wallet)
        )
 SELECT base.wallet, base.login_wallet, base.engine_eoa_address, base.venue,
    base.base_balance + COALESCE(base.unrealized_pnl_usd, 0::numeric) AS account_value_usd,
    base.position_value_usd,
    base.unrealized_pnl_usd,
    base.margin_used_usd,
    CASE WHEN base.base_balance IS NOT NULL THEN base.base_balance - base.margin_used_usd ELSE NULL::numeric END AS available_usd,
    CASE WHEN NULLIF(base.base_balance + COALESCE(base.unrealized_pnl_usd,0::numeric), 0::numeric) IS NOT NULL
         THEN round(100::numeric * base.margin_used_usd / (base.base_balance + COALESCE(base.unrealized_pnl_usd,0::numeric)), 2)
         ELSE NULL::numeric END AS margin_ratio_pct
   FROM base;
grant select on public.v_wallet_account_summary to anon, authenticated;
