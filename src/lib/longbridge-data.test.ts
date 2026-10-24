import { describe, expect, it } from "vitest";
import { matchTrendToQuote, parseCandles, parseIntraday, parseQuotes, toLongbridgeSymbol } from "./longbridge-data";

describe("Longbridge market data", () => {
  it("maps only verified catalog symbols", () => {
    expect(toLongbridgeSymbol("SPX")).toBe(".SPX.US");
    expect(toLongbridgeSymbol("AAPL")).toBe("AAPL.US");
    expect(toLongbridgeSymbol("US10Y")).toBeNull();
    expect(toLongbridgeSymbol("ADBE.US")).toBe("ADBE.US");
  });

  it("normalizes quote values with source timestamps", () => {
    expect(parseQuotes([{ symbol: "AAPL.US", last_done: "347.725", prev_close: "348.22", timestamp: "2026-10-23T20:00:01Z" }], ["AAPL"]))
      .toEqual({ AAPL: { value: 347.725, changePercent: expect.closeTo(-0.14215, 4), timestamp: "2026-10-23T20:00:01Z" } });
  });

  it("rejects incomplete candles instead of mixing them with sample bars", () => {
    expect(parseCandles([{ timestamp: "2026-10-23T04:00:00Z", open: "10", high: "12", low: "9", close: "11", volume: "100" }]))
      .toEqual([{ time: "2026-10-23", open: 10, high: 12, low: 9, close: 11, volume: 100 }]);
    expect(parseCandles([{ timestamp: "2026-10-23T04:00:00Z", open: "10", high: "12", low: "9", close: "" }])).toEqual([]);
    expect(parseCandles([["2026-10-23T04:00:00Z", "10", "12", "9", "11", "100"]]))
      .toEqual([{ time: "2026-10-23", open: 10, high: 12, low: 9, close: 11, volume: 100 }]);
  });

  it("keeps valid intraday prices in timestamp order", () => {
    expect(parseIntraday([
      { timestamp: "2026-10-23T13:31:00Z", price: "350.8" },
      { timestamp: "2026-10-23T13:30:00Z", price: "350.75" },
      { timestamp: "2026-10-23T13:31:00Z", price: "350.8" },
      { timestamp: "2026-10-23T13:32:00Z", price: "" },
      { timestamp: "bad", price: "350" },
    ])).toEqual([
      { timestamp: "2026-10-23T13:30:00Z", price: 350.75 },
      { timestamp: "2026-10-23T13:31:00Z", price: 350.8 },
    ]);
  });

  it("does not pair a quote with another trading day's trend", () => {
    const quote = { value: 347.725, changePercent: -0.14, timestamp: "2026-10-23T20:00:01Z" };
    const trend = [
      { timestamp: "2026-10-22T19:59:00Z", price: 348.22 },
      { timestamp: "2026-10-23T13:30:00Z", price: 350.75 },
      { timestamp: "2026-10-23T19:59:00Z", price: 347.725 },
    ];
    expect(matchTrendToQuote(trend, quote)).toEqual(trend.slice(1));
    expect(matchTrendToQuote(trend.slice(0, 1), quote)).toEqual([]);
  });
});
