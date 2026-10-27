import { describe, expect, it } from "vitest";
import { buildCanaryAnalysis, mergeCanarySnapshot, parseCanarySnapshot, parseEcbDaily, parseMofJgb, parseMarginPair, parseTurnoverPair, parseShiborHistory, parseChinaTreasuryHistory, parseLimitPools, alignQuarterlyRatio, parseFactsetForwardReport, parseShillerMonthly, parseEtfMarketCapRatio } from "./canary";

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
  it("reads the latest dated overnight Shibor and skips invalid rows", () => {
    const raw = { records: [{ showDateCN: "2026-10-26", ON: "1.3010" }, { showDateCN: "2026-10-27", ON: "1.2810" }, { showDateCN: "2026-10-28", ON: "--" }] };
    expect(parseShiborHistory(raw)).toEqual({ date: "2026-10-27", value: 1.281, points: [1.301, 1.281] });
  });

  it("calculates the Chinese 30Y minus 2Y spread from the same Ministry of Finance curve row", () => {
    const raw = { flag: "0", heList: [{ workTime: "2026-10-26", twoYear: "1.24", tenYear: "1.64", thirtyYear: "2.06" }, { workTime: "2026-10-27", twoYear: "1.24", tenYear: "1.63", thirtyYear: "2.04" }] };
    expect(parseChinaTreasuryHistory(raw)).toEqual({ date: "2026-10-27", tenYear: 1.63, thirtyMinusTwo: 0.8, tenPoints: [1.64, 1.63], spreadPoints: [0.82, 0.8] });
    expect(parseChinaTreasuryHistory({ flag: "0", heList: [{ workTime: "2026-10-27", tenYear: "1.63", thirtyYear: "2.04" }] })).toBeNull();
  });

  it("uses both dated limit pools and rejects a missing down count", () => {
    const up = { rc: 0, data: { tc: 41, qdate: 20261027, pool: [{ c: "600000" }] } };
    const down = { rc: 0, data: { tc: 22, qdate: 20261027, pool: [] } };
    expect(parseLimitPools(up, down, "2026-10-27")).toEqual({ date: "2026-10-27", up: 41, down: 22 });
    expect(parseLimitPools(up, { rc: 0, data: { pool: [] } }, "2026-10-27")).toBeNull();
  });

  it("aligns quarterly US equity liabilities with GDP before computing a market-cap ratio", () => {
    const equity = [{ date: "2026-01-01", value: 106_000_000 }, { date: "2026-04-01", value: 123_000_000 }];
    const gdp = [{ date: "2026-01-01", value: 31_000 }, { date: "2026-04-01", value: 32_000 }];
    expect(alignQuarterlyRatio(equity, gdp)).toEqual({ date: "2026-04-01", value: 384.375, points: [expect.closeTo(341.935, 3), 384.375] });
    expect(alignQuarterlyRatio(equity, [{ date: "2025-10-01", value: 30_000 }])).toBeNull();
  });

  it("extracts a dated forward PE only from FactSet's own S&P 500 earnings update", () => {
    const rss = `<rss><channel><item><title>S&amp;P 500 Earnings Season Update: October 23, 2026</title><link>https://insight.factset.com/sp-500-earnings-season-update-october-23-2026</link><pubDate>Fri, 23 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>`;
    const article = `<p>The forward 12-month P/E ratio is 18.7, below the 5-year average (19.8).</p>`;
    expect(parseFactsetForwardReport(rss, article)).toEqual({ date: "2026-10-23", value: 18.7, sourceUrl: "https://insight.factset.com/sp-500-earnings-season-update-october-23-2026" });
    expect(parseFactsetForwardReport(rss, `<p>The trailing 12-month P/E ratio is 18.7.</p>`)).toBeNull();
  });

  it("keeps CAPE and trailing PE on their own monthly observation dates", () => {
    const raw = { data: [
      { date_string: "2026-06-01", sp500: 7450, earnings: 295, cape: 40.1 },
      { date_string: "2026-09-01", sp500: 7600, earnings: null, cape: 41.2 },
      { date_string: "2026-10-01", sp500: 7700, earnings: null, cape: 40.7 },
    ] };
    expect(parseShillerMonthly(raw)).toEqual({ cape: { date: "2026-10-01", value: 40.7, points: [40.1, 41.2, 40.7] }, trailingPe: { date: "2026-06-01", value: expect.closeTo(25.254, 3), points: [expect.closeTo(25.254, 3)] } });
  });

  it("divides four ETF market values by the CSI 300 total market value on one quote date", () => {
    const codes = ["510300", "510330", "159919", "510310", "000300"];
    const rows = codes.map((code, index) => ({ data: { f57: code, f116: index === 4 ? 1000 : 10 * (index + 1) } }));
    const quotes = { data: { diff: codes.map((code) => ({ f12: code, f124: 1793088702 })) } };
    expect(parseEtfMarketCapRatio(rows, quotes)).toEqual({ date: "2026-10-27", value: 10 });
    expect(parseEtfMarketCapRatio(rows.slice(1), quotes)).toBeNull();
  });
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
