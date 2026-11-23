import { runAssetDirection } from '../../../../lib/asset-direction-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  try {
    const result=await runAssetDirection('document');
    if(!result.ok)return Response.json(result,{status:502});
    return new Response(result.html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"}});
  }catch{return new Response('资产风向暂时无法读取，请稍后重试。',{status:500});}
}
