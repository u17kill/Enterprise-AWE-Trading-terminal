import 'server-only';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

type Result = { ok: boolean; error?: string; html?: string; score?: unknown; attempt?: unknown };
export function runAssetDirection(action: string): Promise<Result> {
  return new Promise((resolve,reject) => {
    const python = process.env.AWE_MARKET_PYTHON || join(process.cwd(), '.local/market-venv/Scripts/python.exe');
    const child = spawn(python,[join(process.cwd(),'scripts/asset-direction/bridge.py'),action],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
    let output='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('更新超时，保留上次评分，请稍后重试'));},150_000);
    child.stdout.on('data',chunk=>{output+=chunk;});
    child.stderr.resume();
    child.on('error',()=>{clearTimeout(timer);reject(new Error('资产风向运行环境未就绪，请检查服务端解释器设置'));});
    child.on('close',()=>{clearTimeout(timer);try{resolve(JSON.parse(output));}catch{reject(new Error('资产风向未返回有效结果，已保留本机数据'));}});
  });
}
const locks=globalThis as typeof globalThis & {aweAssetDirectionBusy?:boolean};
export async function assetDirectionResponse(refresh=false) {
  if(refresh && locks.aweAssetDirectionBusy)return Response.json({ok:false,error:'资产风向正在更新中'},{status:429});
  if(refresh)locks.aweAssetDirectionBusy=true;
  try {const result=await runAssetDirection(refresh?'refresh':'read');return Response.json(result,{status:result.ok?200:502,headers:{'Cache-Control':'no-store'}});}
  catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'资产风向请求失败'},{status:500});}
  finally{if(refresh)locks.aweAssetDirectionBusy=false;}
}
