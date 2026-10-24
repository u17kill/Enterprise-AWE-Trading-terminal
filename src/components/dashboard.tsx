"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CATALOG, findSymbol, searchSymbols, type MarketSymbol, type SymbolGroup } from "../lib/catalog";
import { DEFAULT_WATCHLIST, addSymbol, loadWatchlist, removeSymbol, saveWatchlist, type Watchlist } from "../lib/watchlist";
import { TrendChart } from "./trend-chart";
import { MarketRefreshControl } from "./market-refresh-control";
import { useLongbridgeMarket } from "../lib/use-longbridge-market";
import type { LiveQuote } from "../lib/longbridge-data";

function SearchIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
}

function ArrowIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function AssetCard({ symbol, onRemove, quote }: { symbol: MarketSymbol; onRemove: (id: string) => void; quote?: LiveQuote }) {
  const change = quote ? `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%` : symbol.sampleChange;
  const negative = change.startsWith("-");
  const value = quote ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quote.value) : symbol.sampleValue;
  return (
    <article className={`asset-card color-${symbol.color}`} data-testid="asset-card">
      <div className="asset-card-top">
        <span className="symbol-badge">{symbol.id.slice(0, 2)}</span>
        <button className="remove-button" aria-label={`移除 ${symbol.id}`} title="移除自选" onClick={() => onRemove(symbol.id)}>×</button>
      </div>
      <div className="asset-title-row"><h3>{symbol.name}</h3><span className="asset-symbol">{symbol.id}</span></div>
      <p className="asset-category">{symbol.category} · {symbol.englishName}</p>
      <div className="asset-value-row"><span className="asset-value">{value}</span><span className={`asset-change ${negative ? "negative" : ""}`}>{change}</span></div>
      <p className="asset-unit">{quote ? `Longbridge · ${new Date(quote.timestamp).toLocaleString("zh-CN")}` : "示例数值"} · {symbol.unit}</p>
      <TrendChart symbol={symbol} />
      <div className="card-footer"><span>示例走势</span><Link href={`/chart/${symbol.id}`} aria-label={`查看 ${symbol.id} 图表`}>查看图表 <ArrowIcon /></Link></div>
    </article>
  );
}

function AssetSection({ title, eyebrow, description, ids, group, onRemove, onAdd, quotes }: { title: string; eyebrow: string; description: string; ids: string[]; group: SymbolGroup; onRemove: (id: string) => void; onAdd: () => void; quotes: Record<string, LiveQuote> }) {
  return (
    <section className="asset-section" aria-label={title}>
      <div className="section-heading"><div><span className="section-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div><button className="section-add" onClick={onAdd}>+ 添加{group === "macro" ? "资产" : "股票"}</button></div>
      {ids.length ? <div className="asset-grid">{ids.map((id) => { const symbol = findSymbol(id); return symbol ? <AssetCard key={id} symbol={symbol} onRemove={onRemove} quote={quotes[id]} /> : null; })}</div> : <div className="empty-state">这里还没有自选项目。<button onClick={onAdd}>添加第一个</button></div>}
    </section>
  );
}

export function Dashboard() {
  const snapshot = useSyncExternalStore(
    (callback) => { window.addEventListener("storage", callback); window.addEventListener("awe-watchlist-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-watchlist-change", callback); }; },
    () => window.localStorage.getItem("awe.watchlist.v1") ?? "",
    () => "",
  );
  const watchlist = useMemo(() => snapshot ? loadWatchlist({ getItem: () => snapshot }) : DEFAULT_WATCHLIST, [snapshot]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const market = useLongbridgeMarket();

  useEffect(() => {
    if (!searchOpen) return;
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setSearchOpen(false); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  const matches = useMemo(() => query.trim() ? searchSymbols(query) : CATALOG.slice(0, 6), [query]);
  const tracked = watchlist.macro.length + watchlist.stocks.length;
  const openSearch = () => { setQuery(""); setSearchOpen(true); };
  const updateWatchlist = (next: Watchlist) => { saveWatchlist(window.localStorage, next); window.dispatchEvent(new Event("awe-watchlist-change")); };
  const add = (id: string) => { updateWatchlist(addSymbol(watchlist, id)); setSearchOpen(false); };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark">A<span>↗</span></span><span><strong>AWE</strong><small>TRADING TERMINAL</small></span></Link>
        <div className="sidebar-label">工作台</div>
        <nav aria-label="主导航"><Link className="nav-item active" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href={`/chart/${watchlist.macro[0] ?? watchlist.stocks[0] ?? "SPX"}`}><span className="nav-glyph">⌁</span>图表空间</Link></nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V0.2 · 按需更新</div><p>你的自选资产保存在此浏览器中。</p></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>总览看板</strong></div><MarketRefreshControl connected={market.connected} checking={market.checking} refreshing={market.refreshing} returnPath="/" onRefresh={() => market.refresh([...watchlist.macro, ...watchlist.stocks])} /><div className="topbar-right"><span className="sample-pill"><span />{market.result ? "部分行情已更新" : "示例数据"}</span><span className="avatar">A</span></div></header>
        <div className="dashboard-content">
          <div className="page-hero"><div><div className="hero-kicker"><span className="kicker-line" /> AWE MARKET OVERVIEW</div><h1>你的市场，<em>一目了然。</em></h1><p>集中查看关注的宏观资产和个股，点开任意卡片进入专属图表空间。</p></div><button className="primary-button" aria-label="添加资产" onClick={openSearch}><span>＋</span> 添加资产</button></div>

          <div className="info-banner"><span className="info-icon">ⓘ</span><p><strong>{market.result ? "Longbridge 按需更新" : "演示模式"}</strong> — {market.result ? "已更新的卡片显示 Longbridge 报价及时间；未覆盖的资产仍为示例数值。卡片下方的小走势图仍为示例。" : "当前数值和走势图仅用于界面展示。连接 Longbridge 后，点击顶部按钮更新可支持的资产报价。"}</p></div>
          {market.error && <p className="market-feedback error" role="alert">{market.error}</p>}

          <div className="overview-row"><div className="overview-item"><span>自选总数</span><strong>{tracked.toString().padStart(2, "0")}</strong><small>已添加资产</small></div><div className="overview-item"><span>宏观资产</span><strong>{watchlist.macro.length.toString().padStart(2, "0")}</strong><small>指数 · 贵金属 · 债券</small></div><div className="overview-item"><span>个股观察</span><strong>{watchlist.stocks.length.toString().padStart(2, "0")}</strong><small>你的股票清单</small></div><div className="overview-cta"><span>你的工作区</span><strong>从市场全景<br />走向深度分析</strong><p>选择一张卡片，打开图表空间 <ArrowIcon /></p></div></div>

          <AssetSection title="宏观资产" eyebrow="01 / MACRO MARKETS" description="跟踪影响市场方向的关键资产" ids={watchlist.macro} group="macro" onRemove={(id) => updateWatchlist(removeSymbol(watchlist, id))} onAdd={openSearch} quotes={market.result?.quotes ?? {}} />
          <AssetSection title="个股观察" eyebrow="02 / EQUITIES" description="将值得持续研究的公司放在眼前" ids={watchlist.stocks} group="stocks" onRemove={(id) => updateWatchlist(removeSymbol(watchlist, id))} onAdd={openSearch} quotes={market.result?.quotes ?? {}} />
          <footer className="page-footer">AWE Trading Terminal <span>·</span> V0.2 Preview</footer>
        </div>
      </main>

      {searchOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><section className="search-modal" role="dialog" aria-modal="true" aria-label="搜索并添加资产"><div className="modal-heading"><div><span className="section-eyebrow">ADD TO WATCHLIST</span><h2>添加到自选</h2><p>按代码、中文名称或英文名称搜索</p></div><button className="modal-close" onClick={() => setSearchOpen(false)} aria-label="关闭搜索">×</button></div><div className="search-field"><SearchIcon /><input autoFocus placeholder="搜索代码或名称" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="search-results"><div className="results-label">{query.trim() ? `搜索结果 · ${matches.length}` : "热门资产"}</div>{matches.length ? matches.map((symbol) => { const included = watchlist[symbol.group].includes(symbol.id); return <button key={symbol.id} className="search-result" disabled={included} aria-label={`${included ? "已添加" : "添加"} ${symbol.id}`} onClick={() => add(symbol.id)}><span className={`result-symbol color-${symbol.color}`}>{symbol.id.slice(0, 2)}</span><span className="result-name"><strong>{symbol.name}</strong><small>{symbol.id} · {symbol.category}</small></span><span className="result-action">{included ? "已添加" : "+ 添加"}</span></button>; }) : <div className="no-results">没有找到匹配的资产。试试代码或其他名称。</div>}</div><div className="modal-foot">V0.1 提供精选资产目录；实时全市场搜索将在后续版本开放。</div></section></div>}
    </div>
  );
}
