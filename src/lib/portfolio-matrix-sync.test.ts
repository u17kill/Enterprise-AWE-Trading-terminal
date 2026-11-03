import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MATRIX, MATRIX_KEY } from "./portfolio-matrix";
import { syncPortfolioMatrix } from "./portfolio-matrix-sync";

const UPDATED_KEY = `${MATRIX_KEY}.updatedAt`;
const BACKUP_KEY = `${MATRIX_KEY}.legacyBackup`;

function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

describe("portfolio map recovery sync", () => {
  it("uploads a newer browser edit instead of replacing it with an older server file", async () => {
    const latest = { ...DEFAULT_MATRIX, columns: [...DEFAULT_MATRIX.columns, { id: "new", groupId: "attack", name: "新主题" }] };
    const storage = memoryStorage({ [MATRIX_KEY]: JSON.stringify(latest), [UPDATED_KEY]: "2000" });
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "PUT"
      ? { ok: true }
      : { ok: true, json: async () => ({ snapshot: { matrix: DEFAULT_MATRIX, updatedAt: 1000 } }) });
    const result = await syncPortfolioMatrix(storage, fetcher as unknown as typeof fetch);
    expect(result.matrix.columns).toHaveLength(DEFAULT_MATRIX.columns.length + 1);
    expect(fetcher).toHaveBeenCalledWith("/api/portfolio-matrix", expect.objectContaining({ method: "PUT", body: JSON.stringify(latest) }));
  });

  it("loads a newer server copy and keeps the different browser copy as a backup", async () => {
    const oldLocal = { ...DEFAULT_MATRIX, items: DEFAULT_MATRIX.items.slice(0, 1) };
    const storage = memoryStorage({ [MATRIX_KEY]: JSON.stringify(oldLocal), [UPDATED_KEY]: "1000" });
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ snapshot: { matrix: DEFAULT_MATRIX, updatedAt: 2000 } }) }));
    const result = await syncPortfolioMatrix(storage, fetcher as unknown as typeof fetch);
    expect(result.matrix.items).toHaveLength(DEFAULT_MATRIX.items.length);
    expect(storage.getItem(BACKUP_KEY)).toBe(JSON.stringify(oldLocal));
    expect(storage.getItem(UPDATED_KEY)).toBe("2000");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never writes a default map after a failed read", async () => {
    const storage = memoryStorage();
    const fetcher = vi.fn(async () => { throw new Error("server offline"); });
    await expect(syncPortfolioMatrix(storage, fetcher as unknown as typeof fetch)).rejects.toThrow("server offline");
    expect(storage.getItem(MATRIX_KEY)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
