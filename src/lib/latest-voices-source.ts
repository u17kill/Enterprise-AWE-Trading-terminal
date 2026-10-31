import "server-only";
import { parseTrumpTruthFeed, parseVoiceRss, selectSummarySources, selectVoiceItems, VOICE_GROUPS, windowStart, type VoiceGroupSummary, type VoiceItem, type VoicePerson, type VoiceSnapshot } from "./latest-voices";

const translationCache = new Map<string, string>();

async function translateGroup(items: VoiceItem[], groupId: string): Promise<VoiceGroupSummary> {
  const chosen = selectSummarySources(items, groupId);
  if (!chosen.length) return { groupId, text: "最近三个月暂无足够可核对的观点，暂不形成判断。", sourceIds: [], translated: false };
  async function translateItem(item: VoiceItem): Promise<string | null> {
    const original = item.kind === "truth-social" ? `Donald Trump: ${item.title.slice(0, 165)}` : item.title.slice(0, 210);
    const saved = translationCache.get(original);
    if (saved) return saved;
    try {
      const url = new URL("https://api.mymemory.translated.net/get");
      url.searchParams.set("q", original);
      url.searchParams.set("langpair", "en|zh-CN");
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7_000) });
      if (response.ok) {
        const data = await response.json() as { responseStatus?: number; responseData?: { translatedText?: string } };
        const result = data.responseData?.translatedText?.trim();
        if (data.responseStatus === 200 && result && /[\u3400-\u9fff]/u.test(result) && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(result)) {
          translationCache.set(original, result.slice(0, 500));
          return result.slice(0, 500);
        }
      }
    } catch { /* Keep the original-language cards available. */ }
    return null;
  }
  const translated = await Promise.all(chosen.map((item) => translateItem(item)));
  const available = chosen.flatMap((item, index) => translated[index] ? [{ item, text: translated[index] as string }] : []);
  return { groupId, text: available.length ? available.map(({ text }) => text).join("；") : "中文速览暂不可用，请查看下方原文与来源。", sourceIds: available.map(({ item }) => item.id), translated: available.length > 0 };
}

async function fetchTrumpPosts(now: Date): Promise<VoiceItem[]> {
  const url = new URL("https://www.trumpstruth.org/feed");
  url.searchParams.set("start_date", windowStart(now).toISOString().slice(0, 10));
  url.searchParams.set("limit", "500");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Truth Social archive: HTTP ${response.status}`);
  const xml = await response.text();
  if (!xml.includes("<rss")) throw new Error("Truth Social archive: invalid RSS");
  return parseTrumpTruthFeed(xml, now);
}

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
  const social = await fetchTrumpPosts(now).catch(() => { missing.push("Truth Social 公开归档"); return []; });
  const items = selectVoiceItems([...results.flatMap((result) => result.status === "fulfilled" ? result.value : []), ...social]);
  const groupSummaries = await Promise.all(VOICE_GROUPS.map((group) => translateGroup(items, group.id)));
  return { asOf: now.toISOString(), windowStart: windowStart(now).toISOString(), items, groupSummaries, missing, searched: jobs.length };
}
