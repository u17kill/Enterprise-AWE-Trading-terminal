import { temperatureResponse } from '../../../../lib/temperature-server';
export const runtime='nodejs';
export async function POST(){return temperatureResponse('us',true);}
