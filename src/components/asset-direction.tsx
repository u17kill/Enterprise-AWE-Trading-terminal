"use client";
import { useEffect, useRef, useState } from 'react';
import { CanaryPageNav } from './canary-page-nav';
import { AppSidebar } from './app-sidebar';
import { FundCharterLink } from './fund-charter-link';
type Status={as_of:string;fetched_at:string;indicators:unknown[]};
export function AssetDirection(){
  const [score,setScore]=useState<Status|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[height,setHeight]=useState(900);
  const observer=useRef<ResizeObserver|null>(null);
  useEffect(()=>{let active=true;fetch('/api/asset-direction',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(!active)return;if(!data.ok)throw new Error(data.error);setScore(data.score);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;observer.current?.disconnect();};},[]);
  async function refresh(){setBusy(true);setError('');try{const response=await fetch('/api/asset-direction',{method:'POST'});const data=await response.json();if(!data.ok)throw new Error(data.error);setScore(data.score);setRevision(n=>n+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="app-shell"><AppSidebar currentPath="/canary/direction"/><main className="main-content ad-page"><header className="ad-header"><div><span className="section-eyebrow">CANARY / ASSET DIRECTION</span><h1>资产风向</h1><p>四层证据 · 十四类资产 · 中期 1–6 个月</p></div><div><FundCharterLink/><button onClick={refresh} disabled={busy}>{busy?'正在取数与计算…':'更新本页'}</button></div></header><CanaryPageNav currentPath="/canary/direction"/><p className="ad-meta">{score?`计算日 ${score.as_of} · 取数 ${score.fetched_at} · 指标 ${score.indicators.length} 项 · regime v0.4.0`:loading?'正在读取本机评分…':'首次使用，请点击“更新本页”获取公开数据并计算。'}</p>{error&&<div className="ad-error" role="alert">{error}。已有评分继续保留。</div>}{score?<iframe key={revision} title="资产风向：评分、贡献矩阵与证据明细" src={`/api/asset-direction/document?revision=${revision}`} sandbox="allow-same-origin" className="ad-document" style={{height}} onLoad={event=>{observer.current?.disconnect();const main=event.currentTarget.contentDocument?.querySelector('main');if(!main)return;const resize=()=>setHeight(Math.max(400,Math.ceil(main.getBoundingClientRect().height)+4));resize();observer.current=new ResizeObserver(resize);observer.current.observe(main);}}/>:!loading&&<div className="ad-empty"><h2>资产风向尚未生成</h2><p>更新后将展示风险偏好、资产贡献矩阵、政策利率、资产卡片、指标证据、确认层和人工政策判据。缺失数据会明确标注。</p></div>}</main></div>;
}
