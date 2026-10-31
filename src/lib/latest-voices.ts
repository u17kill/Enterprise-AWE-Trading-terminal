import { XMLParser } from "fast-xml-parser";

export type VoicePerson = { id: string; name: string; role: string; aliases: string[] };
export type VoiceGroup = { id: string; title: string; description: string; people: VoicePerson[] };
export type VoiceItem = { id: string; groupId: string; personId: string; person: string; role: string; title: string; summary: string; source: string; url: string; publishedAt: string };
export type VoiceSnapshot = { asOf: string; windowStart: string; items: VoiceItem[]; missing: string[]; searched: number };

const person = (name: string, role: string, ...aliases: string[]): VoicePerson => ({ id: name.toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, "-"), name, role, aliases: [name, ...aliases] });

export const VOICE_GROUPS: VoiceGroup[] = [
  { id: "macro", title: "宏观大师", description: "全球流动性、周期与风险判断", people: [person("Stanley Druckenmiller", "Duquesne Family Office"), person("Jamie Dimon", "JPMorgan Chase"), person("Paul Tudor Jones", "Tudor Investment"), person("Ken Griffin", "Citadel")] },
  { id: "value", title: "价值投资", description: "企业价值、资本配置与长期回报", people: [person("段永平", "H&H / 价值投资", "Duan Yongping"), person("Greg Abel", "Berkshire Hathaway"), person("李录", "Himalaya Capital", "Li Lu Himalaya"), person("Howard Marks", "Oaktree Capital")] },
  { id: "tech-investors", title: "科技投资人", description: "AI、科技周期与成长资本", people: [person("孙正义", "SoftBank", "Masayoshi Son"), person("Cathie Wood", "ARK Invest"), person("Tom Lee", "Fundstrat"), person("Stephen Schwarzman", "Blackstone"), person("Chase Coleman", "Tiger Global"), person("Philippe Laffont", "Coatue Management"), person("Brad Gerstner", "Altimeter Capital"), person("Gavin Baker", "Atreides Management · CIO")] },
  { id: "tech-leaders", title: "科技公司负责人", description: "平台、算力、芯片与应用", people: [person("Elon Musk", "Tesla / xAI"), person("Sundar Pichai", "Alphabet"), person("Satya Nadella", "Microsoft"), person("Andy Jassy", "Amazon"), person("Safra Catz", "Oracle"), person("Mark Zuckerberg", "Meta"), person("Tim Cook", "Apple"), person("Sam Altman", "OpenAI"), person("Dario Amodei", "Anthropic"), person("Sanjay Mehrotra", "Micron"), person("Jensen Huang", "NVIDIA"), person("陈志武", "身份待核对", "Chen Zhiwu"), person("Lisa Su", "AMD"), person("Hock Tan", "Broadcom"), person("Lumentum CEO", "Lumentum · 实际发言人待核对"), person("Coherent CEO", "Coherent · 实际发言人待核对"), person("SK hynix executives", "SK hynix · 实际发言人待核对"), person("Samsung executives", "Samsung · 实际发言人待核对"), person("Alibaba executives", "阿里巴巴 · 实际发言人待核对"), person("Tencent executives", "腾讯 · 实际发言人待核对"), person("ByteDance executives", "字节跳动 · 实际发言人待核对"), person("梁文锋", "DeepSeek", "Liang Wenfeng"), person("王兴兴", "宇树科技", "Wang Xingxing")] },
  { id: "central-banks", title: "央行委员", description: "利率、通胀与政策路径", people: [person("Kevin Warsh", "美联储主席"), person("Philip Jefferson", "美联储理事"), person("Michelle Bowman", "美联储理事"), person("Michael Barr", "美联储理事"), person("Lisa Cook", "美联储理事"), person("Jerome Powell", "美联储理事"), person("Christopher Waller", "美联储理事"), person("Kazuo Ueda", "日本央行"), person("潘功胜", "中国人民银行", "Pan Gongsheng"), person("Christine Lagarde", "欧洲央行"), person("Andrew Bailey", "英格兰银行")] },
  { id: "government", title: "政府首脑与关键官员", description: "财政、贸易与地缘政策", people: [person("Donald Trump", "美国政府"), person("Scott Bessent", "美国财政部"), person("习近平", "中国政府", "Xi Jinping"), person("李强", "中国政府", "Li Qiang")] },
];

const parser = new XMLParser({ ignoreAttributes: false, processEntities: true, trimValues: true });
const VIEW_VERB = /\b(says?|said|warns?|warned|argues?|argued|predicts?|predicted|expects?|expected|sees?|told|tells|speaks?|speaking|remarks?|interview|calls? for|believes?|believed|announces?|announced|discusses?|discussed)\b|表示|称|认为|指出|警告|谈到|回应|接受采访|发表讲话|预计|强调|呼吁/iu;
const ATTRIBUTION_VERB = /^(?:.{0,55}?\b(?:says?|said|warns?|warned|argues?|argued|predicts?|predicted|expects?|expected|sees?|told|tells|speaks?|remarks?|interviewed|believes?|believed|announces?|announced|discusses?|discussed|thinks?|suggests?)\b|.{0,45}?(?:表示|称|认为|指出|警告|谈到|回应|接受采访|发表讲话|预计|强调|呼吁))/iu;
const TRUSTED_HOSTS = ["reuters.com", "bloomberg.com", "wsj.com", "cnbc.com", "ft.com", "apnews.com", "nytimes.com", "fortune.com", "businessinsider.com", "forbes.com", "marketwatch.com", "yahoo.com", "msn.com", "scmp.com", "nikkei.com", "newsweek.com", "sina.com.cn", "caixin.com", "thepaper.cn", "federalreserve.gov", "ecb.europa.eu", "boj.or.jp", "gov.cn", "prnewswire.com", "businesswire.com", "note.com"];

function publisherUrl(raw: string): string | null {
  try {
    const link = new URL(raw);
    const target = link.hostname.endsWith("bing.com") ? link.searchParams.get("url") : raw;
    if (!target) return null;
    const url = new URL(target);
    return url.protocol === "https:" && !/\b(bing|google)\.com$/.test(url.hostname) ? url.href : null;
  } catch { return null; }
}

function text(value: unknown): string { return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : ""; }

export function windowStart(now: Date): Date { const start = new Date(now); start.setUTCMonth(start.getUTCMonth() - 3); return start; }

export function parseVoiceRss(xml: string, tracked: VoicePerson, groupId: string, now = new Date()): VoiceItem[] {
  const parsed = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
  const entries = parsed.rss?.channel?.item;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
  const start = windowStart(now).getTime();
  return list.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const title = text(row.title);
    const summary = text(row.description);
    const published = new Date(text(row.pubDate));
    const url = publisherUrl(text(row.link));
    const alias = tracked.aliases.find((name) => !/\b(executives|CEO)\b/i.test(name) && title.toLowerCase().includes(name.toLowerCase()));
    const afterName = alias ? title.slice(title.toLowerCase().indexOf(alias.toLowerCase()) + alias.length) : "";
    const titleAttribution = !!alias && !/^(?:['’]s|\s+of\b)/i.test(afterName) && ATTRIBUTION_VERB.test(afterName);
    const summaryName = tracked.aliases.find((name) => !/\b(executives|CEO)\b/i.test(name) && summary.slice(0, 100).toLowerCase().includes(name.toLowerCase()));
    const summaryAfterName = summaryName ? summary.slice(summary.toLowerCase().indexOf(summaryName.toLowerCase()) + summaryName.length) : "";
    const summaryAttribution = !!summaryName && !/^(?:['’]s|\s+of\b)/i.test(summaryAfterName) && /\b(says?|said|warns?|warned|tells?|told|sees?|argues?|predicts?|expects?|discusses?|speaks?|believes?|suggests?|calls? for)\b|表示|称|认为|指出|警告|预计|强调/.test(summaryAfterName.slice(0, 140));
    const interviewAttribution = !!alias && /^(?:\s+on\b|\s*[:：])/.test(afterName) && summaryAttribution;
    const host = url ? new URL(url).hostname : "";
    const trusted = TRUSTED_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
    const historic = /\b(?:in|at|from|during)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Davos)?\s*20\d{2}\b/i.exec(title);
    if (!alias || (!titleAttribution && !interviewAttribution && !summaryAttribution) || !VIEW_VERB.test(`${title} ${summary}`) || summary.length < 45 || !url || !trusted || (historic && Number(historic[0].match(/20\d{2}/)?.[0]) < now.getUTCFullYear()) || !Number.isFinite(published.getTime()) || published.getTime() < start || published.getTime() > now.getTime() + 86_400_000) return [];
    return [{ id: `${tracked.id}:${url}`, groupId, personId: tracked.id, person: tracked.name, role: tracked.role, title, summary: summary.slice(0, 400), source: text(row["News:Source"]) || new URL(url).hostname, url, publishedAt: published.toISOString() }];
  });
}

export function selectVoiceItems(items: VoiceItem[]): VoiceItem[] {
  const seen = new Set<string>();
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).filter((item) => {
    const key = `${item.personId}|${item.url.toLowerCase().replace(/\?.*$/, "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
