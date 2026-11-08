import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCuratedVoices = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/voices-curated-source", () => ({ loadCuratedVoices }));
import { GET } from "./route";

beforeEach(() => loadCuratedVoices.mockReset());

describe("curated voices API", () => {
  it("reloads the server snapshot for each request and disables caching", async () => {
    loadCuratedVoices.mockResolvedValueOnce({ summary: { people: 125 } }).mockResolvedValueOnce({ summary: { people: 126 } });
    const first = await GET(), second = await GET();
    expect(loadCuratedVoices).toHaveBeenCalledTimes(2);
    expect(first.headers.get("Cache-Control")).toBe("no-store");
    expect((await first.json()).summary.people).toBe(125);
    expect((await second.json()).summary.people).toBe(126);
  });

});
