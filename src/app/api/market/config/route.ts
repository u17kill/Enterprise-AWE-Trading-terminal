import { marketResponse } from '../../../../lib/market-overview-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return marketResponse('config', request, false); }
export async function POST(request: Request) { return marketResponse('save', request, true); }
