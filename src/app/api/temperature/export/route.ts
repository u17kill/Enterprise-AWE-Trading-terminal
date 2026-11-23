import { temperatureCommand } from '../../../../lib/temperature-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{const result=await temperatureCommand('offline','momentum');if(!result.ok)return Response.json(result,{status:500});return new Response(result.html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="AWE-temperature-snapshot.html"','Cache-Control':'no-store'}});}catch{return Response.json({ok:false,error:'导出失败，请稍后重试'},{status:500});}}
