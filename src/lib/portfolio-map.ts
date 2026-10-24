export type PortfolioLane = { id: string; name: string };
export type PortfolioPosition = {
  id: string; laneId: string; symbol: string; name: string;
  currency: string; quantity: number; unitCost: number;
};
export type PortfolioMap = { lanes: PortfolioLane[]; positions: PortfolioPosition[] };
export type ImportRow = {
  symbol?: unknown; name?: unknown; type?: unknown; status?: unknown; currency?: unknown;
  quantity?: unknown; totalCost?: unknown; lane?: unknown;
};

export const PORTFOLIO_KEY = "awe.portfolio.v1";
export const EMPTY_PORTFOLIO: PortfolioMap = { lanes: [
  { id: "lane-attack", name: "进攻" }, { id: "lane-balance", name: "均衡" }, { id: "lane-defense", name: "防御" },
], positions: [] };

function nonempty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function amount(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }

export function parsePortfolio(raw: unknown): PortfolioMap {
  if (!raw || typeof raw !== "object") return EMPTY_PORTFOLIO;
  const input = raw as Record<string, unknown>;
  if (!Array.isArray(input.lanes) || !Array.isArray(input.positions)) return EMPTY_PORTFOLIO;
  const laneIds = new Set<string>();
  const lanes: PortfolioLane[] = [];
  for (const item of input.lanes) {
    if (!item || !nonempty(item.id) || !nonempty(item.name) || laneIds.has(item.id)) continue;
    lanes.push({ id: item.id, name: item.name.trim().slice(0, 40) }); laneIds.add(item.id);
  }
  const positionIds = new Set<string>();
  const positions: PortfolioPosition[] = [];
  for (const item of input.positions) {
    if (!item || !nonempty(item.id) || positionIds.has(item.id) || !laneIds.has(item.laneId) ||
        !nonempty(item.symbol) || !nonempty(item.name) || !nonempty(item.currency) ||
        !amount(item.quantity) || item.quantity === 0 || !amount(item.unitCost)) continue;
    positions.push({ id: item.id, laneId: item.laneId, symbol: item.symbol.trim().toUpperCase().slice(0, 30),
      name: item.name.trim().slice(0, 80), currency: item.currency.trim().toUpperCase().slice(0, 6),
      quantity: item.quantity, unitCost: item.unitCost });
    positionIds.add(item.id);
  }
  return { lanes, positions };
}

export function costTotals(positions: PortfolioPosition[]): Record<string, number> {
  const totals = positions.reduce<Record<string, number>>((totals, item) => {
    totals[item.currency] = (totals[item.currency] ?? 0) + item.quantity * item.unitCost;
    return totals;
  }, {});
  for (const currency of Object.keys(totals)) totals[currency] = Math.round(totals[currency] * 1e8) / 1e8;
  return totals;
}

export function importPortfolio(raw: unknown): PortfolioMap {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "rows" in raw) raw = (raw as { rows: unknown }).rows;
  if (!Array.isArray(raw)) return EMPTY_PORTFOLIO;
  const lanes: PortfolioLane[] = [];
  const positions: PortfolioPosition[] = [];
  for (const row of raw as ImportRow[]) {
    if (!row || (row.type !== "Stock" && row.type !== "Stock / ADR") || row.status !== "held" || !nonempty(row.symbol) ||
        !nonempty(row.currency) || !amount(row.quantity) || row.quantity === 0 || !amount(row.totalCost)) continue;
    const laneName = nonempty(row.lane) ? row.lane.trim() : "未分类";
    let lane = lanes.find((item) => item.name === laneName);
    if (!lane) {
      const known = { "进攻": "attack", "均衡": "balance", "防御": "defense" } as Record<string, string>;
      lane = { id: `lane-${known[laneName] ?? lanes.length + 1}`, name: laneName };
      lanes.push(lane);
    }
    positions.push({ id: `import-${positions.length + 1}`, laneId: lane.id, symbol: row.symbol.trim().toUpperCase(),
      name: nonempty(row.name) ? row.name.trim() : row.symbol.trim().toUpperCase(), currency: row.currency.trim().toUpperCase(),
      quantity: row.quantity, unitCost: row.totalCost / row.quantity });
  }
  return { lanes, positions };
}

export function loadPortfolio(storage: Pick<Storage, "getItem">): PortfolioMap {
  try { const raw = storage.getItem(PORTFOLIO_KEY); return raw ? parsePortfolio(JSON.parse(raw)) : EMPTY_PORTFOLIO; }
  catch { return EMPTY_PORTFOLIO; }
}
