"use client";

import Image from "next/image";
import Link from "next/link";
import { Brand } from "./brand";
import { MASTER_GROUPS, type Master } from "../lib/master-philosophy";

function Portrait({ master }: { master: Master }) {
  return <span className="philosophy-portrait-wrap">
    <span className="philosophy-portrait-fallback" aria-hidden="true">{master.name.slice(0, 1)}</span>
    <Image className="philosophy-portrait" src={master.portrait} alt={`${master.name}肖像`} width={84} height={84} unoptimized onError={(event) => { event.currentTarget.hidden = true; }} />
  </span>;
}

function MasterCard({ master, index }: { master: Master; index: number }) {
  return <article className="philosophy-card" aria-label={master.name}>
    <div className="philosophy-person-head">
      <Portrait master={master} />
      <div className="philosophy-person-identity"><span className="philosophy-person-number">NO. {String(index + 1).padStart(2, "0")}</span><h3>{master.name}</h3><span>{master.englishName}</span></div>
    </div>
    <p className="philosophy-bio">{master.bio} <a href={master.bioSource} target="_blank" rel="noopener noreferrer" aria-label={`查看${master.name}简介来源`}>简介来源 ↗</a></p>
    <div className="philosophy-quote-head"><span>摘录 · {String(master.quotes.length).padStart(2, "0")}</span><span className="philosophy-quote-mark">“</span></div>
    <ol className="philosophy-quote-list philosophy-quote-preview">{master.quotes.slice(0, 2).map((quote, quoteIndex) => <li key={quoteIndex}>{quote}</li>)}</ol>
    {master.quotes.length > 2 && <details className="philosophy-more"><summary>查看全部 {master.quotes.length} 条摘录</summary><ol className="philosophy-quote-list" start={3}>{master.quotes.slice(2).map((quote, quoteIndex) => <li key={quoteIndex}>{quote}</li>)}</ol></details>}
  </article>;
}

export function MasterPhilosophy() {
  return <div className="app-shell philosophy-shell">
    <aside className="sidebar"><Brand /><div className="sidebar-label">工作台</div><nav aria-label="主导航"><Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link><Link className="nav-item" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link><Link className="nav-item" href="/calendar"><span className="nav-glyph">▤</span>财经日历</Link><Link className="nav-item" href="/news"><span className="nav-glyph">◉</span>市场动态</Link><Link className="nav-item" href="/holdings"><span className="nav-glyph">▤</span>大佬持仓</Link><Link className="nav-item" href="/options"><span className="nav-glyph">◇</span>期权计算</Link><Link className="nav-item active" href="/philosophy" aria-current="page"><span className="nav-glyph">✦</span>大师哲学</Link><Link className="nav-item" href="/canary"><span className="nav-glyph">◈</span>金丝雀指标</Link></nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V1.0 · 投资思想档案</div><p>从个人笔记出发，重读不同投资流派的思考。</p></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>大师哲学</strong></div><span className="sample-pill">个人摘录 · 非实时数据</span></header>
      <div className="philosophy-content">
        <div className="philosophy-hero"><span className="section-eyebrow">AWE / MASTER PHILOSOPHY</span><h1>大师哲学</h1><p>从价值、配置到交易。十二位投资者与研究者，三种观察市场的角度。</p><div className="philosophy-totals"><span><strong>03</strong> 思想流派</span><span><strong>12</strong> 位人物</span><span><strong>123</strong> 条个人摘录</span></div></div>
        <p className="philosophy-source-note">摘录来自你的 AWE 学习笔记第 21–23 页。保留原笔记措辞；每条话的最初发表出处尚未逐一核实。人物简介另附来源。</p>
        {MASTER_GROUPS.map((group, groupIndex) => {
          const start = MASTER_GROUPS.slice(0, groupIndex).reduce((sum, previous) => sum + previous.masters.length, 0);
          return <section className={`philosophy-group philosophy-group-${group.id}`} id={group.id} key={group.id} aria-labelledby={`philosophy-${group.id}`}>
            <div className="philosophy-group-head"><div><span className="section-eyebrow">0{groupIndex + 1} / THREE SCHOOLS</span><h2 id={`philosophy-${group.id}`}>{group.name}</h2></div><span className="philosophy-group-count">{group.masters.length} 位人物 · {group.masters.reduce((sum, master) => sum + master.quotes.length, 0)} 条摘录</span></div>
            <div className="philosophy-grid">{group.masters.map((master, index) => <MasterCard key={master.id} master={master} index={start + index} />)}</div>
          </section>;
        })}
      </div>
    </main>
  </div>;
}
