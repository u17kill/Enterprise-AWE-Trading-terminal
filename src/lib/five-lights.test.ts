import { describe, expect, it } from "vitest";
import { FIVE_LIGHTS, loadLights, parseLights } from "./five-lights";

describe("five lights", () => {
  it("has the original five dimensions", () => {
    expect(FIVE_LIGHTS.map((item) => item.id)).toEqual(["volatility", "breadth", "liquidity", "crowding", "leverage"]);
  });
  it("validates saved judgements and evidence", () => {
    expect(parseLights({ volatility: { state: "amber", note: "VIX 曲线趋平", updatedAt: "2026-10-24" }, breadth: { state: "purple" } }).volatility).toEqual({ state: "amber", note: "VIX 曲线趋平", updatedAt: "2026-10-24" });
    expect(parseLights({ breadth: { state: "purple" } }).breadth.state).toBe("unknown");
  });
  it("loads blank model when browser data is unavailable", () => {
    expect(loadLights({ getItem: () => "bad" }).volatility.state).toBe("unknown");
  });
});
