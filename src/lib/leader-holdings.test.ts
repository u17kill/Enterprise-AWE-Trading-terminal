import { describe, expect, it } from "vitest";
import { filterManagers, GROUPS, MANAGERS } from "./leader-holdings";
import seed from "../data/leader-holdings-seed.json";

describe("V0.7 13F institution directory", () => {
  it("contains 30 unique filing subjects and preserves Chanos as a historical filing", () => {
    expect(MANAGERS).toHaveLength(30);
    expect(new Set(MANAGERS.map((manager) => manager.cik)).size).toBe(30);
    const chanos = MANAGERS.find((manager) => manager.cik === "0001446440");
    expect(chanos).toMatchObject({ name: "Jim Chanos · Chanos & Co", group: "macro", historical: true, lastVerifiedPeriod: "2023-09-30", lastVerifiedFiledAt: "2023-11-14" });
    expect(chanos?.secUrl).toContain("sec.gov/Archives/edgar/data/1446440/");
  });

  it("includes Gavin Baker's Atreides 13F in growth and technology with a filed snapshot", () => {
    expect(filterManagers("growth", "Gavin Baker")).toMatchObject([{ cik: "0001777813", filer: "Atreides Management, LP" }]);
    const snapshot = seed.managers["0001777813"];
    expect(snapshot).toMatchObject({ cik: "0001777813", period: "2026-06-30", filedAt: "2026-08-14", formType: "13F-HR" });
    expect(snapshot.secUrl).toContain("sec.gov/Archives/edgar/data/1777813/");
    expect(snapshot.topHoldings.length).toBeGreaterThan(0);
  });

  it("filters by group, English name, Chinese name, and CIK", () => {
    expect(GROUPS).toHaveLength(4);
    expect(filterManagers("macro", "Chanos").map((manager) => manager.cik)).toEqual(["0001446440"]);
    expect(filterManagers("all", "查诺斯").map((manager) => manager.cik)).toEqual(["0001446440"]);
    expect(filterManagers("all", "1446440").map((manager) => manager.cik)).toEqual(["0001446440"]);
    expect(filterManagers("value", "Chanos")).toEqual([]);
  });
});
