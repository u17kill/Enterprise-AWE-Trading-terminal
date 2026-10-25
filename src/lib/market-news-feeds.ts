import "server-only";

import { parseRssFeed, type NewsCandidate, type NewsCategory } from "./market-news";

type Feed = { label: string; category: NewsCategory; query: string };
const FEEDS: Feed[] = [
  { label: "地缘新闻", category: "geopolitics", query: '(Ukraine OR Iran OR "US China" OR NATO OR sanctions OR geopolitical)' },
  { label: "宏观新闻", category: "macro", query: '("Federal Reserve" OR PBOC OR inflation OR tariffs OR GDP OR central bank)' },
  { label: "AI 新闻", category: "ai", query: '("artificial intelligence" OR Nvidia OR OpenAI OR semiconductor OR robotics)' },
  { label: "产业新闻", category: "industry", query: '(earnings OR merger OR "drug approval" OR energy OR automaker)' },
  { label: "新浪财经", category: "industry", query: 'site:finance.sina.com.cn (财经 OR 科技 OR 产业 OR 国际)' },
  { label: "Reuters", category: "industry", query: 'site:reuters.com (markets OR technology OR world)' },
  { label: "Bloomberg", category: "industry", query: 'site:bloomberg.com (markets OR technology OR world)' },
  { label: "The Wall Street Journal", category: "industry", query: 'site:wsj.com (markets OR technology OR world)' },
];

async function getRss(feed: Feed, days: 3 | 5 | 7): Promise<NewsCandidate[]> {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${feed.query} when:${days}d`);
  url.searchParams.set("hl", feed.label === "新浪财经" ? "zh-CN" : "en-US");
  url.searchParams.set("gl", feed.label === "新浪财经" ? "CN" : "US");
  url.searchParams.set("ceid", feed.label === "新浪财经" ? "CN:zh-Hans" : "US:en");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Enterprise-AWE-Trading-Terminal/0.6 (market news reader)" } });
  if (!response.ok) throw new Error(`${feed.label}: HTTP ${response.status}`);
  return parseRssFeed(await response.text(), feed.category);
}

async function getGdelt(days: 3 | 5 | 7): Promise<NewsCandidate[]> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", '("central bank" OR "artificial intelligence" OR sanctions OR earnings)');
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", `${days}d`);
  url.searchParams.set("maxrecords", "75");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`GDELT: HTTP ${response.status}`);
  const data = await response.json() as { articles?: { title?: string; url?: string; seendate?: string; domain?: string }[] };
  return (data.articles ?? []).map((item) => ({ title: item.title ?? "", url: item.url ?? "", source: item.domain ?? "GDELT", publishedAt: item.seendate ? item.seendate.replace(/^([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})([0-9]{2})Z$/, "$1-$2-$3T$4:$5:$6Z") : "", category: "industry" as const, summary: "" }));
}

export async function fetchPublicNews(days: 3 | 5 | 7): Promise<{ candidates: NewsCandidate[]; missing: string[] }> {
  const jobs: { label: string; run: () => Promise<NewsCandidate[]> }[] = FEEDS.map((feed) => ({ label: feed.label, run: () => getRss(feed, days) }));
  if (process.env.AWE_NEWS_GDELT === "1") jobs.push({ label: "GDELT", run: () => getGdelt(days) });
  const results: PromiseSettledResult<NewsCandidate[]>[] = [];
  for (let index = 0; index < jobs.length; index += 4) results.push(...await Promise.allSettled(jobs.slice(index, index + 4).map((job) => job.run())));
  return { candidates: results.flatMap((result) => result.status === "fulfilled" ? result.value : []), missing: jobs.filter((_, index) => results[index].status === "rejected").map((job) => job.label) };
}
