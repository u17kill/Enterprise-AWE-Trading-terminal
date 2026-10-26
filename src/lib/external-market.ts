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

const INTERNATIONAL_INDEX_URL = "https://raw.githubusercontent.com/DeanFinancials/deanfi-data/main/major-indexes/international_major_indices.json";
const INTERNATIONAL_HISTORY_URL = "https://raw.githubusercontent.com/DeanFinancials/deanfi-data/main/major-indexes/international_major_indices_historical.json";
const BULLION = "https://standardbullion.com";

export function parseInternationalQuotes(raw: unknown, now = new Date()): Partial<Record<"N225" | "KOSPI", LiveQuote>> {
  const root = record(raw), metadata = record(root.metadata), indices = record(root.indices);
  const generated = metadata.generated_at, marketDate = metadata.market_date;
  if (typeof generated !== "string" || !Number.isFinite(Date.parse(generated)) ||
      typeof marketDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(marketDate)) return {};
  const age = now.getTime() - Date.parse(generated), marketTime = Date.parse(`${marketDate}T00:00:00Z`);
  if (age < -60_000 || age > 5 * 86_400_000 || !Number.isFinite(marketTime) || marketTime > now.getTime() || now.getTime() - marketTime > 6 * 86_400_000) return {};
  const result: Partial<Record<"N225" | "KOSPI", LiveQuote>> = {};
  for (const [id, canonical, country, currency, name] of [
    ["N225", "^N225", "Japan", "JPY", "Nikkei 225"],
    ["KOSPI", "^KS11", "South Korea", "KRW", "KOSPI"],
  ] as const) {
    const item = record(indices[canonical]);
    const value = positive(item.current_price);
    const change = typeof item.daily_change_percent === "number" ? item.daily_change_percent : Number(item.daily_change_percent);
    if (item.symbol !== canonical || item.country !== country || item.currency !== currency || value === null || !Number.isFinite(change)) continue;
    result[id] = { value, changePercent: change, timestamp: generated, marketDate, source: `DeanFi · ${name}` };
  }
  return result;
}

export async function fetchInternationalQuotes(): Promise<Partial<Record<"N225" | "KOSPI", LiveQuote>>> {
  return parseInternationalQuotes(await json(INTERNATIONAL_INDEX_URL));
}

export function parseInternationalHistory(raw: unknown, quotes: Partial<Record<"N225" | "KOSPI", LiveQuote>>, now = new Date()): Partial<Record<"N225" | "KOSPI", IntradayPoint[]>> {
  const root = record(raw), metadata = record(root.metadata), indices = record(root.indices);
  const generated = metadata.generated_at;
  if (typeof generated !== "string" || !Number.isFinite(Date.parse(generated)) || now.getTime() - Date.parse(generated) > 5 * 86_400_000 || Date.parse(generated) > now.getTime() + 60_000) return {};
  const output: Partial<Record<"N225" | "KOSPI", IntradayPoint[]>> = {};
  for (const [id, canonical] of [["N225", "^N225"], ["KOSPI", "^KS11"]] as const) {
    const quote = quotes[id], entry = record(indices[canonical]);
    if (!quote?.marketDate || entry.symbol !== canonical || !Array.isArray(entry.data)) continue;
    const end = Date.parse(`${quote.marketDate}T12:00:00Z`);
    const points = new Map<string, IntradayPoint>();
    for (const rawRow of entry.data) {
      const row = record(rawRow), date = row.date, close = positive(row.close);
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || close === null) continue;
      const time = Date.parse(`${date}T12:00:00Z`);
      if (Number.isFinite(time) && time <= end && end - time <= 70 * 86_400_000) points.set(date, { timestamp: `${date}T12:00:00Z`, price: close });
    }
    points.set(quote.marketDate, { timestamp: `${quote.marketDate}T12:00:00Z`, price: quote.value });
    const series = [...points.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-30);
    if (series.length >= 2 && end - Date.parse(series.at(-2)!.timestamp) <= 10 * 86_400_000) output[id] = series;
  }
  return output;
}

export async function fetchInternationalHistory(quotes: Partial<Record<"N225" | "KOSPI", LiveQuote>>): Promise<Partial<Record<"N225" | "KOSPI", IntradayPoint[]>>> {
  return parseInternationalHistory(await json(INTERNATIONAL_HISTORY_URL), quotes);
}

export function parseBullionGold(spotRaw: unknown, historyRaw: unknown, now = new Date()): { quote: LiveQuote; trend: IntradayPoint[] } | null {
  const spot = record(spotRaw), history = record(historyRaw);
  const gold = Array.isArray(spot.metals) ? spot.metals.map(record).find((item) => item.symbol === "XAU") : undefined;
  const ask = positive(gold?.ask), bid = positive(gold?.bid), open = positive(gold?.open), updated = spot.updated;
  if (ask === null || bid === null || open === null || ask < bid || ask / bid > 1.02 ||
      typeof updated !== "string" || !Number.isFinite(Date.parse(updated)) ||
      Date.parse(updated) > now.getTime() + 60_000 || now.getTime() - Date.parse(updated) > 3 * 86_400_000 ||
      history.source !== "Standard Bullion" || history.metal !== "XAU" || history.unit !== "USD per troy ounce" || !Array.isArray(history.points)) return null;
  const series = new Map<string, IntradayPoint>();
  for (const rawPoint of history.points) {
    const point = record(rawPoint), price = positive(point.price), timestamp = point.t;
    if (price === null || typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) continue;
    const age = Date.parse(updated) - Date.parse(timestamp);
    if (age >= 0 && age <= 30 * 3_600_000) series.set(timestamp, { timestamp, price });
  }
  const trend = [...series.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-120);
  if (trend.length < 2 || Date.parse(updated) - Date.parse(trend.at(-1)!.timestamp) > 2 * 3_600_000 || Math.abs(trend.at(-1)!.price - ask) / ask > 0.01) return null;
  trend.push({ timestamp: updated, price: ask });
  return { quote: { value: ask, changePercent: (ask - open) / open * 100, timestamp: updated, source: "Data by Standard Bullion · XAU 卖出价" }, trend };
}

export async function fetchBullionGold(): Promise<{ quote: LiveQuote; trend: IntradayPoint[] }> {
  const [spot, history] = await Promise.all([json(`${BULLION}/spot-prices.json`), json(`${BULLION}/api/v1/market/history?metal=XAU&range=24h`)]);
  const result = parseBullionGold(spot, history);
  if (!result) throw new Error("Standard Bullion returned incomplete gold prices");
  return result;
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
