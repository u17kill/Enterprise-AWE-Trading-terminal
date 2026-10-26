"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CURATED_EVENTS, DATE_PENDING, eventsOnDate, mergeCalendarEvents, monthCells, type CalendarCategory, type CalendarEvent } from "../lib/financial-calendar";
import { Brand } from "./brand";

const LABELS: Record<CalendarCategory, string> = { industry: "产业展会", summit: "国际峰会", company: "科技发布", earnings: "重点财报", "central-bank": "央行会议", macro: "经济指标" };
const CATEGORIES = Object.keys(LABELS) as CalendarCategory[];
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
type Snapshot = { events: CalendarEvent[]; asOf: string; partial?: boolean; missing?: string[] };
const monthFromDate = (value: string) => value.slice(0, 7);
const shiftMonth = (month: string, delta: number) => { const [year, number] = month.split("-").map(Number); const date = new Date(Date.UTC(year, number - 1 + delta, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; };
const localToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Singapore" });
const cacheKey = (month: string) => `awe.calendar.v04.${month}`;

export function FinancialCalendar() {
  const [today] = useState(localToday);
  const [month, setMonth] = useState(() => monthFromDate(localToday()));
  const [selected, setSelected] = useState(localToday);
  const [category, setCategory] = useState<CalendarCategory | "all">("all");
  const [freshSnapshots, setFreshSnapshots] = useState<Record<string, Snapshot>>({});
  const cached = useSyncExternalStore((callback) => { window.addEventListener("storage", callback); window.addEventListener("awe-calendar-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-calendar-change", callback); }; }, () => { try { return window.localStorage.getItem(cacheKey(month)) ?? ""; } catch { return ""; } }, () => "");
  const snapshot = useMemo(() => {
    if (freshSnapshots[month]) return freshSnapshots[month];
    try { const parsed = cached ? JSON.parse(cached) as Snapshot : null; return parsed && Array.isArray(parsed.events) && typeof parsed.asOf === "string" ? parsed : null; }
    catch { return null; }
  }, [cached, freshSnapshots, month]);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/longbridge/status", { cache: "no-store" }).then((response) => response.json()).then((data) => { if (active) setConnected(Boolean(data.connected)); }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  const events = useMemo(() => mergeCalendarEvents(CURATED_EVENTS, snapshot?.events ?? []).filter((event) => category === "all" || event.category === category).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title)), [snapshot, category]);
  const upcomingEarnings = useMemo(() => mergeCalendarEvents(CURATED_EVENTS, snapshot?.events ?? []).filter((event) => event.category === "earnings" && event.start >= today).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title)), [snapshot, today]);
  const cells = useMemo(() => monthCells(month), [month]);
  const dayEvents = eventsOnDate(events, selected);
  const monthEvents = events.filter((event) => event.start.slice(0, 7) === month || (event.end && event.start <= `${month}-31` && event.end >= `${month}-01`));
  const visibleCount = monthEvents.length;

  function moveMonth(delta: number) { const next = shiftMonth(month, delta); setMonth(next); setSelected(`${next}-01`); setError(""); }
  async function refresh() {
    setRefreshing(true); setError("");
    try {
      const response = await fetch(`/api/calendar?month=${month}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "日历更新失败。");
      const next: Snapshot = { events: Array.isArray(data.events) ? data.events : [], asOf: data.asOf, partial: Boolean(data.partial), missing: data.missing };
      setFreshSnapshots((current) => ({ ...current, [month]: next }));
      try { window.localStorage.setItem(cacheKey(month), JSON.stringify(next)); window.dispatchEvent(new Event("awe-calendar-change")); } catch { setError("已更新，但浏览器未能保存本月数据。"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "日历更新失败。"); }
    finally { setRefreshing(false); }
  }

  return <div className="app-shell calendar-shell">
    <aside className="sidebar">
      <Brand />
      <div className="sidebar-label">工作台</div>
      <nav aria-label="主导航"><Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link><Link className="nav-item" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link><Link className="nav-item active" href="/calendar" aria-current="page"><span className="nav-glyph">▤</span>财经日历</Link><Link className="nav-item" href="/news"><span className="nav-glyph">◉</span>市场动态</Link><Link className="nav-item" href="/holdings"><span className="nav-glyph">▤</span>大佬持仓</Link><Link className="nav-item" href="/options"><span className="nav-glyph">◇</span>期权计算</Link></nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V0.4 · 事件观察</div><p>来源明确的日期才进入日历；财报和宏观事件按需更新。</p></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>财经日历</strong></div><span className="sample-pill">日期可能变更 · 以来源为准</span></header>
      <div className="calendar-content">
        <div className="calendar-hero"><div><span className="section-eyebrow">AWE / EVENT RADAR · V0.4</span><h1>财经日历</h1><p>把影响市场的会议、发布会、财报与经济指标放在同一张月历上。</p></div><div className="calendar-hero-actions"><button className="calendar-today" disabled={refreshing} onClick={() => { setMonth(monthFromDate(today)); setSelected(today); setError(""); }}>今天</button><button className="primary-button" disabled={!connected || checking || refreshing} onClick={() => void refresh()}>{refreshing ? "更新中…" : "↻ 更新日历"}</button>{!connected && !checking && <a className="calendar-connect" href="/api/longbridge/connect?return=%2Fcalendar">连接 Longbridge</a>}</div></div>
        <div className="calendar-source-note"><strong>数据说明</strong><span>大会、央行会议及部分重点财报来自官方已发布日程；点击更新后，再补充 Longbridge 的当月财报和经济指标。未公布日期的事件列在下方。</span></div>
        <div className="calendar-summary"><div><strong>{visibleCount}</strong><span>本月可见事件</span></div><div><strong>{snapshot?.events.length ?? "—"}</strong><span>已更新的长桥事件</span></div><div><strong>{snapshot ? new Date(snapshot.asOf).toLocaleString("zh-CN") : "尚未更新"}</strong><span>本月最近更新时间</span></div></div>
        <section className="calendar-earnings" aria-label="近期重点财报"><div className="calendar-earnings-head"><div><span className="section-eyebrow">EARNINGS WATCH</span><h2>近期重点财报</h2><p>公司已公告的日期可直接查看；点击“更新日历”补充长桥覆盖的美股及其他市场。</p></div><button onClick={() => setCategory("earnings")}>仅看财报 →</button></div>{upcomingEarnings.length ? <div className="calendar-earnings-list">{upcomingEarnings.map((event) => <button key={event.id} onClick={() => { setMonth(monthFromDate(event.start)); setSelected(event.start); setCategory("earnings"); setError(""); }} aria-label={`查看 ${event.title} ${event.start}`}><span>{event.start.slice(5).replace("-", "/")}</span><strong>{event.title}</strong><small>{event.region} · {event.source}</small></button>)}</div> : <p className="calendar-no-earnings">目前没有已核实的未来财报日期。可以切换月份并更新日历。</p>}</section>
        {error && <p role="alert" className="calendar-alert">{error}</p>}
        {snapshot?.partial && <p role="status" className="calendar-alert">部分市场数据未返回：{snapshot.missing?.join("、")}。已有事件仍可查看。</p>}
        <div className="calendar-filters" aria-label="事件分类"><button className={category === "all" ? "selected" : ""} onClick={() => setCategory("all")}>全部</button>{CATEGORIES.map((item) => <button key={item} className={category === item ? `selected category-${item}` : ""} onClick={() => setCategory(item)}>{LABELS[item]}</button>)}</div>
        <div className="calendar-layout"><section className="calendar-board" aria-label="月历"><div className="calendar-month-bar"><h2>{month.replace("-", " 年 ")} 月</h2><div><button aria-label="上个月" disabled={refreshing} onClick={() => moveMonth(-1)}>‹</button><button aria-label="下个月" disabled={refreshing} onClick={() => moveMonth(1)}>›</button></div></div><div className="calendar-grid">{WEEKDAYS.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}{cells.map((day, index) => day ? <button key={day} className={`calendar-cell ${day === selected ? "is-selected" : ""} ${day === today ? "is-today" : ""}`} onClick={() => setSelected(day)} aria-label={`${day}，${eventsOnDate(events, day).length} 个事件`}><span className="calendar-date">{Number(day.slice(-2))}</span><span className="calendar-cell-events">{eventsOnDate(events, day).slice(0, 2).map((event) => <span key={event.id} className={`calendar-dot category-${event.category}`}>{event.title}</span>)}{eventsOnDate(events, day).length > 2 && <small>+{eventsOnDate(events, day).length - 2} 项</small>}</span></button> : <div className="calendar-cell calendar-empty" key={`empty-${index}`} />)}</div></section>
          <aside className="calendar-detail"><span className="section-eyebrow">SELECTED DATE</span><h2>{selected.slice(5).replace("-", " / ")}</h2><p className="calendar-detail-year">{selected.slice(0, 4)} 年 · {dayEvents.length} 个事件</p>{dayEvents.length ? dayEvents.map((event) => <article className={`calendar-event category-${event.category}`} key={event.id}><div className="calendar-event-meta"><span>{LABELS[event.category]}</span><span>{event.region}</span></div><h3>{event.title}</h3><p>{event.detail}</p><div className="calendar-event-date">{event.start}{event.end ? ` — ${event.end}` : ""}{event.time && Number.isFinite(Date.parse(event.time)) ? ` · ${new Date(event.time).toLocaleTimeString("zh-CN", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit" })} 新加坡时间` : ""}{event.status === "tentative" ? " · 暂定" : event.status === "provider" ? " · 数据商日程" : ""}</div><div className="calendar-event-source">来源：{event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{event.source} ↗</a> : event.source}</div></article>) : <div className="calendar-no-events">当天暂无已确认日期的事件。可切换月份或更新长桥日历。</div>}</aside>
        </div>
        <section className="calendar-pending"><div><span className="section-eyebrow">WATCHLIST / DATE PENDING</span><h2>持续关注 · 日期待公布</h2><p>这些是观察清单，不占用日历日期。官方公布后再核对并录入。</p></div><div className="calendar-pending-list">{DATE_PENDING.map((item) => <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" key={item.title}><span>{LABELS[item.category as CalendarCategory]}</span><strong>{item.title}</strong><small>查看资料入口 ↗</small></a>)}</div></section>
      </div>
    </main>
  </div>;
}
