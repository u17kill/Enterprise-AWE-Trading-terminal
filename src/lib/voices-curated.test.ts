import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeCuratedParts, validateCuratedVoices, summarizeCuratedVoices, filterCuratedPeople } from "./voices-curated";

const parts = Array.from({ length: 9 }, (_, index) => JSON.parse(readFileSync(join(process.cwd(), "data", "voices", `part${index + 1}.json`), "utf8")));

describe("V1.10 curated voices", () => {
  it("merges the supplied nine shards into the required 125-person snapshot", () => {
    const data = mergeCuratedParts(parts);
    const validation = validateCuratedVoices(data);
    const summary = summarizeCuratedVoices(data, new Date("2026-11-09T00:00:00Z"));
    expect(validation.errors).toEqual([]);
    expect(data.people).toHaveLength(125);
    expect(summary.points).toBe(448);
    expect(data.brief.items).toHaveLength(11);
    expect(summary.categories.map((item) => [item.id, item.people, item.points])).toEqual([
      ["macro", 25, 94], ["value", 9, 30], ["tech_investor", 16, 62],
      ["tech_leader", 34, 134], ["central_bank", 10, 27], ["gov", 31, 101],
    ]);
    expect(summary.stale.some((item) => item.days > 30)).toBe(true);
    expect(data.people.flatMap((person) => person.points).some((point) => point.date === "2026-08")).toBe(true);
    expect(validation.warnings.every((item) => !item.includes("date invalid"))).toBe(true);
  });

  it("keeps the first duplicate id and reports malformed source data", () => {
    const data = mergeCuratedParts([parts[0], { people: [{ ...parts[0].people[0], cn: "重复" }] }]);
    expect(data.people[0].cn).not.toBe("重复");
    const malformed = { ...data, people: [{ ...data.people[0], points: [{ date: "2026-99-99", src: "", text: "" }] }] };
    expect(validateCuratedVoices(malformed).errors).toEqual(expect.arrayContaining([expect.stringContaining("date"), expect.stringContaining("src"), expect.stringContaining("text")]));
  });

  it("searches every point even when compact display would show only the first", () => {
    const data = mergeCuratedParts(parts);
    const person = data.people.find((entry) => entry.points.length > 1)!;
    const keyword = person.points[1].text.slice(0, 8);
    expect(filterCuratedPeople(data.people, keyword, "all").some((entry) => entry.id === person.id)).toBe(true);
    expect(filterCuratedPeople(data.people, "", "bear").every((entry) => entry.tag === "bear")).toBe(true);
  });
});
