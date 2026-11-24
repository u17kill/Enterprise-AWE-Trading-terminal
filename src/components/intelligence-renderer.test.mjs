// @vitest-environment node
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM, VirtualConsole } from 'jsdom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const kinds=['news','wind','research','calendar','holdings'];
const names=['NEWS','WIND','RPT','CAL','HLD'];
const keys=['news','wind','research','calendar','snapshot'];
let bootstrap='',dom;
const errors=[];
beforeAll(()=>{
 bootstrap=kinds.map((kind,i)=>{
  const response=JSON.parse(execFileSync('.local/market-venv/Scripts/python.exe',['scripts/intelligence/bridge.py','read',kind],{encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'},maxBuffer:20e6}));
  expect(response.ok).toBe(true);
  return `let ${names[i]}=${JSON.stringify(response[keys[i]]).replaceAll('<','\\u003c')};`;
 }).join('');
},30000);
afterEach(()=>{dom?.window.close();dom=undefined;errors.length=0;});
function open(){
 const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
 dom=new JSDOM(`<main>${readFileSync('scripts/intelligence/panes.html','utf8')}</main><script>${bootstrap}</script><script>${readFileSync('public/intelligence/renderer.js','utf8')}</script>`,{
  url:'http://localhost:3000',runScripts:'dangerously',virtualConsole:console,
  beforeParse(w){w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};},
 });
 expect(errors).toEqual([]);return dom.window;
}
describe('five intelligence panes with actual local module outputs',()=>{
 it('clears expired news instead of retaining previously rendered stories',()=>{
  const w=open(),d=w.document;w.eval("iRender('news')");
  w.eval("NEWS={items:[],n_items:0,n_top:0,n_auto:0,n_curated:0,buckets:[{id:'macro',name:'宏观政策'}]};renderNews()");
  expect(d.querySelectorAll('.nwcard').length).toBe(0);
  expect(d.querySelector('#nBody').textContent).toContain('窗口内无重大事项');
  w.eval('NEWS=null;renderNews()');
  expect(d.querySelector('#nTop').textContent).toBe('');
  expect(d.querySelector('#nBody').textContent).toBe('');
 });
 it('renders all five scopes and preserves independent views',()=>{
  const w=open(),d=w.document;
  for(const kind of kinds)w.eval(`iRender('${kind}')`);
  expect(d.querySelectorAll('.wcard').length).toBeGreaterThanOrEqual(127);
  expect(d.querySelectorAll('.rcard').length).toBeGreaterThanOrEqual(67);
  expect(d.querySelectorAll('.hc').length).toBeGreaterThanOrEqual(35);
  expect(d.querySelectorAll('.nwcard').length).toBeGreaterThan(0);
  expect(d.querySelectorAll('.calmini,.calcell').length).toBeGreaterThan(0);
  expect(d.querySelectorAll('a[target="_blank"]:not([rel*="noopener"])').length).toBe(0);
 });
 it('filters expert text and stance without changing the distribution sample',()=>{
  const w=open(),d=w.document;w.eval("iRender('wind')");
  const sample=d.querySelector('#wTemp').textContent;
  const input=d.querySelector('#wQ');input.value='definitely-no-such-expert';input.dispatchEvent(new w.Event('input'));
  expect(d.querySelectorAll('.wcard').length).toBe(0);
  expect(d.querySelector('#wTemp').textContent).toBe(sample);
  input.value='';input.dispatchEvent(new w.Event('input'));
  d.querySelector('#wFilter [data-t="bear"]').click();
  expect(d.querySelectorAll('.wcard').length).toBeGreaterThan(0);
  expect(d.querySelector('.wcard[data-tag="bull"]')).toBeNull();
 });
 it('selects one research institution and clears the intersection',()=>{
  const w=open(),d=w.document;w.eval("iRender('research')");const all=d.querySelectorAll('.rcard').length;
  d.querySelector('#rMatrix .rmx-c[data-tag]').click();
  expect(d.querySelectorAll('.rcard').length).toBeLessThan(all);
  expect(d.querySelector('#rState').textContent).toContain('正在看');
  d.querySelector('#rReset').click();expect(d.querySelectorAll('.rcard').length).toBe(all);
 });
 it('uses browser current week, three confidence states, market filters and year navigation',()=>{
  const w=open(),d=w.document;w.eval("iRender('calendar')");
  d.querySelector('#calZoom [data-v="year"]').click();expect(d.querySelectorAll('.calmini')).toHaveLength(12);
  d.querySelector('#calZoom [data-v="month"]').click();expect(d.querySelector('#calBody .est')).not.toBeNull();
  expect(d.querySelector('.cal-market input')).not.toBeNull();
  expect(d.querySelector('.cal-market').textContent).toContain('待定');
  w.eval("CAL.events.push({id:'pending-test',date:calTODAY(),title:'待确认测试',type:CAL.types[0].id,mkt:CAL.mkts[0].id,conf:'tbd'});calIdx=calBuildIdx();calRender()");
  d.querySelector('#calZoom [data-v="week"]').click();
  expect(d.querySelector('#calBody .pending')?.textContent).toContain('待确认测试');
  expect(d.querySelector('#calWeek').textContent).toContain('待定');
 });
 it('keeps 13F disclosure details visible and rejects executable source URLs',()=>{
  const w=open(),d=w.document;w.eval("iRender('holdings')");
  d.querySelector('#hDir .hc').click();expect(d.querySelector('#hDet').classList.contains('on')).toBe(true);
  expect(d.querySelector('#hDet').textContent).toContain('申报');
  expect(w.eval("iSafeURL('javascript:alert(1)')")).toBe('#');
  expect(w.eval("iSafeURL('https://www.sec.gov/Archives/')")).toBe('https://www.sec.gov/Archives/');
  const input=d.querySelector('#hQ');input.value='no-such-filer';input.dispatchEvent(new w.Event('input'));expect(d.querySelector('#hDir').textContent).toContain('没有匹配');
 });
});
