import { assetDirectionResponse } from '../../../lib/asset-direction-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return assetDirectionResponse();}
export async function POST(){return assetDirectionResponse(true);}
