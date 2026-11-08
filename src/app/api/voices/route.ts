import { NextResponse } from "next/server";
import { loadCuratedVoices } from "../../../lib/voices-curated-source";

export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.json(await loadCuratedVoices(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "策展数据读取失败" }, { status: 502, headers: { "Cache-Control": "no-store" } }); }
}
