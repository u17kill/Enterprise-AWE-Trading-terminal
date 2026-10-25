import { NextRequest, NextResponse } from "next/server";
import { fetchPublicNews } from "../../../lib/market-news-feeds";
import { selectMarketNews, type NewsCandidate, type NewsCategory, type NewsSnapshot } from "../../../lib/market-news";
import { callLongbridgeTool, COOKIE_NAME, getSession, hasLongbridgeToken } from "../../../lib/longbridge-mcp";

export const runtime = "nodejs";

const SEARCHES: { keyword: string; category: NewsCategory }[] = [
  { keyword: "Federal Reserve", category: "macro" },
  { keyword: "NVIDIA", category: "ai" },
  { keyword: "geopolitics", category: "geopolitics" },
  { keyword: "earnings", category: "industry" },
];

function withDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Longbridge news search timed out")), milliseconds);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

function parseLongbridgeNews(raw: unknown, category: NewsCategory): NewsCandidate[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && "data" in raw && Array.isArray(raw.data) ? raw.data : [];
  return list.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title : "";
    const url = typeof item.url === "string" ? item.url : "";
    const source = typeof item.source_name === "string" ? item.source_name : "Longbridge";
    const summary = typeof item.excerpt === "string" ? item.excerpt : typeof item.description === "string" ? item.description : "";
    const date = typeof item.time === "string" || typeof item.time === "number" ? new Date(item.time) : typeof item.published_at === "string" || typeof item.published_at === "number" ? new Date(item.published_at) : new Date(NaN);
    return [{ title, url, source, summary: summary.slice(0, 360), publishedAt: Number.isFinite(date.getTime()) ? date.toISOString() : "", category }];
  });
}

export async function GET(request: NextRequest) {
  const days = Number(request.nextUrl.searchParams.get("days") ?? 3);
  if (days !== 3 && days !== 5 && days !== 7) return NextResponse.json({ error: "只支持过去 3、5 或 7 天。" }, { status: 400 });
  const publicResult = await fetchPublicNews(days);
  const session = getSession(request.cookies.get(COOKIE_NAME)?.value);
  const longbridgeResults = session && hasLongbridgeToken(session) ? await Promise.allSettled(SEARCHES.map(async ({ keyword, category }) => parseLongbridgeNews(await withDeadline(callLongbridgeTool(session, "news_search", { keyword, limit: 25 }), 8_000), category))) : [];
  const missing = [...publicResult.missing, ...SEARCHES.filter((_, index) => longbridgeResults[index]?.status === "rejected").map(({ keyword }) => `Longbridge ${keyword}`)];
  const candidates = [...publicResult.candidates, ...longbridgeResults.flatMap((result) => result.status === "fulfilled" ? result.value : [])];
  if (!candidates.length && missing.length) return NextResponse.json({ error: "新闻来源暂时未返回数据，请稍后重试。", missing }, { status: 502, headers: { "Cache-Control": "no-store" } });
  const selected = selectMarketNews(candidates, days);
  const snapshot: NewsSnapshot = { ...selected, days, asOf: new Date().toISOString(), partial: missing.length > 0, missing };
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
