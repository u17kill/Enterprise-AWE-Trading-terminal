import type { DatedValue } from "../lib/indicators";

type Series = { label: string; color: string; values: DatedValue[] };

export function IndicatorPane({ title, lines, bars, width, xForTime, range, emptyMessage }: {
  title: string;
  lines: Series[];
  bars?: DatedValue[];
  width: number;
  xForTime: (time: string) => number | null;
  range?: [number, number];
  emptyMessage?: string;
}) {
  const allValues = [...lines.flatMap((line) => line.values.map((item) => item.value)), ...(bars ?? []).map((item) => item.value)];
  const magnitude = Math.max(1, ...allValues.map((value) => Math.abs(value)));
  const [min, max] = range ?? [-magnitude, magnitude];
  const paneWidth = Math.max(width, 1);
  const top = 10, bottom = 110;
  const yForValue = (value: number) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const visiblePoint = (item: DatedValue) => {
    const x = xForTime(item.time);
    return x === null || x < 0 || x > paneWidth - 50 ? null : { x, y: yForValue(item.value) };
  };
  return <section className="indicator-pane" role="region" aria-label={title}>
    <div className="indicator-pane-head"><strong>{title}</strong><div className="indicator-legend">{lines.map((line) => <span key={line.label}><i style={{ backgroundColor: line.color }} />{line.label}</span>)}</div></div>
    {emptyMessage ? <p className="indicator-unavailable">{emptyMessage}</p> : <svg className="indicator-svg" width="100%" height="128" viewBox={`0 0 ${paneWidth} 128`} preserveAspectRatio="none" aria-label={`${title} 趋势`}>
      {[min, (min + max) / 2, max].map((value) => <g key={value}><line x1="0" x2={paneWidth - 48} y1={yForValue(value)} y2={yForValue(value)} stroke="#edf1f7" strokeDasharray={value === 0 ? undefined : "3 4"} /><text x={paneWidth - 45} y={yForValue(value) + 4} fill="#8b9ab0" fontSize="10">{value.toFixed(range ? 0 : 2)}</text></g>)}
      {bars?.map((item) => { const point = visiblePoint(item); return point ? <line key={item.time} x1={point.x} x2={point.x} y1={yForValue(0)} y2={point.y} stroke={item.value >= 0 ? "#2eaf89" : "#e46b75"} strokeWidth="3" /> : null; })}
      {lines.map((line) => {
        const points = line.values.map(visiblePoint).filter((point): point is { x: number; y: number } => point !== null);
        return points.length > 1 ? <polyline key={line.label} points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={line.color} strokeWidth="1.7" vectorEffect="non-scaling-stroke" /> : null;
      })}
    </svg>}
  </section>;
}
