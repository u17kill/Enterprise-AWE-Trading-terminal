import { describe, expect, it } from "vitest";
import type { PortfolioMatrix } from "./portfolio-matrix";
import { calculateMatrixTotals } from "./portfolio-matrix-totals";
import { buildPortfolioVisuals, layoutTreemap } from "./portfolio-matrix-visuals";

const matrix: PortfolioMatrix = {
  groups: [{ id: "attack", name: "进攻", color: "#70d5a2" }, { id: "defense", name: "防御", color: "#ee8d8c" }],
  regions: [{ id: "us", name: "美国" }, { id: "cn", name: "中国" }],
  columns: [{ id: "first", groupId: "attack", name: "同名主题" }, { id: "second", groupId: "defense", name: "同名主题" }],
  items: [
    { id: "a", columnId: "first", regionId: "us", symbol: "A", name: "A", amount: "6k", status: "held" },
    { id: "b", columnId: "first", regionId: "cn", symbol: "B", name: "B", amount: "3k", status: "add" },
    { id: "c", columnId: "second", regionId: "us", symbol: "C", name: "C", amount: "1k", status: "held" },
    { id: "watch", columnId: "second", regionId: "us", symbol: "D", name: "D", amount: "9k", status: "watch" },
    { id: "option", columnId: "second", regionId: "cn", symbol: "PUT", name: "PUT", amount: "2k", status: "option" },
  ],
};

describe("V1.9 portfolio visual derivation", () => {
  it("uses the existing totals for all three independent breakdowns", () => {
    const visuals = buildPortfolioVisuals(matrix, calculateMatrixTotals(matrix));
    expect(visuals.totalUsd).toBe(10000);
    expect(visuals.strategies.map((item) => [item.amount, item.share])).toEqual([[9000, 90], [1000, 10]]);
    expect(visuals.regions.map((item) => [item.amount, item.share])).toEqual([[7000, 70], [3000, 30]]);
    expect(visuals.themes.map((item) => item.label)).toEqual(["进攻 / 同名主题", "防御 / 同名主题"]);
    for (const axis of [visuals.strategies, visuals.regions, visuals.themes]) expect(axis.reduce((sum, item) => sum + item.amount, 0)).toBe(visuals.totalUsd);
  });

  it("keeps an empty portfolio empty without dividing by zero", () => {
    const empty = { ...matrix, items: matrix.items.filter((item) => item.status === "watch" || item.status === "option") };
    const visuals = buildPortfolioVisuals(empty, calculateMatrixTotals(empty));
    expect(visuals.totalUsd).toBe(0);
    expect(visuals.regions).toEqual([]);
    expect(visuals.strategies).toEqual([]);
    expect(visuals.themes).toEqual([]);
  });

  it("allocates treemap area in proportion to amounts without overlaps", () => {
    const boxes = layoutTreemap([{ id: "a", amount: 60 }, { id: "b", amount: 30 }, { id: "c", amount: 10 }]);
    expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      const expected = { a: 6000, b: 3000, c: 1000 }[box.id as "a" | "b" | "c"];
      expect(box.width * box.height).toBeCloseTo(expected, 5);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(100.000001);
      expect(box.y + box.height).toBeLessThanOrEqual(100.000001);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const overlapX = Math.max(0, Math.min(boxes[i].x + boxes[i].width, boxes[j].x + boxes[j].width) - Math.max(boxes[i].x, boxes[j].x));
      const overlapY = Math.max(0, Math.min(boxes[i].y + boxes[i].height, boxes[j].y + boxes[j].height) - Math.max(boxes[i].y, boxes[j].y));
      expect(overlapX * overlapY).toBeCloseTo(0, 5);
    }
  });
});
