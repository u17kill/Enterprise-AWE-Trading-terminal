import 'server-only';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { getSession, hasLongbridgeToken, callLongbridgeTool } from './longbridge-mcp';
import { longbridgeCookieName } from './longbridge-cookie';

export async function marketCommand(action: string, args: string[] = [], body?: unknown): Promise<Record<string, unknown>> {
  const python = process.env.AWE_MARKET_PYTHON || join(process.cwd(), '.local/market-venv/Scripts/python.exe');
  return new Promise((resolve, reject) => {
    const proc = spawn(python, [join(process.cwd(), 'scripts/market-engine/bridge.py'), action, ...args], { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => { proc.kill(); reject(new Error('行情请求超时，已保留上次缓存')); }, 180_000);
    proc.stdout.on('data', chunk => { stdout += chunk; });
    proc.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
    proc.on('error', () => { clearTimeout(timer); reject(new Error('行情运行环境未就绪，请配置 AWE_MARKET_PYTHON')); });
    proc.on('close', () => { clearTimeout(timer); try { resolve(JSON.parse(stdout)); } catch { reject(new Error(stderr || '行情服务未返回有效数据')); } });
    proc.stdin.end(body === undefined ? '' : JSON.stringify(body));
  });
}

const state = globalThis as typeof globalThis & { aweMarketBusy?: boolean };
function longbridgeCode(code: string) {
  if (code === 'usDJI') return '.DJI.US';
  if (/^us[A-Z][A-Z.\-]*$/.test(code)) return code.slice(2) + '.US';
  if (/^(sh|sz)\d{6}$/.test(code)) return `${code.slice(2)}.${code.slice(0,2).toUpperCase()}`;
  if (/^hk\d{5}$/.test(code)) return `${Number(code.slice(2))}.HK`;
  if (code === 'hkHSI') return 'HSI.HK';
  if (code === 'hkHSTECH') return 'HSTECH.HK';
  return null;
}
async function preferredQuotes(request: Request) {
  const next = new NextRequest(request.url, { headers: request.headers });
  const session = getSession(next.cookies.get(longbridgeCookieName(next))?.value);
  const quotes: Record<string, unknown> = {}, minutes: Record<string, unknown> = {};
  if (!session || !hasLongbridgeToken(session)) return { quotes, minutes, provider_note: '未连接长桥，使用公开来源补充' };
  const plan = await marketCommand('plan');
  const codes = (plan.codes as string[]).filter(code => longbridgeCode(code));
  const bySymbol = new Map(codes.map(code => [longbridgeCode(code), code]));
  try {
    for (let start = 0; start < codes.length; start += 100) {
      const raw = await callLongbridgeTool(session, 'quote', { symbols: codes.slice(start,start+100).map(longbridgeCode) });
      if (!Array.isArray(raw)) continue;
      for (const entry of raw) {
        const code = bySymbol.get(entry.symbol), price = Number(entry.last_done), prev = Number(entry.prev_close);
        if (!code || !Number.isFinite(price) || !Number.isFinite(prev) || prev <= 0 || typeof entry.timestamp !== 'string') continue;
        quotes[code] = { price, chg: (price / prev - 1) * 100, timestamp: entry.timestamp, date: entry.timestamp.slice(0,10), name: code };
      }
    }
    const assets = (plan.assets as string[]).filter(code => quotes[code]);
    for (let start = 0; start < assets.length; start += 4) await Promise.all(assets.slice(start,start+4).map(async code => {
      try {
        const raw = await callLongbridgeTool(session, 'intraday', { symbol: longbridgeCode(code) });
        if (Array.isArray(raw)) minutes[code] = raw.filter(p => Number.isFinite(Number(p.price))).map(p => [String(p.timestamp || ''), Number(p.price)]).filter((_,i,all) => i === all.length-1 || i % Math.max(1, Math.ceil(all.length / 139)) === 0);
      } catch { minutes[code] = []; }
    }));
    return { quotes, minutes, provider_note: '长桥优先；未覆盖或未返回的品种由公开来源补充' };
  } catch { return { quotes, minutes, provider_note: '长桥部分请求失败，已使用公开来源补充' }; }
}
export async function marketResponse(action: string, request: Request, lock = false) {
  if (state.aweMarketBusy && lock) return Response.json({ ok: false, error: '市场总览正在更新中' }, { status: action === 'brief' ? 503 : 429 });
  if (lock) state.aweMarketBusy = true;
  try {
    const url = new URL(request.url);
    const body = action === 'save' ? await request.json() : action === 'refresh' ? await preferredQuotes(request) : undefined;
    const result = await marketCommand(action, action === 'search' ? [url.searchParams.get('q') || '', url.searchParams.get('kind') || 'stock'] : [], body);
    return Response.json(result, { status: result.ok ? 200 : action === 'save' ? 400 : action === 'search' ? 200 : 500 });
  } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : '请求失败' }, { status: 500 }); }
  finally { if (lock) state.aweMarketBusy = false; }
}
