import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_MATRIX } from "./portfolio-matrix";
import { readStoredMatrix, writeStoredMatrix } from "./portfolio-matrix-store";

let directory = "";
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = ""; });

describe("local portfolio store", () => {
  it("keeps an edited matrix across separate reads and rejects an invalid replacement", async () => {
    directory = await mkdtemp(join(tmpdir(), "awe-portfolio-"));
    const edited = { ...DEFAULT_MATRIX, items: DEFAULT_MATRIX.items.map((item) => item.symbol === "NVDA" ? { ...item, amount: "user-edited-12k" } : item) };
    await writeStoredMatrix(edited, directory);
    expect((await readStoredMatrix(directory))?.items.find((item) => item.symbol === "NVDA")?.amount).toBe("user-edited-12k");
    await writeStoredMatrix(edited, directory);
    await expect(writeStoredMatrix({ ...edited, items: [{ ...edited.items[0], columnId: "missing" }] }, directory)).rejects.toThrow();
    expect((await readStoredMatrix(directory))?.items.find((item) => item.symbol === "NVDA")?.amount).toBe("user-edited-12k");
    expect(JSON.parse(await readFile(join(directory, "portfolio-matrix.json"), "utf8")).items.length).toBe(edited.items.length);
  });
});
