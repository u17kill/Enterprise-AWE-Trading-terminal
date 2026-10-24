import { describe, expect, it } from "vitest";
import { DEFAULT_MATRIX, parseMatrix, validateMatrixBackup } from "./portfolio-matrix";

describe("V0.3 portfolio matrix", () => {
  it("starts with the screenshot's strategies, themes, regions and status colors", () => {
    expect(DEFAULT_MATRIX.groups.map((group) => group.name)).toEqual(["进攻", "均衡", "防御"]);
    expect(DEFAULT_MATRIX.columns).toHaveLength(14);
    expect(DEFAULT_MATRIX.regions.map((region) => region.name)).toEqual(["美国", "中国", "日韩台印", "欧洲"]);
    expect(DEFAULT_MATRIX.items.find((item) => item.symbol === "NVDA")).toMatchObject({ amount: "9.5k", status: "held", regionId: "us" });
    expect(DEFAULT_MATRIX.items.find((item) => item.symbol === "XOM")).toMatchObject({ status: "watch" });
    expect(DEFAULT_MATRIX.items.find((item) => item.symbol === "DRAM")).toMatchObject({ status: "add" });
  });

  it("rejects broken references and invalid tile states without touching the default", () => {
    const parsed = parseMatrix({ ...DEFAULT_MATRIX, items: [
      { id: "good", columnId: "ai-infra", regionId: "us", symbol: "NVDA", name: "英伟达", amount: "9.5k", status: "held" },
      { id: "bad-region", columnId: "ai-infra", regionId: "missing", symbol: "BAD", name: "Bad", amount: "1k", status: "held" },
      { id: "bad-status", columnId: "ai-infra", regionId: "us", symbol: "BAD", name: "Bad", amount: "1k", status: "blue" },
    ] });
    expect(parsed.items.map((item) => item.id)).toEqual(["good"]);
    expect(parseMatrix(null)).toEqual(DEFAULT_MATRIX);
  });

  it("refuses an import that would silently discard entries", () => {
    expect(validateMatrixBackup({ ...DEFAULT_MATRIX, groups: [] })).toBeNull();
    expect(validateMatrixBackup({ ...DEFAULT_MATRIX, items: [{ ...DEFAULT_MATRIX.items[0], status: "blue" }] })).toBeNull();
    expect(validateMatrixBackup({ groups: [], columns: [], regions: [], items: [] })).toEqual({ groups: [], columns: [], regions: [], items: [] });
  });
});
