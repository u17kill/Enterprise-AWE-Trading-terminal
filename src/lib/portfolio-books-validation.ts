import type {CoreBook} from './portfolio-books';
import type {PortfolioMatrix} from './portfolio-matrix';
type Book='core'|'sat';
export function validateBook(book:Book,raw:unknown):string[] {
 const errors:string[]=[];
 if(!raw||typeof raw!=='object') return ['数据必须是对象'];
 const d=raw as Record<string,unknown>;
 const arrays=book==='core'?['styles','regions','funds']:['groups','regions','columns','items'];
 if(arrays.some(k=>!Array.isArray(d[k]))) return ['缺少必要列表：'+arrays.join('、')];
 const check=(rows:Record<string,unknown>[],fields:string[])=>{const ids=new Set();for(const row of rows){if(!row||typeof row!=='object'){errors.push('列表行无效');continue;} if(typeof row.id!=='string'||!row.id||ids.has(row.id))errors.push('ID 缺失或重复');ids.add(row.id);for(const f of fields)if(typeof row[f]!=='string'||!(row[f] as string).trim())errors.push(`${row.id}: 缺少 ${f}`);}};
 for(const k of arrays)check(d[k] as Record<string,unknown>[],k==='items'?['symbol','name']:['name']);
 if(errors.length)return errors;
 if(book==='core') {
  const c=raw as CoreBook; if(c.schemaVersion!==2||c.currency!=='CNY')errors.push('核心仓必须使用版本 2 / CNY');
  const all=new Set<string>();
  for(const f of c.funds){if(typeof f.amount!=='string'||typeof f.note!=='string')errors.push('基金金额备注或说明无效');if(!Array.isArray(f.assets)||!f.assets.length){errors.push(`${f.name}: 至少一项资产`);continue;}
   check(f.assets as unknown as Record<string,unknown>[],['name','regionId','style']);
   if(errors.length)continue;
   for(const a of f.assets){if(all.has(a.id))errors.push('资产 ID 重复');all.add(a.id);if(!c.regions.some(r=>r.id===a.regionId)||!['attack','balance','defense'].includes(a.style))errors.push(`${f.name}: 国家或风格无效`);if(a.weight!==null&&(typeof a.weight!=='number'||!Number.isFinite(a.weight)||a.weight<0))errors.push(`${f.name}: 权重必须为非负数或空`);}
  }
 } else {
  const m=raw as PortfolioMatrix;
  for(const c of m.columns)if(!m.groups.some(g=>g.id===c.groupId))errors.push('主题所属策略无效');
  for(const i of m.items)if(typeof i.amount!=='string'||!['held','add','watch','option'].includes(i.status)||!m.regions.some(r=>r.id===i.regionId))errors.push(`${i.symbol}: 状态、地区或备注无效`);
 }
 return errors;
}
