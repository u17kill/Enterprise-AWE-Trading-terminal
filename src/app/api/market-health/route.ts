import { NextRequest, NextResponse } from "next/server";
import { getSession, hasLongbridgeToken } from "../../../lib/longbridge-mcp";
import { longbridgeCookieName } from "../../../lib/longbridge-cookie";
import { collectMarketHealth } from "../../../lib/market-health-source";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = getSession(request.cookies.get(longbridgeCookieName(request))?.value);
  const snapshot = await collectMarketHealth(hasLongbridgeToken(session) ? session : null);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
