import { notFound } from "next/navigation";
import { ChartWorkspace } from "../../../components/chart-workspace";
import { CATALOG, findSymbol } from "../../../lib/catalog";

export function generateStaticParams() {
  return CATALOG.map((symbol) => ({ symbol: symbol.id }));
}

export default async function ChartPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: id } = await params;
  const symbol = findSymbol(id);
  if (!symbol) notFound();
  return <ChartWorkspace symbol={symbol} />;
}
