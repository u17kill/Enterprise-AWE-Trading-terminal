import { readStoredCanaryOrder, writeStoredCanaryOrder } from "../../../lib/canary-order-store";

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
  try { return Response.json({ order: await readStoredCanaryOrder() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "指标排序读取失败。" }, { status: 500 }); }
}

export async function PUT(request: Request) {
  if (!localRequest(request)) return new Response("Local access only", { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return new Response("JSON required", { status: 415 });
  let raw: unknown;
  try {
    const body = await request.text();
    if (body.length > 20_000) return new Response("Indicator order too large", { status: 413 });
    raw = JSON.parse(body);
  } catch { return Response.json({ error: "指标排序格式无效。" }, { status: 400 }); }
  try {
    await writeStoredCanaryOrder(raw);
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid indicator order.") return Response.json({ error: "指标排序格式无效。" }, { status: 400 });
    return Response.json({ error: "指标排序保存失败；原顺序未更改。" }, { status: 500 });
  }
}
