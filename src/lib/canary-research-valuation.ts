type Point = { date: string; value: number };
const DANJUAN = "https://danjuanfunds.com/djapi/index_eva/pe_history/";
const HOM = "https://historyofmarket.com/api/sectors/forward-pe.json";
const STATE_STREET_DIA = "https://www.ssga.com/us/en/individual/etfs/state-street-spdr-dow-jones-industrial-average-etf-trust-dia";
const INDEXES = {
  us: [{ id: "SPY.US", code: "SP500", title: "标普 500" }, { id: "QQQ.US", code: "NDX", title: "纳斯达克 100" }, { id: "SOXX.US", code: "SOX", title: "费城半导体" }, { id: "DIA.US", code: "DJI", title: "道琼斯" }],
  cn: [{ id: "000300.SH", code: "SH000300", title: "沪深 300" }, { id: "000688.SH", code: "SH000688", title: "科创 50" }, { id: "399006.SZ", code: "SZ399006", title: "创业板指" }, { id: "000922.SH", code: "SH000922", title: "中证红利" }],
} as const;

export function parseDanjuanPe(raw: unknown): Point[] {
  if (!raw || typeof raw !== "object" || (raw as { result_code?: unknown }).result_code !== 0) return [];
  const entries = (raw as { data?: { index_eva_pe_growths?: unknown } }).data?.index_eva_pe_growths;
  if (!Array.isArray(entries)) return [];
  const result = new Map<string, Point>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { ts?: unknown; pe?: unknown }, ts = Number(row.ts), value = Number(row.pe);
    if (!Number.isFinite(ts) || ts < Date.UTC(2000, 0, 1) || !Number.isFinite(value) || value <= 0 || value > 500) continue;
    const date = new Date(ts + 8 * 3_600_000).toISOString().slice(0, 10);
    result.set(date, { date, value });
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function valuationPercentiles(points: Point[]): Record<3 | 5 | 10, number | null> {
  const current = points.at(-1), result: Record<3 | 5 | 10, number | null> = { 3: null, 5: null, 10: null };
  if (!current) return result;
  const end = Date.parse(`${current.date}T00:00:00Z`);
  for (const years of [3, 5, 10] as const) {
    const start = end - years * 365.25 * 86_400_000;
    const selected = points.filter((p) => Date.parse(`${p.date}T00:00:00Z`) >= start);
    if (selected.length < 20 || Date.parse(`${selected[0].date}T00:00:00Z`) > start + 70 * 86_400_000) continue;
    result[years] = Math.round(1000 * selected.filter((p) => p.value < current.value).length / selected.length) / 10;
  }
  return result;
}
function parseSox(raw: unknown): Point[] {
  if (!raw || typeof raw !== "object") return [];
  const section = (raw as { sectors?: { sox?: { series?: unknown; forwardOwn?: unknown } } }).sectors?.sox;
  const merged = new Map<string, Point>();
  for (const entries of [section?.series, section?.forwardOwn]) {
    if (!Array.isArray(entries)) continue;
    for (const item of entries) {
      if (!item || typeof item !== "object") continue;
      const row = item as { date?: unknown; value?: unknown }, value = Number(row.value);
      if (typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.date >= "2016-10-31" && Number.isFinite(value) && value > 0 && value < 200) merged.set(row.date, { date: row.date, value });
    }
  }
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function parseStateStreetDow(html: string): Point | null {
  const start = html.indexOf("Index Characteristics"), end = html.indexOf("Index Statistics", start);
  if (start < 0 || end <= start) return null;
  const section = html.slice(start, end);
  const dateText = /as of\s+([A-Za-z]+\s+\d{1,2}\s+\d{4})/i.exec(section)?.[1];
  const peText = /Price\/Earnings\s*<\/th>[\s\S]{0,120}?<td[^>]*>\s*([\d.]+)\s*<\/td>/i.exec(section)?.[1];
  const stamp = dateText ? Date.parse(`${dateText} 00:00:00 GMT`) : NaN, value = Number(peText);
  if (!Number.isFinite(stamp) || !Number.isFinite(value) || value <= 0 || value > 100) return null;
  return { date: new Date(stamp).toISOString().slice(0, 10), value };
}
async function getJson(url: string) {
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (compatible; AWE-Research/1.0)" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`来源 HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}
async function getText(url: string) {
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (compatible; AWE-Research/1.0)" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`来源 HTTP ${response.status}`);
  return response.text();
}
export async function collectValuation(market: "us" | "cn") {
  const readings = [], errors: Record<string, string> = {};
  for (const item of INDEXES[market]) {
    const isSox = item.code === "SOX", isDow = item.code === "DJI";
    try {
      if (isDow) {
        const latest = parseStateStreetDow(await getText(STATE_STREET_DIA));
        if (!latest) throw new Error("State Street 页面未返回可核验的道指指数 PE");
        readings.push({ id: item.id, title: item.title, value: latest.value, unit: "倍", asOf: latest.date, source: "State Street · 道指指数特征", status: "指数 PE 当前值", summary: `道指指数 PE ${latest.value.toFixed(2)} 倍（${latest.date}）；长期同口径历史尚未核验。`, explanation: "State Street 的 Index Characteristics 栏披露道指指数 Price/Earnings。此值属于指数，不是 DIA 基金的 FY1 前瞻 PE。该公开页面只提供当前快照，没有可核验的连续历史，因此不计算 3/5/10 年分位，也不与其他来源的 PE 直接横比。", points: [], sample: 1, percentiles: { 3: null, 5: null, 10: null }, basis: "道指指数 PE 当前值" });
        continue;
      }
      const points = isSox ? parseSox(await getJson(HOM)) : parseDanjuanPe(await getJson(`${DANJUAN}${item.code}?day=all`));
      if (points.length < 20) throw new Error("来源未返回足够的同口径历史 PE");
      const latest = points.at(-1)!, pct = valuationPercentiles(points), basis = isSox ? "未来 12 个月前瞻 PE" : "指数 PE-TTM";
      const source = isSox ? "History of Market · CC BY 4.0" : "蛋卷基金 · index_eva";
      const available = Object.entries(pct).filter(([, value]) => value !== null).map(([year, value]) => `${year} 年 ${value}%`).join(" · ");
      readings.push({ id: item.id, title: item.title, value: latest.value, unit: "倍", asOf: latest.date, source, status: basis, summary: `${basis} ${latest.value.toFixed(2)} 倍；${available || "历史窗口不足，暂不计算分位"}。`, explanation: `${basis}，只与同一来源和口径的自身历史比较。${isSox ? "前瞻 PE 使用预期盈利，不与 TTM PE 直接横比。" : "蛋卷基金加权口径与中证官网总股本法可不同。"}来源历史自 ${points[0].date} 起，共 ${points.length} 个观测。`, points: points.slice(-110), sample: points.length, percentiles: pct, basis });
    } catch (error) {
      errors[item.id] = error instanceof Error ? error.message : "估值来源请求失败";
      readings.push({ id: item.id, title: item.title, value: null, unit: "倍", asOf: null, source: isDow ? "State Street" : isSox ? "History of Market" : "蛋卷基金", status: "未核验", summary: errors[item.id], explanation: "不以 ETF 自身 PE 或其他口径的历史值代替指数估值。", points: [], sample: 0, percentiles: { 3: null, 5: null, 10: null }, basis: "待核验" });
    }
  }
  return { kind: "valuation" as const, market, refreshedAt: new Date().toISOString(), readings, errors };
}
