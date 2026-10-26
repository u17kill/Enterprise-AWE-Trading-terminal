import { NextRequest, NextResponse } from "next/server";
import { appOrigin, finishAuthorization, getSession } from "../../../../lib/longbridge-mcp";
import { longbridgeCookieName } from "../../../../lib/longbridge-cookie";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getSession(request.cookies.get(longbridgeCookieName(request))?.value);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!session || !code || !state || state !== session.provider.expectedState) return NextResponse.json({ error: "Longbridge 授权状态已失效，请重新连接。" }, { status: 400 });
  try {
    await finishAuthorization(session, code);
    const origin = appOrigin(request.headers.get("host") ?? request.nextUrl.host);
    return NextResponse.redirect(new URL(session.returnPath, origin));
  } catch {
    return NextResponse.json({ error: "Longbridge 授权未完成，请重新连接。" }, { status: 502 });
  }
}
