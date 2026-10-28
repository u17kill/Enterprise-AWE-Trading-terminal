"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Brand } from "./brand";
import { buildCanaryAnalysis, CANARY_INDICATORS, CANARY_STORAGE_KEY, mergeCanarySnapshot, parseCanarySnapshot, type CanaryAnalysis, type CanaryIndicator, type CanaryReading, type CanarySnapshot } from "../lib/canary";

const sections = [
  { band: "macro", number: "01", title: "宏观先行", subtitle: "美国 · 日本 · 中国", description: "从利率曲线、信用和汇率观察全球金融条件。" },
  { band: "us", number: "02", title: "美股风险", subtitle: "宽度 · 情绪 · 估值", description: "把波动、市场参与度、杠杆与估值放在同一观察框架。" },
  { band: "china", number: "03", title: "A 股资金与情绪", subtitle: "两融 · 成交 · 估值", description: "观察资金与成交的持续变化，并保留待核验的估值和 ETF 指标。" },
] as const;

function displayDate(value?: string) { return value && Number.isFinite(Date.parse(value)) ? value.slice(0, 10) : "尚无观测日"; }
function storedValue() { try { return localStorage.getItem(CANARY_STORAGE_KEY) ?? ""; } catch { return ""; } }
function expired(reading?: CanaryReading, id?: string) {
  if (!reading) return false;
  const meeting = id === "fedWatch" ? reading.summary.match(/下次会议 (\d{4}-\d{2}-\d{2})/)?.[1] : null;
  return Boolean(reading.stale || Date.now() - Date.parse(reading.asOf) > (id === "fedWatch" ? 3 : 45) * 86_400_000 ||
    (meeting && Date.now() >= Date.parse(meeting) + 86_400_000));
}
function formatValue(reading: CanaryReading) {
  const decimals = Math.abs(reading.value) >= 1000 ? 0 : Math.abs(reading.value) >= 100 ? 2 : Math.abs(reading.value) >= 10 ? 2 : 3;
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: decimals, minimumFractionDigits: Math.min(2, decimals) }).format(reading.value);
}

function Trend({ reading, label }: { reading?: CanaryReading; label: string }) {
  if (!reading?.points || reading.points.length < 2) return null;
  const points = reading.points, low = Math.min(...points), span = Math.max(...points) - low || 1;
  const coords = points.map((value, index) => `${index / (points.length - 1) * 180},${44 - (value - low) / span * 36}`).join(" ");
  return <svg className="canary-trend" viewBox="0 0 180 48" role="img" aria-label={`${label}最近 ${points.length} 次观测走势`}><path d="M0 46H180" stroke="#e9edf2" /><polyline points={coords} fill="none" stroke="#4c93c6" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function IndicatorCard({ item, reading, error }: { item: CanaryIndicator; reading?: CanaryReading; error?: string }) {
  const old = expired(reading, item.id);
  const state = reading && !old ? reading.state : "unknown";
  const pendingReasons: Record<string, { status: string; message: string }> = {
    fedWatch: { status: "待刷新", message: "点击更新读取芝商所下一次会议的 +25 基点概率" },
    bojProb: { status: "口径待核", message: "暂无已核验的日本央行加息概率模型" },
    ndxPe: { status: "口径待核", message: "纳指 100 滚动 PE 的公开来源口径不一致" },
    ndxForward: { status: "需授权", message: "纳指 100 前瞻 PE 尚无获准的自动数据源" },
    allApe: { status: "口径待核", message: "中证全指官方资料未公布可用滚动 PE" },
  };
  const pending = pendingReasons[item.id];
  const status = !reading ? pending?.status ?? "暂不可用" : old ? "旧数据" : state === "red" ? "警戒" : state === "amber" ? "关注" : state === "green" ? "平稳" : "已取数";
  return <details className={`canary-card canary-card-${state}`} data-testid={`canary-${item.id}`}>
    <summary><div className="canary-card-head"><span className="canary-card-region">{item.region} · {item.horizon === "short" ? "中短期" : "中长期"}</span><span className={`canary-card-status canary-status-${state}`}>● {status}</span></div>
      <h3>{item.title}</h3>
      <div className="canary-card-reading">{reading ? <><strong>{formatValue(reading)}</strong><span>{reading.unit}</span></> : <strong className="canary-card-unavailable">—</strong>}</div>
      <p>{reading?.summary ?? (error || pending?.message || "本次没有取得可核验的数值")}</p><Trend reading={reading} label={item.title} />
      <div className="canary-card-foot"><span>{reading ? `${displayDate(reading.asOf)} · ${reading.source}` : "数值尚未通过接入核验"}</span><span>查看解读 ↗</span></div>
    </summary>
    <div className="canary-card-detail">
      <p><b>是什么</b>{item.definition}</p><p><b>怎么看</b>{item.interpretation}</p><p><b>风险依据</b>{item.trigger}</p>
      <p><b>当前判断</b>{reading ? old ? `保留 ${displayDate(reading.asOf)} 的旧读数；需要重新核对，暂不参与顶部风险判断。` : reading.summary : "尚无可用于本页判断的可靠读数，暂不亮风险灯。"}</p>
      <p><b>数据边界</b>{item.limitation}{error ? ` 本次更新：${error}` : ""}</p>
      <a href={reading?.sourceUrl ?? item.sourceUrl} target="_blank" rel="noopener noreferrer">来源：{reading?.source ?? item.sourceName} · {displayDate(reading?.asOf)} ↗</a>
    </div>
  </details>;
}

function AnalysisCard({ report, horizon, index }: { report: CanaryAnalysis; horizon: string; index: string }) {
  return <details className={`canary-analysis canary-analysis-${report.level}`}>
    <summary><span className="canary-analysis-index">{index} / MARKET OUTLOOK</span><span className="canary-analysis-horizon">{horizon}</span><div className="canary-analysis-verdict"><i />{report.title}</div><p>{report.teaser}</p><span className="canary-analysis-expand">阅读完整分析　↗</span></summary>
    <div className="canary-analysis-body">
      <section><h4>判断依据</h4>{report.evidence.length ? report.evidence.map((line) => <p key={line}>{line}</p>) : <p>尚无足够的近期同口径证据支持风险方向判断。</p>}</section>
      <section><h4>相反与未确认信号</h4>{report.contrary.length ? report.contrary.map((line) => <p key={line}>{line}</p>) : <p>有效的反向证据不足；不能将缺失数据视作平稳。</p>}</section>
      <section><h4>接下来观察</h4>{report.watch.map((line) => <p key={line}>{line}</p>)}</section>
      <section className="canary-analysis-limits"><h4>证据边界</h4>{report.limits.map((line) => <p key={line}>{line}</p>)}</section>
    </div>
  </details>;
}

export function CanaryDashboard() {
  const saved = useSyncExternalStore((callback) => { window.addEventListener("storage", callback); window.addEventListener("awe-canary-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-canary-change", callback); }; }, storedValue, () => "");
  const [volatileSnapshot, setVolatileSnapshot] = useState<CanarySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const storedSnapshot = useMemo(() => { try { return parseCanarySnapshot(JSON.parse(saved)); } catch { return null; } }, [saved]);
  const snapshot = volatileSnapshot ?? storedSnapshot;
  const report = useMemo(() => buildCanaryAnalysis(snapshot), [snapshot]);
  const updated = snapshot ? Object.keys(snapshot.readings).length : 0;
  const refresh = async () => {
    setBusy(true); setFeedback("");
    try {
      const response = await fetch("/api/canary", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error(`更新失败（HTTP ${response.status}）`);
      const incoming = parseCanarySnapshot(await response.json());
      if (!incoming) throw new Error("来源返回的数据格式无效");
      const merged = mergeCanarySnapshot(snapshot, incoming);
      setVolatileSnapshot(merged);
      try { localStorage.setItem(CANARY_STORAGE_KEY, JSON.stringify(merged)); } catch { /* The observation stays in memory. */ }
      window.dispatchEvent(new Event("awe-canary-change"));
      setFeedback(`已核对 ${Object.keys(incoming.readings).length} 项指标；其余指标保留来源与接入说明。`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "更新失败"); }
    finally { setBusy(false); }
  };

  return <div className="app-shell canary-shell"><aside className="sidebar"><Brand /><div className="sidebar-label">工作台</div><nav aria-label="主导航">
    <Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link>
    <Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link>
    <Link className="nav-item" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link>
    <Link className="nav-item" href="/calendar"><span className="nav-glyph">▤</span>财经日历</Link>
    <Link className="nav-item" href="/news"><span className="nav-glyph">◉</span>市场动态</Link>
    <Link className="nav-item" href="/holdings"><span className="nav-glyph">♟</span>大佬持仓</Link>
    <Link className="nav-item" href="/options"><span className="nav-glyph">◇</span>期权计算</Link>
    <Link className="nav-item" href="/philosophy"><span className="nav-glyph">✦</span>大师哲学</Link>
    <Link className="nav-item active" href="/canary" aria-current="page"><span className="nav-glyph">◈</span>金丝雀指标</Link>
  </nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V1.1 · 市场先行信号</div><p>按观测日期阅读指标，避免把旧值当成实时行情。</p></div></aside>
  <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>金丝雀指标</strong></div><span className="sample-pill">手动刷新 · 本地保存</span></header>
    <div className="canary-content"><div className="canary-hero"><div><span className="section-eyebrow">AWE / MARKET INTELLIGENCE</span><h1>金丝雀指标</h1><p>宏观先行，再看美股风险与 A 股资金。让风险变化有出处、有日期，也有解释。</p></div><div className="canary-hero-actions"><button type="button" onClick={refresh} disabled={busy}>{busy ? "正在核对数据…" : "↻ 更新指标"}</button><span>{snapshot ? `上次更新 ${displayDate(snapshot.refreshedAt)} · 已有 ${updated} 项读数` : "点击更新获取已接入指标"}</span><a href="/api/longbridge/connect?return=%2Fcanary">连接 Longbridge · 读取 VIX 与期权指标</a></div></div>
      {feedback && <p className="canary-feedback" role="status">{feedback}</p>}
      <div className="canary-legend"><span><i className="legend-live" />有效读数</span><span><i className="legend-old" />旧数据</span><span><i className="legend-pending" />待接入</span><small>数值显示在卡片上；点开可看使用说明、来源与限制。CDS 留待后续版本。</small></div>
      <section className="canary-outlook" aria-label="市场阶段判断"><div className="canary-section-intro"><span>MARKET OUTLOOK</span><h2>分时间尺度看市场</h2><p>只根据有效读数形成条件性判断，缺失数据不会被视为平稳。</p></div><div className="canary-outlook-grid"><AnalysisCard report={report.short} horizon="中短期 · 几天至约一个月" index="01" /><AnalysisCard report={report.long} horizon="中长期 · 三个月至一年" index="02" /></div></section>
      {sections.map((section) => <section className="canary-band" key={section.band} aria-labelledby={`canary-${section.band}-title`}><div className="canary-band-title"><span>{section.number}</span><div><h2 id={`canary-${section.band}-title`}>{section.title}</h2><p>{section.description}</p></div><small>{section.subtitle}</small></div><div className="canary-grid">{CANARY_INDICATORS.filter((item) => item.band === section.band).map((item) => <IndicatorCard key={item.id} item={item} reading={snapshot?.readings[item.id]} error={snapshot?.errors[item.id]} />)}<article className="canary-placeholder"><strong>＋</strong><span>预留指标</span><p>以后可在这一层增加已核验的先行信号。</p></article></div></section>)}
      <p className="canary-footer">不同来源的更新时间、样本范围和许可不同；请按每项卡片的观测日阅读。亮灯是观察提示，不构成交易建议。</p>
    </div></main></div>;
}
