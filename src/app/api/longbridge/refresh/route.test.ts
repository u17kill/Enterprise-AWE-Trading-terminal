import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const callLongbridgeTool = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/longbridge-mcp", () => ({
  callLongbridgeTool,
  COOKIE_NAME: "awe-session",
  getSession: () => ({}),
  hasLongbridgeToken: () => true,
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

import { POST } from "./route";

beforeEach(() => callLongbridgeTool.mockReset());

describe("manual Longbridge refresh", () => {
  it("returns matching intraday trends and marks unmapped assets unavailable", async () => {
    callLongbridgeTool.mockImplementation(async (...args) => {
      const name = args[1];
      if (name === "quote") return [{ symbol: "AAPL.US", last_done: "347.725", prev_close: "348.22", timestamp: "2026-10-23T20:00:01Z" }];
      if (name === "intraday") return [
        { timestamp: "2026-10-23T13:30:00Z", price: "350.75" },
        { timestamp: "2026-10-23T19:59:00Z", price: "347.725" },
      ];
      if (args.length === 0) return [];
      throw new Error(`unexpected tool ${name}`);
    });
    const request = new NextRequest("http://127.0.0.1:3100/api/longbridge/refresh", {
      method: "POST", body: JSON.stringify({ symbols: ["AAPL", "XAUUSD"] }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(callLongbridgeTool.mock.calls).toEqual(expect.arrayContaining([[expect.anything(), "quote", { symbols: ["AAPL.US"] }]]));
    expect(response.status).toBe(200);
    expect(body.quotes.AAPL.value).toBe(347.725);
    expect(body.trendsBySymbol.AAPL).toHaveLength(2);
    expect(body.trendsBySymbol.AAPL.at(-1).price).toBe(body.quotes.AAPL.value);
    expect(body.unsupported).toEqual(["XAUUSD"]);
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "intraday", { symbol: "AAPL.US", trade_sessions: "intraday" });
  });
});
