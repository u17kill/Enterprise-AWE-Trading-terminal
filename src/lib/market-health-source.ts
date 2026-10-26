import { callLongbridgeTool, type getSession } from "./longbridge-mcp";
import { parseCandles, parseQuotes } from "./longbridge-data";
import { classifyOas, classifyPercentile, classifyVix, percentileRank, type HealthId, type HealthReading, type HealthSnapshot, type HealthState } from "./market-health";

type Session = NonNullable<ReturnType<typeof getSession>>;
type Observation = { date: string; value: number };
type OptionStat = { asOf: string; ratio: number; calls: number; puts: number };
const FRED = "https://fred.stlouisfed.org/series/";
const CNN = "https://www.cnn.com/markets/fear-and-greed";
const LB = "https://longbridge.com";

function numeric(raw: unknown): number | null {
  if ((typeof raw !== "string" && typeof raw !== "number") || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseFredCsv(csv: string, series: string): Observation[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines.shift()?.split(",") ?? [];
  const dateIndex = header.findIndex((part) => part === "DATE" || part === "observation_date");
  const valueIndex = header.indexOf(series);
  if (dateIndex < 0 || valueIndex < 0) return [];
  return lines.map((line) => line.split(",")).flatMap((row) => {
    const value = numeric(row[valueIndex]), date = row[dateIndex];
    return /^\d{4}-\d\d-\d\d$/.test(date ?? "") && value !== null ? [{ date, value }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function parseCnnFearGreed(raw: unknown): { score: number; rating: string; asOf: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = (raw as Record<string, unknown>).fear_and_greed;
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const data = item as Record<string, unknown>;
  const score = numeric(data.score);
  const asOf = data.timestamp;
  if (score === null || score < 0 || score > 100 || typeof asOf !== "string" || !Number.isFinite(Date.parse(asOf))) return null;
  return { score, rating: typeof data.rating === "string" ? data.rating : "", asOf };
}

export function parseSpyOptionStats(raw: unknown): OptionStat[] {
  const items = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>).stats : null;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const calls = numeric(row.total_call_volume), puts = numeric(row.total_put_volume), asOf = row.timestamp;
    if (calls === null || puts === null || calls <= 0 || puts < 0 || typeof asOf !== "string" || !Number.isFinite(Date.parse(asOf))) return [];
    return [{ asOf, ratio: puts / calls, calls, puts }];
  }).sort((a, b) => a.asOf.localeCompare(b.asOf));
}

export function normalizePair(first: { time: string; close: number }[], second: { time: string; close: number }[]): { first: number[]; second: number[]; asOf: string } | null {
  const other = new Map(second.map((item) => [item.time, item.close]));
  const joined = first.filter((item) => item.close > 0 && Number.isFinite(item.close) && (other.get(item.time) ?? 0) > 0).map((item) => ({ date: item.time, a: item.close, b: other.get(item.time)! }));
  if (!joined.length) return null;
  const base = joined[0];
  return { first: joined.map((item) => 100 * item.a / base.a), second: joined.map((item) => 100 * item.b / base.b), asOf: joined.at(-1)!.date };
}

async function fetchFred(series: string): Promise<Observation[]> {
  const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`FRED ${series}: HTTP ${response.status}`);
  const data = parseFredCsv(await response.text(), series);
  if (!data.length) throw new Error(`FRED ${series}: 无有效观测值`);
  return data;
}

async function fetchCnn(): Promise<ReturnType<typeof parseCnnFearGreed>> {
  const response = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", { cache: "no-store", signal: AbortSignal.timeout(10000), headers: { Accept: "application/json, text/plain, */*", Origin: "https://www.cnn.com", Referer: "https://www.cnn.com/", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } });
  if (!response.ok) throw new Error(`CNN: HTTP ${response.status}`);
  const result = parseCnnFearGreed(await response.json());
  if (!result) throw new Error("CNN: 未返回有效指标");
  return result;
}

function reading(value: number, unit: string, date: string, source: string, sourceUrl: string, state: HealthState, summary: string, rest: Partial<HealthReading> = {}): HealthReading {
  return { value, unit, asOf: date, source, sourceUrl, state, summary, ...rest };
}

export function optionHealthReadings(stats: OptionStat[]): Partial<Record<"crowding" | "putCall", HealthReading>> {
  const latest = stats.at(-1);
  if (!latest) return {};
  const putCall = reading(latest.ratio, "倍", latest.asOf, "Longbridge · SPY 期权量", LB, "unknown", "SPY 期权成交量之比", { secondaryValue: latest.calls, detail: `Call ${latest.calls.toLocaleString()} · Put ${latest.puts.toLocaleString()}` });
  if (stats.length < 40) return { putCall };
  const percentile = percentileRank(latest.ratio, stats.map((item) => item.ratio));
  if (percentile === null) return { putCall };
  const crowding = reading(percentile, "% 分位", latest.asOf, "Longbridge · SPY 期权量", LB, classifyPercentile(percentile), percentile < 20 ? "Call 相对活跃，留意单边乐观" : percentile >= 80 ? "Put 相对活跃，留意防守拥挤" : "期权量比处于常态区间", { detail: `SPY Put/Call ${latest.ratio.toFixed(2)}；近 ${stats.length} 个交易日分位。仅为代理指标。` });
  return { crowding, putCall };
}

export async function collectMarketHealth(session: Session | null): Promise<HealthSnapshot> {
  const readings: HealthSnapshot["readings"] = {}, errors: HealthSnapshot["errors"] = {};
  const run = async (ids: HealthId[], action: () => Promise<Partial<Record<HealthId, HealthReading>>>) => {
    try { Object.assign(readings, await action()); }
    catch (error) { for (const id of ids) errors[id] = error instanceof Error ? error.message : "数据源暂不可用"; }
  };
  const tasks: Promise<void>[] = [];
  if (session) {
    tasks.push(run(["volatility"], async () => {
      const quote = parseQuotes(await callLongbridgeTool(session, "quote", { symbols: [".VIX.US"] }), ["VIX"]).VIX;
      if (!quote) throw new Error("Longbridge 未返回 VIX 报价");
      return { volatility: reading(quote.value, "点", quote.timestamp, "Longbridge · Cboe VIX", "https://www.cboe.com/tradable_products/vix/", classifyVix(quote.value), quote.value < 20 ? "波动温和；仍需结合其他维度" : quote.value <= 30 ? "波动升高，留意期限结构" : "波动显著升高") };
    }));
    tasks.push(run(["crowding", "putCall"], async () => {
      const stats = parseSpyOptionStats(await callLongbridgeTool(session, "option_volume_daily", { symbol: "SPY.US", count: 260 }));
      if (!stats.length) throw new Error("Longbridge 未返回 SPY 期权量");
      const values = optionHealthReadings(stats);
      if (!values.crowding) errors.crowding = "SPY 期权历史样本不足，暂不计算拥挤分位";
      return values;
    }));
    tasks.push(run(["equalWeight"], async () => {
      const [rspRaw, spyRaw] = await Promise.all([callLongbridgeTool(session, "candlesticks", { symbol: "RSP.US", period: "day", count: 60 }), callLongbridgeTool(session, "candlesticks", { symbol: "SPY.US", period: "day", count: 60 })]);
      const pair = normalizePair(parseCandles(rspRaw), parseCandles(spyRaw));
      if (!pair || pair.first.length < 2) throw new Error("RSP / SPY 日 K 线不足");
      const relative = pair.first.at(-1)! - pair.second.at(-1)!;
      return { equalWeight: reading(relative, "百分点", `${pair.asOf}T20:00:00Z`, "Longbridge · RSP / SPY", LB, "unknown", relative >= 0 ? "近 60 日等权 ETF 相对较强" : "近 60 日市值加权 ETF 相对较强", { points: pair.first, secondaryPoints: pair.second, detail: "RSP 与 SPY 同日起点归一到 100；ETF 代理，并非官方指数。" }) };
    }));
  } else {
    for (const id of ["volatility", "crowding", "putCall", "equalWeight"] as const) errors[id] = "需连接 Longbridge 获取行情";
  }
  errors.breadth = "尚无完整标普 500 成分股 MA50/MA200 数据，不能计算市场宽度";
  tasks.push(run(["liquidity"], async () => {
    const data = await fetchFred("BAMLH0A0HYM2"), latest = data.at(-1)!;
    const target = Date.parse(latest.date) - 28 * 86_400_000;
    const previous = data.filter((item) => Date.parse(item.date) <= target).at(-1)?.value ?? null;
    return { liquidity: reading(latest.value, "%", `${latest.date}T00:00:00Z`, "FRED · ICE BofA 高收益债 OAS", `${FRED}BAMLH0A0HYM2`, classifyOas(latest.value, previous), previous !== null && latest.value - previous > 1 ? "四周信用利差扩大超过 100bp" : latest.value < 4 ? "信用利差处于周报绿灯区间" : latest.value <= 5 ? "信用利差进入警戒区间" : "信用利差超过周报红灯阈值", { detail: previous !== null ? `约四周前 ${previous.toFixed(2)}%` : "四周前数据不足" }) };
  }));
  tasks.push(run(["leverage"], async () => {
    const data = await fetchFred("NFCILEVERAGE"), sample = data.slice(-52), latest = sample.at(-1)!;
    const rank = sample.length >= 26 ? percentileRank(latest.value, sample.map((item) => item.value)) : null;
    const state: HealthState = rank === null ? "unknown" : rank > 90 ? "red" : rank >= 70 ? "amber" : "green";
    return { leverage: reading(latest.value, "指数", `${latest.date}T00:00:00Z`, "FRED · 芝加哥联储 NFCI 杠杆", `${FRED}NFCILEVERAGE`, state, rank === null ? "周度样本不足" : `近 ${sample.length} 周 ${rank.toFixed(0)}% 分位；项目参考规则`, { detail: "周度杠杆条件代理指标，不是 FINRA 月度保证金债务。" }) };
  }));
  tasks.push(run(["yieldCurve"], async () => {
    const data = await fetchFred("T10Y2Y"), latest = data.at(-1)!;
    return { yieldCurve: reading(latest.value, "百分点", `${latest.date}T00:00:00Z`, "FRED · 美国国债 10Y–2Y", `${FRED}T10Y2Y`, "unknown", latest.value < 0 ? "收益率曲线倒挂" : "收益率曲线正斜率", { points: data.slice(-30).map((item) => item.value), detail: "日度公布值；不是实时债券报价。" }) };
  }));
  tasks.push(run(["fearGreed"], async () => {
    const result = await fetchCnn();
    if (!result) throw new Error("CNN 未返回有效指标");
    return { fearGreed: reading(result.score, "/ 100", result.asOf, "CNN Business · Fear & Greed", CNN, "unknown", result.rating || (result.score < 25 ? "Extreme Fear" : result.score < 45 ? "Fear" : result.score <= 55 ? "Neutral" : result.score <= 75 ? "Greed" : "Extreme Greed"), { detail: "直接读取 CNN 发布值；非自行重算。" }) };
  }));
  await Promise.all(tasks);
  return { refreshedAt: new Date().toISOString(), readings, errors };
}
