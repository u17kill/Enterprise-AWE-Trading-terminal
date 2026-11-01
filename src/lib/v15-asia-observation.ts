export type AsiaProxySymbol = "EWS.US" | "INDA.US";

export type AsiaObservation = {
  symbol: AsiaProxySymbol;
  market: "新加坡" | "印度";
  name: string;
  benchmark: string;
  kind: "us_etf_proxy";
  currency: "USD";
  asOf: string;
  close: number;
  barCount: number;
  change1d: number | null;
  change5d: number | null;
  change20d: number | null;
  change60d: number | null;
  source: "Longbridge";
};

const PROXIES = {
  "EWS.US": { market: "新加坡", name: "iShares MSCI Singapore ETF", benchmark: "MSCI Singapore Index" },
  "INDA.US": { market: "印度", name: "iShares MSCI India ETF", benchmark: "MSCI India Index" },
} as const;

export function buildAsiaObservation(symbol: AsiaProxySymbol, bars: unknown): AsiaObservation {
  const byDate = new Map<string, number>();
  if (Array.isArray(bars)) for (const bar of bars) {
    if (!bar || typeof bar !== "object" || Array.isArray(bar)) continue;
    const item = bar as { timestamp?: unknown; close?: unknown };
    const date = typeof item.timestamp === "string" ? item.timestamp.slice(0, 10) : "";
    const close = typeof item.close === "number" || typeof item.close === "string" ? Number(item.close) : NaN;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && Number.isFinite(close) && close > 0) byDate.set(date, close);
  }
  const history = [...byDate].sort(([a], [b]) => a.localeCompare(b));
  if (!history.length) throw new Error(`${symbol} 没有可用收盘价`);
  const latest = history.at(-1)!;
  const change = (days: number) => history.length > days ? 100 * (latest[1] / history[history.length - 1 - days][1] - 1) : null;
  return {
    symbol, ...PROXIES[symbol], kind: "us_etf_proxy", currency: "USD", source: "Longbridge",
    asOf: latest[0], close: latest[1], barCount: history.length,
    change1d: change(1), change5d: change(5), change20d: change(20), change60d: change(60),
  };
}
