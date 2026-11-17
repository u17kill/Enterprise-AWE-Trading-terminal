import {validateBook} from './portfolio-books-validation';
export {validateBook} from './portfolio-books-validation';
import {readFile,writeFile,mkdir,copyFile,rename,unlink,readdir,stat,open} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import type {CoreBook} from './portfolio-books';
import type {PortfolioMatrix} from './portfolio-matrix';
import coreTemplate from '../../data/portfolio/core.json';
export type Book = 'core'|'sat';
export type BookData = CoreBook|PortfolioMatrix;
export const directory=()=>process.env.AWE_PORTFOLIO_DATA_DIR||join(homedir(),'Documents','Codex','.awe-terminal-data');
const filename=(book:Book)=>book==='core'?'portfolio-core.json':'portfolio-matrix.json';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function readBook(book:Book,dir=directory()) {
 const path=join(dir,filename(book));
 try {const raw=await readFile(path,'utf8');let matrix=JSON.parse(raw) as BookData;
  const legacy=matrix as PortfolioMatrix & {schemaVersion?:number};
  if(book==='core'&&legacy.schemaVersion===1&&Array.isArray(legacy.items))matrix={...coreTemplate,funds:legacy.items.map(i=>({id:i.id,name:i.name,amount:i.amount,note:'从旧核心仓迁移',assets:[{id:i.id+'-asset',name:i.name,regionId:['global','asia'].includes(i.regionId)?'other':i.regionId,style:legacy.columns.find(c=>c.id===i.columnId)?.groupId||'',weight:100}]}))};
  const errors=validateBook(book,matrix);return {ok:!errors.length,matrix:errors.length?null:matrix,revision:hash(raw),as_of:(await stat(path)).mtime.toISOString(),book,currency:book==='core'?'CNY':'USD',error:errors.join('；')||null,warn:[] as string[]};}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {ok:true,matrix:null,revision:'missing',as_of:null,book,currency:book==='core'?'CNY':'USD',error:null,warn:['文件缺失']};throw error;}
}
export async function saveBook(book:Book,matrix:BookData,revision:string,dir=directory()) {
 const errors=validateBook(book,matrix);if(errors.length)throw new Error('数据校验失败：'+errors.join('；'));
 await mkdir(dir,{recursive:true});const path=join(dir,filename(book)),lock=path+'.lock';
 const handle=await open(lock,'wx').catch(()=>{throw new Error('另一保存正在进行，请稍后重试');});
 const temp=path+'.'+randomUUID()+'.tmp';
 try {
  const old=await readBook(book,dir);if(old.revision!==revision)throw new Error('CONFLICT');
  const backups=join(dir,'backups');await mkdir(backups,{recursive:true});
  if(old.revision!=='missing')await copyFile(path,join(backups,`${filename(book)}-${Date.now()}-${randomUUID()}.json`));
  await writeFile(temp,JSON.stringify(matrix,null,2)+'\n','utf8');await rename(temp,path);
  const files=(await readdir(backups)).filter(n=>n.startsWith(filename(book)+'-')).sort().reverse();
  for(const f of files.slice(30))await unlink(join(backups,f)).catch(()=>{});
  return await readBook(book,dir);
 } finally {await unlink(temp).catch(()=>{});await handle.close();await unlink(lock);}
}
