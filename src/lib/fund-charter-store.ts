import {createHash, randomUUID} from 'node:crypto';
import {link, mkdir, open, readFile, readdir, rename, unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';
import {defaultCharter, validateCharter, type CharterDocument, type CharterSnapshot} from './fund-charter-document';

export const charterDataDirectory = () => process.env.AWE_CHARTER_DATA_DIR || process.env.AWE_PORTFOLIO_DATA_DIR || join(homedir(), 'Documents', 'Codex', '.awe-terminal-data');
export class CharterStoreError extends Error {
 constructor(public readonly code: 'VALIDATION' | 'CONFLICT' | 'BUSY' | 'CORRUPT', message: string) { super(message); }
}
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const filename = 'fund-charter.json';
const queues = new Map<string, Promise<unknown>>();

async function source(dir: string): Promise<{snapshot: CharterSnapshot; bytes: Buffer | null}> {
 let file;
 try { file = await open(join(dir, filename), 'r'); }
 catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {snapshot: {ok: true, document: defaultCharter(), revision: 'missing', updatedAt: null}, bytes: null};
  throw error;
 }
 try {
  const bytes = await file.readFile();
  let document: unknown;
  try { document = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { throw new CharterStoreError('CORRUPT', '基金宪法文件损坏，已保留原文件，请先恢复备份'); }
  if (validateCharter(document).length) throw new CharterStoreError('CORRUPT', '基金宪法文件格式无效，已保留原文件，请先恢复备份');
  return {snapshot: {ok: true, document: document as CharterDocument, revision: hash(bytes), updatedAt: (await file.stat()).mtime.toISOString()}, bytes};
 } finally { await file.close(); }
}
export async function readCharter(dir = charterDataDirectory()): Promise<CharterSnapshot> { return (await source(dir)).snapshot; }

type LockOwner = {pid: number; token: string};
function parseOwner(raw: string): LockOwner {
 const owner = JSON.parse(raw);
 if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.token !== 'string' || !/^[a-f0-9-]{36}$/.test(owner.token)) throw new Error('Unrecognized lock metadata');
 return owner;
}
function alive(pid: number): boolean {
 try { process.kill(pid, 0); return true; }
 catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
}
// A fully written owner file is hard-linked atomically into place: a crash can never
// leave an empty lock, and a live writer is never evicted by a timer. Recovery uses
// a lock keyed by the dead owner's token, so competing recoverers cannot unlink a
// newly acquired writer's lock. Recovery locks use the same crash-safe protocol.
async function acquireLock(path: string, depth = 0): Promise<() => Promise<void>> {
 if (depth > 8) throw new CharterStoreError('BUSY', '保存锁正在恢复，请稍后重试');
 const owner: LockOwner = {pid: process.pid, token: randomUUID()};
 const prepared = `${path}.${owner.token}.owner`;
 const handle = await open(prepared, 'wx');
 try {
  try { await handle.writeFile(JSON.stringify(owner), 'utf8'); await handle.sync(); }
  finally { await handle.close(); }
  for (let attempt = 0; attempt < 3; attempt++) {
   try {
    await link(prepared, path);
    return async () => { await unlink(path); };
   } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
   let observed: string;
   try { observed = await readFile(path, 'utf8'); }
   catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
   let existing: LockOwner;
   try { existing = parseOwner(observed); }
   catch { throw new CharterStoreError('BUSY', '保存锁格式无法识别，原文件未改动'); }
   if (alive(existing.pid)) throw new CharterStoreError('BUSY', '另一保存正在进行，请稍后重试');
   const releaseRecovery = await acquireLock(`${path}.recover-${existing.token}`, depth + 1);
   try {
    let current: string | null;
    try { current = await readFile(path, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; current = null; }
    if (current === observed) await unlink(path);
   } finally { await releaseRecovery(); }
  }
  throw new CharterStoreError('BUSY', '另一保存正在进行，请稍后重试');
 } finally { await unlink(prepared).catch(() => {}); }
}

export async function saveCharter(document: CharterDocument, revision: string, dir = charterDataDirectory()): Promise<CharterSnapshot> {
 const errors = validateCharter(document);
 if (errors.length) throw new CharterStoreError('VALIDATION', errors.join('；'));
 if (typeof revision !== 'string' || !revision) throw new CharterStoreError('VALIDATION', '缺少文件版本，请先读取文件');
 // Capture the caller's document before entering the asynchronous queue.
 const content = JSON.stringify(document, null, 2) + '\n';
 if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) throw new CharterStoreError('VALIDATION', '基金宪法不能超过1MB');
 // User data lives outside the deployment; do not bundle the configured directory.
 const key = resolve(/* turbopackIgnore: true */ dir);
 const previous = queues.get(key) || Promise.resolve();
 const next = previous.catch(() => {}).then(() => writeCharter(content, revision, key));
 queues.set(key, next);
 try { return await next; }
 finally { if (queues.get(key) === next) queues.delete(key); }
}
async function writeCharter(content: string, revision: string, dir: string): Promise<CharterSnapshot> {
 await mkdir(dir, {recursive: true});
 const path = join(dir, filename);
 const release = await acquireLock(path + '.lock');
 const temp = `${path}.${randomUUID()}.tmp`;
 try {
  const old = await source(dir);
  if (old.snapshot.revision !== revision) throw new CharterStoreError('CONFLICT', '文件已改变，请选择使用文件版本或保留本机草稿');
  let backup: string | null = null;
  const backupDir = join(dir, 'backups');
  if (old.bytes !== null) {
   await mkdir(backupDir, {recursive: true});
   backup = `${filename}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`;
   const file = await open(join(backupDir, backup), 'wx');
   try { await file.writeFile(old.bytes); await file.sync(); }
   finally { await file.close(); }
  }
  const file = await open(temp, 'wx');
  try { await file.writeFile(content, 'utf8'); await file.sync(); }
  finally { await file.close(); }
  await rename(temp, path);
  // Pruning is maintenance: failure must not report a successfully committed save
  // as failed. Only this document's backup names are eligible for removal.
  if (backup) {
   const files = (await readdir(backupDir).catch(() => []))
    .filter(name => /^fund-charter\.json-\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9-]{36}\.json$/.test(name)).sort().reverse();
   for (const name of files.slice(30)) await unlink(join(backupDir, name)).catch(() => {});
  }
  return {...await readCharter(dir), backup};
 } finally { await unlink(temp).catch(() => {}); await release(); }
}
