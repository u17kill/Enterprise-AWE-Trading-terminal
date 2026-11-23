import { marketResponse } from '../../../../lib/market-overview-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return marketResponse('refresh', request, true); }
