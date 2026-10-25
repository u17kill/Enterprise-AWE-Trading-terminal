import seed from "../../../../data/leader-holdings-seed.json";
import { MANAGERS } from "../../../../lib/leader-holdings";
import { refreshSnapshots, type ManagerSnapshot } from "../../../../lib/leader-holdings-source";

export const runtime = "nodejs";

let latest: Record<string, ManagerSnapshot> = seed.managers as Record<string, ManagerSnapshot>;

export async function GET() {
  const result = await refreshSnapshots(MANAGERS, latest);
  latest = result.managers;
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
