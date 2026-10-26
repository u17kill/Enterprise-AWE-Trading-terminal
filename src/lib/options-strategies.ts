export type ScenarioInput = { spot: number; stockCost?: number; contracts: number; multiplier: number; strikes: Record<string, number>; premiums: Record<string, number> };
export type OptionLeg = { id: string; type: "call" | "put"; side: "buy" | "sell"; strikeKey: string; label: string };
export type Strategy = {
  id: string;
  name: string;
  english: string;
  category: string;
  summary: string;
  explanation: string;
  legs: OptionLeg[];
  stock: boolean;
  defaults: ScenarioInput;
  sourceUrl: string;
  strikeOrder?: string[];
  usualFlow?: "credit" | "debit";
};

const source = "https://www.optionseducation.org/strategies/all-strategies-en";
const preset = (strikes: Record<string, number>, premiums: Record<string, number>, stockCost?: number): ScenarioInput => ({ spot: 100, contracts: 1, multiplier: 100, strikes, premiums, ...(stockCost === undefined ? {} : { stockCost }) });
const leg = (id: string, label: string, type: "call" | "put", side: "buy" | "sell", strikeKey = id): OptionLeg => ({ id, label, type, side, strikeKey });

export const STRATEGIES: Strategy[] = [
  { id: "long_call", name: "买入看涨", english: "Long Call", category: "看涨", summary: "支付权利金，期待股价上涨。", explanation: "到期股价超过执行价与权利金之和后开始盈利；最大亏损为已支付权利金。", legs: [leg("call", "买入 Call", "call", "buy")], stock: false, defaults: preset({ call: 100 }, { call: 5 }), sourceUrl: source, usualFlow: "debit" },
  { id: "long_put", name: "买入看跌", english: "Long Put", category: "看跌", summary: "支付权利金，期待股价下跌。", explanation: "到期股价跌破执行价减权利金后开始盈利；股价最低为零，因此盈利有上限。", legs: [leg("put", "买入 Put", "put", "buy")], stock: false, defaults: preset({ put: 100 }, { put: 5 }), sourceUrl: source, usualFlow: "debit" },
  { id: "covered_call", name: "备兑看涨", english: "Covered Call", category: "持股增收", summary: "持股同时卖出 Call，收取权利金。", explanation: "看涨期权的卖出权利金缓冲小幅下跌；股价超过执行价后，持股收益被封顶。", legs: [leg("shortCall", "卖出 Call", "call", "sell")], stock: true, defaults: preset({ shortCall: 110 }, { shortCall: 4 }, 100), sourceUrl: source },
  { id: "collar", name: "衣领式", english: "Collar / Protective Collar", category: "持股保护", summary: "持股、买 Put 防跌、卖 Call 补贴成本。", explanation: "Put 执行价构成到期保护底线，Call 执行价封住上涨空间；盈亏还取决于股票成本价。", legs: [leg("longPut", "买入 Put", "put", "buy"), leg("shortCall", "卖出 Call", "call", "sell")], stock: true, defaults: preset({ longPut: 90, shortCall: 110 }, { longPut: 3, shortCall: 4 }, 100), sourceUrl: "https://www.optionseducation.org/strategies/all-strategies/collar-protective-collar", strikeOrder: ["longPut", "shortCall"] },
  { id: "cash_secured_put", name: "现金担保卖出看跌", english: "Cash-Secured Put", category: "择价买入", summary: "卖出 Put，并预留可能买入股票的资金。", explanation: "只要到期股价不低于执行价，收到的权利金即为收益；大跌仍可能导致较大亏损。", legs: [leg("shortPut", "卖出 Put", "put", "sell")], stock: false, defaults: preset({ shortPut: 95 }, { shortPut: 3 }), sourceUrl: source, usualFlow: "credit" },
  { id: "bull_call", name: "牛市看涨价差", english: "Bull Call Spread", category: "看涨价差", summary: "买低执行价 Call，卖高执行价 Call。", explanation: "付出净权利金换取有限的上涨收益，同时把最大亏损锁定在净支出。", legs: [leg("longCall", "买入低执行价 Call", "call", "buy"), leg("shortCall", "卖出高执行价 Call", "call", "sell")], stock: false, defaults: preset({ longCall: 95, shortCall: 105 }, { longCall: 8, shortCall: 3 }), sourceUrl: source, strikeOrder: ["longCall", "shortCall"], usualFlow: "debit" },
  { id: "bear_call", name: "熊市看涨价差", english: "Bear Call Spread", category: "看跌价差", summary: "卖低执行价 Call，买高执行价 Call。", explanation: "先收净权利金；若到期股价上涨穿过短腿执行价，收益逐步减少，长腿限制损失。", legs: [leg("shortCall", "卖出低执行价 Call", "call", "sell"), leg("longCall", "买入高执行价 Call", "call", "buy")], stock: false, defaults: preset({ shortCall: 95, longCall: 105 }, { shortCall: 8, longCall: 3 }), sourceUrl: "https://www.optionseducation.org/strategies/all-strategies/bear-call-spread-credit-call-spread", strikeOrder: ["shortCall", "longCall"], usualFlow: "credit" },
  { id: "bull_put", name: "牛市看跌价差", english: "Bull Put Spread", category: "看涨价差", summary: "卖高执行价 Put，买低执行价 Put。", explanation: "先收净权利金；到期股价维持在较高执行价之上时保留收入，低执行价 Put 限制损失。", legs: [leg("shortPut", "卖出高执行价 Put", "put", "sell"), leg("longPut", "买入低执行价 Put", "put", "buy")], stock: false, defaults: preset({ shortPut: 105, longPut: 95 }, { shortPut: 8, longPut: 3 }), sourceUrl: source, strikeOrder: ["longPut", "shortPut"], usualFlow: "credit" },
  { id: "bear_put", name: "熊市看跌价差", english: "Bear Put Spread", category: "看跌价差", summary: "买高执行价 Put，卖低执行价 Put。", explanation: "付出净权利金换取有限的下跌收益；低执行价 Put 将收益封顶。", legs: [leg("longPut", "买入高执行价 Put", "put", "buy"), leg("shortPut", "卖出低执行价 Put", "put", "sell")], stock: false, defaults: preset({ longPut: 105, shortPut: 95 }, { longPut: 8, shortPut: 3 }), sourceUrl: source, strikeOrder: ["shortPut", "longPut"], usualFlow: "debit" },
  { id: "long_straddle", name: "买入跨式", english: "Long Straddle", category: "大波动", summary: "同一执行价买入 Call 与 Put。", explanation: "不预设方向，但股价必须大幅波动，才能弥补两笔权利金。", legs: [leg("call", "买入 Call", "call", "buy", "center"), leg("put", "买入 Put", "put", "buy", "center")], stock: false, defaults: preset({ center: 100 }, { call: 5, put: 4 }), sourceUrl: source, usualFlow: "debit" },
  { id: "long_strangle", name: "买入宽跨式", english: "Long Strangle", category: "大波动", summary: "买入低执行价 Put 与高执行价 Call。", explanation: "通常比同执行价跨式成本低，但到期股价也需更大幅度偏离才能盈利。", legs: [leg("put", "买入低执行价 Put", "put", "buy"), leg("call", "买入高执行价 Call", "call", "buy")], stock: false, defaults: preset({ put: 90, call: 110 }, { put: 3, call: 4 }), sourceUrl: source, strikeOrder: ["put", "call"], usualFlow: "debit" },
  { id: "iron_condor", name: "铁鹰式", english: "Iron Condor / Short Condor", category: "区间收益", summary: "卖内侧 Put/Call，买外侧 Put/Call。", explanation: "到期股价落在两条卖出腿之间时通常保留净权利金；两侧买入腿分别限制下跌和上涨风险。", legs: [leg("longPut", "买入外侧 Put", "put", "buy"), leg("shortPut", "卖出内侧 Put", "put", "sell"), leg("shortCall", "卖出内侧 Call", "call", "sell"), leg("longCall", "买入外侧 Call", "call", "buy")], stock: false, defaults: preset({ longPut: 80, shortPut: 90, shortCall: 110, longCall: 120 }, { longPut: 1, shortPut: 4, shortCall: 4, longCall: 1 }), sourceUrl: "https://www.optionseducation.org/strategies/all-strategies/short-condor", strikeOrder: ["longPut", "shortPut", "shortCall", "longCall"], usualFlow: "credit" },
];

export function getStrategy(id: string): Strategy {
  const strategy = STRATEGIES.find((entry) => entry.id === id);
  if (!strategy) throw new Error(`未知期权策略：${id}`);
  return strategy;
}
