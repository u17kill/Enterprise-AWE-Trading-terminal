import type { IntradayPoint } from "../lib/longbridge-data";

type Props = { symbolId: string; points: IntradayPoint[]; negative: boolean; description?: string };

export function TrendChart({ symbolId, points, negative, description = "最近交易日分时走势" }: Props) {
  if (points.length < 2) return null;
  const width = 220;
  const height = 76;
  const prices = points.map((point) => point.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const padding = Math.max((high - low) * 0.12, high * 0.0001);
  const minimum = low - padding;
  const maximum = high + padding;
  const line = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = 10 + (1 - (point.price - minimum) / (maximum - minimum)) * 57;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return <svg className={`trend-chart${negative ? " negative" : ""}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${symbolId} ${description}`}>
    <defs><linearGradient id={`fill-${symbolId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.18" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
    <path d={area} fill={`url(#fill-${symbolId})`} />
    <path d={line} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}
