import { describe, expect, it } from "vitest";
import { costTotals, importPortfolio, parsePortfolio, type PortfolioMap } from "./portfolio-map";

const sample: PortfolioMap = {
  lanes: [{ id: "attack", name: "进攻" }, { id: "defense", name: "防御" }],
  positions: [
    { id: "1", laneId: "attack", symbol: "MSFT.US", name: "Microsoft", currency: "USD", quantity: 25, unitCost: 388.3192 },
    { id: "2", laneId: "attack", symbol: "7203.JP", name: "Toyota", currency: "JPY", quantity: 100, unitCost: 2400 },
    { id: "3", laneId: "defense", symbol: "AAPL.US", name: "Apple", currency: "USD", quantity: 2, unitCost: 100 },
  ],
};

describe("portfolio map", () => {
  it("totals cost within each currency without mixing currencies", () => {
    expect(costTotals(sample.positions)).toEqual({ USD: 9907.98, JPY: 240000 });
  });

  it("rejects invalid positions and removes positions in missing lanes", () => {
    expect(parsePortfolio({ lanes: sample.lanes, positions: [sample.positions[0], { ...sample.positions[1], laneId: "gone" }, { ...sample.positions[2], quantity: -2 }] })).toEqual({ lanes: sample.lanes, positions: [sample.positions[0]] });
  });

  it("previews only held common shares from an import and never auto saves", () => {
    expect(importPortfolio([
      { symbol: "MSFT", name: "Microsoft", type: "Stock", status: "held", currency: "USD", quantity: 25, totalCost: 9707.98, lane: "进攻" },
      { symbol: "DRAM", type: "ETF", status: "held", currency: "USD", quantity: 2, totalCost: 100 },
      { symbol: "NVDA", type: "Stock", status: "planned", currency: "USD", quantity: 2, totalCost: 100 },
    ])).toEqual({ lanes: [{ id: "lane-attack", name: "进攻" }], positions: [{ id: "import-1", laneId: "lane-attack", symbol: "MSFT", name: "Microsoft", currency: "USD", quantity: 25, unitCost: 9707.98 / 25 }] });
  });
  it("accepts held ADRs but not ETFs or plans in a dated source snapshot", () => {
    expect(importPortfolio({ asOf: "2026-08-15", rows: [{ symbol: "TSM", name: "TSMC ADR", type: "Stock / ADR", status: "held", currency: "USD", quantity: 5, totalCost: 1028.27, lane: "待分类" }] }).positions).toHaveLength(1);
  });
});
