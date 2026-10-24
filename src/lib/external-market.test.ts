import { describe, expect, it } from "vitest";
import { parseCoinbaseCandles, parseCoinbaseQuote, parseGoldQuote } from "./external-market";

describe("external market adapters", () => {
  it("keeps gold spot source and timestamp but no invented price change", () => {
    expect(parseGoldQuote({ symbol: "XAU", currency: "USD", price: 4012.5, updatedAt: "2026-10-23T20:00:00Z" })).toEqual({ value: 4012.5, changePercent: 0, changeAvailable: false, timestamp: "2026-10-23T20:00:00Z", source: "Gold API · 现货参考价" });
  });
  it("parses Coinbase BTC/USD venue quote and historical candles", () => {
    expect(parseCoinbaseQuote({ price: "100000", time: "2026-10-23T20:00:00Z" }, { open: "98000" })).toMatchObject({ value: 100000, changePercent: expect.closeTo(2.040816, 5), source: "Coinbase Exchange · BTC-USD" });
    expect(parseCoinbaseCandles([[1792800000, 98000, 101000, 99000, 100000, 25]])[0]).toMatchObject({ open: 99000, high: 101000, low: 98000, close: 100000, volume: 25 });
  });
});
