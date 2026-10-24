import { findSymbol, type SymbolGroup } from "./catalog";

export type Watchlist = Record<SymbolGroup, string[]>;
export const STORAGE_KEY = "awe.watchlist.v1";
export const DEFAULT_WATCHLIST: Watchlist = {
  macro: ["SPX", "NDX", "XAUUSD", "US10Y"],
  stocks: ["AAPL", "NVDA", "MSFT", "TSLA"],
};

function normalize(value: unknown): Watchlist {
  if (!value || typeof value !== "object") return DEFAULT_WATCHLIST;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.macro) || !Array.isArray(record.stocks)) return DEFAULT_WATCHLIST;
  const valid = (group: SymbolGroup) => [...new Set((record[group] as unknown[]).filter(
    (id): id is string => typeof id === "string" && findSymbol(id)?.group === group,
  ))];
  return { macro: valid("macro"), stocks: valid("stocks") };
}

export function loadWatchlist(storage: Pick<Storage, "getItem">): Watchlist {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw === null ? DEFAULT_WATCHLIST : normalize(JSON.parse(raw));
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

export function saveWatchlist(storage: Pick<Storage, "setItem">, watchlist: Watchlist): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
}

export function addSymbol(watchlist: Watchlist, id: string): Watchlist {
  const symbol = findSymbol(id);
  if (!symbol || watchlist[symbol.group].includes(symbol.id)) return watchlist;
  return { ...watchlist, [symbol.group]: [...watchlist[symbol.group], symbol.id] };
}

export function removeSymbol(watchlist: Watchlist, id: string): Watchlist {
  return {
    macro: watchlist.macro.filter((item) => item !== id),
    stocks: watchlist.stocks.filter((item) => item !== id),
  };
}
