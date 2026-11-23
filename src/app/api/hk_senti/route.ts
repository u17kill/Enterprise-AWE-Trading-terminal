import { temperatureResponse } from '../../../lib/temperature-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return temperatureResponse('hk');}
