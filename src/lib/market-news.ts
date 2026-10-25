import { XMLParser } from "fast-xml-parser";

export type NewsCategory = "geopolitics" | "macro" | "ai" | "industry";
export type NewsCandidate = { title: string; url: string; source: string; publishedAt: string; category: NewsCategory; summary: string };
export type NewsItem = NewsCandidate & { id: string; importance: number };
export type NewsSelection = { items: NewsItem[]; highlights: NewsItem[] };
export type NewsSnapshot = NewsSelection & { asOf: string; days: 3 | 5 | 7; partial: boolean; missing: string[] };

const preferredSources = /^(reuters|bloomberg(?:\.com)?|WSJ|the wall street journal|wall street journal|新浪财经)$/i;
const TRUSTED_SOURCE = /reuters|bloomberg|\bWSJ\b|wall street journal|新浪财经|AP News|associated press|the guardian|BBC|CNBC|financial times|nikkei|techcrunch|new york times|ABC News|axios|washington post|politico|south china morning post|caixin|财新|第一财经|新华网|彭博|华尔街日报|路透/i;
const CATEGORY_TERMS: { category: NewsCategory; pattern: RegExp }[] = [
  { category: "geopolitics", pattern: /\b(war|conflict|sanction|summit|diplomacy|military|NATO|Ukraine|Iran|Taiwan Strait|gunman|attack|terrorist|protest|election|ceasefire|Pentagon)\b|战争|冲突|制裁|峰会|外交|军事|俄乌|美伊|中美关系|袭击|恐袭|抗议|选举|停火/i },
  { category: "ai", pattern: /\b(AI|AIGC|artificial intelligence|LLM|ChatGPT|OpenAI|Nvidia|semiconductor|chip|robotics)\b|人工智能|大模型|英伟达|芯片|半导体|机器人/i },
  { category: "macro", pattern: /\b(Fed|FOMC|central bank|inflation|interest rate|GDP|tariff|Treasury|unemployment|CPI|PBOC)\b|央行|通胀|利率|关税|就业|经济数据|财政|降息|加息/i },
];
const IMPORTANT = /\b(emergency|decision|agreement|ban|sanction|attack|war|ceasefire|rate cut|rate hike|launch|merger|acquisition|regulation|tariff|recall)\b|紧急|决定|协议|禁令|制裁|袭击|战争|停火|降息|加息|发布|并购|监管|关税|召回|突破/gi;
const LOW_SIGNAL = /\b(how to|should you buy|best stocks|price target|stock to buy|prediction|investor guide|could be a millionaire|stock price|investment story|stock may|how investors|earnings call highlights|earnings quality|what to expect|SA Asks|how much could|reasons this|would be a great deal|still undervalued|may respond)\b|值得买|买入时机|目标价|一文看懂|投资指南|业绩点评|研报/i;
const OFF_TOPIC = /\b(CEO home|home struck by gunfire|law firm merger|merger would|merger talks|merger narrative)\b/i;
const MAJOR_COMPANY = /\b(Microsoft|Apple|Amazon|Meta|Alphabet|Google|Tesla|Nvidia|OpenAI|TSMC|Samsung|Toyota|Sony|Tencent|Alibaba|BYD|Berkshire|JPMorgan|Novo Nordisk|Eli Lilly|ASML|Netflix|Intel|AMD|Visa|Exxon|Shell|Saudi Aramco)\b|微软|苹果|亚马逊|谷歌|英伟达|台积电|三星|丰田|索尼|腾讯|阿里巴巴|比亚迪|特斯拉|伯克希尔|礼来|诺和诺德/i;

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) return textValue((value as { "#text": unknown })["#text"]);
  return "";
}

function cleanText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, (entity) => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[entity.toLowerCase()] ?? entity).replace(/\s+/g, " ").trim();
}

export function parseRssFeed(xml: string, category: NewsCategory): NewsCandidate[] {
  const parsed = new XMLParser({ ignoreAttributes: false, trimValues: true, processEntities: true }).parse(xml) as { rss?: { channel?: { item?: unknown } } };
  const raw = parsed.rss?.channel?.item;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return entries.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const source = textValue(item.source) || "新闻来源";
    const headline = cleanText(textValue(item.title)).replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "").trim();
    const description = textValue(item.description);
    const summary = /<a\b/i.test(description) ? "" : cleanText(description);
    const date = Date.parse(textValue(item.pubDate));
    return [{ title: headline, url: textValue(item.link), source, publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : "", category, summary: summary && summary.toLowerCase() !== headline.toLowerCase() ? summary.slice(0, 360) : "" }];
  });
}

function inferCategory(title: string, fallback: NewsCategory): NewsCategory {
  return CATEGORY_TERMS.find(({ pattern }) => pattern.test(title))?.category ?? fallback;
}

function importance(item: NewsCandidate, now: Date): number {
  const matches = item.title.match(IMPORTANT)?.length ?? 0;
  const ageDays = Math.max(0, (now.getTime() - Date.parse(item.publishedAt)) / 86_400_000);
  return Math.min(matches, 3) * 8 + Math.max(0, 3 - ageDays) + (MAJOR_COMPANY.test(item.title) ? 4 : 0) + (preferredSources.test(item.source) ? 1 : 0);
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 120);
}

export function selectMarketNews(candidates: NewsCandidate[], days: 3 | 5 | 7, now = new Date()): NewsSelection {
  const valid = candidates.flatMap((candidate) => {
    const published = Date.parse(candidate.publishedAt);
    let url: URL;
    try { url = new URL(candidate.url); } catch { return []; }
    if (url.protocol !== "https:" || !candidate.title.trim() || !TRUSTED_SOURCE.test(candidate.source) || LOW_SIGNAL.test(candidate.title) || OFF_TOPIC.test(candidate.title) || !Number.isFinite(published) || published > now.getTime() + 3_600_000 || published < now.getTime() - days * 86_400_000) return [];
    const category = inferCategory(candidate.title, candidate.category);
    const item: NewsItem = { ...candidate, title: candidate.title.trim(), category, id: `${titleKey(candidate.title)}:${published}`, importance: importance(candidate, now) };
    return [item];
  });
  const unique = new Map<string, NewsItem>();
  for (const item of valid) {
    const key = titleKey(item.title);
    const prior = unique.get(key);
    if (!prior || item.importance > prior.importance || (item.importance === prior.importance && item.summary.length > prior.summary.length)) unique.set(key, item);
  }
  const sorted = [...unique.values()].sort((a, b) => b.importance - a.importance || b.publishedAt.localeCompare(a.publishedAt));
  const counts: Record<NewsCategory, number> = { geopolitics: 0, macro: 0, ai: 0, industry: 0 };
  const items = sorted.filter((item) => ++counts[item.category] <= 20);
  const firstFromEach = (["geopolitics", "macro", "ai", "industry"] as const).map((category) => items.find((item) => item.category === category)).filter((item): item is NewsItem => Boolean(item));
  const highlights = [...firstFromEach, ...items.filter((item) => !firstFromEach.includes(item))].slice(0, 5).sort((a, b) => b.importance - a.importance);
  return { items, highlights };
}
