// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
vi.mock('server-only', () => ({}));
import { escapeIntelligenceJson, intelligenceResponse } from './intelligence-server';

let temporary = '';
const original = process.env.AWE_INTELLIGENCE_DATA_DIR;
afterEach(async () => {
  if (original === undefined) delete process.env.AWE_INTELLIGENCE_DATA_DIR;
  else process.env.AWE_INTELLIGENCE_DATA_DIR = original;
  if (temporary) await rm(temporary, { recursive: true, force: true });
});
it('escapes executable markup and script separators in embedded source data', () => {
  const value = { title: '</script><script>&\u2028\u2029' };
  const escaped = escapeIntelligenceJson(value);
  expect(escaped).not.toMatch(/[<>&\u2028\u2029]/);
  expect(JSON.parse(escaped)).toEqual(value);
});
it('serves durable public data through the native bridge and numeric refresh contract', async () => {
  temporary = await mkdtemp(join(tmpdir(), 'awe-intelligence-api-'));
  process.env.AWE_INTELLIGENCE_DATA_DIR = temporary;
  const read = await intelligenceResponse('research');
  expect(read.status).toBe(200);
  expect(read.headers.get('cache-control')).toContain('no-store');
  expect((await read.json()).research.reports.length).toBeGreaterThan(0);
  const refresh = await intelligenceResponse('research', 'refresh');
  const result = await refresh.json();
  expect(refresh.status).toBe(200);
  expect(result.built).toBe(true);
  expect(typeof result.build_ms).toBe('number');
  expect(result.build_error).toBeNull();
}, 20000);
it('rejects an unknown intelligence channel', async () => {
  expect((await intelligenceResponse('portfolio')).status).toBe(404);
});
