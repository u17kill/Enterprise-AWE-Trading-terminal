import { collectMarketHealth, parseFredCsv } from "./market-health-source";
import { getSession } from "./longbridge-mcp";
import { CANARY_INDICATORS, parseEcbDaily, parseMarginPair, parseMofJgb, parseTurnoverPair, type CanaryReading, type CanarySnapshot } from "./canary";
import type { HealthId, HealthReading, HealthState } from "./market-health";

type Session = NonNullable<ReturnType<typeof getSession>>;
type Observation = { date: string; value: number };
const FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=";
const ECB_DAILY = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const JGB_CURRENT = "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv";
const SSE_MARGIN = "https://query.sse.com.cn/marketdata/tradedata/queryMargin.do";
const SZSE_MARGIN = "https://www.szse.cn/api/report/ShowReport/data";
const SSE_TURNOVER = "https://query.sse.com.cn/commonQuery.do";

async function getText(url: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Accept: "text/plain, text/csv, text/xml, application/xml, */*" } });
  if (!response.ok) throw new Error(`来源暂不可用（HTTP ${response.status}）`);
  return response.text();
}

async function getJson(url: string, referer: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Accept: "application/json, text/plain, */*", Referer: referer, "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`交易所数据源 HTTP ${response.status}`);
  return response.json();
}

async function fredSeries(id: string): Promise<Observation[]> {
  const series = parseFredCsv(await getText(`${FRED_CSV}${encodeURIComponent(id)}`), id);
  if (!series.length) throw new Error("来源未返回有效日期与数值");
  return series;
}

function reading(id: string, value: number, unit: string, date: string, summary: string, state: HealthState = "unknown", points?: number[]): CanaryReading {
  const item = CANARY_INDICATORS.find((indicator) => indicator.id === id)!;
  return { value, unit, asOf: date, source: item.sourceName, sourceUrl: item.sourceUrl, state, summary, points };
}

const HEALTH_MAP: Partial<Record<HealthId, string>> = {
  volatility: "vix", breadth: "breadth", liquidity: "hyOas", crowding: "crowding",
  leverage: "leverage", putCall: "putCall", fearGreed: "fearGreed",
};

function fromHealth(value: HealthReading, id: string): CanaryReading {
  const state = id === "fearGreed" ? value.value <= 25 || value.value >= 75 ? "red" : value.value < 45 || value.value > 55 ? "amber" : "green" : value.state;
  return { ...value, state, sourceUrl: CANARY_INDICATORS.find((item) => item.id === id)?.sourceUrl ?? value.sourceUrl };
}

export async function collectCanary(session: Session | null): Promise<CanarySnapshot> {
  const readings: CanarySnapshot["readings"] = {}, errors: CanarySnapshot["errors"] = {};
  const run = async (ids: string[], action: () => Promise<Record<string, CanaryReading>>) => {
    try { Object.assign(readings, await action()); }
    catch (error) { for (const id of ids) errors[id] = error instanceof Error ? error.message : "数据暂不可用"; }
  };
  await Promise.all([
    run(Object.values(HEALTH_MAP), async () => {
      const health = await collectMarketHealth(session);
      const result: Record<string, CanaryReading> = {};
      for (const [healthId, canaryId] of Object.entries(HEALTH_MAP)) {
        const value = health.readings[healthId as HealthId];
        if (value) result[canaryId] = fromHealth(value, canaryId);
        else if (health.errors[healthId as HealthId]) errors[canaryId] = health.errors[healthId as HealthId]!;
      }
      return result;
    }),
    run(["us30", "us10", "us2", "us3m", "us30_2", "us10_3m"], async () => {
      const ids = { us30: "DGS30", us10: "DGS10", us2: "DGS2", us3m: "DGS3MO" } as const;
      const data = await Promise.all(Object.entries(ids).map(async ([key, series]) => [key, await fredSeries(series)] as const));
      const series = Object.fromEntries(data) as Record<keyof typeof ids, Observation[]>;
      const values: Record<string, CanaryReading> = {};
      for (const [key, history] of Object.entries(series)) {
        const last = history.at(-1)!;
        values[key] = reading(key, last.value, "%", last.date, "美联储 H.15 日度固定到期收益率", "unknown", history.slice(-40).map((item) => item.value));
      }
      for (const [key, longId, shortId] of [["us30_2", "us30", "us2"], ["us10_3m", "us10", "us3m"]]) {
        const short = new Map(series[shortId as keyof typeof ids].map((item) => [item.date, item.value]));
        const matched = series[longId as keyof typeof ids].flatMap((item) => short.has(item.date) ? [{ date: item.date, value: item.value - short.get(item.date)! }] : []);
        const last = matched.at(-1);
        if (!last) throw new Error("两端国债期限缺少同日观测");
        values[key] = reading(key, last.value, "百分点", last.date, last.value < 0 ? "收益率曲线倒挂；仍需持续观察" : "收益率曲线为正斜率", last.value < 0 ? "amber" : "unknown", matched.slice(-40).map((item) => item.value));
      }
      return values;
    }),
    run(["jp10"], async () => {
      const result = parseMofJgb(await getText(JGB_CURRENT));
      if (!result) throw new Error("日本财务省 CSV 未返回有效 10 年期观测");
      return { jp10: reading("jp10", result.value, "%", result.date, "日债 10 年期最新公布值") };
    }),
    run(["usdjpy", "usdcny"], async () => {
      const result = parseEcbDaily(await getText(ECB_DAILY));
      if (!result) throw new Error("欧洲央行汇率文件缺少同日美元、日元或人民币");
      return {
        usdjpy: reading("usdjpy", result.usdjpy, "JPY / USD", result.date, "ECB 欧元参考价交叉计算；非实时现汇"),
        usdcny: reading("usdcny", result.usdcny, "CNY / USD", result.date, "ECB 欧元参考价交叉计算；非人民币中间价"),
      };
    }),
    run(["dollar"], async () => {
      const history = await fredSeries("DTWEXBGS"), latest = history.at(-1)!;
      return { dollar: reading("dollar", latest.value, "指数", latest.date, "美联储贸易加权广义美元指数，非 ICE DXY", "unknown", history.slice(-40).map((item) => item.value)) };
    }),
    run(["margin"], async () => {
      const end = new Date().toISOString().slice(0, 10).replaceAll("-", "");
      const begin = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
      const params = new URLSearchParams({ isPagination: "true", beginDate: begin, endDate: end, tabType: "", stockCode: "", "pageHelp.pageSize": "5000", "pageHelp.pageNo": "1", "pageHelp.beginPage": "1", "pageHelp.cacheSize": "1", "pageHelp.endPage": "5" });
      const shRaw = await getJson(`${SSE_MARGIN}?${params}`, "https://www.sse.com.cn/market/othersdata/margin/detail/index.shtml");
      const shObject = shRaw && typeof shRaw === "object" && !Array.isArray(shRaw) ? shRaw as Record<string, unknown> : {};
      const shRows = Array.isArray(shObject.result) ? shObject.result.slice(0, 8) : [];
      if (!shRows.length) throw new Error("上交所未返回近期两融汇总");
      const pairs = await Promise.allSettled(shRows.map(async (row) => {
        const opDate = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>).opDate : null;
        if (typeof opDate !== "string" || !/^\d{8}$/.test(opDate)) return null;
        const date = `${opDate.slice(0, 4)}-${opDate.slice(4, 6)}-${opDate.slice(6)}`;
        const query = new URLSearchParams({ SHOWTYPE: "JSON", CATALOGID: "1837_xxpl", txtDate: date, tab1PAGENO: "1" });
        const szRaw = await getJson(`${SZSE_MARGIN}?${query}`, "https://www.szse.cn/market/othersdata/margin/index.html");
        return parseMarginPair(row, szRaw);
      }));
      const aligned = pairs.flatMap((item) => item.status === "fulfilled" && item.value ? [item.value] : []).sort((a, b) => a.date.localeCompare(b.date));
      const latest = aligned.at(-1);
      if (!latest) throw new Error("沪深两所没有同一交易日的完整两融余额");
      const first = aligned[0];
      const delta = aligned.length > 1 ? latest.value - first.value : null;
      const summary = delta === null ? "沪深两所同日公布的融资融券余额合计" : `近 ${aligned.length} 个共同交易日${delta >= 0 ? "增加" : "减少"} ${Math.abs(delta * 10_000).toFixed(0)} 亿元`;
      return { margin: reading("margin", latest.value, "万亿元", latest.date, summary, "unknown", aligned.map((item) => item.value)) };
    }),
    run(["turnover"], async () => {
      const dates = Array.from({ length: 9 }, (_, index) => new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10));
      const pairs = await Promise.allSettled(dates.map(async (date) => {
        const shParams = new URLSearchParams({ sqlId: "COMMON_SSE_SJ_GPSJ_CJGK_MRGK_C", PRODUCT_CODE: "01,02,03,11,17", type: "inParams", SEARCH_DATE: date });
        const szParams = new URLSearchParams({ SHOWTYPE: "JSON", CATALOGID: "1803_sczm", txtQueryDate: date, tab1PAGENO: "1" });
        const [shRaw, szRaw] = await Promise.all([
          getJson(`${SSE_TURNOVER}?${shParams}`, "https://www.sse.com.cn/market/stockdata/overview/day/"),
          getJson(`${SZSE_MARGIN}?${szParams}`, "https://www.szse.cn/market/overview/index.html"),
        ]);
        return parseTurnoverPair(shRaw, szRaw);
      }));
      const aligned = pairs.flatMap((item) => item.status === "fulfilled" && item.value ? [item.value] : []).sort((a, b) => a.date.localeCompare(b.date));
      const latest = aligned.at(-1);
      if (!latest) throw new Error("沪深两所近期没有同日可比的 A 股成交额");
      const previous = aligned.at(-2);
      const summary = previous ? `较前一共同交易日${latest.value >= previous.value ? "放量" : "缩量"} ${Math.abs((latest.value - previous.value) * 10_000).toFixed(0)} 亿元` : "沪深两所 A 股成交额合计，不含 B 股和基金";
      return { turnover: reading("turnover", latest.value, "万亿元", latest.date, summary, "unknown", aligned.map((item) => item.value)) };
    }),
  ]);
  return { refreshedAt: new Date().toISOString(), readings, errors };
}
