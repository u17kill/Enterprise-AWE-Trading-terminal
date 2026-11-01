import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const callLongbridgeTool = vi.hoisted(() => vi.fn());
const hasLongbridgeToken = vi.hoisted(() => vi.fn(() => false));
vi.mock("../../../../lib/longbridge-cookie", () => ({ longbridgeCookieName: () => "awe-session" }));
vi.mock("../../../../lib/longbridge-mcp", () => ({ getSession: () => ({}), hasLongbridgeToken, callLongbridgeTool }));
import { POST } from "./route";

const request = () => new NextRequest("http://127.0.0.1:3101/api/canary-v15/asia", { method: "POST" });
const bars = [{ timestamp: "2026-10-26T04:00:00Z", close: "100" }, { timestamp: "2026-10-27T04:00:00Z", close: "101" }];
beforeEach(() => { callLongbridgeTool.mockReset(); hasLongbridgeToken.mockReturnValue(false); });

describe("V1.5 Asia observation API", () => {
  it("requires the existing Longbridge authorization", async () => {
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(callLongbridgeTool).not.toHaveBeenCalled();
  });
  it("returns independently sourced USD ETF proxy readings without caching", async () => {
    hasLongbridgeToken.mockReturnValue(true);
    callLongbridgeTool.mockResolvedValue(bars);
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.readings["EWS.US"]).toMatchObject({ kind: "us_etf_proxy", asOf: "2026-10-27", close: 101 });
    expect(body.readings["INDA.US"]).toMatchObject({ market: "印度", currency: "USD" });
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "candlesticks", { symbol: "EWS.US", period: "day", count: 100, trade_sessions: "intraday" });
  });
  it("keeps the successful market when another source fails", async () => {
    hasLongbridgeToken.mockReturnValue(true);
    callLongbridgeTool.mockImplementation(async (_session, _name, args) => args.symbol === "EWS.US" ? bars : Promise.reject(new Error("source unavailable")));
    const body = await (await POST(request())).json();
    expect(body.readings["EWS.US"].close).toBe(101);
    expect(body.readings["INDA.US"]).toBeUndefined();
    expect(body.errors["INDA.US"]).toContain("获取失败");
  });
});
