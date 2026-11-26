import {FUND_CHARTER_FINAL,FUND_CHARTER_PILLARS,type CharterPrinciple} from './fund-charter';

export type EditablePrinciple=Omit<CharterPrinciple,'number'> & {id:string};
export type EditablePillar={id:string;name:string;english:string;principles:EditablePrinciple[]};
export type CharterDocument={schemaVersion:1;title:string;subtitle:string;manifesto:string;pillars:EditablePillar[];finalTitle:string;finalParagraphs:string[]};
export type CharterSnapshot={ok:boolean;document:CharterDocument|null;revision:string;updatedAt:string|null;error?:string;backup?:string|null};

export function defaultCharter():CharterDocument{
 return {schemaVersion:1,title:'',subtitle:'Core Investment Principles · V1.0',manifesto:'先求生存，再求收益；以价值为锚，以纪律为尺，以组合为舟，以时间为友。',pillars:FUND_CHARTER_PILLARS.map(p=>({...p,principles:p.principles.map(({number,...principle})=>({...principle,id:'principle-'+number,paragraphs:[...principle.paragraphs],...(principle.bullets?{bullets:[...principle.bullets]}:{})}))})),finalTitle:'AWE 的最终投资准则',finalParagraphs:[...FUND_CHARTER_FINAL]};
}
export function charterTitle(doc:CharterDocument){return doc.title.trim()||(doc.pillars.reduce((n,p)=>n+p.principles.length,0)===10?'投资十大信条':'投资信条');}
export function validateCharter(raw:unknown):string[]{
 const errors:string[]=[],ids=new Set<string>(['final-principle']);let count=0;
 const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
 const text=(v:unknown,label:string,max:number,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))errors.push(label+'必须是'+(required?'非空':'')+'文字，且不超过'+max+'字');};
 const id=(v:unknown)=>{if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(v)||ids.has(v))errors.push('条目或支柱ID无效/重复');else ids.add(v);};
 const lines=(v:unknown,label:string)=>{if(!Array.isArray(v)||v.length>100)errors.push(label+'必须是至多100段的列表');else v.forEach(x=>text(x,label,20000));};
 if(!object(raw)||raw.schemaVersion!==1)return ['基金宪法格式版本无效'];
 text(raw.title,'标题',200);text(raw.subtitle,'副标题',300);text(raw.manifesto,'总纲',10000);text(raw.finalTitle,'最终准则标题',200);lines(raw.finalParagraphs,'最终准则');
 if(!Array.isArray(raw.pillars)||raw.pillars.length>50)return [...errors,'支柱必须是至多50项的列表'];
 for(const p of raw.pillars){
  if(!object(p)){errors.push('支柱格式无效');continue;}id(p.id);text(p.name,'支柱名称',200,true);text(p.english,'支柱英文名称',300);
  if(!Array.isArray(p.principles)){errors.push('信条列表无效');continue;}
  count+=p.principles.length;
  for(const item of p.principles){
   if(!object(item)){errors.push('信条格式无效');continue;}id(item.id);text(item.title,'信条标题',300,true);lines(item.paragraphs,'正文');text(item.conclusion,'总结',10000);
   if(item.bullets!==undefined)lines(item.bullets,'要点');if(item.afterBullets!==undefined)text(item.afterBullets,'要点后补充',20000);
  }
 }
 if(count>500)errors.push('信条总数不能超过500条');return errors;
}
