import { readResearchSnapshot } from "../../../lib/institutional-research-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await readResearchSnapshot();
    return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "研报数据读取失败，请检查策展文件。" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
