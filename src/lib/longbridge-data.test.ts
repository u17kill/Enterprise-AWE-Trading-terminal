import { describe, expect, it } from "vitest";
import { parseCandles, parseQuotes, toLongbridgeSymbol } from "./longbridge-data";

describe("Longbridge market data", () => {
  it("maps only verified catalog symbols", () => {
    expect(toLongbridgeSymbol("SPX")).toBe(".SPX.US");
    expect(toLongbridgeSymbol("AAPL")).toBe("AAPL.US");
    expect(toLongbridgeSymbol("US10Y")).toBeNull();
  });

  it("normalizes quote values with source timestamps", () => {
    expect(parseQuotes([{ symbol: "AAPL.US", last_done: "347.725", prev_close: "348.22", timestamp: "2026-10-23T20:00:01Z" }], ["AAPL"]))
      .toEqual({ AAPL: { value: 347.725, changePercent: expect.closeTo(-0.14215, 4), timestamp: "2026-10-23T20:00:01Z" } });
  });

  it("rejects incomplete candles instead of mixing them with sample bars", () => {
    expect(parseCandles([{ timestamp: "2026-10-23T04:00:00Z", open: "10", high: "12", low: "9", close: "11", volume: "100" }]))
      .toEqual([{ time: "2026-10-23", open: 10, high: 12, low: 9, close: 11, volume: 100 }]);
    expect(parseCandles([{ timestamp: "2026-10-23T04:00:00Z", open: "10", high: "12", low: "9", close: "" }])).toEqual([]);
  });
});
