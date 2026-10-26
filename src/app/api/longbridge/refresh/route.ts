import { NextRequest, NextResponse } from "next/server";
import { findSymbol } from "../../../../lib/catalog";
import { matchTrendToQuote, parseCandles, parseMinuteCandles, parseQuotes, toLongbridgeSymbol, type IntradayPoint } from "../../../../lib/longbridge-data";
import { callLongbridgeTool, getSession, hasLongbridgeToken, UnauthorizedError } from "../../../../lib/longbridge-mcp";
import { longbridgeCookieName } from "../../../../lib/longbridge-cookie";
import { parseFundamentals, yearRange } from "../../../../lib/fundamentals";
import { fetchTreasury10Y } from "../../../../lib/treasury";
import { aggregateCandles } from "../../../../lib/chart-data";
import { fetchBitcoin, fetchGoldSpot, fetchInternationalQuotes } from "../../../../lib/external-market";

export const runtime = "nodejs";

async function getChartCandles(session: NonNullable<ReturnType<typeof getSession>>, symbol: string, period: "day" | "week" | "month") {
  const args = { symbol, period, count: 80, trade_sessions: "intraday" };
  let raw = await callLongbridgeTool(session, "candlesticks", args);
  const values: unknown[] = Array.isArray(raw) ? [...raw] : [];
  let oldest = values[0] && typeof values[0] === "object" && !Array.isArray(values[0]) ? (values[0] as { timestamp?: unknown }).timestamp : null;
  for (let page = 1; page < 4 && typeof oldest === "string" && values.length < 300; page++) {
    const before = new Date(Date.parse(oldest) - 86_400_000);
    if (!Number.isFinite(before.getTime())) break;
    try { raw = await callLongbridgeTool(session, "history_candlesticks_by_offset", { ...args, time: before.toISOString().slice(0, 19) }); }
    catch (error) { if (error instanceof UnauthorizedError) throw error; break; }
    if (!Array.isArray(raw) || raw.length === 0) break;
    const nextOldest = raw[0] && typeof raw[0] === "object" && !Array.isArray(raw[0]) ? (raw[0] as { timestamp?: unknown }).timestamp : null;
    if (typeof nextOldest !== "string" || nextOldest >= oldest) break;
    values.unshift(...raw);
    oldest = nextOldest;
  }
  return parseCandles(values).slice(-300);
}

export async function POST(request: NextRequest) {
  const session = getSession(request.cookies.get(longbridgeCookieName(request))?.value);
  if (!session || !hasLongbridgeToken(session)) return NextResponse.json({ error: "请先连接 Longbridge。" }, { status: 401 });
  let body: { symbols?: unknown; chartSymbol?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效。" }, { status: 400 }); }
  const ids = Array.isArray(body.symbols) ? [...new Set(body.symbols)].filter((id): id is string => typeof id === "string" && (Boolean(findSymbol(id)) || Boolean(toLongbridgeSymbol(id)))).slice(0, 30) : [];
  const supported = ids.filter((id) => toLongbridgeSymbol(id));
  const chartSymbol = typeof body.chartSymbol === "string" && (toLongbridgeSymbol(body.chartSymbol) || ["US10Y", "XAUUSD", "BTCUSD"].includes(body.chartSymbol)) ? body.chartSymbol : null;
  if (!ids.length && !chartSymbol) return NextResponse.json({ error: "没有可更新的资产。" }, { status: 400 });
  try {
    const rawQuotes = supported.length ? await callLongbridgeTool(session, "quote", { symbols: supported.map((id) => toLongbridgeSymbol(id)) }) : [];
    const quotes = parseQuotes(rawQuotes, supported);
    const trendsBySymbol: Record<string, IntradayPoint[]> = {};
    const [treasury, gold, bitcoin, international] = await Promise.all([
      ids.includes("US10Y") || chartSymbol === "US10Y" ? fetchTreasury10Y().catch(() => null) : Promise.resolve(null),
      ids.includes("XAUUSD") || chartSymbol === "XAUUSD" ? fetchGoldSpot().catch(() => null) : Promise.resolve(null),
      ids.includes("BTCUSD") || chartSymbol === "BTCUSD" ? fetchBitcoin(chartSymbol === "BTCUSD").catch(() => null) : Promise.resolve(null),
      ids.includes("N225") || ids.includes("KOSPI") ? fetchInternationalQuotes().catch(() => ({})) : Promise.resolve({}),
    ]);
    if (treasury) { quotes.US10Y = treasury.quote; trendsBySymbol.US10Y = treasury.trend; }
    if (gold) quotes.XAUUSD = gold;
    if (bitcoin) { quotes.BTCUSD = bitcoin.quote; trendsBySymbol.BTCUSD = bitcoin.trend; }
    if ("N225" in international && international.N225) quotes.N225 = international.N225;
    if ("KOSPI" in international && international.KOSPI) quotes.KOSPI = international.KOSPI;
    if (!chartSymbol) {
      const quotedIds = supported.filter((id) => quotes[id]);
      for (let start = 0; start < quotedIds.length; start += 4) {
        await Promise.all(quotedIds.slice(start, start + 4).map(async (id) => {
          try {
            const candles = await callLongbridgeTool(session, "candlesticks", { symbol: toLongbridgeSymbol(id), period: "5m", count: 80, trade_sessions: "intraday" });
            trendsBySymbol[id] = matchTrendToQuote(parseMinuteCandles(candles), quotes[id]);
          } catch (error) {
            if (error instanceof UnauthorizedError) throw error;
            trendsBySymbol[id] = [];
          }
        }));
      }
    }
    const candlesByInterval: Record<string, ReturnType<typeof parseCandles>> = {};
    let fundamentals = null;
    let weekRange = null;
    if (chartSymbol === "US10Y" && treasury) {
      const daily = treasury.observations.map((item) => ({ time: item.date, open: item.yieldPercent, high: item.yieldPercent, low: item.yieldPercent, close: item.yieldPercent, volume: 0 }));
      candlesByInterval["1D"] = daily.slice(-300);
      candlesByInterval["1W"] = aggregateCandles(daily, "1W").slice(-300);
      candlesByInterval["1M"] = aggregateCandles(daily, "1M").slice(-300);
    } else if (chartSymbol === "BTCUSD" && bitcoin) {
      candlesByInterval["1D"] = bitcoin.candles;
      candlesByInterval["1W"] = aggregateCandles(bitcoin.candles, "1W");
      candlesByInterval["1M"] = aggregateCandles(bitcoin.candles, "1M");
      weekRange = yearRange(bitcoin.candles);
    } else if (chartSymbol === "XAUUSD") {
      candlesByInterval["1D"] = [];
      candlesByInterval["1W"] = [];
      candlesByInterval["1M"] = [];
    } else if (chartSymbol) {
      for (const [interval, period] of [["1D", "day"], ["1W", "week"], ["1M", "month"]] as const) {
        try {
          candlesByInterval[interval] = await getChartCandles(session, toLongbridgeSymbol(chartSymbol)!, period);
        } catch (error) {
          if (error instanceof UnauthorizedError) throw error;
          candlesByInterval[interval] = [];
        }
      }
      weekRange = yearRange(candlesByInterval["1D"] ?? []);
      if (Boolean(findSymbol(chartSymbol)?.group === "stocks" || /\.US$/.test(chartSymbol))) {
        const canonical = toLongbridgeSymbol(chartSymbol)!;
        const [indexes, report, annual] = await Promise.all([
          callLongbridgeTool(session, "calc_indexes", { symbols: [canonical], indexes: ["PeTtmRatio", "PbRatio", "DividendRatioTtm"] }).catch(() => []),
          callLongbridgeTool(session, "financial_report_snapshot", { symbol: canonical, report: "qf" }).catch(() => ({})),
          callLongbridgeTool(session, "financial_report_snapshot", { symbol: canonical, report: "af" }).catch(() => ({})),
        ]);
        fundamentals = parseFundamentals(indexes, report, canonical, annual, quotes[chartSymbol]?.value);
      }
    }
    return NextResponse.json({ quotes, trendsBySymbol, candlesByInterval, fundamentals, weekRange, unsupported: ids.filter((id) => !toLongbridgeSymbol(id) && !quotes[id]), asOf: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Longbridge 授权已过期，请重新连接。" }, { status: 401 });
    return NextResponse.json({ error: "Longbridge 暂时未能返回行情，请稍后重试。" }, { status: 502 });
  }
}
