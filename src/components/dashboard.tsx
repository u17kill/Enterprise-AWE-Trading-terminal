"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CATALOG, findSymbol, searchSymbols, type MarketSymbol, type SymbolGroup } from "../lib/catalog";
import { DEFAULT_WATCHLIST, V13_MIGRATION_KEY, addSymbol, loadWatchlist, migrateV13Watchlist, removeSymbol, saveWatchlist, type Watchlist } from "../lib/watchlist";
import { TrendChart } from "./trend-chart";
import { MarketRefreshControl } from "./market-refresh-control";
import { useLongbridgeMarket } from "../lib/use-longbridge-market";
import type { IntradayPoint, LiveQuote } from "../lib/longbridge-data";
import { CUSTOM_SYMBOLS_KEY, loadCustomSymbols, saveCustomSymbol } from "../lib/custom-symbols";
import { toLongbridgeSymbol } from "../lib/longbridge-data";
import { FiveLightsPanel } from "./five-lights-panel";
import { Brand } from "./brand";

const SOURCE_NOTES: Record<string, string> = {
  XAUUSD: "黄金现货参考价暂不可用", US10Y: "美国财政部日度收益率暂不可用",
  BTCUSD: "Coinbase BTC/USD 行情暂不可用", N225: "日经 225 第三方指数数据暂不可用", KOSPI: "KOSPI 第三方指数数据暂不可用",
};

function SearchIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
}

function ArrowIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function AssetCard({ symbol, onRemove, quote, trend, refreshed }: { symbol: MarketSymbol; onRemove: (id: string) => void; quote?: LiveQuote; trend?: IntradayPoint[]; refreshed: boolean }) {
  const change = quote ? quote.changeAvailable === false ? "—" : quote.changeBasisPoints !== undefined ? `${quote.changeBasisPoints >= 0 ? "+" : ""}${quote.changeBasisPoints.toFixed(1)} bp` : `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%` : "—";
  const negative = change.startsWith("-");
  const value = quote ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quote.value) : "—";
  const hasTrend = Boolean(trend && trend.length >= 2);
  const trendDate = hasTrend ? new Intl.DateTimeFormat("zh-CN", { timeZone: "America/New_York", month: "2-digit", day: "2-digit" }).format(new Date(trend![0].timestamp)) : "";
  const trendDescription = ["N225", "KOSPI"].includes(symbol.id) ? "近30交易日指数走势" : symbol.id === "XAUUSD" ? "近24小时现货走势" : "最近交易日分时走势";
  const zone = ["HSI", "HSTECH"].includes(symbol.id) ? "Asia/Hong_Kong" : ["SSE", "A500"].includes(symbol.id) ? "Asia/Shanghai" : "America/New_York";
  const quoteTime = quote?.marketDate ? quote.marketDate.replaceAll("-", "/") : quote ? new Intl.DateTimeFormat("zh-CN", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", ...(symbol.id === "US10Y" ? {} : { hour: "2-digit", minute: "2-digit" }) }).format(new Date(quote.timestamp)) : "";
  return (
    <article className={`asset-card color-${symbol.color}`} data-testid="asset-card">
      <div className="asset-card-top">
        <span className="symbol-badge">{symbol.id.slice(0, 2)}</span>
        <button className="remove-button" aria-label={`移除 ${symbol.id}`} title="移除自选" onClick={() => onRemove(symbol.id)}>×</button>
      </div>
      <div className="asset-title-row"><h3>{symbol.name}</h3><span className="asset-symbol">{symbol.id}</span></div>
      <p className="asset-category">{symbol.category} · {symbol.englishName}</p>
      <div className="asset-value-row"><span className="asset-value">{value}</span><span className={`asset-change ${negative ? "negative" : ""}`}>{change}</span></div>
      <p className="asset-unit">{quote ? `${quote.source ?? "Longbridge"} · ${quoteTime} ${quote.marketDate ? "交易日" : symbol.id === "US10Y" ? "发布日期" : zone === "America/New_York" ? "美东" : zone === "Asia/Hong_Kong" ? "香港" : "北京时间"}` : SOURCE_NOTES[symbol.id] ?? (refreshed ? "行情不可用" : "点击更新获取行情")}{quote ? ` · ${symbol.unit}` : ""}</p>
      {hasTrend ? <TrendChart symbolId={symbol.id} points={trend!} negative={negative} description={trendDescription} /> : <div className="trend-unavailable">{refreshed ? "走势数据不可用" : "等待行情更新"}</div>}
      <div className="card-footer"><span>{hasTrend ? ["N225", "KOSPI", "XAUUSD"].includes(symbol.id) ? trendDescription : symbol.id === "US10Y" ? "近 30 个发布日走势" : symbol.id === "BTCUSD" ? "近 24 小时走势" : `${trendDate} 最近交易日分时` : "暂无真实走势"}</span><Link href={symbol.source === "longbridge" ? `/chart/${symbol.id}?name=${encodeURIComponent(symbol.name)}` : `/chart/${symbol.id}`} aria-label={`查看 ${symbol.id} 图表`}>查看图表 <ArrowIcon /></Link></div>
    </article>
  );
}

function AssetSection({ title, eyebrow, description, ids, group, customSymbols, onRemove, onAdd, quotes, trends, refreshed }: { title: string; eyebrow: string; description: string; ids: string[]; group: SymbolGroup; customSymbols: Record<string, MarketSymbol>; onRemove: (id: string) => void; onAdd: () => void; quotes: Record<string, LiveQuote>; trends: Record<string, IntradayPoint[]>; refreshed: boolean }) {
  return (
    <section className="asset-section" aria-label={title}>
      <div className="section-heading"><div><span className="section-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div><button className="section-add" onClick={onAdd}>+ 添加{group === "macro" ? "资产" : "股票"}</button></div>
      {ids.length ? <div className="asset-grid">{ids.map((id) => { const symbol = findSymbol(id) ?? customSymbols[id]; return symbol ? <AssetCard key={id} symbol={symbol} onRemove={onRemove} quote={quotes[id]} trend={trends[id]} refreshed={refreshed} /> : null; })}</div> : <div className="empty-state">这里还没有自选项目。<button onClick={onAdd}>添加第一个</button></div>}
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
  const customSnapshot = useSyncExternalStore(
    (callback) => { window.addEventListener("storage", callback); window.addEventListener("awe-custom-symbol-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-custom-symbol-change", callback); }; },
    () => window.localStorage.getItem(CUSTOM_SYMBOLS_KEY) ?? "",
    () => "",
  );
  const customSymbols = useMemo(() => customSnapshot ? loadCustomSymbols({ getItem: () => customSnapshot }) : {}, [customSnapshot]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteMatches, setRemoteMatches] = useState<MarketSymbol[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const market = useLongbridgeMarket("awe.dashboard.market.v1");

  useEffect(() => {
    if (localStorage.getItem(V13_MIGRATION_KEY)) return;
    const next = migrateV13Watchlist(loadWatchlist(localStorage));
    saveWatchlist(localStorage, next);
    localStorage.setItem(V13_MIGRATION_KEY, "1");
    window.dispatchEvent(new Event("awe-watchlist-change"));
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setSearchOpen(false); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen || !market.connected || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/longbridge/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "搜索暂不可用");
        setRemoteMatches(Array.isArray(data.items) ? data.items : []);
        setSearchError("");
      } catch (error) {
        if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "搜索暂不可用");
      } finally { if (!controller.signal.aborted) setSearchLoading(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [searchOpen, query, market.connected]);

  const matches = useMemo(() => {
    if (!query.trim()) return CATALOG.slice(0, 6);
    const local = searchSymbols(query);
    const localCanonical = new Set(local.map((item) => toLongbridgeSymbol(item.id)));
    return [...local, ...remoteMatches.filter((item) => !localCanonical.has(item.id))];
  }, [query, remoteMatches]);
  const tracked = watchlist.macro.length + watchlist.stocks.length;
  const openSearch = () => { setQuery(""); setRemoteMatches([]); setSearchLoading(false); setSearchError(""); setSearchOpen(true); };
  const updateWatchlist = (next: Watchlist) => { saveWatchlist(window.localStorage, next); window.dispatchEvent(new Event("awe-watchlist-change")); };
  const add = (symbol: MarketSymbol) => {
    if (symbol.source === "longbridge") { saveCustomSymbol(window.localStorage, symbol); window.dispatchEvent(new Event("awe-custom-symbol-change")); }
    updateWatchlist(addSymbol(watchlist, symbol.id));
    setSearchOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">工作台</div>
        <nav aria-label="主导航"><Link className="nav-item active" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href={`/chart/${watchlist.macro[0] ?? watchlist.stocks[0] ?? "SPX"}`}><span className="nav-glyph">⌁</span>图表空间</Link><Link className="nav-item" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link><Link className="nav-item" href="/calendar"><span className="nav-glyph">▤</span>财经日历</Link><Link className="nav-item" href="/news"><span className="nav-glyph">◉</span>市场动态</Link><Link className="nav-item" href="/holdings"><span className="nav-glyph">♟</span>大佬持仓</Link><Link className="nav-item" href="/options"><span className="nav-glyph">◇</span>期权计算</Link><Link className="nav-item" href="/philosophy"><span className="nav-glyph">✦</span>大师哲学</Link><Link className="nav-item" href="/canary"><span className="nav-glyph">◈</span>金丝雀指标</Link><Link className="nav-item" href="/framework"><span className="nav-glyph">⌂</span>投资框架</Link></nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V0.9 · 市场健康预览</div><p>自选资产和市场健康快照保存在此浏览器中。</p></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>总览看板</strong></div><MarketRefreshControl connected={market.connected} checking={market.checking} refreshing={market.refreshing} returnPath="/" onRefresh={() => market.refresh([...watchlist.macro, ...watchlist.stocks, "VIX"]) } /><div className="topbar-right"><span className="sample-pill"><span />{market.result ? "行情已更新" : "等待更新"}</span><span className="avatar">A</span></div></header>
        <div className="dashboard-content">
          <div className="page-hero"><div><div className="hero-kicker"><span className="kicker-line" /> AWE MARKET OVERVIEW</div><h1>你的市场，<em>一目了然。</em></h1><p>集中查看关注的宏观资产和个股，点开任意卡片进入专属图表空间。</p></div><button className="primary-button" aria-label="添加资产" onClick={openSearch}><span>＋</span> 添加资产</button></div>

          <div className="info-banner"><span className="info-icon">ⓘ</span><p><strong>按需更新</strong> — {market.result ? "数据分别来自 Longbridge、DeanFi、美国财政部、Standard Bullion（黄金现货）和 Coinbase；各卡片标明来源与时间。未返回行情的资产显示不可用。" : "连接 Longbridge 后点击顶部按钮获取行情；日经、KOSPI、黄金、比特币与美债收益率采用卡片注明的其他来源。未获取前不显示演示行情。"}</p></div>
          {market.error && <p className="market-feedback error" role="alert">{market.error}</p>}

          <FiveLightsPanel />

          <div className="overview-row"><div className="overview-item"><span>自选总数</span><strong>{tracked.toString().padStart(2, "0")}</strong><small>已添加资产</small></div><div className="overview-item"><span>宏观资产</span><strong>{watchlist.macro.length.toString().padStart(2, "0")}</strong><small>指数 · 贵金属 · 债券</small></div><div className="overview-item"><span>个股观察</span><strong>{watchlist.stocks.length.toString().padStart(2, "0")}</strong><small>你的股票清单</small></div><div className="overview-cta"><span>你的工作区</span><strong>从市场全景<br />走向深度分析</strong><p>选择一张卡片，打开图表空间 <ArrowIcon /></p></div></div>

          <div className="valuation-note"><strong>指数估值观察</strong><span>标普 500 / 纳斯达克 100 的 TTM 与前瞻 PE：等待可核验的数据源，不展示估算值。</span></div>

          <AssetSection title="宏观资产" eyebrow="01 / MACRO MARKETS" description="跟踪影响市场方向的关键资产" ids={watchlist.macro} group="macro" customSymbols={customSymbols} onRemove={(id) => updateWatchlist(removeSymbol(watchlist, id))} onAdd={openSearch} quotes={market.result?.quotes ?? {}} trends={market.result?.trendsBySymbol ?? {}} refreshed={Boolean(market.result)} />
          <AssetSection title="个股观察" eyebrow="02 / EQUITIES" description="将值得持续研究的公司放在眼前" ids={watchlist.stocks} group="stocks" customSymbols={customSymbols} onRemove={(id) => updateWatchlist(removeSymbol(watchlist, id))} onAdd={openSearch} quotes={market.result?.quotes ?? {}} trends={market.result?.trendsBySymbol ?? {}} refreshed={Boolean(market.result)} />
          <footer className="page-footer">Enterprise AWE Trading Terminal <span>·</span> V0.9 Preview</footer>
        </div>
      </main>

      {searchOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><section className="search-modal" role="dialog" aria-modal="true" aria-label="搜索并添加资产"><div className="modal-heading"><div><span className="section-eyebrow">ADD TO WATCHLIST</span><h2>添加到自选</h2><p>按代码、中文名称或英文名称搜索</p></div><button className="modal-close" onClick={() => setSearchOpen(false)} aria-label="关闭搜索">×</button></div><div className="search-field"><SearchIcon /><input autoFocus placeholder="搜索代码或名称" value={query} onChange={(event) => { setQuery(event.target.value); setRemoteMatches([]); setSearchLoading(event.target.value.trim().length >= 2 && market.connected); setSearchError(""); }} /></div><div className="search-results"><div className="results-label">{query.trim() ? `搜索结果 · ${matches.length}${searchLoading ? " · 搜索中" : ""}` : "热门资产"}</div>{matches.length ? matches.map((symbol) => { const included = watchlist[symbol.group].includes(symbol.id) || (toLongbridgeSymbol(symbol.id) !== null && [...watchlist.macro, ...watchlist.stocks].some((id) => toLongbridgeSymbol(id) === toLongbridgeSymbol(symbol.id))); return <button key={symbol.id} className="search-result" disabled={included} aria-label={`${included ? "已添加" : "添加"} ${symbol.id}`} onClick={() => add(symbol)}><span className={`result-symbol color-${symbol.color}`}>{symbol.id.slice(0, 2)}</span><span className="result-name"><strong>{symbol.name}</strong><small>{symbol.id} · {symbol.category}</small></span><span className="result-action">{included ? "已添加" : "+ 添加"}</span></button>; }) : <div className="no-results">{searchLoading ? "正在搜索美股证券库…" : "没有找到匹配的资产。试试代码或其他名称。"}</div>}{searchError && <p className="market-feedback error" role="alert">{searchError}</p>}</div><div className="modal-foot">精选宏观资产和热门股票可直接搜索；连接 Longbridge 后还可搜索完整美股证券目录。</div></section></div>}
    </div>
  );
}
