import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildResearchSnapshot, parseResearchDataset, singaporeToday } from "./institutional-research";

export async function readResearchSnapshot(today = singaporeToday(), filename = join(process.cwd(), "data", "research", "research.json")) {
  const raw = JSON.parse(await readFile(filename, "utf8"));
  return buildResearchSnapshot(parseResearchDataset(raw), today);
}
