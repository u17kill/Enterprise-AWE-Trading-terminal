"use client";
import { useEffect, useRef, useState } from 'react';
import { AppSidebar } from './app-sidebar';
import { FundCharterLink } from './fund-charter-link';

type Asset = { kind: string; code: string; name: string; cls: string; price?: number; chg?: number; src?: string; hint?: string; spark?: { type: string; pts: (number | [string, number])[] } };
type Watch = { code: string; name: string; sector: string; market?: string; chg?: number };
type Holding = { symbol: string; name: string; region: string; group: string; status: string; chg?: number; reason?: string; code?: string };
type Config = { assets: Asset[]; watchlist: Watch[]; sectors: string[]; sector_note?: string };
type Brief = { headline?: string; as_of?: string; stale?: boolean; verdict?: string; tone?: string; mood?: string; lead?: string; points?: string[]; generated?: string };
type Market = { date: string; updated: string; elapsed: number; provider_note?: string; assets: Asset[]; brief?: Brief; bond_fail?: string[]; watchlist?: { rows?: Watch[] }; holdings?: { items?: Holding[]; watching?: Holding[]; missing?: Holding[]; fail?: Holding[]; regions?: { id: string; name: string }[]; groups?: { id: string; name: string }[]; hold_dirty?: boolean; note?: string; auto?: number; manual?: number } };
const keys = ['上证指数','沪深300','恒生指数','标普500','纳斯达克100','日经225','韩国 KOSPI','台湾加权','印度 SENSEX','COMEX 黄金','WTI 原油','美元指数','比特币'];
const categories = ['全部','股指','商品','外汇','利率','加密'];
const sign = (v?: number, unit = '%') => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(unit === 'bp' ? 1 : 2)}${unit}`;
const color = (v?: number) => v == null || v === 0 ? 'mo-flat' : v > 0 ? 'mo-up' : 'mo-down';
const marketOf = (code: string) => /^(sh|sz|bj)/.test(code) ? 'A股' : code.startsWith('hk') ? '港股' : code.startsWith('us') ? '美股' : '其他';
function Text({ value }: { value?: string }) {
  return <>{(value || '').split(/(<span\s+class=["'](?:u|d)["']>[^<]*<\/span>)/g).map((part,i) => {
    const match = /^<span\s+class=["'](u|d)["']>([^<]*)<\/span>$/.exec(part);
    return match ? <span key={i} className={match[1] === 'u' ? 'mo-up' : 'mo-down'}>{match[2]}</span> : part.replace(/<[^>]*>/g,'');
  })}</>;
}
function StockSearch({ onAdd, disabled }: { onAdd: (item: Watch) => void; disabled: boolean }) {
  const [query,setQuery] = useState(''), [items,setItems] = useState<Asset[]>([]), [note,setNote] = useState('');
  useEffect(() => {
    if(!query.trim()) return;
    let active=true;
    const timer=setTimeout(()=>api(`/search?kind=stock&q=${encodeURIComponent(query)}`).then(data=>{if(active){setItems(data.items);setNote(data.items.length?'':'没有找到匹配的标的，可使用批量导入');}}).catch(()=>{if(active)setNote('搜索暂不可用，可使用批量导入');}),380);
    return ()=>{active=false;clearTimeout(timer);};
  },[query]);
  return <div className="mo-search"><input aria-label="搜索添加自选股" placeholder="搜索股票名称或代码…" value={query} onChange={e=>{setQuery(e.target.value);setItems([]);setNote('');}}/>{query && <div className="mo-results">{items.map(item=><button key={item.code} disabled={disabled} onClick={()=>{onAdd({code:item.code,name:item.name,sector:'未分类'});setQuery('');setItems([]);}}>{item.name}<small>{item.code}</small></button>)}{note && <p>{note}</p>}</div>}</div>;
}
function Spark({ asset }: { asset: Asset }) {
  const values = (asset.spark?.pts || []).map(p => Array.isArray(p) ? p[1] : p).filter(Number.isFinite);
  if (values.length < 2) return <div className="mo-spark-empty">走势尚未取到</div>;
  const min = Math.min(...values), range = Math.max(...values) - min || 1;
  const pts = values.map((v,i) => `${i / (values.length - 1) * 150},${25 - (v-min)/range*23}`).join(' ');
  return <svg className={color(asset.chg)} viewBox="0 0 150 26" preserveAspectRatio="none" role="img" aria-label={`${asset.name} ${asset.spark?.type === 'daily' ? '近期日线' : '分时'}走势`}><polygon points={`0,26 ${pts} 150,26`} fill="currentColor" opacity=".08"/><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/></svg>;
}
async function api(path: string, body?: unknown) {
  const response = await fetch(`/api/market${path}`, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await response.json();
  if (!value.ok) throw new Error(value.error || '请求失败');
  return value;
}
export function MarketOverview() {
  const [market, setMarket] = useState<Market | null>(null), [config,setConfig] = useState<Config | null>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [loading,setLoading] = useState(true);
  const [query,setQuery] = useState(''), [matches,setMatches] = useState<Asset[]>([]), [category,setCategory] = useState('全部');
  const [view,setView] = useState('hold'), [panel,setPanel] = useState(''), [batch,setBatch] = useState('');
  const drag = useRef<{ kind: string; code: string; market?: string } | null>(null);
  async function load() { const [data,cfg] = await Promise.all([api(''),api('/config')]); setMarket(data.market); setConfig(cfg.config); }
  useEffect(() => { const timer = setTimeout(() => { void load().catch(e => setError(e.message)).finally(() => setLoading(false)); try { setView(localStorage.getItem('mm_view_v2') === 'wl' ? 'wl' : 'hold'); } catch {} },0); return () => clearTimeout(timer); }, []);
  useEffect(() => {
    if (!query.trim()) return;
    let active = true;
    const timer = setTimeout(() => api(`/search?kind=asset&q=${encodeURIComponent(query)}`).then(data => { if(active) setMatches(data.items); }).catch(e => { if(active) setError(e.message); }),380);
    return () => { active = false; clearTimeout(timer); };
  },[query]);
  async function refresh() { setBusy(true); setError(''); try { const data = await api('/refresh',{}); setMarket(data.market); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function save(next: Config, fetchNew = false) {
    setError(''); setBusy(true);
    try { const data = await api('/config',next); setConfig(data.config); if(fetchNew) { const updated = await api('/refresh',{}); setMarket(updated.market); } else { const data = await api(''); setMarket(data.market); } }
    catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function addAsset(asset: Asset) { try { const data = await api('/config'); if(data.config.assets.some((a: Asset) => a.code === asset.code)) return; setQuery(''); setMatches([]); const cls = asset.cls || ({eq:'股指',gi:'股指',fu:'商品',fx:'外汇',bd:'利率',cr:'加密'}[asset.kind] || '股指'); await save({...data.config, assets:[...data.config.assets,{...asset,cls}]},true); } catch(e) { setError((e as Error).message); } }
  const assets = (market?.assets || []).filter(a => (category === '全部' || a.cls === category) && (!query || `${a.name} ${a.code}`.toLowerCase().includes(query.toLowerCase())));
  function reorderAsset(target?: string, after = false) {
    const moving = drag.current; drag.current = null;
    if(!config || moving?.kind !== 'asset' || target === moving.code) return;
    const visible = assets.map(a => a.code), order = visible.filter(c => c !== moving.code);
    const at = target ? order.indexOf(target) + (after ? 1 : 0) : order.length;
    order.splice(Math.max(0,at),0,moving.code);
    let i = 0; const byCode = new Map(config.assets.map(a => [a.code,a]));
    const next = config.assets.map(a => visible.includes(a.code) ? byCode.get(order[i++])! : a);
    setConfig({...config, assets:next});
    if(market) setMarket({...market,assets:next.map(a => market.assets.find(c => c.code === a.code) || a)});
    void save({...config,assets:next});
  }
  async function importBatch() {
    if(!config) return;
    const codes = [...new Set(batch.split(/[\s,，;；]+/).map(s => {
      if(/^(sh|sz|bj)\d{6}$/i.test(s) || /^hk\d{5}$/i.test(s)) return s.toLowerCase();
      if(/^\d{6}$/.test(s)) return (s[0] === '6' ? 'sh' : /[03]/.test(s[0]) ? 'sz' : 'bj') + s;
      if(/^\d{5}$/.test(s)) return 'hk'+s;
      if(/^us[A-Za-z.\-]+$/.test(s)) return 'us'+s.slice(2).toUpperCase();
      if(/^[A-Za-z]{1,6}$/.test(s)) return 'us'+s.toUpperCase();
      return '';
    }).filter(Boolean))];
    const fresh = codes.filter(code => !config.watchlist.some(w => w.code === code));
    if(!fresh.length) { setError(codes.length ? '这些代码已经都在自选里了' : '未识别出代码，请用空格或逗号分隔'); return; }
    setPanel(''); setBatch(''); await save({...config,watchlist:[...config.watchlist,...fresh.map(code => ({code,name:'',sector:'未分类'}))]},true);
  }
  const hold = market?.holdings, rows = market?.watchlist?.rows || [];
  const sectors = (config?.sectors || []).filter(s => rows.some(r => r.sector === s));
  const regions = hold?.regions || [], groups = hold?.groups || [];
  const allHold = [...(hold?.items || []),...(hold?.missing || []).filter(r => r.status !== 'watch'),...(hold?.fail || []).filter(r => r.status !== 'watch')];
  function dropWatch(m: string, sector: string, target?: string) {
    const moving = drag.current; drag.current = null;
    if(!config || moving?.kind !== 'watch' || moving.market !== m) return;
    const item = config.watchlist.find(w => w.code === moving.code); if(!item) return;
    const list = config.watchlist.filter(w => w.code !== moving.code);
    let index = target ? list.findIndex(w => w.code === target) : -1;
    if(index < 0) { const last = list.findLastIndex(w => marketOf(w.code) === m && w.sector === sector); index = last >= 0 ? last+1 : list.length; }
    list.splice(index,0,{...item,sector}); void save({...config,watchlist:list});
  }
  return <div className="app-shell"><AppSidebar currentPath="/"/><main className="main-content mo-page"><header className="mo-header"><div><span className="section-eyebrow">MARKET OVERVIEW</span><h1>市场总览</h1><p>今天发生了什么 · 全市场读数与持仓表现</p></div><div><FundCharterLink/><a href="/api/longbridge/connect?return=/">连接 Longbridge</a><button disabled={busy} onClick={refresh}>{busy ? '行情更新中…' : '刷新行情'}</button></div></header>
    <p className="mo-meta">{market ? `数据截至 ${market.date} · 刷新于 ${market.updated}（${market.elapsed} 秒）` : loading ? '正在读取本机行情缓存…' : '尚未抓取行情，点击“刷新行情”获取读数'}{market?.brief?.stale && market.brief.as_of && ` · 判断停留在 ${market.brief.as_of}`}</p>
    {error && <div className="mo-warning" role="alert">{error}。已显示的行情保留，可稍后重试。</div>}
    <p className="mo-meta">{market?.provider_note || "长桥优先，未连接或未覆盖时使用公开来源。"}</p><section className="mo-section"><h2>今日市场</h2><div className="mo-today"><div className="mo-brief">{market?.brief?.headline ? <><span className={`mo-verdict ${market.brief.tone === 'risk' ? 'mo-down' : market.brief.tone === 'calm' ? 'mo-up' : ''}`}>{market.brief.verdict || '今日观察'}</span><small>风险偏好 · {market.brief.mood || '未标注'}</small><h3><Text value={market.brief.headline}/></h3><p><Text value={market.brief.lead}/></p><ol>{market.brief.points?.map((p,i) => <li key={i}><span>{String(i+1).padStart(2,'0')}</span><Text value={p}/></li>)}</ol><p className={market.brief.stale ? 'mo-warning' : 'mo-meta'}>{market.brief.stale ? `判断基于 ${market.brief.as_of} 收盘，行情已到 ${market.date}，这一交易日的判断尚未撰写` : `数据截至 ${market.brief.as_of} 收盘`}</p><small>判断生成 {market.brief.generated || '未标注'} · 不构成投资建议</small></> : <><span className="section-eyebrow">TODAY’S PERSPECTIVE</span><h3>今日判断尚未生成</h3><p>将收盘判断写入本机数据目录的 market/brief.json，再点“重读判断”。下方行情读数可独立更新。</p></>}<button className="mo-text-button" disabled={busy} onClick={async () => {try { const data = await api('/brief'); if(market) setMarket({...market,brief:data.brief}); } catch(e) {setError((e as Error).message);} }}>重读判断</button></div><div className="mo-key"><h3>关键读数</h3>{keys.map(name => market?.assets.find(a => a.name === name)).filter((a): a is Asset => Boolean(a)).map(a => <div key={a.code}><span>{a.name}</span><b>{a.price?.toLocaleString('en-US',{maximumFractionDigits:(a.price || 0) >= 1000 ? 0 : 2}) ?? '—'}</b><small className={color(a.chg)}>{sign(a.chg)}</small></div>)}{!market?.assets.length && <p>暂无资产数据，刷新行情后显示。</p>}</div></div></section>
    <section className="mo-section"><div className="mo-section-title"><div><h2>指数与大类资产</h2><p>搜索添加 · 拖动卡片换位置 · 清单保存在本机</p></div></div><div className="mo-tools"><div className="mo-search"><input aria-label="搜索添加资产" value={query} onChange={e => {setQuery(e.target.value);setMatches([]);}} placeholder="搜索名称、代码或别名…"/>{matches.length > 0 && <div className="mo-results">{matches.map(a => <button key={a.code} disabled={busy || config?.assets.some(c => c.code === a.code)} onClick={() => void addAsset(a)}><b>{a.name}</b><span>{a.code}</span><small>{a.hint}</small></button>)}</div>}</div><div className="mo-tabs">{categories.map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c} <small>{(market?.assets || config?.assets || []).filter(a => c === '全部' || a.cls === c).length}</small></button>)}</div></div>
    <div className="mo-assets" onDragOver={e => e.preventDefault()} onDrop={() => reorderAsset()}>{assets.map(a => <article key={a.code} draggable={!busy} onDragStart={() => {drag.current={kind:'asset',code:a.code};}} onDragOver={e => e.preventDefault()} onDrop={e => {e.stopPropagation(); reorderAsset(a.code,e.clientX > e.currentTarget.getBoundingClientRect().left + e.currentTarget.clientWidth/2);}}><button className="mo-remove" aria-label={`删除${a.name}`} disabled={busy} onClick={() => {if(config && confirm(`从资产清单中移除「${a.name}」？`)) void save({...config,assets:config.assets.filter(c => c.code !== a.code)},true);}}>×</button><h3>{a.name}</h3><small>{a.code}</small><strong>{a.price?.toLocaleString('en-US',{minimumFractionDigits:a.kind === 'bd' ? 3 : a.kind === 'fx' && a.price < 20 ? 4 : 2,maximumFractionDigits:a.kind === 'bd' ? 3 : a.kind === 'fx' && a.price < 20 ? 4 : 2}) ?? '—'}{a.kind === 'bd' && ' %'}</strong><div className="mo-card-meta"><b className={color(a.chg)}>{sign(a.chg,a.kind === 'bd' ? 'bp' : '%')}</b><small>{a.src || '腾讯'}</small></div><Spark asset={a}/></article>)}</div>{!assets.length && <p className="mo-empty">{market ? '没有匹配的资产，试试其他名称或品种筛选。' : '尚无行情缓存，点击“刷新行情”加载资产。'}</p>}{Boolean(market?.bond_fail?.length) && <p className="mo-warning">收益率取数提示：{market?.bond_fail?.join('；')}</p>}<p className="mo-meta">股票为交易时段分时；期货／外汇约 23 小时；加密为 24 小时；20D 为近期交易日收盘。各口径不可横比波动幅度。ETF／期货代理以卡片角标为准，债券变化单位为 bp。</p></section>
    <section className="mo-section"><div className="mo-section-title"><div><h2>自选股</h2><p>关注清单与真实持仓，分别维护</p></div><div className="mo-tabs">{[['wl','市场 × 板块'],['hold','地区 × 风格']].map(([id,label]) => <button key={id} aria-pressed={view===id} onClick={() => {setView(id);try{localStorage.setItem('mm_view_v2',id);}catch{}}}>{label}</button>)}</div></div>
    {view === 'hold' ? <>{hold?.hold_dirty && <p className="mo-warning">持仓本子刚改过，点“刷新行情”把新标的的行情并进来。</p>}<p className="mo-meta">卫星仓只读镜像 · 如需修改，请前往持仓地图。期权不计入本表。</p><div className="mo-table-scroll"><table className="mo-matrix"><thead><tr><th>地区 / 风格</th>{groups.map(g => <th key={g.id}>{g.name}</th>)}</tr></thead><tbody>{regions.map(r => <tr key={r.id}><th>{r.name}</th>{groups.map(g => <td key={g.id}>{allHold.filter(i => i.region===r.id && i.group===g.id).map((i,k) => <span key={k} title={i.reason || i.code} className={`mo-chip ${i.reason ? 'mo-unavailable' : color(i.chg)}`}>{i.name || i.symbol}<small>{i.reason ? (hold?.missing?.includes(i) ? '未接入' : '未取到') : sign(i.chg)}</small></span>)}</td>)}</tr>)}</tbody></table></div>{!allHold.length && <p className="mo-empty">{hold?.note || '还没有持仓行情。确认持仓地图已保存，再点击“刷新行情”。'}</p>}<div className="mo-watching">观察区：{[...(hold?.watching || []),...(hold?.missing || []).filter(i=>i.status==='watch'),...(hold?.fail || []).filter(i=>i.status==='watch')].map((i,k)=><span className="mo-chip" key={k} title={i.reason}>{i.name || i.symbol} <small>{i.reason ? '未接入／未取到' : sign(i.chg)}</small></span>)}</div><p className="mo-meta">腾讯与雅虎双通道，时间戳不完全一致，不混算总涨跌。未接入 {hold?.missing?.length || 0} 只 · 未取到 {hold?.fail?.length || 0} 只 · 自动匹配 {hold?.auto || 0} 只 / 人工登记 {hold?.manual || 0} 只。</p></> : <><div className="mo-tools"><StockSearch disabled={busy} onAdd={item=>{if(config && !config.watchlist.some(w=>w.code===item.code))void save({...config,watchlist:[...config.watchlist,item]},true);}}/><button onClick={() => setPanel(panel==='import'?'':'import')}>批量导入</button><button onClick={() => setPanel(panel==='classify'?'':'classify')}>板块归类</button></div>{panel==='import' && <div className="mo-editor"><label>输入股票代码，使用空格或逗号分隔<textarea value={batch} onChange={e=>setBatch(e.target.value)} placeholder="NVDA, 00700, 600519"/></label><button disabled={busy} onClick={importBatch}>导入</button><button onClick={()=>setPanel('')}>取消</button></div>}{panel==='classify' && <div className="mo-editor">{config?.watchlist.map(w=><label key={w.code}>{w.name || w.code}<small>{w.code} · {marketOf(w.code)}</small><select value={w.sector} disabled={busy} onChange={e=>{setPanel('');void save({...config,watchlist:config.watchlist.map(x=>x.code===w.code?{...x,sector:e.target.value}:x)},true);}}>{config.sectors.map(s=><option key={s}>{s}</option>)}</select></label>)}</div>}<div className="mo-table-scroll"><table className="mo-matrix"><thead><tr><th>市场 / 板块</th>{sectors.map(s=><th key={s} draggable onDragStart={()=>{drag.current={kind:'sector',code:s};}} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(config && drag.current?.kind==='sector'){const list=config.sectors.filter(x=>x!==drag.current!.code);list.splice(list.indexOf(s),0,drag.current.code);void save({...config,sectors:list});drag.current=null;}}}>{s}</th>)}</tr></thead><tbody>{[...new Set(rows.map(r=>r.market || marketOf(r.code)))].sort().map(m=><tr key={m}><th>{m}<small>{rows.filter(r=>(r.market || marketOf(r.code))===m).length} 只</small></th>{sectors.map(s=><td key={s} onDragOver={e=>{if(drag.current?.market===m)e.preventDefault();else e.dataTransfer.dropEffect='none';}} onDrop={()=>dropWatch(m,s)}>{rows.filter(r=>(r.market || marketOf(r.code))===m && r.sector===s).map(w=><span draggable={!busy} key={w.code} className={`mo-chip ${color(w.chg)}`} onDragStart={()=>{drag.current={kind:'watch',code:w.code,market:m};}} onDrop={e=>{e.stopPropagation();dropWatch(m,s,w.code);}}>{w.name || w.code}<small>{sign(w.chg)}</small></span>)}</td>)}</tr>)}</tbody></table></div>{!rows.length && <p className="mo-empty">这里还没有手动添加的标的，使用“批量导入”添加代码并刷新行情。</p>}<p className="mo-meta">{rows.length} 只中 {rows.filter(w=>(w.chg||0)>0).length} 涨 / {rows.filter(w=>(w.chg||0)<0).length} 跌 / {rows.filter(w=>w.chg===0).length} 平 · 行业归类由本终端维护，非交易所官方口径。</p></>}
    </section></main></div>;
}
