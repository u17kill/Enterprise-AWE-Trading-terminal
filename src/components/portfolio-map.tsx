"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { costTotals, EMPTY_PORTFOLIO, importPortfolio, loadPortfolio, parsePortfolio, PORTFOLIO_KEY, type PortfolioMap, type PortfolioPosition } from "../lib/portfolio-map";
import "../app/portfolio-map.css";

type Draft = Omit<PortfolioPosition, "id"> & { id?: string };
const blank = (laneId: string): Draft => ({ laneId, symbol: "", name: "", currency: "USD", quantity: 0, unitCost: 0 });

function totalText(positions: PortfolioPosition[]) {
  const totals = costTotals(positions);
  const entries = Object.entries(totals);
  return entries.length ? entries.map(([currency, value]) => `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: currency === "JPY" || currency === "KRW" ? 0 : 2 }).format(value)}`).join(" · ") : "暂无持仓";
}

export function PortfolioMapPage() {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [portfolio, setPortfolio] = useState<PortfolioMap>(() => typeof window === "undefined" ? EMPTY_PORTFOLIO : loadPortfolio(window.localStorage));
  const [selectedLane, setSelectedLane] = useState("lane-attack");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [laneName, setLaneName] = useState("");
  const [preview, setPreview] = useState<PortfolioMap | null>(null);
  const [previewDate, setPreviewDate] = useState("");
  const [message, setMessage] = useState("");
  const localMode = mounted && ["127.0.0.1", "localhost"].includes(location.hostname);

  useEffect(() => { if (mounted) try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio)); } catch { /* Inform on next edit. */ } }, [portfolio, mounted]);
  const lane = portfolio.lanes.find((item) => item.id === selectedLane) ?? portfolio.lanes[0];
  const visible = useMemo(() => portfolio.positions.filter((item) => item.laneId === lane?.id), [portfolio.positions, lane?.id]);
  const saveDraft = () => {
    if (!draft) return;
    if (!draft.symbol.trim() || !draft.name.trim() || !draft.currency.trim() || !Number.isFinite(draft.quantity) || draft.quantity <= 0 || !Number.isFinite(draft.unitCost) || draft.unitCost < 0) { setMessage("请填写代码、名称、币种、正数股数和非负成本价。"); return; }
    const item: PortfolioPosition = { ...draft, id: draft.id ?? crypto.randomUUID(), symbol: draft.symbol.trim().toUpperCase(), name: draft.name.trim(), currency: draft.currency.trim().toUpperCase() };
    setPortfolio((current) => ({ ...current, positions: draft.id ? current.positions.map((value) => value.id === draft.id ? item : value) : [...current.positions, item] }));
    setDraft(null); setMessage("");
  };
  const addLane = () => {
    if (!laneName.trim()) return;
    const id = crypto.randomUUID();
    setPortfolio((current) => ({ ...current, lanes: [...current.lanes, { id, name: laneName.trim() }] }));
    setSelectedLane(id); setLaneName("");
  };
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(portfolio, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "awe-portfolio-private.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const next = Array.isArray(raw) || (raw && typeof raw === "object" && Array.isArray(raw.rows)) ? importPortfolio(raw) : parsePortfolio(raw);
      if (!next.positions.length) throw new Error("文件中没有可导入的实际持仓正股。");
      setPreview(next); setPreviewDate(typeof raw.asOf === "string" ? raw.asOf : ""); setMessage("请核对导入预览。确认后才会替换当前地图。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "导入失败"); setPreview(null); }
  };
  const loadHistoricPreview = async () => {
    try {
      const response = await fetch("/api/portfolio/import-preview", { cache: "no-store" });
      const raw = await response.json();
      if (!response.ok) throw new Error(raw.error ?? "旧持仓快照不可用");
      const next = importPortfolio(raw);
      if (!next.positions.length) throw new Error("旧持仓快照没有符合条件的正股。");
      setPreview(next); setPreviewDate(raw.asOf ?? ""); setMessage("旧表只是一份历史快照，请核对实际持仓和成本后再确认导入。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "预览失败"); }
  };

  if (!mounted) return <div className="portfolio-shell" aria-label="正在读取本地持仓" />;
  return <div className="portfolio-shell">
    <aside className="sidebar"><Link className="brand" href="/"><span className="brand-mark">A<span>↗</span></span><span><strong>AWE</strong><small>TRADING TERMINAL</small></span></Link><div className="sidebar-label">工作台</div><nav aria-label="主导航"><Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link><Link className="nav-item active" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link></nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V1.3 · 私人持仓</div><p>明细只保存在当前浏览器。请定期导出备份。</p></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>持仓地图</strong></div><span className="sample-pill">本地保存</span></header>
      <div className="portfolio-content"><div className="page-hero"><div><div className="hero-kicker"><span className="kicker-line" /> FULL SATELLITE MAP</div><h1>你的持仓，<em>按主题展开。</em></h1><p>编辑通道与持仓卡片。投入总额按原币种计算；这里暂不显示现价和盈亏。</p></div><button className="primary-button" onClick={() => setDraft(blank(lane?.id ?? ""))}>＋ 添加持仓</button></div>
        <div className="portfolio-summary"><span>已记录 {portfolio.positions.length} 笔正股持仓</span><strong>{totalText(portfolio.positions)}</strong><div>{localMode && <button onClick={() => void loadHistoricPreview()}>预览旧持仓快照</button>}<button onClick={exportJson}>导出私人备份</button><label>导入 JSON 预览<input type="file" accept="application/json,.json" onChange={(event) => { void loadFile(event.target.files?.[0]); event.target.value = ""; }} /></label></div></div>
        {message && <p className="portfolio-message" role="status">{message}</p>}
        {preview && <section className="portfolio-preview"><h2>导入预览 · 尚未保存</h2><p>{previewDate ? `来源日期 ${previewDate} · ` : ""}{preview.positions.length} 笔持仓，{preview.lanes.length} 个通道 · {totalText(preview.positions)}</p><div className="portfolio-preview-list">{preview.positions.map((item) => <div key={item.id}><strong>{item.symbol}</strong><span>{item.name}</span><span>{item.quantity.toLocaleString()} 股</span><span>{item.currency} {item.unitCost.toLocaleString(undefined, { maximumFractionDigits: 4 })} / 股</span></div>)}</div><p>请确认这是当前真实持仓及成本。导入会替换此浏览器里的持仓地图。</p><button onClick={() => { setPortfolio(preview); setSelectedLane(preview.lanes[0]?.id ?? ""); setPreview(null); setMessage("导入已保存。"); }}>确认导入并替换</button><button onClick={() => setPreview(null)}>取消</button></section>}
        <div className="portfolio-lanes" role="tablist" aria-label="持仓通道">{portfolio.lanes.map((item) => <button key={item.id} role="tab" aria-selected={lane?.id === item.id} className={lane?.id === item.id ? "active" : ""} onClick={() => { setSelectedLane(item.id); setDraft(null); }}>{item.name}<small>{portfolio.positions.filter((position) => position.laneId === item.id).length}</small></button>)}</div>
        <div className="portfolio-lane-actions"><input aria-label="新通道名称" placeholder="新通道名称" value={laneName} onChange={(event) => setLaneName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addLane(); }} /><button onClick={addLane}>添加通道</button>{lane && <><button onClick={() => { const name = window.prompt("修改通道名称", lane.name); if (name?.trim()) setPortfolio((current) => ({ ...current, lanes: current.lanes.map((item) => item.id === lane.id ? { ...item, name: name.trim() } : item) })); }}>重命名当前通道</button><button onClick={() => { if (!window.confirm(`删除“${lane.name}”及其 ${visible.length} 笔持仓？`)) return; setPortfolio((current) => ({ lanes: current.lanes.filter((item) => item.id !== lane.id), positions: current.positions.filter((item) => item.laneId !== lane.id) })); setSelectedLane(portfolio.lanes.find((item) => item.id !== lane.id)?.id ?? ""); }}>删除当前通道</button></>}</div>
        <section className="portfolio-board" aria-label="持仓卡片"><div className="section-heading"><div><span className="section-eyebrow">CURRENT CHANNEL</span><h2>{lane?.name ?? "新建通道"}</h2><p>{visible.length} 笔 · {totalText(visible)}</p></div></div>{visible.length ? <div className="portfolio-grid">{visible.map((item) => <article className="portfolio-card" key={item.id}><div><span className="portfolio-ticker">{item.symbol}</span><button aria-label={`删除 ${item.symbol}`} onClick={() => { if (window.confirm(`删除 ${item.symbol}？`)) setPortfolio((current) => ({ ...current, positions: current.positions.filter((value) => value.id !== item.id) })); }}>×</button></div><h3>{item.name}</h3><dl><div><dt>股数</dt><dd>{item.quantity.toLocaleString()}</dd></div><div><dt>每股成本</dt><dd>{item.currency} {item.unitCost.toLocaleString(undefined, { maximumFractionDigits: 4 })}</dd></div><div><dt>投入总额</dt><dd>{item.currency} {(item.quantity * item.unitCost).toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd></div></dl><div className="portfolio-card-actions"><button onClick={() => setDraft(item)}>编辑</button><select aria-label={`移动 ${item.symbol} 到通道`} value={item.laneId} onChange={(event) => setPortfolio((current) => ({ ...current, positions: current.positions.map((value) => value.id === item.id ? { ...value, laneId: event.target.value } : value) }))}>{portfolio.lanes.map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}</select></div></article>)}</div> : <div className="empty-state">这个通道还没有持仓。<button onClick={() => setDraft(blank(lane?.id ?? ""))}>添加第一笔</button></div>}</section>
      </div>
    </main>
    {draft && <div className="modal-backdrop"><section className="portfolio-editor" role="dialog" aria-modal="true" aria-label="编辑持仓"><h2>{draft.id ? "编辑持仓" : "添加持仓"}</h2><div className="portfolio-fields"><label>股票代码<input value={draft.symbol} onChange={(event) => setDraft({ ...draft, symbol: event.target.value })} /></label><label>名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>币种<input value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })} placeholder="USD / JPY / KRW" /></label><label>股数<input type="number" min="0" step="any" value={draft.quantity || ""} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} /></label><label>每股成本<input type="number" min="0" step="any" value={draft.unitCost || ""} onChange={(event) => setDraft({ ...draft, unitCost: Number(event.target.value) })} /></label><label>通道<select value={draft.laneId} onChange={(event) => setDraft({ ...draft, laneId: event.target.value })}>{portfolio.lanes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><p>投入总额：{draft.currency || "—"} {(draft.quantity * draft.unitCost).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p><div className="portfolio-editor-actions"><button onClick={() => { setDraft(null); setMessage(""); }}>取消</button><button className="primary-button" onClick={saveDraft}>保存持仓</button></div></section></div>}
  </div>;
}
