import { temperatureCommand } from '../../../lib/temperature-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{const [momentum,valuation]=await Promise.all([temperatureCommand('read','momentum'),temperatureCommand('read','valuation')]);return Response.json({ok:momentum.ok&&valuation.ok,data:momentum.data,val:valuation.data,updated:momentum.updated,val_updated:valuation.updated},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({ok:false,error:'本机快照暂不可读'},{status:500});}}
