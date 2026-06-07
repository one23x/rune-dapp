-- ============================================================================
-- bind-connected-wallet-views.sql  (idempotent)
--
-- 根因:trading_users 每个会员有三地址 ——
--   hl_master_address   = 会员真正连接/登录的钱包(custodial 模式)
--   smart_wallet_address = 引擎派生的智能交易账户(现有视图的 wallet 匹配列)
--   engine_eoa_address  = 托管 EOA
-- 面向用户的 5 个视图原本只暴露 smart_wallet_address 作为 `wallet`,会员用登录
-- 钱包查一律落空。本脚本对 5 个视图【新增】login_wallet(=hl_master_address)与
-- engine_eoa_address(若未暴露),并加交易所式账户数据层(leverage / 账户摘要)。
--
-- 纪律:只增列,不删不改任何现有列;全幂等(create or replace / add column if not exists)。
-- 运行:psql "<DATABASE_URL>" -f bind-connected-wallet-views.sql
-- ============================================================================

-- ── 任务 2a:为 PM 手动持仓补 leverage 列(HL 手动持仓已有 leverage)──────────
alter table public.trading_pm_manual_positions
  add column if not exists leverage numeric not null default 1;
-- HL 手动持仓 leverage 已存在;幂等保险:
alter table public.trading_hl_manual_positions
  add column if not exists leverage numeric not null default 1;

-- ════════════════════════════════════════════════════════════════════════════
-- 视图 1:v_wallet_open_positions
--   新增列(追加在末尾以满足 create-or-replace 的列顺序约束):
--     login_wallet, engine_eoa_address, leverage
--   真实 HL 行 leverage 取 trading_hl_real_positions.leverage;
--   手动行取各自 manual 表 leverage;PM custodial(shares)无杠杆 = NULL。
-- 注:现有列顺序原样保留(venue..manual_id),新列一律置末。
-- ════════════════════════════════════════════════════════════════════════════
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
    NULL::uuid AS manual_id,
    u.hl_master_address AS login_wallet,
    u.engine_eoa_address,
    NULL::numeric AS leverage
   FROM trading_positions p
     JOIN trading_users u ON u.id = p.user_id
     LEFT JOIN pm_mark mk ON mk.token_id = p.token_id
  WHERE p.net_shares IS DISTINCT FROM 0::numeric AND (COALESCE(p.settlement_status, ''::text) <> ALL (ARRAY['closed'::text, 'redeemed'::text, 'settled'::text, 'resolved'::text]))
UNION ALL
 SELECT 'hl_'::text || rp.network AS venue,
    u.smart_wallet_address AS wallet,
    rp.user_id,
    rp.coin AS market_id,
    rp.coin AS symbol,
    rp.size,
    rp.entry_px,
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
    NULL::uuid AS manual_id,
    u.hl_master_address AS login_wallet,
    u.engine_eoa_address,
    rp.leverage
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
    mp.id AS manual_id,
    u.hl_master_address AS login_wallet,
    u.engine_eoa_address,
    mp.leverage
   FROM trading_hl_manual_positions mp
     LEFT JOIN trading_users u ON lower(u.smart_wallet_address) = lower(mp.wallet)
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
    mp.id AS manual_id,
    u.hl_master_address AS login_wallet,
    u.engine_eoa_address,
    mp.leverage
   FROM trading_pm_manual_positions mp
     LEFT JOIN trading_users u ON lower(u.smart_wallet_address) = lower(mp.wallet)
  WHERE mp.active AND (mp.mode = ANY (ARRAY['add'::text, 'replace'::text]));

grant select on public.v_wallet_open_positions to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 视图 2:v_wallet_daily_history(已暴露 engine_eoa_address,补 login_wallet)
-- ════════════════════════════════════════════════════════════════════════════
create or replace view public.v_wallet_daily_history as
 SELECT u.smart_wallet_address AS wallet,
    u.engine_eoa_address,
    u.status AS account_status,
    d.user_id,
    d.venue,
    d.day,
    d.position_value_usd,
    round(100::numeric * d.position_value_usd / NULLIF(sum(d.position_value_usd) OVER (PARTITION BY d.user_id, d.day), 0::numeric), 2) AS position_share_pct,
    d.position_cost_usd,
    d.day_pnl_usd,
    round(100::numeric * d.day_pnl_usd / NULLIF(d.position_cost_usd, 0::numeric), 2) AS day_pnl_pct,
    d.realized_pnl_day_usd,
    round(100::numeric * d.realized_pnl_day_usd / NULLIF(d.position_cost_usd, 0::numeric), 2) AS realized_day_pct,
    d.unrealized_pnl_usd,
    round(100::numeric * d.unrealized_pnl_usd / NULLIF(d.position_cost_usd, 0::numeric), 2) AS unrealized_pct,
    d.realized_pnl_cum_usd,
    sum(d.day_pnl_usd) OVER (PARTITION BY d.user_id, d.venue, (date_trunc('month'::text, d.day::timestamp with time zone)) ORDER BY d.day) AS mtd_pnl_usd,
    round(100::numeric * sum(d.day_pnl_usd) OVER (PARTITION BY d.user_id, d.venue, (date_trunc('month'::text, d.day::timestamp with time zone)) ORDER BY d.day) / NULLIF(first_value(d.position_cost_usd) OVER (PARTITION BY d.user_id, d.venue, (date_trunc('month'::text, d.day::timestamp with time zone)) ORDER BY d.day), 0::numeric), 2) AS mtd_pnl_pct,
    d.unrealized_pnl_usd AS mtd_unrealized_pnl_usd,
    round(100::numeric * d.unrealized_pnl_usd / NULLIF(d.position_cost_usd, 0::numeric), 2) AS mtd_unrealized_pct,
    d.open_positions,
    d.closed_today,
    d.fills_today,
    d.fills_notional_today_usd,
    d.hl_today_used_usd,
    d.snapped_at,
    d.sync_position_value_usd AS real_position_value_usd,
    d.sync_day_pnl_usd AS real_day_pnl_usd,
    d.sync_realized_pnl_day_usd AS real_realized_pnl_day_usd,
    d.sync_unrealized_pnl_usd AS real_unrealized_pnl_usd,
    d.position_value_usd IS DISTINCT FROM d.sync_position_value_usd OR d.day_pnl_usd IS DISTINCT FROM d.sync_day_pnl_usd OR d.realized_pnl_day_usd IS DISTINCT FROM d.sync_realized_pnl_day_usd OR d.unrealized_pnl_usd IS DISTINCT FROM d.sync_unrealized_pnl_usd AS is_overridden,
    d.manual_note,
    u.hl_master_address AS login_wallet
   FROM trading_acct_daily d
     JOIN trading_users u ON u.id = d.user_id;

grant select on public.v_wallet_daily_history to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 视图 3:v_wallet_today_stats(薄包 daily_history,补透传 login_wallet)
-- ════════════════════════════════════════════════════════════════════════════
create or replace view public.v_wallet_today_stats as
 SELECT wallet,
    engine_eoa_address,
    account_status,
    user_id,
    venue,
    day,
    position_value_usd,
    position_share_pct,
    position_cost_usd,
    day_pnl_usd,
    day_pnl_pct,
    realized_pnl_day_usd,
    realized_day_pct,
    unrealized_pnl_usd,
    unrealized_pct,
    realized_pnl_cum_usd,
    mtd_pnl_usd,
    mtd_pnl_pct,
    mtd_unrealized_pnl_usd,
    mtd_unrealized_pct,
    open_positions,
    closed_today,
    fills_today,
    fills_notional_today_usd,
    hl_today_used_usd,
    snapped_at,
    real_position_value_usd,
    real_day_pnl_usd,
    real_realized_pnl_day_usd,
    real_unrealized_pnl_usd,
    is_overridden,
    manual_note,
    login_wallet
   FROM v_wallet_daily_history h
  WHERE day = (now() AT TIME ZONE 'Asia/Singapore'::text)::date;

grant select on public.v_wallet_today_stats to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 视图 4:v_wallet_today_closed(每个 UNION 分支补 login_wallet + engine_eoa_address)
-- ════════════════════════════════════════════════════════════════════════════
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
    NULL::text AS tx_hash,
    u.hl_master_address AS login_wallet,
    u.engine_eoa_address
   FROM trading_polymarket_fills f
     JOIN trading_users u ON u.id = f.user_id
  WHERE f.matched_at >= ((now() AT TIME ZONE 'Asia/Singapore'::text)::date::timestamp without time zone AT TIME ZONE 'Asia/Singapore'::text)
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
    p.total_sold_usd + COALESCE(p.redeem_proceeds_usd, 0::numeric) AS notional_usd,
    p.realized_pnl_usd,
    p.updated_at AS happened_at,
    NULL::text AS tx_hash,
    u.hl_master_address AS login_wallet,
    u.engine_eoa_address
   FROM trading_positions p
     JOIN trading_users u ON u.id = p.user_id
  WHERE (p.net_shares = 0::numeric OR (COALESCE(p.settlement_status, ''::text) = ANY (ARRAY['closed'::text, 'redeemed'::text, 'settled'::text, 'resolved'::text]))) AND p.updated_at >= ((now() AT TIME ZONE 'Asia/Singapore'::text)::date::timestamp without time zone AT TIME ZONE 'Asia/Singapore'::text)
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
    r.tx_hash,
    u.hl_master_address AS login_wallet,
    u.engine_eoa_address
   FROM trading_trade_records r
     JOIN trading_users u ON u.id = r.user_id
  WHERE r.venue ~~ 'hl_%'::text AND r.record_type <> 'position_snapshot'::text AND NOT (EXISTS ( SELECT 1
           FROM trading_record_hidden h
          WHERE h.record_id = r.record_id)) AND r.happened_at >= ((now() AT TIME ZONE 'Asia/Singapore'::text)::date::timestamp without time zone AT TIME ZONE 'Asia/Singapore'::text);

grant select on public.v_wallet_today_closed to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 视图 5:v_trade_records(直读 trading_trade_records,wallet=smart;
--   LEFT JOIN trading_users 取 login_wallet / engine_eoa_address)
-- ════════════════════════════════════════════════════════════════════════════
create or replace view public.v_trade_records as
 SELECT r.venue,
    r.record_type,
    r.user_id,
    r.wallet,
    r.market_id,
    r.symbol,
    r.side,
    r.price,
    r.size,
    r.notional_usd,
    r.happened_at,
    r.record_id,
    r.source,
    r.realized_pnl_usd,
    r.created_at,
    r.tx_hash,
    u.hl_master_address AS login_wallet,
    u.engine_eoa_address
   FROM trading_trade_records r
     LEFT JOIN trading_users u ON lower(u.smart_wallet_address) = lower(r.wallet)
  WHERE r.record_type <> 'position_snapshot'::text AND NOT (EXISTS ( SELECT 1
           FROM trading_record_hidden h
          WHERE h.record_id = r.record_id));

grant select on public.v_trade_records to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 任务 2c:v_wallet_account_summary —— 交易所式账户摘要(每 (wallet, venue) 一行)
--
-- 口径(诚实模型,不造假现金):
--   * position_value_usd / unrealized_pnl_usd:聚合 v_wallet_open_positions(show 口径,
--     含手动叠加 + 真实)。这是用户实际看到的持仓口径。
--   * account_value_usd:admin 余额覆盖值 ——
--       HL  = trading_hl_overrides.account_value_usd(按 wallet=smart + network 匹配)
--       PM  = trading_pm_overrides.balance_usd(按 wallet=smart 匹配)
--     未设覆盖 = NULL(dapp 回退引擎实时现金,本视图不臆造)。
--   * margin_used_usd = Σ(持仓名义 / leverage);leverage 为空或 ≤0 时该仓位按 1x
--     (= 全名义,保守)。PM custodial 无杠杆即 1x。
--   * available_usd  = account_value_usd − margin_used_usd(两者非空才算,否则 NULL)。
--   * margin_ratio_pct = margin_used_usd / account_value_usd × 100(account_value 非空且非0才算)。
-- ════════════════════════════════════════════════════════════════════════════
create or replace view public.v_wallet_account_summary as
 WITH pos AS (
    SELECT op.wallet,
           op.login_wallet,
           op.engine_eoa_address,
           op.venue,
           sum(op.position_value_usd)                                   AS position_value_usd,
           sum(op.unrealized_pnl_usd)                                   AS unrealized_pnl_usd,
           sum(op.position_value_usd / NULLIF(GREATEST(op.leverage, 1::numeric), 0::numeric)) AS margin_used_usd
      FROM v_wallet_open_positions op
     GROUP BY op.wallet, op.login_wallet, op.engine_eoa_address, op.venue
 )
 SELECT pos.wallet,
        pos.login_wallet,
        pos.engine_eoa_address,
        pos.venue,
        -- account_value:仅当 admin 设了覆盖才有值,否则 NULL(dapp 回退引擎)
        CASE
          WHEN pos.venue LIKE 'hl_%'      THEN hlo.account_value_usd
          WHEN pos.venue = 'polymarket'   THEN pmo.balance_usd
          ELSE NULL::numeric
        END                                                            AS account_value_usd,
        pos.position_value_usd,
        pos.unrealized_pnl_usd,
        pos.margin_used_usd,
        -- available = account_value − margin_used(两者非空才算)
        CASE
          WHEN pos.venue LIKE 'hl_%'    AND hlo.account_value_usd IS NOT NULL
            THEN hlo.account_value_usd - pos.margin_used_usd
          WHEN pos.venue = 'polymarket' AND pmo.balance_usd       IS NOT NULL
            THEN pmo.balance_usd - pos.margin_used_usd
          ELSE NULL::numeric
        END                                                            AS available_usd,
        -- margin_ratio_pct = margin_used / account_value × 100
        CASE
          WHEN pos.venue LIKE 'hl_%'    AND NULLIF(hlo.account_value_usd, 0::numeric) IS NOT NULL
            THEN round(100::numeric * pos.margin_used_usd / hlo.account_value_usd, 2)
          WHEN pos.venue = 'polymarket' AND NULLIF(pmo.balance_usd, 0::numeric)       IS NOT NULL
            THEN round(100::numeric * pos.margin_used_usd / pmo.balance_usd, 2)
          ELSE NULL::numeric
        END                                                            AS margin_ratio_pct
   FROM pos
   LEFT JOIN trading_hl_overrides hlo
     ON pos.venue LIKE 'hl_%'
    AND lower(hlo.wallet) = lower(pos.wallet)
    AND ('hl_'::text || hlo.network) = pos.venue
   LEFT JOIN trading_pm_overrides pmo
     ON pos.venue = 'polymarket'
    AND lower(pmo.wallet) = lower(pos.wallet);

grant select on public.v_wallet_account_summary to anon, authenticated;
