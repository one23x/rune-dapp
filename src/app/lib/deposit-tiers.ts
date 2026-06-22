/**
 * 充值档位 × 绑定风控 —— 来自 rune-intelligent-trading-manual.md(v1.0,市场团队规范)。
 *
 * 规则:用户充值**只能从所属节点等级开放的固定金额按钮选**(不可手输);每个金额**绑定**
 * 一套风控(单笔=本金 10% / 每日笔数 / 最高杠杆 / ROE 止盈止损),确认即写入跟单订阅,
 * 再与节点等级硬上限取「更严」。累计充值 ≤ 等级总上限(useDepositCap 的 cap 是授权码实际上限)。
 *
 * 本文件是该规范的单一事实源(前端展示);真正把风控写进订阅 + 执行,是后端执行器/风控引擎职责。
 */

export interface RiskPreset {
  /** 单笔名义额 = 本金的百分比(全档 10%)。 */
  perTradePct: number;
  /** 每日最多开仓笔数。 */
  dailyTrades: number;
  /** 最高杠杆(全档封顶 5x)。 */
  maxLev: number;
  /** 止盈(ROE %)。 */
  tpRoe: number;
  /** 止损(ROE %)。 */
  slRoe: number;
  /** 风险定位 i18n key 后缀(depositTier.pos.<key>)。 */
  posKey: string;
}

/** 充值金额 → 绑定风控(manual 第三章核心表)。同一金额在任何等级里规则一致。 */
export const RISK_BY_AMOUNT: Record<number, RiskPreset> = {
  1000: { perTradePct: 10, dailyTrades: 10, maxLev: 3, tpRoe: 12, slRoe: 9, posKey: "steady" },
  2000: { perTradePct: 10, dailyTrades: 15, maxLev: 5, tpRoe: 15, slRoe: 11, posKey: "balanced" },
  5000: { perTradePct: 10, dailyTrades: 20, maxLev: 10, tpRoe: 20, slRoe: 15, posKey: "aggressive" },
};

/** 各等级开放的固定充值金额(manual 第二章)。 */
export const LEVEL_AMOUNTS: Record<number, number[]> = {
  1: [1000],
  2: [1000, 2000],
  3: [1000, 2000],
  4: [1000, 2000, 5000],
  5: [1000, 2000, 5000],
};

/** 各等级总充值硬上限(累计封顶,manual 第二章)。 */
export const LEVEL_TOTAL_CAP: Record<number, number> = {
  1: 1000, 2: 3000, 3: 10000, 4: 20000, 5: 50000,
};

/** 各等级硬上限(单笔/当日/笔数/杠杆,manual 第二章)—— 绑定值再与此取更严。 */
export const LEVEL_HARD: Record<number, { perTradeUsd: number; dailyUsd: number; dailyCount: number; maxLev: number }> = {
  // 2026-06-18:每日笔数硬上限抬到匹配档位(L1=10/L2-3=15/L4-5=20);dailyUsd 同步放够(笔数×单笔)。
  1: { perTradeUsd: 100, dailyUsd: 1000, dailyCount: 10, maxLev: 3 },
  2: { perTradeUsd: 300, dailyUsd: 3000, dailyCount: 15, maxLev: 5 },
  3: { perTradeUsd: 800, dailyUsd: 4000, dailyCount: 15, maxLev: 5 },
  4: { perTradeUsd: 2000, dailyUsd: 12000, dailyCount: 20, maxLev: 10 },
  5: { perTradeUsd: 5000, dailyUsd: 40000, dailyCount: 20, maxLev: 20 },
};

export function amountsForLevel(level: number): number[] {
  return LEVEL_AMOUNTS[level] ?? [];
}

/** 已定义档位金额(升序)。 */
export const TIER_AMOUNTS: number[] = Object.keys(RISK_BY_AMOUNT).map(Number).sort((a, b) => a - b);

/** 把任意 USD(如账户净值)向下吸附到最近的已定义档位(< 最小档 → 最小档)。用于风险台按净值显示所处档位风控。 */
export function tierForAmount(amountUsd: number): number {
  const a = Math.max(0, amountUsd);
  let tier = TIER_AMOUNTS[0];
  for (const t of TIER_AMOUNTS) if (a >= t) tier = t;
  return tier;
}

/** 该金额绑定的单笔名义额(USD)= 金额 × perTradePct%。 */
export function perTradeUsd(amount: number): number {
  const r = RISK_BY_AMOUNT[amount];
  return r ? Math.round((amount * r.perTradePct) / 100) : 0;
}
