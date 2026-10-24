import type { SampleCandle } from "./chart-data";

export type LiveQuote = { value: number; changePercent: number; timestamp: string };
export type IntradayPoint = { timestamp: string; price: number };

const SYMBOLS: Record<string, string> = {
  SPX: ".SPX.US", NDX: ".NDX.US", DJI: ".DJI.US",
  AAPL: "AAPL.US", NVDA: "NVDA.US", MSFT: "MSFT.US", TSLA: "TSLA.US",
  AMZN: "AMZN.US", GOOGL: "GOOGL.US", META: "META.US",
};

export function toLongbridgeSymbol(id: string): string | null {
  return SYMBOLS[id] ?? (/^[A-Z0-9][A-Z0-9.\-]{0,14}\.US$/.test(id) ? id : null);
}

function number(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function parseQuotes(raw: unknown, ids: string[]): Record<string, LiveQuote> {
  if (!Array.isArray(raw)) return {};
  const quotes: Record<string, LiveQuote> = {};
  for (const id of ids) {
    const symbol = toLongbridgeSymbol(id);
    const item = raw.map(record).find((entry) => entry?.symbol === symbol);
    if (!item) continue;
    const value = number(item.last_done), previous = number(item.prev_close);
    if (value === null || previous === null || previous <= 0 || typeof item.timestamp !== "string") continue;
    quotes[id] = { value, changePercent: ((value - previous) / previous) * 100, timestamp: item.timestamp };
  }
  return quotes;
}

export function parseCandles(raw: unknown): SampleCandle[] {
  if (!Array.isArray(raw)) return [];
  const output: SampleCandle[] = [];
  for (const value of raw) {
    const item = Array.isArray(value) && value.length === 6
      ? { timestamp: value[0], open: value[1], high: value[2], low: value[3], close: value[4], volume: value[5] }
      : record(value);
    if (!item || typeof item.timestamp !== "string" || !/^\d{4}-\d\d-\d\dT/.test(item.timestamp)) continue;
    const open = number(item.open), high = number(item.high), low = number(item.low), close = number(item.close), volume = number(item.volume);
    if (open === null || high === null || low === null || close === null || volume === null || low > high || open < low || open > high || close < low || close > high) continue;
    output.push({ time: item.timestamp.slice(0, 10), open, high, low, close, volume });
  }
  return output.sort((a, b) => a.time.localeCompare(b.time));
}

export function parseIntraday(raw: unknown): IntradayPoint[] {
  if (!Array.isArray(raw)) return [];
  const points = new Map<string, IntradayPoint>();
  for (const value of raw) {
    const item = record(value);
    if (!item || typeof item.timestamp !== "string" || !/^\d{4}-\d\d-\d\dT/.test(item.timestamp) || !Number.isFinite(Date.parse(item.timestamp))) continue;
    const price = number(item.price);
    if (price === null || price <= 0) continue;
    points.set(item.timestamp, { timestamp: item.timestamp, price });
  }
  return [...points.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function newYorkDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}

export function matchTrendToQuote(points: IntradayPoint[], quote: LiveQuote): IntradayPoint[] {
  const date = newYorkDate(quote.timestamp);
  return points.filter((point) => newYorkDate(point.timestamp) === date);
}
