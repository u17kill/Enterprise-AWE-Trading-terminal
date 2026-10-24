import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getSession, hasLongbridgeToken } from "../../../../lib/longbridge-mcp";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getSession(request.cookies.get(COOKIE_NAME)?.value);
  return NextResponse.json({ connected: hasLongbridgeToken(session) }, { headers: { "Cache-Control": "no-store" } });
}
