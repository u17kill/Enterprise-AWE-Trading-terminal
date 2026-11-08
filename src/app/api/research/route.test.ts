import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { readResearchSnapshot } from "../../../lib/institutional-research-store";

describe("curated research API", () => {
  it("serves the real curated seed with one consistent set of coverage counts", async () => {
    const snapshot = await readResearchSnapshot("2026-11-08");
    expect(snapshot.topics).toHaveLength(5);
    expect(snapshot.institutions).toHaveLength(30);
    expect(snapshot.stats).toMatchObject({ reports: 67, coveredCells: 62, possibleCells: 150 });
  });

  it("returns a fresh non-cached response and reports a missing data file", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(readResearchSnapshot("2026-11-08", "C:/missing/research.json")).rejects.toThrow();
  });
});
