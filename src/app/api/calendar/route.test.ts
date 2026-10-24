import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const callLongbridgeTool = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/longbridge-mcp", () => ({ callLongbridgeTool, COOKIE_NAME: "awe-session", getSession: () => ({}), hasLongbridgeToken: () => true, UnauthorizedError: class UnauthorizedError extends Error {} }));
import { GET } from "./route";

beforeEach(() => callLongbridgeTool.mockReset());

describe("calendar API", () => {
  it("rejects invalid months before calling the data source", async () => {
    const response = await GET(new NextRequest("http://127.0.0.1:3100/api/calendar?month=2026-13"));
    expect(response.status).toBe(400);
    expect(callLongbridgeTool).not.toHaveBeenCalled();
  });
  it("returns filtered provider events and labels partial failures", async () => {
    const next = new Date();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const month = next.toISOString().slice(0, 7);
    const eventDate = `${month}-06`;
    const start = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), 0)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    callLongbridgeTool.mockImplementation(async (_session, _name, args) => {
      if (!args) return { list: [] };
      if (args.market === "JP") throw new Error("unavailable");
      return args.category === "report" ? { list: [{ date: eventDate, infos: [{ id: "msft", symbol: "MSFT.US", counter_name: "微软", content: "财报" }] }] } : { list: [] };
    });
    const response = await GET(new NextRequest(`http://127.0.0.1:3100/api/calendar?month=${month}`));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.partial).toBe(true);
    expect(body.missing).toContain("JP report");
    expect(body.events).toEqual(expect.arrayContaining([expect.objectContaining({ title: "微软 财报", start: eventDate })]));
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "finance_calendar", expect.objectContaining({ category: "macrodata", market: "US", start, end }));
    expect(callLongbridgeTool.mock.calls.filter((call) => call[2]?.category === "report" && call[2]?.market === "US").length).toBeGreaterThan(1);
  });
  it("collects earnings in short windows when a full-month provider query omits them", async () => {
    const first = new Date();
    first.setUTCDate(1);
    first.setUTCMonth(first.getUTCMonth() + 1);
    const month = first.toISOString().slice(0, 7);
    const target = `${month}-10`;
    callLongbridgeTool.mockImplementation(async (_session, _name, args) => {
      if (!args || args.category !== "report" || args.market !== "US") return { list: [] };
      const span = (Date.parse(`${args.end}T00:00:00Z`) - Date.parse(`${args.start}T00:00:00Z`)) / 86_400_000;
      if (span > 6 || args.start > target || args.end < target) return { list: [] };
      return { list: [{ date: target, infos: [{ id: "apple", symbol: "AAPL.US", counter_name: "苹果", content: "季度业绩" }] }] };
    });
    const response = await GET(new NextRequest(`http://127.0.0.1:3100/api/calendar?month=${month}`));
    const body = await response.json();
    expect(body.events).toEqual(expect.arrayContaining([expect.objectContaining({ symbol: "AAPL.US", start: target })]));
    expect(callLongbridgeTool.mock.calls.filter((call) => call[2]?.category === "report" && call[2]?.market === "US").length).toBeGreaterThan(1);
  });
});
