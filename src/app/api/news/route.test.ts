import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fetchPublicNews = vi.hoisted(() => vi.fn());
const hasLongbridgeToken = vi.hoisted(() => vi.fn(() => false));
const callLongbridgeTool = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/market-news-feeds", () => ({ fetchPublicNews }));
vi.mock("../../../lib/longbridge-mcp", () => ({ COOKIE_NAME: "awe-session", getSession: () => ({}), hasLongbridgeToken, callLongbridgeTool }));
import { GET } from "./route";

beforeEach(() => { fetchPublicNews.mockReset(); callLongbridgeTool.mockReset(); hasLongbridgeToken.mockReturnValue(false); });

describe("market news API", () => {
  it("rejects unsupported time windows", async () => {
    const response = await GET(new NextRequest("http://127.0.0.1:3100/api/news?days=30"));
    expect(response.status).toBe(400);
    expect(fetchPublicNews).not.toHaveBeenCalled();
  });
  it("returns sourced ranked stories and partial-source status", async () => {
    fetchPublicNews.mockResolvedValue({ candidates: [{ title: "Central bank emergency rate decision", url: "https://example.com/story", source: "Reuters", publishedAt: new Date().toISOString(), category: "macro", summary: "A published decision." }], missing: ["GDELT"] });
    const response = await GET(new NextRequest("http://127.0.0.1:3100/api/news?days=3"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.items).toEqual([expect.objectContaining({ source: "Reuters", category: "macro" })]);
    expect(body.partial).toBe(true);
    expect(body.missing).toContain("GDELT");
  });
  it("reports failure when all news sources fail", async () => {
    fetchPublicNews.mockResolvedValue({ candidates: [], missing: ["Google News RSS"] });
    const response = await GET(new NextRequest("http://127.0.0.1:3100/api/news?days=5"));
    expect(response.status).toBe(502);
  });
  it("returns public articles if a connected Longbridge search stalls", async () => {
    vi.useFakeTimers();
    try {
      hasLongbridgeToken.mockReturnValue(true);
      fetchPublicNews.mockResolvedValue({ candidates: [{ title: "Federal Reserve emergency decision", url: "https://example.com/story", source: "Reuters", publishedAt: new Date().toISOString(), category: "macro", summary: "" }], missing: [] });
      callLongbridgeTool.mockImplementation(() => new Promise(() => {}));
      const pending = GET(new NextRequest("http://127.0.0.1:3100/api/news?days=3"));
      await vi.advanceTimersByTimeAsync(9_000);
      const response = await pending;
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.partial).toBe(true);
      expect(body.items).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });
});
