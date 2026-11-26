// @vitest-environment node
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {defaultCharter} from '../../../lib/fund-charter-document';
import {GET, PUT} from './route';
let dir: string;
const request = (body: unknown, headers: Record<string, string> = {}, url = 'http://localhost:3000/api/fund-charter') => new Request(url, {method: 'PUT', headers: {'content-type': 'application/json', ...headers}, body: JSON.stringify(body)});
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'awe-charter-api-')); vi.stubEnv('AWE_CHARTER_DATA_DIR', dir); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(dir, {recursive: true, force: true}); });
describe('charter API', () => {
 it('returns uncached defaults and persists a valid same-origin PUT', async () => {
  const initial = await GET();
  expect(initial.headers.get('cache-control')).toBe('no-store');
  expect((await initial.json()).revision).toBe('missing');
  const response = await PUT(request({document: defaultCharter(), revision: 'missing'}, {origin: 'http://localhost:3000'}));
  expect(response.status).toBe(200);
  const saved = await response.json();
  expect(saved.ok).toBe(true);
  expect((await (await GET()).json()).revision).toBe(saved.revision);
 });
 it('returns 400 for invalid JSON, invalid documents, and absent revisions', async () => {
  expect((await PUT(new Request('http://localhost/api/fund-charter', {method: 'PUT', body: '{'}))).status).toBe(400);
  expect((await PUT(request({document: {schemaVersion: 1}, revision: 'missing'}))).status).toBe(400);
  expect((await PUT(request({document: defaultCharter()}))).status).toBe(400);
 });
 it('uses browser Host when Next normalizes the internal URL to localhost',async()=>{
  const body={document:defaultCharter(),revision:'missing'};
  expect((await PUT(request(body,{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}))).status).toBe(200);
  expect((await PUT(request(body,{host:'evil.test',origin:'http://evil.test'}))).status).toBe(403);
  expect((await PUT(request(body,{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3001'}))).status).toBe(403);
 });
 it('rejects foreign hosts and origins, including invalid and different-scheme origins', async () => {
  const body = {document: defaultCharter(), revision: 'missing'};
  for (const headers of ([{origin: 'http://evil.test'}, {origin: 'invalid'}, {origin: 'https://localhost:3000'}, {'sec-fetch-site': 'cross-site'}] as Record<string, string>[])) expect((await PUT(request(body, headers))).status).toBe(403);
  expect((await PUT(request(body, {}, 'http://evil.test/api/fund-charter'))).status).toBe(403);
 });
 it('limits actual UTF8 bytes even without a Content-Length header', async () => {
  const huge = request({document: {title: '中'.repeat(400000)}});
  expect((await PUT(huge)).status).toBe(413);
  expect((await PUT(request({}, {'content-length': String(1024 * 1024 + 1)}))).status).toBe(413);
 });
 it('returns 409 without replacing the file when a version is stale', async () => {
  await PUT(request({document: defaultCharter(), revision: 'missing'}));
  const original = await readFile(join(dir, 'fund-charter.json'));
  const response = await PUT(request({document: {...defaultCharter(), title: 'stale'}, revision: 'missing'}));
  expect(response.status).toBe(409);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await readFile(join(dir, 'fund-charter.json'))).toEqual(original);
 });
 it('returns 429 for a live writer and 500 for damaged source bytes', async () => {
  const lock = join(dir, 'fund-charter.json.lock');
  await writeFile(lock, JSON.stringify({pid: process.pid, token: randomUUID()}));
  expect((await PUT(request({document: defaultCharter(), revision: 'missing'}))).status).toBe(429);
  await rm(lock);
  await writeFile(join(dir, 'fund-charter.json'), 'broken');
  expect((await GET()).status).toBe(500);
  expect((await PUT(request({document: defaultCharter(), revision: 'missing'}))).status).toBe(500);
  expect(await readFile(join(dir, 'fund-charter.json'), 'utf8')).toBe('broken');
 });
 it('returns 503 for unavailable storage', async () => {
  await writeFile(join(dir, 'blocked'), 'not a directory');
  vi.stubEnv('AWE_CHARTER_DATA_DIR', join(dir, 'blocked', 'nested'));
  expect((await PUT(request({document: defaultCharter(), revision: 'missing'}))).status).toBe(503);
 });
});
