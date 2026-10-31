import "server-only";
import { parseVoiceRss, selectVoiceItems, VOICE_GROUPS, windowStart, type VoiceItem, type VoicePerson, type VoiceSnapshot } from "./latest-voices";

async function searchPerson(person: VoicePerson, groupId: string, now: Date): Promise<VoiceItem[]> {
  const query = person.aliases.find((alias) => !/\b(executives|CEO)\b/i.test(alias)) ?? person.name;
  const url = new URL("https://www.bing.com/news/search");
  url.searchParams.set("q", `"${query}"`);
  url.searchParams.set("format", "rss");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(9_000), headers: { "User-Agent": "Mozilla/5.0 (compatible; AWE-Voices/1.4; public-news-reader)" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  if (!xml.includes("<rss")) throw new Error("RSS 未返回有效内容");
  return parseVoiceRss(xml, person, groupId, now);
}

export async function fetchLatestVoices(now = new Date()): Promise<VoiceSnapshot> {
  const jobs = VOICE_GROUPS.flatMap((group) => group.people.filter((person) => !/实际发言人待核对|身份待核对/.test(person.role)).map((person) => ({ person, groupId: group.id })));
  const results: PromiseSettledResult<VoiceItem[]>[] = [];
  for (let offset = 0; offset < jobs.length; offset += 10) {
    results.push(...await Promise.allSettled(jobs.slice(offset, offset + 10).map(({ person, groupId }) => searchPerson(person, groupId, now))));
  }
  const missing = jobs.filter((_, index) => results[index].status === "rejected").map(({ person }) => person.name);
  if (missing.length === jobs.length) throw new Error("公开新闻索引暂时不可用，已保留上次成功结果。");
  return { asOf: now.toISOString(), windowStart: windowStart(now).toISOString(), items: selectVoiceItems(results.flatMap((result) => result.status === "fulfilled" ? result.value : [])), missing, searched: jobs.length };
}
