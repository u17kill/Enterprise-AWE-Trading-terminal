import {createHash, randomUUID} from 'node:crypto';
import {link, mkdir, open, readFile, readdir, rename, unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';
import {defaultNotes, validateNotes, notesStats, type NotesBoard, type NotesSnapshot} from './notes-document';

export const notesDataDirectory = () => process.env.AWE_NOTES_DATA_DIR || process.env.AWE_PORTFOLIO_DATA_DIR || join(homedir(), 'Documents', 'Codex', '.awe-terminal-data');
export class NotesStoreError extends Error {
 constructor(public readonly code: 'VALIDATION' | 'CONFLICT' | 'BUSY' | 'CORRUPT' | 'TOO_LARGE', message: string) { super(message); }
}
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const filename = 'notes.json';
const queues = new Map<string, Promise<unknown>>();

async function source(dir: string): Promise<{snapshot: NotesSnapshot; bytes: Buffer | null}> {
 let file;
 try { file = await open(join(dir, filename), 'r'); }
 catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {snapshot: {ok: true, notes: defaultNotes(), revision: 'missing', updatedAt: null, warnings: [], stats: notesStats(defaultNotes())}, bytes: null};
  throw error;
 }
 try {
  if ((await file.stat()).size > 2 * 1024 * 1024) throw new NotesStoreError('TOO_LARGE', '笔记不能超过2MiB');
  const bytes = await file.readFile();
  let notes: unknown;
  try { notes = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { throw new NotesStoreError('CORRUPT', '笔记文件损坏，已保留原文件，请先恢复备份'); }
  if (validateNotes(notes).errors.length) throw new NotesStoreError('CORRUPT', '笔记文件格式无效，已保留原文件，请先恢复备份');
  return {snapshot: {ok: true, notes: notes as NotesBoard, revision: hash(bytes), updatedAt: (await file.stat()).mtime.toISOString(), warnings: validateNotes(notes).warnings, stats: notesStats(notes as NotesBoard), bytes: bytes.length}, bytes};
 } finally { await file.close(); }
}
export async function readNotes(dir = notesDataDirectory()): Promise<NotesSnapshot> { return (await source(dir)).snapshot; }

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
 if (depth > 8) throw new NotesStoreError('BUSY', '保存锁正在恢复，请稍后重试');
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
   catch { throw new NotesStoreError('BUSY', '保存锁格式无法识别，原文件未改动'); }
   if (alive(existing.pid)) throw new NotesStoreError('BUSY', '另一保存正在进行，请稍后重试');
   const releaseRecovery = await acquireLock(`${path}.recover-${existing.token}`, depth + 1);
   try {
    let current: string | null;
    try { current = await readFile(path, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; current = null; }
    if (current === observed) await unlink(path);
   } finally { await releaseRecovery(); }
  }
  throw new NotesStoreError('BUSY', '另一保存正在进行，请稍后重试');
 } finally { await unlink(prepared).catch(() => {}); }
}

export async function saveNotes(notes: NotesBoard, revision: string, dir = notesDataDirectory()): Promise<NotesSnapshot> {
 const {errors} = validateNotes(notes);
 if (errors.length) throw new NotesStoreError('VALIDATION', errors.join('；'));
 if (typeof revision !== 'string' || !revision) throw new NotesStoreError('VALIDATION', '缺少文件版本，请先读取文件');
 // Capture the caller's notes before entering the asynchronous queue.
 const content = JSON.stringify(notes, null, 2) + '\n';
 if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) throw new NotesStoreError('TOO_LARGE', '笔记不能超过2MiB');
 // User data lives outside the deployment; do not bundle the configured directory.
 const key = resolve(/* turbopackIgnore: true */ dir);
 const previous = queues.get(key) || Promise.resolve();
 const next = previous.catch(() => {}).then(() => writeNotes(content, revision, key));
 queues.set(key, next);
 try { return await next; }
 finally { if (queues.get(key) === next) queues.delete(key); }
}
async function writeNotes(content: string, revision: string, dir: string): Promise<NotesSnapshot> {
 await mkdir(dir, {recursive: true});
 const path = join(dir, filename);
 const release = await acquireLock(path + '.lock');
 const temp = `${path}.${randomUUID()}.tmp`;
 try {
  const old = await source(dir);
  if (old.snapshot.revision !== revision) throw new NotesStoreError('CONFLICT', '文件已改变，请选择使用文件版本或保留本机草稿');
  content = stampContent(content, old.snapshot.notes, new Date().toISOString());
  if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) throw new NotesStoreError('TOO_LARGE', '笔记不能超过2MiB');
  let backup: string | null = null;
  const backupDir = join(dir, 'notes-backups');
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
  // as failed. Only this notes's backup names are eligible for removal.
  if (backup) {
   const files = (await readdir(backupDir).catch(() => []))
    .filter(name => /^notes\.json-\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9-]{36}\.json$/.test(name)).sort().reverse();
   for (const name of files.slice(40)) await unlink(join(backupDir, name)).catch(() => {});
  }
  return {...await readNotes(dir), backup};
 } finally { await unlink(temp).catch(() => {}); await release(); }
}

function stampContent(content:string,previous:NotesBoard|null,now:string):string{
 const board=JSON.parse(content) as NotesBoard;board.updated=now;
 const oldCards=new Map<string,{card:NotesBoard['columns'][number]['cards'][number];column:string;index:number}>();
 previous?.columns.forEach(col=>col.cards.forEach((card,index)=>oldCards.set(card.id,{card,column:col.id,index})));
 board.columns.forEach(col=>col.cards.forEach((card,index)=>{const old=oldCards.get(card.id);
 if(!old){card.created=now;card.updated=now;}else{card.created=old.card.created;card.updated=old.card.title!==card.title||old.card.body!==card.body||old.column!==col.id||old.index!==index?now:old.card.updated;}
 }));return JSON.stringify(board,null,2)+'\n';
}
