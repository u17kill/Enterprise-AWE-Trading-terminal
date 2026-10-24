"use client";
/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect -- The chart is an imperative canvas API; drawing coordinates are read from its live scales, and browser storage hydrates after mount. */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, createChart, HistogramSeries, LineSeries, type IChartApi, type ISeriesApi, type Logical } from "lightweight-charts";
import type { MarketSymbol } from "../lib/catalog";
import { aggregateCandles, generateSampleCandles, movingAverage, type Interval } from "../lib/chart-data";
import { macd, rsi } from "../lib/indicators";
import { IndicatorPane } from "./indicator-pane";
import { MarketRefreshControl } from "./market-refresh-control";
import { useLongbridgeMarket } from "../lib/use-longbridge-market";

type Point = { index: number; price: number };
type Drawing = { id: string; kind: "line" | "fib"; color: string; a: Point; b: Point };
type Tool = "cursor" | "line" | "fib";
const LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const COLORS = ["#2563eb", "#ef6c65", "#16a985", "#ab72ce", "#dc9a27", "#0f8fab"];
const MA_PERIODS = [5, 10, 20, 50, 200, 250] as const;
type MaPeriod = typeof MA_PERIODS[number];

function readDrawings(key: string): Drawing[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Drawing =>
      item && typeof item.id === "string" && (item.kind === "line" || item.kind === "fib") &&
      /^#[0-9a-f]{6}$/i.test(item.color) &&
      [item.a, item.b].every((point: Point) => point && Number.isFinite(point.index) && Number.isFinite(point.price)),
    );
  } catch { return []; }
}

export function ChartWorkspace({ symbol }: { symbol: MarketSymbol }) {
  const market = useLongbridgeMarket();
  const [interval, setInterval] = useState<Interval>("1D");
  const [selectedMa, setSelectedMa] = useState<MaPeriod[]>([20]);
  const [showVolume, setShowVolume] = useState(true);
  const [showMacd, setShowMacd] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [tool, setTool] = useState<Tool>("cursor");
  const [color, setColor] = useState(COLORS[0]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [, redraw] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const [storageError, setStorageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const dragRef = useRef<{ id: string; end: "a" | "b" } | null>(null);
  const gestureRef = useRef<{ a: Point; x: number; y: number; hasPending: boolean } | null>(null);

  const refreshedCandles = market.result?.candlesByInterval?.[interval];
  const liveCandles = refreshedCandles && refreshedCandles.length >= 2 ? refreshedCandles : null;
  const showSample = !market.result && symbol.source !== "longbridge";
  const candles = useMemo(() => liveCandles ?? (showSample ? aggregateCandles(generateSampleCandles(symbol), interval) : []), [symbol, interval, liveCandles, showSample]);
  const unavailableMa = selectedMa.filter((period) => candles.length < period);
  const macdValues = useMemo(() => macd(candles), [candles]);
  const rsiValues = useMemo(() => rsi(candles), [candles]);
  const timeIndex = useMemo(() => new Map(candles.map((candle, index) => [candle.time, index])), [candles]);
  const storageKey = liveCandles ? `awe-chart-drawings:v2:live:${symbol.id}:${interval}` : `awe-chart-drawings:v1:${symbol.id}:${interval}`;
  const quote = market.result?.quotes[symbol.id];
  const displayValue = quote ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: symbol.id === "US10Y" ? 3 : 2 }).format(quote.value) : showSample ? symbol.sampleValue : "—";
  const displayChange = quote ? `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%` : showSample ? symbol.sampleChange : "—";
  const negative = displayChange.startsWith("-");

  useEffect(() => {
    setDrawings(readDrawings(storageKey));
    setLoadedKey(storageKey);
    setSelected(null);
    setPending(null);
    setTool("cursor");
    setStorageError(false);
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(drawings)); }
    catch { setStorageError(true); }
  }, [drawings, loadedKey, storageKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      width: container.clientWidth, height: container.clientHeight,
      layout: { background: { color: "#ffffff" }, textColor: "#8291a7", fontFamily: "DM Sans, Arial, sans-serif", fontSize: 11 },
      grid: { vertLines: { color: "#f1f4f8" }, horzLines: { color: "#edf1f7" } },
      rightPriceScale: { borderColor: "#e6ebf2", scaleMargins: { top: 0.08, bottom: showVolume ? 0.25 : 0.08 } },
      timeScale: { borderColor: "#e6ebf2", rightOffset: 5 },
      crosshair: { vertLine: { color: "#b7c8df", labelBackgroundColor: "#56749d" }, horzLine: { color: "#b7c8df", labelBackgroundColor: "#56749d" } },
      localization: { locale: "zh-CN" },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#19a884", downColor: "#e66570", wickUpColor: "#19a884", wickDownColor: "#e66570", borderVisible: false,
      priceFormat: { type: "price", precision: symbol.id === "US10Y" ? 3 : 2, minMove: symbol.id === "US10Y" ? 0.001 : 0.01 },
    });
    series.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    if (showVolume) {
      const volume = chart.addSeries(HistogramSeries, { priceScaleId: "volume", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
      volume.setData(candles.map((candle) => ({ time: candle.time, value: candle.volume, color: candle.close >= candle.open ? "#cbece3" : "#f8dce0" })));
    }
    selectedMa.forEach((period) => {
      const sma = chart.addSeries(LineSeries, { color: COLORS[MA_PERIODS.indexOf(period)], lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      sma.setData(movingAverage(candles, period));
    });
    chartRef.current = chart;
    seriesRef.current = series;
    if (candles.length > 75) chart.timeScale().setVisibleLogicalRange({ from: candles.length - 75, to: candles.length + 4 });
    else chart.timeScale().fitContent();
    const onRangeChange = () => redraw((value) => value + 1);
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      chart.resize(width, height);
      setViewport({ width, height });
    });
    observer.observe(container);
    setViewport({ width: container.clientWidth, height: container.clientHeight });
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);
    return () => {
      observer.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      chart.remove();
      chartRef.current = null; seriesRef.current = null;
    };
  }, [candles, selectedMa, showVolume, symbol.id]);

  const toXY = (point: Point) => {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return null;
    const x = chart.timeScale().logicalToCoordinate(point.index as Logical);
    const y = series.priceToCoordinate(point.price);
    return x === null || y === null ? null : { x, y };
  };
  const changeTool = (value: Tool) => { gestureRef.current = null; setTool(value); setPending(null); setHover(null); setSelected(null); };
  const pointFromPointer = (event: React.PointerEvent<SVGSVGElement>): Point | null => {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const logical = chart.timeScale().coordinateToLogical(event.clientX - bounds.left);
    const price = series.coordinateToPrice(event.clientY - bounds.top);
    if (logical === null || price === null) return null;
    return { index: Math.max(0, Math.min(candles.length - 1, Math.round(logical))), price };
  };
  const finishDrawing = (a: Point, b: Point) => {
    if (tool === "cursor") return;
    const drawing: Drawing = { id: crypto.randomUUID(), kind: tool, color, a, b };
    setDrawings((items) => [...items, drawing]);
    setSelected(drawing.id);
    setPending(null);
    setHover(null);
    setTool("cursor");
  };
  const xForTime = (time: string) => {
    const index = timeIndex.get(time);
    return index === undefined ? null : chartRef.current?.timeScale().logicalToCoordinate(index as Logical) ?? null;
  };
  const selectedDrawing = drawings.find((item) => item.id === selected);
  const selectedPoints = selectedDrawing ? { a: toXY(selectedDrawing.a), b: toXY(selectedDrawing.b) } : null;
  const selectedAnchor = selectedPoints?.a && selectedPoints.b
    ? { x: Math.max(28, Math.min(viewport.width - 28, (selectedPoints.a.x + selectedPoints.b.x) / 2)),
        y: Math.max(30, Math.min(viewport.height - 10, Math.min(selectedPoints.a.y, selectedPoints.b.y) - 18)) }
    : null;

  return <div className="workspace-shell">
    <header className="workspace-topbar"><Link className="brand" href="/"><span className="brand-mark">A<span>↗</span></span><span><strong>AWE</strong><small>TRADING TERMINAL</small></span></Link><MarketRefreshControl connected={market.connected} checking={market.checking} refreshing={market.refreshing} returnPath={`/chart/${symbol.id}`} onRefresh={() => market.refresh([symbol.id], symbol.id)} /><Link className="workspace-back" href="/">← 返回总览看板</Link></header>
    <main className="workspace-main chart-workspace-main">
      <div className="workspace-intro"><div><span className="section-eyebrow">CHART WORKSPACE / {symbol.id}</span><h1>{symbol.name} <span className="asset-symbol">{symbol.id}</span></h1><p>{symbol.englishName} · {symbol.category}</p></div><span className="workspace-demo">ⓘ {liveCandles ? "Longbridge 按需更新" : showSample ? "演示数据 · 非实时行情" : "等待真实 K 线"}</span></div>
      {market.error && <p className="market-feedback error" role="alert">{market.error}</p>}
      {market.result?.unsupported.includes(symbol.id) && <p className="market-feedback">Longbridge 暂未返回此资产的行情；请切换到已支持的资产。</p>}
      <div className="workspace-grid"><section className={`chart-panel color-${symbol.color}`} aria-label="K 线图表工作区">
        <div className="chart-panel-head"><div><h2>价格图表</h2><p>可缩放、拖动的 K 线 · {liveCandles ? "Longbridge K 线" : showSample ? "本地生成的演示行情" : "K 线暂不可用"}</p></div><div><strong className="asset-value">{displayValue}</strong><span className={`asset-change ${negative ? "negative" : ""}`}>{displayChange}</span></div></div>
        <div className="chart-toolbar" aria-label="图表控制">
          <div className="chart-toolbar-group" aria-label="时间周期">{(["1D", "1W", "1M"] as Interval[]).map((value) => <button key={value} type="button" className={interval === value ? "active" : ""} aria-pressed={interval === value} onClick={() => setInterval(value)}>{value === "1D" ? "日线" : value === "1W" ? "周线" : "月线"}</button>)}</div>
          <span className="chart-toolbar-divider" />
          <div className="ma-picker" aria-label="均线">{MA_PERIODS.map((period, index) => <label className="chart-toggle" key={period}><input type="checkbox" style={{ accentColor: COLORS[index] }} checked={selectedMa.includes(period)} onChange={(event) => setSelectedMa((current) => event.target.checked ? [...current, period].sort((a, b) => a - b) : current.filter((item) => item !== period))} />MA{period}</label>)}</div>
          <label className="chart-toggle"><input type="checkbox" checked={showVolume} onChange={(event) => setShowVolume(event.target.checked)} />成交量</label>
        </div>
        <div className="indicator-toolbar" aria-label="下方指标"><span>下方指标</span><label><input type="checkbox" checked={showMacd} onChange={(event) => setShowMacd(event.target.checked)} />MACD</label><label><input type="checkbox" checked={showRsi} onChange={(event) => setShowRsi(event.target.checked)} />RSI</label></div>
        <p className="breadth-note">市场宽度 MA50/MA200 需要完整的标普 500 成分股及历史 K 线才能计算。当前 Longbridge 只返回部分成分股，因此暂不提供未核实的百分比。<a href="https://www.tradingview.com/support/solutions/43000794827-market-breadth-above-moving-averages/" target="_blank" rel="noopener noreferrer">了解指标口径</a></p>
        {unavailableMa.length > 0 && <p className="ma-history-note">{unavailableMa.map((period) => `MA${period} 需要至少 ${period} 根 K 线`).join("；")}；当前周期只有 {candles.length} 根。</p>}
        <div className="chart-tools" aria-label="绘图工具">
          <button type="button" className={tool === "cursor" ? "active" : ""} aria-pressed={tool === "cursor"} onClick={() => changeTool("cursor")}>选择</button>
          <button type="button" className={tool === "line" ? "active" : ""} aria-pressed={tool === "line"} onClick={() => changeTool("line")}>╱ 直线</button>
          <button type="button" className={tool === "fib" ? "active" : ""} aria-pressed={tool === "fib"} onClick={() => changeTool("fib")}>☰ Fibonacci</button>
          <div className="chart-colors" aria-label="线条颜色">{COLORS.map((value) => <button key={value} type="button" aria-label={`颜色 ${value}`} aria-pressed={color === value} className={color === value ? "active" : ""} style={{ backgroundColor: value }} onClick={() => setColor(value)} />)}</div>
          <button type="button" disabled={!selected} onClick={() => { setDrawings((items) => items.filter((item) => item.id !== selected)); setSelected(null); }}>删除选中</button>
          <button type="button" disabled={drawings.length === 0} onClick={() => { setDrawings((items) => items.slice(0, -1)); setSelected(null); }}>撤销上一个</button>
        </div>
        <p className="chart-hint">{tool === "cursor" ? "滚轮缩放、拖动查看；点击线条选择，拖动端点调整。" : pending ? "拖动或点击第二个位置完成绘图。" : "在图表上按住拖动，或依次点击起点和终点。"}</p>
        <div className="interactive-chart-stage" data-testid="candlestick-chart"><div className="lightweight-chart" ref={containerRef} />
          {!candles.length && <div className="chart-empty-state">{market.result ? "K 线暂不可用，请稍后重新更新数据。" : "点击顶部更新数据加载 K 线。"}</div>}
          <svg className={`drawing-overlay${tool === "cursor" ? "" : " drawing-mode"}`} width={viewport.width} height={viewport.height} viewBox={`0 0 ${viewport.width} ${viewport.height}`} aria-label="保存的图表绘图" onPointerDown={(event) => {
            if (tool === "cursor") return;
            const point = pointFromPointer(event);
            if (!point) return;
            event.preventDefault();
            gestureRef.current = { a: pending ?? point, x: event.clientX, y: event.clientY, hasPending: pending !== null };
            if (!pending) setPending(point);
            setHover(point);
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }} onPointerMove={(event) => {
            const dragging = dragRef.current;
            if (tool !== "cursor") { const point = pointFromPointer(event); if (point) setHover(point); return; }
            if (!dragging) return;
            const point = pointFromPointer(event);
            if (point) setDrawings((items) => items.map((item) => item.id === dragging.id ? { ...item, [dragging.end]: point } : item));
          }} onPointerUp={(event) => {
            if (dragRef.current) dragRef.current = null;
            const gesture = gestureRef.current;
            gestureRef.current = null;
            if (gesture) {
              const point = pointFromPointer(event);
              if (point && (gesture.hasPending || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 5)) finishDrawing(gesture.a, point);
            }
            if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }} onPointerCancel={() => { dragRef.current = null; gestureRef.current = null; }}>
            {drawings.map((item) => {
              const a = toXY(item.a), b = toXY(item.b);
              if (!a || !b) return null;
              const active = selected === item.id;
              return <g key={item.id}>
                {item.kind === "line" ? <><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={item.color} strokeWidth="2" /><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="15" className="drawing-hit" onPointerDown={() => setSelected(item.id)} /></> : <>{LEVELS.map((level) => {
                  const y = a.y + (b.y - a.y) * level;
                  return <g key={level}><line x1={Math.min(a.x, b.x)} x2={Math.max(a.x, b.x)} y1={y} y2={y} stroke={item.color} strokeWidth={level === 0 || level === 1 ? 1.6 : 1} strokeDasharray={level === 0 || level === 1 ? undefined : "5 4"} opacity="0.85" /><text x={Math.max(a.x, b.x) + 5} y={y - 3} fill={item.color} fontSize="10">{level}</text></g>;
                })}<rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.max(5, Math.abs(a.x - b.x))} height={Math.max(5, Math.abs(a.y - b.y))} fill="none" stroke="transparent" strokeWidth="15" className="drawing-hit" onPointerDown={() => setSelected(item.id)} /></>}
                {active && (["a", "b"] as const).map((end) => <circle key={end} cx={end === "a" ? a.x : b.x} cy={end === "a" ? a.y : b.y} r="6" fill="#fff" stroke={item.color} strokeWidth="2" className="drawing-handle" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); dragRef.current = { id: item.id, end }; event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId); }} />)}
              </g>;
            })}
            {pending && hover && (() => { const a = toXY(pending), b = toXY(hover); return a && b ? tool === "line" ? <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="1.5" strokeDasharray="5 4" /> : <g opacity="0.7">{LEVELS.map((level) => <line key={level} x1={Math.min(a.x, b.x)} x2={Math.max(a.x, b.x)} y1={a.y + (b.y - a.y) * level} y2={a.y + (b.y - a.y) * level} stroke={color} strokeWidth="1" strokeDasharray="5 4" />)}</g> : null; })()}
          </svg>
          {selectedAnchor && <button type="button" className="drawing-delete" aria-label="删除这条绘图" title="删除这条绘图" style={{ left: selectedAnchor.x, top: selectedAnchor.y }} onClick={() => { setDrawings((items) => items.filter((item) => item.id !== selected)); setSelected(null); }}>×</button>}
        </div>
        {showMacd && <IndicatorPane title="MACD 指标" width={viewport.width} xForTime={xForTime} lines={[{ label: "DIF", color: "#2563eb", values: macdValues.map((item) => ({ time: item.time, value: item.macd })) }, { label: "DEA", color: "#e6a542", values: macdValues.filter((item) => item.signal !== null).map((item) => ({ time: item.time, value: item.signal! })) }]} bars={macdValues.filter((item) => item.histogram !== null).map((item) => ({ time: item.time, value: item.histogram! }))} />}
        {showRsi && <IndicatorPane title="RSI 指标" width={viewport.width} xForTime={xForTime} range={[0, 100]} lines={[{ label: "RSI 14", color: "#ab72ce", values: rsiValues }]} />}
        <div className="chart-disclaimer">{liveCandles ? `K 线来自 Longbridge，最近报价时间：${quote ? new Date(quote.timestamp).toLocaleString("zh-CN") : "未返回报价"}。` : showSample ? "K 线为本地生成的演示数据。" : "当前周期未取得真实 K 线。"}绘图仅保存在此浏览器。{storageError && <strong> 浏览器未能保存绘图，请检查本地存储设置。</strong>}</div>
      </section>
      <aside className="details-panel"><h3>资产信息</h3><div className="detail-row"><span>代码</span><strong>{symbol.id}</strong></div><div className="detail-row"><span>名称</span><strong>{symbol.name}</strong></div><div className="detail-row"><span>类别</span><strong>{symbol.category}</strong></div><div className="detail-row"><span>报价单位</span><strong>{symbol.unit}</strong></div><div className="detail-row"><span>数据状态</span><strong>{liveCandles ? "Longbridge K 线" : quote ? "Longbridge 报价 / K 线不可用" : showSample ? "演示数据" : "等待行情"}</strong></div><div className="detail-row"><span>已保存绘图</span><strong>{drawings.length} 个</strong></div><div className="upcoming-label">使用提示</div><div className="upcoming-list"><span>切换日线、周线、月线；每个周期分别保存绘图。</span><span>画线或 Fibonacci：选择工具后拖动，或点击两点。</span><span>选择线条后可拖动端点调整，或删除。</span></div><Link href="/" className="workspace-return">← 返回总览看板</Link></aside></div>
    </main>
  </div>;
}
