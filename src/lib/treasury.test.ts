import { describe, expect, it } from "vitest";
import { parseTreasuryYieldXml, treasuryMarketData } from "./treasury";

const xml = `<feed><entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">2026-10-21T00:00:00</d:NEW_DATE><d:BC_10YEAR m:type="Edm.Double">4.12</d:BC_10YEAR></m:properties></content></entry><entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">2026-10-22T00:00:00</d:NEW_DATE><d:BC_10YEAR m:type="Edm.Double">4.16</d:BC_10YEAR></m:properties></content></entry></feed>`;
describe("Treasury daily 10Y yield", () => {
  it("parses dated official observations and changes in basis points", () => {
    expect(parseTreasuryYieldXml(xml)).toEqual([{ date: "2026-10-21", yieldPercent: 4.12 }, { date: "2026-10-22", yieldPercent: 4.16 }]);
    expect(treasuryMarketData(parseTreasuryYieldXml(xml)).quote).toMatchObject({ value: 4.16, changeBasisPoints: 4, source: "US Treasury daily" });
  });
  it("ignores blank rates instead of treating them as zero", () => {
    expect(parseTreasuryYieldXml(xml.replace("4.16", ""))).toEqual([{ date: "2026-10-21", yieldPercent: 4.12 }]);
  });
});
