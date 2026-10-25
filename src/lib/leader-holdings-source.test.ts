import { describe, expect, it, vi } from "vitest";
import { MANAGERS } from "./leader-holdings";
import { fetchManagerSnapshot, parseHoldingRows, parseManagerFilings, parseSecUrl, refreshSnapshots } from "./leader-holdings-source";

function page(form: string, href: string, period = "2026-06-30", filed = "2026-08-14") {
  return `<table id="managerFilings"><tbody><tr><td data-order="${period}"><a href="${href}">Q2 2026</a></td><td>2</td><td>1,200</td><td>AAPL</td><td title="${form}">${form}</td><td data-order="${filed}">8/14/2026</td><td>000119312526352200</td></tr></tbody></table>`;
}

describe("public 13F transfer source", () => {
  it("reads an ordinary filing and builds its traceable SEC URL", () => {
    const manager = MANAGERS.find((entry) => entry.cik === "0001067983")!;
    const filing = parseManagerFilings(page("13F-HR", "/13f/000119312526352200-berkshire-q2-2026"), manager);
    expect(filing).toMatchObject({ period: "2026-06-30", filedAt: "2026-08-14", accession: "000119312526352200", sourceCik: "0001067983", formType: "13F-HR" });
    expect(filing.secUrl).toBe("https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/0001193125-26-352200-index.htm");
  });

  it("follows Pershing's 13F-NT to the parent filing and marks Citadel's restatement", () => {
    const pershing = MANAGERS.find((entry) => entry.cik === "0001336528")!;
    const notice = parseManagerFilings(page("13F-NT", "/13f/000117266126003790-pershing-square-inc-q2-2026"), pershing);
    expect(notice).toMatchObject({ sourceCik: "0002026053", accession: "000117266126003790", formType: "13F-NT" });
    const citadel = MANAGERS.find((entry) => entry.cik === "0001423053")!;
    expect(parseManagerFilings(page("RESTATEMENT", "/13f/000110465926104387-citadel-q2-2026-restatement"), citadel).formType).toBe("RESTATEMENT");
  });

  it("separates options from reportable securities and keeps value units in thousands", () => {
    const rows = parseHoldingRows({ data: [["AAPL", "APPLE INC", "COM", "037833100", 1000, 50, 5000, null, null], ["DLR", "DIGITAL RLTY", "COM", "253868103", 400, 20, 100, null, "put"], ["QQQ", "INVESCO QQQ", "UNIT", "46090E103", 600, 30, 200, null, null]] });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ symbol: "AAPL", valueThousands: 1000, optionType: null });
    expect(rows[2]).toMatchObject({ symbol: "DLR", optionType: "put" });
    expect(() => parseHoldingRows({ data: [["bad"]] })).toThrow(/持仓/);
  });

  it("uses the original SEC index link, including its actual .html extension", () => {
    const manager = MANAGERS.find((entry) => entry.cik === "0002046333")!;
    const filing = parseManagerFilings(page("13F-HR", "/13f/000204633326000004-oriental-harbor-q3-2026"), manager);
    const url = "https://www.sec.gov/Archives/edgar/data/2046333/000204633326000004/0002046333-26-000004-index.html";
    expect(parseSecUrl(`<a href="${url}">View on sec.gov</a>`, filing)).toBe(url);
    expect(() => parseSecUrl('<a href="https://example.com/fake">View on sec.gov</a>', filing)).toThrow(/SEC/);
  });

  it("reuses an unchanged prior snapshot without downloading its table again", async () => {
    const manager = MANAGERS[0];
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, text: async () => page("13F-HR", "/13f/000119312526352200-berkshire-q2-2026") }).mockResolvedValueOnce({ ok: true, text: async () => '<a href="https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/0001193125-26-352200-index.htm">View on sec.gov</a>' }).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [["AAPL", "APPLE INC", "COM", "037833100", 1000, 100, 5000, null, null]] }) });
    const first = await fetchManagerSnapshot(manager, undefined, fetcher);
    expect(first.topHoldings).toHaveLength(1);
    expect(first.totalValueThousands).toBe(1200);
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockResolvedValueOnce({ ok: true, text: async () => page("13F-HR", "/13f/000119312526352200-berkshire-q2-2026") });
    const second = await fetchManagerSnapshot(manager, first, fetcher);
    expect(second.topHoldings).toEqual(first.topHoldings);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("keeps earlier holdings for a failed manager while updating the others", async () => {
    const previous = { cik: MANAGERS[0].cik, accession: "old", topHoldings: [{ symbol: "AAPL" }] };
    const get = vi.fn().mockRejectedValue(new Error("network unavailable"));
    const result = await refreshSnapshots([MANAGERS[0]], { [MANAGERS[0].cik]: previous } as never, get as never);
    expect(result.managers[MANAGERS[0].cik]).toEqual(previous);
    expect(result.failures).toEqual([MANAGERS[0].cik]);
  });
});
