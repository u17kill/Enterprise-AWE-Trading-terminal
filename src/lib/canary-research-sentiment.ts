import { callLongbridgeTool, type getSession } from "./longbridge-mcp";
import { collectMarketHealth } from "./market-health-source";
import { parseLimitPools, parseTurnoverPair } from "./canary";
import { completedMarketCutoff } from "./canary-research-source";
type Session = NonNullable<ReturnType<typeof getSession>>;
type Market = "us" | "cn";
const SECTORS = [
  ["XLK.US", "科技"], ["XLF.US", "金融"], ["XLV.US", "医疗"], ["XLY.US", "可选消费"], ["XLP.US", "必需消费"], ["XLE.US", "能源"], ["XLI.US", "工业"], ["XLB.US", "材料"], ["XLU.US", "公用事业"], ["XLRE.US", "房地产"], ["XLC.US", "通信服务"],
] as const;
const MAG_SEVEN = [["AAPL.US", "苹果"], ["MSFT.US", "微软"], ["GOOGL.US", "Alphabet"], ["AMZN.US", "亚马逊"], ["META.US", "Meta"], ["NVDA.US", "英伟达"], ["TSLA.US", "特斯拉"]] as const;
type Pulse = { date: string; temperature: number; sentiment: number; valuation: number };
type SectorReading = { symbol: string; title: string; changePercent: number; change5?: number; change20?: number; change60?: number };
type Mover = { symbol: string; name: string; changePercent: number; marketCap: number };
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
export function completedSentimentPulses(pulse: Pulse[], market: Market, now = new Date()): Pulse[] {
  const cutoff = completedMarketCutoff(market, now);
  return cutoff ? pulse.filter((item) => item.date <= cutoff) : [];
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
export function buildMagSeven(quotesRaw: unknown, infosRaw: unknown, closeDate: string) {
  if (!Array.isArray(quotesRaw) || !Array.isArray(infosRaw)) return null;
  const members = MAG_SEVEN.flatMap(([symbol, title]) => {
    const quote = quotesRaw.find((item) => item && typeof item === "object" && item.symbol === symbol) as Record<string, unknown> | undefined;
    const info = infosRaw.find((item) => item && typeof item === "object" && item.symbol === symbol) as Record<string, unknown> | undefined;
    const last = Number(quote?.last_done), previous = Number(quote?.prev_close), shares = Number(info?.total_shares);
    if (!quote || typeof quote.timestamp !== "string" || localDate(quote.timestamp, "us") !== closeDate || !Number.isFinite(last) || last <= 0 || !Number.isFinite(previous) || previous <= 0 || !Number.isFinite(shares) || shares <= 0) return [];
    return [{ symbol, title, changePercent: Math.round((last / previous - 1) * 10_000) / 100, priorMarketCap: previous * shares, deltaCap: (last - previous) * shares }];
  });
  if (members.length !== MAG_SEVEN.length) return null;
  const base = members.reduce((sum, item) => sum + item.priorMarketCap, 0);
  if (!Number.isFinite(base) || base <= 0) return null;
  return { weightedChangePercent: Math.round(members.reduce((sum, item) => sum + item.deltaCap, 0) / base * 10_000) / 100, members: members.map(({ symbol, title, changePercent, priorMarketCap }) => ({ symbol, title, changePercent, weightPercent: Math.round(priorMarketCap / base * 10_000) / 100 })) };
}
export function rankLargeCapMovers(gainersRaw: unknown, losersRaw: unknown, quotesRaw: unknown, closeDate: string): { universe: number; gainers: Mover[]; losers: Mover[] } | null {
  if (!gainersRaw || !losersRaw || typeof gainersRaw !== "object" || typeof losersRaw !== "object" || !Array.isArray(quotesRaw)) return null;
  const gainersData = gainersRaw as { total?: unknown; items?: unknown }, losersData = losersRaw as { total?: unknown; items?: unknown };
  if (!Array.isArray(gainersData.items) || !Array.isArray(losersData.items) || !Number.isInteger(gainersData.total) || Number(gainersData.total) !== Number(losersData.total)) return null;
  const quotes = new Map(quotesRaw.flatMap((item) => item && typeof item === "object" && typeof item.symbol === "string" ? [[item.symbol as string, item as Record<string, unknown>] as const] : []));
  const parse = (items: unknown[], direction: 1 | -1) => items.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>, symbol = row.symbol, name = row.name;
    if (typeof symbol !== "string" || !/^[A-Z0-9.-]+\.US$/.test(symbol) || typeof name !== "string" || !Array.isArray(row.indicators)) return [];
    const capField = row.indicators.find((field) => field && typeof field === "object" && field.key === "marketcap") as { value?: unknown } | undefined;
    const marketCap = Number(capField?.value), quote = quotes.get(symbol), last = Number(quote?.last_done), previous = Number(quote?.prev_close);
    if (!Number.isFinite(marketCap) || marketCap < 10_000_000_000 || !quote || typeof quote.timestamp !== "string" || localDate(quote.timestamp, "us") !== closeDate || !Number.isFinite(last) || last <= 0 || !Number.isFinite(previous) || previous <= 0) return [];
    const changePercent = Math.round((last / previous - 1) * 10_000) / 100;
    return changePercent * direction > 0 ? [{ symbol, name, changePercent, marketCap }] : [];
  }).sort((a, b) => direction * (b.changePercent - a.changePercent)).slice(0, 10);
  const gainers = parse(gainersData.items, 1), losers = parse(losersData.items, -1);
  return gainers.length && losers.length ? { universe: Number(gainersData.total), gainers, losers } : null;
}
export function sectorReturns(bars: { date: string; close: number }[], closeDate: string) {
  const ordered = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length < 61 || ordered.at(-1)?.date !== closeDate || ordered.some((item) => !Number.isFinite(item.close) || item.close <= 0)) return null;
  const last = ordered.at(-1)!.close;
  const change = (sessions: number) => Math.round((last / ordered[ordered.length - sessions - 1].close - 1) * 10_000) / 100;
  return { change5: change(5), change20: change(20), change60: change(60) };
}
export function relativeSectorStrength(soxx: { date: string; close: number }[], spy: { date: string; close: number }[], closeDate: string) {
  const benchmark = new Map(spy.map((bar) => [bar.date, bar.close]));
  const ratios = soxx.flatMap((bar) => {
    const baseline = benchmark.get(bar.date);
    return bar.date <= closeDate && baseline && Number.isFinite(bar.close) && Number.isFinite(baseline) && bar.close > 0 && baseline > 0 ? [{ date: bar.date, close: bar.close / baseline }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  const result = sectorReturns(ratios, closeDate);
  return result ? { change20: result.change20, change60: result.change60 } : null;
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
export async function verifyHistoricalLimitPools(session: Session, upRaw: unknown, downRaw: unknown, date: string) {
  const directlyDated = parseLimitPools(upRaw, downRaw, date);
  if (directlyDated) return directlyDated;
  const pools = [upRaw, downRaw].map((raw) => {
    const root = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const data = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data as Record<string, unknown> : {};
    if (root.rc !== 0 || !Number.isInteger(data.tc) || Number(data.tc) < 0 || !Array.isArray(data.pool) || String(data.qdate) < date.replaceAll("-", "")) return null;
    return { count: Number(data.tc), first: data.pool[0] as Record<string, unknown> | undefined };
  });
  if (pools.some((pool) => !pool) || pools[0]!.count <= 0) throw new Error("涨停与跌停股池没有返回同一个完整交易日");
  const checks = pools.filter((pool) => pool!.count > 0).map(async (pool) => {
    const first = pool!.first;
    const code = first?.c, market = first?.m, price = Number(first?.p) / 1000;
    if (typeof code !== "string" || !/^\d{6}$/.test(code) || (market !== 0 && market !== 1) || !Number.isFinite(price) || price <= 0) throw new Error("历史股池缺少可复核的个股收盘价");
    const symbol = `${code}.${market === 1 ? "SH" : "SZ"}`;
    const raw = await callLongbridgeTool(session, "history_candlesticks_by_offset", { symbol, period: "day", count: 1, forward: false, time: `${date}T23:59:59`, trade_sessions: "intraday", _jq: "map({timestamp,close})" });
    const bar = Array.isArray(raw) ? raw[0] as Record<string, unknown> | undefined : undefined;
    const close = Number(bar?.close);
    if (typeof bar?.timestamp !== "string" || localDate(bar.timestamp, "cn") !== date || !Number.isFinite(close) || Math.abs(close - price) > Math.max(0.02, price * 0.0001)) throw new Error("历史收盘价未能与涨跌停股池相互核对");
  });
  await Promise.all(checks);
  return { date, up: pools[0]!.count, down: pools[1]!.count };
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
  const pulse = completedSentimentPulses(parseSentimentHistory(historyRaw, market), market);
  if (!pulse.length) throw new Error("长桥未返回可核验的收盘市场情绪历史");
  const latest = pulse.at(-1)!;
  const readings: { id: string; title: string; value: number; unit: string; asOf: string; source: string; status: string; summary: string; explanation: string; points: { date: string; value: number }[] }[] = ([
    ["temperature", "市场温度", latest.temperature, "长桥市场整体冷热，区别于指数复合温度"],
    ["sentiment", "市场情绪", latest.sentiment, "长桥市场情绪分项"],
    ["valuation", "市场估值状态", latest.valuation, "长桥市场估值分项；并非指数 PE"],
  ] as const).map(([id, title, value, explanation]) => ({ id, title, value, unit: "/ 100", asOf: latest.date, source: "Longbridge · 市场温度历史", status: value < 30 ? "偏冷" : value > 70 ? "偏热" : "中性", summary: `${title}为 ${value}/100；请结合近六次观测和板块变化。`, explanation, points: pulse.slice(-6).map((point) => ({ date: point.date, value: point[id] })) }));
  const errors: Record<string, string> = {};
  let leaders: ReturnType<typeof buildMagSeven> = null;
  let movers: ReturnType<typeof rankLargeCapMovers> = null;
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
      if (value) readings.push({ id, title, value: value.value, unit: value.unit, asOf: value.asOf.slice(0, 10), source: value.source, status: ({ green: "平稳", amber: "关注", red: "警戒", unknown: "待解释" } as Record<string, string>)[value.state] ?? "待解释", summary: value.summary, explanation, points: [] });
      else if (health?.errors[id]) errors[id] = health.errors[id]!;
    }
    try {
      const symbols = MAG_SEVEN.map(([symbol]) => symbol);
      const [quotes, infos] = await Promise.all([callLongbridgeTool(session, "quote", { symbols }), callLongbridgeTool(session, "static_info", { symbols })]);
      leaders = buildMagSeven(quotes, infos, latest.date);
      if (!leaders) throw new Error("七巨头未返回同一收盘日的完整价格与股本");
      const value = leaders.weightedChangePercent;
      readings.push({ id: "magSevenBasket", title: "七巨头市值加权涨跌", value, unit: "%", asOf: latest.date, source: "Longbridge · 七股收盘价与总股本", status: value > 0 ? "整体上涨" : value < 0 ? "整体下跌" : "持平", summary: `七家公司以昨日市值加权，合计变动 ${value.toFixed(2)}%。`, explanation: "苹果、微软、Alphabet（以 GOOGL 代表公司，避免与 GOOG 重复计算）、亚马逊、Meta、英伟达、特斯拉。用昨日价格 × 总股本作权重计算七家公司自身的加权日涨跌；不是对纳指或标普的指数点数贡献，股本披露变化可能影响权重。", points: [] });
    } catch (error) { errors.magSevenBasket = error instanceof Error ? error.message : "七巨头行情暂不可用"; }
    try {
      const screener = { market: "US", conditions: [{ key: "marketcap", min: "100", max: "" }], extra_returns: ["marketcap", "prevchg"], sort_by_key: "prevchg", size: 20, page: 0 };
      const [gainersRaw, losersRaw] = await Promise.all(["desc", "asc"].map((sort_order) => callLongbridgeTool(session, "screener_search", { ...screener, sort_order, _jq: "{total,items:(.items|map({symbol,name,indicators}))}" })));
      const symbols = [...new Set([gainersRaw, losersRaw].flatMap((raw) => raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items) ? (raw as { items: { symbol?: string }[] }).items.map((item) => item.symbol).filter((symbol): symbol is string => typeof symbol === "string") : []))];
      if (symbols.length < 20) throw new Error("美股大市值筛选样本不足");
      const quotes = await callLongbridgeTool(session, "quote", { symbols, _jq: "map({symbol,last_done,prev_close,timestamp})" });
      movers = rankLargeCapMovers(gainersRaw, losersRaw, quotes, latest.date);
      if (!movers || movers.gainers.length < 5 || movers.losers.length < 5) throw new Error("美股涨跌榜未返回足够的同日收盘报价");
    } catch (error) { movers = null; errors.largeCapMovers = error instanceof Error ? error.message : "美股大市值榜暂不可用"; }
  }
  if (market === "cn") {
    try {
      const turnover = await fetchChinaTurnover(latest.date);
      readings.push({ id: "turnover", title: "沪深 A 股成交额", value: Math.round(turnover.value * 1000) / 1000, unit: "万亿元", asOf: turnover.date, source: "上交所 / 深交所 · A 股成交概况", status: "已核对", summary: "两所主板与创业板 A 股成交额同日相加。", explanation: "A 股股票成交金额，不含 B 股与基金。它表示交易活跃度，不是资金净流入；应结合涨跌家数与市场方向阅读。", points: [] });
    } catch (error) { errors.turnover = error instanceof Error ? error.message : "交易所成交额暂不可用"; }
    try {
      const [up, down] = await Promise.all([fetchLimitPool("ZTPool", latest.date), fetchLimitPool("DTPool", latest.date)]);
      const limits = await verifyHistoricalLimitPools(session, up, down, latest.date);
      for (const [id, title, value, unit, explanation] of [
        ["limitUp", "涨停家数", limits.up, "家", "东方财富收盘涨停股池；包含多种涨跌幅限制的股票，不等于全市场上涨家数。"],
        ["limitDown", "跌停家数", limits.down, "家", "东方财富收盘跌停股池；与涨停家数共同观察短期情绪，不单独构成交易信号。"],
      ] as const) readings.push({ id, title, value, unit, asOf: limits.date, source: "东方财富 · 历史收盘股池", status: "已核对", summary: `${title} ${value} 家，同一收盘日。`, explanation: `${explanation} 当源站 qdate 与目标日不一致时，另用长桥个股历史收盘价复核股池日期。`, points: [] });
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
    try {
      const [soxxRaw, spyRaw] = await Promise.all(["SOXX.US", "SPY.US"].map((symbol) => callLongbridgeTool(session, "candlesticks", { symbol, period: "day", count: 70, forward_adjust: true, trade_sessions: "intraday" })));
      const strength = relativeSectorStrength(parseSectorBars(soxxRaw), parseSectorBars(spyRaw), latest.date);
      if (!strength) throw new Error("SOXX 与 SPY 未返回 61 个同日收盘观测");
      for (const [days, value] of [[20, strength.change20], [60, strength.change60]] as const) readings.push({ id: `semiconductorRelative${days}`, title: `半导体相对强弱 · ${days} 日`, value, unit: "%", asOf: latest.date, source: "Longbridge · SOXX/SPY 前复权日 K", status: value > 0 ? "半导体领先" : value < 0 ? "半导体落后" : "持平", summary: `SOXX/SPY 价格比在 ${days} 个交易日内变化 ${value.toFixed(2)}%。`, explanation: "SOXX ETF 与 SPY ETF 的前复权收盘价比值变化；是美股半导体相对大盘的代理，不等于费城半导体指数相对标普指数，也不代表未来收益。", points: [] });
    } catch (error) { errors.semiconductorRelative = error instanceof Error ? error.message : "半导体相对强弱暂不可用"; }
  }
  return { kind: "sentiment" as const, market, refreshedAt: new Date().toISOString(), closeAsOf: latest.date, readings, leaders: leaders?.members ?? [], movers, sectors: market === "cn" ? [...sectors.slice(0, 6), ...sectors.slice(-6)] : sectors, sectorAsOf, sectorLayer: sectorAsOf && sectorAsOf !== latest.date ? "intraday" : "close", errors };
}
