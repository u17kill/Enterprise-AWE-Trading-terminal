import { callLongbridgeTool, type getSession } from "./longbridge-mcp";
import { calculateTemperature, type TemperatureBar } from "./canary-research-temperature";

type Session = NonNullable<ReturnType<typeof getSession>>;
export type Market = "us" | "cn";
const SYMBOLS: Record<Market, { id: string; title: string }[]> = {
  us: [{ id: "SPY.US", title: "标普 500 · SPY ETF 代理" }, { id: "QQQ.US", title: "纳斯达克 100 · QQQ ETF 代理" }, { id: "SOXX.US", title: "半导体 · SOXX ETF" }, { id: "DIA.US", title: "道琼斯 · DIA ETF 代理" }],
  cn: [{ id: "000300.SH", title: "沪深 300" }, { id: "000688.SH", title: "科创 50" }, { id: "399006.SZ", title: "创业板指" }, { id: "000922.SH", title: "中证红利" }],
};
function marketDate(timestamp: string, market: Market) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: market === "us" ? "America/New_York" : "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (part: string) => parts.find((item) => item.type === part)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function parseTemperatureBars(raw: unknown, market: Market): TemperatureBar[] {
  if (!Array.isArray(raw)) return [];
  const rows = new Map<string, TemperatureBar>();
  const conflicting = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>, timestamp = item.timestamp;
    if (typeof timestamp !== "string") continue;
    const date = marketDate(timestamp, market), close = Number(item.close), volume = Number(item.volume), turnover = Number(item.turnover);
    if (!date || !Number.isFinite(close) || close <= 0 || !Number.isFinite(volume) || volume <= 0 || !Number.isFinite(turnover) || turnover <= 0) continue;
    const previous = rows.get(date);
    if (previous && (previous.close !== close || previous.volume !== volume || previous.turnover !== turnover)) conflicting.add(date);
    else if (!previous) rows.set(date, { date, close, volume, turnover });
  }
  return [...rows.values()].filter((bar) => !conflicting.has(bar.date)).sort((a, b) => a.date.localeCompare(b.date));
}
export function completedMarketCutoff(market: Market, now = new Date()): string | null {
  const zone = market === "us" ? "America/New_York" : "Asia/Shanghai";
  const today = marketDate(now.toISOString(), market);
  if (!today) return null;
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(clock.find((part) => part.type === "hour")?.value), minute = Number(clock.find((part) => part.type === "minute")?.value);
  const closeMinute = market === "us" ? 16 * 60 : 15 * 60;
  return hour * 60 + minute >= closeMinute ? today : new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}
export function completedTemperatureBars(rows: TemperatureBar[], market: Market, now = new Date()): TemperatureBar[] {
  const cutoff = completedMarketCutoff(market, now);
  return cutoff ? rows.filter((bar) => bar.date <= cutoff) : [];
}
export async function loadPagedTemperatureBars(session: Session, symbol: string, market: Market, forwardAdjust = false, now = new Date()) {
  const all: unknown[] = [];
  let time: string | undefined;
  let oldest: string | undefined;
  for (let page = 0; page < 4; page++) {
    const raw = await callLongbridgeTool(session, "history_candlesticks_by_offset", { symbol, period: "day", count: 250, forward_adjust: forwardAdjust, forward: false, trade_sessions: "intraday", ...(time ? { time } : {}), _jq: "map({timestamp,close,volume,turnover})" });
    if (!Array.isArray(raw) || !raw.length) break;
    const first = raw[0];
    const stamp = first && typeof first === "object" && "timestamp" in first ? first.timestamp : null;
    if (typeof stamp !== "string" || !Number.isFinite(Date.parse(stamp)) || stamp === oldest) throw new Error("Longbridge 历史日 K 分页未前进");
    oldest = stamp;
    all.push(...raw);
    if (completedTemperatureBars(parseTemperatureBars(all, market), market, now).length >= 700) break;
    time = new Date(Date.parse(stamp) - 1000).toISOString().slice(0, 19);
  }
  return completedTemperatureBars(parseTemperatureBars(all, market), market, now);
}
function basketDenominator(series: TemperatureBar[][]): TemperatureBar[] {
  const dates = new Set(series.flatMap((rows) => rows.map((row) => row.date)));
  return [...dates].sort().flatMap((date) => {
    const matched = series.map((rows) => rows.find((row) => row.date === date));
    if (matched.some((row) => !row)) return [];
    return [{ date, close: 1, volume: 1, turnover: matched.reduce((sum, row) => sum + row!.turnover, 0) }];
  });
}
export async function collectTemperature(session: Session, market: Market) {
  const readings = [];
  const errors: Record<string, string> = {};
  const raw = new Map<string, TemperatureBar[]>();
  for (let index = 0; index < SYMBOLS[market].length; index += 2) {
    const batch = await Promise.all(SYMBOLS[market].slice(index, index + 2).map(async (item) => {
      try {
        if (market === "us") {
          const [unadjusted, adjustedRows] = await Promise.all([loadPagedTemperatureBars(session, item.id, market), loadPagedTemperatureBars(session, item.id, market, true)]);
          const adjusted = new Map(adjustedRows.map((bar) => [bar.date, bar]));
          return { id: item.id, rows: unadjusted.flatMap((bar) => { const normalized = adjusted.get(bar.date); return normalized ? [{ ...bar, close: normalized.close, volume: normalized.volume }] : []; }) };
        }
        return { id: item.id, rows: await loadPagedTemperatureBars(session, item.id, market) };
      } catch (error) { return { id: item.id, error: error instanceof Error ? error.message : "行情请求失败" }; }
    }));
    for (const item of batch) if ("rows" in item && item.rows) raw.set(item.id, item.rows);
    else if ("error" in item && item.error) errors[item.id] = item.error;
  }
  let denominator: TemperatureBar[] = [];
  if (market === "us") denominator = basketDenominator(SYMBOLS.us.map((item) => raw.get(item.id) ?? []));
  else {
    try { denominator = basketDenominator(await Promise.all(["000001.SH", "399001.SZ"].map((symbol) => loadPagedTemperatureBars(session, symbol, "cn")))); }
    catch (error) { errors["market-turnover"] = error instanceof Error ? error.message : "沪深成交额未取到"; }
  }
  for (const item of SYMBOLS[market]) {
    const source = raw.get(item.id) ?? [];
    const result = calculateTemperature(source, denominator);
    const latest = source.at(-1)?.date;
    const fresh = result.asOf === latest && result.score !== null && result.sample >= 294;
    const state = fresh ? result.score! <= 15 ? "极端超卖" : result.score! <= 30 ? "警戒超卖" : result.score! <= 70 ? "正常" : result.score! <= 85 ? "警戒超买" : "极端超买" : "数据不足";
    if (!fresh && !errors[item.id]) errors[item.id] = source.length < 294 ? `仅取得 ${source.length} 根有效日线，至少需要 294 根` : "分母日期不齐或因子缺失";
    readings.push({ id: item.id, title: item.title, value: fresh ? result.score : null, unit: "/ 100", asOf: fresh ? result.asOf : null, source: "Longbridge · 日 K", status: state, summary: fresh ? `位置 ${result.position!.toFixed(1)} · 参与 ${result.crowding!.toFixed(1)} · 动能 ${result.momentum!.toFixed(1)}；${state}。` : errors[item.id], explanation: market === "us" ? "研究算法：位置 40%、参与 35%、动能 25%，三日 EMA 平滑。参与度以 SPY、QQQ、SOXX、DIA 四 ETF 同日成交额篮子为分母，不代表全美股成交份额；阈值尚未经独立预测验证。" : "研究算法：位置 40%、参与 35%、动能 25%，三日 EMA 平滑。参与度以沪深指数成交额之和为代理分母，量能以指数成交量代替历史换手率；口径与旧研究不同，不能直接比较旧分数。", points: fresh ? result.history.slice(-100) : [], sample: result.sample, factors: fresh ? { position: result.position, crowding: result.crowding, momentum: result.momentum } : null });
  }
  return { market, kind: "temperature" as const, refreshedAt: new Date().toISOString(), readings, errors };
}
