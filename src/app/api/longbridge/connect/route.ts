import { NextRequest, NextResponse } from "next/server";
import { appOrigin, beginAuthorization, MAX_AGE_SECONDS, newSession } from "../../../../lib/longbridge-mcp";
import { longbridgeCookieName } from "../../../../lib/longbridge-cookie";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const origin = appOrigin(request.headers.get("host") ?? request.nextUrl.host);
    const requested = request.nextUrl.searchParams.get("return") || "/";
    const target = new URL(requested, origin);
    const returnPath = requested.startsWith("/") && target.origin === origin ? `${target.pathname}${target.search}` : "/";
    const { id, session } = newSession(origin, returnPath);
    const authorizationUrl = await beginAuthorization(session);
    const response = NextResponse.redirect(authorizationUrl ?? new URL(returnPath, origin));
    response.cookies.set(longbridgeCookieName(request), id, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https:"), path: "/", maxAge: MAX_AGE_SECONDS });
    return response;
  } catch {
    return NextResponse.json({ error: "Longbridge 连接暂不可用，请稍后再试。" }, { status: 502 });
  }
}
