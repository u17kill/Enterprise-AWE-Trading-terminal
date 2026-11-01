import { NextRequest, NextResponse } from "next/server";
import { longbridgeCookieName } from "../../../../lib/longbridge-cookie";
import { callLongbridgeTool, getSession, hasLongbridgeToken } from "../../../../lib/longbridge-mcp";
import { buildAsiaObservation, type AsiaObservation, type AsiaProxySymbol } from "../../../../lib/v15-asia-observation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = getSession(request.cookies.get(longbridgeCookieName(request))?.value);
  const headers = { "Cache-Control": "no-store" };
  if (!session || !hasLongbridgeToken(session)) return NextResponse.json({ readings: {}, errors: {}, connected: false }, { status: 401, headers });

  const readings: Partial<Record<AsiaProxySymbol, AsiaObservation>> = {};
  const errors: Partial<Record<AsiaProxySymbol, string>> = {};
  for (const symbol of ["EWS.US", "INDA.US"] as const) {
    try {
      const bars = await callLongbridgeTool(session, "candlesticks", { symbol, period: "day", count: 100, trade_sessions: "intraday" });
      readings[symbol] = buildAsiaObservation(symbol, bars);
    } catch {
      errors[symbol] = `${symbol} 获取失败；请稍后重试`;
    }
  }
  return NextResponse.json({ readings, errors, connected: true, refreshedAt: new Date().toISOString() }, { status: Object.keys(readings).length ? 200 : 502, headers });
}
