import { describe, expect, it } from "vitest";
import { parseRssFeed, selectMarketNews, type NewsCandidate } from "./market-news";

const now = new Date("2026-10-25T00:00:00Z");
const candidate = (title: string, overrides: Partial<NewsCandidate> = {}): NewsCandidate => ({ title, url: `https://example.com/${encodeURIComponent(title)}`, source: "AP News", publishedAt: "2026-10-24T12:00:00Z", category: "industry", summary: "", ...overrides });

describe("market news normalization", () => {
  it("parses Google RSS metadata without treating its related-link HTML as a summary", () => {
    const xml = `<rss><channel><item><title>Major AI product launch - Reuters</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Sat, 24 Oct 2026 08:00:00 GMT</pubDate><source url="https://www.reuters.com">Reuters</source><description><![CDATA[<a href="https://news.google.com/rss/articles/abc">Major AI product launch - Reuters</a>]]></description></item></channel></rss>`;
    expect(parseRssFeed(xml, "ai")).toEqual([expect.objectContaining({ title: "Major AI product launch", source: "Reuters", category: "ai", summary: "", publishedAt: "2026-10-24T08:00:00.000Z" })]);
  });
  it("rejects stale dates and unsafe or missing links", () => {
    const selected = selectMarketNews([candidate("valid"), candidate("old", { publishedAt: "2026-10-01T00:00:00Z" }), candidate("bad", { url: "javascript:alert(1)" }), candidate("unknown", { publishedAt: "" })], 3, now);
    expect(selected.items.map((item) => item.title)).toEqual(["valid"]);
  });
  it("deduplicates repeated titles and gives event importance priority over publisher", () => {
    const selected = selectMarketNews([
      candidate("How to buy stock today", { source: "Reuters" }),
      candidate("Central bank emergency rate decision", { source: "AP News" }),
      candidate("Central bank emergency rate decision", { source: "Reuters", url: "https://reuters.com/decision" }),
    ], 3, now);
    expect(selected.items).toHaveLength(1);
    expect(selected.items[0].title).toBe("Central bank emergency rate decision");
    expect(selected.items[0].source).toBe("Reuters");
  });
  it("assigns categories from headlines and caps each category at twenty", () => {
    const selected = selectMarketNews(Array.from({ length: 24 }, (_, index) => candidate(`AI model launch ${index}`)), 3, now);
    expect(selected.items).toHaveLength(20);
    expect(selected.items.every((item) => item.category === "ai")).toBe(true);
    expect(selected.highlights.length).toBeLessThanOrEqual(5);
  });
  it("keeps routine earnings commentary out of a global headline briefing", () => {
    const selected = selectMarketNews([
      candidate("Small Firm (Q3 2026) Earnings Call Highlights: Record Revenue", { source: "Yahoo Finance" }),
      candidate("Microsoft announces acquisition of major AI infrastructure provider", { source: "Reuters" }),
    ], 3, now);
    expect(selected.items.map((item) => item.title)).toEqual(["Microsoft announces acquisition of major AI infrastructure provider"]);
  });
  it("spreads global focus across categories", () => {
    const selected = selectMarketNews([
      candidate("Ukraine ceasefire agreement announced", { category: "geopolitics" }),
      candidate("Federal Reserve emergency rate cut", { category: "macro" }),
      candidate("OpenAI launches new AI model", { category: "ai" }),
      candidate("Toyota recalls vehicles worldwide", { category: "industry" }),
      ...Array.from({ length: 5 }, (_, index) => candidate(`Nvidia launches new AI chip ${index}`, { category: "ai" })),
    ], 3, now);
    expect(new Set(selected.highlights.map((item) => item.category)).size).toBe(4);
  });
  it("excludes unsupported outlets and speculative investment commentary", () => {
    const selected = selectMarketNews([
      candidate("Tesla SpaceX merger would be a great deal", { source: "Seeking Alpha" }),
      candidate("Russia and Ukraine agree ceasefire", { source: "Reuters" }),
      candidate("Gunman kills one near Paris in suspected attack", { source: "WSJ" }),
    ], 3, now);
    expect(selected.items.map((item) => item.title)).not.toContain("Tesla SpaceX merger would be a great deal");
    expect(selected.items.find((item) => item.title.startsWith("Gunman"))?.category).toBe("geopolitics");
  });
  it("keeps personal crime and niche deal speculation out of the market briefing", () => {
    const selected = selectMarketNews([
      candidate("OpenAI CEO home struck by gunfire", { source: "ABC News" }),
      candidate("Weil law firm merger talks collapse", { source: "WSJ" }),
      candidate("Tesla SpaceX merger would formalize partnership", { source: "WSJ" }),
      candidate("AIGC 产业行动计划发布", { source: "新浪财经" }),
    ], 3, now);
    expect(selected.items.map((item) => item.title)).toEqual(["AIGC 产业行动计划发布"]);
    expect(selected.items[0].category).toBe("ai");
  });
});
