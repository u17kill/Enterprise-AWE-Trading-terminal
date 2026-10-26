import { describe, expect, it } from "vitest";
import { STRATEGIES, getStrategy } from "./options-strategies";
import { analyzeScenario, calculatePayoff, validateScenario } from "./options-payoff";

describe("V0.8 options expiration payoff", () => {
  it("defines twelve usable strategies and computes their preset payoffs", () => {
    const cases: Array<[string, number, number, number, number[]]> = [
      ["long_call", -500, -500, 1500, [105]],
      ["long_put", 9500, -500, -500, [95]],
      ["covered_call", -9600, 400, 1400, [96]],
      ["collar", -900, 100, 1100, [99]],
      ["cash_secured_put", -9200, 300, 300, [92]],
      ["bull_call", -500, 0, 500, [100]],
      ["bear_call", 500, 0, -500, [100]],
      ["bull_put", -500, 0, 500, [100]],
      ["bear_put", 500, 0, -500, [100]],
      ["long_straddle", 9100, -900, 1100, [91, 109]],
      ["long_strangle", 8300, -700, 300, [83, 117]],
      ["iron_condor", -400, 600, -400, [84, 116]],
    ];
    expect(STRATEGIES).toHaveLength(12);
    expect(new Set(STRATEGIES.map((item) => item.id)).size).toBe(12);
    for (const [id, atZero, atSpot, atOneTwenty, breakEvens] of cases) {
      const strategy = getStrategy(id);
      expect(validateScenario(strategy, strategy.defaults).errors).toEqual([]);
      expect(calculatePayoff(strategy, strategy.defaults, 0)).toBe(atZero);
      expect(calculatePayoff(strategy, strategy.defaults, 100)).toBe(atSpot);
      expect(calculatePayoff(strategy, strategy.defaults, 120)).toBe(atOneTwenty);
      expect(analyzeScenario(strategy, strategy.defaults).summary?.breakEvens).toEqual(breakEvens);
    }
  });

  it("uses an independent stock cost for the collar", () => {
    const strategy = getStrategy("collar");
    const input = { ...strategy.defaults, spot: 105, stockCost: 95 };
    expect(calculatePayoff(strategy, input, 100)).toBe(600);
    expect(analyzeScenario(strategy, input).summary).toMatchObject({ bestPnl: 1600, worstPnl: -400, breakEvens: [94] });
  });

  it("shows both sides of an unequal-wing iron condor", () => {
    const strategy = getStrategy("iron_condor");
    const input = { ...strategy.defaults, strikes: { ...strategy.defaults.strikes, longPut: 75 }, premiums: { ...strategy.defaults.premiums, shortPut: 5 } };
    expect(analyzeScenario(strategy, input).summary).toMatchObject({ bestPnl: 700, worstPnl: -800, leftTailPnl: -800, rightTailPnl: -300, breakEvens: [83, 117] });
  });

  it("rejects impossible inputs without producing NaN", () => {
    const strategy = getStrategy("iron_condor");
    const reversed = { ...strategy.defaults, strikes: { ...strategy.defaults.strikes, longPut: 95 } };
    expect(validateScenario(strategy, reversed).errors.join(" ")).toMatch(/执行价/);
    expect(analyzeScenario(strategy, reversed).summary).toBeNull();
    expect(validateScenario(strategy, { ...strategy.defaults, contracts: 0 }).errors.join(" ")).toMatch(/张数/);
    expect(validateScenario(strategy, { ...strategy.defaults, spot: Number.NaN }).errors.join(" ")).toMatch(/股价/);
  });

  it("warns on unusual premium direction but still calculates the actual cash flow", () => {
    const strategy = getStrategy("bear_call");
    const input = { ...strategy.defaults, premiums: { shortCall: 2, longCall: 5 } };
    const result = analyzeScenario(strategy, input);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/净支出/);
    expect(result.summary?.netPremium).toBe(-300);
    expect(result.summary?.bestPnl).toBe(-300);
  });

  it("does not invent a break-even price when a collar stays profitable", () => {
    const strategy = getStrategy("collar");
    const input = { ...strategy.defaults, stockCost: 50 };
    expect(analyzeScenario(strategy, input).summary?.breakEvens).toEqual([]);
  });
});
