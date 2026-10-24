import type { MarketSymbol } from "../lib/catalog";

type Props = { symbol: MarketSymbol; large?: boolean };

export function TrendChart({ symbol, large = false }: Props) {
  const width = large ? 900 : 220;
  const height = large ? 330 : 76;
  const top = large ? 28 : 10;
  const bottom = large ? 42 : 9;
  const minimum = Math.min(...symbol.trend) - 5;
  const maximum = Math.max(...symbol.trend) + 5;
  const points = symbol.trend.map((value, index) => {
    const x = (index / (symbol.trend.length - 1)) * width;
    const y = top + (1 - (value - minimum) / (maximum - minimum)) * (height - top - bottom);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <svg className={`trend-chart ${large ? "trend-chart-large" : ""}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${symbol.id} 示例走势`}>
      <defs>
        <linearGradient id={`fill-${symbol.id}-${large ? "large" : "small"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {large && [0.23, 0.46, 0.69, 0.92].map((fraction) => <line key={fraction} x1="0" x2={width} y1={height * fraction} y2={height * fraction} className="chart-gridline" />)}
      <path d={area} fill={`url(#fill-${symbol.id}-${large ? "large" : "small"})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={large ? 2.4 : 2.2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {large && <circle cx={points.at(-1)?.[0]} cy={points.at(-1)?.[1]} r="5" fill="currentColor" />}
    </svg>
  );
}
