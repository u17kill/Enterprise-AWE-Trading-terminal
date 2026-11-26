import {validateCharter, type CharterDocument} from '../../../lib/fund-charter-document';
import {CharterStoreError, readCharter, saveCharter} from '../../../lib/fund-charter-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const limit = 1024 * 1024;
const reply = (body: unknown, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});
function failure(error: unknown) {
 if (error instanceof CharterStoreError) return reply({ok: false, document: null, revision: '', updatedAt: null, error: error.message}, {VALIDATION: 400, CONFLICT: 409, BUSY: 429, CORRUPT: 500}[error.code]);
 return reply({ok: false, document: null, revision: '', updatedAt: null, error: '无法读取或保存基金宪法文件，请检查本机数据目录后重试'}, 503);
}
export async function GET() {
 try { return reply(await readCharter()); } catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
 const url = new URL(request.url);
 // Next normalizes request.url to localhost; browsers still send the actual Host.
 let browserOrigin=url.origin;
 const host=request.headers.get('host');
 if(host){
  try{const external=new URL(`${url.protocol}//${host}`);if(external.host!==host||!['localhost','127.0.0.1','[::1]'].includes(external.hostname))return reply({ok:false,error:'仅支持本机同源保存'},403);browserOrigin=external.origin;}
  catch{return reply({ok:false,error:'请求主机无效'},403);}
 }
 const origin = request.headers.get('origin');
 if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || request.headers.get('sec-fetch-site') === 'cross-site') return reply({ok: false, error: '仅支持本机同源保存'}, 403);
 if (origin) {
  try { if (new URL(origin).origin !== browserOrigin) return reply({ok: false, error: '仅支持本机同源保存'}, 403); }
  catch { return reply({ok: false, error: '请求来源无效'}, 403); }
 }
 if (Number(request.headers.get('content-length')) > limit) return reply({ok: false, error: '数据不能超过1MB'}, 413);
 try {
  const reader = request.body?.getReader();
  if (!reader) return reply({ok: false, error: '缺少JSON文档'}, 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
   for (;;) {
    const result = await reader.read();
    if (result.done) break;
    bytes += result.value.byteLength;
    if (bytes > limit) { await reader.cancel(); return reply({ok: false, error: '数据不能超过1MB'}, 413); }
    chunks.push(result.value);
   }
  } finally { reader.releaseLock(); }
  let input;
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return reply({ok: false, error: 'JSON无效'}, 400); }
  const errors = validateCharter(input?.document);
  if (errors.length || typeof input?.revision !== 'string' || !input.revision) return reply({ok: false, error: errors.join('；') || '缺少文件版本，请先读取文件'}, 400);
  return reply(await saveCharter(input.document as CharterDocument, input.revision));
 } catch (error) { return failure(error); }
}
