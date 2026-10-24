export type CalendarCategory = "industry" | "summit" | "company" | "earnings" | "central-bank" | "macro";
export type CalendarEvent = {
  id: string;
  title: string;
  symbol?: string;
  category: CalendarCategory;
  region: "US" | "CN" | "JP" | "HK" | "TW" | "Global";
  start: string;
  end?: string;
  time?: string;
  detail: string;
  source: string;
  sourceUrl?: string;
  status: "confirmed" | "tentative" | "provider";
};

const FED = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
export const CURATED_EVENTS: CalendarEvent[] = [
  { id: "fomc-2026-10", title: "美联储 FOMC 议息会议", category: "central-bank", region: "US", start: "2026-10-27", end: "2026-10-28", detail: "议息会议；政策声明通常在会议第二天发布。", source: "美国联邦储备委员会", sourceUrl: FED, status: "confirmed" },
  { id: "fomc-2026-12", title: "美联储 FOMC 议息会议", category: "central-bank", region: "US", start: "2026-12-08", end: "2026-12-09", detail: "议息会议及经济预测摘要。", source: "美国联邦储备委员会", sourceUrl: FED, status: "confirmed" },
  ...[["01", "26", "27"], ["03", "16", "17"], ["04", "27", "28"], ["06", "08", "09"], ["07", "27", "28"], ["09", "14", "15"], ["10", "26", "27"], ["12", "07", "08"]].map(([month, start, end]) => ({ id: `fomc-2027-${month}`, title: "美联储 FOMC 议息会议", category: "central-bank" as const, region: "US" as const, start: `2027-${month}-${start}`, end: `2027-${month}-${end}`, detail: "美联储发布的暂定会议安排；日期可能调整。", source: "美国联邦储备委员会", sourceUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20250905a.htm", status: "tentative" as const })),
  { id: "apec-2026", title: "APEC 经济领导人会议", category: "summit", region: "CN", start: "2026-11-18", end: "2026-11-19", detail: "深圳；亚太经合组织经济领导人会议。", source: "APEC", sourceUrl: "https://www.apec.org/events-calendar", status: "confirmed" },
  { id: "apec-ceo-2026", title: "APEC CEO 峰会", category: "summit", region: "CN", start: "2026-11-17", end: "2026-11-18", detail: "深圳；亚太企业与政策议题。", source: "APEC", sourceUrl: "https://www.apec.org/events-calendar", status: "confirmed" },
  { id: "g20-2026", title: "G20 领导人峰会", category: "summit", region: "US", start: "2026-12-14", end: "2026-12-15", detail: "美国迈阿密；全球主要经济体领导人峰会。", source: "美国财政部", sourceUrl: "https://home.treasury.gov/news/press-releases/sb0398", status: "confirmed" },
  { id: "g20-2027", title: "G20 领导人峰会", category: "summit", region: "Global", start: "2027-11-27", end: "2027-11-28", detail: "英国曼彻斯特；全球主要经济体领导人峰会。", source: "英国政府", sourceUrl: "https://www.gov.uk/government/news/manchester-to-host-world-leaders-at-the-2027-g20-summit", status: "confirmed" },
  { id: "apple-2026-q4", title: "Apple 第四季度财报电话会", symbol: "AAPL.US", category: "earnings", region: "US", start: "2026-11-02", detail: "FY2026 第四季度业绩电话会；美东时间 17:00。", source: "Apple 投资者关系", sourceUrl: "https://investor.apple.com/investor-relations/", status: "confirmed" },
  { id: "sony-2026-q2", title: "Sony 集团季度财报说明会", symbol: "6758.JP", category: "earnings", region: "JP", start: "2026-11-05", detail: "FY2026 第二季度业绩说明会；日本时间 16:30。", source: "Sony 投资者关系", sourceUrl: "https://www.sony.com/en/SonyInfo/IR/library/presen/er/", status: "confirmed" },
  { id: "toyota-2027-q2", title: "丰田汽车季度财报", symbol: "7203.JP", category: "earnings", region: "JP", start: "2026-11-05", detail: "FY2027 第二季度业绩；公司提示日程可能变化。", source: "Toyota 投资者关系", sourceUrl: "https://global.toyota/en/ir/", status: "tentative" },
  { id: "nintendo-2027-q2", title: "任天堂半年度财报", symbol: "7974.JP", category: "earnings", region: "JP", start: "2026-11-05", detail: "截至 2026 年 9 月的半年度业绩；公司提示日程可能变化。", source: "Nintendo 投资者关系", sourceUrl: "https://www.nintendo.co.jp/ir/en/schedule/index.html", status: "tentative" },
  { id: "softbank-2026-q2", title: "软银集团季度财报", symbol: "9984.JP", category: "earnings", region: "JP", start: "2026-11-10", detail: "FY2026 第二季度业绩。", source: "SoftBank Group 投资者关系", sourceUrl: "https://group.softbank/en/ir/calendar", status: "confirmed" },
  { id: "mediatek-2026-q3", title: "联发科第三季度业绩说明会", symbol: "2454.TW", category: "earnings", region: "TW", start: "2026-10-30", detail: "2026 年第三季度业绩说明会；台北时间 15:00。", source: "MediaTek 投资者关系", sourceUrl: "https://www.mediatek.com/investor-relations/ir-events", status: "confirmed" },
  { id: "honhai-2026-q3", title: "鸿海科技第三季度财报说明会", symbol: "2317.TW", category: "earnings", region: "TW", start: "2026-11-12", detail: "FY2026 第三季度业绩说明会。", source: "Hon Hai 投资者关系", sourceUrl: "https://www.honhai.com/en-us/investor-relations/investor-relations-activities/event-calendar", status: "confirmed" },
  { id: "hkex-2026-q3", title: "港交所第三季度业绩公告", symbol: "00388.HK", category: "earnings", region: "HK", start: "2026-11-06", detail: "2026 年第三季度业绩公告。", source: "HKEX 投资者关系", sourceUrl: "https://www.hkexgroup.com/Investor-Relations?sc_lang=zh-HK", status: "confirmed" },
  { id: "tencent-2026-q3", title: "腾讯第三季度财报", symbol: "00700.HK", category: "earnings", region: "HK", start: "2026-11-18", detail: "2026 年第三季度业绩公告；香港时间 20:00。", source: "Tencent 投资者关系", sourceUrl: "https://www.tencent.com/zh-hk/investors/investor-kit-calendar/", status: "confirmed" },
  { id: "ces-2027", title: "CES 2027 消费电子展", category: "industry", region: "US", start: "2027-01-06", end: "2027-01-09", detail: "拉斯维加斯；消费电子、AI、游戏及新技术。", source: "CES / CTA", sourceUrl: "https://www.ces.tech/about-ces/about-ces/", status: "confirmed" },
  { id: "gtc-2027", title: "NVIDIA GTC 2027", category: "company", region: "US", start: "2027-03-15", end: "2027-03-18", detail: "圣何塞；AI 与加速计算开发者大会。", source: "NVIDIA", sourceUrl: "https://www.nvidia.com/gtc/", status: "confirmed" },
  { id: "computex-2027", title: "COMPUTEX 2027", category: "industry", region: "Global", start: "2027-06-01", end: "2027-06-04", detail: "台北；AI 计算、机器人与新一代科技。", source: "COMPUTEX", sourceUrl: "https://www.computextaipei.com.tw/en/index.html", status: "confirmed" },
];

export const DATE_PENDING = [
  { title: "台积电下一次季度财报", category: "earnings", sourceUrl: "https://investor.tsmc.com/english/financial-calendar" },
  { title: "Apple 产品发布会", category: "company", sourceUrl: "https://www.apple.com/apple-events/" },
  { title: "AWS re:Invent", category: "company", sourceUrl: "https://reinvent.awsevents.com/" },
  { title: "下一届 G7 峰会", category: "summit", sourceUrl: "https://www.g7g20-documents.org/" },
  { title: "中国央行及重要经济会议", category: "central-bank", sourceUrl: "http://www.pbc.gov.cn/" },
];

type RawInfo = { id?: unknown; symbol?: unknown; counter_name?: unknown; market?: unknown; content?: unknown; datetime?: unknown; date_type?: unknown; star?: unknown; ext?: { local_date?: unknown }; };
type RawDay = { date?: unknown; infos?: unknown };

export function parseLongbridgeCalendar(raw: unknown, category: "report" | "macrodata", market: "US" | "CN" | "JP" | "HK", month: string): CalendarEvent[] {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { list?: unknown }).list)) return [];
  const events: CalendarEvent[] = [];
  for (const day of (raw as { list: RawDay[] }).list) {
    if (typeof day.date !== "string" || !Array.isArray(day.infos)) continue;
    for (const item of day.infos as RawInfo[]) {
      const local = typeof item.ext?.local_date === "string" ? item.ext.local_date : day.date;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(local) ? local : day.date;
      if (!date.startsWith(`${month}-`) || typeof item.content !== "string") continue;
      const title = category === "report" ? `${typeof item.counter_name === "string" && item.counter_name ? item.counter_name : item.symbol || "公司"} 财报` : item.content;
      events.push({ id: `lb-${category}-${market}-${item.id ?? item.symbol ?? `${date}-${events.length}`}`, title: String(title), symbol: typeof item.symbol === "string" ? item.symbol : undefined, category: category === "report" ? "earnings" : "macro", region: market, start: date, time: category === "macrodata" && typeof item.datetime === "string" ? item.datetime : undefined, detail: category === "report" ? `${item.content}${typeof item.symbol === "string" ? ` · ${item.symbol}` : ""}${typeof item.date_type === "string" && item.date_type ? ` · ${item.date_type}` : ""}。财报日期可能调整。` : `${item.content} · 重要程度 ${item.star ?? "未标注"}/3。`, source: "Longbridge 财经日历", status: "provider" });
    }
  }
  return events;
}

export function eventsOnDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((event) => event.start <= date && (event.end ?? event.start) >= date);
}

export function mergeCalendarEvents(curated: CalendarEvent[], provider: CalendarEvent[]): CalendarEvent[] {
  const filtered = provider.filter((event) => !(
    event.category === "earnings" && event.symbol && curated.some((official) => official.category === "earnings" && official.symbol === event.symbol && Math.abs(Date.parse(`${official.start}T00:00:00Z`) - Date.parse(`${event.start}T00:00:00Z`)) <= 21 * 86_400_000)
  ));
  return [...curated, ...filtered];
}

export function monthCells(month: string): (string | null)[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, number] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
}
