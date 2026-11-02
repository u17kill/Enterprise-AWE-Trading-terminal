import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { isCompleteCanaryOrder, normalizeCanaryOrder, type CanaryOrder } from "./canary-order";

const defaultDirectory = () => process.env.AWE_CANARY_DATA_DIR || join(homedir(), "Documents", "Codex", ".awe-terminal-data");
const filePath = (directory: string) => join(directory, "canary-order.json");

export async function readStoredCanaryOrder(directory = defaultDirectory()): Promise<CanaryOrder> {
  try { return normalizeCanaryOrder(JSON.parse(await readFile(filePath(directory), "utf8"))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return normalizeCanaryOrder(null);
    throw error;
  }
}

export async function writeStoredCanaryOrder(value: unknown, directory = defaultDirectory()): Promise<void> {
  if (!isCompleteCanaryOrder(value)) throw new Error("Invalid indicator order.");
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `canary-order.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, filePath(directory));
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}
