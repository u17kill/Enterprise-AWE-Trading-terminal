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
  it("returns matching 5-minute trends and marks unmapped assets unavailable", async () => {
    callLongbridgeTool.mockImplementation(async (...args) => {
      const name = args[1];
      if (name === "quote") return [{ symbol: "AAPL.US", last_done: "347.725", prev_close: "348.22", timestamp: "2026-10-23T20:00:01Z" }];
      if (name === "candlesticks") return [
        { timestamp: "2026-10-23T13:30:00Z", close: "350.75" },
        { timestamp: "2026-10-23T19:59:00Z", close: "347.725" },
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
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "candlesticks", { symbol: "AAPL.US", period: "5m", count: 80, trade_sessions: "intraday" });
  });

  it("pages candle data so 300 bars are not truncated", async () => {
    callLongbridgeTool.mockImplementation(async (_session, name, args) => {
      if (name === "quote") return [{ symbol: ".SPX.US", last_done: "7623.68", prev_close: "7663.43", timestamp: "2026-10-23T21:03:30Z" }];
      if (name === "candlesticks") return [
        { timestamp: "2026-10-22T04:00:00Z", open: "7600", high: "7700", low: "7500", close: "7663.43", volume: "100" },
        { timestamp: "2026-10-23T04:00:00Z", open: "7637.18", high: "7660.15", low: "7612.07", close: "7623.68", volume: "120" },
      ];
      if (name === "history_candlesticks_by_offset" && args.period === "day") return [{ timestamp: "2026-10-21T04:00:00Z", open: "7736", high: "7770", low: "7709", close: "7757", volume: "90" }];
      return [];
    });
    const request = new NextRequest("http://127.0.0.1:3100/api/longbridge/refresh", { method: "POST", body: JSON.stringify({ symbols: ["SPX"], chartSymbol: "SPX" }) });
    const response = await POST(request);
    const body = await response.json();
    expect(body.candlesByInterval["1D"]).toHaveLength(3);
    expect(body.candlesByInterval["1D"].at(-1).close).toBe(body.quotes.SPX.value);
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "candlesticks", { symbol: ".SPX.US", period: "day", count: 80, trade_sessions: "intraday" });
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "history_candlesticks_by_offset", expect.objectContaining({ symbol: ".SPX.US", period: "day", count: 80 }));
  });

  it("uses the last regular-session 5-minute candles on a closed-market day", async () => {
    callLongbridgeTool.mockImplementation(async (_session, name) => {
      if (name === "quote") return [{ symbol: ".SPX.US", last_done: "7623.68", prev_close: "7663.43", timestamp: "2026-10-23T21:03:30Z" }];
      if (name === "candlesticks") return [
        { timestamp: "2026-10-23T19:50:00Z", close: "7623.71" },
        { timestamp: "2026-10-23T19:55:00Z", close: "7623.68" },
      ];
      return [];
    });
    const request = new NextRequest("http://127.0.0.1:3100/api/longbridge/refresh", { method: "POST", body: JSON.stringify({ symbols: ["SPX"] }) });
    const response = await POST(request);
    const body = await response.json();
    expect(body.trendsBySymbol.SPX).toHaveLength(2);
    expect(body.trendsBySymbol.SPX.at(-1).price).toBe(body.quotes.SPX.value);
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "candlesticks", { symbol: ".SPX.US", period: "5m", count: 80, trade_sessions: "intraday" });
  });
});
