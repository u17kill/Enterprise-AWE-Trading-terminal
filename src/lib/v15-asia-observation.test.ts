import { describe, expect, it } from "vitest";
import { buildAsiaObservation } from "./v15-asia-observation";

const bar = (date: string, close: string) => ({ timestamp: `${date}T04:00:00Z`, close });

describe("V1.5 Asia ETF proxy observation", () => {
  it("uses distinct trading dates and the exact earlier close for each return window", () => {
    const bars = Array.from({ length: 65 }, (_, index) => bar(new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10), String(100 + index)));
    const result = buildAsiaObservation("EWS.US", [...bars].reverse());
    expect(result).toMatchObject({ market: "新加坡", kind: "us_etf_proxy", currency: "USD", close: 164, asOf: "2026-10-04", barCount: 65 });
    expect(result.change1d).toBeCloseTo(100 * (164 / 163 - 1));
    expect(result.change5d).toBeCloseTo(100 * (164 / 159 - 1));
    expect(result.change20d).toBeCloseTo(100 * (164 / 144 - 1));
    expect(result.change60d).toBeCloseTo(100 * (164 / 104 - 1));
  });

  it("does not count duplicate dates or invalid prices as history", () => {
    const result = buildAsiaObservation("INDA.US", [bar("2026-10-26", "100"), bar("2026-10-27", "0"), bar("2026-10-28", "110"), bar("2026-10-28", "110")]);
    expect(result).toMatchObject({ market: "印度", barCount: 2, close: 110, change5d: null, change20d: null, change60d: null });
    expect(result.change1d).toBeCloseTo(10);
  });

  it("rejects a response with no usable closing price", () => {
    expect(() => buildAsiaObservation("EWS.US", [bar("2026-10-28", "-1")])).toThrow(/收盘价/);
  });
});
