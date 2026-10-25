import { describe, expect, it } from "vitest";
import { filterManagers, GROUPS, MANAGERS } from "./leader-holdings";

describe("V0.7 13F institution directory", () => {
  it("contains 29 unique filing subjects and preserves Chanos as a historical filing", () => {
    expect(MANAGERS).toHaveLength(29);
    expect(new Set(MANAGERS.map((manager) => manager.cik)).size).toBe(29);
    const chanos = MANAGERS.find((manager) => manager.cik === "0001446440");
    expect(chanos).toMatchObject({ name: "Jim Chanos · Chanos & Co", group: "macro", historical: true, lastVerifiedPeriod: "2023-09-30", lastVerifiedFiledAt: "2023-11-14" });
    expect(chanos?.secUrl).toContain("sec.gov/Archives/edgar/data/1446440/");
  });

  it("filters by group, English name, Chinese name, and CIK", () => {
    expect(GROUPS).toHaveLength(4);
    expect(filterManagers("macro", "Chanos").map((manager) => manager.cik)).toEqual(["0001446440"]);
    expect(filterManagers("all", "查诺斯").map((manager) => manager.cik)).toEqual(["0001446440"]);
    expect(filterManagers("all", "1446440").map((manager) => manager.cik)).toEqual(["0001446440"]);
    expect(filterManagers("value", "Chanos")).toEqual([]);
  });
});
