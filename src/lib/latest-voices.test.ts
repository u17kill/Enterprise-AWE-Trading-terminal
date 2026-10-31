import { describe, expect, it } from "vitest";
import { VOICE_GROUPS, parseTrumpTruthFeed, parseVoiceRss, selectSummarySources, selectVoiceItems } from "./latest-voices";

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

  it("reads only original, market-relevant Trump posts with direct Truth Social links", () => {
    const rss = `<rss xmlns:truth="urn:truth"><channel>
      <item><title>We are reviewing tariffs on technology and trade with China this week.</title><pubDate>Sat, 31 Oct 2026 18:29:47 +0000</pubDate><truth:originalUrl>https://truthsocial.com/@realDonaldTrump/117536940868452472</truth:originalUrl></item>
      <item><title>RT @someone The stock market will be great after the election.</title><pubDate>Sat, 31 Oct 2026 18:28:42 +0000</pubDate><truth:originalUrl>https://truthsocial.com/@realDonaldTrump/117536936573653701</truth:originalUrl></item>
      <item><title>Please get out and vote for the candidates I endorsed this week.</title><pubDate>Sat, 31 Oct 2026 18:27:35 +0000</pubDate><truth:originalUrl>https://truthsocial.com/@realDonaldTrump/117536932223796834</truth:originalUrl></item>
      <item><title>Our Senator is doing an incredible job for this great state.</title><pubDate>Sat, 31 Oct 2026 18:26:35 +0000</pubDate><truth:originalUrl>https://truthsocial.com/@realDonaldTrump/117536932223796835</truth:originalUrl></item>
    </channel></rss>`;
    const items = parseTrumpTruthFeed(rss, new Date("2026-11-01T00:00:00Z"));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "truth-social", source: "Truth Social 原帖", url: "https://truthsocial.com/@realDonaldTrump/117536940868452472" });
  });

  it("selects two different speakers for each Chinese group summary", () => {
    const base = { id: "one", groupId: "macro", personId: "a", person: "A", role: "", title: "A says markets change", summary: "", source: "Source", url: "https://example.com/1", publishedAt: "2026-10-31T00:00:00Z" };
    expect(selectSummarySources([base, { ...base, id: "two" }, { ...base, id: "three", personId: "b", person: "B" }], "macro").map((item) => item.person)).toEqual(["A", "B"]);
  });
});
