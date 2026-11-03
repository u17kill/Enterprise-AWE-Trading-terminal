import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeCanaryOrder } from "./canary-order";
import { readStoredCanaryOrder, writeStoredCanaryOrder } from "./canary-order-store";

let directory = "";
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = ""; });

describe("local indicator order store", () => {
  it("persists a valid order and rejects invalid replacement without changing the file", async () => {
    directory = await mkdtemp(join(tmpdir(), "awe-canary-order-"));
    const defaults = await readStoredCanaryOrder(directory);
    const edited = { ...defaults, macro: [...defaults.macro].reverse() };
    await writeStoredCanaryOrder(edited, directory);
    expect(await readStoredCanaryOrder(directory)).toEqual(edited);
    await expect(writeStoredCanaryOrder({ ...edited, macro: ["not-an-indicator"] }, directory)).rejects.toThrow();
    expect(await readStoredCanaryOrder(directory)).toEqual(edited);
    expect(JSON.parse(await readFile(join(directory, "canary-order.json"), "utf8"))).toEqual(edited);
    expect(defaults).toEqual(normalizeCanaryOrder(null));
  });
});
