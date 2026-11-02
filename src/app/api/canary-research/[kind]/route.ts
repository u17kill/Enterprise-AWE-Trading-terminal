import { NextRequest, NextResponse } from "next/server";
import { longbridgeCookieName } from "../../../../lib/longbridge-cookie";
import { getSession, hasLongbridgeToken } from "../../../../lib/longbridge-mcp";
import { collectTemperature } from "../../../../lib/canary-research-source";
import { collectValuation } from "../../../../lib/canary-research-valuation";
import { collectSentiment } from "../../../../lib/canary-research-sentiment";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const market = request.nextUrl.searchParams.get("market");
  if (market !== "us" && market !== "cn") return NextResponse.json({ error: "市场参数无效" }, { status: 400 });
  if (kind === "valuation") {
    try { return NextResponse.json(await collectValuation(market), { headers: { "Cache-Control": "no-store" } }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "估值更新失败" }, { status: 502 }); }
  }
  if (kind !== "temperature" && kind !== "sentiment") return NextResponse.json({ error: "页面不存在" }, { status: 404 });
  const session = getSession(request.cookies.get(longbridgeCookieName(request))?.value);
  if (!session || !hasLongbridgeToken(session)) return NextResponse.json({ error: "请先连接 Longbridge，再更新本页数据。" }, { status: 401 });
  try { return NextResponse.json(kind === "temperature" ? await collectTemperature(session, market) : await collectSentiment(session, market), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "更新失败" }, { status: 502 }); }
}
