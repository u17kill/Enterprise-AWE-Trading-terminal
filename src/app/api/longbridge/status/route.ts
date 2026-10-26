import { NextRequest, NextResponse } from "next/server";
import { getSession, hasLongbridgeToken } from "../../../../lib/longbridge-mcp";
import { longbridgeCookieName } from "../../../../lib/longbridge-cookie";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getSession(request.cookies.get(longbridgeCookieName(request))?.value);
  return NextResponse.json({ connected: hasLongbridgeToken(session) }, { headers: { "Cache-Control": "no-store" } });
}
