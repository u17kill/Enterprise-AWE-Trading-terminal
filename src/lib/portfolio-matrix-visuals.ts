import type { PortfolioMatrix } from "./portfolio-matrix";
import type { MatrixTotals } from "./portfolio-matrix-totals";

export type PortfolioVisualSlice = { id: string; name: string; label: string; amount: number; share: number; color: string };
export type TreemapBox = { id: string; x: number; y: number; width: number; height: number };
export type PortfolioVisuals = {
  totalUsd: number;
  strategies: PortfolioVisualSlice[];
  regions: PortfolioVisualSlice[];
  themes: PortfolioVisualSlice[];
};

const REGION_COLORS = ["#315d78", "#387b70", "#a7755b", "#817394", "#5879a3", "#9c835d", "#5f898f", "#a06a85"];
const STRATEGY_METALS = ["#318c71", "#397f9c", "#b46368", "#8b78a4", "#a37d53"];

function share(amount: number, total: number) { return total > 0 ? amount / total * 100 : 0; }
export function buildPortfolioVisuals(matrix: PortfolioMatrix, totals: MatrixTotals): PortfolioVisuals {
  const total = totals.totalUsd;
  const groups = new Map(matrix.groups.map((group, index) => [group.id, { ...group, color: STRATEGY_METALS[index % STRATEGY_METALS.length] }]));
  const strategies = matrix.groups.flatMap((group) => {
    const amount = totals.groups[group.id] ?? 0;
    return amount > 0 ? [{ id: group.id, name: group.name, label: group.name, amount, share: share(amount, total), color: groups.get(group.id)?.color ?? STRATEGY_METALS[0] }] : [];
  });
  const regions = matrix.regions.flatMap((region, index) => {
    const amount = totals.regions[region.id] ?? 0;
    return amount > 0 ? [{ id: region.id, name: region.name, label: region.name, amount, share: share(amount, total), color: REGION_COLORS[index % REGION_COLORS.length] }] : [];
  }).sort((a, b) => b.amount - a.amount);
  const themes = matrix.columns.flatMap((column) => {
    const amount = totals.columns[column.id] ?? 0;
    const group = groups.get(column.groupId);
    return amount > 0 ? [{ id: column.id, name: column.name, label: `${group?.name ?? "未分组"} / ${column.name}`, amount, share: share(amount, total), color: group?.color ?? STRATEGY_METALS[0] }] : [];
  }).sort((a, b) => b.amount - a.amount);
  return { totalUsd: total, strategies, regions, themes };
}

/** Deterministic binary treemap; each rectangle's area is exactly its amount share. */
export function layoutTreemap(items: { id: string; amount: number }[]): TreemapBox[] {
  const positive = items.filter((item) => Number.isFinite(item.amount) && item.amount > 0);
  const boxes: TreemapBox[] = [];
  function place(entries: typeof positive, x: number, y: number, width: number, height: number) {
    if (!entries.length) return;
    if (entries.length === 1) { boxes.push({ id: entries[0].id, x, y, width, height }); return; }
    const total = entries.reduce((sum, item) => sum + item.amount, 0);
    let split = 1;
    let subtotal = entries[0].amount;
    let cumulative = subtotal;
    let best = Math.abs(total / 2 - subtotal);
    for (let index = 2; index < entries.length; index++) {
      cumulative += entries[index - 1].amount;
      const distance = Math.abs(total / 2 - cumulative);
      if (distance < best) { best = distance; split = index; subtotal = cumulative; }
    }
    const proportion = subtotal / total;
    if (width >= height) {
      const firstWidth = width * proportion;
      place(entries.slice(0, split), x, y, firstWidth, height);
      place(entries.slice(split), x + firstWidth, y, width - firstWidth, height);
    } else {
      const firstHeight = height * proportion;
      place(entries.slice(0, split), x, y, width, firstHeight);
      place(entries.slice(split), x, y + firstHeight, width, height - firstHeight);
    }
  }
  place(positive, 0, 0, 100, 100);
  return boxes;
}
