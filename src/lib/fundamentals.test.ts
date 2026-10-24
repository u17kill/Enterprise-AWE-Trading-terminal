import { describe, expect, it } from "vitest";
import { parseFundamentals, yearRange } from "./fundamentals";

describe("chart fundamentals", () => {
  it("keeps quarterly yoy percentages and period, without inventing forward PE", () => {
    expect(parseFundamentals([{ symbol: "AAPL.US", pe_ttm_ratio: "39.36", pb_ratio: "47.20", dividend_ratio_ttm: "0.30" }], {
      report: "qf", fiscal_year: 2026, fiscal_period: "3", fp_end: "2026.06.27", fo_revenue: { yoy: "16.36" }, fo_eps: { yoy: "28.66" },
    }, "AAPL.US")).toEqual({ peTtm: 39.36, pb: 47.2, dividendYield: 0.3, revenueYoy: 16.36, epsYoy: 28.66, reportPeriod: "FY2026 Q3", reportEnd: "2026-06-27" });
  });

  it("omits nonpositive PE and incomplete 52-week candles", () => {
    expect(parseFundamentals([{ symbol: "AAPL.US", pe_ttm_ratio: "-3" }], {}, "AAPL.US").peTtm).toBeUndefined();
    expect(yearRange(Array.from({ length: 100 }, (_, index) => ({ time: `2026-01-${String(index % 28 + 1).padStart(2, "0")}`, open: 1, high: 2, low: 1, close: 1.5, volume: 1 })))).toBeNull();
  });

  it("calculates static PE only from a dated positive fiscal-year EPS", () => {
    const annual = { report: "af", fiscal_year: 2025, fp_end: "2025.09.27", fo_eps: { value: "7.46" } };
    const parsed = parseFundamentals([], {}, "AAPL.US", annual, 347.73);
    expect(parsed.staticPe).toBeCloseTo(347.73 / 7.46);
    expect(parsed.staticPePeriod).toBe("FY2025 · 截至 2025-09-27");
    expect(parseFundamentals([], {}, "AAPL.US", { ...annual, fo_eps: { value: "0" } }, 347.73).staticPe).toBeUndefined();
  });
});
