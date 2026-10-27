"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Brand } from "./brand";
import { OptionsPayoffChart } from "./options-payoff-chart";
import { analyzeScenario, type PayoffSummary } from "../lib/options-payoff";
import { getStrategy, STRATEGIES, type ScenarioInput, type Strategy } from "../lib/options-strategies";

type DraftInput = { spot: string; stockCost: string; contracts: string; multiplier: string; strikes: Record<string, string>; premiums: Record<string, string> };
const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });

function draftFrom(input: ScenarioInput): DraftInput {
  return { spot: String(input.spot), stockCost: input.stockCost === undefined ? "" : String(input.stockCost), contracts: String(input.contracts), multiplier: String(input.multiplier), strikes: Object.fromEntries(Object.entries(input.strikes).map(([key, value]) => [key, String(value)])), premiums: Object.fromEntries(Object.entries(input.premiums).map(([key, value]) => [key, String(value)])) };
}

function toNumber(value: string): number { return value.trim() === "" ? Number.NaN : Number(value); }
function toScenario(draft: DraftInput): ScenarioInput {
  return { spot: toNumber(draft.spot), stockCost: toNumber(draft.stockCost), contracts: toNumber(draft.contracts), multiplier: toNumber(draft.multiplier), strikes: Object.fromEntries(Object.entries(draft.strikes).map(([key, value]) => [key, toNumber(value)])), premiums: Object.fromEntries(Object.entries(draft.premiums).map(([key, value]) => [key, toNumber(value)])) };
}
function money(value: number): string { const rounded = Math.round(Math.abs(value) * 1_000_000) / 1_000_000; return `${value >= 0 ? "+" : "-"}$${amount.format(rounded)}`; }
function price(value: number): string { return `$${value.toFixed(2)}`; }

function ExampleCard({ strategy, active, onSelect }: { strategy: Strategy; active: boolean; onSelect: () => void }) {
  const sample = analyzeScenario(strategy, strategy.defaults).summary!;
  return <button type="button" className={`options-strategy-card${active ? " active" : ""}`} aria-label={`选择策略：${strategy.name}`} aria-pressed={active} onClick={onSelect}>
    <div className="options-card-head"><span className="options-category">{strategy.category}</span><span className="options-card-arrow">↗</span></div>
    <strong>{strategy.name}</strong><small>{strategy.english}</small>
    <div className="options-mini-chart"><OptionsPayoffChart strategy={strategy} input={strategy.defaults} summary={sample} compact /><span>到期盈亏示例</span></div>
    <p>{strategy.summary}</p>
    <div className="options-card-legs">{strategy.legs.map((leg) => <span className={leg.side} key={leg.id}>{leg.side === "buy" ? "BUY" : "SELL"} {leg.type.toUpperCase()}</span>)}{strategy.stock && <span className="stock">持股</span>}</div>
  </button>;
}

function InputField({ label, value, onChange, step = "0.01", error }: { label: string; value: string; onChange: (value: string) => void; step?: string; error?: string }) {
  const errorId = useId();
  return <label className="options-input"><span>{label}</span><input type="number" inputMode="decimal" step={step} value={value} aria-label={label} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} />{error && <small id={errorId} className="options-field-error">{error}</small>}</label>;
}

function Results({ strategy, summary }: { strategy: Strategy; summary: PayoffSummary }) {
  return <>
    <div className="options-result-grid">
      <div><span>当前股价对应的到期盈亏</span><strong className={summary.spotPnl >= 0 ? "positive" : "negative"}>{money(summary.spotPnl)}</strong></div>
      <div><span>最佳结果</span><strong className="positive">{summary.bestPnl === null ? "理论上无上限" : money(summary.bestPnl)}</strong></div>
      {strategy.id === "iron_condor" ? <>
        <div><span>下跌侧极端行情</span><strong className={summary.leftTailPnl >= 0 ? "positive" : "negative"}>{money(summary.leftTailPnl)}</strong></div>
        <div><span>上涨侧极端行情</span><strong className={summary.rightTailPnl >= 0 ? "positive" : "negative"}>{money(summary.rightTailPnl)}</strong></div>
      </> : <div><span>最差结果</span><strong className="negative">{summary.worstPnl === null ? "理论上无下限" : money(summary.worstPnl)}</strong></div>}
      <div><span>期权净权利金</span><strong>{money(summary.netPremium)}</strong></div>
    </div>
    <div className="options-break-even"><span>到期盈亏平衡点</span><div>{summary.breakEvens.length ? summary.breakEvens.map((value) => <strong key={value}>{price(value)}</strong>) : <em>无有限平衡点</em>}</div></div>
    {summary.zeroIntervals.length > 0 && <p className="options-zero-interval">存在零盈亏区间：{summary.zeroIntervals.map((interval) => `${price(interval.from)} 至 ${interval.to === null ? "更高股价" : price(interval.to)}`).join("、")}。</p>}
  </>;
}

export function OptionsCalculator() {
  const [selectedId, setSelectedId] = useState("long_call");
  const [draft, setDraft] = useState<DraftInput>(() => draftFrom(getStrategy("long_call").defaults));
  const strategy = getStrategy(selectedId);
  const scenario = useMemo(() => toScenario(draft), [draft]);
  const analysis = useMemo(() => analyzeScenario(strategy, scenario), [strategy, scenario]);
  const strikeFields = [...new Set(strategy.legs.map((leg) => leg.strikeKey))];
  const fieldError = (prefix: string) => analysis.errors.find((error) => error.startsWith(prefix));
  const orderError = analysis.errors.find((error) => error.startsWith("执行价顺序"));

  function selectStrategy(next: Strategy) { setSelectedId(next.id); setDraft(draftFrom(next.defaults)); const section = document.getElementById("options-workspace"); if (typeof section?.scrollIntoView === "function") section.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function setBase(key: "spot" | "stockCost" | "contracts" | "multiplier", value: string) { setDraft((current) => ({ ...current, [key]: value })); }
  function setStrike(key: string, value: string) { setDraft((current) => ({ ...current, strikes: { ...current.strikes, [key]: value } })); }
  function setPremium(key: string, value: string) { setDraft((current) => ({ ...current, premiums: { ...current.premiums, [key]: value } })); }

  return <div className="app-shell options-shell">
    <aside className="sidebar"><Brand /><div className="sidebar-label">工作台</div><nav aria-label="主导航"><Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link><Link className="nav-item" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link><Link className="nav-item" href="/calendar"><span className="nav-glyph">▤</span>财经日历</Link><Link className="nav-item" href="/news"><span className="nav-glyph">◉</span>市场动态</Link><Link className="nav-item" href="/holdings"><span className="nav-glyph">▤</span>大佬持仓</Link><Link className="nav-item active" href="/options" aria-current="page"><span className="nav-glyph">◇</span>期权计算</Link><Link className="nav-item" href="/philosophy"><span className="nav-glyph">✦</span>大师哲学</Link><Link className="nav-item" href="/canary"><span className="nav-glyph">◈</span>金丝雀指标</Link></nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V0.8 · 策略实验室</div><p>手填价格，探索到期日可能出现的盈亏。</p></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>期权计算</strong></div><span className="sample-pill">手动输入 · 到期情景</span></header>
      <div className="options-content"><div className="options-hero"><span className="section-eyebrow">AWE / OPTIONS LAB · V0.8</span><h1>期权计算</h1><p>先看懂策略的盈亏形状，再代入自己的价格。所有结果均为同一到期日的情景计算。</p></div>
        <div className="options-scope"><strong>十二种策略 · 到期盈亏</strong><span>价格与权利金均手动输入；图表不使用实时行情，也不预测到期前价格。</span></div>
        <section className="options-catalog" aria-label="期权策略目录"><div className="options-section-head"><div><span className="section-eyebrow">STRATEGY LIBRARY</span><h2>选择策略</h2></div><p>蓝线为使用示例参数绘制的到期盈亏形状</p></div><div className="options-strategy-grid">{STRATEGIES.map((item) => <ExampleCard key={item.id} strategy={item} active={item.id === selectedId} onSelect={() => selectStrategy(item)} />)}</div></section>
        <section id="options-workspace" className="options-workspace" aria-label="当前策略计算结果"><div className="options-section-head"><div><span className="section-eyebrow">PAYOFF WORKSPACE</span><h2>{strategy.name} <small>{strategy.english}</small></h2></div><a href={strategy.sourceUrl} target="_blank" rel="noopener noreferrer" className="options-source">策略教育来源 ↗</a></div>
          <p className="options-explanation">{strategy.explanation}</p>
          <div className="options-work-grid"><div className="options-chart-panel"><div className="options-panel-head"><strong>到期盈亏曲线</strong><span>横轴：到期股价 · 纵轴：美元盈亏</span></div>
            {analysis.summary ? <><OptionsPayoffChart strategy={strategy} input={scenario} summary={analysis.summary} /><div className="options-chart-legend"><span>虚线：执行价 {strikeFields.map((key) => price(scenario.strikes[key])).join(" · ")}</span><span>实心点：当前股价 {price(scenario.spot)}</span><span>空心点：盈亏平衡点</span>{analysis.summary.bestPnl === null && <span>曲线向右延续，盈利理论上无上限</span>}</div><Results strategy={strategy} summary={analysis.summary} /></> : <div className="options-invalid-chart">请修正输入后查看曲线和计算结果。</div>}
            {analysis.errors.length > 0 && <div className="options-alert" role="alert">{analysis.errors.join("；")}</div>}
            {analysis.warnings.map((warning) => <p className="options-warning" key={warning}>{warning}</p>)}
          </div>
          <div className="options-calculator-panel"><div className="options-panel-head"><strong>手动输入</strong><button type="button" onClick={() => setDraft(draftFrom(strategy.defaults))}>重置示例</button></div>
            <p>权利金按每股报价；同一组合里的期权腿采用相同到期日。</p>
            <div className="options-input-grid"><InputField label="当前股价" value={draft.spot} error={fieldError("当前股价")} onChange={(value) => setBase("spot", value)} /><InputField label="合约张数" value={draft.contracts} step="1" error={fieldError("合约张数")} onChange={(value) => setBase("contracts", value)} /><InputField label="每张对应股数" value={draft.multiplier} step="1" error={fieldError("合约乘数")} onChange={(value) => setBase("multiplier", value)} />{strategy.stock && <InputField label="股票成本价" value={draft.stockCost} error={fieldError("股票成本价")} onChange={(value) => setBase("stockCost", value)} />}</div>
            <h3>策略组成</h3><div className="options-leg-list">{strategy.stock && <div className="options-stock-note">持有股票：合约张数 × 每张对应股数</div>}{strategy.legs.map((leg) => <div className="options-leg" key={leg.id}><div className="options-leg-title"><span className={leg.side}>{leg.side === "buy" ? "BUY" : "SELL"}</span><strong>{leg.label}</strong></div><div className="options-leg-inputs">{strikeFields.includes(leg.strikeKey) && strategy.legs.find((entry) => entry.strikeKey === leg.strikeKey)?.id === leg.id && <InputField label={`${leg.label} · 执行价`} value={draft.strikes[leg.strikeKey] ?? ""} error={fieldError(`${leg.strikeKey} `) ?? (strategy.strikeOrder?.includes(leg.strikeKey) ? orderError : undefined)} onChange={(value) => setStrike(leg.strikeKey, value)} />}<InputField label={`${leg.label} · 权利金（每股）`} value={draft.premiums[leg.id] ?? ""} error={fieldError(`${leg.label} 权利金`)} onChange={(value) => setPremium(leg.id, value)} /></div></div>)}</div>
          </div></div>
          <p className="options-disclaimer">此图只计算到期日情景，不含手续费、税费、滑点、股息、提前行权或保证金要求；也不代表今日盈亏、获利概率或交易建议。</p>
        </section>
      </div>
    </main>
  </div>;
}
