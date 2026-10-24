import type { MarketSymbol } from "./catalog";

export type Interval = "1D" | "1W" | "1M";
export type SampleCandle = { time: string; open: number; high: number; low: number; close: number; volume: number };

const round = (value: number) => Math.round(value * 1000) / 1000;

export function generateSampleCandles(symbol: MarketSymbol): SampleCandle[] {
  const target = Number(symbol.sampleValue.replaceAll(",", ""));
  const scale = symbol.id === "US10Y" ? 0.002 : 0.012;
  const candles: SampleCandle[] = [];
  let close = target * (symbol.sampleChange.startsWith("-") ? 1.05 : 0.88);
  let day = new Date(Date.UTC(2025, 10, 17));
  let seed = Array.from(symbol.id).reduce((sum, char) => sum * 31 + char.charCodeAt(0), 17) >>> 0;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  while (candles.length < 240) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) {
      const index = candles.length;
      const open = close * (1 + (random() - 0.5) * scale * 0.35);
      const trend = (symbol.trend[Math.floor(index / 20) % symbol.trend.length] - 35) / 4000;
      close = Math.max(target * 0.4, open * (1 + (random() - 0.49) * scale * 2 + trend));
      const high = Math.max(open, close) * (1 + random() * scale * 0.7);
      const low = Math.min(open, close) * (1 - random() * scale * 0.7);
      candles.push({ time: day.toISOString().slice(0, 10), open: round(open), high: round(high), low: round(low), close: round(close), volume: Math.floor(700000 + random() * 1600000) });
    }
    day = new Date(day.getTime() + 86400000);
  }
  const factor = target / candles.at(-1)!.close;
  return candles.map((candle) => ({
    ...candle,
    open: round(candle.open * factor),
    high: round(candle.high * factor),
    low: round(candle.low * factor),
    close: round(candle.close * factor),
  }));
}

export function aggregateCandles(candles: SampleCandle[], interval: Interval): SampleCandle[] {
  if (interval === "1D") return candles;
  const groups = new Map<string, SampleCandle>();
  for (const candle of candles) {
    const date = new Date(`${candle.time}T00:00:00Z`);
    let key: string;
    if (interval === "1M") key = candle.time.slice(0, 7);
    else {
      const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000);
      key = monday.toISOString().slice(0, 10);
    }
    const existing = groups.get(key);
    if (existing) {
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
      existing.volume += candle.volume;
    } else groups.set(key, { ...candle });
  }
  return Array.from(groups.values());
}

export function movingAverage(candles: SampleCandle[], period: number): { time: string; value: number }[] {
  if (!Number.isInteger(period) || period < 2) return [];
  const result: { time: string; value: number }[] = [];
  let sum = 0;
  candles.forEach((candle, index) => {
    sum += candle.close;
    if (index >= period) sum -= candles[index - period].close;
    if (index >= period - 1) result.push({ time: candle.time, value: round(sum / period) });
  });
  return result;
}
