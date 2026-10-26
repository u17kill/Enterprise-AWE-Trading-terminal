import type { ScenarioInput, Strategy } from "./options-strategies";

export type PayoffSummary = {
  breakEvens: number[];
  zeroIntervals: Array<{ from: number; to: number | null }>;
  bestPnl: number | null;
  worstPnl: number | null;
  spotPnl: number;
  leftTailPnl: number;
  rightTailPnl: number;
  netPremium: number;
  chartMax: number;
};

const near = (value: number) => Math.abs(value) < 1e-7;
const roundPrice = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

function netPremium(strategy: Strategy, input: ScenarioInput): number {
  return strategy.legs.reduce((sum, leg) => sum + (leg.side === "sell" ? 1 : -1) * input.premiums[leg.id], 0) * input.contracts * input.multiplier;
}

export function validateScenario(strategy: Strategy, input: ScenarioInput): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Number.isFinite(input.spot) || input.spot <= 0) errors.push("当前股价须大于零");
  if (!Number.isInteger(input.contracts) || input.contracts <= 0) errors.push("合约张数须为正整数");
  if (!Number.isInteger(input.multiplier) || input.multiplier <= 0) errors.push("合约乘数须为正整数");
  if (strategy.stock && (!Number.isFinite(input.stockCost) || (input.stockCost ?? 0) <= 0)) errors.push("股票成本价须大于零");
  const strikeKeys = [...new Set(strategy.legs.map((leg) => leg.strikeKey))];
  for (const key of strikeKeys) if (!Number.isFinite(input.strikes[key]) || input.strikes[key] <= 0) errors.push(`${key} 执行价须大于零`);
  for (const leg of strategy.legs) if (!Number.isFinite(input.premiums[leg.id]) || input.premiums[leg.id] < 0) errors.push(`${leg.label} 权利金须为非负数`);
  if (strategy.strikeOrder && strategy.strikeOrder.some((key, index) => index > 0 && input.strikes[strategy.strikeOrder![index - 1]] >= input.strikes[key])) errors.push("执行价顺序不符合该策略的买卖腿要求");
  if (errors.length) return { errors, warnings };
  const premium = netPremium(strategy, input);
  if (strategy.usualFlow === "credit" && premium < -1e-7) warnings.push("按输入得到净支出，与此策略常见的净收入方向不同；仍按实际输入计算。");
  if (strategy.usualFlow === "debit" && premium > 1e-7) warnings.push("按输入得到净收入，与此策略常见的净支出方向不同；仍按实际输入计算。");
  if (strategy.id === "iron_condor") {
    const putWing = input.strikes.shortPut - input.strikes.longPut;
    const callWing = input.strikes.longCall - input.strikes.shortCall;
    if (!near(putWing - callWing)) warnings.push("铁鹰式两翼不等宽，下跌和上涨方向的最大风险不同。");
  }
  return { errors, warnings };
}

function rawPayoff(strategy: Strategy, input: ScenarioInput, expiryPrice: number): number {
  let perShare = strategy.stock ? expiryPrice - input.stockCost! : 0;
  for (const leg of strategy.legs) {
    const strike = input.strikes[leg.strikeKey];
    const intrinsic = leg.type === "call" ? Math.max(expiryPrice - strike, 0) : Math.max(strike - expiryPrice, 0);
    perShare += (leg.side === "buy" ? 1 : -1) * (intrinsic - input.premiums[leg.id]);
  }
  return perShare * input.contracts * input.multiplier;
}

export function calculatePayoff(strategy: Strategy, input: ScenarioInput, expiryPrice: number): number {
  const { errors } = validateScenario(strategy, input);
  if (errors.length) throw new Error(errors.join("；"));
  if (!Number.isFinite(expiryPrice) || expiryPrice < 0) throw new Error("到期股价不能小于零");
  return rawPayoff(strategy, input, expiryPrice);
}

export function analyzeScenario(strategy: Strategy, input: ScenarioInput): { errors: string[]; warnings: string[]; summary: PayoffSummary | null } {
  const { errors, warnings } = validateScenario(strategy, input);
  if (errors.length) return { errors, warnings, summary: null };
  const knots = [...new Set([0, ...strategy.legs.map((leg) => input.strikes[leg.strikeKey])])].sort((a, b) => a - b);
  const values = knots.map((price) => rawPayoff(strategy, input, price));
  const roots: number[] = [];
  const intervals: Array<{ from: number; to: number | null }> = [];
  for (let index = 0; index < knots.length - 1; index++) {
    const [a, b] = [knots[index], knots[index + 1]];
    const [fa, fb] = [values[index], values[index + 1]];
    if (near(fa) && near(fb)) intervals.push({ from: a, to: b });
    else if (near(fa)) roots.push(a);
    else if (near(fb)) roots.push(b);
    else if (fa * fb < 0) roots.push(a + (b - a) * (-fa) / (fb - fa));
  }
  const last = knots[knots.length - 1];
  const lastValue = values[values.length - 1];
  const tailSlope = rawPayoff(strategy, input, last + 1) - lastValue;
  if (near(tailSlope) && near(lastValue)) intervals.push({ from: last, to: null });
  else if (!near(tailSlope)) {
    const tailRoot = last - lastValue / tailSlope;
    if (tailRoot >= last - 1e-7) roots.push(tailRoot);
  } else if (near(lastValue)) roots.push(last);
  const mergedIntervals: typeof intervals = [];
  for (const interval of intervals) {
    const previous = mergedIntervals[mergedIntervals.length - 1];
    if (previous && previous.to !== null && near(previous.to - interval.from)) previous.to = interval.to;
    else mergedIntervals.push({ ...interval });
  }
  const breakEvens = [...new Set(roots.map(roundPrice))].filter((price) => !mergedIntervals.some((interval) => price >= interval.from - 1e-7 && (interval.to === null || price <= interval.to + 1e-7))).sort((a, b) => a - b);
  const bestPnl = tailSlope > 1e-7 ? null : Math.max(...values);
  const worstPnl = tailSlope < -1e-7 ? null : Math.min(...values);
  const maxReference = Math.max(input.spot, ...knots, ...breakEvens);
  return { errors, warnings, summary: {
    breakEvens,
    zeroIntervals: mergedIntervals,
    bestPnl,
    worstPnl,
    spotPnl: rawPayoff(strategy, input, input.spot),
    leftTailPnl: values[0],
    rightTailPnl: lastValue,
    netPremium: netPremium(strategy, input),
    chartMax: Math.max(1, maxReference * 1.25),
  } };
}
