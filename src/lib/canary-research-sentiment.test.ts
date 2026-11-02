import { describe, expect, it, vi } from "vitest";
vi.mock("./longbridge-mcp", () => ({ callLongbridgeTool: vi.fn() }));
import { buildMagSeven, completedCloseQuote, completedSectorReading, completedSentimentPulses, moverObservationDate, parseChinaMarketBreadth, parseChinaSectorRanking, parseSentimentHistory, parseSectorQuotes, rankLargeCapMovers, relativeSectorStrength, sectorReturns, verifyHistoricalLimitPools } from "./canary-research-sentiment";
import { callLongbridgeTool } from "./longbridge-mcp";

describe("short-term sentiment sources", () => {
  it("keeps A-share local close date and six-session pulse", () => {
    const raw = { list: [{ timestamp: "2026-10-29T16:00:00Z", temperature: 51, sentiment: 36, valuation: 67 }] };
    expect(parseSentimentHistory(raw, "cn")).toEqual([{ date: "2026-10-30", temperature: 51, sentiment: 36, valuation: 67 }]);
  });
  it("excludes the ongoing A-share session from a close-only review", () => {
    const pulse = [{ date: "2026-10-30", temperature: 51, sentiment: 36, valuation: 67 }, { date: "2026-11-02", temperature: 79, sentiment: 91, valuation: 67 }];
    expect(completedSentimentPulses(pulse, "cn", new Date("2026-11-02T05:03:00Z"))).toEqual(pulse.slice(0, 1));
    expect(completedSentimentPulses(pulse, "cn", new Date("2026-11-02T07:01:00Z"))).toEqual(pulse);
  });
  it("only accepts sectors from the same US close date", () => {
    const raw = [{ symbol: "XLK.US", last_done: "110", prev_close: "100", timestamp: "2026-10-30T20:00:00Z" }, { symbol: "XLF.US", last_done: "90", prev_close: "100", timestamp: "2026-10-29T20:00:00Z" }];
    expect(parseSectorQuotes(raw, "2026-10-30")).toEqual([{ symbol: "XLK.US", title: "科技", changePercent: 10 }]);
  });
  it("uses the previous completed daily bar while the US market is open", () => {
    const bars = [
      { timestamp: "2026-10-29T20:00:00Z", close: "100" },
      { timestamp: "2026-10-30T20:00:00Z", close: "105" },
      { timestamp: "2026-11-02T15:00:00Z", close: "111" },
    ];
    expect(completedCloseQuote(bars, "AAPL.US", "2026-10-30")).toEqual({ symbol: "AAPL.US", last_done: "105", prev_close: "100", timestamp: "2026-10-30T20:00:00Z" });
    expect(completedCloseQuote(bars, "AAPL.US", "2026-10-29")).toBeNull();
    expect(completedCloseQuote(bars.slice(0, 1).concat(bars.slice(2)), "AAPL.US", "2026-10-30")).toBeNull();
  });
  it("builds the sector close and 5/20/60-day trend from completed bars", () => {
    const bars = Array.from({ length: 63 }, (_, index) => ({ timestamp: new Date(Date.UTC(2026, 7, index + 1, 20)).toISOString(), close: String(100 + index) }));
    const closeDate = "2026-09-30";
    const result = completedSectorReading(bars, "XLK.US", "科技", closeDate);
    expect(result).toEqual({ symbol: "XLK.US", title: "科技", changePercent: 0.63, change5: 3.23, change20: 14.29, change60: 60 });
    expect(completedSectorReading(bars.slice(0, -3), "XLK.US", "科技", closeDate)).toBeNull();
  });
  it("keeps an A-share sector observation separate when it is newer than the close review", () => {
    const raw = { items: [{ lists: [{ symbol: "IN001.CN", name: "半导体", chg: "0.025", last: Date.parse("2026-11-02T04:00:00Z") / 1000 }] }] };
    expect(parseChinaSectorRanking(raw)).toEqual({ asOf: "2026-11-02", sectors: [{ symbol: "IN001.CN", title: "半导体", changePercent: 2.5 }] });
  });
  it("computes 5/20/60-session returns from the same completed close", () => {
    const bars = Array.from({ length: 61 }, (_, index) => ({ date: new Date(Date.UTC(2026, 7, index + 1)).toISOString().slice(0, 10), close: 100 + index }));
    expect(sectorReturns(bars, bars.at(-1)!.date)).toEqual({ change5: 3.23, change20: 14.29, change60: 60 });
    expect(sectorReturns(bars, "2026-10-30")).toBeNull();
  });
  it("measures semiconductor strength against SPY on aligned sessions only", () => {
    const dates = Array.from({ length: 61 }, (_, index) => new Date(Date.UTC(2026, 7, index + 1)).toISOString().slice(0, 10));
    const soxx = dates.map((date, index) => ({ date, close: 100 + index }));
    const spy = dates.map((date) => ({ date, close: 100 }));
    expect(relativeSectorStrength(soxx, spy, dates.at(-1)!)).toEqual({ change20: 14.29, change60: 60 });
    expect(relativeSectorStrength(soxx, spy.slice(1), dates.at(-1)!)).toBeNull();
  });
  it("accepts historical limit pools only after independent close-price checks when qdate is current", async () => {
    const up = { rc: 0, data: { tc: 47, qdate: 20261102, pool: [{ c: "603703", m: 1, p: 11950 }] } };
    const down = { rc: 0, data: { tc: 82, qdate: 20261102, pool: [{ c: "600556", m: 1, p: 4170 }] } };
    vi.mocked(callLongbridgeTool).mockResolvedValueOnce([{ timestamp: "2026-10-29T16:00:00Z", close: "11.95" }]).mockResolvedValueOnce([{ timestamp: "2026-10-29T16:00:00Z", close: "4.17" }]);
    expect(await verifyHistoricalLimitPools({} as Parameters<typeof verifyHistoricalLimitPools>[0], up, down, "2026-10-30")).toEqual({ date: "2026-10-30", up: 47, down: 82 });
    expect(vi.mocked(callLongbridgeTool)).toHaveBeenCalledTimes(2);
    vi.mocked(callLongbridgeTool).mockReset().mockResolvedValueOnce([{ timestamp: "2026-11-01T16:00:00Z", close: "11.95" }]).mockResolvedValueOnce([{ timestamp: "2026-10-29T16:00:00Z", close: "4.17" }]);
    await expect(verifyHistoricalLimitPools({} as Parameters<typeof verifyHistoricalLimitPools>[0], up, down, "2026-10-30")).rejects.toThrow("历史收盘价");
  });
  it("weights the seven technology leaders by prior-close market value without double-counting Alphabet", () => {
    const symbols = ["AAPL.US", "MSFT.US", "GOOGL.US", "AMZN.US", "META.US", "NVDA.US", "TSLA.US"];
    const quotes = symbols.map((symbol, index) => ({ symbol, prev_close: "100", last_done: index === 0 ? "110" : "100", timestamp: "2026-10-30T20:00:00Z" }));
    const infos = symbols.map((symbol) => ({ symbol, total_shares: "100" }));
    const result = buildMagSeven(quotes, infos, "2026-10-30");
    expect(result?.members).toHaveLength(7);
    expect(result?.weightedChangePercent).toBe(1.43);
    expect(buildMagSeven(quotes.slice(1), infos, "2026-10-30")).toBeNull();
    expect(buildMagSeven(quotes, infos, "2026-10-29")).toBeNull();
  });
  it("shows only same-close verified US large-cap movers and labels the sample", () => {
    const row = (symbol: string, cap: number) => ({ symbol, name: symbol, indicators: [{ key: "marketcap", value: String(cap) }] });
    const winners = { total: 1200, items: [row("AAA.US", 20_000_000_000), row("SMALL.US", 9_000_000_000), row("STALE.US", 20_000_000_000)] };
    const losers = { total: 1200, items: [row("BBB.US", 30_000_000_000)] };
    const quote = (symbol: string, last: number, prior: number, timestamp = "2026-10-30T20:00:00Z") => ({ symbol, last_done: String(last), prev_close: String(prior), timestamp });
    const result = rankLargeCapMovers(winners, losers, [quote("AAA.US", 110, 100), quote("SMALL.US", 130, 100), quote("STALE.US", 120, 100, "2026-10-29T20:00:00Z"), quote("BBB.US", 90, 100)], "2026-10-30");
    expect(result?.universe).toBe(1200);
    expect(result?.gainers).toEqual([{ symbol: "AAA.US", name: "AAA.US", changePercent: 10, marketCap: 20_000_000_000 }]);
    expect(result?.losers).toEqual([{ symbol: "BBB.US", name: "BBB.US", changePercent: -10, marketCap: 30_000_000_000 }]);
    expect(rankLargeCapMovers(winners, losers, [quote("AAA.US", 110, 100), quote("BBB.US", 90, 100, "2026-10-29T20:00:00Z")], "2026-10-30")).toBeNull();
  });
  it("labels same-day mover quotes as intraday without changing the completed-close review", () => {
    const quotes = [
      { timestamp: "2026-11-02T15:00:00Z" }, { timestamp: "2026-11-02T15:01:00Z" },
      { timestamp: "2026-10-30T20:00:00Z" },
    ];
    expect(moverObservationDate(quotes, "2026-10-30", new Date("2026-11-02T15:05:00Z"))).toEqual({ date: "2026-11-02", layer: "intraday" });
    expect(moverObservationDate(quotes.slice(2), "2026-10-30", new Date("2026-11-02T15:05:00Z"))).toEqual({ date: "2026-10-30", layer: "close" });
    expect(moverObservationDate([{ timestamp: "2026-11-03T15:00:00Z" }], "2026-10-30", new Date("2026-11-02T15:05:00Z"))).toBeNull();
  });
  it("accepts A-share advances and declines only when the source date and totals match the close", () => {
    const html = `<span class="market-activity-time">2026-11-02 15:00:00</span><div id="total" data-chart="5223"></div><div id="totalUp" data-chart="4382"></div><div id="totalDown" data-chart="767"></div><div id="priceStop" data-chart="68"></div><div id="pricePaused" data-chart="6"></div>`;
    expect(parseChinaMarketBreadth(html, "2026-11-02")).toEqual({ date: "2026-11-02", up: 4382, down: 767, flat: 68, suspended: 6, total: 5223 });
    expect(parseChinaMarketBreadth(html, "2026-10-30")).toBeNull();
    expect(parseChinaMarketBreadth(html.replace('data-chart="5223"', 'data-chart="5224"'), "2026-11-02")).toBeNull();
  });
});
