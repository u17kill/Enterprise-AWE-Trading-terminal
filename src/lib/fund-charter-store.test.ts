// @vitest-environment node
import {afterEach, describe, expect, it} from 'vitest';
import {mkdtemp, readFile, readdir, rm, mkdir, writeFile, utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {defaultCharter} from './fund-charter-document';
import {readCharter, saveCharter, charterDataDirectory} from './fund-charter-store';
const dirs: string[] = [];
async function temporary() { const dir = await mkdtemp(join(tmpdir(), 'awe-charter-test-')); dirs.push(dir); return dir; }
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, {recursive: true, force: true}))); });
describe('charter source file protection', () => {
 it('uses the configured external directory and leaves missing source files absent', async () => {
  const dir = await temporary();
  expect(charterDataDirectory()).toBeTruthy();
  const result = await readCharter(dir);
  expect(result).toMatchObject({ok: true, revision: 'missing', updatedAt: null, document: defaultCharter()});
  expect(await readdir(dir)).toEqual([]);
 });
 it('saves UTF8 content, reads it after reload and backs up exact prior bytes', async () => {
  const dir = await temporary();
  const first = await saveCharter(defaultCharter(), 'missing', dir);
  const original = await readFile(join(dir, 'fund-charter.json'));
  const changed = {...defaultCharter(), manifesto: '中文总纲\n第二段'};
  const second = await saveCharter(changed, first.revision, dir);
  expect((await readCharter(dir)).document).toEqual(changed);
  expect(second.revision).not.toBe(first.revision);
  expect(second.updatedAt).toBeTruthy();
  expect(await readFile(join(dir, 'backups', second.backup!))).toEqual(original);
  expect((await readdir(dir)).sort()).toEqual(['backups', 'fund-charter.json']);
 });
 it('refuses stale and invalid writes without changing the source or backups', async () => {
  const dir = await temporary();
  const first = await saveCharter(defaultCharter(), 'missing', dir);
  const bytes = await readFile(join(dir, 'fund-charter.json'));
  await expect(saveCharter(defaultCharter(), 'missing', dir)).rejects.toMatchObject({code: 'CONFLICT'});
  await expect(saveCharter({...defaultCharter(), schemaVersion: 2} as never, first.revision, dir)).rejects.toMatchObject({code: 'VALIDATION'});
  expect(await readFile(join(dir, 'fund-charter.json'))).toEqual(bytes);
  expect(await readdir(dir)).toEqual(['fund-charter.json']);
 });
 it.each(['{broken', JSON.stringify({schemaVersion: 1})])('preserves a damaged source on reads and writes (%s)', async raw => {
  const dir = await temporary();
  await writeFile(join(dir, 'fund-charter.json'), raw);
  await expect(readCharter(dir)).rejects.toMatchObject({code: 'CORRUPT'});
  await expect(saveCharter(defaultCharter(), 'missing', dir)).rejects.toMatchObject({code: 'CORRUPT'});
  expect(await readFile(join(dir, 'fund-charter.json'), 'utf8')).toBe(raw);
 });
 it('does not replace the source when its required backup cannot be created', async () => {
  const dir = await temporary();
  const saved = await saveCharter(defaultCharter(), 'missing', dir);
  const original = await readFile(join(dir, 'fund-charter.json'));
  await writeFile(join(dir, 'backups'), 'blocked');
  await expect(saveCharter({...defaultCharter(), title: 'changed'}, saved.revision, dir)).rejects.toThrow();
  expect(await readFile(join(dir, 'fund-charter.json'))).toEqual(original);
  expect(await readdir(dir)).not.toContain('fund-charter.json.lock');
 });
 it('retains 30 charter backups without touching unrelated files', async () => {
  const dir = await temporary();
  let saved = await saveCharter(defaultCharter(), 'missing', dir);
  await mkdir(join(dir, 'backups'));
  await writeFile(join(dir, 'backups', 'portfolio-core.json-keep.json'), 'keep');
  for (let i = 0; i < 32; i++) saved = await saveCharter({...defaultCharter(), title: `Version ${i}`}, saved.revision, dir);
  const files = await readdir(join(dir, 'backups'));
  expect(files.filter(name => name.startsWith('fund-charter.json-'))).toHaveLength(30);
  expect(await readFile(join(dir, 'backups', 'portfolio-core.json-keep.json'), 'utf8')).toBe('keep');
  expect((await readCharter(dir)).document?.title).toBe('Version 31');
 });
 it('serializes simultaneous in-process saves and detects the stale second write', async () => {
  const dir = await temporary();
  const results = await Promise.allSettled([saveCharter(defaultCharter(), 'missing', dir), saveCharter({...defaultCharter(), title: 'second'}, 'missing', dir)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(result => result.status === 'rejected')).toMatchObject({reason: {code: 'CONFLICT'}});
 });
 it('never evicts a live writer based on lock age, and recovers after its process exits', async () => {
  const dir = await temporary();
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio: 'ignore', windowsHide: true});
  await once(child, 'spawn');
  const lock = join(dir, 'fund-charter.json.lock');
  await writeFile(lock, JSON.stringify({pid: child.pid, token: randomUUID()}));
  await utimes(lock, new Date(0), new Date(0));
  try { await expect(saveCharter(defaultCharter(), 'missing', dir)).rejects.toMatchObject({code: 'BUSY'}); }
  finally { const ended = once(child, 'exit'); child.kill(); await ended; }
  expect((await saveCharter(defaultCharter(), 'missing', dir)).ok).toBe(true);
  expect(await readdir(dir)).toEqual(['fund-charter.json']);
 });
 it('coordinates competing writers and stale-lock recovery in separate Node processes', async () => {
  const dir = await temporary(), modules = await temporary();
  const departed = spawn(process.execPath, ['-e', 'process.exit(0)'], {stdio: 'ignore', windowsHide: true});
  await once(departed, 'exit');
  await writeFile(join(dir, 'fund-charter.json.lock'), JSON.stringify({pid: departed.pid, token: randomUUID()}));
  for (const name of ['fund-charter', 'fund-charter-document', 'fund-charter-store']) {
   const source = await readFile(join(process.cwd(), 'src', 'lib', name + '.ts'), 'utf8');
   await writeFile(join(modules, name + '.js'), ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText);
  }
  const program = `const {saveCharter}=require(${JSON.stringify(join(modules, 'fund-charter-store.js'))});const {defaultCharter}=require(${JSON.stringify(join(modules, 'fund-charter-document.js'))});saveCharter(defaultCharter(),'missing',${JSON.stringify(dir)}).then(()=>console.log('saved')).catch(e=>console.log(e.code));`;
  const run = () => new Promise<string>((resolve, reject) => {
   const child = spawn(process.execPath, ['-e', program], {windowsHide: true});
   let out = '', err = '';
   child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { err += chunk; });
   child.on('error', reject); child.on('exit', code => code === 0 ? resolve(out.trim()) : reject(new Error(err)));
  });
  const results = await Promise.all([run(), run()]);
  expect(results.filter(value => value === 'saved')).toHaveLength(1);
  expect(results.filter(value => value === 'BUSY' || value === 'CONFLICT')).toHaveLength(1);
  expect((await readCharter(dir)).ok).toBe(true);
 });
});
