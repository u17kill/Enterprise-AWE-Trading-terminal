// @vitest-environment node
import {afterEach, describe, expect, it} from 'vitest';
import {mkdtemp, readFile, readdir, rm, mkdir, writeFile, utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {defaultNotes} from './notes-document';
import {readNotes, saveNotes, notesDataDirectory} from './notes-store';
const dirs: string[] = [];
async function temporary() { const dir = await mkdtemp(join(tmpdir(), 'awe-notes-test-')); dirs.push(dir); return dir; }
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, {recursive: true, force: true}))); });
describe('notes source file protection', () => {
 it('uses the configured external directory and leaves missing source files absent', async () => {
  const dir = await temporary();
  expect(notesDataDirectory()).toBeTruthy();
  const result = await readNotes(dir);
  expect(result).toMatchObject({ok: true, revision: 'missing', updatedAt: null, notes: defaultNotes()});
  expect(await readdir(dir)).toEqual([]);
 });
 it('saves UTF8 content, reads it after reload and backs up exact prior bytes', async () => {
  const dir = await temporary();
  const first = await saveNotes(defaultNotes(), 'missing', dir);
  const original = await readFile(join(dir, 'notes.json'));
  const changed = {...defaultNotes(), extra: '中文总纲\n第二段'};
  const second = await saveNotes(changed, first.revision, dir);
  expect((await readNotes(dir)).notes).toMatchObject({extra: changed.extra});
  expect(second.revision).not.toBe(first.revision);
  expect(second.updatedAt).toBeTruthy();
  expect(await readFile(join(dir, 'notes-backups', second.backup!))).toEqual(original);
  expect((await readdir(dir)).sort()).toEqual(['notes-backups', 'notes.json']);
 });
 it('refuses stale and invalid writes without changing the source or backups', async () => {
  const dir = await temporary();
  const first = await saveNotes(defaultNotes(), 'missing', dir);
  const bytes = await readFile(join(dir, 'notes.json'));
  await expect(saveNotes(defaultNotes(), 'missing', dir)).rejects.toMatchObject({code: 'CONFLICT'});
  await expect(saveNotes({...defaultNotes(), schemaVersion: 2} as never, first.revision, dir)).rejects.toMatchObject({code: 'VALIDATION'});
  expect(await readFile(join(dir, 'notes.json'))).toEqual(bytes);
  expect(await readdir(dir)).toEqual(['notes.json']);
 });
 it.each(['{broken', JSON.stringify({schemaVersion: 1})])('preserves a damaged source on reads and writes (%s)', async raw => {
  const dir = await temporary();
  await writeFile(join(dir, 'notes.json'), raw);
  await expect(readNotes(dir)).rejects.toMatchObject({code: 'CORRUPT'});
  await expect(saveNotes(defaultNotes(), 'missing', dir)).rejects.toMatchObject({code: 'CORRUPT'});
  expect(await readFile(join(dir, 'notes.json'), 'utf8')).toBe(raw);
 });
 it('does not replace the source when its required backup cannot be created', async () => {
  const dir = await temporary();
  const saved = await saveNotes(defaultNotes(), 'missing', dir);
  const original = await readFile(join(dir, 'notes.json'));
  await writeFile(join(dir, 'notes-backups'), 'blocked');
  await expect(saveNotes({...defaultNotes(), title: 'changed'}, saved.revision, dir)).rejects.toThrow();
  expect(await readFile(join(dir, 'notes.json'))).toEqual(original);
  expect(await readdir(dir)).not.toContain('notes.json.lock');
 });
 it('retains 40 notes backups without touching unrelated files', async () => {
  const dir = await temporary();
  let saved = await saveNotes(defaultNotes(), 'missing', dir);
  await mkdir(join(dir, 'notes-backups'));
  await writeFile(join(dir, 'notes-backups', 'portfolio-core.json-keep.json'), 'keep');
  for (let i = 0; i < 42; i++) saved = await saveNotes({...defaultNotes(), title: `Version ${i}`}, saved.revision, dir);
  const files = await readdir(join(dir, 'notes-backups'));
  expect(files.filter(name => name.startsWith('notes.json-'))).toHaveLength(40);
  expect(await readFile(join(dir, 'notes-backups', 'portfolio-core.json-keep.json'), 'utf8')).toBe('keep');
  expect((await readNotes(dir)).notes?.title).toBe('Version 41');
 });
 it('serializes simultaneous in-process saves and detects the stale second write', async () => {
  const dir = await temporary();
  const results = await Promise.allSettled([saveNotes(defaultNotes(), 'missing', dir), saveNotes({...defaultNotes(), title: 'second'}, 'missing', dir)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(result => result.status === 'rejected')).toMatchObject({reason: {code: 'CONFLICT'}});
 });
 it('never evicts a live writer based on lock age, and recovers after its process exits', async () => {
  const dir = await temporary();
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio: 'ignore', windowsHide: true});
  await once(child, 'spawn');
  const lock = join(dir, 'notes.json.lock');
  await writeFile(lock, JSON.stringify({pid: child.pid, token: randomUUID()}));
  await utimes(lock, new Date(0), new Date(0));
  try { await expect(saveNotes(defaultNotes(), 'missing', dir)).rejects.toMatchObject({code: 'BUSY'}); }
  finally { const ended = once(child, 'exit'); child.kill(); await ended; }
  expect((await saveNotes(defaultNotes(), 'missing', dir)).ok).toBe(true);
  expect(await readdir(dir)).toEqual(['notes.json']);
 });
 it('coordinates competing writers and stale-lock recovery in separate Node processes', async () => {
  const dir = await temporary(), modules = await temporary();
  const departed = spawn(process.execPath, ['-e', 'process.exit(0)'], {stdio: 'ignore', windowsHide: true});
  await once(departed, 'exit');
  await writeFile(join(dir, 'notes.json.lock'), JSON.stringify({pid: departed.pid, token: randomUUID()}));
  for (const name of ['notes-document', 'notes-store']) {
   const source = await readFile(join(process.cwd(), 'src', 'lib', name + '.ts'), 'utf8');
   await writeFile(join(modules, name + '.js'), ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText);
  }
  const program = `const {saveNotes}=require(${JSON.stringify(join(modules, 'notes-store.js'))});const {defaultNotes}=require(${JSON.stringify(join(modules, 'notes-document.js'))});saveNotes(defaultNotes(),'missing',${JSON.stringify(dir)}).then(()=>console.log('saved')).catch(e=>console.log(e.code));`;
  const run = () => new Promise<string>((resolve, reject) => {
   const child = spawn(process.execPath, ['-e', program], {windowsHide: true});
   let out = '', err = '';
   child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { err += chunk; });
   child.on('error', reject); child.on('exit', code => code === 0 ? resolve(out.trim()) : reject(new Error(err)));
  });
  const results = await Promise.all([run(), run()]);
  expect(results.filter(value => value === 'saved')).toHaveLength(1);
  expect(results.filter(value => value === 'BUSY' || value === 'CONFLICT')).toHaveLength(1);
  expect((await readNotes(dir)).ok).toBe(true);
 });
});

 it('preserves exact original text and unknown metadata while stamping only changed cards',async()=>{
 const dir=await temporary(),board=defaultNotes();board.custom={future:true};board.columns[0].future='lane';
 const body='  原文\n\t<hello> **text** 😀  ';
 board.columns[0].cards=[{id:'c-one',title:'',body,created:'fake',updated:'fake',extra:{keep:true}},{id:'c-two',title:'second',body:'',created:'fake',updated:'fake'}];
 const first=await saveNotes(board,'missing',dir);const cards=first.notes!.columns[0].cards;
 expect(cards[0].body).toBe(body);expect(cards[0].created).not.toBe('fake');expect(cards[0].updated).toBe(cards[0].created);
 expect(first.notes).toMatchObject({custom:{future:true},columns:[{future:'lane',cards:[{extra:{keep:true}},{}]},{},{}]});
 const changed=structuredClone(first.notes!);changed.updated='fake';changed.columns[0].cards[0].body+=' edit';changed.columns[0].cards[0].created='forged';changed.columns[0].cards[1].updated='forged';
 await new Promise(resolve=>setTimeout(resolve,10));
 const second=await saveNotes(changed,first.revision,dir);
 expect(second.notes!.updated).not.toBe('fake');expect(second.notes!.columns[0].cards[0].created).toBe(cards[0].created);expect(second.notes!.columns[0].cards[0].updated).not.toBe(cards[0].updated);expect(second.notes!.columns[0].cards[1].updated).toBe(cards[1].updated);
 const moved=structuredClone(second.notes!);moved.columns[1].cards.push(moved.columns[0].cards.shift()!);await new Promise(resolve=>setTimeout(resolve,10));
 const third=await saveNotes(moved,second.revision,dir);expect(third.notes!.columns[1].cards[0].updated).not.toBe(second.notes!.columns[0].cards[0].updated);
 });
 it('keeps an intentionally empty board empty and captures writes before async work',async()=>{
 const dir=await temporary(),board=defaultNotes();board.columns=[];const pending=saveNotes(board,'missing',dir);board.columns=defaultNotes().columns;await pending;expect((await readNotes(dir)).notes!.columns).toEqual([]);
 });
