-- hl-real-positions.sql — 真实 HL 持仓表 + 把 v_wallet_open_positions 的 HL 段从陈旧镜像
-- (trading_hl_positions)改读真实表(trading_hl_real_positions,由 hl-positions.mjs 维护)。
-- 这是**实际部署到 prod Supabase 的版本**(2026-06-07):视图保留线上 18 列
-- (含 admin schema 加的 is_manual/manual_mode/manual_id;create or replace view 不可丢列),
-- 4 个 union 段=PM真实 / HL真实(本次新) / HL手动 / PM手动,只把原 HL 镜像段换成真实表。
-- additive + 可回滚:回滚=把 HL 真实段改回原 trading_hl_positions 子查询。

create table if not exists public.trading_hl_real_positions (
  follower_address text not null,           -- engine EOA(小写)
  network          text not null,           -- mainnet | testnet
  coin             text not null,           -- "BTC" / "xyz:BRENTOIL"
  user_id          uuid,                    -- 账户(join trading_users 取 smart_wallet)
  size             numeric not null,        -- szi(+多 -空)
  entry_px         numeric,
  position_value   numeric,
  unrealized_pnl   numeric,
  leverage         numeric,
  updated_at       timestamptz not null default now(),
  primary key (follower_address, network, coin)
);
create index if not exists trading_hl_real_positions_user_idx on public.trading_hl_real_positions (user_id, network);

create or replace view public.v_wallet_open_positions as
 WITH pm_mark AS (
         SELECT COALESCE(m.symbol, lf.token_id) AS token_id,
            COALESCE(m.px, lf.px) AS px
           FROM ( SELECT DISTINCT ON (trading_polymarket_fills.token_id) trading_polymarket_fills.token_id,
                    trading_polymarket_fills.price AS px
                   FROM trading_polymarket_fills
                  ORDER BY trading_polymarket_fills.token_id, trading_polymarket_fills.matched_at DESC) lf
             FULL JOIN ( SELECT trading_mark_prices.symbol,
                    trading_mark_prices.px
                   FROM trading_mark_prices
                  WHERE trading_mark_prices.venue = 'polymarket'::text) m ON m.symbol = lf.token_id
        )
 SELECT 'polymarket'::text AS venue,
    u.smart_wallet_address AS wallet,
    p.user_id,
    p.market_id,
    p.token_id AS symbol,
    p.net_shares AS size,
    p.avg_entry_price AS entry_px,
    mk.px AS mark_px,
    p.net_shares * COALESCE(mk.px, p.avg_entry_price, 0::numeric) AS position_value_usd,
    p.net_shares * COALESCE(p.avg_entry_price, 0::numeric) AS position_cost_usd,
    p.net_shares * (COALESCE(mk.px, p.avg_entry_price, 0::numeric) - COALESCE(p.avg_entry_price, 0::numeric)) AS unrealized_pnl_usd,
    p.realized_pnl_usd,
    p.last_fill_at,
    p.updated_at,
    NULL::text AS tx_hash,
    false AS is_manual,
    NULL::text AS manual_mode,
    NULL::uuid AS manual_id
   FROM trading_positions p
     JOIN trading_users u ON u.id = p.user_id
     LEFT JOIN pm_mark mk ON mk.token_id = p.token_id
  WHERE p.net_shares IS DISTINCT FROM 0::numeric AND (COALESCE(p.settlement_status, ''::text) <> ALL (ARRAY['closed'::text, 'redeemed'::text, 'settled'::text, 'resolved'::text]))
UNION ALL
-- HL 段:改读真实持仓 trading_hl_real_positions(原 trading_hl_positions 镜像会漂移出幽灵仓)
 SELECT 'hl_'::text || rp.network AS venue,
    u.smart_wallet_address AS wallet,
    rp.user_id,
    rp.coin AS market_id,
    rp.coin AS symbol,
    rp.size AS size,
    rp.entry_px AS entry_px,
    mk.px AS mark_px,
    abs(rp.size) * COALESCE(mk.px, rp.entry_px, 0::numeric) AS position_value_usd,
    abs(rp.size) * COALESCE(rp.entry_px, 0::numeric) AS position_cost_usd,
    rp.size * (COALESCE(mk.px, rp.entry_px, 0::numeric) - COALESCE(rp.entry_px, 0::numeric)) AS unrealized_pnl_usd,
    NULL::numeric AS realized_pnl_usd,
    NULL::timestamp with time zone AS last_fill_at,
    rp.updated_at,
    NULL::text AS tx_hash,
    false AS is_manual,
    NULL::text AS manual_mode,
    NULL::uuid AS manual_id
   FROM trading_hl_real_positions rp
     JOIN trading_users u ON u.id = rp.user_id
     LEFT JOIN trading_mark_prices mk ON mk.venue = ('hl_'::text || rp.network) AND mk.symbol = rp.coin
  WHERE rp.size IS DISTINCT FROM 0::numeric
UNION ALL
 SELECT 'hl_'::text || mp.network AS venue,
    mp.wallet,
    NULL::uuid AS user_id,
    mp.coin AS market_id,
    mp.coin AS symbol,
    mp.size,
    mp.entry_px,
    COALESCE(mp.mark_px, mp.entry_px) AS mark_px,
    abs(mp.size) * COALESCE(mp.mark_px, mp.entry_px, 0::numeric) AS position_value_usd,
    abs(mp.size) * COALESCE(mp.entry_px, 0::numeric) AS position_cost_usd,
    COALESCE(mp.unrealized_pnl_usd, mp.size * (COALESCE(mp.mark_px, mp.entry_px, 0::numeric) - COALESCE(mp.entry_px, 0::numeric))) AS unrealized_pnl_usd,
    NULL::numeric AS realized_pnl_usd,
    NULL::timestamp with time zone AS last_fill_at,
    mp.updated_at,
    mp.tx_hash,
    true AS is_manual,
    mp.mode AS manual_mode,
    mp.id AS manual_id
   FROM trading_hl_manual_positions mp
  WHERE mp.active AND (mp.mode = ANY (ARRAY['add'::text, 'replace'::text]))
UNION ALL
 SELECT 'polymarket'::text AS venue,
    mp.wallet,
    NULL::uuid AS user_id,
    mp.market_id,
    COALESCE(mp.token_id, mp.title, mp.market_id) AS symbol,
    mp.size,
    mp.entry_px,
    COALESCE(mp.mark_px, mp.entry_px) AS mark_px,
    abs(mp.size) * COALESCE(mp.mark_px, mp.entry_px, 0::numeric) AS position_value_usd,
    abs(mp.size) * COALESCE(mp.entry_px, 0::numeric) AS position_cost_usd,
    COALESCE(mp.unrealized_pnl_usd, mp.size * (COALESCE(mp.mark_px, mp.entry_px, 0::numeric) - COALESCE(mp.entry_px, 0::numeric))) AS unrealized_pnl_usd,
    NULL::numeric AS realized_pnl_usd,
    NULL::timestamp with time zone AS last_fill_at,
    mp.updated_at,
    NULL::text AS tx_hash,
    true AS is_manual,
    mp.mode AS manual_mode,
    mp.id AS manual_id
   FROM trading_pm_manual_positions mp
  WHERE mp.active AND (mp.mode = ANY (ARRAY['add'::text, 'replace'::text]));
