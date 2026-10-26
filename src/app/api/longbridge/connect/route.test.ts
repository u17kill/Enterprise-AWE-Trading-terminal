import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../../../../lib/longbridge-mcp", () => ({
  COOKIE_NAME: "awe-longbridge-session",
  MAX_AGE_SECONDS: 86400,
  appOrigin: (host: string) => `http://${host}`,
  beginAuthorization: async () => new URL("https://open.longbridge.com/authorize"),
  newSession: () => ({ id: "test-session", session: {} }),
}));

import { GET } from "./route";

describe("Longbridge local preview sessions", () => {
  it("uses distinct cookie names for two localhost ports", async () => {
    const first = await GET(new NextRequest("http://127.0.0.1:3100/api/longbridge/connect"));
    const second = await GET(new NextRequest("http://127.0.0.1:3101/api/longbridge/connect"));

    expect(first.status).toBe(307);
    expect(second.status).toBe(307);
    expect(first.cookies.getAll()).toHaveLength(1);
    expect(second.cookies.getAll()).toHaveLength(1);
    expect(first.cookies.getAll()[0].name).not.toBe(second.cookies.getAll()[0].name);
  });
});
