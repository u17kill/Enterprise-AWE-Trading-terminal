import 'server-only';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
export const temperatureKinds=['momentum','valuation','cn','us','hk','apac'] as const;
export type TemperatureKind=typeof temperatureKinds[number];
export function isTemperatureKind(value:string):value is TemperatureKind{return temperatureKinds.includes(value as TemperatureKind);}
type Result={ok:boolean;error?:string;status?:number;html?:string;data?:unknown;updated?:string;elapsed?:number;origin?:string;warnings?:string[]};
export function temperatureCommand(action:string,kind:TemperatureKind):Promise<Result>{return new Promise((resolve,reject)=>{
 const python=process.env.AWE_MARKET_PYTHON||join(process.cwd(),'.local/market-venv/Scripts/python.exe');
 const child=spawn(python,[join(process.cwd(),'scripts/temperature/bridge.py'),action,kind],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});let output='';
 const timer=setTimeout(()=>{child.kill();reject(new Error('取数超时，已保留上次结果。请稍后重试'));},600_000);
 child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.resume();
 child.on('error',()=>{clearTimeout(timer);reject(new Error('温度运行环境未就绪，请检查服务端解释器'));});
 child.on('close',()=>{clearTimeout(timer);try{resolve(JSON.parse(output));}catch{reject(new Error('未返回有效结果，已保留本机数据'));}});
});}
const locks=globalThis as typeof globalThis&{aweTemperatureLocks?:Set<string>};
export async function temperatureResponse(kind:string,refresh=false){
 if(!isTemperatureKind(kind))return Response.json({ok:false,error:'未知温度页面'},{status:404});
 const busy=locks.aweTemperatureLocks??=new Set();
 if(refresh&&busy.has(kind))return Response.json({ok:false,error:'本页正在更新中'},{status:429});
 if(refresh)busy.add(kind);
 try{const result=await temperatureCommand(refresh?'refresh':'read',kind);const key={momentum:'data',valuation:'val',cn:'senti',us:'us',hk:'hk',apac:'apac'}[kind];return Response.json({...result,...(result.ok?{[key]:result.data,persisted:true}:{})},{status:result.ok?200:result.status===429?429:500,headers:{'Cache-Control':'no-store, no-cache, must-revalidate'}});}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'请求失败'},{status:500});}
 finally{if(refresh)busy.delete(kind);}
}
