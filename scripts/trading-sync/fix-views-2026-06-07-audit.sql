create or replace view public.v_wallet_daily_history as
 WITH disp AS (
         SELECT d_1.user_id,
            d_1.venue,
            d_1.day,
            d_1.position_value_usd,
            d_1.position_cost_usd,
            d_1.unrealized_pnl_usd,
            d_1.realized_pnl_cum_usd,
            d_1.realized_pnl_day_usd,
            d_1.day_pnl_usd,
            d_1.open_positions,
            d_1.closed_today,
            d_1.fills_today,
            d_1.fills_notional_today_usd,
            d_1.hl_today_used_usd,
            d_1.snapped_at,
            d_1.is_manual,
            d_1.manual_position_value_usd,
            d_1.manual_day_pnl_usd,
            d_1.manual_realized_pnl_day_usd,
            d_1.manual_unrealized_pnl_usd,
            d_1.manual_note,
            COALESCE(d_1.manual_position_value_usd, d_1.position_value_usd) AS v_position_value,
            COALESCE(d_1.manual_day_pnl_usd, d_1.day_pnl_usd) AS v_day_pnl,
            COALESCE(d_1.manual_realized_pnl_day_usd, d_1.realized_pnl_day_usd) AS v_realized_day,
            COALESCE(d_1.manual_unrealized_pnl_usd, d_1.unrealized_pnl_usd) AS v_unrealized
           FROM trading_acct_daily d_1
        )
 SELECT u.smart_wallet_address AS wallet,
    u.engine_eoa_address,
    u.status AS account_status,
    d.user_id,
    d.venue,
    d.day,
    d.v_position_value AS position_value_usd,
    round((((100)::numeric * d.v_position_value) / NULLIF(sum(d.v_position_value) OVER (PARTITION BY d.user_id, d.day), (0)::numeric)), 2) AS position_share_pct,
    d.position_cost_usd,
    d.v_day_pnl AS day_pnl_usd,
    round((((100)::numeric * d.v_day_pnl) / NULLIF(d.position_cost_usd, (0)::numeric)), 2) AS day_pnl_pct,
    d.v_realized_day AS realized_pnl_day_usd,
    round((((100)::numeric * d.v_realized_day) / NULLIF(d.position_cost_usd, (0)::numeric)), 2) AS realized_day_pct,
    d.v_unrealized AS unrealized_pnl_usd,
    round((((100)::numeric * d.v_unrealized) / NULLIF(d.position_cost_usd, (0)::numeric)), 2) AS unrealized_pct,
    d.realized_pnl_cum_usd,
    sum(d.v_day_pnl) OVER (PARTITION BY d.user_id, d.venue, (date_trunc('month'::text, (d.day)::timestamp with time zone)) ORDER BY d.day) AS mtd_pnl_usd,
    round((((100)::numeric * sum(d.v_day_pnl) OVER (PARTITION BY d.user_id, d.venue, (date_trunc('month'::text, (d.day)::timestamp with time zone)) ORDER BY d.day)) / NULLIF(first_value(d.position_cost_usd) OVER (PARTITION BY d.user_id, d.venue, (date_trunc('month'::text, (d.day)::timestamp with time zone)) ORDER BY d.day), (0)::numeric)), 2) AS mtd_pnl_pct,
    d.v_unrealized AS mtd_unrealized_pnl_usd,
    round((((100)::numeric * d.v_unrealized) / NULLIF(d.position_cost_usd, (0)::numeric)), 2) AS mtd_unrealized_pct,
    d.open_positions,
    d.closed_today,
    d.fills_today,
    d.fills_notional_today_usd,
    d.hl_today_used_usd,
    d.snapped_at,
    d.position_value_usd AS real_position_value_usd,
    d.day_pnl_usd AS real_day_pnl_usd,
    d.realized_pnl_day_usd AS real_realized_pnl_day_usd,
    d.unrealized_pnl_usd AS real_unrealized_pnl_usd,
    ((d.manual_position_value_usd IS NOT NULL) OR (d.manual_day_pnl_usd IS NOT NULL) OR (d.manual_realized_pnl_day_usd IS NOT NULL) OR (d.manual_unrealized_pnl_usd IS NOT NULL)) AS is_overridden,
    d.manual_note
   FROM (disp d
     JOIN trading_users u ON ((u.id = d.user_id)));
;

create or replace view public.v_wallet_today_closed as
 SELECT 'polymarket'::text AS venue,
    'fill'::text AS record_type,
    u.smart_wallet_address AS wallet,
    f.user_id,
    f.market_id,
    f.token_id AS symbol,
    f.side,
    f.price,
    f.size_shares AS size,
    f.notional_usd,
    NULL::numeric AS realized_pnl_usd,
    f.matched_at AS happened_at,
    NULL::text AS tx_hash
   FROM (trading_polymarket_fills f
     JOIN trading_users u ON ((u.id = f.user_id)))
  WHERE (f.matched_at >= ((((now() AT TIME ZONE 'Asia/Singapore'::text))::date)::timestamp without time zone AT TIME ZONE 'Asia/Singapore'::text))
UNION ALL
 SELECT 'polymarket'::text AS venue,
    'position_closed'::text AS record_type,
    u.smart_wallet_address AS wallet,
    p.user_id,
    p.market_id,
    p.token_id AS symbol,
    p.settlement_status AS side,
    p.avg_entry_price AS price,
    NULL::numeric AS size,
    (p.total_sold_usd + COALESCE(p.redeem_proceeds_usd, (0)::numeric)) AS notional_usd,
    p.realized_pnl_usd,
    p.updated_at AS happened_at,
    NULL::text AS tx_hash
   FROM (trading_positions p
     JOIN trading_users u ON ((u.id = p.user_id)))
  WHERE (((p.net_shares = (0)::numeric) OR (COALESCE(p.settlement_status, ''::text) = ANY (ARRAY['closed'::text, 'redeemed'::text, 'settled'::text, 'resolved'::text]))) AND (p.updated_at >= ((((now() AT TIME ZONE 'Asia/Singapore'::text))::date)::timestamp without time zone AT TIME ZONE 'Asia/Singapore'::text)))
UNION ALL
 SELECT r.venue,
    r.record_type,
    u.smart_wallet_address AS wallet,
    r.user_id,
    r.market_id,
    r.symbol,
    r.side,
    r.price,
    r.size,
    r.notional_usd,
    r.realized_pnl_usd,
    r.happened_at,
    r.tx_hash
   FROM (trading_trade_records r
     JOIN trading_users u ON ((u.id = r.user_id)))
  WHERE ((r.venue ~~ 'hl_%'::text) AND (r.record_type <> 'position_snapshot'::text) AND (NOT (EXISTS (SELECT 1 FROM trading_record_hidden h WHERE h.record_id = r.record_id))) AND (r.happened_at >= ((((now() AT TIME ZONE 'Asia/Singapore'::text))::date)::timestamp without time zone AT TIME ZONE 'Asia/Singapore'::text)));
;

create or replace view public.v_trade_records as
select venue, record_type, user_id, wallet, market_id, symbol, side,
  price, size, notional_usd, happened_at, record_id,
  source, realized_pnl_usd, created_at, tx_hash
from trading_trade_records r
where record_type <> 'position_snapshot'
  and not exists (select 1 from trading_record_hidden h where h.record_id = r.record_id);
