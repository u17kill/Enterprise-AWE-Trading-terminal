"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AppSidebar } from "./app-sidebar";
import { FundCharterLink } from "./fund-charter-link";
import "../app/canary-research.css";

export type ResearchKind = "temperature" | "valuation" | "sentiment";
type Market = "us" | "cn";
type Reading = { id: string; title: string; value: number | null; unit: string; asOf: string | null; source: string; summary: string; explanation: string; points: { date: string; value: number }[]; status: string; sample?: number; percentiles?: Record<3 | 5 | 10, number | null>; basis?: string; factors?: { position: number; crowding: number; momentum: number } | null };
type Snapshot = { market: Market; kind: ResearchKind; refreshedAt: string; closeAsOf?: string; readings: Reading[]; leaders?: { symbol: string; title: string; changePercent: number; weightPercent: number }[]; movers?: { universe: number; gainers: { symbol: string; name: string; changePercent: number; marketCap: number }[]; losers: { symbol: string; name: string; changePercent: number; marketCap: number }[] } | null; sectors?: { symbol: string; title: string; changePercent: number; change5?: number; change20?: number; change60?: number }[]; sectorAsOf?: string | null; sectorLayer?: "close" | "intraday"; errors: Record<string, string> };
const MARKET_KEY = "awe-v15-market";
const pages = { temperature: { title: "市场温度", subtitle: "价格位置、参与拥挤与动能：观察指数相对自身历史的冷热。" }, valuation: { title: "估值分析", subtitle: "当前值、同口径历史与分位：理解估值处在哪个区间。" }, sentiment: { title: "短线精灵", subtitle: "最近已收盘交易日的市场情绪与板块变化；宽度按可核验来源显示。" } };
const objects: Record<Market, { id: string; name: string; descriptor: string; valuationDescriptor?: string; valuationCode?: string }[]> = {
  us: [{ id: "SPY.US", name: "标普 500", descriptor: "SPY ETF 代理", valuationDescriptor: "标普 500 指数 PE-TTM", valuationCode: "SPX" }, { id: "QQQ.US", name: "纳斯达克 100", descriptor: "QQQ ETF 代理", valuationDescriptor: "纳指 100 指数 PE-TTM", valuationCode: "NDX" }, { id: "SOXX.US", name: "半导体", descriptor: "SOXX ETF", valuationDescriptor: "半导体指数前瞻 PE", valuationCode: "SOX" }, { id: "DIA.US", name: "道琼斯", descriptor: "DIA ETF 代理", valuationDescriptor: "道指指数 PE 当前值", valuationCode: "DJI" }],
  cn: [{ id: "000300.SH", name: "沪深 300", descriptor: "A 股指数" }, { id: "000688.SH", name: "科创 50", descriptor: "A 股指数" }, { id: "399006.SZ", name: "创业板指", descriptor: "A 股指数" }, { id: "000922.SH", name: "中证红利", descriptor: "A 股指数" }],
};
const guidance: Record<ResearchKind, { title: string; body: string }[]> = {
  temperature: [
    { title: "位置", body: "价格相对均线、波动区间和近一年高点的位置。分数高表示相对历史更热，不代表未来一定回落。" },
    { title: "拥挤", body: "结合成交参与、波动与换手或成交量。美股 ETF 与 A 股指数的参与度口径不同，不能把同分数当成同一市场热度。" },
    { title: "动能", body: "观察短期上涨与下跌的强弱。总分经三日平滑，单项变化和总分可能不同步。" },
    { title: "历史检验", body: "各温度区间的独立事件数及无条件基准尚待复算。当前分数只描述历史冷热，不给出胜率、未来方向或概率结论。" },
  ],
  valuation: [
    { title: "主估值", body: "先确认 PE-TTM、前瞻 PE、PB 或股息率的定义，再看当前值；不同口径不直接横向排名。" },
    { title: "历史分位", body: "分别与近 3、5、10 年的同口径历史比较。历史不足时只展示实际可用样本期。" },
    { title: "价格 × 估值", body: "价格与 PE 的同日长期对照仍待可靠来源，当前仅展示估值本身的历史变化；不能把估值上行直接解释为盈利增长或价格上涨。" },
    { title: "道指边界", body: "DIA 基金分配收益率不能冒充道指 PE 历史。未核实同口径历史前，不计算道指 PE 分位。" },
  ],
  sentiment: [
    { title: "市场广度", body: "美股目前接入标普 500 成分股 MA50 宽度。A 股上涨／下跌家数来自乐咕乐股沪深市场同日收盘统计；两市 52 周新高新低仍未接入。涨跌停家数不能代替全市场广度。" },
    { title: "板块强弱", body: "对照行业或板块的涨跌和持续性，先看全市场，再看领涨与落后板块。" },
    { title: "风险偏好", body: "美股综合恐惧贪婪、Put/Call 与波动；A 股结合涨跌停、成交与赚钱效应。复合指标的分项不重复当成独立证据。" },
    { title: "日期边界", body: "收盘复盘仅使用最近一个完整交易日；盘中榜单单独标注，不混入收盘判断。" },
  ],
};
function storeKey(kind: ResearchKind, market: Market) { return `awe-v15-${kind}-${market}`; }
function subscribe(callback: () => void) { window.addEventListener("storage", callback); window.addEventListener("awe-v15-change", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("awe-v15-change", callback); }; }
function savedMarket(): Market { try { return localStorage.getItem(MARKET_KEY) === "cn" ? "cn" : "us"; } catch { return "us"; } }
function parseSnapshot(raw: string, kind: ResearchKind, market: Market): Snapshot | null { try { const data = JSON.parse(raw) as Snapshot; return data?.kind === kind && data.market === market && Array.isArray(data.readings) && data.readings.some((item) => typeof item.value === "number" && Number.isFinite(item.value)) ? data : null; } catch { return null; } }
function Sparkline({ points, label }: { points: Reading["points"]; label: string }) {
  if (points.length < 2) return <div className="research-no-chart">历史走势尚无已核验数据</div>;
  const values = points.map((p) => p.value), min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  return <svg className="research-chart" viewBox="0 0 560 170" role="img" aria-label={`${label}历史走势，${points.length}个观测`}><path d="M20 20H540M20 80H540M20 140H540" stroke="#e9eef5" strokeWidth="1" /><polyline fill="none" stroke="#398ce0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={values.map((v, i) => `${20 + i / (values.length - 1) * 520},${140 - (v - min) / span * 120}`).join(" ")} /></svg>;
}

function DataGaps({ errors }: { errors: Record<string, string> }) {
  const items = Object.entries(errors);
  if (!items.length) return null;
  return <section className="research-gaps" aria-label="未取得的数据"><strong>未取得的数据</strong><div>{items.map(([id, reason]) => <p key={id}>{reason}</p>)}</div></section>;
}

function SentimentView({ market, snapshot }: { market: Market; snapshot: Snapshot | null }) {
  const readings = snapshot?.readings ?? [];
  const pulse = readings.filter((item) => ["temperature", "sentiment", "valuation"].includes(item.id));
  const details = readings.filter((item) => !["temperature", "sentiment", "valuation"].includes(item.id));
  const asOf = snapshot?.closeAsOf ?? pulse[0]?.asOf?.slice(0, 10);
  return <>
    <div className="research-section-title"><h2>{market === "us" ? "美股" : "A 股"} · 收盘复盘</h2><span>{asOf ? `${asOf} · 最近完整交易日` : "等待收盘快照"}</span></div>
    <div className="research-pulse-cards">{pulse.map((item) => <article key={item.id}><small>{item.source}</small><strong>{item.title}</strong><div>{item.value?.toFixed(0)}<span>{item.unit}</span></div><p>{item.explanation}</p></article>)}</div>
    <div className="research-columns"><section className="research-panel"><h2>六次情绪脉搏</h2><p>显示最近六次已核验观测；100 分表示更热，分项是长桥的独立定义。</p><Sparkline points={pulse[0]?.points ?? []} label="市场温度" /><div className="research-pulse-list">{pulse[0]?.points?.map((point) => <span key={point.date}><small>{point.date.slice(5)}</small><strong>{point.value.toFixed(0)}</strong></span>)}</div><div className="research-source">{pulse[0] ? `${pulse[0].source} · ${pulse[0].asOf?.slice(0, 10)}` : "更新后显示已核验的历史观测"}</div></section><section className="research-panel"><h2>风险偏好与市场结构</h2><p>{market === "us" ? "综合恐惧贪婪、宽度、期权与波动率。每项保留自身股票池和日期。" : "涨跌停与板块表现使用收盘股池；盘中榜单另行标注。"}</p><div className="research-metric-grid">{details.length ? details.map((item) => <details key={item.id}><summary><small>{item.title}</small><strong>{item.value === null ? "—" : `${Number.isInteger(item.value) ? item.value : item.value.toFixed(2)} ${item.unit}`}</strong><span>{item.status}</span></summary><p>{item.explanation}</p><small>{item.source} · {item.asOf?.slice(0, 10)}</small></details>) : <div className="research-no-chart">尚无已核验的结构指标</div>}</div></section></div>
    {market === "us" && <><div className="research-section-title"><h2>七巨头观察</h2><span>{snapshot?.leaders?.length ? `${asOf} · 昨日市值权重` : "等待七家公司同日收盘数据"}</span></div><section className="research-panel"><p>观察七家公司自身的涨跌与权重。Alphabet 以 GOOGL 代表整家公司；这组数据不等于它们对纳指或标普的点数贡献。</p>{snapshot?.leaders?.length ? <div className="research-leaders">{snapshot.leaders.map((leader) => <div key={leader.symbol}><span><strong>{leader.title}</strong><small>{leader.symbol.split(".")[0]}</small></span><b className={leader.changePercent >= 0 ? "positive-text" : "negative-text"}>{leader.changePercent >= 0 ? "+" : ""}{leader.changePercent.toFixed(2)}%</b><small>篮子权重 {leader.weightPercent.toFixed(1)}%</small></div>)}</div> : <div className="research-no-chart">尚无七家公司同日可核验价格与股本</div>}</section></>}
    {market === "us" && <><div className="research-section-title"><h2>美股大市值涨跌榜</h2><span>{snapshot?.movers ? `${asOf} · ${snapshot.movers.universe} 只筛选样本` : "等待同日收盘样本"}</span></div><section className="research-panel"><p>市值至少 100 亿美元的美股筛选样本，按同日收盘涨跌幅排序。榜单只代表该样本，不代表标普、纳指或美股全市场的涨跌家数。</p>{snapshot?.movers ? <div className="research-movers">{([ ["领涨", snapshot.movers.gainers], ["领跌", snapshot.movers.losers] ] as const).map(([label, rows]) => <div key={label}><h3>{label}</h3>{rows.map((row) => <div className="research-mover-row" key={row.symbol}><span><strong>{row.name}</strong><small>{row.symbol.split(".")[0]}</small></span><b className={row.changePercent >= 0 ? "positive-text" : "negative-text"}>{row.changePercent >= 0 ? "+" : ""}{row.changePercent.toFixed(2)}%</b></div>)}</div>)}</div> : <div className="research-no-chart">尚无同日可核验的大市值涨跌榜</div>}</section></>}
    <div className="research-section-title"><h2>板块热力</h2><span>{snapshot?.sectorAsOf ? `${snapshot.sectorAsOf} · ${snapshot.sectorLayer === "intraday" ? "独立盘中观察，不纳入收盘判断" : "同日收盘"}` : "等待同日板块数据"}</span></div>
    <section className="research-panel"><p>{market === "us" ? "11 个美股行业 ETF 当日涨跌，按对应 ETF 价格计算；下表还展示 5/20/60 个交易日的变化。" : "长桥行业榜单的涨跌幅，列出领先与落后行业；盘中更新与收盘复盘分层阅读。"}</p>{snapshot?.sectors?.length ? <div className="research-sectors research-sectors-wide">{snapshot.sectors.map((sector) => <div key={sector.symbol} className={sector.changePercent >= 0 ? "positive" : "negative"}><strong>{sector.title}</strong><span>{sector.changePercent >= 0 ? "+" : ""}{sector.changePercent.toFixed(2)}%</span></div>)}</div> : <div className="research-no-chart">板块行情尚未核验</div>}{market === "us" && snapshot?.sectors?.some((sector) => sector.change20 !== undefined) && <div className="research-sector-trends"><div className="research-sector-trend-head"><strong>行业 ETF</strong><strong>5 日</strong><strong>20 日</strong><strong>60 日</strong></div>{snapshot.sectors.map((sector) => <div key={sector.symbol}><span>{sector.title} <small>{sector.symbol.split(".")[0]}</small></span>{([sector.change5, sector.change20, sector.change60] as const).map((change, index) => <span key={index} className={change === undefined ? "" : change >= 0 ? "positive-text" : "negative-text"}>{change === undefined ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}</span>)}</div>)}</div>}</section>
    <DataGaps errors={snapshot?.errors ?? {}} />
  </>;
}

export function CanaryResearchShell({ kind }: { kind: ResearchKind }) {
  const storedMarket = useSyncExternalStore<Market>(subscribe, savedMarket, () => "us");
  const [marketOverride, setMarketOverride] = useState<Market | null>(null);
  const market = marketOverride ?? storedMarket;
  const [volatileSnapshot, setVolatileSnapshot] = useState<Snapshot | null>(null);
  const saved = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(storeKey(kind, market)) ?? ""; } catch { return ""; } }, () => "");
  const snapshot = useMemo(() => volatileSnapshot?.kind === kind && volatileSnapshot.market === market ? volatileSnapshot : parseSnapshot(saved, kind, market), [volatileSnapshot, saved, kind, market]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const chooseMarket = (value: Market) => { setMarketOverride(value); setSelected(0); setFeedback(""); try { localStorage.setItem(MARKET_KEY, value); window.dispatchEvent(new Event("awe-v15-change")); } catch { /* Selection still works in memory. */ } };
  const refresh = async () => {
    const requestedMarket = market;
    setBusy(true); setFeedback("");
    try {
      const response = await fetch(`/api/canary-research/${kind}?market=${market}`, { method: "POST", cache: "no-store" });
      const result = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(result.error || `更新失败（HTTP ${response.status}）`);
      if (result.kind !== kind || result.market !== requestedMarket || !Array.isArray(result.readings)) throw new Error("来源返回的数据格式无效");
      const validCount = result.readings.filter((item) => typeof item.value === "number" && Number.isFinite(item.value)).length;
      if (!validCount) throw new Error(`本次未取得可用读数：${[...new Set(Object.values(result.errors ?? {}))].slice(0, 2).join("；") || "来源暂无完整数据"}。上次有效数据已保留。`);
      setVolatileSnapshot(result);
      try { localStorage.setItem(storeKey(kind, requestedMarket), JSON.stringify(result)); } catch { /* Keep latest data in memory. */ }
      window.dispatchEvent(new Event("awe-v15-change"));
      setFeedback(`已核对 ${validCount} 项读数；其余项目显示具体原因。`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "更新失败；上次数据已保留。"); }
    finally { setBusy(false); }
  };
  const items = kind === "sentiment" ? [] : objects[market];
  const current = items[selected];
  const reading = current && snapshot?.market === market ? snapshot.readings.find((item) => item.id === current.id) : null;
  return <div className="app-shell research-shell"><AppSidebar currentPath={`/canary/${kind}`} /><main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> 金丝雀指标 <span>/</span> <strong>{pages[kind].title}</strong></div><div className="topbar-actions"><a className="research-connect" href={`/api/longbridge/connect?return=${encodeURIComponent(`/canary/${kind}`)}`}>连接 Longbridge</a><FundCharterLink /></div></header><div className="research-content">
    <div className="research-hero"><div><span className="section-eyebrow">CANARY RESEARCH · V1.5</span><h1>{pages[kind].title}</h1><p>{pages[kind].subtitle}</p></div><button type="button" onClick={refresh} disabled={busy}>{busy ? "正在核对…" : "↻ 更新本页"}</button></div>
    <div className="research-controls"><div className="research-market" role="group" aria-label="选择市场"><button type="button" aria-pressed={market === "us"} onClick={() => chooseMarket("us")}>美股</button><button type="button" aria-pressed={market === "cn"} onClick={() => chooseMarket("cn")}>A 股</button></div><span>{snapshot ? `上次核对 ${snapshot.refreshedAt.slice(0, 10)}` : "尚无已核验的本页读数"}</span></div>
    {feedback && <p className="research-feedback" role="status">{feedback}</p>}
    {kind !== "sentiment" ? <><div className="research-objects">{items.map((item, index) => { const value = snapshot?.market === market ? snapshot.readings.find((r) => r.id === item.id) : null; return <button type="button" key={item.id} className={index === selected ? "selected" : ""} onClick={() => setSelected(index)}><small>{kind === "valuation" ? item.valuationDescriptor ?? item.descriptor : item.descriptor}</small><strong>{item.name}</strong><span>{value?.value === null || value?.value === undefined ? "—" : value.value.toFixed(2)} <small>{value?.unit ?? "待核验"}</small></span><em>{value?.status ?? "尚无已核验数据"}</em></button>; })}</div><div className="research-columns"><section className="research-panel"><h2>{current?.name} · {kind === "temperature" ? "温度与历史走势" : "同口径估值历史"}</h2><p>{reading?.summary ?? "更新后显示最近观测、历史走势及来源；无可靠数据时不生成结论。"}</p><Sparkline points={reading?.points ?? []} label={current?.name ?? "指标"} /><div className="research-source">{reading?.asOf ? `${reading.asOf.slice(0, 10)} · ${reading.source} · ${reading.sample ?? "—"} 项历史观测` : "数值、图形和解读将使用同一观测快照"}</div></section><section className="research-panel"><h2>当前解读与口径</h2><p>{reading?.explanation ?? "先核实数据来源、历史样本和计算定义，再展示当前判断。"}</p>{kind === "temperature" && reading?.factors && <div className="research-factors">{([ ["位置", reading.factors.position], ["参与拥挤", reading.factors.crowding], ["动能", reading.factors.momentum] ] as const).map(([label, value]) => <div key={label}><span>{label}</span><i><b style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></i><strong>{value.toFixed(1)}</strong></div>)}</div>}{kind === "valuation" && reading?.percentiles && <div className="research-percentiles">{([3, 5, 10] as const).map((year) => <div key={year}><span>近 {year} 年分位</span><strong>{reading.percentiles?.[year] == null ? "样本不足" : `${reading.percentiles?.[year]}%`}</strong></div>)}</div>}<dl><div><dt>{kind === "valuation" ? "估值对象" : "观察对象"}</dt><dd>{kind === "valuation" ? current?.valuationCode ?? current?.id : current?.id}</dd></div><div><dt>状态</dt><dd>{reading?.status ?? "待核验"}</dd></div><div><dt>数据日期</dt><dd>{reading?.asOf?.slice(0, 10) ?? "—"}</dd></div></dl></section></div></> : <SentimentView market={market} snapshot={snapshot} />
    }
    {kind !== "sentiment" && <DataGaps errors={snapshot?.errors ?? {}} />}
    <div className="research-section-title"><h2>进一步研究</h2><span>从读数、解释到数据边界</span></div><div className="research-guidance">{guidance[kind].map((item) => <details key={item.title}><summary>{item.title}<span>展开说明 ↗</span></summary><p>{item.body}</p></details>)}</div><p className="research-footer">不同来源的更新时间、样本范围与许可不同。未核验读数不参与判断；页面内容不构成交易建议。</p>
  </div></main></div>;
}
