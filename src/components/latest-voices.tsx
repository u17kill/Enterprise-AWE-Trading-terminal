"use client";

import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { FundCharterLink } from "./fund-charter-link";
import { filterCuratedPeople, type CuratedCategory, type CuratedPerson, type CuratedTag, type CuratedVoiceSnapshot } from "../lib/voices-curated";

const tagName: Record<CuratedTag, string> = { bull: "偏多", neutral: "中性", bear: "偏空" };
const tagOptions: { value: CuratedTag | "all"; label: string }[] = [
  { value: "all", label: "全部" }, { value: "bull", label: "偏多" }, { value: "neutral", label: "中性" }, { value: "bear", label: "偏空" },
];

function PersonCard({ person, compact }: { person: CuratedPerson; compact: boolean }) {
  const points = compact ? person.points.slice(0, 1) : person.points;
  return <article className={`voices-person-card voices-tag-${person.tag}`} aria-label={`${person.cn} ${person.name}`}>
    <header className="voices-person-head"><span className="voices-person-avatar" aria-hidden="true">{person.cn.slice(0, 1)}</span><div><h3>{person.cn}</h3><strong>{person.name}</strong></div><span className={`voices-tag voices-tag-${person.tag}`}>{tagName[person.tag]}</span></header>
    <p className="voices-person-role">{person.role}{person.org && !person.role.includes(person.org) ? ` · ${person.org}` : ""}</p>
    <p className="voices-person-stance">{person.stance}</p>
    <ol className="voices-person-points">{points.map((point, index) => <li key={`${person.id}-${index}`}><div><time dateTime={point.date}>{point.date}</time><span>{point.src}</span></div><p>{point.text}</p></li>)}</ol>
    {!points.length && <p className="voices-person-no-points">暂无可核对的当期要点。</p>}
    <footer>策展摘录 · 原件未逐条核验</footer>
  </article>;
}

function CategorySection({ category, people, compact }: { category: CuratedCategory; people: CuratedPerson[]; compact: boolean }) {
  if (!people.length) return null;
  const groups = category.groups?.length ? category.groups : [{ id: "", name: "" }];
  return <section id={`voices-category-${category.id}`} className="voices-category" aria-label={category.name}>
    <header className="voices-category-head"><div><span className="section-eyebrow">PEOPLE / {category.id.toUpperCase()}</span><h2>{category.name}</h2><p>{category.desc}</p></div><strong>{people.length} 位</strong></header>
    {groups.map((group) => { const members = people.filter((person) => group.id ? person.grp === group.id : true); return members.length ? <div key={group.id || category.id} className="voices-subgroup">{group.name && <h3>{group.name} <small>{members.length} 位</small></h3>}<div className="voices-people-grid">{members.map((person) => <PersonCard key={person.id} person={person} compact={compact} />)}</div></div> : null; })}
  </section>;
}

export function LatestVoices({ initialSnapshot }: { initialSnapshot: CuratedVoiceSnapshot | null }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<CuratedTag | "all">("all");
  const [compact, setCompact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [jumpTo, setJumpTo] = useState<{ id: string } | null>(null);
  const visible = useMemo(() => snapshot ? filterCuratedPeople(snapshot.data.people, query, tag) : [], [snapshot, query, tag]);
  const visiblePoints = visible.reduce((sum, person) => sum + person.points.length, 0);

  useEffect(() => {
    if (!jumpTo) return;
    document.getElementById(`voices-category-${jumpTo.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [jumpTo, visible]);

  async function refresh() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/voices", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "策展数据读取失败");
      if (!result.data || !Array.isArray(result.data.people) || !result.summary || !Array.isArray(result.summary.categories)) throw new Error("策展数据格式不正确");
      setSnapshot(result as CuratedVoiceSnapshot);
      setNotice(`已重读策展数据；新鲜度按 ${result.summary.checkedAt} 核算。`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "策展数据读取失败"); }
    finally { setBusy(false); }
  }

  function jump(categoryId: string) {
    if (!visible.some((person) => person.cat === categoryId)) {
      setQuery(""); setTag("all"); setNotice("已清除筛选，显示目标分类。");
    }
    setJumpTo({ id: categoryId });
  }

  return <div className="app-shell voices-shell"><AppSidebar currentPath="/voices" />
    <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>最新风向</strong></div><div className="topbar-actions"><span className="sample-pill">按人物 · 策展快照</span><FundCharterLink /></div></header>
      <div className="voices-content voices-v110"><div className="voices-hero"><div><span className="section-eyebrow">AWE / LATEST VOICES · V1.10</span><h1>最新风向</h1><p>谁在什么时候，基于什么数字，给出了什么判断。这里展示分歧，不计算“大佬情绪指数”。</p></div><button className="primary-button" type="button" onClick={() => void refresh()} disabled={busy}>{busy ? "正在重读…" : "↻ 更新策展数据"}</button></div>
        <div className="voices-status" role="status"><span>{snapshot ? `${snapshot.summary.people} 位人物 · ${snapshot.summary.points} 条要点 · ${snapshot.data.window[0]} ~ ${snapshot.data.window[1]}` : "策展快照暂不可用"}</span><span>{snapshot ? `快照 ${snapshot.data.as_of} · 当前可见 ${visible.length} 位 / ${visiblePoints} 条` : "请点击更新重试"}</span></div>
        <p className="voices-source-caveat">本页为人工策展摘要；来源字段只标明出口，原件未逐条核验。引语、数字和身份请回原始发布核对。</p>
        {error && <p className="voices-alert" role="alert">{error}；已保留当前页面内容。</p>}{notice && <p className="voices-notice" role="status">{notice}</p>}
        {snapshot && <>
          <section className="voices-mainline" aria-label="本期主线"><div className="voices-mainline-head"><span className="section-eyebrow">EDITORIAL / {snapshot.data.as_of}</span><h2>{snapshot.data.brief.title}</h2><p>整理者的判断，与下方当事人的摘录分开阅读。</p></div><div className="voices-mainline-list">{snapshot.data.brief.items.map((item, index) => <details key={`${index}-${item.h}`}><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.h}</strong></summary><p>{item.t}</p></details>)}</div></section>
          <section className="voices-temperature" aria-label="六类人物温度条"><div className="voices-temperature-head"><h2>六类观点分布</h2><span>多 / 中 / 空 · 按人物计数，不代表市场共识</span></div><div className="voices-temperature-grid">{snapshot.summary.categories.map((category) => <button key={category.id} type="button" onClick={() => jump(category.id)} aria-label={`${category.name} · ${category.people} 位 · 多 ${category.bull} 中 ${category.neutral} 空 ${category.bear}`}><strong>{category.name}</strong><span>{category.people} 位</span><small>{category.bull} / {category.neutral} / {category.bear}</small></button>)}</div></section>
          <section className="voices-controls" aria-label="人物筛选"><label>搜索<input type="search" aria-label="搜索人物与观点" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="姓名、机构、立场或要点正文" /></label><div className="voices-tag-filter" aria-label="立场筛选">{tagOptions.map((option) => <button key={option.value} type="button" aria-pressed={tag === option.value} onClick={() => setTag(option.value)}>{option.label}</button>)}</div><label className="voices-compact-toggle"><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />只看结论</label></section>
          <div className="voices-visible-count">当前可见 {visible.length} / {snapshot.summary.people} 位人物 · {visiblePoints} 条要点{query || tag !== "all" ? "（已筛选）" : ""}</div>
          {snapshot.summary.stale.length > 0 && <details className="voices-freshness"><summary>{snapshot.summary.stale.length} 位人物超过 30 天未更新 · 基准日 {snapshot.summary.checkedAt}</summary><div>{snapshot.summary.stale.map((person) => <span key={person.id}>{person.cn} · {person.latest} · {person.days} 天</span>)}</div></details>}
          {!!snapshot.warnings.length && <p className="voices-alert" role="status">数据校验有 {snapshot.warnings.length} 项提醒，详见版本记录。</p>}
          <div className="voices-categories">{snapshot.data.cats.map((category) => <CategorySection key={category.id} category={category} people={visible.filter((person) => person.cat === category.id)} compact={compact} />)}</div>
          {!visible.length && <div className="voices-empty">当前筛选下没有人物。请调整关键词或立场。</div>}
        </>}
      </div></main></div>;
}
