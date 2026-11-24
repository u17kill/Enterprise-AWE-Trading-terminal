import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {intelligenceCommand,intelligenceKinds} from '../../../../lib/intelligence-server';
import {readBook,directory} from '../../../../lib/portfolio-books-store';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value:unknown)=>JSON.stringify(value??null).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const script=(source:string)=>source.replace(/<\/script/gi,'<\\/script');
export async function GET(){
 try{
  const results=await Promise.all(intelligenceKinds.map(kind=>intelligenceCommand('read',kind)));
  const [core,sat]=await Promise.all([readBook('core'),readBook('sat')]);
  let review:unknown=null;
  try{review=JSON.parse(await readFile(join(directory(),'portfolio-review.json'),'utf8'));}catch{}
  const [panes,portfolio,portfolioCss,css,renderer,portfolioJs]=await Promise.all([
   readFile(join(process.cwd(),'scripts/intelligence/panes.html'),'utf8'),
   readFile(join(process.cwd(),'scripts/intelligence/portfolio-offline.html'),'utf8'),
   readFile(join(process.cwd(),'public/intelligence/portfolio-offline.css'),'utf8'),
   readFile(join(process.cwd(),'public/intelligence/renderer.css'),'utf8'),
   readFile(join(process.cwd(),'public/intelligence/renderer.js'),'utf8'),
   readFile(join(process.cwd(),'public/intelligence/portfolio-offline.js'),'utf8'),
  ]);
  const keys=['news','wind','research','calendar','snapshot'],names=['NEWS','WIND','RPT','CAL','HLD'];
  const values=results.map((r,i)=>`let ${names[i]}=${json(r[keys[i]])};`).join('');
  const pages=[['news','市场新闻'],['wind','专家观点'],['research','机构研报'],['calendar','财经日历'],['holdings','大佬持仓'],['portfolio','当前持仓']];
  const nav=pages.map(([kind,name])=>`<button type="button" data-offline-page="${kind}">${name}</button>`).join('');
  const bootstrap=`window.fetch=async()=>{throw new TypeError('离线快照无法连接本机服务，请返回网站更新');};window.INTELLIGENCE_KIND='news';${values}`;
  const navigation=`document.querySelectorAll('[data-offline-page]').forEach(button=>button.onclick=()=>{const kind=button.dataset.offlinePage;document.querySelectorAll('[data-offline-page]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.getElementById('pane11').style.display=kind==='portfolio'?'block':'none';if(kind==='portfolio'){for(const n of [7,8,9,10,12])document.getElementById('pane'+n).style.display='none';}else{intelligenceKind=kind;iRender(kind);}document.getElementById('offline-title').textContent=button.textContent;});`;
  const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AWE 情报与持仓离线快照</title><style>${portfolioCss}\n${css}\nbody{padding:20px;background:#f5f8fc}main{max-width:1600px;margin:auto}.offline-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:15px 0}.offline-tabs button{border:1px solid #dce7f3;background:white;color:#245d94;border-radius:6px;padding:9px 13px}.offline-note{padding:12px;border:1px solid #efdab7;background:#fff8e9;color:#795a2c;font-size:12px;line-height:1.8}#offline-title{font:600 25px sans-serif;color:#203950}</style></head><body><h1 id="offline-title">市场新闻</h1><nav class="offline-tabs" aria-label="离线六页">${nav}</nav><p class="offline-note">离线快照：情报来源日期见各页，导入的人工观点与研报未逐条核验原文。当前持仓来自导出时的本机源文件，未写回的浏览器草稿需先处理。此文件含个人持仓，请自行保管。编辑仅保存到此浏览器本机，不会写入网站源文件；可导出 JSON 后在网站导入。</p><main>${panes}${portfolio}</main><script id="portfolio-offline-data" type="application/json">${json({core:core.matrix,sat:sat.matrix,review})}</script><script>${script(bootstrap)}\n${script(renderer)}\n${script(portfolioJs)}\n${script(navigation)}</script></body></html>`;
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="AWE-intelligence-snapshot.html"','Cache-Control':'no-store, no-cache, must-revalidate'}});
 }catch{
  return Response.json({ok:false,error:'离线快照生成失败，源文件未改变，请检查数据与服务环境'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
