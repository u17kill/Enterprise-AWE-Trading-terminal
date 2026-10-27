import { describe, expect, it } from "vitest";
import { buildCanaryAnalysis, mergeCanarySnapshot, parseCanarySnapshot, parseEcbDaily, parseMofJgb, parseMarginPair, parseTurnoverPair } from "./canary";

describe("canary readings", () => {
  it("retains a previously valid observation as stale when its source fails", () => {
    const previous = { refreshedAt: "2026-10-26T12:00:00Z", readings: { us10: { value: 4.1, unit: "%", asOf: "2026-10-26", source: "Treasury", sourceUrl: "https://home.treasury.gov", state: "unknown" as const, summary: "10Y" } }, errors: {} };
    const next = mergeCanarySnapshot(previous, { refreshedAt: "2026-10-27T12:00:00Z", readings: {}, errors: { us10: "HTTP 503" } });
    expect(next.readings.us10?.value).toBe(4.1);
    expect(next.readings.us10?.stale).toBe(true);
    expect(next.errors.us10).toBe("HTTP 503");
  });

  it("rejects fabricated or malformed stored readings", () => {
    expect(parseCanarySnapshot({ refreshedAt: "2026-10-27", readings: { us10: { value: NaN } }, errors: {} })?.readings.us10).toBeUndefined();
  });

  it("does not give a directional analysis based on stale observations", () => {
    const report = buildCanaryAnalysis({ refreshedAt: "2026-10-27T12:00:00Z", readings: { vix: { value: 34, unit: "点", asOf: "2026-10-01", source: "Cboe", sourceUrl: "https://www.cboe.com", state: "red", summary: "高波动", stale: true } }, errors: {} });
    expect(report.short.level).toBe("insufficient");
    expect(report.short.evidence).toHaveLength(0);
  });
});

describe("official source parsers", () => {
  it("calculates USD cross rates from one dated ECB observation", () => {
    const xml = `<gesmes:Envelope><Cube><Cube time='2026-10-26'><Cube currency='USD' rate='1.1188'/><Cube currency='JPY' rate='176.15'/><Cube currency='CNY' rate='7.4603'/></Cube></Cube></gesmes:Envelope>`;
    expect(parseEcbDaily(xml)).toEqual({ date: "2026-10-26", usdjpy: expect.closeTo(157.4455, 3), usdcny: expect.closeTo(6.6681, 3) });
  });

  it("takes the newest valid ten-year JGB observation", () => {
    const csv = "Interest Rate (October 2026),,,\nDate,1Y,2Y,10Y,30Y\n2026/10/3,1.1,1.2,2.75,3.1\n2026/10/26,1.1,1.2,2.824,3.2";
    expect(parseMofJgb(csv)).toEqual({ date: "2026-10-26", value: 2.824 });
  });

  it("only combines matching exchange dates and converts both balances to yuan", () => {
    const shanghai = { opDate: "20261026", rzrqjyzl: 1253341836748 };
    const shenzhen = [{ metadata: { subname: "2026-10-26" }, data: [{ jrrzrjye: "11,650.27" }] }];
    expect(parseMarginPair(shanghai, shenzhen)).toEqual({ date: "2026-10-26", value: expect.closeTo(2.418369, 4) });
    expect(parseMarginPair(shanghai, [{ metadata: { subname: "2026-10-23" }, data: { jrrzrjye: "11,650.27" } }])).toBeNull();
  });

  it("adds only A-share turnover segments from the same date", () => {
    const sh = { result: [
      { TRADE_DATE: "20261026", PRODUCT_CODE: "01", TRADE_AMT: "4895.72" },
      { TRADE_DATE: "20261026", PRODUCT_CODE: "02", TRADE_AMT: "0.99" },
      { TRADE_DATE: "20261026", PRODUCT_CODE: "03", TRADE_AMT: "2574.29" },
      { TRADE_DATE: "20261026", PRODUCT_CODE: "17", TRADE_AMT: "7471.0" },
    ] };
    const sz = [{ metadata: { subname: "2026-10-26" }, data: [
      { lbmc: "主板A股", cjje: "4,329.14" }, { lbmc: "主板B股", cjje: "0.32" }, { lbmc: "创业板A股", cjje: "4,300.51" },
    ] }];
    expect(parseTurnoverPair(sh, sz)).toEqual({ date: "2026-10-26", value: expect.closeTo(1.609966, 5) });
    expect(parseTurnoverPair(sh, [{ metadata: { subname: "2026-10-23" }, data: sz[0].data }])).toBeNull();
  });
});
