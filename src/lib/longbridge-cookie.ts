import type { NextRequest } from "next/server";

export const LONG_BRIDGE_COOKIE = "awe-longbridge-session";

export function longbridgeCookieName(request: Pick<NextRequest, "nextUrl">): string {
  const { hostname, port } = request.nextUrl;
  return (hostname === "127.0.0.1" || hostname === "localhost") && port
    ? `${LONG_BRIDGE_COOKIE}-${port}`
    : LONG_BRIDGE_COOKIE;
}
