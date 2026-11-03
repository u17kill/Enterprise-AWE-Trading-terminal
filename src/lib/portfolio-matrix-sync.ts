import { DEFAULT_MATRIX, MATRIX_KEY, validateMatrixBackup, type PortfolioMatrix } from "./portfolio-matrix";

const updatedKey = `${MATRIX_KEY}.updatedAt`;
const backupKey = `${MATRIX_KEY}.legacyBackup`;

export async function syncPortfolioMatrix(
  storage: Pick<Storage, "getItem" | "setItem">,
  fetcher: typeof fetch,
): Promise<{ matrix: PortfolioMatrix; hasLegacyBackup: boolean }> {
  // Read the shared file first. A failed read must never turn a seed map into a write.
  const response = await fetcher("/api/portfolio-matrix", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to read portfolio file");
  const payload = await response.json() as { snapshot: { matrix: PortfolioMatrix; updatedAt: number } | null };
  let localRaw: string | null = null;
  let localTime = 0;
  let hasLegacyBackup = false;
  try {
    localRaw = storage.getItem(MATRIX_KEY);
    localTime = Number(storage.getItem(updatedKey) ?? 0);
    hasLegacyBackup = Boolean(storage.getItem(backupKey));
  } catch { /* The shared file remains usable if browser storage is unavailable. */ }
  let local: PortfolioMatrix | null = null;
  try { if (localRaw) local = validateMatrixBackup(JSON.parse(localRaw)); } catch { /* Preserve raw data for export. */ }

  if (payload.snapshot) {
    const server = validateMatrixBackup(payload.snapshot.matrix);
    if (!server) throw new Error("Invalid portfolio file");
    if (local && localTime > payload.snapshot.updatedAt) {
      await putMatrix(fetcher, local);
      return { matrix: local, hasLegacyBackup };
    }
    if (localRaw && localRaw !== JSON.stringify(DEFAULT_MATRIX) && localRaw !== JSON.stringify(server)) {
      try {
        if (!hasLegacyBackup) storage.setItem(backupKey, localRaw);
        hasLegacyBackup = true;
      } catch { /* The server copy is still available. */ }
    }
    try {
      storage.setItem(MATRIX_KEY, JSON.stringify(server));
      storage.setItem(updatedKey, String(payload.snapshot.updatedAt));
    } catch { /* The server copy is authoritative. */ }
    return { matrix: server, hasLegacyBackup };
  }

  const matrix = local ?? DEFAULT_MATRIX;
  await putMatrix(fetcher, matrix);
  try {
    storage.setItem(MATRIX_KEY, JSON.stringify(matrix));
    storage.setItem(updatedKey, String(Date.now()));
  } catch { /* The server copy was saved. */ }
  return { matrix, hasLegacyBackup };
}

async function putMatrix(fetcher: typeof fetch, matrix: PortfolioMatrix): Promise<void> {
  const response = await fetcher("/api/portfolio-matrix", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(matrix), keepalive: true,
  });
  if (!response.ok) throw new Error("Unable to save portfolio file");
}
