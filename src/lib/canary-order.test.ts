import { describe, expect, it } from "vitest";
import { CANARY_INDICATORS } from "./canary";
import { moveCanaryIndicator, normalizeCanaryOrder } from "./canary-order";

const ids = (band: "macro" | "us" | "china") => CANARY_INDICATORS.filter((item) => item.band === band).map((item) => item.id);

describe("indicator catalog order", () => {
  it("uses catalog order by default and appends new indicators after saved IDs", () => {
    const defaults = normalizeCanaryOrder(null);
    expect(defaults.macro).toEqual(ids("macro"));
    const saved = normalizeCanaryOrder({ macro: [ids("macro")[1], "removed", ids("macro")[1], ids("macro")[0]], us: [ids("china")[0]] });
    expect(saved.macro).toEqual([ids("macro")[1], ids("macro")[0], ...ids("macro").slice(2)]);
    expect(saved.us).toEqual(ids("us"));
    expect(saved.china).toEqual(ids("china"));
  });

  it("moves only inside one category and supports before and after placement", () => {
    const defaults = normalizeCanaryOrder(null);
    const moved = moveCanaryIndicator(defaults, "macro", ids("macro")[0], ids("macro")[2], true);
    expect(moved.macro.slice(0, 3)).toEqual([ids("macro")[1], ids("macro")[2], ids("macro")[0]]);
    expect(moved.us).toEqual(defaults.us);
    expect(moveCanaryIndicator(moved, "macro", ids("us")[0], ids("macro")[1], false)).toEqual(moved);
  });
});
