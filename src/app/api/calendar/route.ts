import { NextRequest, NextResponse } from "next/server";
import { callLongbridgeTool, COOKIE_NAME, getSession, hasLongbridgeToken, UnauthorizedError } from "../../../lib/longbridge-mcp";
import { parseLongbridgeCalendar } from "../../../lib/financial-calendar";

export const runtime = "nodejs";

const REPORT_FILTER = '[.list[] | {date, infos: [.infos[] | select((.symbol // "") | test("^(AAPL|MSFT|NVDA|GOOGL|AMZN|META|TSLA|AMD|INTC|NFLX|TSM|ASML|ORCL|AVGO|JPM|BRK|00700|09988|03690|01810|002594|300750|600519|6758|7203|9984)([.]|$)"; "i")) | {id,symbol,counter_name,content,datetime,date_type,ext}]} | select(.infos | length > 0)] | {list: .}';
const MACRO_FILTER = '[.list[] | {date, infos: [.infos[] | select((.star // 0) >= 3) | {id,content,datetime,star,market}]} | select(.infos | length > 0)] | {list: .}';

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "月份格式无效。" }, { status: 400 });
  const [year, monthNumber] = month.split("-").map(Number);
  const target = year * 12 + monthNumber;
  const now = new Date();
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  if (target < current - 1 || target > current + 18) return NextResponse.json({ error: "只能更新最近至未来 18 个月的日历。" }, { status: 400 });
  const session = getSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!session || !hasLongbridgeToken(session)) return NextResponse.json({ error: "请先连接 Longbridge，才能更新财报和宏观事件。" }, { status: 401 });
  const boundaryDate = (date: Date) => date.toISOString().slice(0, 10);
  const start = boundaryDate(new Date(Date.UTC(year, monthNumber - 1, 0)));
  const end = boundaryDate(new Date(Date.UTC(year, monthNumber, 1)));
  const jobs = (["US", "CN", "JP", "HK"] as const).flatMap((market) => (["report", "macrodata"] as const).map((category) => ({ market, category })));
  const results = await Promise.allSettled(jobs.map(async ({ market, category }) => {
    const raw = await callLongbridgeTool(session, "finance_calendar", { category, market, start, end, _jq: category === "report" ? REPORT_FILTER : MACRO_FILTER });
    return parseLongbridgeCalendar(raw, category, market === "HK" ? "CN" : market, month);
  }));
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length === jobs.length) {
    const expired = failed.some((result) => result.status === "rejected" && result.reason instanceof UnauthorizedError);
    return NextResponse.json({ error: expired ? "Longbridge 授权已过期，请重新连接。" : "长桥暂时未能返回财经日历，请稍后重试。" }, { status: expired ? 401 : 502 });
  }
  const events = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return NextResponse.json({ events, asOf: new Date().toISOString(), source: "Longbridge 财经日历", partial: failed.length > 0, missing: jobs.filter((_, index) => results[index].status === "rejected").map(({ market, category }) => `${market} ${category}`) }, { headers: { "Cache-Control": "no-store" } });
}
