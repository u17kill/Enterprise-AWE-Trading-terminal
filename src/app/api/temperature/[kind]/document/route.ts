import { isTemperatureKind,temperatureCommand } from '../../../../../lib/temperature-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{kind:string}>}){
 const {kind}=await context.params;if(!isTemperatureKind(kind))return new Response('未知页面',{status:404});
 try{const result=await temperatureCommand('document',kind);if(!result.ok)return Response.json(result,{status:500});return new Response(result.html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'self'; base-uri 'none'"}});}catch{return new Response('本页数据暂不可读，请稍后重试。',{status:500});}
}
