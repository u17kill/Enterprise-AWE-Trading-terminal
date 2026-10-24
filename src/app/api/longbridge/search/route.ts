import { NextRequest, NextResponse } from "next/server";
import { fromLongbridgeSecurity } from "../../../../lib/custom-symbols";
import { callLongbridgeTool, COOKIE_NAME, getSession, hasLongbridgeToken, UnauthorizedError } from "../../../../lib/longbridge-mcp";

export const runtime = "nodejs";

type Directory = { total: number; items: ReturnType<typeof fromLongbridgeSecurity>[] };
const directoryCache = globalThis as typeof globalThis & { __aweUsDirectory?: { loadedAt: number; value: Promise<Directory> } };

async function loadDirectory(session: NonNullable<ReturnType<typeof getSession>>): Promise<Directory> {
  const cached = directoryCache.__aweUsDirectory;
  if (cached && Date.now() - cached.loadedAt < 10 * 60_000) return cached.value;
  const value = (async () => {
    const pageSize = 200;
    const first = await callLongbridgeTool(session, "security_list", { market: "US", page: 1, count: pageSize });
    const initial = first && typeof first === "object" ? first as { total?: unknown; items?: unknown } : {};
    if (!Array.isArray(initial.items) || typeof initial.total !== "number") throw new Error("Invalid security directory");
    const total = Math.min(initial.total, 20_000);
    const all = [...initial.items];
    const pages = Math.ceil(total / pageSize);
    for (let start = 2; start <= pages; start += 8) {
      const batch = await Promise.all(Array.from({ length: Math.min(8, pages - start + 1) }, (_, offset) =>
        callLongbridgeTool(session, "security_list", { market: "US", page: start + offset, count: pageSize })));
      for (const raw of batch) {
        const data = raw && typeof raw === "object" ? raw as { items?: unknown } : {};
        if (!Array.isArray(data.items)) throw new Error("Incomplete security directory");
        all.push(...data.items);
      }
    }
    return { total, items: all.map((item) => item && typeof item === "object" ? fromLongbridgeSecurity(item) : null) };
  })();
  directoryCache.__aweUsDirectory = { loadedAt: Date.now(), value };
  try { return await value; }
  catch (error) { delete directoryCache.__aweUsDirectory; throw error; }
}

export async function GET(request: NextRequest) {
  const session = getSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!session || !hasLongbridgeToken(session)) return NextResponse.json({ error: "请先连接 Longbridge。" }, { status: 401 });
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (query.length < 2 || query.length > 40) return NextResponse.json({ total: 0, items: [] });
  try {
    const data = await loadDirectory(session);
    const items = data.items
      .filter((item): item is NonNullable<typeof item> => item !== null && [item.id, item.name, item.englishName].some((field) => field.toLowerCase().includes(query)))
      .sort((a, b) => {
        const rank = (id: string) => id.toLowerCase() === `${query}.us` ? 0 : id.toLowerCase().startsWith(query) ? 1 : 2;
        return rank(a.id) - rank(b.id) || a.id.localeCompare(b.id);
      })
      .slice(0, 30);
    return NextResponse.json({ total: data.total, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Longbridge 授权已过期，请重新连接。" }, { status: 401 });
    return NextResponse.json({ error: "证券搜索暂时不可用，请稍后重试。" }, { status: 502 });
  }
}
