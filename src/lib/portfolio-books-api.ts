import {readBook,saveBook,validateBook,type Book} from './portfolio-books-store';
import {summarizeBooks,type CoreBook} from './portfolio-books';
import type {PortfolioMatrix} from './portfolio-matrix';
import coreTemplate from '../../data/portfolio/core.json';
import satTemplate from '../../data/portfolio/matrix.json';
export async function bookRequest(request:Request,book:Book){
 const url=new URL(request.url),origin=request.headers.get('origin');
 if(!['localhost','127.0.0.1'].includes(url.hostname)||(origin&&new URL(origin).host!==url.host))return Response.json({ok:false,error:'仅支持本机同源请求'},{status:403});
 try {
  if(request.method==='GET')return Response.json(await readBook(book),{headers:{'Cache-Control':'no-store'}});
  const text=await request.text();if(text.length>1000000)return Response.json({ok:false,error:'数据过大'},{status:413});
  let input;try{input=JSON.parse(text);}catch{return Response.json({ok:false,error:'JSON 无效'},{status:400});}
  const errors=validateBook(book,input?.matrix);if(errors.length)return Response.json({ok:false,error:errors.join('；')},{status:400});
  if(typeof input.revision!=='string'||!input.revision)return Response.json({ok:false,error:'缺少文件版本，请先读取源文件再保存'},{status:400});
  const saved=await saveBook(book,input.matrix,input.revision);
  const other=await readBook(book==='core'?'sat':'core').catch(()=>({matrix:null}));
  const core=(book==='core'?saved.matrix:other.matrix) as CoreBook|null;
  const sat=(book==='sat'?saved.matrix:other.matrix) as PortfolioMatrix|null;
  return Response.json({...saved,sum:summarizeBooks(sat||{...satTemplate,items:[]},core||{...coreTemplate,funds:[]})},{headers:{'Cache-Control':'no-store'}});
 }catch(error){const message=error instanceof Error?error.message:'保存失败';return Response.json({ok:false,error:message==='CONFLICT'?'文件已改变，请选择使用本机草稿或文件版本':message},{status:message==='CONFLICT'?409:500});}
}
