import { describe, expect, it } from "vitest";
import { findSymbol, searchSymbols } from "./catalog";

describe("symbol catalog", () => {
  it("finds a ticker without case sensitivity", () => {
    expect(findSymbol("aapl")?.id).toBe("AAPL");
  });

  it("searches Chinese names and ticker fragments", () => {
    expect(searchSymbols("黄金").map((symbol) => symbol.id)).toContain("XAUUSD");
    expect(searchSymbols("nas").map((symbol) => symbol.id)).toContain("NDX");
  });

  it("returns no symbols for an empty query", () => {
    expect(searchSymbols("  ")).toEqual([]);
  });
});
