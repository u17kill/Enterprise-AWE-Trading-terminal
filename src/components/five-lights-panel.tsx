"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FIVE_LIGHTS, LIGHTS_KEY, loadLights, parseLights, type LightId, type Lights, type LightState } from "../lib/five-lights";
import type { LiveQuote } from "../lib/longbridge-data";

const labels: Record<LightState, string> = { green: "绿灯", amber: "黄灯", red: "红灯", unknown: "待判断" };

export function FiveLightsPanel({ vix }: { vix?: LiveQuote }) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [lights, setLights] = useState<Lights>(() => typeof window === "undefined" ? parseLights(null) : loadLights(window.localStorage));
  const [editing, setEditing] = useState<LightId | null>(null);
  useEffect(() => { if (mounted) try { localStorage.setItem(LIGHTS_KEY, JSON.stringify(lights)); } catch { /* Browser may disallow local storage. */ } }, [lights, mounted]);
  const update = (id: LightId, state: LightState, note: string) => setLights((current) => ({ ...current, [id]: { state, note, updatedAt: new Date().toISOString().slice(0, 10) } }));
  return <section className="five-lights" aria-label="五灯健康检查"><div className="five-lights-header"><div><span className="section-eyebrow">MARKET HEALTH / 五灯模型</span><h2>市场健康检查</h2><p>沿用原周报的五个维度。颜色与判断由你维护，证据和日期一同保存。</p></div><div className="vix-reading"><span>VIX · Longbridge</span><strong>{vix ? vix.value.toFixed(2) : "—"}</strong><small>{vix ? `截至 ${new Date(vix.timestamp).toLocaleString("zh-CN")}` : "点击更新获取报价"}</small></div></div><div className="lights-grid">{FIVE_LIGHTS.map((definition) => { const item = mounted ? lights[definition.id] : parseLights(null)[definition.id]; return <article className={`light-card light-${item.state}`} key={definition.id}><div className="light-card-top"><span className="light-dot" /><strong>{definition.label}</strong><small>{labels[item.state]}</small></div><p>{item.note || definition.hint}</p><footer><span>{item.updatedAt || "尚未判断"}</span><button onClick={() => setEditing(editing === definition.id ? null : definition.id)}>{editing === definition.id ? "完成" : "编辑"}</button></footer>{editing === definition.id && <div className="light-editor"><label>灯色<select aria-label={`${definition.label}灯色`} value={item.state} onChange={(event) => update(definition.id, event.target.value as LightState, item.note)}><option value="unknown">待判断</option><option value="green">绿灯</option><option value="amber">黄灯</option><option value="red">红灯</option></select></label><label>判断依据<textarea aria-label={`${definition.label}判断依据`} maxLength={500} value={item.note} onChange={(event) => update(definition.id, item.state, event.target.value)} /></label></div>}</article>; })}</div><p className="five-lights-source">五灯定义沿用 Enterprise AWE 周报；除 VIX 报价外，颜色属于人工判断。</p></section>;
}
