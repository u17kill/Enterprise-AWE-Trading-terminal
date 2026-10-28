import { describe, expect, it } from "vitest";
import { parseNextFedHike25 } from "./fedwatch";

const sample = `FedWatch Tool
28 10月26
MEETING INFORMATION
MEETING DATE\tCONTRACT\tEXPIRES
28 10月 2026\tZQV6\t30 10月 2026
PROBABILITIES
EASE\tNO CHANGE\tHIKE
0.0%\t90.6%\t9.4%
Target Rate Probabilities for 28 10月 2026 Fed Meeting
Current target rate is 375-400
TARGET RATE (BPS)\tPROBABILITY(%)
NOW *\t1 DAY
375-400 (Current)\t90.6%\t88.9%
400-425\t9.4%\t11.1%
* Data as of 27 10月 2026 11:11:07 CT`;

describe("CME next-meeting hike parser", () => {
  it("selects exactly the +25bp target-rate row, not all hikes or later meetings", () => {
    expect(parseNextFedHike25(sample)).toEqual({
      meetingDate: "2026-10-28", asOf: "2026-10-27", value: 9.4,
      currentRange: "375–400", targetRange: "400–425",
    });
  });

  it("rejects an incomplete table or an absent +25bp row", () => {
    expect(parseNextFedHike25(sample.replace("400-425\t9.4%\t11.1%", "425-450\t9.4%\t11.1%"))).toBeNull();
    expect(parseNextFedHike25(sample.replace("Current target rate is 375-400", ""))).toBeNull();
  });

  it("accepts the English CME rendering", () => {
    expect(parseNextFedHike25(sample.replaceAll("10月", "Oct"))?.value).toBe(9.4);
  });
});
