import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getSession, hasLongbridgeToken } from "../../../lib/longbridge-mcp";
import { collectMarketHealth } from "../../../lib/market-health-source";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = getSession(request.cookies.get(COOKIE_NAME)?.value);
  const snapshot = await collectMarketHealth(hasLongbridgeToken(session) ? session : null);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
