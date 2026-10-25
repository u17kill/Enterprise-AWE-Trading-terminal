import { mkdir, writeFile } from "node:fs/promises";
import { MANAGERS } from "../src/lib/leader-holdings.ts";
import { fetchManagerSnapshot } from "../src/lib/leader-holdings-source.ts";

const snapshots = {};
const failures = [];
let nextIndex = 0;

async function worker() {
  while (nextIndex < MANAGERS.length) {
    const manager = MANAGERS[nextIndex++];
    try {
      const snapshot = await fetchManagerSnapshot(manager);
      if (!snapshot.topHoldings.length || !snapshot.secUrl.includes("sec.gov/Archives/")) throw new Error("未取得可追溯持仓");
      snapshots[manager.cik] = snapshot;
      process.stdout.write(`${manager.cik} ${snapshot.period} ${snapshot.topHoldings.length}/${snapshot.holdingsCount} ${snapshot.formType}\n`);
    } catch (error) {
      failures.push(`${manager.cik} ${error instanceof Error ? error.message : String(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

await Promise.all([worker(), worker()]);
if (failures.length || Object.keys(snapshots).length !== MANAGERS.length) {
  throw new Error(`13F 快照未覆盖全部机构：${failures.join("；")}`);
}

const path = new URL("../src/data/leader-holdings-seed.json", import.meta.url);
await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
await writeFile(path, `${JSON.stringify({ asOf: new Date().toISOString(), managers: snapshots }, null, 2)}\n`, "utf8");
process.stdout.write(`Saved ${Object.keys(snapshots).length} manager snapshots.\n`);
