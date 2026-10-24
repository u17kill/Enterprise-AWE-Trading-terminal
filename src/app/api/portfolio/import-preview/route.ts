import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (process.env.NODE_ENV !== "development" || !/^(127\.0\.0\.1|localhost):\d{1,5}$/.test(host)) {
    return NextResponse.json({ error: "仅限本机开发环境。" }, { status: 404 });
  }
  try {
    const raw = await readFile(join(process.cwd(), ".local", "portfolio-import-2026-08-15.json"), "utf8");
    return NextResponse.json(JSON.parse(raw), { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "本机没有旧持仓快照。" }, { status: 404 }); }
}
