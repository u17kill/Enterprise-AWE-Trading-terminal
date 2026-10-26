import { describe, expect, it } from "vitest";
import { classifyVix, classifyOas, classifyPercentile, percentileRank, mergeHealthSnapshot, type HealthSnapshot } from "./market-health";

describe("market health scoring", () => {
  it("uses the weekly report's VIX and credit boundaries", () => {
    expect([19.99, 20, 30, 30.01].map(classifyVix)).toEqual(["green", "amber", "amber", "red"]);
    expect([3.99, 4, 5, 5.01].map((x) => classifyOas(x, null))).toEqual(["green", "amber", "amber", "red"]);
    expect(classifyOas(3.8, 4.85)).toBe("green");
    expect(classifyOas(5.2, 4.1)).toBe("red");
    expect(classifyOas(3.8, 2.7)).toBe("red");
  });

  it("scores both tails of an observed percentile without inventing missing observations", () => {
    expect(percentileRank(2, [1, 2, 3, 4])).toBe(50);
    expect(percentileRank(2, [])).toBeNull();
    expect(classifyPercentile(4)).toBe("red");
    expect(classifyPercentile(15)).toBe("amber");
    expect(classifyPercentile(50)).toBe("green");
    expect(classifyPercentile(85)).toBe("amber");
    expect(classifyPercentile(96)).toBe("red");
  });

  it("keeps a last good card when one source fails, with an explicit stale flag", () => {
    const prior: HealthSnapshot = { refreshedAt: "2026-10-23T12:00:00Z", readings: { volatility: { value: 19.5, unit: "", asOf: "2026-10-23T12:00:00Z", source: "Longbridge", sourceUrl: "https://longbridge.com", state: "green", summary: "VIX 温和" } }, errors: {} };
    const next = mergeHealthSnapshot(prior, { refreshedAt: "2026-10-26T12:00:00Z", readings: {}, errors: { volatility: "VIX 请求失败" } });
    expect(next.readings.volatility?.value).toBe(19.5);
    expect(next.readings.volatility?.stale).toBe(true);
    expect(next.readings.volatility?.asOf).toBe("2026-10-23T12:00:00Z");
    expect(next.errors.volatility).toBe("VIX 请求失败");
  });
});
