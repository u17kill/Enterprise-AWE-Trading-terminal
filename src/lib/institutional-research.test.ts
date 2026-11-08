import { describe, expect, it } from "vitest";
import { buildResearchSnapshot, filterResearchSnapshot, parseResearchDataset } from "./institutional-research";

const sample = {
  as_of: "2026-11-08",
  topics: [{ id: "macro", name: "宏观 · 各国经济", desc: "各国经济", note: "增长与通胀" }, { id: "ai", name: "AI 产业", desc: "算力", note: "产业链" }],
  insts: [{ id: "gs", cn: "高盛", en: "Goldman Sachs", grp: "us", kind: "投行", focus: "宏观" }, { id: "jpm", cn: "摩根大通", en: "J.P. Morgan", grp: "us", kind: "投行", focus: "AI" }],
  reports: [
    { id: "old", inst: "gs", topic: "macro", scope: "美国", date: "2026-08-07", title: "过期报告", thesis: "旧结论", pts: ["旧论据"], tag: "neutral", call: "旧判断", src: "高盛 8/7" },
    { id: "one", inst: "gs", topic: "macro", scope: "美国", date: "2026-08-08", title: "边界报告", thesis: "结论一", pts: ["论据一"], tag: "bull", call: "增长 2%", src: "高盛 8/8" },
    { id: "two", inst: "gs", topic: "macro", scope: "美国", date: "2026-11-02", title: "第二篇", thesis: "结论二", pts: ["论据二"], tag: "neutral", call: "先防守", src: "高盛 11/2" },
    { id: "three", inst: "jpm", topic: "ai", scope: "全球", date: "2026-10-01", title: "AI 报告", thesis: "结论三", pts: ["论据三"], tag: "bear", call: "需求放缓", src: "摩根大通 10/1" },
  ],
};

describe("institutional research data", () => {
  it("rejects invalid references and duplicate report IDs before display", () => {
    expect(() => parseResearchDataset({ ...sample, reports: [...sample.reports, { ...sample.reports[0], id: "one" }] })).toThrow();
    expect(() => parseResearchDataset({ ...sample, reports: [{ ...sample.reports[0], topic: "missing" }] })).toThrow();
    expect(() => parseResearchDataset({ ...sample, reports: [{ ...sample.reports[0], date: "2026-02-30" }] })).toThrow();
  });

  it("uses an inclusive three-calendar-month window and counts a multi-report cell once", () => {
    const snapshot = buildResearchSnapshot(parseResearchDataset(sample), "2026-11-08");
    expect(snapshot.windowStart).toBe("2026-08-08");
    expect(snapshot.reports.map((item) => item.id)).toEqual(["two", "three", "one"]);
    expect(snapshot.stats).toMatchObject({ reports: 3, institutions: 2, coveredInstitutions: 2, coveredCells: 2, possibleCells: 4 });
    expect(snapshot.topicStats.macro).toMatchObject({ reports: 2, institutions: 1 });
  });

  it("reapplies the window when an older valid snapshot is used after refresh failure", () => {
    const initial = buildResearchSnapshot(parseResearchDataset(sample), "2026-11-08");
    const later = filterResearchSnapshot(initial, "2027-03-01");
    expect(later.reports).toHaveLength(0);
    expect(later.stats.coveredCells).toBe(0);
  });

  it("clamps the cutoff at the end of a short month", () => {
    const snapshot = buildResearchSnapshot(parseResearchDataset(sample), "2026-05-31");
    expect(snapshot.windowStart).toBe("2026-02-28");
  });
});
