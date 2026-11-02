import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { validateMatrixBackup, type PortfolioMatrix } from "./portfolio-matrix";

// Shared by local preview ports and worktrees; never committed to the repository.
const defaultDirectory = () => process.env.AWE_PORTFOLIO_DATA_DIR || join(homedir(), "Documents", "Codex", ".awe-terminal-data");
const filePath = (directory: string) => join(directory, "portfolio-matrix.json");

export async function readStoredMatrix(directory = defaultDirectory()): Promise<PortfolioMatrix | null> {
  let raw: string;
  try { raw = await readFile(filePath(directory), "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const matrix = validateMatrixBackup(JSON.parse(raw));
  if (!matrix) throw new Error("Saved portfolio matrix is invalid; existing file was kept.");
  return matrix;
}

export async function readStoredSnapshot(directory = defaultDirectory()): Promise<{ matrix: PortfolioMatrix; updatedAt: number } | null> {
  const matrix = await readStoredMatrix(directory);
  return matrix ? { matrix, updatedAt: (await stat(filePath(directory))).mtimeMs } : null;
}

export async function writeStoredMatrix(value: unknown, directory = defaultDirectory()): Promise<void> {
  const matrix = validateMatrixBackup(value);
  if (!matrix) throw new Error("Invalid portfolio matrix.");
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `portfolio-matrix.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(matrix), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, filePath(directory));
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}
