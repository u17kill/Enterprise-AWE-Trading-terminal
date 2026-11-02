import { readStoredSnapshot, writeStoredMatrix } from "../../../lib/portfolio-matrix-store";

export const runtime = "nodejs";

function localRequest(request: Request): boolean {
  try {
    const host = request.headers.get("host") ?? new URL(request.url).host;
    const hostname = new URL(`http://${host}`).hostname;
    if (!["127.0.0.1", "localhost"].includes(hostname)) return false;
    const origin = request.headers.get("origin");
    return !origin || new URL(origin).host === host;
  } catch { return false; }
}

export async function GET(request: Request) {
  if (!localRequest(request)) return new Response("Local access only", { status: 403 });
  try { return Response.json({ snapshot: await readStoredSnapshot() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "持仓文件读取失败；原文件未更改。" }, { status: 500 }); }
}

export async function PUT(request: Request) {
  if (!localRequest(request)) return new Response("Local access only", { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return new Response("JSON required", { status: 415 });
  let raw: unknown;
  try {
    const body = await request.text();
    if (body.length > 1_000_000) return new Response("Portfolio too large", { status: 413 });
    raw = JSON.parse(body);
  } catch { return Response.json({ error: "持仓数据格式无效。" }, { status: 400 }); }
  try {
    await writeStoredMatrix(raw);
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "持仓保存失败；原文件未更改。" }, { status: 500 }); }
}
