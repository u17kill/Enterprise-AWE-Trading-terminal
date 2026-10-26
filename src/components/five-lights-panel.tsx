"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { LIGHTS_KEY, loadLights, parseLights, type LightId, type Lights, type LightState } from "../lib/five-lights";
import { HEALTH_STORAGE_KEY, mergeHealthSnapshot, parseHealthSnapshot, type HealthId, type HealthReading, type HealthSnapshot, type HealthState } from "../lib/market-health";
import "../app/market-health.css";

const lights: { id: LightId; title: string; hint: string }[] = [
  { id: "volatility", title: "波动率", hint: "VIX · 期限结构" },
  { id: "breadth", title: "市场宽度", hint: "标普成分股 MA50 / MA200" },
  { id: "liquidity", title: "流动性 / 信用", hint: "高收益债信用利差" },
  { id: "crowding", title: "拥挤度", hint: "SPY Put/Call 分位" },
  { id: "leverage", title: "杠杆", hint: "NFCI 杠杆子指数 · 周度" },
];
const metrics: { id: HealthId; title: string; icon: string }[] = [
  { id: "yieldCurve", title: "美债收益率曲线", icon: "⌁" },
  { id: "equalWeight", title: "标普等权表现", icon: "≋" },
  { id: "putCall", title: "Put / Call", icon: "↔" },
  { id: "fearGreed", title: "恐慌与贪婪", icon: "◔" },
];
const stateText: Record<HealthState, string> = { green: "绿灯 · 平稳", amber: "黄灯 · 关注", red: "红灯 · 警戒", unknown: "待数据" };
const manualText: Record<LightState, string> = { green: "绿灯", amber: "黄灯", red: "红灯", unknown: "未判断" };

function dateLabel(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(value)) : "未更新"; }
function valueLabel(id: HealthId, value?: number) {
  if (value === undefined) return "—";
  if (id === "fearGreed" || id === "crowding") return value.toFixed(0);
  if (id === "leverage") return value.toFixed(3);
  if (id === "yieldCurve" || id === "equalWeight") return `${value >= 0 ? "+" : ""}${value.toFixed(id === "yieldCurve" ? 2 : 1)}`;
  return value.toFixed(2);
}
function Source({ reading }: { reading?: HealthReading }) { return <footer className="mh-source"><span>{reading ? `${reading.source} · ${dateLabel(reading.asOf)}` : "等待数据源"}</span>{reading && <a href={reading.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`打开${reading.source}来源`}>↗</a>}</footer>; }
function MiniLine({ points, secondary }: { points?: number[]; secondary?: number[] }) {
  if (!points || points.length < 2) return <div className="mh-chart-empty">等待有效时间序列</div>;
  const all = [...points, ...(secondary ?? [])], min = Math.min(...all), span = Math.max(...all) - min || 1;
  const coords = (values: number[]) => values.map((n, i) => `${i / (values.length - 1) * 184},${64 - (n - min) / span * 52}`).join(" ");
  return <svg className="mh-mini-line" viewBox="0 0 184 68" role="img" aria-label={secondary ? "两条归一化走势" : "最近走势"}><line x1="0" x2="184" y1="65" y2="65" stroke="#e3eaf4" /><polyline points={coords(points)} fill="none" stroke="#3476df" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{secondary && secondary.length > 1 && <polyline points={coords(secondary)} fill="none" stroke="#e6a03a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}</svg>;
}
function Gauge({ score }: { score?: number }) {
  const value = score === undefined ? null : Math.max(0, Math.min(100, score));
  return <div className="mh-gauge" role="img" aria-label={value === null ? "恐慌贪婪指数尚未更新" : `恐慌贪婪指数 ${value.toFixed(0)}，范围 0 到 100`}><div className="mh-gauge-arc" /><div className="mh-gauge-needle" style={{ transform: `translateX(-50%) rotate(${value === null ? 180 : 90 + value * 1.8}deg)` }} /><div className="mh-gauge-pivot" /><span className="mh-gauge-left">极度恐惧</span><span className="mh-gauge-right">极度贪婪</span></div>;
}

export function FiveLightsPanel() {
  const savedSnapshot = useSyncExternalStore((callback) => { window.addEventListener("storage", callback); window.addEventListener("awe-health-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-health-change", callback); }; }, () => window.localStorage.getItem(HEALTH_STORAGE_KEY) ?? "", () => "");
  const savedManual = useSyncExternalStore((callback) => { window.addEventListener("storage", callback); window.addEventListener("awe-lights-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-lights-change", callback); }; }, () => window.localStorage.getItem(LIGHTS_KEY) ?? "", () => "");
  const snapshot = useMemo(() => { try { return parseHealthSnapshot(JSON.parse(savedSnapshot)); } catch { return null; } }, [savedSnapshot]);
  const manual = useMemo<Lights>(() => savedManual ? loadLights({ getItem: () => savedManual }) : parseLights(null), [savedManual]);
  const [editing, setEditing] = useState<LightId | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const updateManual = (id: LightId, state: LightState, note: string) => {
    const next = { ...manual, [id]: { state, note, updatedAt: new Date().toISOString().slice(0, 10) } };
    try { localStorage.setItem(LIGHTS_KEY, JSON.stringify(next)); } catch { /* Browser storage may be disabled. */ }
    window.dispatchEvent(new Event("awe-lights-change"));
  };
  const refresh = async () => {
    setRefreshing(true); setFeedback("");
    try {
      const response = await fetch("/api/market-health", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error("市场健康数据暂不可更新");
      const incoming = await response.json() as HealthSnapshot;
      if (!incoming || typeof incoming.refreshedAt !== "string" || !incoming.readings || !incoming.errors) throw new Error("返回的数据格式无效");
      const next = mergeHealthSnapshot(snapshot, incoming);
      try { localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(next)); } catch { /* Browser storage may be disabled. */ }
      window.dispatchEvent(new Event("awe-health-change"));
    } catch (error) { setFeedback(error instanceof Error ? error.message : "更新失败"); }
    finally { setRefreshing(false); }
  };
  return <section className="market-health" aria-label="市场健康仪表盘">
    <div className="mh-header"><div><span className="section-eyebrow">AWE MARKET HEALTH</span><h2>市场健康仪表盘</h2><p>五灯判断与关键市场信号，帮助你快速识别风险变化</p></div><div className="mh-actions"><button onClick={refresh} disabled={refreshing} aria-label="重新计算市场健康指标">{refreshing ? "正在计算…" : "↻ 重新计算市场状态"}</button><small>只更新仪表盘 · {snapshot ? `上次计算 ${dateLabel(snapshot.refreshedAt)}` : "等待首次更新"}</small></div></div>
    {feedback && <p className="mh-feedback" role="alert">{feedback}</p>}
    <div className="mh-frame"><div className="mh-frame-heading"><div><span className="mh-frame-icon">◉</span><strong>风险观察</strong><small>01 / 五灯模型　　02 / 核心指标</small></div><span>第一行五灯 · 第二行指标　 |　 空位预留</span></div><div className="mh-grid">
      {lights.map(({ id, title, hint }) => {
        const item = snapshot?.readings[id], status = item?.state ?? "unknown", error = snapshot?.errors[id], saved = manual[id];
        return <article className={`mh-card mh-light mh-${status}`} data-testid="health-slot" key={id}><div className="mh-light-top"><div><h3>{title}</h3><span className="mh-state">● {item ? stateText[status] : "待数据"}{item?.stale && <b className="mh-stale">旧数据</b>}</span></div><span className="mh-lamp" aria-label={stateText[status]} /></div><div className="mh-value">{valueLabel(id, item?.value)}<small>{item?.unit ?? ""}</small></div><p className="mh-measure">{hint}</p><div className="mh-divider" /><p className="mh-summary">{item?.summary ?? (error || "点击上方按钮获取指标")}</p>{item?.detail && <p className="mh-detail">{item.detail}</p>}{error && item && <p className="mh-error">{error}</p>}{(saved.note || saved.state !== "unknown") && <p className="mh-manual">人工判断：{manualText[saved.state]}{saved.note ? ` · ${saved.note}` : ""}</p>}<div className="mh-bottom"><Source reading={item} /><button className="mh-note-button" aria-label={`编辑${title}人工备注`} onClick={() => setEditing(editing === id ? null : id)}>{editing === id ? "收起" : "备注"}</button></div>{editing === id && <div className="mh-editor"><label>人工判断<select value={saved.state} onChange={(event) => updateManual(id, event.target.value as LightState, saved.note)}><option value="unknown">未判断</option><option value="green">绿灯</option><option value="amber">黄灯</option><option value="red">红灯</option></select></label><label>备注<textarea maxLength={500} value={saved.note} onChange={(event) => updateManual(id, saved.state, event.target.value)} /></label></div>}</article>;
      })}
      {metrics.map(({ id, title, icon }) => {
        const item = snapshot?.readings[id], error = snapshot?.errors[id];
        return <article className="mh-card mh-secondary" data-testid="health-slot" key={id}><div className="mh-secondary-top"><h3>{title}</h3><span>{icon}</span></div><div className="mh-value">{valueLabel(id, item?.value)}<small>{item?.unit ?? ""}</small></div><p className="mh-measure">{item?.summary ?? (error || "点击重新计算获取数据")}{item?.stale && <b className="mh-stale">旧数据</b>}</p>{id === "yieldCurve" && <MiniLine points={item?.points} />}{id === "equalWeight" && <><MiniLine points={item?.points} secondary={item?.secondaryPoints} /><div className="mh-legend"><span>● RSP 等权 ETF</span><span>● SPY 市值加权 ETF</span></div></>}{id === "putCall" && <div className="mh-bars"><div><span>Call</span><i style={{ width: "100%" }} /><small>100</small></div><div><span>Put</span><i style={{ width: `${item ? Math.min(100, item.value * 100) : 0}%` }} /><small>{item ? (item.value * 100).toFixed(0) : "—"}</small></div></div>}{id === "fearGreed" && <Gauge score={item?.value} />}{item?.detail && <p className="mh-secondary-detail">{item.detail}</p>}{error && item && <p className="mh-error">{error}</p>}<Source reading={item} /></article>;
      })}
      <article className="mh-card mh-placeholder" data-testid="health-slot"><div className="mh-placeholder-plus">＋</div><strong>预留指标</strong><p>保持十格布局<br />以后可添加新的市场信号</p></article>
    </div></div><p className="mh-footnote">来源和日期见各卡。五灯不等权；单一红灯不构成交易建议。市场宽度待完整成分股均线数据。</p>
  </section>;
}
