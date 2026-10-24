import { notFound } from "next/navigation";
import { ChartWorkspace } from "../../../components/chart-workspace";
import { CATALOG, findSymbol } from "../../../lib/catalog";
import { fallbackCustomSymbol } from "../../../lib/custom-symbols";

export function generateStaticParams() {
  return CATALOG.map((symbol) => ({ symbol: symbol.id }));
}

export default async function ChartPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ name?: string }> }) {
  const { symbol: id } = await params;
  const { name } = await searchParams;
  const symbol = findSymbol(id) ?? fallbackCustomSymbol(id, name);
  if (!symbol) notFound();
  return <ChartWorkspace symbol={symbol} />;
}
