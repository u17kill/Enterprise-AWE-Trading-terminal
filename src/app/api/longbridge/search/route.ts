import { NextRequest, NextResponse } from "next/server";
import { fromLongbridgeSecurity, isUsStockId } from "../../../../lib/custom-symbols";
import { callLongbridgeTool, getSession, hasLongbridgeToken, UnauthorizedError } from "../../../../lib/longbridge-mcp";
import { longbridgeCookieName } from "../../../../lib/longbridge-cookie";

export const runtime = "nodejs";

type Directory = { total: number; items: ReturnType<typeof fromLongbridgeSecurity>[] };
const directoryCache = globalThis as typeof globalThis & { __aweUsDirectory?: { loadedAt: number; value: Promise<Directory> } };

async function readSecurityPage(session: NonNullable<ReturnType<typeof getSession>>, page: number) {
  try {
    const raw = await callLongbridgeTool(session, "security_list", { market: "US", page, count: 200 });
    const data = raw && typeof raw === "object" ? raw as { total?: unknown; items?: unknown } : {};
    if (typeof data.total !== "number" || !Array.isArray(data.items)) throw new Error("Incomplete security directory page");
    return { total: data.total, items: data.items };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    const parts = await Promise.all([page * 2 - 1, page * 2].map((smallPage) =>
      callLongbridgeTool(session, "security_list", { market: "US", page: smallPage, count: 100 })));
    const parsed = parts.map((raw) => raw && typeof raw === "object" ? raw as { total?: unknown; items?: unknown } : {});
    if (parsed.some((item) => typeof item.total !== "number" || !Array.isArray(item.items))) throw new Error("Incomplete security directory page");
    return { total: parsed[0].total as number, items: parsed.flatMap((item) => item.items as unknown[]) };
  }
}

async function loadDirectory(session: NonNullable<ReturnType<typeof getSession>>): Promise<Directory> {
  const cached = directoryCache.__aweUsDirectory;
  if (cached && Date.now() - cached.loadedAt < 10 * 60_000) return cached.value;
  const value = (async () => {
    const first = await readSecurityPage(session, 1);
    const total = Math.min(first.total, 20_000);
    const all = [...first.items];
    const pages = Math.ceil(total / 200);
    for (let start = 2; start <= pages; start += 4) {
      const batch = await Promise.all(Array.from({ length: Math.min(4, pages - start + 1) }, (_, offset) => readSecurityPage(session, start + offset)));
      for (const data of batch) all.push(...data.items);
    }
    return { total, items: all.map((item) => item && typeof item === "object" ? fromLongbridgeSecurity(item) : null) };
  })();
  directoryCache.__aweUsDirectory = { loadedAt: Date.now(), value };
  try { return await value; }
  catch (error) { delete directoryCache.__aweUsDirectory; throw error; }
}

export async function GET(request: NextRequest) {
  const session = getSession(request.cookies.get(longbridgeCookieName(request))?.value);
  if (!session || !hasLongbridgeToken(session)) return NextResponse.json({ error: "请先连接 Longbridge。" }, { status: 401 });
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (query.length < 2 || query.length > 40) return NextResponse.json({ total: 0, items: [] });
  try {
    const candidate = (query.endsWith(".us") ? query : `${query}.us`).toUpperCase();
    if (isUsStockId(candidate)) {
      const raw = await callLongbridgeTool(session, "static_info", { symbols: [candidate] });
      const exact = Array.isArray(raw) ? raw.map((item) => item && typeof item === "object" ? fromLongbridgeSecurity(item) : null).find((item) => item?.id === candidate) : null;
      if (exact) return NextResponse.json({ total: 1, items: [exact] }, { headers: { "Cache-Control": "no-store" } });
      if (query.length < 4) return NextResponse.json({ total: 0, items: [] }, { headers: { "Cache-Control": "no-store" } });
    }
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
