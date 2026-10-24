import Link from "next/link";
import type { MarketSymbol } from "../lib/catalog";
import { TrendChart } from "./trend-chart";

export function ChartWorkspace({ symbol }: { symbol: MarketSymbol }) {
  const negative = symbol.sampleChange.startsWith("-");
  return <div className="workspace-shell">
    <header className="workspace-topbar"><Link className="brand" href="/"><span className="brand-mark">A<span>↗</span></span><span><strong>AWE</strong><small>TRADING TERMINAL</small></span></Link><Link className="workspace-back" href="/">← 返回总览看板</Link></header>
    <main className="workspace-main">
      <div className="workspace-intro"><div><span className="section-eyebrow">CHART WORKSPACE / {symbol.id}</span><h1>{symbol.name} <span className="asset-symbol">{symbol.id}</span></h1><p>{symbol.englishName} · {symbol.category}</p></div><span className="workspace-demo">ⓘ 演示数据 · 非实时行情</span></div>
      <div className="workspace-grid"><section className={`chart-panel color-${symbol.color}`} aria-label="示例图表"><div className="chart-panel-head"><div><h2>价格走势</h2><p>示例趋势 · 仅用于展示工作区布局</p></div><div><strong className="asset-value">{symbol.sampleValue}</strong><span className={`asset-change ${negative ? "negative" : ""}`}>{symbol.sampleChange}</span></div></div><div className="chart-stage"><TrendChart symbol={symbol} large /><div className="chart-axis"><span>起点</span><span>阶段 1</span><span>阶段 2</span><span>阶段 3</span><span>最近</span></div></div><div className="chart-disclaimer">当前曲线与数值是静态示例，不能用于交易判断。K 线、技术指标与绘图工具将在后续里程碑接入。</div></section>
      <aside className="details-panel"><h3>资产信息</h3><div className="detail-row"><span>代码</span><strong>{symbol.id}</strong></div><div className="detail-row"><span>名称</span><strong>{symbol.name}</strong></div><div className="detail-row"><span>类别</span><strong>{symbol.category}</strong></div><div className="detail-row"><span>报价单位</span><strong>{symbol.unit}</strong></div><div className="detail-row"><span>数据状态</span><strong>示例数据</strong></div><div className="upcoming-label">COMING NEXT</div><div className="upcoming-list"><span>TradingView Lightweight Charts</span><span>服务端 Longbridge 行情</span><span>画线与 Fibonacci 工具</span></div><Link href="/" className="workspace-return">← 返回总览看板</Link></aside></div>
    </main>
  </div>;
}
