import type { MarketSymbol } from "./catalog";
import { toLongbridgeSymbol } from "./longbridge-data";

export const CUSTOM_SYMBOLS_KEY = "awe.custom-symbols.v1";

type Security = { symbol?: unknown; name_cn?: unknown; name_en?: unknown };

export function isUsStockId(id: string): boolean {
  return id.endsWith(".US") && toLongbridgeSymbol(id) === id;
}

export function fromLongbridgeSecurity(value: Security): MarketSymbol | null {
  if (typeof value.symbol !== "string" || !isUsStockId(value.symbol)) return null;
  const chinese = typeof value.name_cn === "string" ? value.name_cn.trim().slice(0, 120) : "";
  const english = typeof value.name_en === "string" ? value.name_en.trim().slice(0, 120) : "";
  const name = chinese || english || value.symbol;
  return {
    id: value.symbol, name, englishName: english || name, category: "美股", group: "stocks", unit: "美元",
    sampleValue: "", sampleChange: "", trend: [], color: "blue", source: "longbridge",
  };
}

export function fallbackCustomSymbol(id: string, name?: string): MarketSymbol | null {
  return isUsStockId(id) ? fromLongbridgeSecurity({ symbol: id, name_cn: name }) : null;
}

export function loadCustomSymbols(storage: Pick<Storage, "getItem">): Record<string, MarketSymbol> {
  try {
    const raw = storage.getItem(CUSTOM_SYMBOLS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, MarketSymbol> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const item = value as Record<string, unknown>;
      if (item.id !== id || item.source !== "longbridge" || typeof item.name !== "string") continue;
      const symbol = fromLongbridgeSecurity({ symbol: id, name_cn: item.name, name_en: item.englishName });
      if (symbol) result[id] = symbol;
    }
    return result;
  } catch { return {}; }
}

export function saveCustomSymbol(storage: Pick<Storage, "getItem" | "setItem">, symbol: MarketSymbol): void {
  if (!isUsStockId(symbol.id)) return;
  storage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify({ ...loadCustomSymbols(storage), [symbol.id]: symbol }));
}
