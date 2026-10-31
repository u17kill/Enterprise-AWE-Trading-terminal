import { describe, expect, it } from "vitest";
import { VOICE_GROUPS, parseVoiceRss, selectVoiceItems } from "./latest-voices";

describe("latest voices", () => {
  it("tracks Gavin Baker under technology investors", () => {
    expect(VOICE_GROUPS.find((group) => group.id === "tech-investors")?.people.some((person) => person.name === "Gavin Baker" && person.role.includes("Atreides"))).toBe(true);
  });

  it("keeps only recent, attributable items with a publisher URL and summary", () => {
    const rss = `<rss xmlns:News="urn:news"><channel>
      <item><title>Gavin Baker says AI infrastructure spending is changing</title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fwww.cnbc.com%2Finterview</link><description>Gavin Baker said companies were revising their AI infrastructure plans in an interview.</description><pubDate>Fri, 23 Oct 2026 12:00:00 GMT</pubDate><News:Source>Example News</News:Source></item>
      <item><title>Gavin Baker portfolio holdings</title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.com%2Fholdings</link><description>Latest holdings report.</description><pubDate>Fri, 23 Oct 2026 12:00:00 GMT</pubDate></item>
      <item><title>Gavin Baker says old news</title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.com%2Fold</link><description>Gavin Baker said old news.</description><pubDate>Fri, 01 May 2026 12:00:00 GMT</pubDate></item>
      <item><title>Gavin Baker's fund warns of market trouble</title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fwww.cnbc.com%2Fother</link><description>Atreides warns of market trouble; Baker was not quoted.</description><pubDate>Fri, 23 Oct 2026 12:00:00 GMT</pubDate></item>
    </channel></rss>`;
    const person = VOICE_GROUPS.find((group) => group.id === "tech-investors")!.people.find((item) => item.name === "Gavin Baker")!;
    const parsed = parseVoiceRss(rss, person, "tech-investors", new Date("2026-11-01T00:00:00Z"));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].url).toBe("https://www.cnbc.com/interview");
    expect(parsed[0].source).toBe("Example News");
  });

  it("deduplicates equivalent stories", () => {
    const item = { id: "a", groupId: "macro", personId: "x", person: "X", role: "", title: "X says markets are changing", summary: "X said markets are changing.", source: "Source", url: "https://example.com/story", publishedAt: "2026-10-23T00:00:00.000Z" };
    expect(selectVoiceItems([item, { ...item, id: "b" }])).toHaveLength(1);
  });
});
