"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Hydration and save status mirror durable browser drafts. */
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {AppSidebar} from './app-sidebar';
import {FundCharterLink} from './fund-charter-link';
import {charterTitle,validateCharter,type CharterDocument,type CharterSnapshot,type EditablePrinciple} from '../lib/fund-charter-document';
import '../app/fund-charter-editor.css';

type Form={kind:'meta'|'final'|'pillar'|'principle';id?:string;fields:Record<string,string>;original:Record<string,string>};
type Draft={document:CharterDocument;revision:string;updatedAt:string;form?:Form|null};
type StoredDraft=Draft&{key:string};
const PREFIX='awe.fund-charter.draft.v1.';
const uid=()=>crypto.randomUUID();
const paragraphs=(s:string)=>s.split(/\r?\n[ \t]*\r?\n/).map(x=>x.trim()).filter(Boolean);
const bullets=(s:string)=>s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
function validForm(v:unknown):v is Form{
 if(!v||typeof v!=='object')return false;
 const f=v as Form;
 const keys={meta:['title','subtitle','manifesto'],final:['title','text'],pillar:['name','english'],principle:['pillar','title','paragraphs','bullets','after','conclusion']}[f.kind];
 return Boolean(keys)&&(!f.id||typeof f.id==='string')&&Boolean(f.fields&&f.original)&&[f.fields,f.original].every(o=>typeof o==='object'&&!Array.isArray(o)&&Object.values(o).every(x=>typeof x==='string'&&x.length<=50000)&&keys.every(k=>typeof o[k]==='string'));
}
function drafts():StoredDraft[]{
 const found:StoredDraft[]=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(!key?.startsWith(PREFIX))continue;
  try{const d=JSON.parse(localStorage.getItem(key)||'');if(!validateCharter(d.document).length&&typeof d.revision==='string'&&typeof d.updatedAt==='string'&&(!d.form||validForm(d.form)))found.push({...d,key});}catch{/* Invalid drafts stay intact for manual recovery. */}
 }
 return found.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function FormField({label,value,onChange,multiline=false,hint}:{label:string;value:string;onChange:(v:string)=>void;multiline?:boolean;hint?:string}){
 return <label className="charter-field"><span>{label}</span>{multiline?<textarea value={value} onChange={e=>onChange(e.target.value)} rows={5}/>:<input value={value} onChange={e=>onChange(e.target.value)}/>} {hint&&<small>{hint}</small>}</label>;
}

export function FundCharterEditor({initial}:{initial:CharterSnapshot}){
 const [doc,setDoc]=useState(initial.document),[base,setBase]=useState(initial),[revision,setRevision]=useState(initial.revision);
 const [editing,setEditing]=useState(false),[form,setForm]=useState<Form|null>(null),[formError,setFormError]=useState('');
 const [error,setError]=useState(initial.error||''),[message,setMessage]=useState(''),[draftError,setDraftError]=useState('');
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[conflict,setConflict]=useState<CharterSnapshot|null>(null),[choices,setChoices]=useState<StoredDraft[]>([]);
 const ownKey=useRef(''),dialog=useRef<HTMLElement>(null);
 const dirty=Boolean(doc&&(JSON.stringify(doc)!==JSON.stringify(base.document)||revision!==base.revision));
 const unsaved=dirty||Boolean(form);
 const count=doc?.pillars.reduce((n,p)=>n+p.principles.length,0)||0;
 const formKind=form?.kind,formId=form?.id;
 useEffect(()=>{
  ownKey.current=PREFIX+uid();
  try{
   const pageKey=sessionStorage.getItem('awe.fund-charter.page.v1');sessionStorage.setItem('awe.fund-charter.page.v1',ownKey.current);
   const all=drafts().filter(d=>d.form||JSON.stringify(d.document)!==JSON.stringify(initial.document));setChoices(all);
   const d=all.find(d=>d.key===pageKey);
   if(d){setDoc(d.document);setRevision(d.revision);setForm(d.form||null);setEditing(true);setMessage('已恢复本页草稿，尚未写入源文件');if(d.revision!==initial.revision)setConflict(initial);}
   else if(all.length)setMessage('发现其他页面留下的草稿，可在“本机草稿与恢复”中选择查看');
  }catch{setDraftError('无法读取浏览器草稿；本机文件仍保留');}
  setReady(true);
 },[initial]);
 useEffect(()=>{
  if(!ready||!doc)return;
  try{
   if(unsaved)localStorage.setItem(ownKey.current,JSON.stringify({document:doc,revision,form,updatedAt:new Date().toISOString()} satisfies Draft));
   else localStorage.removeItem(ownKey.current);
   setDraftError('');
  }catch{setDraftError('浏览器草稿未保存，改动只在当前页。请保存到本机文件或导出草稿');}
 },[doc,revision,form,ready,unsaved]);
 useEffect(()=>{
  if(!unsaved)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
 },[unsaved]);
 useEffect(()=>{
  if(!unsaved||!draftError)return;
  const guard=(e:MouseEvent)=>{const link=(e.target as Element)?.closest?.('a[href]');if(link&&!link.getAttribute('href')?.startsWith('#')&&!confirm('浏览器草稿未保存。离开前请保存或导出，仍要离开？')){e.preventDefault();e.stopPropagation();}};
  document.addEventListener('click',guard,true);return()=>document.removeEventListener('click',guard,true);
 },[unsaved,draftError]);
 useEffect(()=>{
  if(!formKind)return;const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus();return()=>previous?.focus();
 },[formKind,formId]);
 function change(next:CharterDocument){setDoc(next);setError('');setMessage('修改已应用到页面，请保存全部修改');}
 function open(kind:Form['kind'],fields:Record<string,string>,id?:string){setForm({kind,id,fields,original:{...fields}});setFormError('');}
 function closeForm(){if(form&&JSON.stringify(form.fields)!==JSON.stringify(form.original)&&!confirm('取消尚未应用的表单修改？'))return;setForm(null);setFormError('');}
 function applyForm(){
  if(!doc||!form)return;const f=form.fields;let next=structuredClone(doc);
  if(form.kind==='meta')next={...next,title:f.title,subtitle:f.subtitle,manifesto:f.manifesto};
  if(form.kind==='final')next={...next,finalTitle:f.title,finalParagraphs:paragraphs(f.text)};
  if(form.kind==='pillar'){
   const existing=next.pillars.find(p=>p.id===form.id);
   const pillar={id:existing?.id||'pillar-'+uid(),name:f.name,english:f.english,principles:existing?.principles||[]};
   next.pillars=existing?next.pillars.map(p=>p.id===existing.id?pillar:p):[...next.pillars,pillar];
  }
  if(form.kind==='principle'){
   if(!next.pillars.some(p=>p.id===f.pillar)){setFormError('请先选择所属支柱');return;}
   const item:EditablePrinciple={id:form.id||'principle-'+uid(),title:f.title,paragraphs:paragraphs(f.paragraphs),bullets:bullets(f.bullets),afterBullets:f.after,conclusion:f.conclusion};
   const oldPillar=next.pillars.find(p=>p.principles.some(i=>i.id===form.id));
   next.pillars=next.pillars.map(p=>({...p,principles:p.id===f.pillar?(oldPillar?.id===p.id?p.principles.map(i=>i.id===item.id?item:i):[...p.principles,item]):p.principles.filter(i=>i.id!==item.id)}));
  }
  const issues=validateCharter(next);if(issues.length){setFormError(issues.slice(0,3).join('；'));return;}change(next);setForm(null);
 }
 function editPrinciple(pillar:string,item?:EditablePrinciple){open('principle',{pillar,title:item?.title||'',paragraphs:item?.paragraphs.join('\n\n')||'',bullets:item?.bullets?.join('\n')||'',after:item?.afterBullets||'',conclusion:item?.conclusion||''},item?.id);}
 function movePillar(index:number,delta:number){if(!doc)return;const next=structuredClone(doc);[next.pillars[index],next.pillars[index+delta]]=[next.pillars[index+delta],next.pillars[index]];change(next);}
 function movePrinciple(pillar:string,index:number,delta:number){if(!doc)return;const next=structuredClone(doc),items=next.pillars.find(p=>p.id===pillar)!.principles;[items[index],items[index+delta]]=[items[index+delta],items[index]];change(next);}
 async function fresh(){const response=await fetch('/api/fund-charter',{cache:'no-store'});const result=await response.json() as CharterSnapshot;if(!response.ok||!result.ok||!result.document)throw new Error(result.error||'无法读取本机文件');return result;}
 async function save(usingRevision=revision){
  if(!doc||busy)return;const issues=validateCharter(doc);if(issues.length){setError(issues.slice(0,3).join('；'));return;}setBusy(true);setError('');
  try{
   const response=await fetch('/api/fund-charter',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({document:doc,revision:usingRevision})});
   const result=await response.json() as CharterSnapshot;
   if(response.status===409){setConflict(await fresh());throw new Error('本机文件已被其他页面修改，草稿保留，请选择使用哪一份');}
   if(!response.ok||!result.ok||!result.document)throw new Error(result.error||'保存失败');
   setBase(result);setRevision(result.revision);setDoc(result.document);setConflict(null);setMessage('已保存到本机文件'+(result.backup?'，旧版本已备份':''));
   try{localStorage.removeItem(ownKey.current);setChoices(drafts().filter(d=>d.form||JSON.stringify(d.document)!==JSON.stringify(result.document)));}catch{setDraftError('文件已保存，但旧浏览器草稿未能清理');}
  }catch(e){setError((e as Error).message+'。当前草稿保留，可重试或导出。');}finally{setBusy(false);}
 }
 function backupCurrent(){if(!doc)return;localStorage.setItem(PREFIX+uid(),JSON.stringify({document:doc,revision,form,updatedAt:new Date().toISOString()} satisfies Draft));}
 function loadFile(result:CharterSnapshot){
  try{if(unsaved)backupCurrent();}catch{setError('无法备份当前草稿，已保留两份内容；请先导出草稿');return;}
  setBase(result);setDoc(result.document);setRevision(result.revision);setConflict(null);setForm(null);setError('');setMessage('已读取本机文件，原草稿保留在本机草稿列表');
 }
 async function reload(){setBusy(true);try{const result=await fresh();if(unsaved){if(result.revision!==revision)setConflict(result);else setMessage('文件版本未变化，当前未保存的修改继续保留');}else loadFile(result);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function restore(d:StoredDraft){try{if(unsaved)backupCurrent();}catch{setError('无法备份当前编辑，请先导出再切换草稿');return;}setDoc(d.document);setRevision(d.revision);setForm(d.form||null);setEditing(true);setConflict(d.revision===base.revision?null:base);setMessage('已恢复本机草稿，尚未写入源文件');}
 async function importFile(file?:File){
  if(!file)return;try{if(file.size>1_000_000)throw new Error('备份文件不能超过1MB');const raw=JSON.parse(await file.text()),value=raw.document||raw;const issues=validateCharter(value);if(issues.length)throw new Error(issues.slice(0,3).join('；'));if(!confirm('将备份载入为待保存草稿？当前编辑会先保留，本机文件不会立即被覆盖。'))return;if(unsaved)backupCurrent();setDoc(value);setForm(validForm(raw.form)?raw.form:null);setEditing(true);setMessage('备份已载入为草稿，请检查后保存全部修改');}catch(e){setError((e as Error).message);}
 }
 const formField=(key:string,label:string,multiline=false,hint?:string)=><FormField label={label} value={form?.fields[key]||''} onChange={v=>setForm(f=>f?{...f,fields:{...f.fields,[key]:v}}:f)} multiline={multiline} hint={hint}/>;
 let number=0;
 const controls=(children:ReactNode)=><div className="charter-edit-actions">{children}</div>;
 return <div className="app-shell charter-shell"><AppSidebar currentPath="/charter"/><main className="main-content">
  <header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>基金宪法</strong></div><FundCharterLink current/></header>
  <div className="charter-content"><div className="charter-hero"><span className="section-eyebrow">ENTERPRISE / AWE · CORE INVESTMENT PRINCIPLES</span><h1>{doc?charterTitle(doc):'基金宪法'}</h1>{doc&&<p>{doc.subtitle}</p>}</div>
   <div className="charter-toolbar"><div>{doc&&<span>{doc.pillars.length} 个支柱 · {count} 条信条</span>}<span role="status">{busy?'正在处理…':unsaved?draftError?'仅当前页，尚未写入文件':'有未保存修改 · 本机草稿已保留':base.updatedAt?'本机文件 · '+new Date(base.updatedAt).toLocaleString('zh-CN'):'初始文稿 · 尚未写入本机文件'}</span></div><div>
    <button disabled={!doc||busy} onClick={()=>setEditing(v=>!v)}>{editing?'预览':'编辑基金宪法'}</button>
    {(editing||dirty)&&<button className="charter-save" disabled={!doc||busy||Boolean(conflict)||!base.ok} onClick={()=>void save()}>保存全部修改</button>}
    <button disabled={busy} onClick={()=>void reload()}>重新读取文件</button>
    <button disabled={!doc} onClick={()=>download(form?{document:doc,revision,form}:doc,'AWE-fund-charter.json')}>导出备份</button>
    <label className="charter-import">导入备份<input type="file" accept=".json" disabled={busy||!doc} onChange={e=>{void importFile(e.target.files?.[0]);e.target.value='';}}/></label>
   </div></div>
   {error&&<p className="charter-editor-warning" role="alert">{error}</p>}{draftError&&<p className="charter-editor-warning" role="alert">{draftError}</p>}{message&&<p className="charter-editor-message">{message}</p>}
   {conflict&&<div className="charter-editor-warning" role="alert"><strong>文件与本机草稿的版本不同，两份内容均保留。</strong><p>可导出草稿后选择；覆盖文件前会自动备份原文件。</p><button disabled={busy||!conflict.ok} onClick={()=>void fresh().then(s=>save(s.revision)).catch(e=>setError(e.message))}>用本机草稿覆盖文件</button><button disabled={busy||!conflict.ok} onClick={()=>void fresh().then(loadFile).catch(e=>setError(e.message))}>使用文件内容</button></div>}
   <details className="charter-local-drafts"><summary>本机草稿与恢复</summary><p>草稿按编辑页面分别保留，不会替代本机文件。只有“保存全部修改”成功才会更新源文件。</p><button onClick={()=>{try{setChoices(drafts().filter(d=>d.key!==ownKey.current));}catch{setError('无法读取本机草稿');}}}>刷新草稿列表</button>{choices.map(d=><div key={d.key}>{new Date(d.updatedAt).toLocaleString('zh-CN')} · {charterTitle(d.document)} <button disabled={busy} onClick={()=>restore(d)}>恢复此草稿</button></div>)}</details>
   {doc&&<>
    {editing&&controls(<><button disabled={busy} onClick={()=>open('meta',{title:doc.title,subtitle:doc.subtitle,manifesto:doc.manifesto})}>编辑标题与总纲</button><button disabled={busy} onClick={()=>open('final',{title:doc.finalTitle,text:doc.finalParagraphs.join('\n\n')})}>编辑最终准则</button><button disabled={busy} onClick={()=>open('pillar',{name:'',english:''})}>新增支柱</button><button disabled={busy||!doc.pillars.length} onClick={()=>editPrinciple(doc.pillars[0].id)}>新增信条</button></>)}
    {doc.manifesto&&<div className="charter-manifesto">{doc.manifesto}</div>}
    {!doc.pillars.length&&<p className="charter-editor-message">还没有支柱。进入编辑模式，添加第一个支柱和信条。</p>}
    <div className="charter-layout"><nav className="charter-toc" aria-label="基金宪法目录"><strong>{doc.pillars.length} 大支柱</strong>{doc.pillars.map((p,i)=><a href={'#'+p.id} key={p.id}><span>{String(i+1).padStart(2,'0')}</span>{p.name}</a>)}{doc.finalParagraphs.length>0&&<a href="#final-principle">最终投资准则</a>}</nav>
     <div className="charter-article">{doc.pillars.map((p,pi)=><section className="charter-pillar" id={p.id} key={p.id}>
      <div className="charter-pillar-heading"><span>PILLAR {String(pi+1).padStart(2,'0')}</span><div><h2>{p.name}</h2><p>{p.english}</p></div></div>
      {editing&&controls(<><button disabled={busy} onClick={()=>open('pillar',{name:p.name,english:p.english},p.id)}>编辑支柱</button><button disabled={busy} onClick={()=>editPrinciple(p.id)}>新增信条</button><button disabled={busy||pi===0} onClick={()=>movePillar(pi,-1)}>上移支柱</button><button disabled={busy||pi===doc.pillars.length-1} onClick={()=>movePillar(pi,1)}>下移支柱</button><button disabled={busy} onClick={()=>{if(confirm(`删除“${p.name}”及其中${p.principles.length}条信条？保存前仍可恢复已有草稿。`))change({...doc,pillars:doc.pillars.filter(x=>x.id!==p.id)});}}>删除支柱</button></>)}
      {!p.principles.length&&<p className="charter-editor-message">此支柱尚无信条，可在编辑模式中新增。</p>}
      {p.principles.map((item,ii)=><article className="charter-principle" key={item.id}><span className="charter-number">{String(++number).padStart(2,'0')}</span><div><h3>{item.title}</h3>{item.paragraphs.map((v,i)=><p key={i}>{v}</p>)}{item.bullets&&<ul>{item.bullets.map((v,i)=><li key={i}>{v}</li>)}</ul>}{item.afterBullets&&<p>{item.afterBullets}</p>}{item.conclusion&&<p className="charter-conclusion">{item.conclusion}</p>}
       {editing&&controls(<><button disabled={busy} onClick={()=>editPrinciple(p.id,item)}>编辑信条</button><button disabled={busy||ii===0} onClick={()=>movePrinciple(p.id,ii,-1)}>上移信条</button><button disabled={busy||ii===p.principles.length-1} onClick={()=>movePrinciple(p.id,ii,1)}>下移信条</button><button disabled={busy} onClick={()=>{if(confirm(`删除信条“${item.title}”？`))change({...doc,pillars:doc.pillars.map(x=>x.id===p.id?{...x,principles:x.principles.filter(v=>v.id!==item.id)}:x)});}}>删除信条</button></>)}
      </div></article>)}
     </section>)}{doc.finalParagraphs.length>0&&<section className="charter-final" id="final-principle"><span>AWE / FINAL PRINCIPLE</span><h2>{doc.finalTitle||'最终投资准则'}</h2>{doc.finalParagraphs.map((p,i)=>i===0?<strong key={i}>{p}</strong>:<p key={i}>{p}</p>)}</section>}</div>
    </div>
   </>}
  </div>
  {form&&doc&&<div className="charter-editor-overlay" onKeyDown={e=>{
   if(e.key==='Escape'){e.preventDefault();closeForm();}
   if(e.key==='Tab'){const fields=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select');if(!fields?.length)return;const first=fields[0],last=fields[fields.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }}><section ref={dialog} className="charter-editor-panel" role="dialog" aria-modal="true" aria-label={form.kind==='principle'?'信条编辑':form.kind==='pillar'?'支柱编辑':'宪法文字编辑'}><h2>{form.kind==='principle'?'编辑信条':form.kind==='pillar'?'编辑支柱':form.kind==='meta'?'编辑标题与总纲':'编辑最终准则'}</h2><p>输入会保留为浏览器草稿；应用后预览，再保存全部修改。</p>
   {form.kind==='meta'&&<>{formField('title','页面标题',false,'留空时按条数使用默认标题')}{formField('subtitle','副标题')}{formField('manifesto','总纲',true)}</>}
   {form.kind==='final'&&<>{formField('title','最终准则标题')}{formField('text','最终准则正文',true,'段落之间空一行')}</>}
   {form.kind==='pillar'&&<>{formField('name','支柱名称')}{formField('english','英文名称（可选）')}</>}
   {form.kind==='principle'&&<><label className="charter-field"><span>所属支柱</span><select value={form.fields.pillar} onChange={e=>setForm({...form,fields:{...form.fields,pillar:e.target.value}})}>{doc.pillars.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{formField('title','信条标题')}{formField('paragraphs','正文',true,'段落之间空一行；按原文保存，不自动改写')}{formField('bullets','要点列表（可选）',true,'每行一条')}{formField('after','要点后的补充（可选）',true)}{formField('conclusion','条目总结（可选）',true)}</>}
   {formError&&<p role="alert" className="charter-editor-warning">{formError}</p>}
   <footer><button onClick={()=>download({document:doc,revision,form},'AWE-fund-charter-draft.json')}>导出当前草稿</button><button onClick={closeForm}>取消</button><button disabled={busy} className="charter-save" onClick={applyForm}>应用到页面</button></footer>
  </section></div>}
 </main></div>;
}
