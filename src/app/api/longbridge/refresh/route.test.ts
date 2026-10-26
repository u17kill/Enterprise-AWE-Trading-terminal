import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
afterEach(() => vi.unstubAllGlobals());

describe("manual Longbridge refresh", () => {
  it("fills Nikkei, KOSPI and gold cards from their named public sources", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("international_major_indices")
      ? { metadata: { market_date: "2026-10-26", generated_at: new Date().toISOString() }, indices: {
        "^N225": { symbol: "^N225", country: "Japan", currency: "JPY", current_price: 62189.65, daily_change_percent: -0.8 },
        "^KS11": { symbol: "^KS11", country: "South Korea", currency: "KRW", current_price: 5469.47, daily_change_percent: -1.46 },
      } }
      : { symbol: "XAU", currency: "USD", price: 4018.8, updatedAt: "2026-10-26T15:43:44Z" } })));
    const request = new NextRequest("http://127.0.0.1:3101/api/longbridge/refresh", { method: "POST", body: JSON.stringify({ symbols: ["N225", "KOSPI", "XAUUSD"] }) });
    const response = await POST(request), body = await response.json();
    expect(response.status).toBe(200);
    expect(body.quotes.N225.value).toBe(62189.65);
    expect(body.quotes.KOSPI.value).toBe(5469.47);
    expect(body.quotes.XAUUSD.value).toBe(4018.8);
    expect(body.unsupported).toEqual([]);
  });
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
