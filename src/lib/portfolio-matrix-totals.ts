import type { MatrixItem, PortfolioMatrix } from "./portfolio-matrix";

export type MatrixTotals = {
  totalUsd: number;
  includedCount: number;
  groups: Record<string, number>;
  regions: Record<string, number>;
  columns: Record<string, number>;
  cells: Record<string, number>;
  optionItems: MatrixItem[];
};

export function parseUsdKAmount(amount: string): number | null {
  const trimmed = amount.trim();
  if (!/^\d+(?:\.\d+)?k$/i.test(trimmed)) return null;
  const dollars = Number(trimmed.slice(0, -1)) * 1000;
  return Number.isFinite(dollars) && dollars <= Number.MAX_SAFE_INTEGER ? dollars : null;
}

function add(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function calculateMatrixTotals(matrix: PortfolioMatrix): MatrixTotals {
  const columnGroups = new Map(matrix.columns.map((column) => [column.id, column.groupId]));
  const groups = new Map<string, number>();
  const regions = new Map<string, number>();
  const columns = new Map<string, number>();
  const cells = new Map<string, number>();
  const optionItems: MatrixItem[] = [];
  let totalUsd = 0;
  let includedCount = 0;

  for (const item of matrix.items) {
    if (item.status === "option") {
      optionItems.push(item);
      continue;
    }
    if (item.status !== "held" && item.status !== "add") continue;
    const amount = parseUsdKAmount(item.amount);
    const groupId = columnGroups.get(item.columnId);
    if (amount === null || !groupId) continue;
    totalUsd += amount;
    includedCount += 1;
    add(groups, groupId, amount);
    add(regions, item.regionId, amount);
    add(columns, item.columnId, amount);
    add(cells, `${item.columnId}:${item.regionId}`, amount);
  }

  return {
    totalUsd,
    includedCount,
    groups: Object.fromEntries(groups),
    regions: Object.fromEntries(regions),
    columns: Object.fromEntries(columns),
    cells: Object.fromEntries(cells),
    optionItems,
  };
}
