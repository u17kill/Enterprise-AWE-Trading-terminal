"use client";
import { CanaryPageNav } from './canary-page-nav';
import { usePathname } from 'next/navigation';
import { useEffect,useRef,useState } from 'react';
import { AppSidebar } from './app-sidebar';
import { FundCharterLink } from './fund-charter-link';
import { TEMPERATURE_PAGES } from '../lib/temperature-pages';
type Snapshot={ok:boolean;data?:unknown;updated?:string|null;elapsed?:number;origin?:string;warnings?:string[];error?:string};
function snapshotDate(kind:string,data:unknown):string|undefined{
 if(!data||typeof data!=='object')return;
 const record=data as Record<string,unknown>;
 if(typeof record.date==='string')return record.date;
 const dates=Object.values(record).flatMap(value=>{if(!value||typeof value!=='object')return [];const item=value as {last?:{date?:string};pe_stats?:{end?:string}};return [kind==='momentum'?item.last?.date:item.pe_stats?.end].filter((v):v is string=>typeof v==='string');}).sort();
 return dates[0];
}
export function TemperatureSuite(){
 const path=usePathname();const page=TEMPERATURE_PAGES.find(p=>p.path===path)||TEMPERATURE_PAGES[0];
 const [initialKind]=useState(page.kind),[revision,setRevision]=useState(0),[height,setHeight]=useState(1000),[snapshots,setSnapshots]=useState<Record<string,Snapshot>>({}),[busy,setBusy]=useState<string[]>([]),[errors,setErrors]=useState<Record<string,string>>({});
 const frame=useRef<HTMLIFrameElement>(null),current=useRef<string>(page.kind);const observer=useRef<ResizeObserver|null>(null);
 const [checkedAt]=useState(()=>Date.now());
 const status=snapshots[page.kind];const isBusy=busy.includes(page.kind);const date=snapshotDate(page.kind,status?.data);
 const stale=date&&Number.isFinite(Date.parse(date))&&checkedAt-Date.parse(date)>4*86_400_000;
 function send(kind:string,data?:unknown){frame.current?.contentWindow?.postMessage({type:'temperature-data',kind,data},location.origin);}
 useEffect(()=>{current.current=page.kind;send(page.kind);let active=true;fetch(`/api/temperature/${page.kind}`,{cache:'no-store'}).then(r=>r.json()).then(data=>{if(!active)return;if(!data.ok)throw new Error(data.error);setSnapshots(old=>({...old,[page.kind]:data}));send(page.kind,data.data);}).catch(e=>{if(active)setErrors(old=>({...old,[page.kind]:e.message}));});return()=>{active=false;};},[page.kind]);
 useEffect(()=>()=>observer.current?.disconnect(),[]);
 async function refresh(){const kind=page.kind;setBusy(old=>[...old,kind]);setErrors(old=>({...old,[kind]:''}));try{const r=await fetch(`/api/temperature/${kind}`,{method:'POST'});const data=await r.json();if(!data.ok)throw new Error(data.error||'取数失败');setSnapshots(old=>({...old,[kind]:data}));if(current.current===kind)send(kind,data.data);}catch(e){setErrors(old=>({...old,[kind]:(e as Error).message}));}finally{setBusy(old=>old.filter(k=>k!==kind));}}
 return <div className="app-shell"><AppSidebar currentPath={page.path}/><main className="main-content temperature-page"><header className="temperature-header"><div><span className="section-eyebrow">CANARY / MARKET TEMPERATURE</span><h1>{page.name}</h1><p>历史位置与市场结构 · 描述统计，不作预测</p></div><div><FundCharterLink/><a href="/api/temperature/export" download="AWE-temperature-snapshot.html">导出六页快照</a><button disabled={isBusy} onClick={refresh}>{isBusy?'更新中…':`刷新${page.name}`}</button></div></header><CanaryPageNav currentPath={page.path} busy={busy}/><div className="temperature-status" aria-live="polite">{isBusy?'正在取数与计算，本页更新不阻塞其他页面…':status?.updated?`已更新 ${status.updated}${status.elapsed!=null?`（耗时 ${status.elapsed}s）`:''} · 已持久保存`:status?.origin||'正在读取本机最新快照…'}</div>{stale&&<div className="temperature-error">部分读数截至 {date}，快照可能较旧；请检查各区数据日期并按需更新。</div>}{errors[page.kind]&&<div className="temperature-error" role="alert">刷新失败：{errors[page.kind]}。原数据保留，可稍后重试。</div>}{status?.warnings?.map((note,i)=><div className="temperature-error" key={i}>{note}</div>)}<iframe ref={frame} title="温度研究：指标、图表与统计明细" src={`/api/temperature/${initialKind}/document?revision=${revision}`} sandbox="allow-scripts allow-same-origin" className="temperature-frame" style={{height}} onLoad={event=>{observer.current?.disconnect();send(current.current,snapshots[current.current]?.data);const main=event.currentTarget.contentDocument?.querySelector('main');if(!main)return;const resize=()=>setHeight(Math.max(400,Math.ceil(main.getBoundingClientRect().height)+8));resize();observer.current=new ResizeObserver(resize);observer.current.observe(main);}}/><button className="temperature-reload" onClick={()=>setRevision(n=>n+1)}>重新读取本机快照</button></main></div>;
}
