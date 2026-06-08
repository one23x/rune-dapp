-- v_wallet_account_summary v2:净值 = 余额(override) + Σ未实现,随持仓自动联动。
-- override(trading_hl_overrides.account_value_usd / trading_pm_overrides.balance_usd)语义 = 余额/现金基数。
--   净值 = 余额 + Σ未实现盈亏(含手动持仓)→ 做一张带浮盈的持仓单,净值自动跟着变。
--   可用 = 余额 − 已用保证金;保证金率 = 已用保证金 / 净值。
--   override 为 NULL(未设余额)→ 净值/可用 NULL,dapp 回退引擎实时(真实账户已含浮盈)。
create or replace view public.v_wallet_account_summary as
 WITH pos AS (
         SELECT op.wallet, op.login_wallet, op.engine_eoa_address, op.venue,
            sum(op.position_value_usd) AS position_value_usd,
            sum(op.unrealized_pnl_usd) AS unrealized_pnl_usd,
            sum(op.position_value_usd / NULLIF(GREATEST(op.leverage, 1::numeric), 0::numeric)) AS margin_used_usd
           FROM v_wallet_open_positions op
          GROUP BY op.wallet, op.login_wallet, op.engine_eoa_address, op.venue
        )
 SELECT pos.wallet, pos.login_wallet, pos.engine_eoa_address, pos.venue,
        -- 净值 = 余额(override) + Σ未实现;余额为 NULL → NULL(回退引擎)
        CASE
            WHEN pos.venue ~~ 'hl_%'::text THEN hlo.account_value_usd + COALESCE(pos.unrealized_pnl_usd, 0::numeric)
            WHEN pos.venue = 'polymarket'::text THEN pmo.balance_usd + COALESCE(pos.unrealized_pnl_usd, 0::numeric)
            ELSE NULL::numeric
        END AS account_value_usd,
    pos.position_value_usd,
    pos.unrealized_pnl_usd,
    pos.margin_used_usd,
        -- 可用 = 余额 − 已用保证金
        CASE
            WHEN pos.venue ~~ 'hl_%'::text AND hlo.account_value_usd IS NOT NULL THEN hlo.account_value_usd - pos.margin_used_usd
            WHEN pos.venue = 'polymarket'::text AND pmo.balance_usd IS NOT NULL THEN pmo.balance_usd - pos.margin_used_usd
            ELSE NULL::numeric
        END AS available_usd,
        -- 保证金率 = 已用保证金 / 净值(余额+未实现)
        CASE
            WHEN pos.venue ~~ 'hl_%'::text AND NULLIF(hlo.account_value_usd + COALESCE(pos.unrealized_pnl_usd,0::numeric), 0::numeric) IS NOT NULL
                 THEN round(100::numeric * pos.margin_used_usd / (hlo.account_value_usd + COALESCE(pos.unrealized_pnl_usd,0::numeric)), 2)
            WHEN pos.venue = 'polymarket'::text AND NULLIF(pmo.balance_usd + COALESCE(pos.unrealized_pnl_usd,0::numeric), 0::numeric) IS NOT NULL
                 THEN round(100::numeric * pos.margin_used_usd / (pmo.balance_usd + COALESCE(pos.unrealized_pnl_usd,0::numeric)), 2)
            ELSE NULL::numeric
        END AS margin_ratio_pct
   FROM pos
     LEFT JOIN trading_hl_overrides hlo ON pos.venue ~~ 'hl_%'::text AND lower(hlo.wallet) = lower(pos.wallet) AND ('hl_'::text || hlo.network) = pos.venue
     LEFT JOIN trading_pm_overrides pmo ON pos.venue = 'polymarket'::text AND lower(pmo.wallet) = lower(pos.wallet);
grant select on public.v_wallet_account_summary to anon, authenticated;
