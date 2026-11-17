import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {bookRequest} from './portfolio-books-api';
import core from '../../data/portfolio/core.json';
it('returns successful revision when the opposite book is corrupt',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'awe-api-'));const previous=process.env.AWE_PORTFOLIO_DATA_DIR;process.env.AWE_PORTFOLIO_DATA_DIR=dir;
 try{await writeFile(join(dir,'portfolio-matrix.json'),'{broken');const response=await bookRequest(new Request('http://127.0.0.1:3108/api/core',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({matrix:core,revision:'missing'})}),'core');expect(response.status).toBe(200);const result=await response.json();expect(result.ok).toBe(true);expect(result.revision).not.toBe('missing');expect(result.sum.coreTotal).toBe(530000000);}
 finally{if(previous===undefined)delete process.env.AWE_PORTFOLIO_DATA_DIR;else process.env.AWE_PORTFOLIO_DATA_DIR=previous;await rm(dir,{recursive:true,force:true});}
});
