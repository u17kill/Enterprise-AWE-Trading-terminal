// @vitest-environment node
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {defaultNotes} from '../../../lib/notes-document';
import {GET, POST} from './route';
let dir: string;
const request = (body: unknown, headers: Record<string, string> = {}, url = 'http://localhost:3000/api/notes') => new Request(url, {method: 'POST', headers: {'content-type': 'application/json', ...headers}, body: JSON.stringify(body)});
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'awe-notes-api-')); vi.stubEnv('AWE_NOTES_DATA_DIR', dir); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(dir, {recursive: true, force: true}); });
describe('notes API', () => {
 it('returns uncached defaults and persists a valid same-origin POST', async () => {
  const initial = await GET(new Request('http://localhost:3000/api/notes'));
  expect(initial.headers.get('cache-control')).toBe('no-store');
  expect((await initial.json()).revision).toBe('missing');
  const response = await POST(request({notes: defaultNotes(), revision: 'missing'}, {origin: 'http://localhost:3000'}));
  expect(response.status).toBe(200);
  const saved = await response.json();
  expect(saved.ok).toBe(true);
  expect((await (await GET(new Request('http://localhost:3000/api/notes'))).json()).revision).toBe(saved.revision);
 });
 it('returns 400 for invalid JSON, invalid notes, and absent revisions', async () => {
  expect((await POST(new Request('http://localhost/api/notes', {method: 'POST', body: '{'}))).status).toBe(400);
  expect((await POST(request({notes: {schemaVersion: 1}, revision: 'missing'}))).status).toBe(400);
  expect((await POST(request({notes: defaultNotes()}))).status).toBe(400);
 });
 it('uses browser Host when Next normalizes the internal URL to localhost',async()=>{
  const body={notes:defaultNotes(),revision:'missing'};
  expect((await POST(request(body,{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}))).status).toBe(200);
  expect((await POST(request(body,{host:'evil.test',origin:'http://evil.test'}))).status).toBe(403);
  expect((await POST(request(body,{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3001'}))).status).toBe(403);
 });
 it('rejects foreign hosts and origins, including invalid and different-scheme origins', async () => {
  const body = {notes: defaultNotes(), revision: 'missing'};
  for (const headers of ([{origin: 'http://evil.test'}, {origin: 'invalid'}, {origin: 'https://localhost:3000'}, {'sec-fetch-site': 'cross-site'}] as Record<string, string>[])) expect((await POST(request(body, headers))).status).toBe(403);
  expect((await POST(request(body, {}, 'http://evil.test/api/notes'))).status).toBe(403);
 });
 it('limits actual UTF8 bytes even without a Content-Length header', async () => {
  const huge = request({notes: {title: '中'.repeat(800000)}});
  expect((await POST(huge)).status).toBe(413);
  expect((await POST(request({}, {'content-length': String(2 * 1024 * 1024 + 1)}))).status).toBe(413);
 });
 it('returns 409 without replacing the file when a version is stale', async () => {
  await POST(request({notes: defaultNotes(), revision: 'missing'}));
  const original = await readFile(join(dir, 'notes.json'));
  const response = await POST(request({notes: {...defaultNotes(), title: 'stale'}, revision: 'missing'}));
  expect(response.status).toBe(409);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await readFile(join(dir, 'notes.json'))).toEqual(original);
 });
 it('returns 429 for a live writer and 500 for damaged source bytes', async () => {
  const lock = join(dir, 'notes.json.lock');
  await writeFile(lock, JSON.stringify({pid: process.pid, token: randomUUID()}));
  expect((await POST(request({notes: defaultNotes(), revision: 'missing'}))).status).toBe(429);
  await rm(lock);
  await writeFile(join(dir, 'notes.json'), 'broken');
  expect((await GET(new Request('http://localhost:3000/api/notes'))).status).toBe(500);
  expect((await POST(request({notes: defaultNotes(), revision: 'missing'}))).status).toBe(500);
  expect(await readFile(join(dir, 'notes.json'), 'utf8')).toBe('broken');
 });
 it('returns 503 for unavailable storage', async () => {
  await writeFile(join(dir, 'blocked'), 'not a directory');
  vi.stubEnv('AWE_NOTES_DATA_DIR', join(dir, 'blocked', 'nested'));
  expect((await POST(request({notes: defaultNotes(), revision: 'missing'}))).status).toBe(503);
 });
});

 it('returns the complete failure snapshot contract on invalid input',async()=>{
 const response=await POST(request({}));expect(await response.json()).toMatchObject({ok:false,notes:null,revision:'',updatedAt:null,warnings:[]});
 });

 it('guards private reads against hostile hosts, foreign origins and cross-site requests',async()=>{
 await POST(request({notes:{...defaultNotes(),privateExample:'private example'},revision:'missing'}));
 for(const headers of [{host:'evil.test'},{origin:'http://evil.test'},{origin:'invalid'},{'sec-fetch-site':'cross-site'},{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3001'}] as Record<string,string>[]){
 const response=await GET(new Request('http://localhost:3000/api/notes',{headers}));expect(response.status).toBe(403);expect(await response.json()).toMatchObject({ok:false,notes:null});
 }
 expect((await GET(new Request('http://evil.test/api/notes'))).status).toBe(403);
 });
 it('permits normalized local reads using the browser Host and matching origin',async()=>{
 const response=await GET(new Request('http://localhost:3000/api/notes',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','sec-fetch-site':'same-origin'}}));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
 });
