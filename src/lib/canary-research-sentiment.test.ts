import { describe, expect, it, vi } from "vitest";
vi.mock("./longbridge-mcp", () => ({ callLongbridgeTool: vi.fn() }));
import { parseChinaSectorRanking, parseSentimentHistory, parseSectorQuotes, sectorReturns } from "./canary-research-sentiment";

describe("short-term sentiment sources", () => {
  it("keeps A-share local close date and six-session pulse", () => {
    const raw = { list: [{ timestamp: "2026-10-29T16:00:00Z", temperature: 51, sentiment: 36, valuation: 67 }] };
    expect(parseSentimentHistory(raw, "cn")).toEqual([{ date: "2026-10-30", temperature: 51, sentiment: 36, valuation: 67 }]);
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
});
