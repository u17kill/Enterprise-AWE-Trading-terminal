import { describe, expect, it } from "vitest";
import { parseBullionGold, parseCoinbaseCandles, parseCoinbaseQuote, parseGoldQuote, parseInternationalHistory, parseInternationalQuotes } from "./external-market";

describe("external market adapters", () => {
  it("draws Nikkei and KOSPI from actual daily index closes and ends at the published current level", () => {
    const quotes = { N225: { value: 62189.65, changePercent: -0.8, timestamp: "2026-10-26T15:37:39Z", marketDate: "2026-10-26", source: "DeanFi · Nikkei 225" }, KOSPI: { value: 5469.47, changePercent: -1.46, timestamp: "2026-10-26T15:37:39Z", marketDate: "2026-10-26", source: "DeanFi · KOSPI" } };
    const history = parseInternationalHistory({ metadata: { generated_at: "2026-10-26T15:37:45Z" }, indices: {
      "^N225": { symbol: "^N225", data: [{ date: "2026-10-22", close: 62900 }, { date: "2026-10-23", close: 62693.16 }] },
      "^KS11": { symbol: "^KS11", data: [{ date: "2026-10-22", close: 5600 }, { date: "2026-10-23", close: 5550 }, { date: "2026-10-26", close: null }] },
    } }, quotes, new Date("2026-10-26T16:00:00Z"));
    expect(history.N225?.map((point) => point.price)).toEqual([62900, 62693.16, 62189.65]);
    expect(history.KOSPI?.map((point) => point.price)).toEqual([5600, 5550, 5469.47]);
    expect(history.N225?.at(-1)?.timestamp).toBe("2026-10-26T12:00:00Z");
  });
  it("uses one gold provider for both visible price and 24-hour trend", () => {
    const market = parseBullionGold(
      { updated: "2026-10-26T15:55:45Z", metals: [{ symbol: "XAU", ask: 4020.13, bid: 4013.7, open: 3997.68 }] },
      { source: "Standard Bullion", metal: "XAU", unit: "USD per troy ounce", points: [{ t: "2026-10-26T14:45:00Z", price: 4018 }, { t: "2026-10-26T15:45:00Z", price: 4020.44 }] },
      new Date("2026-10-26T16:00:00Z"),
    );
    expect(market?.quote).toMatchObject({ value: 4020.13, changePercent: expect.closeTo(0.561577, 4), source: "Data by Standard Bullion · XAU 卖出价" });
    expect(market?.trend.map((point) => point.price)).toEqual([4018, 4020.44, 4020.13]);
  });
  it("reads actual Nikkei and KOSPI index levels, not ETF proxies", () => {
    const quotes = parseInternationalQuotes({ metadata: { market_date: "2026-10-26", generated_at: "2026-10-26T15:37:39Z" }, indices: {
      "^N225": { symbol: "^N225", country: "Japan", currency: "JPY", current_price: 62189.65, daily_change_percent: -0.8 },
      "^KS11": { symbol: "^KS11", country: "South Korea", currency: "KRW", current_price: 5469.47, daily_change_percent: -1.46 },
    } }, new Date("2026-10-26T16:00:00Z"));
    expect(quotes.N225).toMatchObject({ value: 62189.65, changePercent: -0.8, source: "DeanFi · Nikkei 225" });
    expect(quotes.KOSPI).toMatchObject({ value: 5469.47, changePercent: -1.46, source: "DeanFi · KOSPI" });
    expect(quotes.N225?.timestamp).toBe("2026-10-26T15:37:39Z");
  });
  it("rejects stale and mislabeled international index snapshots", () => {
    const snapshot = { metadata: { market_date: "2026-10-20", generated_at: "2026-10-20T15:37:39Z" }, indices: { "^N225": { symbol: "^N225", country: "Japan", currency: "JPY", current_price: 62189.65, daily_change_percent: -0.8 } } };
    expect(parseInternationalQuotes(snapshot, new Date("2026-10-26T16:00:00Z"))).toEqual({});
    expect(parseInternationalQuotes({ ...snapshot, metadata: { market_date: "2026-10-26", generated_at: "2026-10-26T15:37:39Z" }, indices: { "^N225": { ...snapshot.indices["^N225"], symbol: "^KS11" } } }, new Date("2026-10-26T16:00:00Z"))).toEqual({});
  });
  it("keeps gold spot source and timestamp but no invented price change", () => {
    expect(parseGoldQuote({ symbol: "XAU", currency: "USD", price: 4012.5, updatedAt: "2026-10-23T20:00:00Z" })).toEqual({ value: 4012.5, changePercent: 0, changeAvailable: false, timestamp: "2026-10-23T20:00:00Z", source: "Gold API · 现货参考价" });
  });
  it("parses Coinbase BTC/USD venue quote and historical candles", () => {
    expect(parseCoinbaseQuote({ price: "100000", time: "2026-10-23T20:00:00Z" }, { open: "98000" })).toMatchObject({ value: 100000, changePercent: expect.closeTo(2.040816, 5), source: "Coinbase Exchange · BTC-USD" });
    expect(parseCoinbaseCandles([[1792800000, 98000, 101000, 99000, 100000, 25]])[0]).toMatchObject({ open: 99000, high: 101000, low: 98000, close: 100000, volume: 25 });
  });
});
