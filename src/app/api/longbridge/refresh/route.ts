import { NextRequest, NextResponse } from "next/server";
import { findSymbol } from "../../../../lib/catalog";
import { matchTrendToQuote, parseCandles, parseIntraday, parseQuotes, toLongbridgeSymbol, type IntradayPoint } from "../../../../lib/longbridge-data";
import { callLongbridgeTool, COOKIE_NAME, getSession, hasLongbridgeToken, UnauthorizedError } from "../../../../lib/longbridge-mcp";

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
  const session = getSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!session || !hasLongbridgeToken(session)) return NextResponse.json({ error: "请先连接 Longbridge。" }, { status: 401 });
  let body: { symbols?: unknown; chartSymbol?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效。" }, { status: 400 }); }
  const ids = Array.isArray(body.symbols) ? [...new Set(body.symbols)].filter((id): id is string => typeof id === "string" && (Boolean(findSymbol(id)) || Boolean(toLongbridgeSymbol(id)))).slice(0, 30) : [];
  const supported = ids.filter((id) => toLongbridgeSymbol(id));
  const chartSymbol = typeof body.chartSymbol === "string" && toLongbridgeSymbol(body.chartSymbol) ? body.chartSymbol : null;
  if (!ids.length && !chartSymbol) return NextResponse.json({ error: "没有可更新的资产。" }, { status: 400 });
  try {
    const rawQuotes = supported.length ? await callLongbridgeTool(session, "quote", { symbols: supported.map((id) => toLongbridgeSymbol(id)) }) : [];
    const quotes = parseQuotes(rawQuotes, supported);
    const trendsBySymbol: Record<string, IntradayPoint[]> = {};
    if (!chartSymbol) {
      const quotedIds = supported.filter((id) => quotes[id]);
      for (let start = 0; start < quotedIds.length; start += 4) {
        await Promise.all(quotedIds.slice(start, start + 4).map(async (id) => {
          try {
            const raw = await callLongbridgeTool(session, "intraday", { symbol: toLongbridgeSymbol(id), trade_sessions: "intraday" });
            trendsBySymbol[id] = matchTrendToQuote(parseIntraday(raw), quotes[id]);
          } catch (error) {
            if (error instanceof UnauthorizedError) throw error;
            trendsBySymbol[id] = [];
          }
        }));
      }
    }
    const candlesByInterval: Record<string, ReturnType<typeof parseCandles>> = {};
    if (chartSymbol) {
      for (const [interval, period] of [["1D", "day"], ["1W", "week"], ["1M", "month"]] as const) {
        try {
          candlesByInterval[interval] = await getChartCandles(session, toLongbridgeSymbol(chartSymbol)!, period);
        } catch (error) {
          if (error instanceof UnauthorizedError) throw error;
          candlesByInterval[interval] = [];
        }
      }
    }
    return NextResponse.json({ quotes, trendsBySymbol, candlesByInterval, unsupported: ids.filter((id) => !toLongbridgeSymbol(id)), asOf: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Longbridge 授权已过期，请重新连接。" }, { status: 401 });
    return NextResponse.json({ error: "Longbridge 暂时未能返回行情，请稍后重试。" }, { status: 502 });
  }
}
