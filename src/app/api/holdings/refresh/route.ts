import { intelligenceResponse } from '@/lib/intelligence-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST() { return intelligenceResponse('holdings', 'refresh'); }
