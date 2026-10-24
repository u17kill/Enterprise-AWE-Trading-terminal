import type { SampleCandle } from "./chart-data";
import type { IntradayPoint, LiveQuote } from "./longbridge-data";

function record(raw: unknown): Record<string, unknown> { return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {}; }
function positive(raw: unknown): number | null {
  if (raw === "" || raw === null || raw === undefined) return null;
  const value = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseGoldQuote(raw: unknown): LiveQuote | null {
  const item = record(raw), value = positive(item.price);
  if (item.symbol !== "XAU" || item.currency !== "USD" || value === null || typeof item.updatedAt !== "string" || !Number.isFinite(Date.parse(item.updatedAt))) return null;
  return { value, changePercent: 0, changeAvailable: false, timestamp: item.updatedAt, source: "Gold API · 现货参考价" };
}

export function parseCoinbaseQuote(ticker: unknown, stats: unknown): LiveQuote | null {
  const item = record(ticker), detail = record(stats);
  const value = positive(item.price), open = positive(detail.open);
  if (value === null || open === null || typeof item.time !== "string" || !Number.isFinite(Date.parse(item.time))) return null;
  return { value, changePercent: (value - open) / open * 100, timestamp: item.time, source: "Coinbase Exchange · BTC-USD" };
}

export function parseCoinbaseCandles(raw: unknown): SampleCandle[] {
  if (!Array.isArray(raw)) return [];
  const values = new Map<string, SampleCandle>();
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const [timestamp, low, high, open, close, volume] = row.map(Number);
    if (![timestamp, low, high, open, close, volume].every(Number.isFinite) || timestamp <= 0 || low <= 0 || low > high || open < low || open > high || close < low || close > high || volume < 0) continue;
    const time = new Date(timestamp * 1000).toISOString().slice(0, 10);
    values.set(time, { time, open, high, low, close, volume });
  }
  return [...values.values()].sort((a, b) => a.time.localeCompare(b.time));
}

async function json(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Market source returned ${response.status}`);
  return response.json();
}

export async function fetchGoldSpot(): Promise<LiveQuote> {
  const quote = parseGoldQuote(await json("https://api.gold-api.com/price/XAU"));
  if (!quote) throw new Error("Gold API returned invalid spot quote");
  return quote;
}

export async function fetchBitcoin(chart = false): Promise<{ quote: LiveQuote; trend: IntradayPoint[]; candles: SampleCandle[] }> {
  const root = "https://api.exchange.coinbase.com/products/BTC-USD";
  const [ticker, stats, hourly, daily] = await Promise.all([
    json(`${root}/ticker`), json(`${root}/stats`), json(`${root}/candles?granularity=3600`),
    chart ? json(`${root}/candles?granularity=86400`) : Promise.resolve([]),
  ]);
  const quote = parseCoinbaseQuote(ticker, stats);
  if (!quote) throw new Error("Coinbase returned invalid BTC quote");
  const trend = Array.isArray(hourly) ? hourly.filter((row): row is unknown[] => Array.isArray(row) && row.length >= 5)
    .map((row) => ({ timestamp: new Date(Number(row[0]) * 1000).toISOString(), price: Number(row[4]) }))
    .filter((item) => Number.isFinite(item.price) && item.price > 0)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-24) : [];
  return { quote, trend, candles: parseCoinbaseCandles(daily) };
}
