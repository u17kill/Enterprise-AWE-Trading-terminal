import { describe, expect, it } from "vitest";
import {
  DEFAULT_WATCHLIST,
  STORAGE_KEY,
  addSymbol,
  loadWatchlist,
  removeSymbol,
  saveWatchlist,
  migrateV13Watchlist,
} from "./watchlist";

describe("watchlist", () => {
  it("uses defaults when storage is missing or malformed", () => {
    expect(loadWatchlist({ getItem: () => null })).toEqual(DEFAULT_WATCHLIST);
    expect(loadWatchlist({ getItem: () => "not-json" })).toEqual(DEFAULT_WATCHLIST);
  });

  it("drops unknown, duplicate and wrong-category symbols from saved data", () => {
    const raw = JSON.stringify({ macro: ["SPX", "SPX", "BAD", "AAPL"], stocks: ["AAPL", "SPX"] });
    expect(loadWatchlist({ getItem: () => raw })).toEqual({ macro: ["SPX"], stocks: ["AAPL"] });
  });

  it("adds a symbol once to its own category and removes it", () => {
    const added = addSymbol({ macro: [], stocks: [] }, "AAPL");
    expect(added).toEqual({ macro: [], stocks: ["AAPL"] });
    expect(addSymbol(added, "AAPL")).toEqual(added);
    expect(removeSymbol(added, "AAPL")).toEqual({ macro: [], stocks: [] });
  });

  it("keeps a valid Longbridge US symbol after reload", () => {
    const next = addSymbol(DEFAULT_WATCHLIST, "ADBE.US");
    expect(next.stocks).toContain("ADBE.US");
    expect(loadWatchlist({ getItem: () => JSON.stringify(next) }).stocks).toContain("ADBE.US");
  });

  it("saves the watchlist under a stable key", () => {
    let key = "";
    let value = "";
    saveWatchlist({ setItem: (k, v) => { key = k; value = v; } }, { macro: ["SPX"], stocks: [] });
    expect(key).toBe(STORAGE_KEY);
    expect(JSON.parse(value)).toEqual({ macro: ["SPX"], stocks: [] });
  });

  it("adds six requested global indexes to an existing watchlist once", () => {
    const saved = { macro: ["SPX", "NDX", "XAUUSD", "US10Y", "DJI", "BTCUSD"], stocks: ["AAPL"] };
    const next = migrateV13Watchlist(saved);
    expect(next.macro).toEqual(["SPX", "NDX", "XAUUSD", "US10Y", "DJI", "BTCUSD", "N225", "KOSPI", "SSE", "HSI", "HSTECH", "A500"]);
    expect(migrateV13Watchlist(next)).toEqual(next);
  });
});
