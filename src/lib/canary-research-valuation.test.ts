import { describe, expect, it } from "vitest";
import { parseDanjuanPe, parseStateStreetDow, valuationPercentiles } from "./canary-research-valuation";

describe("valuation history", () => {
  it("parses weekly PE history with a local observation date", () => {
    const result = parseDanjuanPe({ result_code: 0, data: { index_eva_pe_growths: [{ ts: Date.parse("2026-10-30T00:00:00Z"), pe: 23.7 }] } });
    expect(result).toEqual([{ date: "2026-10-30", value: 23.7 }]);
  });
  it("does not label a short sample as a 10-year percentile", () => {
    const points = Array.from({ length: 120 }, (_, i) => ({ date: new Date(Date.UTC(2024, 0, 1 + i * 7)).toISOString().slice(0, 10), value: 10 + i / 100 }));
    expect(valuationPercentiles(points)[10]).toBeNull();
  });
  it("rejects invalid PE values", () => {
    expect(parseDanjuanPe({ result_code: 0, data: { index_eva_pe_growths: [{ ts: 100, pe: -2 }] } })).toEqual([]);
  });
  it("reads the index PE rather than the DIA fund's FY1 PE", () => {
    const html = `<h2>Fund Characteristics as of Oct 29 2026</h2><tr><th>Price/Earnings Ratio FY1</th><td class="data">19.09</td></tr><h2>Index Characteristics <span class="date">as of Oct 29 2026</span></h2><table><tr><th class="label">Price/Earnings</th><td class="data">21.02</td></tr></table><h2>Index Statistics</h2>`;
    expect(parseStateStreetDow(html)).toEqual({ date: "2026-10-29", value: 21.02 });
  });
  it("does not accept a PE from another page section", () => {
    expect(parseStateStreetDow(`<h2>Fund Characteristics</h2><tr><th>Price/Earnings</th><td>19.09</td></tr><h2>Index Characteristics as of Oct 29 2026</h2><h2>Index Statistics</h2>`)).toBeNull();
  });
});
