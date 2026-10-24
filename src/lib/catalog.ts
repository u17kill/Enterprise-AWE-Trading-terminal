export type SymbolGroup = "macro" | "stocks";

export type MarketSymbol = {
  id: string;
  name: string;
  englishName: string;
  category: string;
  group: SymbolGroup;
  unit: string;
  sampleValue: string;
  sampleChange: string;
  trend: number[];
  color: "blue" | "gold" | "green" | "violet";
  source?: "longbridge";
};

export const CATALOG: MarketSymbol[] = [
  { id: "SPX", name: "标普 500 指数", englishName: "S&P 500 Index", category: "美国股指", group: "macro", unit: "点", sampleValue: "6,721.44", sampleChange: "+0.82%", trend: [25, 28, 24, 31, 34, 32, 36, 33, 42, 45, 43, 51], color: "blue" },
  { id: "NDX", name: "纳斯达克 100", englishName: "Nasdaq 100 Index", category: "美国股指", group: "macro", unit: "点", sampleValue: "24,684.12", sampleChange: "+1.14%", trend: [22, 29, 26, 32, 30, 39, 37, 41, 44, 42, 50, 54], color: "violet" },
  { id: "XAUUSD", name: "黄金 / 美元", englishName: "Gold Spot", category: "贵金属", group: "macro", unit: "美元/盎司", sampleValue: "4,126.80", sampleChange: "+0.36%", trend: [33, 30, 32, 28, 34, 38, 35, 40, 39, 43, 42, 46], color: "gold" },
  { id: "US10Y", name: "美国 10 年期国债收益率", englishName: "US 10Y Treasury Yield", category: "债券收益率", group: "macro", unit: "%", sampleValue: "4.248", sampleChange: "-0.04%", trend: [49, 47, 50, 46, 44, 45, 40, 42, 38, 37, 35, 34], color: "green" },
  { id: "DJI", name: "道琼斯工业指数", englishName: "Dow Jones Industrial Average", category: "美国股指", group: "macro", unit: "点", sampleValue: "46,152.32", sampleChange: "+0.51%", trend: [27, 31, 29, 33, 35, 34, 38, 36, 42, 44, 43, 47], color: "blue" },
  { id: "BTCUSD", name: "比特币 / 美元", englishName: "Bitcoin", category: "数字资产", group: "macro", unit: "美元", sampleValue: "112,430.00", sampleChange: "+1.87%", trend: [19, 27, 22, 34, 30, 39, 35, 47, 43, 50, 46, 55], color: "violet" },
  { id: "AAPL", name: "苹果", englishName: "Apple Inc.", category: "科技", group: "stocks", unit: "美元", sampleValue: "257.18", sampleChange: "+0.94%", trend: [24, 26, 25, 30, 28, 35, 34, 37, 40, 39, 44, 48], color: "blue" },
  { id: "NVDA", name: "英伟达", englishName: "NVIDIA Corp.", category: "半导体", group: "stocks", unit: "美元", sampleValue: "183.64", sampleChange: "+2.31%", trend: [18, 24, 21, 29, 27, 33, 39, 36, 45, 43, 51, 56], color: "green" },
  { id: "MSFT", name: "微软", englishName: "Microsoft Corp.", category: "科技", group: "stocks", unit: "美元", sampleValue: "512.70", sampleChange: "+0.47%", trend: [27, 26, 30, 31, 29, 34, 35, 37, 36, 41, 42, 45], color: "blue" },
  { id: "TSLA", name: "特斯拉", englishName: "Tesla Inc.", category: "汽车", group: "stocks", unit: "美元", sampleValue: "427.86", sampleChange: "-1.16%", trend: [52, 48, 50, 44, 46, 41, 43, 38, 40, 35, 37, 32], color: "violet" },
  { id: "AMZN", name: "亚马逊", englishName: "Amazon.com Inc.", category: "科技", group: "stocks", unit: "美元", sampleValue: "229.36", sampleChange: "+0.68%", trend: [24, 28, 26, 30, 31, 34, 33, 38, 37, 41, 43, 45], color: "gold" },
  { id: "GOOGL", name: "谷歌", englishName: "Alphabet Inc.", category: "科技", group: "stocks", unit: "美元", sampleValue: "203.44", sampleChange: "+0.55%", trend: [25, 27, 26, 32, 30, 34, 36, 35, 39, 41, 40, 44], color: "green" },
  { id: "META", name: "Meta", englishName: "Meta Platforms Inc.", category: "科技", group: "stocks", unit: "美元", sampleValue: "742.18", sampleChange: "+1.23%", trend: [23, 28, 26, 31, 34, 32, 38, 40, 39, 45, 47, 51], color: "violet" },
];

export function findSymbol(id: string): MarketSymbol | undefined {
  return CATALOG.find((symbol) => symbol.id === id.toUpperCase());
}

export function searchSymbols(query: string): MarketSymbol[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return CATALOG.filter((symbol) =>
    [symbol.id, symbol.name, symbol.englishName, symbol.category]
      .some((value) => value.toLocaleLowerCase().includes(normalized)),
  );
}
