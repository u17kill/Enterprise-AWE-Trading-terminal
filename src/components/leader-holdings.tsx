"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Brand } from "./brand";
import { FundCharterLink } from "./fund-charter-link";
import { filterManagers, GROUPS, MANAGERS, type GroupFilter, type Manager } from "../lib/leader-holdings";
import type { ManagerSnapshot } from "../lib/leader-holdings-source";
import seed from "../data/leader-holdings-seed.json";

const number = new Intl.NumberFormat("en-US");
const STORAGE_KEY = "awe.leader-holdings.v07";
const seedManagers = seed.managers as Record<string, ManagerSnapshot>;

function quarter(period: string) { const date = new Date(`${period}T00:00:00Z`); return `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth() / 3) + 1}`; }
function historical(snapshot: ManagerSnapshot) { return Date.now() - new Date(`${snapshot.period}T00:00:00Z`).getTime() > 365 * 24 * 60 * 60 * 1000; }
function usd(thousands: number) { return thousands >= 1_000_000 ? `$${(thousands / 1_000_000).toFixed(1)}B` : thousands >= 1_000 ? `$${(thousands / 1_000).toFixed(1)}M` : `$${number.format(thousands)}K`; }

function savedSnapshots(raw: string): Record<string, ManagerSnapshot> {
  if (!raw) return seedManagers;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("managers" in parsed)) return seedManagers;
    const managers = (parsed as { managers: unknown }).managers;
    if (!managers || typeof managers !== "object") return seedManagers;
    const merged = { ...seedManagers };
    for (const [cik, entry] of Object.entries(managers)) {
      if (!MANAGERS.some((manager) => manager.cik === cik) || !entry || typeof entry !== "object") continue;
      const row = entry as ManagerSnapshot;
      if (row.cik === cik && typeof row.period === "string" && typeof row.secUrl === "string" && Array.isArray(row.topHoldings) && row.topHoldings.length && new Date(row.checkedAt).getTime() > new Date(merged[cik].checkedAt).getTime()) merged[cik] = row;
    }
    return merged;
  } catch { return seedManagers; }
}

function ManagerCard({ manager, snapshot, active, onSelect }: { manager: Manager; snapshot: ManagerSnapshot; active: boolean; onSelect: () => void }) {
  return <button type="button" className={`holdings-manager-card${active ? " selected" : ""}`} onClick={onSelect} aria-pressed={active}>
    <span className="holdings-card-top"><span className="holdings-monogram">{manager.name.slice(0, 1)}</span><span className={`holdings-data-badge${historical(snapshot) ? " historical" : ""}`}>{historical(snapshot) ? "历史申报 · " : "已披露 · "}{quarter(snapshot.period)}</span></span>
    <strong>{manager.name}</strong>
    <small>{manager.filer}</small>
    <span className="holdings-card-stats">{snapshot.nonOptionCount} 项非期权证券 · 申报总值 {usd(snapshot.totalValueThousands)}</span>
    <span className="holdings-card-top-positions">{snapshot.topHoldings.slice(0, 3).map((row) => row.symbol ?? row.issuer).join(" · ")}</span>
    <span className="holdings-card-bottom">CIK {manager.cik}<span>查看详情 →</span></span>
  </button>;
}

function ManagerDetails({ manager, snapshot, onClose }: { manager: Manager; snapshot: ManagerSnapshot; onClose: () => void }) {
  return <aside className="holdings-detail" role="dialog" aria-modal="false" aria-label={`${manager.name} 详情`}>
    <div className="holdings-detail-head"><div><span className="section-eyebrow">INSTITUTION / 13F</span><h2>{manager.name}</h2><p>{manager.filer}</p></div><button type="button" onClick={onClose} aria-label="关闭详情">×</button></div>
    <div className="holdings-detail-body">
      <p className={historical(snapshot) ? "holdings-history" : "holdings-pending"}>{historical(snapshot) ? "历史申报 · " : "公开申报 · "}报告期 {snapshot.period}，提交日 {snapshot.filedAt}。这是申报时点的持仓，不是实时仓位。{snapshot.formType === "RESTATEMENT" ? "本期为修正申报。" : ""}{snapshot.formType === "13F-NT" ? "本机构以 13F-NT 通知，由母公司代报持仓。" : ""}</p>
      <div className="holdings-detail-section"><h3>13F 持仓</h3>
        <p>共 {number.format(snapshot.holdingsCount)} 项申报，其中 {number.format(snapshot.nonOptionCount)} 项非期权证券；申报表总值 {usd(snapshot.totalValueThousands)}{snapshot.optionCount > 0 ? "（含期权条目）" : ""}。下列展示市值最高的 {snapshot.topHoldings.length} 项非期权证券，金额单位为千美元。</p>
        <div className="holdings-archive-list">{snapshot.topHoldings.map((row) => <div className="holdings-archive-row" key={`${row.cusip}-${row.securityClass}`}><div><strong>{row.symbol ?? row.issuer}</strong><span>{row.issuer} · {row.securityClass} · CUSIP {row.cusip}</span></div><div><strong>${number.format(row.valueThousands)}K</strong><span>{row.shares === null ? "股数未列明" : `${number.format(row.shares)} 股`} · {row.percent === null ? "占比未列明" : `${row.percent.toFixed(2)}%`}</span></div></div>)}</div>
        {snapshot.optionCount > 0 && <p>另有 {number.format(snapshot.optionCount)} 项期权申报，未计入上方证券列表；期权申报不能当作股票空头。</p>}
      </div>
      <div className="holdings-detail-section"><h3>季度变化</h3><p>暂无可比较的相邻季度数据，因此暂不生成增持、减持或新进判断。</p></div>
      <div className="holdings-detail-section"><h3>数据范围</h3><p>持仓表由 13f.info 转录公开 13F；占比采用其申报表总值口径，含期权条目时不能理解为纯多头组合权重。转录值可能与 SEC 原件有差异，请点击原件核对。13F 有季度延迟，不代表整个基金，也不披露股票空头。</p></div>
      <a className="holdings-sec-link" href={snapshot.secUrl} target="_blank" rel="noopener noreferrer">查看 SEC 原件 ↗</a>
      <a className="holdings-sec-link" href={snapshot.providerUrl} target="_blank" rel="noopener noreferrer">查看 13f.info 转录 ↗</a>
    </div>
  </aside>;
}

export function LeaderHoldings() {
  const [group, setGroup] = useState<GroupFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const cached = useSyncExternalStore((callback) => { window.addEventListener("storage", callback); window.addEventListener("awe-holdings-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-holdings-change", callback); }; }, () => { try { return window.localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; } }, () => "");
  const snapshots = useMemo(() => savedSnapshots(cached), [cached]);
  const visible = useMemo(() => filterManagers(group, query), [group, query]);
  const selected = MANAGERS.find((manager) => manager.id === selectedId);

  async function refresh() {
    setRefreshing(true);
    setRefreshMessage("");
    try {
      const response = await fetch("/api/holdings/refresh", { cache: "no-store" });
      if (!response.ok) throw new Error("服务暂不可用");
      const result = await response.json() as { asOf: string; managers: Record<string, ManagerSnapshot>; failures: string[] };
      if (!result.managers || !Array.isArray(result.failures)) throw new Error("返回的数据格式不正确");
      const next = { ...snapshots, ...result.managers };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ asOf: result.asOf, managers: next })); window.dispatchEvent(new Event("awe-holdings-change")); }
      catch { setRefreshMessage("已核对最新申报，但浏览器未能保存结果。"); }
      if (result.failures.length) setRefreshMessage(`${MANAGERS.length - result.failures.length} 家已核对；${result.failures.length} 家来源暂不可用，继续显示上次成功数据。`);
      else setRefreshMessage(`已核对 ${MANAGERS.length} 家机构的最新公开申报。`);
    } catch { setRefreshMessage("更新暂时失败，已公开的持仓数据继续保留。请稍后重试。"); }
    finally { setRefreshing(false); }
  }

  return <div className="app-shell holdings-shell">
    <aside className="sidebar"><Brand /><div className="sidebar-label">工作台</div><nav aria-label="主导航"><Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link><Link className="nav-item" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link><Link className="nav-item" href="/calendar"><span className="nav-glyph">▤</span>财经日历</Link><Link className="nav-item" href="/news"><span className="nav-glyph">◉</span>市场动态</Link><Link className="nav-item active" href="/holdings" aria-current="page"><span className="nav-glyph">♟</span>大佬持仓</Link><Link className="nav-item" href="/options"><span className="nav-glyph">◇</span>期权计算</Link><Link className="nav-item" href="/philosophy"><span className="nav-glyph">✦</span>大师哲学</Link><Link className="nav-item" href="/canary"><span className="nav-glyph">◈</span>金丝雀指标</Link><Link className="nav-item" href="/framework"><span className="nav-glyph">⌂</span>投资框架</Link></nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V0.7 · 13F 机构</div><p>查看公开申报主体，核对披露日期和原件。</p></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>大佬持仓</strong></div><div className="topbar-actions"><span className="sample-pill">SEC 13F · 按季披露</span><FundCharterLink /></div></header>
      <div className="holdings-content"><div className="holdings-hero"><div><span className="section-eyebrow">AWE / LEADER HOLDINGS · V0.7</span><h1>大佬持仓</h1><p>浏览 29 家机构最近一次已公开的 13F，并从 SEC 原件核对。</p></div><button type="button" className="primary-button" disabled={refreshing} onClick={() => { void refresh(); }}>{refreshing ? "正在核对申报…" : "更新持仓"}</button></div>
        <div className="holdings-notice" role="status"><strong>已载入 29 家机构的公开持仓。</strong> 页面先显示已保存的申报快照；点击更新会逐家检查新季度。数据由 13f.info 转录，详情可打开 SEC 原件。{refreshMessage && <span className="holdings-refresh-message">{refreshMessage}</span>}</div>
        <section className="holdings-focus"><div className="holdings-section-title"><span className="section-eyebrow">DISCLOSURE WATCH</span><h2>季度变化</h2></div><div className="holdings-focus-empty">目前只有每家机构最近一期快照；相邻两期的增减持对比仍待接入。请按详情中的报告期和提交日理解这些持仓。</div></section>
        <section className="holdings-directory"><div className="holdings-section-title"><span className="section-eyebrow">INSTITUTION DIRECTORY</span><h2>机构目录 <small>{visible.length} / {MANAGERS.length}</small></h2></div>
          <div className="holdings-controls"><div className="holdings-tabs" aria-label="机构分组"><button type="button" className={group === "all" ? "active" : ""} aria-pressed={group === "all"} onClick={() => setGroup("all")}>全部 {MANAGERS.length}</button>{GROUPS.map((item) => <button type="button" key={item.id} className={group === item.id ? "active" : ""} aria-pressed={group === item.id} onClick={() => setGroup(item.id)}>{item.label} {MANAGERS.filter((manager) => manager.group === item.id).length}</button>)}</div><input type="search" aria-label="搜索机构" placeholder="搜索机构、人物或 CIK" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className={`holdings-workarea${selected ? " with-detail" : ""}`}><div className="holdings-grid">{visible.map((manager) => <ManagerCard key={manager.id} manager={manager} snapshot={snapshots[manager.cik]} active={selectedId === manager.id} onSelect={() => setSelectedId(manager.id)} />)}{visible.length === 0 && <p className="holdings-no-match">没有匹配的机构。可以更换分组或搜索词。</p>}</div>{selected && <ManagerDetails manager={selected} snapshot={snapshots[selected.cik]} onClose={() => setSelectedId(null)} />}</div>
        </section>
      </div>
    </main>
  </div>;
}
