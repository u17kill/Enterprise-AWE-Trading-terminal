export const LIGHTS_KEY = "awe.five-lights.v1";
export const FIVE_LIGHTS = [
  { id: "volatility", label: "波动", hint: "VIX 与期限结构" },
  { id: "breadth", label: "市场宽度", hint: "MA50/MA200 与等权表现" },
  { id: "liquidity", label: "流动性 / 信用", hint: "利差与融资条件" },
  { id: "crowding", label: "拥挤度", hint: "热门主题集中度" },
  { id: "leverage", label: "杠杆", hint: "保证金与强平压力" },
] as const;
export type LightId = typeof FIVE_LIGHTS[number]["id"];
export type LightState = "green" | "amber" | "red" | "unknown";
export type LightEntry = { state: LightState; note: string; updatedAt: string };
export type Lights = Record<LightId, LightEntry>;

export function parseLights(raw: unknown): Lights {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return Object.fromEntries(FIVE_LIGHTS.map(({ id }) => {
    const value = record[id] && typeof record[id] === "object" ? record[id] as Record<string, unknown> : {};
    const state = (["green", "amber", "red"] as string[]).includes(String(value.state)) ? value.state as LightState : "unknown";
    return [id, { state, note: typeof value.note === "string" ? value.note.slice(0, 500) : "", updatedAt: typeof value.updatedAt === "string" && /^\d{4}-\d\d-\d\d$/.test(value.updatedAt) ? value.updatedAt : "" }];
  })) as Lights;
}
export function loadLights(storage: Pick<Storage, "getItem">): Lights {
  try { const raw = storage.getItem(LIGHTS_KEY); return raw ? parseLights(JSON.parse(raw)) : parseLights(null); }
  catch { return parseLights(null); }
}
