import { describe, expect, it, vi } from "vitest";
vi.mock("./longbridge-mcp", () => ({ callLongbridgeTool: vi.fn() }));
import { parseFredCsv, parseCnnFearGreed, parseSpyOptionStats, normalizePair } from "./market-health-source";

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
});
