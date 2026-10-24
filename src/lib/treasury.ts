import type { IntradayPoint, LiveQuote } from "./longbridge-data";

export type TreasuryObservation = { date: string; yieldPercent: number };

export function parseTreasuryYieldXml(xml: string): TreasuryObservation[] {
  const observations: TreasuryObservation[] = [];
  for (const match of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)) {
    const content = match[1];
    const date = content.match(/<d:NEW_DATE\b[^>]*>([^<]+)<\/d:NEW_DATE>/i)?.[1]?.slice(0, 10);
    const value = content.match(/<d:BC_10YEAR\b[^>]*>([^<]*)<\/d:BC_10YEAR>/i)?.[1];
    const yieldPercent = value?.trim() ? Number(value) : NaN;
    if (date && /^\d{4}-\d\d-\d\d$/.test(date) && Number.isFinite(yieldPercent) && yieldPercent > 0) observations.push({ date, yieldPercent });
  }
  return observations.sort((a, b) => a.date.localeCompare(b.date));
}

export function treasuryMarketData(observations: TreasuryObservation[]): { quote: LiveQuote; trend: IntradayPoint[] } {
  if (!observations.length) throw new Error("US Treasury returned no 10Y observations");
  const latest = observations.at(-1)!;
  const previous = observations.at(-2);
  const delta = previous ? latest.yieldPercent - previous.yieldPercent : 0;
  return {
    quote: { value: latest.yieldPercent, changePercent: previous ? delta / previous.yieldPercent * 100 : 0,
      changeBasisPoints: Math.round(delta * 1000) / 10, timestamp: `${latest.date}T12:00:00Z`, source: "US Treasury daily" },
    trend: observations.slice(-30).map((item) => ({ timestamp: `${item.date}T12:00:00Z`, price: item.yieldPercent })),
  };
}

export async function fetchTreasury10Y(): Promise<ReturnType<typeof treasuryMarketData> & { observations: TreasuryObservation[] }> {
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date()));
  const years = [year - 1, year];
  const datasets = await Promise.all(years.map(async (value) => {
    const url = new URL("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml");
    url.searchParams.set("data", "daily_treasury_yield_curve");
    url.searchParams.set("field_tdr_date_value", String(value));
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("US Treasury request failed");
    return parseTreasuryYieldXml(await response.text());
  }));
  const observations = datasets.flat().sort((a, b) => a.date.localeCompare(b.date));
  return { ...treasuryMarketData(observations), observations };
}
