import { callLongbridgeTool, type getSession } from "./longbridge-mcp";
import { collectMarketHealth } from "./market-health-source";
import { parseLimitPools, parseTurnoverPair } from "./canary";
type Session = NonNullable<ReturnType<typeof getSession>>;
type Market = "us" | "cn";
const SECTORS = [
  ["XLK.US", "科技"], ["XLF.US", "金融"], ["XLV.US", "医疗"], ["XLY.US", "可选消费"], ["XLP.US", "必需消费"], ["XLE.US", "能源"], ["XLI.US", "工业"], ["XLB.US", "材料"], ["XLU.US", "公用事业"], ["XLRE.US", "房地产"], ["XLC.US", "通信服务"],
] as const;
type Pulse = { date: string; temperature: number; sentiment: number; valuation: number };
type SectorReading = { symbol: string; title: string; changePercent: number; change5?: number; change20?: number; change60?: number };
function localDate(timestamp: string | number, market: Market): string | null {
  const date = new Date(typeof timestamp === "number" ? timestamp * 1000 : timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: market === "us" ? "America/New_York" : "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function parseSentimentHistory(raw: unknown, market: Market): Pulse[] {
  const entries = raw && typeof raw === "object" ? (raw as { list?: unknown }).list : null;
  if (!Array.isArray(entries)) return [];
  const result = new Map<string, Pulse>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.timestamp !== "string") continue;
    const date = localDate(item.timestamp, market), temperature = Number(item.temperature), sentiment = Number(item.sentiment), valuation = Number(item.valuation);
    if (date && [temperature, sentiment, valuation].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) result.set(date, { date, temperature, sentiment, valuation });
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function parseSectorQuotes(raw: unknown, closeDate: string) {
  if (!Array.isArray(raw)) return [];
  return SECTORS.flatMap(([symbol, title]) => {
    const row = raw.find((item) => item && typeof item === "object" && item.symbol === symbol) as Record<string, unknown> | undefined;
    const price = Number(row?.last_done), prior = Number(row?.prev_close);
    if (!row || typeof row.timestamp !== "string" || localDate(row.timestamp, "us") !== closeDate || !Number.isFinite(price) || !Number.isFinite(prior) || prior <= 0) return [];
    return [{ symbol, title, changePercent: Math.round((price / prior - 1) * 10000) / 100 }];
  });
}
export function sectorReturns(bars: { date: string; close: number }[], closeDate: string) {
  const ordered = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length < 61 || ordered.at(-1)?.date !== closeDate || ordered.some((item) => !Number.isFinite(item.close) || item.close <= 0)) return null;
  const last = ordered.at(-1)!.close;
  const change = (sessions: number) => Math.round((last / ordered[ordered.length - sessions - 1].close - 1) * 10_000) / 100;
  return { change5: change(5), change20: change(20), change60: change(60) };
}
function parseSectorBars(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>, date = typeof row.timestamp === "string" ? localDate(row.timestamp, "us") : null, close = Number(row.close);
    return date && Number.isFinite(close) && close > 0 ? [{ date, close }] : [];
  });
}
async function enrichUsSectors(session: Session, sectors: SectorReading[], closeDate: string) {
  const enriched: SectorReading[] = [];
  for (let index = 0; index < sectors.length; index += 4) {
    const batch = await Promise.all(sectors.slice(index, index + 4).map(async (sector) => {
      try {
        const raw = await callLongbridgeTool(session, "candlesticks", { symbol: sector.symbol, period: "day", count: 70, trade_sessions: "intraday" });
        const trend = sectorReturns(parseSectorBars(raw).filter((bar) => bar.date <= closeDate), closeDate);
        return trend ? { ...sector, ...trend } : sector;
      } catch { return sector; }
    }));
    enriched.push(...batch);
  }
  return enriched;
}
export function parseChinaSectorRanking(raw: unknown) {
  const groups = raw && typeof raw === "object" ? (raw as { items?: unknown }).items : null;
  if (!Array.isArray(groups)) return { asOf: null, sectors: [] };
  const rows = groups.flatMap((item) => item && typeof item === "object" && Array.isArray(item.lists) ? item.lists : []);
  const dated = rows.flatMap((item) => {
    const value = Number(item?.chg), last = Number(item?.last);
    const asOf = Number.isFinite(last) ? localDate(last, "cn") : null;
    if (typeof item?.name !== "string" || typeof item?.symbol !== "string" || !Number.isFinite(value) || !asOf) return [];
    return [{ asOf, symbol: item.symbol as string, title: item.name as string, changePercent: Math.round(value * 10_000) / 100 }];
  });
  const asOf = dated.map((item) => item.asOf).sort().at(-1) ?? null;
  return { asOf, sectors: dated.filter((item) => item.asOf === asOf).sort((a, b) => b.changePercent - a.changePercent).map((item) => ({ symbol: item.symbol, title: item.title, changePercent: item.changePercent })) };
}
async function fetchLimitPool(kind: "ZTPool" | "DTPool", date: string) {
  const params = new URLSearchParams({ ut: "7eea3edcaed734bea9cbfc24409ed989", dpt: "wz.ztzt", Pageindex: "0", pagesize: "200", sort: kind === "ZTPool" ? "fbt:asc" : "fund:asc", date: date.replaceAll("-", "") });
  const response = await fetch(`https://push2ex.eastmoney.com/getTopic${kind}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Referer: "https://quote.eastmoney.com/ztb/detail", "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`东方财富股池 HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}
async function fetchChinaTurnover(date: string) {
  const shParams = new URLSearchParams({ sqlId: "COMMON_SSE_SJ_GPSJ_CJGK_MRGK_C", PRODUCT_CODE: "01,02,03,11,17", type: "inParams", SEARCH_DATE: date });
  const szParams = new URLSearchParams({ SHOWTYPE: "JSON", CATALOGID: "1803_sczm", txtQueryDate: date, tab1PAGENO: "1" });
  const endpoints = [
    [`https://query.sse.com.cn/commonQuery.do?${shParams}`, "https://www.sse.com.cn/market/stockdata/overview/day/"],
    [`https://www.szse.cn/api/report/ShowReport/data?${szParams}`, "https://www.szse.cn/market/overview/index.html"],
  ] as const;
  const [shRaw, szRaw] = await Promise.all(endpoints.map(async ([url, referer]) => {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Accept: "application/json, text/plain, */*", Referer: referer, "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`交易所成交额 HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  }));
  const turnover = parseTurnoverPair(shRaw, szRaw);
  if (!turnover || turnover.date !== date) throw new Error("沪深交易所未返回与情绪脉搏同日的 A 股成交额");
  return turnover;
}
export async function collectSentiment(session: Session, market: Market) {
  const end = new Date(), start = new Date(end.getTime() - 25 * 86_400_000);
  const historyRaw = await callLongbridgeTool(session, "history_market_temperature", { market: market.toUpperCase(), start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
  const pulse = parseSentimentHistory(historyRaw, market);
  if (!pulse.length) throw new Error("长桥未返回可核验的收盘市场情绪历史");
  const latest = pulse.at(-1)!;
  const readings: { id: string; title: string; value: number; unit: string; asOf: string; source: string; status: string; summary: string; explanation: string; points: { date: string; value: number }[] }[] = ([
    ["temperature", "市场温度", latest.temperature, "长桥市场整体冷热，区别于指数复合温度"],
    ["sentiment", "市场情绪", latest.sentiment, "长桥市场情绪分项"],
    ["valuation", "市场估值状态", latest.valuation, "长桥市场估值分项；并非指数 PE"],
  ] as const).map(([id, title, value, explanation]) => ({ id, title, value, unit: "/ 100", asOf: latest.date, source: "Longbridge · 市场温度历史", status: value < 30 ? "偏冷" : value > 70 ? "偏热" : "中性", summary: `${title}为 ${value}/100；请结合近六次观测和板块变化。`, explanation, points: pulse.slice(-6).map((point) => ({ date: point.date, value: point[id] })) }));
  const errors: Record<string, string> = {};
  if (market === "us") {
    const health = await collectMarketHealth(session).catch(() => null);
    for (const [id, title, explanation] of [
      ["fearGreed", "CNN 恐惧贪婪", "CNN 综合指标，和其构成项不能重复算独立证据。"],
      ["breadth", "标普 500 宽度", "标普 500 成分股位于 MA50 上方的比例；同时查看 MA200。"],
      ["putCall", "SPY Put/Call", "SPY 期权 Put 与 Call 成交量比，非全市场期权比率。"],
      ["volatility", "VIX 波动率", "Cboe VIX；描述期权隐含波动，不预测价格方向。"],
      ["equalWeight", "等权相对强弱", "RSP 相对 SPY 的 60 日变化，以 ETF 作为宽度代理。"],
    ] as const) {
      const value = health?.readings[id];
      if (value) readings.push({ id, title, value: value.value, unit: value.unit, asOf: value.asOf.slice(0, 10), source: value.source, status: value.state, summary: value.summary, explanation, points: [] });
      else if (health?.errors[id]) errors[id] = health.errors[id]!;
    }
  }
  if (market === "cn") {
    try {
      const turnover = await fetchChinaTurnover(latest.date);
      readings.push({ id: "turnover", title: "沪深 A 股成交额", value: Math.round(turnover.value * 1000) / 1000, unit: "万亿元", asOf: turnover.date, source: "上交所 / 深交所 · A 股成交概况", status: "已核对", summary: "两所主板与创业板 A 股成交额同日相加。", explanation: "A 股股票成交金额，不含 B 股与基金。它表示交易活跃度，不是资金净流入；应结合涨跌家数与市场方向阅读。", points: [] });
    } catch (error) { errors.turnover = error instanceof Error ? error.message : "交易所成交额暂不可用"; }
    try {
      const [up, down] = await Promise.all([fetchLimitPool("ZTPool", latest.date), fetchLimitPool("DTPool", latest.date)]);
      const limits = parseLimitPools(up, down, latest.date);
      if (!limits) throw new Error("涨停与跌停股池没有返回同一个完整交易日");
      for (const [id, title, value, unit, explanation] of [
        ["limitUp", "涨停家数", limits.up, "家", "东方财富收盘涨停股池；包含多种涨跌幅限制的股票，不等于全市场上涨家数。"],
        ["limitDown", "跌停家数", limits.down, "家", "东方财富收盘跌停股池；与涨停家数共同观察短期情绪，不单独构成交易信号。"],
      ] as const) readings.push({ id, title, value, unit, asOf: limits.date, source: "东方财富 · 收盘股池", status: "已核对", summary: `${title} ${value} 家，同一收盘日。`, explanation, points: [] });
    } catch (error) { errors.limits = error instanceof Error ? error.message : "A 股涨跌停股池暂不可用"; }
  }
  let sectors: SectorReading[] = [];
  let sectorAsOf: string | null = null;
  try {
    if (market === "us") { sectors = parseSectorQuotes(await callLongbridgeTool(session, "quote", { symbols: SECTORS.map(([symbol]) => symbol) }), latest.date); sectorAsOf = sectors.length ? latest.date : null; if (sectors.length) sectors = await enrichUsSectors(session, sectors, latest.date); }
    else { const ranking = parseChinaSectorRanking(await callLongbridgeTool(session, "industry_rank", { market: "CN", indicator: "1", sort_type: "0", _jq: "{items:(.items|map({lists:(.lists|map({symbol,name,chg,last:(.minutes[-1].timestamp)}))}))}" })); sectors = ranking.sectors; sectorAsOf = ranking.asOf; }
    if (!sectors.length) errors.sectors = "板块来源未返回带日期的可核验行情";
  } catch (error) { errors.sectors = error instanceof Error ? error.message : "行业数据请求失败"; }
  if (market === "us") {
    const offense = ["XLK.US", "XLY.US", "XLC.US"].map((symbol) => sectors.find((sector) => sector.symbol === symbol)?.change20);
    const defense = ["XLU.US", "XLP.US", "XLV.US"].map((symbol) => sectors.find((sector) => sector.symbol === symbol)?.change20);
    if ([...offense, ...defense].every((value) => value !== undefined)) {
      const average = (values: (number | undefined)[]) => values.reduce<number>((sum, value) => sum + value!, 0) / values.length;
      const lead = Math.round((average(offense) - average(defense)) * 100) / 100;
      readings.push({ id: "offenseDefense", title: "进攻 − 防御 · 20 日", value: lead, unit: "百分点", asOf: latest.date, source: "Longbridge · 六行业 ETF 日 K", status: lead > 0 ? "进攻领先" : lead < 0 ? "防御领先" : "均衡", summary: `进攻组与防御组各三只 ETF，20 个交易日等权涨幅差 ${lead.toFixed(2)} 个百分点。`, explanation: "进攻组：科技 XLK、可选消费 XLY、通信 XLC；防御组：公用事业 XLU、必需消费 XLP、医疗 XLV。分别取 20 日涨幅简单平均后相减；是板块轮动代理，不代表全市场资金流。", points: [] });
    }
  }
  return { kind: "sentiment" as const, market, refreshedAt: new Date().toISOString(), closeAsOf: latest.date, readings, sectors: market === "cn" ? [...sectors.slice(0, 6), ...sectors.slice(-6)] : sectors, sectorAsOf, sectorLayer: sectorAsOf && sectorAsOf !== latest.date ? "intraday" : "close", errors };
}
