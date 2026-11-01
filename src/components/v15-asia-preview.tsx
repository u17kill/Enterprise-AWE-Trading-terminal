"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Brand } from "./brand";
import type { AsiaObservation, AsiaProxySymbol } from "../lib/v15-asia-observation";

export const V15_ASIA_STORAGE_KEY = "awe.canary.v15.asia.preview";
type Readings = Partial<Record<AsiaProxySymbol, AsiaObservation>>;
type Snapshot = { readings: Readings; errors: Partial<Record<AsiaProxySymbol, string>> };
const symbols = ["EWS.US", "INDA.US"] as const;
const markets = ["日本", "韩国", "台湾", "香港", "新加坡", "印度"] as const;
const marketSymbol: Partial<Record<(typeof markets)[number], AsiaProxySymbol>> = { 新加坡: "EWS.US", 印度: "INDA.US" };
const sourceLinks: Record<AsiaProxySymbol, string> = {
  "EWS.US": "https://www.ishares.com/us/products/239678/ishares-msci-singapore-etf",
  "INDA.US": "https://www.ishares.com/us/products/239659/ishares-msci-india-etf",
};

function storedValue() { try { return localStorage.getItem(V15_ASIA_STORAGE_KEY) ?? ""; } catch { return ""; } }
function parseSnapshot(value: string): Snapshot {
  try {
    const raw = JSON.parse(value) as { readings?: Record<string, unknown>; errors?: Record<string, unknown> };
    const readings: Readings = {};
    for (const symbol of symbols) {
      const item = raw?.readings?.[symbol] as AsiaObservation | undefined;
      if (item?.symbol === symbol && item.kind === "us_etf_proxy" && item.currency === "USD" && Number.isFinite(item.close) && item.close > 0 && /^\d{4}-\d{2}-\d{2}$/.test(item.asOf)) readings[symbol] = item;
    }
    return { readings, errors: {} };
  } catch { return { readings: {}, errors: {} }; }
}
function change(value: number | null) { return value === null ? "历史不足" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }

export function V15AsiaPreview() {
  const saved = useSyncExternalStore((callback) => { window.addEventListener("storage", callback); window.addEventListener("awe-v15-asia-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-v15-asia-change", callback); }; }, storedValue, () => "");
  const stored = useMemo(() => parseSnapshot(saved), [saved]);
  const [volatile, setVolatile] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<(typeof markets)[number]>("新加坡");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [needsConnection, setNeedsConnection] = useState(false);
  const snapshot = volatile ?? stored;

  const refresh = async () => {
    setBusy(true); setFeedback(""); setNeedsConnection(false);
    try {
      const response = await fetch("/api/canary-v15/asia", { method: "POST", cache: "no-store" });
      const incoming = await response.json() as { readings?: Readings; errors?: Snapshot["errors"]; connected?: boolean };
      if (response.status === 401 || incoming.connected === false) { setNeedsConnection(true); setFeedback("请先连接 Longbridge，再更新数据。"); return; }
      const valid = parseSnapshot(JSON.stringify({ readings: incoming.readings ?? {} }));
      const merged: Snapshot = { readings: { ...snapshot.readings, ...valid.readings }, errors: incoming.errors ?? {} };
      setVolatile(merged);
      try { localStorage.setItem(V15_ASIA_STORAGE_KEY, JSON.stringify({ readings: merged.readings })); } catch { /* Keep the readings in memory. */ }
      window.dispatchEvent(new Event("awe-v15-asia-change"));
      const count = Object.keys(valid.readings).length;
      setFeedback(count ? `已更新 ${count} 个市场代理；其余保留上次成功读数。` : "本次未取到新读数，已保留上次成功结果。");
    } catch { setFeedback("更新失败，已保留上次成功读数；请稍后重试。"); }
    finally { setBusy(false); }
  };

  return <div className="app-shell v15-asia-shell"><aside className="sidebar"><Brand /><div className="sidebar-label">V1.5 预览</div><nav aria-label="主导航"><Link href="/canary" className="nav-item">← 金丝雀旧版</Link><span className="nav-item active">亚太观察</span></nav></aside>
    <main className="v15-asia-main"><div className="v15-asia-top"><div><span className="v15-asia-eyebrow">CANARY / MARKET OBSERVATION</span><h1>亚太观察</h1><p>先核对有可靠行情的市场代理。该预览不代表 V1.5 整版验收。</p></div><button type="button" onClick={refresh} disabled={busy}>{busy ? "更新中…" : "更新亚太数据"}</button></div>
      <div className="v15-asia-notice">新加坡、印度暂以美股上市 ETF 代理观察，价格为美元、美股交易日收盘价，涨跌幅是价格收益，不等于 STI／NIFTY 50 指数或当地市场收盘表现。</div>
      <div className="v15-asia-tabs" role="group" aria-label="亚太市场">{markets.map((market) => <button key={market} type="button" aria-pressed={selected === market} onClick={() => setSelected(market)}>{market}{!marketSymbol[market] && <small>待接入</small>}</button>)}</div>
      {feedback && <p className="v15-asia-feedback" role="status">{feedback} {needsConnection && <a href="/api/longbridge/connect?return=%2Fcanary-v15">连接 Longbridge ↗</a>}</p>}
      <div className="v15-asia-grid">{symbols.filter((symbol) => marketSymbol[selected] === symbol).map((symbol) => { const reading = snapshot.readings[symbol], error = snapshot.errors[symbol]; return <section className="v15-asia-card" data-testid={symbol === "EWS.US" ? "asia-ews" : "asia-inda"} key={symbol}>
        <div className="v15-asia-card-top"><span>{symbol === "EWS.US" ? "新加坡" : "印度"} / 美国上市 ETF 代理</span><strong>{symbol}</strong></div>
        <h2>{symbol === "EWS.US" ? "iShares MSCI Singapore ETF" : "iShares MSCI India ETF"}</h2><p className="v15-asia-benchmark">跟踪 {symbol === "EWS.US" ? "MSCI Singapore" : "MSCI India"}；并非 {symbol === "EWS.US" ? "STI" : "NIFTY 50"}</p>
        <div className="v15-asia-price">{reading ? <><strong>{reading.close.toFixed(2)}</strong><span>USD</span></> : <span>等待首次更新</span>}</div>
        <div className="v15-asia-returns"><div><span>1 日</span><strong>{reading ? change(reading.change1d) : "—"}</strong></div><div><span>5 日</span><strong>{reading ? change(reading.change5d) : "—"}</strong></div><div><span>20 日</span><strong>{reading ? change(reading.change20d) : "—"}</strong></div></div>
        <div className="v15-asia-card-foot"><span>{reading ? `美股交易日 ${reading.asOf} · ${reading.barCount} 根日线` : "尚无成功读数"}</span><a href={sourceLinks[symbol]} target="_blank" rel="noopener noreferrer">ETF 口径 ↗</a></div>{error && reading && <p className="v15-asia-error">本次{error}，保留上次成功读数。</p>}{error && !reading && <p className="v15-asia-error">{error}</p>}
      </section>; })}</div>
      {!marketSymbol[selected] && <div className="v15-asia-pending">{selected}市场数据正在逐项核验；通过数据源、口径和刷新测试后再接入正式页面。</div>}
    </main></div>;
}
