import { describe, expect, it } from "vitest";
import { CURATED_EVENTS, eventsOnDate, mergeCalendarEvents, monthCells, parseLongbridgeCalendar } from "./financial-calendar";

describe("financial calendar", () => {
  it("places verified multiday events on every covered day", () => {
    expect(eventsOnDate(CURATED_EVENTS, "2027-01-08").map((event) => event.id)).toContain("ces-2027");
    expect(eventsOnDate(CURATED_EVENTS, "2027-01-10").map((event) => event.id)).not.toContain("ces-2027");
  });
  it("starts Monday and handles February length", () => {
    const cells = monthCells("2027-02");
    expect(cells[0]).toBe("2027-02-01");
    expect(cells.filter(Boolean)).toHaveLength(28);
  });
  it("uses the market-local earnings date and rejects spillover dates", () => {
    const data = { list: [{ date: "2026-11-01", infos: [{ id: "1", symbol: "MSFT.US", counter_name: "微软", content: "季度业绩披露", datetime: "2026-11-01T02:00:00Z", ext: { local_date: "2026-10-31" } }] }] };
    expect(parseLongbridgeCalendar(data, "report", "US", "2026-10")[0]).toMatchObject({ start: "2026-10-31", title: "微软 财报" });
    expect(parseLongbridgeCalendar(data, "report", "US", "2026-11")).toHaveLength(0);
  });
  it("ignores malformed provider payloads", () => {
    expect(parseLongbridgeCalendar(null, "macrodata", "US", "2026-10")).toEqual([]);
    expect(parseLongbridgeCalendar({ list: [{ date: "invalid", infos: [{ content: "CPI" }] }] }, "macrodata", "US", "2026-10")).toEqual([]);
  });
  it("prefers an official earnings date to a nearby conflicting provider date", () => {
    const provider = [{ id: "provider-sony", title: "索尼 财报", symbol: "6758.JP", category: "earnings" as const, region: "JP" as const, start: "2026-11-04", detail: "财报", source: "Longbridge", status: "provider" as const }];
    const merged = mergeCalendarEvents(CURATED_EVENTS, provider);
    expect(merged.some((event) => event.id === "sony-2026-q2")).toBe(true);
    expect(merged.some((event) => event.id === "provider-sony")).toBe(false);
  });
  it("includes officially announced Taiwan and Hong Kong earnings", () => {
    expect(CURATED_EVENTS).toEqual(expect.arrayContaining([
      expect.objectContaining({ region: "TW", symbol: "2317.TW", start: "2026-11-12", category: "earnings" }),
      expect.objectContaining({ region: "HK", symbol: "00700.HK", start: "2026-11-18", category: "earnings" }),
    ]));
  });
});
