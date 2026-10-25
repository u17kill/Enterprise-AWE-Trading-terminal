"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Brand } from "./brand";
import { CHANOS_ARCHIVE } from "../lib/chanos-archive";
import { filterManagers, GROUPS, MANAGERS, type GroupFilter, type Manager } from "../lib/leader-holdings";

const number = new Intl.NumberFormat("en-US");
const chanosNonOptionTotal = CHANOS_ARCHIVE.holdings.reduce((sum, row) => sum + row.valueUsd, 0);

function ManagerCard({ manager, active, onSelect }: { manager: Manager; active: boolean; onSelect: () => void }) {
  return <button type="button" className={`holdings-manager-card${active ? " selected" : ""}`} onClick={onSelect} aria-pressed={active}>
    <span className="holdings-card-top"><span className="holdings-monogram">{manager.name.slice(0, 1)}</span><span className={`holdings-data-badge${manager.historical ? " historical" : ""}`}>{manager.historical ? "历史申报 · 2023 Q3" : "等待申报数据"}</span></span>
    <strong>{manager.name}</strong>
    <small>{manager.filer}</small>
    <span className="holdings-card-bottom">CIK {manager.cik}<span>查看详情 →</span></span>
  </button>;
}

function ManagerDetails({ manager, onClose }: { manager: Manager; onClose: () => void }) {
  return <aside className="holdings-detail" role="dialog" aria-modal="false" aria-label={`${manager.name} 详情`}>
    <div className="holdings-detail-head"><div><span className="section-eyebrow">INSTITUTION / 13F</span><h2>{manager.name}</h2><p>{manager.filer}</p></div><button type="button" onClick={onClose} aria-label="关闭详情">×</button></div>
    <div className="holdings-detail-body">
      {manager.historical ? <p className="holdings-history">历史申报：报告期 {manager.lastVerifiedPeriod}，提交日 {manager.lastVerifiedFiledAt}。这不是当前持仓。</p> : <p className="holdings-pending">这家机构的 SEC 申报主体已核实；持仓数据尚未接入。</p>}
      <div className="holdings-detail-section"><h3>13F 持仓</h3>{manager.cik === "0001446440" ? <>
        <p>历史申报 · {CHANOS_ARCHIVE.holdings.length} 项非期权申报。申报市值合计 ${number.format(chanosNonOptionTotal)}；占比仅以这 7 项非期权证券为分母，不代表整个基金或当前仓位。</p>
        <div className="holdings-archive-list">{CHANOS_ARCHIVE.holdings.map((row) => <div className="holdings-archive-row" key={row.cusip}><div><strong>{row.title}</strong><span>{row.issuer} · CUSIP {row.cusip}</span></div><div><strong>${number.format(row.valueUsd)}</strong><span>{number.format(row.shares)} 股 · {(row.valueUsd / chanosNonOptionTotal * 100).toFixed(1)}%</span></div></div>)}</div>
        <p>同一申报还有期权条目，未计入上面的非期权列表与占比；期权不等于股票空头。</p>
        <a className="holdings-table-link" href={CHANOS_ARCHIVE.informationTableUrl} target="_blank" rel="noopener noreferrer">查看 SEC 信息表 ↗</a>
      </> : <p>暂无可展示的持仓明细。待来源接通并核对 SEC 原件后，这里会显示申报时点的证券、股数与占比。</p>}</div>
      <div className="holdings-detail-section"><h3>季度变化</h3><p>暂无可比较的相邻季度数据，因此暂不生成增持、减持或新进判断。</p></div>
      <div className="holdings-detail-section"><h3>数据范围</h3><p>13F 是有延迟的美国证券申报，不能代表整个基金组合，也不披露股票空头。</p></div>
      <a className="holdings-sec-link" href={manager.secUrl} target="_blank" rel="noopener noreferrer">查看 SEC 原件 ↗</a>
    </div>
  </aside>;
}

export function LeaderHoldings() {
  const [group, setGroup] = useState<GroupFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = useMemo(() => filterManagers(group, query), [group, query]);
  const selected = MANAGERS.find((manager) => manager.id === selectedId);

  return <div className="app-shell holdings-shell">
    <aside className="sidebar"><Brand /><div className="sidebar-label">工作台</div><nav aria-label="主导航"><Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link><Link className="nav-item" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link><Link className="nav-item" href="/calendar"><span className="nav-glyph">▤</span>财经日历</Link><Link className="nav-item" href="/news"><span className="nav-glyph">◉</span>市场动态</Link><Link className="nav-item active" href="/holdings" aria-current="page"><span className="nav-glyph">▤</span>大佬持仓</Link></nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V0.7 · 13F 机构</div><p>查看公开申报主体，核对披露日期和原件。</p></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>大佬持仓</strong></div><span className="sample-pill">SEC 13F · 按季披露</span></header>
      <div className="holdings-content"><div className="holdings-hero"><div><span className="section-eyebrow">AWE / LEADER HOLDINGS · V0.7</span><h1>大佬持仓</h1><p>浏览值得关注的申报主体，并从 SEC 原件核对其披露。</p></div><button type="button" className="primary-button" disabled title="当前环境无法访问 SEC 申报数据">更新持仓 · 待接入</button></div>
        <div className="holdings-notice" role="status"><strong>目前可查看 29 家机构目录。</strong> 查诺斯有 2023 Q3 经 SEC 信息表核对的历史非期权持仓；其余机构的数据通路尚未接通。页面不显示模拟仓位或变化。</div>
        <section className="holdings-focus"><div className="holdings-section-title"><span className="section-eyebrow">DISCLOSURE WATCH</span><h2>最近披露变化</h2></div><div className="holdings-focus-empty">尚无可比较的申报快照。接通数据后，这里只展示能够从相邻季度 13F 核实的事实变化。</div></section>
        <section className="holdings-directory"><div className="holdings-section-title"><span className="section-eyebrow">INSTITUTION DIRECTORY</span><h2>机构目录 <small>{visible.length} / {MANAGERS.length}</small></h2></div>
          <div className="holdings-controls"><div className="holdings-tabs" aria-label="机构分组"><button type="button" className={group === "all" ? "active" : ""} aria-pressed={group === "all"} onClick={() => setGroup("all")}>全部 {MANAGERS.length}</button>{GROUPS.map((item) => <button type="button" key={item.id} className={group === item.id ? "active" : ""} aria-pressed={group === item.id} onClick={() => setGroup(item.id)}>{item.label} {MANAGERS.filter((manager) => manager.group === item.id).length}</button>)}</div><input type="search" aria-label="搜索机构" placeholder="搜索机构、人物或 CIK" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className={`holdings-workarea${selected ? " with-detail" : ""}`}><div className="holdings-grid">{visible.map((manager) => <ManagerCard key={manager.id} manager={manager} active={selectedId === manager.id} onSelect={() => setSelectedId(manager.id)} />)}{visible.length === 0 && <p className="holdings-no-match">没有匹配的机构。可以更换分组或搜索词。</p>}</div>{selected && <ManagerDetails manager={selected} onClose={() => setSelectedId(null)} />}</div>
        </section>
      </div>
    </main>
  </div>;
}
