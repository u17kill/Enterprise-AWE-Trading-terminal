import { describe, expect, it } from "vitest";
import { atr, bollinger, macd, rsi } from "./indicators";
import type { SampleCandle } from "./chart-data";

const candles = (closes: number[]): SampleCandle[] => closes.map((close, index) => ({
  time: `2026-01-${String(index + 1).padStart(2, "0")}`,
  open: close, high: close, low: close, close, volume: 1,
}));

describe("technical indicators", () => {
  it("keeps MACD warm-up empty until EMA26 and signal9 are available", () => {
    const values = macd(candles(Array.from({ length: 40 }, (_, index) => index + 1)));
    expect(values).toHaveLength(15);
    expect(values[0].macd).toBeCloseTo(7, 6);
    expect(values[0].signal).toBeNull();
    expect(values[8].signal).toBeCloseTo(7, 6);
    expect(values[8].histogram).toBeCloseTo(0, 6);
  });

  it("uses Wilder smoothing for RSI14 and handles uninterrupted gains and flat prices", () => {
    expect(rsi(candles(Array.from({ length: 14 }, (_, index) => index + 1)))).toEqual([]);
    const rising = rsi(candles(Array.from({ length: 20 }, (_, index) => index + 1)));
    expect(rising[0].value).toBe(100);
    expect(rising).toHaveLength(6);
    expect(rsi(candles(Array(20).fill(10)))[0].value).toBe(50);
  });

  it("calculates 20-period Bollinger bands from displayed closing prices", () => {
    const result = bollinger(candles(Array(20).fill(10)));
    expect(result).toEqual([{ time: "2026-01-20", middle: 10, upper: 10, lower: 10 }]);
  });

  it("calculates 14-period true-range volatility", () => {
    const result = atr(candles(Array.from({ length: 20 }, (_, index) => index + 1)));
    expect(result[0]).toEqual({ time: "2026-01-15", value: 1 });
    expect(result).toHaveLength(6);
  });
});
