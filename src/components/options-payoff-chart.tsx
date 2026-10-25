"use client";

import { useId, useMemo } from "react";
import { calculatePayoff, type PayoffSummary } from "../lib/options-payoff";
import type { ScenarioInput, Strategy } from "../lib/options-strategies";

export function OptionsPayoffChart({ strategy, input, summary, compact = false }: { strategy: Strategy; input: ScenarioInput; summary: PayoffSummary; compact?: boolean }) {
  const gradientId = useId().replaceAll(":", "");
  const chart = useMemo(() => {
    const width = compact ? 280 : 720;
    const height = compact ? 92 : 300;
    const inset = compact ? { left: 7, right: 7, top: 8, bottom: 7 } : { left: 54, right: 24, top: 28, bottom: 43 };
    const plotWidth = width - inset.left - inset.right;
    const plotHeight = height - inset.top - inset.bottom;
    const maxPrice = summary.chartMax;
    const points = [...new Set([
      ...Array.from({ length: compact ? 45 : 111 }, (_, index) => maxPrice * index / (compact ? 44 : 110)),
      ...strategy.legs.map((leg) => input.strikes[leg.strikeKey]),
      ...summary.breakEvens,
      input.spot,
    ])].filter((price) => price >= 0 && price <= maxPrice).sort((a, b) => a - b);
    const payoffs = points.map((price) => calculatePayoff(strategy, input, price));
    const low = Math.min(0, ...payoffs);
    const high = Math.max(0, ...payoffs);
    const padding = Math.max(1, (high - low) * 0.14);
    const yLow = low - padding;
    const yHigh = high + padding;
    const x = (price: number) => inset.left + price / maxPrice * plotWidth;
    const y = (pnl: number) => inset.top + (yHigh - pnl) / (yHigh - yLow) * plotHeight;
    const line = points.map((price, index) => `${index ? "L" : "M"}${x(price).toFixed(2)} ${y(payoffs[index]).toFixed(2)}`).join(" ");
    const area = `${line} L${x(maxPrice).toFixed(2)} ${y(0).toFixed(2)} L${x(0).toFixed(2)} ${y(0).toFixed(2)} Z`;
    return { width, height, inset, maxPrice, x, y, line, area, endY: y(payoffs[payoffs.length - 1]), spotX: x(input.spot), spotY: y(summary.spotPnl), zeroY: y(0) };
  }, [strategy, input, summary, compact]);

  return <svg className={`options-payoff-chart${compact ? " mini" : ""}`} role="img" aria-label={`${strategy.name}${compact ? "示例盈亏图" : "到期盈亏图"}`} viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2d75e8" stopOpacity="0.17" /><stop offset="100%" stopColor="#2d75e8" stopOpacity="0" /></linearGradient></defs>
    {!compact && <>
      <line x1={chart.inset.left} x2={chart.width - chart.inset.right} y1={chart.inset.top} y2={chart.inset.top} stroke="#eef2f8" />
      <line x1={chart.inset.left} x2={chart.width - chart.inset.right} y1={chart.height - chart.inset.bottom} y2={chart.height - chart.inset.bottom} stroke="#eef2f8" />
      {strategy.legs.map((leg) => input.strikes[leg.strikeKey]).filter((price, index, all) => all.indexOf(price) === index).map((price) => <line key={price} x1={chart.x(price)} x2={chart.x(price)} y1={chart.inset.top} y2={chart.height - chart.inset.bottom} stroke="#d8e4f5" strokeDasharray="3 5" />)}
    </>}
    <line x1={chart.inset.left} x2={chart.width - chart.inset.right} y1={chart.zeroY} y2={chart.zeroY} stroke={compact ? "#d9e5f3" : "#a8bbd2"} strokeDasharray={compact ? undefined : "5 5"} />
    <path d={chart.area} fill={`url(#${gradientId})`} />
    <path d={chart.line} fill="none" stroke="#286be5" strokeWidth={compact ? 2.8 : 3.3} strokeLinecap="round" strokeLinejoin="round" />
    {!compact && summary.bestPnl === null && <path d={`M${chart.width - chart.inset.right - 9} ${chart.endY - 6} L${chart.width - chart.inset.right} ${chart.endY} L${chart.width - chart.inset.right - 9} ${chart.endY + 6}`} fill="none" stroke="#286be5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
    {!compact && <>
      <line x1={chart.spotX} x2={chart.spotX} y1={chart.inset.top} y2={chart.height - chart.inset.bottom} stroke="#6b86aa" strokeDasharray="4 5" />
      <circle cx={chart.spotX} cy={chart.spotY} r="5" fill="#286be5" stroke="#fff" strokeWidth="2" />
      {summary.breakEvens.map((price) => <circle key={price} cx={chart.x(price)} cy={chart.zeroY} r="4" fill="#fff" stroke="#286be5" strokeWidth="2" />)}
      <text x={chart.inset.left} y={chart.height - 12} className="options-axis-label">$0</text>
      <text x={chart.width - chart.inset.right} y={chart.height - 12} textAnchor="end" className="options-axis-label">${Math.round(chart.maxPrice)}</text>
      <text x={chart.inset.left} y="16" className="options-axis-label">到期盈亏（美元）</text>
      <text x={chart.width - chart.inset.right} y="16" textAnchor="end" className="options-axis-label">到期股价 →</text>
    </>}
  </svg>;
}
