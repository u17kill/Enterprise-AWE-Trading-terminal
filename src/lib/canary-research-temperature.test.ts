import { describe, expect, it } from "vitest";
import { calculateTemperature, type TemperatureBar } from "./canary-research-temperature";

function bars(count: number, mult = 1): TemperatureBar[] {
  return Array.from({ length: count }, (_, i) => ({ date: new Date(Date.UTC(2022, 0, 1 + i)).toISOString().slice(0, 10), close: mult * (100 + i * .08 + Math.sin(i / 9) * 2), volume: 1000 + i * 3, turnover: 100000 + i * 300 }));
}

describe("canary temperature calculation", () => {
  it("refuses a composite score before 294 aligned daily bars", () => {
    expect(calculateTemperature(bars(293), bars(293)).score).toBeNull();
  });
  it("returns finite components and a dated history from complete observations", () => {
    const result = calculateTemperature(bars(600), bars(600, 4));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.position).not.toBeNull();
    expect(result.crowding).not.toBeNull();
    expect(result.momentum).not.toBeNull();
    expect(result.history.length).toBeGreaterThan(200);
    expect(result.history.at(-1)?.date).toBe(bars(600).at(-1)?.date);
  });
  it("rejects a missing or zero denominator instead of emitting an invalid crowding score", () => {
    const result = calculateTemperature(bars(600), bars(600).map((bar) => ({ ...bar, turnover: 0 })));
    expect(result.score).toBeNull();
  });
  it("does not date an old score as the latest day when the last factors cannot be calculated", () => {
    const source = bars(600);
    const flat = source.map((bar, index) => index >= 570 ? { ...bar, close: source[569].close } : bar);
    const result = calculateTemperature(flat, bars(600, 4));
    expect(result.history.at(-1)?.date).not.toBe(flat.at(-1)?.date);
    expect(result.score).toBeNull();
  });
});
