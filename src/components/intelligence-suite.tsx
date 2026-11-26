"use client";

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AppSidebar } from './app-sidebar';
import { FundCharterLink } from './fund-charter-link';
import { IntelligencePageNav, INTELLIGENCE_PAGES } from './intelligence-page-nav';

type Snapshot = {ok?: boolean; error?: string; warnings?: string[]; origin?: string; imported?: boolean; news?: unknown; wind?: unknown; research?: unknown; calendar?: unknown; snapshot?: unknown};
const KINDS: Record<string,string> = {'/news':'news','/voices':'wind','/research':'research','/calendar':'calendar','/holdings':'holdings'};

export function IntelligenceSuite(){
 const path=usePathname();
 const page=INTELLIGENCE_PAGES.find(p=>p.path===path)||INTELLIGENCE_PAGES[0];
 const kind=KINDS[page.path];
 const [initialKind]=useState(kind);
 const [height,setHeight]=useState(1000),[revision,setRevision]=useState(0),[ready,setReady]=useState(false);
 const [errors,setErrors]=useState<Record<string,string>>({});
 const frame=useRef<HTMLIFrameElement>(null),observer=useRef<ResizeObserver|null>(null),current=useRef(kind);
 function send(selected:string,data?:Snapshot){
  const value=data?.[selected==='holdings'?'snapshot':selected as keyof Snapshot];
  frame.current?.contentWindow?.postMessage({type:'intelligence-data',kind:selected,data:value},location.origin);
 }
 useEffect(()=>{current.current=kind;send(kind);let active=true;
  fetch('/api/'+kind,{cache:'no-store'}).then(r=>r.json()).then((value:Snapshot)=>{if(!active)return;if(!value.ok)throw new Error(value.error||'读取失败');setErrors(old=>({...old,[kind]:''}));send(kind,value);}).catch((e:Error)=>{if(active)setErrors(old=>({...old,[kind]:e.message}));});
  return()=>{active=false;};
 },[kind]);
 useEffect(()=>()=>observer.current?.disconnect(),[]);
 return <div className="app-shell"><AppSidebar currentPath={page.path}/><main className="main-content intelligence-page">
  <header className="intelligence-header"><div><span className="section-eyebrow">AWE / MARKET INTELLIGENCE</span><h1>{page.name}</h1><p>追踪事件、判断与公开披露 · 五个独立数据口径</p></div><div className="intelligence-actions"><FundCharterLink/><a href="/api/intelligence/export" download="AWE-intelligence-snapshot.html">导出六页离线快照</a></div></header>
  <IntelligencePageNav currentPath={page.path}/>
  <div className="intelligence-provenance">导入参考项目快照；人工观点与研报未逐条核验原文。13F 以卡片申报期为准，更新后显示本次核对结果。数据日期、刷新进度及失败原因见各页状态条。</div>
  {!ready&&<div className="intelligence-loading" role="status">正在读取情报快照…</div>}
  {errors[kind]&&<div className="intelligence-error" role="alert">读取本机最新数据失败：{errors[kind]}。保留页面已有快照，可重新读取。</div>}
  <iframe ref={frame} title={page.name+'：来源、筛选与详细资料'} src={'/api/intelligence/'+initialKind+'/document?revision='+revision} sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" className="intelligence-frame" style={{height}} onLoad={event=>{setReady(true);observer.current?.disconnect();send(current.current);const main=event.currentTarget.contentDocument?.querySelector('main');if(!main)return;const resize=()=>setHeight(Math.max(450,Math.ceil(main.getBoundingClientRect().height)+12));resize();observer.current=new ResizeObserver(resize);observer.current.observe(main);}}/>
  <button className="intelligence-reload" onClick={()=>{setReady(false);setRevision(n=>n+1);}}>重新读取本机快照</button>
 </main></div>;
}
