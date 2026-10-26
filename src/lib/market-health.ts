export const HEALTH_IDS = ["volatility", "breadth", "liquidity", "crowding", "leverage", "yieldCurve", "equalWeight", "putCall", "fearGreed"] as const;
export type HealthId = typeof HEALTH_IDS[number];
export type HealthState = "green" | "amber" | "red" | "unknown";
export type HealthReading = {
  value: number;
  unit: string;
  asOf: string;
  source: string;
  sourceUrl: string;
  state: HealthState;
  summary: string;
  detail?: string;
  points?: number[];
  secondaryPoints?: number[];
  secondaryValue?: number;
  stale?: boolean;
};
export type HealthSnapshot = {
  refreshedAt: string;
  readings: Partial<Record<HealthId, HealthReading>>;
  errors: Partial<Record<HealthId, string>>;
};
export const HEALTH_STORAGE_KEY = "awe.market-health.v09";

export function classifyVix(vix: number): HealthState {
  if (!Number.isFinite(vix) || vix < 0) return "unknown";
  return vix < 20 ? "green" : vix <= 30 ? "amber" : "red";
}

export function classifyOas(current: number, fourWeeksAgo: number | null): HealthState {
  if (!Number.isFinite(current) || current < 0) return "unknown";
  if (fourWeeksAgo !== null && Number.isFinite(fourWeeksAgo) && current - fourWeeksAgo > 1) return "red";
  return current < 4 ? "green" : current <= 5 ? "amber" : "red";
}

export function percentileRank(value: number, sample: number[]): number | null {
  const valid = sample.filter(Number.isFinite);
  if (!Number.isFinite(value) || valid.length === 0) return null;
  return 100 * valid.filter((item) => item <= value).length / valid.length;
}

export function classifyPercentile(percentile: number | null): HealthState {
  if (percentile === null || !Number.isFinite(percentile) || percentile < 0 || percentile > 100) return "unknown";
  if (percentile < 5 || percentile > 95) return "red";
  if (percentile < 20 || percentile >= 80) return "amber";
  return "green";
}

export function mergeHealthSnapshot(previous: HealthSnapshot | null, incoming: HealthSnapshot): HealthSnapshot {
  const readings: HealthSnapshot["readings"] = { ...previous?.readings };
  for (const id of HEALTH_IDS) {
    if (incoming.readings[id]) readings[id] = { ...incoming.readings[id], stale: false };
    else if (readings[id]) readings[id] = { ...readings[id], stale: true };
  }
  return { refreshedAt: incoming.refreshedAt, readings, errors: incoming.errors };
}

export function parseHealthSnapshot(raw: unknown): HealthSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.refreshedAt !== "string" || !Number.isFinite(Date.parse(item.refreshedAt))) return null;
  const source = item.readings && typeof item.readings === "object" && !Array.isArray(item.readings) ? item.readings as Record<string, unknown> : {};
  const readings: HealthSnapshot["readings"] = {};
  for (const id of HEALTH_IDS) {
    const value = source[id];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const reading = value as Record<string, unknown>;
    if (typeof reading.value !== "number" || !Number.isFinite(reading.value) || typeof reading.asOf !== "string" || !Number.isFinite(Date.parse(reading.asOf)) || typeof reading.source !== "string" || typeof reading.sourceUrl !== "string" || !/^https:\/\//.test(reading.sourceUrl) || typeof reading.summary !== "string") continue;
    readings[id] = { value: reading.value, unit: typeof reading.unit === "string" ? reading.unit : "", asOf: reading.asOf, source: reading.source, sourceUrl: reading.sourceUrl, summary: reading.summary, state: ["green", "amber", "red", "unknown"].includes(String(reading.state)) ? reading.state as HealthState : "unknown", stale: Boolean(reading.stale), detail: typeof reading.detail === "string" ? reading.detail : undefined, points: Array.isArray(reading.points) ? reading.points.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).slice(-80) : undefined, secondaryPoints: Array.isArray(reading.secondaryPoints) ? reading.secondaryPoints.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).slice(-80) : undefined, secondaryValue: typeof reading.secondaryValue === "number" && Number.isFinite(reading.secondaryValue) ? reading.secondaryValue : undefined };
  }
  const rawErrors = item.errors && typeof item.errors === "object" && !Array.isArray(item.errors) ? item.errors as Record<string, unknown> : {};
  const errors: HealthSnapshot["errors"] = {};
  for (const id of HEALTH_IDS) if (typeof rawErrors[id] === "string") errors[id] = rawErrors[id].slice(0, 300);
  return { refreshedAt: item.refreshedAt, readings, errors };
}
