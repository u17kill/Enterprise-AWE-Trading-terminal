import { marketResponse } from '../../../../lib/market-overview-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return marketResponse('brief', request, true); }
