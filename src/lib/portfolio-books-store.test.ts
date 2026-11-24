import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readBook,saveBook,validateBook} from './portfolio-books-store';
import core from '../../data/portfolio/core.json';
import matrix from '../../data/portfolio/matrix.json';
import type {PortfolioMatrix} from './portfolio-matrix';
describe('portfolio file protection',()=>{
 it('rejects invalid core assets and keeps unclassified satellite cards',()=>{
  expect(validateBook('core',core)).toEqual([]);
  expect(validateBook('core',{...core,funds:[{...core.funds[0],assets:[]}]})).not.toEqual([]);
  expect(validateBook('core',{...core,funds:[null]})).not.toEqual([]);
 });
 it('backs up prior data and rejects stale revisions without modifying files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'awe-books-'));
  try{
   const first=await saveBook('core',core,'missing',dir);
   const next={...core,funds:core.funds.map((f,i)=>i?f:{...f,amount:'1001k'})};
   const second=await saveBook('core',next,first.revision,dir);
   await expect(saveBook('core',core,first.revision,dir)).rejects.toThrow('CONFLICT');
   expect((await readBook('core',dir)).revision).toBe(second.revision);
   const backups=await readdir(join(dir,'backups'));expect(backups).toHaveLength(1);
   expect(JSON.parse(await readFile(join(dir,'backups',backups[0]),'utf8'))).toEqual(core);
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('serializes simultaneous writes to separate books and rejects invalid data without changing either',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'awe-two-books-'));
  try{
   const [c,s]=await Promise.all([saveBook('core',core,'missing',dir),saveBook('sat',matrix as PortfolioMatrix,'missing',dir)]);
   expect((await readBook('core',dir)).matrix).toEqual(core);
   expect((await readBook('sat',dir)).matrix).toEqual(matrix);
   expect(c.path).not.toBe(s.path);expect(c.bytes).toBeGreaterThan(0);
   await expect(saveBook('core',{...core,funds:[{...core.funds[0],assets:[]}]},c.revision,dir)).rejects.toThrow('校验失败');
   expect((await readBook('core',dir)).revision).toBe(c.revision);
   expect((await readBook('sat',dir)).revision).toBe(s.revision);
   const changed=await saveBook('sat',{...matrix,items:[]} as PortfolioMatrix,s.revision,dir);
   expect(changed.backup).toBeTruthy();
   expect(JSON.parse(await readFile(join(dir,'backups',changed.backup!),'utf8'))).toEqual(matrix);
  }finally{await rm(dir,{recursive:true,force:true});}
 });
});
