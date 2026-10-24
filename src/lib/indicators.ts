import type { SampleCandle } from "./chart-data";

export type DatedValue = { time: string; value: number };
export type MacdValue = { time: string; macd: number; signal: number | null; histogram: number | null };

function ema(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = Array(values.length).fill(null);
  if (values.length < period) return result;
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = current;
  const factor = 2 / (period + 1);
  for (let index = period; index < values.length; index++) {
    current = (values[index] - current) * factor + current;
    result[index] = current;
  }
  return result;
}

export function macd(candles: SampleCandle[]): MacdValue[] {
  const closes = candles.map((candle) => candle.close);
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macdValues = closes.map((_, index) => fast[index] === null || slow[index] === null ? null : fast[index]! - slow[index]!);
  const signalValues = ema(macdValues.slice(25).filter((value): value is number => value !== null), 9);
  return macdValues.flatMap((value, index) => {
    if (value === null) return [];
    const signal = signalValues[index - 25] ?? null;
    return [{ time: candles[index].time, macd: value, signal, histogram: signal === null ? null : value - signal }];
  });
}

export function rsi(candles: SampleCandle[], period = 14): DatedValue[] {
  if (candles.length <= period || !Number.isInteger(period) || period < 2) return [];
  let gain = 0, loss = 0;
  for (let index = 1; index <= period; index++) {
    const change = candles[index].close - candles[index - 1].close;
    gain += Math.max(0, change);
    loss += Math.max(0, -change);
  }
  gain /= period; loss /= period;
  const value = () => gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  const result: DatedValue[] = [{ time: candles[period].time, value: value() }];
  for (let index = period + 1; index < candles.length; index++) {
    const change = candles[index].close - candles[index - 1].close;
    gain = (gain * (period - 1) + Math.max(0, change)) / period;
    loss = (loss * (period - 1) + Math.max(0, -change)) / period;
    result.push({ time: candles[index].time, value: value() });
  }
  return result;
}
