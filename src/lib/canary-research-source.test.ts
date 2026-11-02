import { describe, expect, it, vi } from "vitest";
vi.mock("./longbridge-mcp", () => ({ callLongbridgeTool: vi.fn() }));
import { callLongbridgeTool } from "./longbridge-mcp";
import { completedTemperatureBars, loadPagedTemperatureBars, parseTemperatureBars } from "./canary-research-source";

describe("research source normalization", () => {
  it("uses the local market date, not the UTC day, for A-share candles", () => {
    const bars = parseTemperatureBars([{ timestamp: "2026-10-25T16:00:00Z", close: "4103.54", volume: "192147155", turnover: "456246629217.7" }], "cn");
    expect(bars[0].date).toBe("2026-10-26");
  });
  it("rejects malformed and duplicate candles", () => {
    const raw = [{ timestamp: "2026-10-26T04:00:00Z", close: "765", volume: "123", turnover: "500" }, { timestamp: "2026-10-26T04:00:00Z", close: "765", volume: "123", turnover: "500" }, { timestamp: "bad", close: "3", volume: "1", turnover: "2" }];
    expect(parseTemperatureBars(raw, "us")).toHaveLength(1);
  });
  it("rejects two different candles carrying the same market date", () => {
    const raw = [{ timestamp: "2026-10-26T04:00:00Z", close: "765", volume: "123", turnover: "500" }, { timestamp: "2026-10-26T05:00:00Z", close: "766", volume: "123", turnover: "500" }];
    expect(parseTemperatureBars(raw, "us")).toEqual([]);
  });
  it("excludes an unfinished A-share daily bar but keeps the previous close", () => {
    const rows = [{ date: "2026-10-30", close: 1, volume: 1, turnover: 1 }, { date: "2026-11-02", close: 2, volume: 2, turnover: 2 }];
    expect(completedTemperatureBars(rows, "cn", new Date("2026-11-02T04:45:00Z"))).toEqual(rows.slice(0, 1));
    expect(completedTemperatureBars(rows, "cn", new Date("2026-11-02T07:30:00Z"))).toEqual(rows);
  });
  it("pages historical bars below the Longbridge response-size limit", async () => {
    const rows = Array.from({ length: 750 }, (_, index) => ({ timestamp: new Date(Date.UTC(2024, 0, index + 1, 4)).toISOString(), close: String(100 + index), volume: "1000", turnover: "100000" }));
    const pages = [rows.slice(500), rows.slice(250, 500), rows.slice(0, 250)];
    vi.mocked(callLongbridgeTool).mockImplementation(async () => pages.shift() ?? []);
    const result = await loadPagedTemperatureBars({} as Parameters<typeof loadPagedTemperatureBars>[0], "SPY.US", "us", false, new Date("2026-11-02T05:00:00Z"));
    expect(result.length).toBeGreaterThanOrEqual(700);
    expect(vi.mocked(callLongbridgeTool)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(callLongbridgeTool).mock.calls[0][1]).toBe("history_candlesticks_by_offset");
    expect(vi.mocked(callLongbridgeTool).mock.calls[0][2]).toMatchObject({ count: 250, forward_adjust: false });
    expect(vi.mocked(callLongbridgeTool).mock.calls[1][2]).toHaveProperty("time");
  });
});
