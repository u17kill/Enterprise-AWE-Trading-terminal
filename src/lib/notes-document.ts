export type NotesCard={id:string;title:string;body:string;created:string;updated:string;[key:string]:unknown};
export type NotesColumn={id:string;title:string;cards:NotesCard[];[key:string]:unknown};
export type NotesBoard={schemaVersion:1;updated:string;columns:NotesColumn[];[key:string]:unknown};
export type NotesStats={columns:number;cards:number;chars:number};
export type NotesSnapshot={ok:boolean;notes:NotesBoard|null;revision:string;updatedAt:string|null;stats?:NotesStats;warnings:string[];error?:string;backup?:string|null;bytes?:number};
export function defaultNotes():NotesBoard{return {schemaVersion:1,updated:'',columns:['随手记','待处理','已归档'].map((title,i)=>({id:`col-default-${i+1}`,title,cards:[]}))};}
export function validateNotes(raw:unknown):{errors:string[];warnings:string[]}{
 const errors:string[]=[],warnings:string[]=[],ids=new Set<string>();let cards=0;
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const text=(v:unknown,label:string,warningLimit?:number)=>{if(typeof v!=='string')errors.push(`${label}必须是文字`);else if(warningLimit&&v.length>warningLimit)warnings.push(`${label}超过${warningLimit}字，已保留原文`);};
 const id=(v:unknown,prefix:string)=>{if(typeof v!=='string'||!new RegExp(`^${prefix}[a-zA-Z0-9_-]{1,120}$`).test(v)||ids.has(v))errors.push('泳道或卡片ID无效/重复');else ids.add(v);};
 if(!object(raw)||raw.schemaVersion!==1)return {errors:['笔记格式版本无效'],warnings};
 text(raw.updated,'修改时间');
 if(!Array.isArray(raw.columns)||raw.columns.length>100)return {errors:[...errors,'泳道必须是至多100项的列表'],warnings};
 for(const col of raw.columns){
  if(!object(col)){errors.push('泳道格式无效');continue;}id(col.id,'col-');text(col.title,'泳道名称',16);
  if(!Array.isArray(col.cards)){errors.push('卡片列表无效');continue;}cards+=col.cards.length;
  for(const card of col.cards){if(!object(card)){errors.push('卡片格式无效');continue;}id(card.id,'c-');text(card.title,'卡片标题',60);text(card.body,'正文');text(card.created,'创建时间');text(card.updated,'修改时间');}
 }
 if(cards>5000)errors.push('卡片总数不能超过5000条');return {errors,warnings};
}
export function notesStats(board:NotesBoard):NotesStats{return {columns:board.columns.length,cards:board.columns.reduce((n,col)=>n+col.cards.length,0),chars:board.columns.reduce((n,col)=>n+col.cards.reduce((m,card)=>m+card.body.length,0),0)};}
export function formatNotesTime(value:string,short=false):string{
 const normalized=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(value)?value.replace(' ','T')+'+08:00':value;
 const date=new Date(normalized);if(!value||Number.isNaN(date.getTime()))return '—';
 return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Singapore',month:'2-digit',day:'2-digit',...(short?{}:{year:'numeric'}),hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
}
