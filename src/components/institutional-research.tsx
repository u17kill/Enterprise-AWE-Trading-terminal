"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { AppSidebar } from "./app-sidebar";
import { FundCharterLink } from "./fund-charter-link";
import { buildResearchSnapshot, parseResearchDataset, RESEARCH_COUNTRIES, singaporeToday, type ResearchReport, type ResearchSnapshot } from "../lib/institutional-research";
import "../app/institutional-research.css";

const STORAGE_KEY = "awe.institutional-research.v18";
const TAG_LABEL = { bull: "偏多", neutral: "中性", bear: "偏空" } as const;
const subscribe = (callback: () => void) => { window.addEventListener("storage", callback); window.addEventListener("awe-research-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-research-change", callback); }; };
const readSaved = () => { try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; } };
function parseSaved(raw: string): ResearchSnapshot | null { try { return checkedSnapshot(JSON.parse(raw)); } catch { return null; } }

function checkedSnapshot(raw: unknown): ResearchSnapshot {
  if (!raw || typeof raw !== "object" || !("asOf" in raw) || !("topics" in raw) || !("institutions" in raw) || !("reports" in raw)) throw new Error("研报数据格式不正确");
  const candidate = raw as ResearchSnapshot;
  const dataset = parseResearchDataset({ as_of: candidate.asOf, topics: candidate.topics, insts: candidate.institutions, reports: candidate.reports });
  return buildResearchSnapshot(dataset, singaporeToday());
}

function reportSearchText(report: ResearchReport, snapshot: ResearchSnapshot): string {
  const institution = snapshot.institutions.find((item) => item.id === report.inst);
  return [report.title, report.thesis, report.scope, report.call, ...report.pts, institution?.cn, institution?.en].join(" ").toLocaleLowerCase();
}

export function InstitutionalResearch() {
  const saved = useSyncExternalStore(subscribe, readSaved, () => "");
  const [fresh, setFresh] = useState<ResearchSnapshot | null>(null);
  const snapshot = useMemo(() => fresh ?? parseSaved(saved), [fresh, saved]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/research", { cache: "no-store" });
      if (!response.ok) throw new Error("研报文件暂时无法读取");
      const next = checkedSnapshot(await response.json());
      setFresh(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); window.dispatchEvent(new Event("awe-research-change")); } catch { /* Keep the valid in-memory result. */ }
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : "研报更新失败"}。已保留上次有效结果。`);
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  const current = useMemo(() => snapshot ? buildResearchSnapshot({ as_of: snapshot.asOf, topics: snapshot.topics, insts: snapshot.institutions, reports: snapshot.reports }, singaporeToday()) : null, [snapshot]);
  const filtered = useMemo(() => current?.reports.filter((report) => (!institutionId || report.inst === institutionId) && (!topicId || report.topic === topicId) && (!query.trim() || reportSearchText(report, current).includes(query.trim().toLocaleLowerCase()))) ?? [], [current, institutionId, topicId, query]);
  const selectedInstitution = current?.institutions.find((item) => item.id === institutionId);
  const selectedTopic = current?.topics.find((item) => item.id === topicId);
  const active = Boolean(institutionId || topicId || query);
  const groupedCountries = current ? [...new Set(current.institutions.map((item) => item.grp))] : [];

  function reset() { setInstitutionId(""); setTopicId(""); setQuery(""); }
  function selectCell(inst: string, topic: string) { setInstitutionId(inst); setTopicId(topic); document.getElementById("research-reading")?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }

  return <div className="app-shell research-shell"><AppSidebar currentPath="/research" />
    <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> 市场情报 <span>/</span> <strong>机构研报</strong></div><div className="topbar-actions"><span className="sample-pill">近三个月 · 人工整理</span><FundCharterLink /></div></header>
      <div className="research-content"><div className="research-hero"><div><span className="section-eyebrow">AWE / INSTITUTIONAL RESEARCH · V1.8</span><h1>机构研报</h1><p>先看研究覆盖，再读机构对各个问题的判断与论据。</p></div><button className="primary-button" type="button" onClick={() => void refresh()} disabled={busy}>{busy ? "正在读取…" : "↻ 读取最新研报"}</button></div>
        <div className="research-context"><span>策展快照 <strong>{current?.asOf ?? "尚未读取"}</strong></span><span>收录窗口 <strong>{current?.windowStart ?? "—"} — {current?.windowEnd ?? "—"}</strong></span><span>按原报告发布日期筛选</span></div>
        {error && <p className="research-alert" role="alert">{error}</p>}
        <div className="research-stats"><div><span>机构目录</span><strong>{current?.stats.institutions ?? "—"}</strong><small>{current ? `${current.stats.coveredInstitutions} 家近三个月有稿` : "等待读取"}</small></div><div><span>近期报告</span><strong>{current?.stats.reports ?? "—"}</strong><small>按发布日期计</small></div><div><span>有稿格子</span><strong>{current ? `${current.stats.coveredCells}/${current.stats.possibleCells}` : "—"}</strong><small>机构 × 主题覆盖</small></div><div className="research-stats-note"><b>矩阵阅读法</b><p>点有稿格子，查看该机构在该主题的报告。空格保留，用来辨认研究缺口。</p></div></div>
        <section className="research-section" aria-labelledby="research-matrix-title"><div className="research-section-head"><div><span className="section-eyebrow">01 / COVERAGE MAP</span><h2 id="research-matrix-title">机构 × 主题覆盖矩阵</h2><p>每个格子代表该机构在该主题下的近期研报。颜色只表示格内最新一篇的方向。</p></div><strong>{current?.topics.length ?? 0} 个主题</strong></div>
          {current ? <div className="research-matrix-scroll"><div className="research-matrix" style={{ "--research-topic-count": current.topics.length } as CSSProperties}><div className="research-matrix-row research-matrix-header"><div>机构 / 国家</div>{current.topics.map((topic) => <div key={topic.id} title={topic.note}>{topic.name}<small>{topic.desc}</small></div>)}</div>
            {groupedCountries.map((country) => <div key={country}><div className="research-country">{RESEARCH_COUNTRIES[country] ?? country}<span>{current.institutions.filter((item) => item.grp === country).length} 家</span></div>{current.institutions.filter((item) => item.grp === country).map((institution) => <div className="research-matrix-row" key={institution.id}><button type="button" className="research-institution" onClick={() => { setInstitutionId(institution.id); setTopicId(""); }} aria-label={`查看${institution.cn}全部研报`}><strong>{institution.cn}</strong><small>{institution.en}</small></button>{current.topics.map((topic) => { const reports = current.reports.filter((report) => report.inst === institution.id && report.topic === topic.id); const latest = reports[0]; return <div key={topic.id} className="research-cell-wrap">{latest ? <button type="button" className={`research-cell ${latest.tag}${institutionId === institution.id && topicId === topic.id ? " selected" : ""}`} onClick={() => selectCell(institution.id, topic.id)} aria-label={`${institution.cn} ${topic.name} ${reports.length} 篇，最新${TAG_LABEL[latest.tag]}`}><span>{reports.length} 篇</span><small>{TAG_LABEL[latest.tag]}</small></button> : <span className="research-cell-empty" aria-label={`${institution.cn} ${topic.name} 暂无近期研报`}>—</span>}</div>; })}</div>)}</div>)}</div></div> : <div className="research-empty">正在读取机构与主题…</div>}
        </section>
        <section className="research-section" id="research-reading" aria-labelledby="research-reading-title"><div className="research-section-head"><div><span className="section-eyebrow">02 / RESEARCH NOTES</span><h2 id="research-reading-title">研报速览</h2><p>报告摘要按发布日期排序。阅读时请核对原报告语境。</p></div><strong>{filtered.length} 篇当前结果</strong></div>
          <div className="research-filters"><div className="research-topic-filters"><button type="button" className={!topicId ? "active" : ""} onClick={() => setTopicId("")}>所有主题</button>{current?.topics.map((topic) => <button type="button" key={topic.id} className={topicId === topic.id ? "active" : ""} onClick={() => setTopicId(topic.id)}>{topic.name}<small>{current.topicStats[topic.id]?.reports ?? 0}</small></button>)}</div><div className="research-search-row"><label>机构<select value={institutionId} onChange={(event) => setInstitutionId(event.target.value)}><option value="">所有机构</option>{current?.institutions.map((item) => <option key={item.id} value={item.id}>{item.cn}</option>)}</select></label><label>关键词<input type="search" aria-label="搜索研报" placeholder="标题、判断、机构…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button type="button" className="research-reset" onClick={reset}>看全部</button></div></div>
          <p className="research-filter-state">{active ? `当前筛选：${selectedInstitution?.cn ?? "所有机构"} · ${selectedTopic?.name ?? "所有主题"}${query ? ` · “${query}”` : ""}` : "当前展示全部近期研报"}</p>
          {filtered.length ? <div className="research-report-grid">{filtered.map((report) => { const institution = current?.institutions.find((item) => item.id === report.inst); const topic = current?.topics.find((item) => item.id === report.topic); return <article className="research-report" key={report.id}><div className="research-report-meta"><span>{institution?.cn ?? report.inst} · {topic?.name ?? report.topic}</span><time dateTime={report.date}>{report.date}</time></div><div className="research-report-scope"><span>{report.scope}</span><span className={`research-tag ${report.tag}`}>{TAG_LABEL[report.tag]}</span></div><h3>{report.title}</h3><p className="research-thesis">{report.thesis}</p><ul>{report.pts.map((point, index) => <li key={`${report.id}-${index}`}>{point}</li>)}</ul><div className="research-call"><small>关键判断／读数</small><strong>{report.call}</strong></div><footer><span>来源描述：{report.src}</span><em>策展摘要 · 原件待核对</em></footer></article>; })}</div> : <div className="research-empty">{current ? current.stats.reports ? "没有符合筛选条件的研报。可调整关键词或点击“看全部”。" : "近三个月暂无已整理研报。" : "正在读取近期研报…"}</div>}
        </section><p className="research-disclaimer">首批内容来自人工策展资料，来源描述不等于原文链接；尚未逐篇核对机构原件。报告方向只针对该报告的具体对象，不代表机构整体立场。本页刷新只重读本地策展数据。</p>
      </div></main></div>;
}
