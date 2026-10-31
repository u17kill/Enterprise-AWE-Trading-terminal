import { NextResponse } from "next/server";
import { fetchLatestVoices } from "../../../lib/latest-voices-source";

export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.json(await fetchLatestVoices(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "观点更新失败" }, { status: 502, headers: { "Cache-Control": "no-store" } }); }
}
