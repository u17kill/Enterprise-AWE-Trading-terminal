import type { SampleCandle } from "./chart-data";

export type Fundamentals = {
  peTtm?: number; staticPe?: number; staticPePeriod?: string; pb?: number; dividendYield?: number;
  revenueYoy?: number; epsYoy?: number;
  reportPeriod?: string; reportEnd?: string;
};

function positive(value: unknown): number | undefined {
  const number = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0 ? number : undefined;
}
function finite(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const number = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export function parseFundamentals(indexes: unknown, snapshot: unknown, symbol: string, annualSnapshot?: unknown, lastPrice?: number): Fundamentals {
  const item = Array.isArray(indexes) ? indexes.map(object).find((row) => row.symbol === symbol) ?? {} : {};
  const report = object(snapshot);
  const revenue = object(report.fo_revenue), eps = object(report.fo_eps);
  const result: Fundamentals = {};
  const peTtm = positive(item.pe_ttm_ratio), pb = positive(item.pb_ratio), dividendYield = finite(item.dividend_ratio_ttm);
  if (peTtm !== undefined) result.peTtm = peTtm;
  if (pb !== undefined) result.pb = pb;
  if (dividendYield !== undefined && dividendYield >= 0) result.dividendYield = dividendYield;
  const annual = object(annualSnapshot), annualEps = positive(object(annual.fo_eps).value);
  if (annual.report === "af" && Number.isInteger(annual.fiscal_year) && typeof annual.fp_end === "string" && /^\d{4}\.\d\d\.\d\d$/.test(annual.fp_end) && annualEps !== undefined && lastPrice !== undefined && lastPrice > 0) {
    result.staticPe = lastPrice / annualEps;
    result.staticPePeriod = `FY${annual.fiscal_year} · 截至 ${annual.fp_end.replaceAll(".", "-")}`;
  }
  if (report.report === "qf" && Number.isInteger(report.fiscal_year) && typeof report.fiscal_period === "string") {
    result.reportPeriod = `FY${report.fiscal_year} Q${report.fiscal_period}`;
    if (typeof report.fp_end === "string" && /^\d{4}\.\d\d\.\d\d$/.test(report.fp_end)) result.reportEnd = report.fp_end.replaceAll(".", "-");
    const revenueYoy = finite(revenue.yoy), epsYoy = finite(eps.yoy);
    if (revenueYoy !== undefined) result.revenueYoy = revenueYoy;
    if (epsYoy !== undefined) result.epsYoy = epsYoy;
  }
  return result;
}

export function yearRange(candles: SampleCandle[]): { high: number; low: number; end: string } | null {
  if (candles.length < 252) return null;
  const latest = candles.slice(-252);
  return { high: Math.max(...latest.map((item) => item.high)), low: Math.min(...latest.map((item) => item.low)), end: latest.at(-1)!.time };
}
