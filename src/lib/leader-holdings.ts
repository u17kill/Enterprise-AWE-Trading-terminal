export const GROUPS = [
  { id: "value", label: "价值与质量" },
  { id: "special", label: "主动与特殊机会" },
  { id: "growth", label: "成长与科技" },
  { id: "macro", label: "宏观与多策略" },
] as const;

export type ManagerGroup = (typeof GROUPS)[number]["id"];
export type GroupFilter = ManagerGroup | "all";

export type Manager = {
  id: string;
  name: string;
  filer: string;
  cik: string;
  group: ManagerGroup;
  secUrl: string;
  aliases?: string;
  historical?: boolean;
  lastVerifiedPeriod?: string;
  lastVerifiedFiledAt?: string;
};

type ManagerRow = [name: string, filer: string, cik: string, group: ManagerGroup, aliases?: string];

const rows: ManagerRow[] = [
  ["伯克希尔·哈撒韦", "Berkshire Hathaway Inc", "0001067983", "value", "Warren Buffett 巴菲特"],
  ["段永平 · H&H", "H&H International Investment, LLC", "0001759760", "value"],
  ["李录 · 喜马拉雅", "Himalaya Capital Management LLC", "0001709323", "value"],
  ["帕布来 · Dalal Street", "Dalal Street, LLC", "0001549575", "value", "Mohnish Pabrai"],
  ["景林资产", "Greenwoods Asset Management Hong Kong Ltd.", "0001848138", "value"],
  ["Terry Smith · Fundsmith", "Fundsmith LLP", "0001569205", "value", "特里史密斯"],
  ["Chuck Akre · Akre Capital", "Akre Capital Management LLC", "0001112520", "value", "查克阿克雷"],
  ["Dev Kantesaria · Valley Forge", "Valley Forge Capital Management LP", "0001697868", "value"],
  ["Tom Russo · Gardner Russo", "Gardner Russo & Quinn LLC", "0000860643", "value"],
  ["Seth Klarman · Baupost", "Baupost Group LLC/MA", "0001061768", "value", "塞斯卡拉曼"],
  ["PRIMECAP", "PRIMECAP Management Co", "0000763212", "value"],
  ["Bill Ackman · Pershing Square", "Pershing Square Capital Management LP", "0001336528", "special", "比尔阿克曼 潘兴广场"],
  ["Howard Marks · Oaktree", "Oaktree Capital Management LP", "0000949509", "special", "霍华德马克斯 橡树资本"],
  ["Chris Hohn · TCI", "TCI Fund Management Ltd", "0001647251", "special"],
  ["ARK Investment", "ARK Investment Management LLC", "0001697748", "growth", "Cathie Wood 木头姐"],
  ["Leopold Aschenbrenner", "Situational Awareness LP", "0002045724", "growth"],
  ["但斌 · 东方港湾", "Oriental Harbor Investment Master Fund", "0002046333", "growth"],
  ["Chase Coleman · Tiger Global", "Tiger Global Management LLC", "0001167483", "growth"],
  ["Coatue Management", "Coatue Management LLC", "0001135730", "growth"],
  ["Brad Gerstner · Altimeter", "Altimeter Capital Management LP", "0001541617", "growth"],
  ["柏基投资 · Baillie Gifford", "Baillie Gifford & Co", "0001088875", "growth"],
  ["Sands Capital", "Sands Capital Management LLC", "0001020066", "growth"],
  ["桥水 · Bridgewater", "Bridgewater Associates, LP", "0001350694", "macro", "Ray Dalio 达利欧"],
  ["索罗斯基金", "Soros Fund Management LLC", "0001029160", "macro", "George Soros"],
  ["Michael Burry · Scion", "Scion Asset Management, LLC", "0001649339", "macro", "迈克尔伯里 大空头"],
  ["Paul Tudor Jones · Tudor", "Tudor Investment Corp et al", "0000923093", "macro", "保罗都铎琼斯"],
  ["David Tepper · Appaloosa", "Appaloosa LP", "0001656456", "macro", "大卫泰珀"],
  ["Citadel", "Citadel Advisors LLC", "0001423053", "macro", "城堡投资"],
];

export const MANAGERS: Manager[] = [
  ...rows.map(([name, filer, cik, group, aliases]) => ({
    id: cik,
    name,
    filer,
    cik,
    group,
    aliases,
    secUrl: `https://www.sec.gov/edgar/browse/?CIK=${cik}&owner=exclude`,
  })),
  {
    id: "0001446440",
    name: "Jim Chanos · Chanos & Co",
    filer: "Chanos & Co LP（原 Kynikos Associates）",
    cik: "0001446440",
    group: "macro",
    aliases: "查诺斯 大空头 Kynikos",
    historical: true,
    lastVerifiedPeriod: "2023-09-30",
    lastVerifiedFiledAt: "2023-11-14",
    secUrl: "https://www.sec.gov/Archives/edgar/data/1446440/0001172661-23-003940-index.htm",
  },
];

export function filterManagers(group: GroupFilter, query: string): Manager[] {
  const needle = query.trim().toLocaleLowerCase();
  return MANAGERS.filter((manager) => {
    if (group !== "all" && manager.group !== group) return false;
    return !needle || [manager.name, manager.filer, manager.cik, manager.aliases ?? ""].some((value) => value.toLocaleLowerCase().includes(needle));
  });
}
