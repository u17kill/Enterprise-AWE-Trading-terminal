import { intelligenceDocument } from '@/lib/intelligence-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params;
  return intelligenceDocument(kind);
}
