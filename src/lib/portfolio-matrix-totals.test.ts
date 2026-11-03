import { describe, expect, it } from "vitest";
import { calculateMatrixTotals, parseUsdKAmount } from "./portfolio-matrix-totals";
import type { PortfolioMatrix } from "./portfolio-matrix";

describe("V1.7 portfolio amount parsing", () => {
  it("accepts only complete k-denominated USD notes", () => {
    expect(parseUsdKAmount(" 1.5k ")).toBe(1500);
    expect(parseUsdKAmount("10K")).toBe(10000);
    expect(parseUsdKAmount("0k")).toBe(0);
    for (const note of ["", "text", "put 115", "2.7k–5", "5.5k-10", "950", "$1.5k", "1k note", "-1k", "1e3k"]) {
      expect(parseUsdKAmount(note)).toBeNull();
    }
  });
});

describe("V1.7 portfolio breakdowns", () => {
  const matrix: PortfolioMatrix = {
    groups: [{ id: "g1", name: "进攻", color: "#aaa" }, { id: "g2", name: "防御", color: "#bbb" }],
    columns: [{ id: "c1", groupId: "g1", name: "同名主题" }, { id: "c2", groupId: "g2", name: "同名主题" }],
    regions: [{ id: "us", name: "美国" }, { id: "cn", name: "中国" }],
    items: [
      { id: "held", columnId: "c1", regionId: "us", symbol: "A", name: "A", amount: "1.5k", status: "held" },
      { id: "add", columnId: "c1", regionId: "cn", symbol: "B", name: "B", amount: "10k", status: "add" },
      { id: "other", columnId: "c2", regionId: "us", symbol: "C", name: "C", amount: "2k", status: "held" },
      { id: "watch", columnId: "c2", regionId: "cn", symbol: "D", name: "D", amount: "8k", status: "watch" },
      { id: "option", columnId: "c2", regionId: "us", symbol: "PUT", name: "Put", amount: "put 115", status: "option" },
      { id: "range", columnId: "c1", regionId: "us", symbol: "E", name: "E", amount: "3k-5", status: "held" },
    ],
  };

  it("counts held and add amounts once across each axis, and separates options", () => {
    const result = calculateMatrixTotals(matrix);
    expect(result.totalUsd).toBe(13500);
    expect(result.includedCount).toBe(3);
    expect(result.groups).toEqual({ g1: 11500, g2: 2000 });
    expect(result.regions).toEqual({ us: 3500, cn: 10000 });
    expect(result.columns).toEqual({ c1: 11500, c2: 2000 });
    expect(result.cells).toEqual({ "c1:us": 1500, "c1:cn": 10000, "c2:us": 2000 });
    expect(result.optionItems.map((item) => item.id)).toEqual(["option"]);
  });

  it("recomputes when an item is edited or removed, without fabricating an empty cell amount", () => {
    const edited = { ...matrix, items: matrix.items.filter((item) => item.id !== "held").map((item) => item.id === "watch" ? { ...item, status: "held" as const } : item) };
    const result = calculateMatrixTotals(edited);
    expect(result.totalUsd).toBe(20000);
    expect(result.cells["c1:us"]).toBeUndefined();
    expect(result.cells["c2:cn"]).toBe(8000);
  });
});
