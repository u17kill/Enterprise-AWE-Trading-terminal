import {describe,it,expect} from 'vitest';
import matrix from '../../data/portfolio/matrix.json';
import core from '../../data/portfolio/core.json';
import {amountCents,allocate,summarizeBooks} from './portfolio-books';
import type {PortfolioMatrix} from './portfolio-matrix';
describe('PRD portfolio accounting',()=>{
 it('reproduces every acceptance percentage and conserved totals',()=>{
  const s=summarizeBooks(matrix as PortfolioMatrix,core);
  expect([s.coreTotal,s.satellite,s.total,s.rows.length]).toEqual([530000000,41380000,819660000,52]);
  for(const map of [s.regions,s.styles,s.classes]) expect(Object.values(map).reduce((a,b)=>a+b,0)).toBe(s.total);
  const percent=(n:number)=>n/s.total*100;
  const expected:Record<string,number>={cn:33.62,us:32.48,other:20.25,asia:11.26,eu:2.39};
  for(const [key,value] of Object.entries(expected)) expect(Math.abs(percent(s.regions[key])-value)).toBeLessThan(.05);
  for(const [key,value] of Object.entries({'style.attack':44.81,'style.balance':12.48,'style.defense':42.71,'band.real_def':33.89,'factor.ai':32.47,'conc.top5':23.92})) expect(Math.abs(s.readings[key as keyof typeof s.readings]-value)).toBeLessThan(.05);
  for(const [key,value] of Object.entries({'股票':62.67,'商品截面CTA':12.20,'商品时序CTA':6.59,'可转债':5.49,'国债':4.88,'股指中性策略':4.27,'期权套利策略':2.44,'黄金':1.46})) expect(Math.abs(percent(s.classes[key])-value)).toBeLessThan(.05);
  expect(s.equivalent).toBeCloseTo(36.5,1); expect(s.average).toBeCloseTo(.68,2); expect(s.smallCount).toBe(11); expect(s.smallCents/1000000).toBeCloseTo(20.3,1);
 });
 it('keeps unparseable amounts distinct from zero and preserves cents',()=>{
  expect(amountCents('0.00001k')).toBe(1); expect(amountCents('0k')).toBe(0);
  for(const text of ['115','约3k','2.7k–5','Sell put 240','']) expect(amountCents(text)).toBeNull();
  const assets=[1,2,3].map(n=>({id:String(n),name:'x',regionId:'us',style:'attack',weight:null}));
  expect(allocate(100,assets).map(a=>a.cents)).toEqual([34,33,33]);
  expect(allocate(100,[{...assets[0],weight:0},assets[1]]).map(a=>a.cents)).toEqual([0,100]);
 });
});
