import 'server-only';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const intelligenceKinds = ['news', 'wind', 'research', 'calendar', 'holdings'] as const;
export type IntelligenceKind = typeof intelligenceKinds[number];
type Result = { ok: boolean; status?: number; error?: string; [key: string]: unknown };
export function isIntelligenceKind(value: string): value is IntelligenceKind {
  return intelligenceKinds.includes(value as IntelligenceKind);
}
export function intelligenceCommand(action: string, kind: IntelligenceKind): Promise<Result> {
  return new Promise((resolve, reject) => {
    const python = process.env.AWE_INTELLIGENCE_PYTHON || process.env.AWE_MARKET_PYTHON || join(process.cwd(), '.local/market-venv/Scripts/python.exe');
    const child = spawn(python, [join(process.cwd(), 'scripts/intelligence/bridge.py'), action, kind], {
      windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('本次更新超时，已保留上次数据')); }, 600_000);
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); reject(new Error('情报运行环境未就绪，请检查服务端解释器')); });
    child.on('close', () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(output)); } catch { reject(new Error('情报服务未返回有效结果，已保留原数据')); }
    });
  });
}
const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };
export async function intelligenceResponse(kind: string, action = 'read') {
  if (!isIntelligenceKind(kind)) return Response.json({ ok: false, error: '未知情报页面' }, { status: 404, headers });
  try {
    const result = await intelligenceCommand(action, kind);
    return Response.json(result, { status: result.ok ? 200 : result.status || 500, headers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : '请求失败' }, { status: 500, headers });
  }
}
export function escapeIntelligenceJson(value: unknown) {
  return JSON.stringify(value ?? null).replace(/[<>&\u2028\u2029]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
export async function intelligenceDocument(kind: string) {
  if (!isIntelligenceKind(kind)) return new Response('未知情报页面', { status: 404 });
  const results = await Promise.all(intelligenceKinds.map(k => intelligenceCommand('read', k)));
  const names = ['NEWS', 'WIND', 'RPT', 'CAL', 'HLD'];
  const keys = ['news', 'wind', 'research', 'calendar', 'snapshot'];
  const selected = results[intelligenceKinds.indexOf(kind)];
  if (!selected.ok) return new Response(String(selected.error || '本页源数据暂不可用'), { status: 503, headers });
  const panes = await readFile(join(process.cwd(), 'scripts/intelligence/panes.html'), 'utf-8');
  const injected = results.map((r, i) => `let ${names[i]}=${escapeIntelligenceJson(r[keys[i]])};`).join('');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/intelligence/renderer.css"></head><body><main>${panes}</main><script>${injected}window.INTELLIGENCE_KIND=${escapeIntelligenceJson(kind)};</script><script src="/intelligence/renderer.js"></script></body></html>`;
  return new Response(html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",
  } });
}
