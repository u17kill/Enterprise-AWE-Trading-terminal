import { describe, expect, it } from "vitest";
import { MASTER_GROUPS } from "./master-philosophy";

describe("大师哲学 PPT 摘录", () => {
  it("保留三组十二人和第 21–23 页的全部 123 条摘录", () => {
    expect(MASTER_GROUPS.map((group) => group.name)).toEqual(["价值派", "均衡配置派", "交易派"]);
    expect(MASTER_GROUPS.map((group) => group.masters.map((master) => master.name))).toEqual([
      ["沃伦·巴菲特", "彼得·林奇", "查理·芒格", "段永平"],
      ["瑞·达利欧", "哈里·马科维茨", "加里·布林森", "彼得·伯恩斯坦"],
      ["霍华德·马克斯", "保罗·都铎·琼斯", "杰西·利弗莫尔", "乔治·索罗斯"],
    ]);
    expect(MASTER_GROUPS.flatMap((group) => group.masters).map((master) => master.quotes.length)).toEqual([9, 10, 9, 11, 11, 8, 9, 8, 14, 11, 11, 12]);
    expect(MASTER_GROUPS.flatMap((group) => group.masters).flatMap((master) => master.quotes)).toHaveLength(123);
  });

  it("为每人保留头像、可追溯简介来源和不同的身份", () => {
    const masters = MASTER_GROUPS.flatMap((group) => group.masters);
    expect(new Set(masters.map((master) => master.id)).size).toBe(12);
    for (const master of masters) {
      expect(master.portrait).toMatch(/^\/master-philosophy\/[^/]+\.png$/);
      expect(master.bio.length).toBeGreaterThan(15);
      expect(master.bioSource).toMatch(/^https:\/\//);
      expect(master.quotes.every((quote) => quote.trim().length > 5)).toBe(true);
    }
    expect(masters[0].quotes[0]).toBe("规则一：永远不要亏钱；规则二：永远不要忘记规则一。");
    expect(masters[11].quotes.at(-1)).toBe("经济史是基于谎言与假象的连续剧，找到前提错误的趋势并顺势，在其破灭前离场。");
  });
});
