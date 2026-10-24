import { describe, expect, it } from "vitest";
import { findSymbol } from "./catalog";
import { aggregateCandles, generateSampleCandles, movingAverage } from "./chart-data";

const symbol = findSymbol("SPX")!;

describe("sample chart data", () => {
  it("creates repeatable, ordered OHLC candles with valid ranges", () => {
    const candles = generateSampleCandles(symbol);
    expect(candles).toEqual(generateSampleCandles(symbol));
    expect(candles).toHaveLength(240);
    expect(candles[0].time < candles.at(-1)!.time).toBe(true);
    for (const candle of candles) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
      expect(candle.volume).toBeGreaterThan(0);
    }
  });

  it("aggregates into weeks without losing the first open or final close", () => {
    const daily = generateSampleCandles(symbol);
    const weekly = aggregateCandles(daily, "1W");
    expect(weekly.length).toBeLessThan(daily.length);
    expect(weekly[0].open).toBe(daily[0].open);
    expect(weekly.at(-1)!.close).toBe(daily.at(-1)!.close);
    expect(weekly.reduce((sum, candle) => sum + candle.volume, 0)).toBe(daily.reduce((sum, candle) => sum + candle.volume, 0));
  });

  it("starts a moving average only when the full window is available", () => {
    const candles = generateSampleCandles(symbol);
    const average = movingAverage(candles, 20);
    expect(average).toHaveLength(candles.length - 19);
    expect(average[0].value).toBeCloseTo(candles.slice(0, 20).reduce((sum, candle) => sum + candle.close, 0) / 20);
  });
});
