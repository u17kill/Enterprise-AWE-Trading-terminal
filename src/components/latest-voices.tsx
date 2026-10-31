"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Brand } from "./brand";
import { FundCharterLink } from "./fund-charter-link";
import { VOICE_GROUPS, type VoiceItem, type VoiceSnapshot } from "../lib/latest-voices";

const STORAGE_KEY = "awe.latest-voices.v14";
const subscribe = (callback: () => void) => { window.addEventListener("storage", callback); window.addEventListener("awe-voices-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-voices-change", callback); }; };
const readSaved = () => { try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; } };
function parseSaved(raw: string): VoiceSnapshot | null {
  try { const value = JSON.parse(raw) as VoiceSnapshot; return value && typeof value.asOf === "string" && typeof value.windowStart === "string" && Array.isArray(value.items) && Array.isArray(value.missing) ? value : null; }
  catch { return null; }
}
function displayDate(raw: string) { return new Date(raw).toLocaleDateString("zh-CN", { timeZone: "Asia/Singapore", year: "numeric", month: "short", day: "numeric" }); }

function VoiceCard({ item }: { item: VoiceItem }) {
  return <article className="voices-card">
    <div className="voices-card-meta"><span className="voices-avatar" aria-hidden="true">{item.person.slice(0, 1).toUpperCase()}</span><span><strong>{item.person}</strong><small>{item.role}</small></span><time dateTime={item.publishedAt}>{displayDate(item.publishedAt)}</time></div>
    <h3>{item.title}</h3><p>{item.summary}</p>
    <footer><span>媒体摘要 · {item.source} · 发布 {displayDate(item.publishedAt)}</span><a href={item.url} target="_blank" rel="noopener noreferrer">查看来源 ↗</a></footer>
  </article>;
}

export function LatestVoices() {
  const saved = useSyncExternalStore(subscribe, readSaved, () => "");
  const [fresh, setFresh] = useState<VoiceSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const snapshot = useMemo(() => fresh ?? parseSaved(saved), [fresh, saved]);

  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/voices", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "观点更新失败");
      if (!Array.isArray(data.items) || !Array.isArray(data.missing) || typeof data.asOf !== "string" || typeof data.windowStart !== "string") throw new Error("返回的数据格式不正确");
      const next = data as VoiceSnapshot;
      setFresh(next); setExpanded({});
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); window.dispatchEvent(new Event("awe-voices-change")); }
      catch { setError("已更新，但浏览器未能保存本次结果。"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "观点更新失败"); }
    finally { setBusy(false); }
  }

  return <div className="app-shell voices-shell"><aside className="sidebar"><Brand /><div className="sidebar-label">工作台</div><nav aria-label="主导航">
    <Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link><Link className="nav-item" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link><Link className="nav-item" href="/calendar"><span className="nav-glyph">▤</span>财经日历</Link><Link className="nav-item" href="/news"><span className="nav-glyph">◉</span>市场动态</Link><Link className="nav-item" href="/holdings"><span className="nav-glyph">♟</span>大佬持仓</Link><Link className="nav-item" href="/options"><span className="nav-glyph">◇</span>期权计算</Link><Link className="nav-item" href="/philosophy"><span className="nav-glyph">✦</span>大师哲学</Link><Link className="nav-item" href="/canary"><span className="nav-glyph">◈</span>金丝雀指标</Link><Link className="nav-item active" aria-current="page" href="/voices"><span className="nav-glyph">◌</span>最新风向</Link><Link className="nav-item" href="/framework"><span className="nav-glyph">⌂</span>投资框架</Link>
  </nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V1.4 · 人物观点</div><p>近三个月公开报道，手动核对更新。</p></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>最新风向</strong></div><div className="topbar-actions"><span className="sample-pill">按人物分组 · 近三个月</span><FundCharterLink /></div></header>
      <div className="voices-content"><div className="voices-hero"><div><span className="section-eyebrow">AWE / LATEST VOICES · V1.4</span><h1>最新风向</h1><p>跟踪关键人物近期公开观点。每条摘要附有媒体来源和发布日期。</p></div><button className="primary-button" type="button" onClick={() => void refresh()} disabled={busy}>{busy ? "正在核对来源…" : "↻ 更新观点"}</button></div>
        <div className="voices-status"><span>{snapshot ? `上次更新 ${displayDate(snapshot.asOf)} · 窗口自 ${displayDate(snapshot.windowStart)} 起` : "尚无本地快照 · 点击“更新观点”开始"}</span><span>{snapshot ? `已收录 ${snapshot.items.length} 条 · 查询 ${snapshot.searched} 位人物` : "仅显示可追溯的近期内容"}</span></div>
        {error && <p className="voices-alert" role="alert">{error} {snapshot ? "已保留上次结果。" : ""}</p>}
        {snapshot && snapshot.missing.length > 0 && <p className="voices-alert" role="status">本次有 {snapshot.missing.length} 位人物的索引请求失败，可能遗漏观点：{snapshot.missing.join("、")}。</p>}
        <section className="voices-brief"><div><span className="section-eyebrow">THIS PERIOD</span><h2>本期值得注意</h2></div><p>{snapshot?.items.length ? `本次核对到 ${snapshot.items.length} 条公开媒体摘要，覆盖 ${new Set(snapshot.items.map((item) => item.personId)).size} 位追踪人物。逐条打开来源，核对完整语境与当时身份。` : "更新后按人物分组阅读近期表态。若来源不足，页面会保留明确空状态。"}</p></section>
        <div className="voices-groups">{VOICE_GROUPS.map((group, index) => { const items = snapshot?.items.filter((item) => item.groupId === group.id) ?? []; const shown = expanded[group.id] ? items : items.slice(0, 5); const active = new Set(items.map((item) => item.personId)); return <section key={group.id} className="voices-group" aria-labelledby={`voices-${group.id}`}><div className="voices-group-head"><span className="voices-number">{String(index + 1).padStart(2, "0")}</span><div><span className="section-eyebrow">PEOPLE / {group.id.toUpperCase()}</span><h2 id={`voices-${group.id}`}>{group.title}</h2><p>{group.description}</p></div><strong>{items.length} 条近期观点</strong></div>
          {shown.length ? <div className="voices-grid">{shown.map((item) => <VoiceCard key={item.id} item={item} />)}</div> : <div className="voices-empty">{snapshot ? "当前公开索引中暂无符合近三个月条件的可核验观点。" : "更新后显示近期观点。"}</div>}
          {items.length > 5 && <button type="button" className="voices-expand" onClick={() => setExpanded((current) => ({ ...current, [group.id]: !current[group.id] }))}>{expanded[group.id] ? "收起" : `展开更多 · 余下 ${items.length - 5} 条`}</button>}
          <div className="voices-roster"><strong>追踪名单</strong>{group.people.map((person) => <span key={person.id} className={snapshot && !active.has(person.id) ? "quiet" : ""}>{person.name}{snapshot && !active.has(person.id) ? " · 暂无近期观点" : ""}</span>)}</div>
        </section>; })}</div>
        <p className="voices-footnote">媒体摘要来自公开索引，可能不完整；日期为来源发布日期，不一定等于实际发言日。请以原文为准。暂无结果不代表人物没有表态，也不构成投资建议。</p>
      </div></main></div>;
}
