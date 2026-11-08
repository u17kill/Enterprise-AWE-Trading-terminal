import "server-only";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { mergeCuratedParts, summarizeCuratedVoices, validateCuratedVoices } from "./voices-curated";

export async function loadCuratedVoices(now = new Date()) {
  const directory = join(process.cwd(), "data", "voices");
  const names = (await readdir(directory)).filter((name) => /^part[1-9]\.json$/.test(name)).sort();
  if (names.length !== 9) throw new Error("最新风向策展分片不完整，应有 part1 至 part9");
  const parts = await Promise.all(names.map(async (name) => JSON.parse(await readFile(join(directory, name), "utf8")) as unknown));
  const data = mergeCuratedParts(parts);
  const diagnostics = validateCuratedVoices(data);
  if (diagnostics.errors.length) throw new Error(`最新风向数据未通过校验：${diagnostics.errors.slice(0, 4).join("；")}`);
  return { data, summary: summarizeCuratedVoices(data, now), warnings: diagnostics.warnings };
}
