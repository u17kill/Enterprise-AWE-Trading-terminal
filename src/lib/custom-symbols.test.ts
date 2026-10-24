import { describe, expect, it } from "vitest";
import { fromLongbridgeSecurity, loadCustomSymbols, saveCustomSymbol } from "./custom-symbols";

describe("custom Longbridge symbols", () => {
  it("accepts a US security with a name and canonical symbol", () => {
    expect(fromLongbridgeSecurity({ symbol: "ADBE.US", name_cn: "Adobe", name_en: "Adobe Inc." })).toMatchObject({ id: "ADBE.US", name: "Adobe", englishName: "Adobe Inc.", group: "stocks", source: "longbridge" });
    expect(fromLongbridgeSecurity({ symbol: "invalid/path", name_en: "Wrong" })).toBeNull();
  });

  it("persists selected securities and ignores malformed stored records", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const symbol = fromLongbridgeSecurity({ symbol: "ADBE.US", name_cn: "Adobe", name_en: "Adobe Inc." })!;
    saveCustomSymbol(storage, symbol);
    expect(loadCustomSymbols(storage)["ADBE.US"]).toMatchObject({ name: "Adobe" });
    data.set("awe.custom-symbols.v1", JSON.stringify({ "ADBE.US": { id: "wrong" } }));
    expect(loadCustomSymbols(storage)).toEqual({});
  });
});
