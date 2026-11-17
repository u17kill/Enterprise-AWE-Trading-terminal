import {PortfolioBooks} from '../../components/portfolio-books';
import {readBook,directory} from '../../lib/portfolio-books-store';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import reviewType from '../../../data/portfolio/review.json';
import core from '../../../data/portfolio/core.json';
import sat from '../../../data/portfolio/matrix.json';
export const dynamic='force-dynamic';
export default async function Page(){
 const read=async(book:'core'|'sat')=>{try{return await readBook(book);}catch{return {matrix:null,revision:'unreadable',as_of:null,ok:false,error:'本机文件无法读取，原文件保留，请勿覆盖'};}};
 const [coreSnapshot,satSnapshot]=await Promise.all([read('core'),read('sat')]);
 let review:typeof reviewType|null=null;
 try{const parsed=JSON.parse(await readFile(join(directory(),'portfolio-review.json'),'utf8'));if(parsed.regime&&parsed.verdict&&parsed.anchor&&['targets','issues','moves','watch','invalidates'].every(k=>Array.isArray(parsed[k]))){const valid=parsed.targets.every((t:typeof reviewType.targets[number])=>t&&reviewType.targets.some(v=>v.key===t.key)&&typeof t.name==='string'&&Number.isFinite(t.lo)&&Number.isFinite(t.hi));const entries=parsed.issues.every((i:typeof reviewType.issues[number])=>i&&typeof i.title==='string')&&parsed.moves.every((i:typeof reviewType.moves[number])=>i&&typeof i.what==='string');if(valid&&entries)review=parsed;}}catch{}
 return <PortfolioBooks initialReview={review} initial={{core:coreSnapshot,sat:satSnapshot}} emptyCore={{...core,funds:[]}} emptySat={{...sat,items:[]}}/>;
}
