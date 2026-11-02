import { CANARY_INDICATORS, type CanaryBand } from "./canary";

export type CanaryOrder = Record<CanaryBand, string[]>;
export const CANARY_BANDS: CanaryBand[] = ["macro", "us", "china"];

const catalogIds = (band: CanaryBand) => CANARY_INDICATORS.filter((item) => item.band === band).map((item) => item.id);

export function normalizeCanaryOrder(raw: unknown): CanaryOrder {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const order = {} as CanaryOrder;
  for (const band of CANARY_BANDS) {
    const defaults = catalogIds(band);
    const allowed = new Set(defaults);
    const saved = Array.isArray(source[band]) ? source[band] : [];
    const kept = [...new Set(saved.filter((id): id is string => typeof id === "string" && allowed.has(id)))];
    order[band] = [...kept, ...defaults.filter((id) => !kept.includes(id))];
  }
  return order;
}

export function isCompleteCanaryOrder(raw: unknown): raw is CanaryOrder {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const input = raw as Record<string, unknown>;
  return CANARY_BANDS.every((band) => {
    const expected = catalogIds(band);
    return Array.isArray(input[band]) && input[band].length === expected.length &&
      input[band].every((id) => typeof id === "string" && expected.includes(id)) &&
      new Set(input[band]).size === expected.length;
  });
}

export function moveCanaryIndicator(order: CanaryOrder, band: CanaryBand, sourceId: string, targetId: string, after: boolean): CanaryOrder {
  const current = order[band];
  if (sourceId === targetId || !current.includes(sourceId) || !current.includes(targetId)) return order;
  const next = current.filter((id) => id !== sourceId);
  next.splice(next.indexOf(targetId) + (after ? 1 : 0), 0, sourceId);
  return { ...order, [band]: next };
}
