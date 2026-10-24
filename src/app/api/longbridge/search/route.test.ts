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

beforeEach(() => callLongbridgeTool.mockReset());

describe("Longbridge security search", () => {
  it("searches paginated US securities on the server and ranks an exact ticker first", async () => {
    callLongbridgeTool.mockImplementation(async (_session, _name, args) => args?.page === 1
      ? { total: 201, items: [{ symbol: "ADBU.US", name_cn: "Direxion ADBE ETF", name_en: "Direxion ADBE ETF" }] }
      : { total: 201, items: [{ symbol: "ADBE.US", name_cn: "Adobe", name_en: "Adobe Inc." }] });
    const response = await GET(new NextRequest("http://127.0.0.1:3100/api/longbridge/search?q=ADBE"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.total).toBe(201);
    expect(body.items[0]).toMatchObject({ id: "ADBE.US", name: "Adobe", source: "longbridge" });
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "security_list", { market: "US", page: 1, count: 200 });
    expect(callLongbridgeTool).toHaveBeenCalledWith(expect.anything(), "security_list", { market: "US", page: 2, count: 200 });
  });
});
