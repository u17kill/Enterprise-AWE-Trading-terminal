import type { PortfolioMatrix } from './portfolio-matrix';
export type CoreAsset = { id: string; name: string; regionId: string; style: string; weight: number | null };
export type CoreBook = { schemaVersion: number; currency: string; styles: {id:string;name:string;color:string}[]; regions:{id:string;name:string}[]; funds:{id:string;name:string;amount:string;note:string;assets:CoreAsset[]}[] };
// Fixed bookkeeping rate preserves cross-month comparisons; one USD cent is exactly seven CNY cents.
export const BOOK_FX = 7;
export function amountCents(text: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,5}))?k$/i.exec(text);
  if (!match) return null;
  const value = BigInt(match[1]) * BigInt(100000) + BigInt((match[2] || '').padEnd(5,'0'));
  return value <= BigInt(900719925474) ? Number(value) : null;
}
export const regionKey = (id:string) => ({china:'cn',hk:'cn',cn:'cn',us:'us',asia:'asia',jp:'asia',europe:'eu',eu:'eu',other:'other'}[id] || 'other');
const add = (out:Record<string,number>, key:string, value:number) => { out[key]=(out[key]||0)+value; };
export function allocate(cents:number, assets:CoreAsset[]) {
  if (!assets.length) return [];
  const known=assets.reduce((s,a)=>s+(a.weight ?? 0),0), missing=assets.filter(a=>a.weight===null).length;
  const weights=assets.map(a=>a.weight ?? (missing ? Math.max(100-known,0)/missing : 0));
  if (weights.reduce((s,w)=>s+w,0)<=0) weights.fill(1);
  const total=weights.reduce((s,w)=>s+w,0);
  const values=weights.map(w=>Math.floor(cents*w/total));
  const largest=values.indexOf(Math.max(...values));
  values[largest]+=cents-values.reduce((s,v)=>s+v,0);
  return assets.map((asset,i)=>({...asset,cents:values[i]}));
}
export function summarizeBooks(matrix:PortfolioMatrix, core:CoreBook) {
  const regions:Record<string,number>={}, styles:Record<string,number>={}, classes:Record<string,number>={};
  const rows:{id:string;name:string;cents:number}[]=[];
  let satellite=0, coreTotal=0, realDefense=0, ai=0, invalid=0, unclassified=0;
  for (const item of matrix.items) {
    if (!['held','add'].includes(item.status)) continue;
    const column=matrix.columns.find(c=>c.id===item.columnId);
    if (!column || !matrix.groups.some(g=>g.id===column.groupId) || !matrix.regions.some(r=>r.id===item.regionId)) { unclassified++; continue; }
    const cents=amountCents(item.amount); if(cents===null) {invalid++;continue;}
    satellite+=cents; const cny=cents*BOOK_FX;
    add(regions,regionKey(item.regionId),cny); add(styles,column.groupId,cny); add(classes,'股票',cny);
    if(item.name.includes('黄金')) realDefense+=cny;
    if(column.name.startsWith('AI')) ai+=cny;
    rows.push({id:item.id,name:item.name,cents});
  }
  const funds=core.funds.map(fund=>{
    const cents=amountCents(fund.amount); const assets=cents===null?[]:allocate(cents,fund.assets);
    if(cents!==null) coreTotal+=cents;
    for(const asset of assets) {
      add(regions,regionKey(asset.regionId),asset.cents); add(styles,asset.style,asset.cents);
      add(classes,asset.name.includes('股票')?'股票':asset.name,asset.cents);
      if(/国债|黄金|中性|套利|CTA/.test(asset.name)) realDefense+=asset.cents;
      if(asset.name.includes('纳斯达克')) ai+=asset.cents;
      else if(asset.name.includes('标普500')) ai+=Math.floor(asset.cents*33/100);
    }
    return {...fund,cents,allocated:assets};
  });
  const total=coreTotal+satellite*BOOK_FX, pct=(v:number,d=total)=>d?v/d*100:0;
  const top5=[...rows].sort((a,b)=>b.cents-a.cents).slice(0,5).reduce((s,r)=>s+r.cents,0);
  const hhi=satellite?rows.reduce((s,r)=>s+(r.cents/satellite)**2,0):0;
  const small=rows.filter(r=>pct(r.cents*BOOK_FX)<0.3);
  return {total,coreTotal,satellite,regions,styles,classes,funds,rows,invalid,unclassified,
    readings:{'region.cn':pct(regions.cn||0),'style.attack':pct(styles.attack||0),'style.balance':pct(styles.balance||0),'style.defense':pct(styles.defense||0),'band.real_def':pct(realDefense),'factor.ai':pct(ai),'conc.top5':pct(top5,satellite)},
    equivalent:hhi?1/hhi:0,average:rows.length?pct(satellite*BOOK_FX)/rows.length:0,smallCount:small.length,smallCents:small.reduce((s,r)=>s+r.cents*BOOK_FX,0)};
}
