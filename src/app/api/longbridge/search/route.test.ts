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

import { GET } from "./route";

beforeEach(() => {
  callLongbridgeTool.mockReset();
  delete (globalThis as { __aweUsDirectory?: unknown }).__aweUsDirectory;
});

describe("Longbridge security search", () => {
  it("finds an exact US ticker without loading the entire directory", async () => {
    callLongbridgeTool.mockImplementation(async (_session, name) => name === "static_info"
      ? [{ symbol: "ADBE.US", name_cn: "Adobe", name_en: "Adobe Inc." }]
      : (() => { throw new Error(`unexpected tool ${name}`); })());
    const response = await GET(new NextRequest("http://127.0.0.1:3100/api/longbridge/search?q=ADBE"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toEqual([expect.objectContaining({ id: "ADBE.US", name: "Adobe" })]);
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "static_info", { symbols: ["ADBE.US"] });
    expect(callLongbridgeTool).not.toHaveBeenCalledWith(expect.anything(), "security_list", expect.anything());
  });

  it("searches paginated US securities on the server and ranks an exact ticker first", async () => {
    callLongbridgeTool.mockImplementation(async (_session, _name, args) => args?.page === 1
      ? { total: 201, items: [{ symbol: "ADBU.US", name_cn: "Direxion ADBE ETF", name_en: "Direxion ADBE ETF" }] }
      : { total: 201, items: [{ symbol: "ADBE.US", name_cn: "Adobe", name_en: "Adobe Inc." }] });
    const response = await GET(new NextRequest("http://127.0.0.1:3100/api/longbridge/search?q=Adobe"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.total).toBe(201);
    expect(body.items[0]).toMatchObject({ id: "ADBE.US", name: "Adobe", source: "longbridge" });
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "security_list", { market: "US", page: 1, count: 200 });
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "security_list", { market: "US", page: 2, count: 200 });
  });

  it("recovers a truncated directory page using smaller pages", async () => {
    callLongbridgeTool.mockImplementation(async (_session, _name, args) => {
      if (args?.page === 1) return { total: 201, items: [] };
      if (args?.count === 200) throw new SyntaxError("Truncated tool response");
      if (args?.page === 3) return { total: 201, items: [{ symbol: "ADBE.US", name_cn: "Adobe", name_en: "Adobe Inc." }] };
      return { total: 201, items: [] };
    });
    const response = await GET(new NextRequest("http://127.0.0.1:3100/api/longbridge/search?q=Adobe"));
    expect(response.status).toBe(200);
    expect((await response.json()).items[0].id).toBe("ADBE.US");
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "security_list", { market: "US", page: 3, count: 100 });
  });
});
