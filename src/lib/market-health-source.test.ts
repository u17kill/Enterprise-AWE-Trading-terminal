import { describe, expect, it, vi } from "vitest";
vi.mock("./longbridge-mcp", () => ({ callLongbridgeTool: vi.fn() }));
import { callLongbridgeTool, type getSession } from "./longbridge-mcp";
import { collectMarketHealth, parseFredCsv, parseCnnFearGreed, parseSpyOptionStats, normalizePair, optionHealthReadings } from "./market-health-source";

describe("market health source parsing", () => {
  it("rejects missing FRED rows and keeps observed dates", () => {
    expect(parseFredCsv("DATE,BAMLH0A0HYM2\n2026-10-20,3.82\n2026-10-21,.\n2026-10-22,4.05", "BAMLH0A0HYM2")).toEqual([
      { date: "2026-10-20", value: 3.82 }, { date: "2026-10-22", value: 4.05 },
    ]);
    expect(parseFredCsv("DATE,WRONG\n2026-10-20,3.82", "BAMLH0A0HYM2")).toEqual([]);
  });

  it("uses CNN's published score and timestamp, not a fabricated current date", () => {
    expect(parseCnnFearGreed({ fear_and_greed: { score: 27.4, rating: "Fear", timestamp: "2026-10-23T20:00:00Z" } })).toEqual({ score: 27.4, rating: "Fear", asOf: "2026-10-23T20:00:00Z" });
    expect(parseCnnFearGreed({ fear_and_greed: { score: 130, timestamp: "2026-10-23T20:00:00Z" } })).toBeNull();
  });

  it("reads actual SPY put and call volumes and aligns the two price series by day", () => {
    expect(parseSpyOptionStats({ stats: [{ timestamp: "2026-10-22T04:00:00Z", total_call_volume: "100", total_put_volume: "80" }, { timestamp: "2026-10-23T04:00:00Z", total_call_volume: "200", total_put_volume: "140" }] }).at(-1)).toEqual({ asOf: "2026-10-23T04:00:00Z", ratio: 0.7, calls: 200, puts: 140 });
    expect(normalizePair([{ time: "2026-10-21", close: 100 }, { time: "2026-10-22", close: 110 }], [{ time: "2026-10-22", close: 200 }, { time: "2026-10-23", close: 220 }])).toEqual({ first: [100], second: [100], asOf: "2026-10-22" });
  });
  it("does not invent a zero crowding percentile when SPY history is too short", () => {
    const values = [{ asOf: "2026-10-23T04:00:00Z", ratio: 1.2, calls: 100, puts: 120 }];
    expect(optionHealthReadings(values).crowding).toBeUndefined();
    expect(optionHealthReadings(values).putCall?.value).toBe(1.2);
  });

  it("requests only needed SPY fields so a full-year option response is not truncated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("other sources unavailable")));
    vi.mocked(callLongbridgeTool).mockImplementation(async (_session, name, args) => {
      if (name !== "option_volume_daily") throw new Error("other Longbridge source unavailable");
      if (!args._jq) throw new SyntaxError("Unexpected token 'T', '[TRUNCATED ...' is not valid JSON");
      return { stats: Array.from({ length: 60 }, (_, index) => ({
        timestamp: new Date(Date.UTC(2026, 6, 1 + index)).toISOString(),
        total_call_volume: "100",
        total_put_volume: String(index === 59 ? 130 : 80 + index),
      })) };
    });
    try {
      const result = await collectMarketHealth({} as NonNullable<ReturnType<typeof getSession>>);
      expect(result.readings.putCall?.value).toBe(1.3);
      expect(result.readings.crowding?.value).toBeGreaterThan(0);
      expect(result.errors.putCall).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
      vi.mocked(callLongbridgeTool).mockReset();
    }
  });
});
