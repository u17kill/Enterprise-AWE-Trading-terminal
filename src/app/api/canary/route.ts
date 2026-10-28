import { NextRequest, NextResponse } from "next/server";
import { collectCanary } from "../../../lib/canary-source";
import { longbridgeCookieName } from "../../../lib/longbridge-cookie";
import { getSession, hasLongbridgeToken } from "../../../lib/longbridge-mcp";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = getSession(request.cookies.get(longbridgeCookieName(request))?.value);
  const snapshot = await collectCanary(hasLongbridgeToken(session) ? session : null);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
