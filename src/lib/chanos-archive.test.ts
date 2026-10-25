import { describe, expect, it } from "vitest";
import { CHANOS_ARCHIVE } from "./chanos-archive";

describe("Chanos historical 13F common-share/ETF snapshot", () => {
  it("contains the seven non-option rows from the 2023 Q3 SEC information table", () => {
    expect(CHANOS_ARCHIVE.period).toBe("2023-09-30");
    expect(CHANOS_ARCHIVE.filedAt).toBe("2023-11-14");
    expect(CHANOS_ARCHIVE.holdings).toHaveLength(7);
    expect(CHANOS_ARCHIVE.holdings.reduce((sum, row) => sum + row.valueUsd, 0)).toBe(3_865_862);
    expect(CHANOS_ARCHIVE.holdings[0]).toMatchObject({ issuer: "SPDR SER TR", title: "S&P REGL BKG", shares: 49_786, valueUsd: 2_079_561 });
    expect(CHANOS_ARCHIVE.informationTableUrl).toContain("sec.gov/Archives/edgar/data/1446440/");
  });
});
