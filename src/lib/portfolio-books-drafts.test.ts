import {it,expect} from 'vitest';
import {parseBookDraft,backupBookDraft} from './portfolio-books-drafts';
import core from '../../data/portfolio/core.json';
import matrix from '../../data/portfolio/matrix.json';
it('preserves both wrapped and earlier raw drafts without silently accepting a file revision',()=>{
 expect(parseBookDraft('core',JSON.stringify(core))).toEqual({matrix:core,revision:'legacy-draft',dirty:true});
 expect(parseBookDraft('core',JSON.stringify({savedAt:'2026-11-24',data:core}))).toEqual({matrix:core,revision:'legacy-draft',dirty:true});
 expect(parseBookDraft('sat',JSON.stringify({matrix,revision:'abc',dirty:false}))).toEqual({matrix,revision:'abc',dirty:false});
 expect(()=>parseBookDraft('core',JSON.stringify(matrix))).toThrow('无效草稿');
 const values:Record<string,string>={};const draft=parseBookDraft('core',JSON.stringify(core));
 const key=backupBookDraft({setItem:(key,value)=>{values[key]=value;}},'pmx_core_v2',draft);
 expect(key).toMatch(/^pmx_core_v2\.backup\./);expect(JSON.parse(values[key])).toEqual(draft);
});
