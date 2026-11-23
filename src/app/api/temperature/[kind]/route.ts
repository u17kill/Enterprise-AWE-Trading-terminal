import { temperatureResponse } from '../../../../lib/temperature-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{kind:string}>};
export async function GET(_request:Request,context:Context){return temperatureResponse((await context.params).kind);}
export async function POST(_request:Request,context:Context){return temperatureResponse((await context.params).kind,true);}
