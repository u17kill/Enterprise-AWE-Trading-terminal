import { describe, expect, it } from "vitest";
import {
  DEFAULT_WATCHLIST,
  STORAGE_KEY,
  addSymbol,
  loadWatchlist,
  removeSymbol,
  saveWatchlist,
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

  it("saves the watchlist under a stable key", () => {
    let key = "";
    let value = "";
    saveWatchlist({ setItem: (k, v) => { key = k; value = v; } }, { macro: ["SPX"], stocks: [] });
    expect(key).toBe(STORAGE_KEY);
    expect(JSON.parse(value)).toEqual({ macro: ["SPX"], stocks: [] });
  });
});
