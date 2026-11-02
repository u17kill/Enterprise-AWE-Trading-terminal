import { describe, expect, it, vi } from "vitest";
vi.mock("./longbridge-mcp", () => ({ callLongbridgeTool: vi.fn() }));
import { buildMagSeven, completedSentimentPulses, parseChinaSectorRanking, parseSentimentHistory, parseSectorQuotes, relativeSectorStrength, sectorReturns, verifyHistoricalLimitPools } from "./canary-research-sentiment";
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
});
