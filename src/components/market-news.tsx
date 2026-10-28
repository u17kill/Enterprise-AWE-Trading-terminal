"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Brand } from "./brand";
import type { NewsCategory, NewsItem, NewsSnapshot } from "../lib/market-news";

const STORAGE_KEY = "awe.news.v06";
const LABELS: Record<NewsCategory, string> = { geopolitics: "地缘与全球风险", macro: "宏观与政策", ai: "AI 与科技", industry: "其他产业与公司" };
const CATEGORIES = Object.keys(LABELS) as NewsCategory[];

function savedSnapshot(raw: string): NewsSnapshot | null {
  try {
    const value = JSON.parse(raw) as NewsSnapshot;
    return value && Array.isArray(value.items) && Array.isArray(value.highlights) && typeof value.asOf === "string" && [3, 5, 7].includes(value.days) ? value : null;
  } catch { return null; }
}

function NewsCard({ item, lead = false }: { item: NewsItem; lead?: boolean }) {
  const date = Number.isFinite(Date.parse(item.publishedAt)) ? new Date(item.publishedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" }) : item.publishedAt;
  return <article className={`news-card ${lead ? "news-card-lead" : ""}`}>
    <div className="news-card-top"><span>{LABELS[item.category]}</span><time dateTime={item.publishedAt}>{date}</time></div>
    <h3>{item.title}</h3>
    {item.summary && <p>{item.summary}</p>}
    <footer><span>{item.source}</span><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`查看原文：${item.title}`}>查看原文 ↗</a></footer>
  </article>;
}

export function MarketNews() {
  const [days, setDays] = useState<3 | 5 | 7>(3);
  const [fresh, setFresh] = useState<NewsSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const cached = useSyncExternalStore((callback) => { window.addEventListener("storage", callback); window.addEventListener("awe-news-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-news-change", callback); }; }, () => { try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; } }, () => "");
  const snapshot = useMemo(() => fresh ?? savedSnapshot(cached), [fresh, cached]);

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/news?days=${days}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "新闻更新失败。");
      if (!Array.isArray(data.items) || !Array.isArray(data.highlights) || typeof data.asOf !== "string") throw new Error("新闻数据格式不正确。");
      const next = data as NewsSnapshot;
      setFresh(next);
      setExpanded({});
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); window.dispatchEvent(new Event("awe-news-change")); }
      catch { setError("新闻已更新，但浏览器未能保存结果。"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "新闻更新失败。"); }
    finally { setRefreshing(false); }
  }

  return <div className="app-shell news-shell">
    <aside className="sidebar"><Brand /><div className="sidebar-label">工作台</div><nav aria-label="主导航"><Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link><Link className="nav-item" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link><Link className="nav-item" href="/calendar"><span className="nav-glyph">▤</span>财经日历</Link><Link className="nav-item active" href="/news" aria-current="page"><span className="nav-glyph">◉</span>市场动态</Link><Link className="nav-item" href="/holdings"><span className="nav-glyph">♟</span>大佬持仓</Link><Link className="nav-item" href="/options"><span className="nav-glyph">◇</span>期权计算</Link><Link className="nav-item" href="/philosophy"><span className="nav-glyph">✦</span>大师哲学</Link><Link className="nav-item" href="/canary"><span className="nav-glyph">◈</span>金丝雀指标</Link></nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V0.6 · 新闻速览</div><p>按需更新，保留最近一次成功获取的新闻。</p></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>市场动态</strong></div><span className="sample-pill">来源可追溯 · 手动更新</span></header>
      <div className="news-content"><div className="news-hero"><div><span className="section-eyebrow">AWE / MARKET PULSE · V0.6</span><h1>市场动态</h1><p>从全球事件到产业变化，先看重要消息，再打开原文核对。</p></div><div className="news-controls"><div className="news-range" aria-label="新闻时间范围">{([3, 5, 7] as const).map((value) => <button key={value} className={days === value ? "selected" : ""} aria-pressed={days === value} onClick={() => setDays(value)}>{value} 天</button>)}</div><button className="primary-button" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "更新中…" : "更新新闻"}</button></div></div>
        <div className="news-status"><span>{snapshot ? `上次更新：${new Date(snapshot.asOf).toLocaleString("zh-CN", { timeZone: "Asia/Singapore" })} · 过去 ${snapshot.days} 天` : "尚未更新 · 点击“更新新闻”获取最新简报"}</span><span>按重要性排序；指定媒体在同一事件中优选</span></div>
        {error && <p className="news-alert" role="alert">{error}</p>}
        {snapshot?.partial && <p className="news-alert" role="status">部分来源未返回：{snapshot.missing.join("、")}。其余新闻仍可查看。</p>}
        {snapshot ? <>
          <section className="news-focus" aria-label="全球焦点"><div className="news-section-head"><div><span className="section-eyebrow">GLOBAL FOCUS</span><h2>全球焦点</h2></div><span>本次精选 {snapshot.items.length} 条</span></div>{snapshot.highlights.length ? <div className="news-focus-grid">{snapshot.highlights.map((item) => <NewsCard key={item.id} item={item} lead />)}</div> : <div className="news-empty">所选时间范围内暂无符合条件的新闻。可选择更长时间范围后更新。</div>}</section>
          <div className="news-columns">{CATEGORIES.map((category) => { const all = snapshot.items.filter((item) => item.category === category); const visible = expanded[category] ? all : all.slice(0, 8); return <section className="news-column" key={category} aria-label={LABELS[category]}><div className="news-column-head"><span className={`news-category-dot ${category}`} /><h2>{LABELS[category]}</h2><small>{all.length} 条</small></div>{visible.length ? visible.map((item) => <NewsCard key={item.id} item={item} />) : <div className="news-empty">当前窗口没有足够可信的相关新闻。</div>}{all.length > 8 && <button className="news-expand" onClick={() => setExpanded((current) => ({ ...current, [category]: !current[category] }))}>{expanded[category] ? "收起" : `查看全部 ${all.length} 条`}</button>}</section>; })}</div>
        </> : <div className="news-welcome"><strong>准备好查看最近的市场新闻</strong><p>选择过去 3、5 或 7 天，点击更新后生成按重要性排序的新闻速览。</p></div>}
        <p className="news-disclaimer">新闻由公开索引及可用数据源提供，可能存在遗漏或延迟。摘要只显示来源提供的内容；付费报道请在原网站阅读。</p>
      </div>
    </main>
  </div>;
}
