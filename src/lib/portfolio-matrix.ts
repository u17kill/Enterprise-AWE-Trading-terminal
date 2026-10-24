export type TileStatus = "held" | "watch" | "add";
export type MatrixGroup = { id: string; name: string; color: string };
export type MatrixColumn = { id: string; groupId: string; name: string };
export type MatrixRegion = { id: string; name: string };
export type MatrixItem = { id: string; columnId: string; regionId: string; symbol: string; name: string; amount: string; status: TileStatus };
export type PortfolioMatrix = { groups: MatrixGroup[]; columns: MatrixColumn[]; regions: MatrixRegion[]; items: MatrixItem[] };

export const MATRIX_KEY = "awe.portfolio.matrix.v03";

const groups: MatrixGroup[] = [
  { id: "attack", name: "进攻", color: "#70d5a2" },
  { id: "balance", name: "均衡", color: "#90d9f5" },
  { id: "defense", name: "防御", color: "#ee8d8c" },
];
const columns: MatrixColumn[] = [
  { id: "ai-infra", groupId: "attack", name: "AI 基建" }, { id: "ai-app", groupId: "attack", name: "AI 应用" },
  { id: "crypto", groupId: "attack", name: "加密金融科技" }, { id: "robotics", groupId: "attack", name: "航天机器人" },
  { id: "internet", groupId: "balance", name: "消费互联网" }, { id: "discretionary", groupId: "balance", name: "可选消费 / IP 经济" }, { id: "metals", groupId: "balance", name: "贵金属" },
  { id: "finance", groupId: "defense", name: "金融" }, { id: "realestate", groupId: "defense", name: "地产" }, { id: "energy", groupId: "defense", name: "能源" },
  { id: "staples", groupId: "defense", name: "必选消费" }, { id: "health", groupId: "defense", name: "医疗保健" },
  { id: "industry", groupId: "defense", name: "国防 / 公用 / 工业" }, { id: "conglomerate", groupId: "defense", name: "综合商事" },
];
const regions: MatrixRegion[] = [
  { id: "us", name: "美国" }, { id: "china", name: "中国" }, { id: "asia", name: "日韩台印" }, { id: "europe", name: "欧洲" },
];

type Seed = [columnId: string, regionId: string, symbol: string, amount: string, status?: TileStatus, name?: string];
const seed: Seed[] = [
  ["ai-infra","us","NVDA","9.5k","held","英伟达"],["ai-infra","us","APH","3.3k","held","安费诺"],["ai-infra","us","INTL","2.7k–5","add"],["ai-infra","us","VST","6.2k","held","Vistra"],["ai-infra","us","MU","put 720","watch","美光"],
  ["ai-infra","us","DRAM","10k","add","DRAM ETF"],["ai-infra","us","AVGO","15k","held","博通"],["ai-infra","us","COHR","5.5k–10","add","Coherent"],["ai-infra","us","MARV","","watch"],["ai-infra","us","2DRAM","put 55","watch"],
  ["ai-app","us","MSFT","10k","held","微软"],["ai-app","us","META","10k","held","Meta"],["ai-app","us","GOOGL","16k","held","Alphabet"],["ai-app","us","PANW","","watch","Palo Alto Networks"],["ai-app","us","CRWD","","watch","CrowdStrike"],["ai-app","us","PLTR","","watch","Palantir"],["ai-app","us","CRM","","watch","Salesforce"],["ai-app","us","NOW","","watch","ServiceNow"],["ai-app","us","AMZN","put 230","watch","亚马逊"],["ai-app","us","ORCL","put 125","watch","甲骨文"],
  ["crypto","us","ETOR","5.7k","held"],["crypto","us","MSTR","5.5k","held","Strategy"],["crypto","us","COIN","3k","held","Coinbase"],
  ["robotics","us","SPCX","put 115","watch","SpaceX"],
  ["internet","us","NFLX","9k","held","Netflix"],["internet","us","UBER","","watch","优步"],["internet","us","SHOP","","watch","Shopify"],
  ["discretionary","us","DIS","3k","held","迪士尼"],["discretionary","us","APPL","","watch"],
  ["finance","us","SPGI","5k","held","标普全球"],["finance","us","XLF","3k","held","金融板块 ETF"],["finance","us","AXP","6k","held","美国运通"],["finance","us","BAC","6k","held","美国银行"],
  ["realestate","us","ITB","6k","held","住宅建筑 ETF"],["realestate","us","DHI","4k","held","霍顿房屋"],
  ["energy","us","XOM","","watch","埃克森美孚"],
  ["staples","us","BTI","5k","held","英美烟草"],["staples","us","WMT","4k","held","沃尔玛"],["staples","us","MCD","6k","held","麦当劳"],
  ["health","us","XLV","","watch","医疗板块 ETF"],["health","us","UNH","5.5k","held","联合健康"],
  ["industry","us","GEV","","watch","GE Vernova"],["industry","us","VRT","5k","held","Vertiv"],["conglomerate","us","BRK","10k","held","伯克希尔"],
  ["ai-infra","china","通讯ETF","3k"],["ai-infra","china","亚太科技基金","4k"],["internet","china","腾讯","11k","held","腾讯控股"],["discretionary","china","泡泡玛特","","watch"],["metals","china","紫金矿业","13k"],["metals","china","黄金","24k"],["health","china","迈瑞医疗","6.6k"],["industry","china","电网ETF","1.5k"],["industry","china","金盘科技","2k"],
  ["ai-infra","asia","SKHY","9.5k","held","SK 海力士"],["ai-infra","asia","三星","16k"],["ai-infra","asia","日本半导体ETF","10k"],["ai-infra","asia","TSM","10k","held","台积电"],["ai-infra","asia","EWT","2k","held","台湾 ETF"],["ai-infra","asia","信越化学","6k"],
  ["ai-app","asia","软银","10k"],["robotics","asia","发那科","7.5k"],["robotics","asia","基恩士","","watch"],["discretionary","asia","SONY","","watch","索尼"],
  ["finance","asia","印度ETF","","watch"],["staples","asia","伊藤忠","","watch"],["industry","asia","三菱重工","","watch"],["industry","asia","丰田","3k","add"],["conglomerate","asia","三菱商事","9k"],["conglomerate","asia","丸红","9k"],["conglomerate","asia","三井","6k","add"],
  ["ai-infra","europe","ASML","","watch","阿斯麦"],["ai-app","europe","SAP","7k","held"],["discretionary","europe","LVMH","9k","held"],["health","europe","AZN","7k","held","阿斯利康"],["industry","europe","Siemens / 施耐德","5k","watch"],
];

export const DEFAULT_MATRIX: PortfolioMatrix = {
  groups, columns, regions,
  items: seed.map(([columnId, regionId, symbol, amount, status = "held", name], index) => ({ id: `seed-${index + 1}`, columnId, regionId, symbol, name: name ?? symbol, amount, status })),
};

const named = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const statuses: TileStatus[] = ["held", "watch", "add"];

export function parseMatrix(raw: unknown): PortfolioMatrix {
  if (!raw || typeof raw !== "object") return DEFAULT_MATRIX;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.groups) || !Array.isArray(data.columns) || !Array.isArray(data.regions) || !Array.isArray(data.items)) return DEFAULT_MATRIX;
  const unique = <T extends { id: string }>(items: T[]) => items.filter((item, index) => items.findIndex((other) => other.id === item.id) === index);
  const parsedGroups = unique(data.groups.filter((item): item is MatrixGroup => Boolean(item && named(item.id) && named(item.name) && named(item.color))).map((item) => ({ id: item.id, name: item.name.slice(0, 60), color: item.color.slice(0, 30) })));
  const groupIds = new Set(parsedGroups.map((item) => item.id));
  const parsedColumns = unique(data.columns.filter((item): item is MatrixColumn => Boolean(item && named(item.id) && named(item.name) && named(item.groupId) && groupIds.has(item.groupId))).map((item) => ({ id: item.id, groupId: item.groupId, name: item.name.slice(0, 80) })));
  const columnIds = new Set(parsedColumns.map((item) => item.id));
  const parsedRegions = unique(data.regions.filter((item): item is MatrixRegion => Boolean(item && named(item.id) && named(item.name))).map((item) => ({ id: item.id, name: item.name.slice(0, 40) })));
  const regionIds = new Set(parsedRegions.map((item) => item.id));
  const parsedItems = unique(data.items.filter((item): item is MatrixItem => Boolean(item && named(item.id) && named(item.columnId) && columnIds.has(item.columnId) && named(item.regionId) && regionIds.has(item.regionId) && named(item.symbol) && named(item.name) && typeof item.amount === "string" && statuses.includes(item.status))).map((item) => ({ id: item.id, columnId: item.columnId, regionId: item.regionId, symbol: item.symbol.slice(0, 60), name: item.name.slice(0, 100), amount: item.amount.slice(0, 100), status: item.status })));
  return { groups: parsedGroups, columns: parsedColumns, regions: parsedRegions, items: parsedItems };
}

export function validateMatrixBackup(raw: unknown): PortfolioMatrix | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!["groups", "columns", "regions", "items"].every((key) => Array.isArray(data[key]))) return null;
  const parsed = parseMatrix(data);
  return parsed.groups.length === (data.groups as unknown[]).length &&
    parsed.columns.length === (data.columns as unknown[]).length &&
    parsed.regions.length === (data.regions as unknown[]).length &&
    parsed.items.length === (data.items as unknown[]).length ? parsed : null;
}

export function loadMatrix(storage: Pick<Storage, "getItem">): PortfolioMatrix {
  try { const raw = storage.getItem(MATRIX_KEY); return raw ? parseMatrix(JSON.parse(raw)) : DEFAULT_MATRIX; }
  catch { return DEFAULT_MATRIX; }
}
