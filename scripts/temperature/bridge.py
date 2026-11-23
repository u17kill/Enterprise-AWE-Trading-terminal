"""Six independent pipelines, durable snapshots, no dependency on reference server."""
import contextlib
import datetime as dt
import html
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import pandas as pd
import indicator_core as core
import market_context
import us_etf
import valuation
import us_valuation
import sentiment
import us_senti
import hk_senti
import apac
import wsfeed
from locks import lease, BusyError

ROOT=Path(__file__).resolve().parents[2]
DATA=Path(os.environ.get('AWE_PORTFOLIO_DATA_DIR',str(Path.home()/'Documents/Codex/.awe-terminal-data')))/'temperature'
KINDS={'momentum':('oos/html_data.json','动能分析'),'valuation':('oos/valuation.json','估值分位'),'cn':('senti/sentiment.json','A股雷达'),'us':('us_senti/us_senti.json','美股雷达'),'hk':('hk_senti/hk_senti.json','港股全景'),'apac':('apac/apac.json','亚太温度')}
DATA.mkdir(parents=True,exist_ok=True)
original_run=subprocess.run
def provider_run(args,*positional,**kwargs):
    if not isinstance(args,(list,tuple)) or 'westock' not in str(args[0]).lower():return original_run(args,*positional,**kwargs)
    kwargs.setdefault('encoding','utf-8');kwargs.setdefault('errors','replace')
    with lease(DATA/'.provider.lock',wait=True):
        stamp=DATA/'.provider-last'
        try:gap=time.time()-float(stamp.read_text())
        except (OSError,ValueError):gap=2
        if gap<1.2:time.sleep(1.2-gap)
        try:return original_run(args,*positional,**kwargs)
        finally:stamp.write_text(str(time.time()))
subprocess.run=provider_run

def read(file,default=None):
    return json.loads(file.read_text(encoding='utf-8-sig')) if file.exists() else default

def atomic(file,value):
    file.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(dir=file.parent,suffix='.tmp')
    try:
        with os.fdopen(fd,'w',encoding='utf-8',newline='\n') as out:json.dump(value,out,ensure_ascii=False,allow_nan=False,separators=(',',':'))
        os.replace(tmp,file)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def configure(base):
    for folder in ('oos','us','senti','us_senti','hk_senti','apac'):(base/folder).mkdir(parents=True,exist_ok=True)
    market_context.DATA=str(base/'oos');market_context.CTX_PATH=str(base/'oos/market_ctx.csv')
    us_etf.DATA=str(base/'us');us_etf.BENCH_CACHE=str(base/'us/usSPY_bench.csv')
    sentiment.BASE=str(base.parent);sentiment.SENTI=str(base/'senti');sentiment.OUT_JSON=str(base/'senti/sentiment.json')
    sentiment.PULSE_CACHE=str(base/'senti/pulse_cache.json')
    for module,folder,name in ((us_senti,'us_senti','us_senti.json'),(hk_senti,'hk_senti','hk_senti.json'),(apac,'apac','apac.json')):
        module.BASE=str(base.parent);module.OUTDIR=str(base/folder);module.OUT_JSON=str(base/folder/name)
    us_senti.ARCHIVE=str(base/'us_senti/fng_archive.json')
    hk_senti.SHORT_ARCHIVE=str(base/'hk_senti/short_archive.json')
    apac.HSI_CACHE=str(base/'apac/hkHSI.csv')
    apac.BENCH=[('SPX','标普500',str(base/'apac/bench_SPX.csv')),('CSI300','沪深300',str(base/'apac/bench_CSI300.csv'))]

def clean(value):
    # Normalize NaN from numpy/pandas to explicit missing values.
    import math
    if isinstance(value,dict):return {str(k):clean(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [clean(v) for v in value]
    if isinstance(value,float) and not math.isfinite(value):return None
    return value

def snapshot(kind):
    saved=read(DATA/(kind+'.json'))
    if saved:
        saved['data']=normalize(kind,saved.get('data'))
        return saved
    value=read(DATA/KINDS[kind][0])
    return {'data':normalize(kind,value),'updated':None,'origin':'导入的公开历史快照，尚未在本服务更新'}

def normalize(kind,value):
    if not value:return value
    if kind=='momentum':
        full=read(DATA/'oos/result_latest.json',{})
        for key,item in value.items():
            if 'historical_rank' not in item:
                scores=(full.get(key) or {}).get('series',{}).get('score') or []
                latest=item.get('last',{}).get('score')
                item['historical_rank']=round(sum(s<latest for s in scores)/len(scores)*100,1) if scores and latest is not None else None
    if kind=='cn' and 'gap' in value:
        value['gap']['concl']='仅陈述当日广度与板块状态，需结合后续交易日观察。'
        value['gap']['rule']='观察涨停家数与上涨占比是否同时处于低位；本页不据此设定仓位。'
    if kind=='hk' and not value.get('short',{}).get('n'):
        value.setdefault('short',{}).update({'degraded':True,'reason':'本次未取到沽空读数，不能解释为没有沽空','ratio':None})
    return value

def validate(kind,value):
    if not isinstance(value,dict) or not value:raise ValueError('没有有效数据，保留上次快照')
    if kind=='momentum':
        if len(value)!=8 or any(v.get('last',{}).get('score') is None for v in value.values()):raise ValueError('八个动能标的尚未全部具备有效分数')
    elif kind=='valuation':
        if not any(v.get('pe_stats') for v in value.values()):raise ValueError('未取得有效估值历史')
    elif kind=='cn':
        if not value.get('breadth',{}).get('total'):raise ValueError('全市场广度缺失，不把未获取当作零')
    elif kind in ('us','hk'):
        if not value.get('universe',{}).get('total'):raise ValueError('成分股行情未取到')
    elif not value.get('markets'):raise ValueError('五地指数均未取到')

def momentum(stage):
    warnings=[]
    try:ctx=market_context.fetch(start='2021-01-01')
    except Exception as error:
        ctx=market_context.load();warnings.append('市场背景更新失败，使用有日期缓存或标记legacy：'+str(error))
    results={};packed={}
    for name,code,slug in [('科创50','sh000688','kc50'),('创业板指','sz399006','cyb'),('沪深300','sh000300','hs300'),('中证红利','sh000922','zzhl')]:
        df=core.parse_westock(wsfeed.kline(code,'2021-01-01',dt.date.today().isoformat()))
        if len(df)<300:raise ValueError(name+' 日线不足300根')
        if ctx is not None:df=df.merge(ctx[[c for c in ('date','amt_all','lev','rz_buy') if c in ctx.columns]],on='date',how='left')
        df.to_csv(stage/'oos'/f'{slug}.csv',index=False)
        results[name]=core.run(name,df);packed[name]=core.pack(results[name])
    for name in ('QQQ','SOXX','标普500','道琼斯'):
        try:df=us_etf.fetch(name)
        except Exception as error:
            df=us_etf.load(name);warnings.append(name+' 更新失败，使用原日期缓存：'+str(error))
            if df is None:raise
        df.to_csv(us_etf.path_of(name),index=False)
        results[name]=core.run(name,df);packed[name]=core.pack(results[name])
    for name,item in packed.items():
        scores=results[name]['series']['score']
        item['historical_rank']=round(sum(s<item['last']['score'] for s in scores)/len(scores)*100,1)
    atomic(stage/'oos/result_latest.json',clean(results));atomic(stage/'oos/html_data.json',clean(packed))
    return packed,warnings

def compute_refresh(kind):
    start=time.time()
    archive={'us':'us_senti/fng_archive.json','hk':'hk_senti/short_archive.json'}.get(kind)
    previous_archive=read(DATA/archive,{}) if archive else None
    if archive and not isinstance(previous_archive,dict):raise ValueError('本地历史归档损坏，请先修复；拒绝覆盖')
    with tempfile.TemporaryDirectory(prefix='awe-temperature-') as temp:
        stage=Path(temp)/'data';shutil.copytree(DATA,stage,ignore=shutil.ignore_patterns('*.lock','.provider-last','*.tmp'))
        configure(stage)
        warnings=[]
        if kind=='momentum':value,warnings=momentum(stage)
        elif kind=='valuation':
            value=valuation.fetch_all();value.update(us_valuation.fetch_all())
            old=snapshot(kind).get('data') or {}
            for key in ('科创50','创业板指','沪深300','中证红利','QQQ','SOXX','标普500'):
                if key not in value:
                    value[key]=old.get(key) or {'name':key,'missing':True,'basis':'未获取','reason':'本次未取得此标的同口径估值历史，请稍后重试'}
                    warnings.append(key+' 本次未取到，已有历史保留原日期；无历史时明确显示未获取')
            atomic(stage/'oos/valuation.json',clean(value))
        else:
            module={'cn':sentiment,'us':us_senti,'hk':hk_senti,'apac':apac}[kind]
            if kind=='apac':
                for key,code,seed in [('SPX','usIVV',stage/'us/usIVV.csv'),('CSI300','sh000300',stage/'oos/hs300.csv')]:
                    path=stage/'apac'/('bench_'+key+'.csv')
                    if not path.exists() and seed.exists():shutil.copy2(seed,path)
                    try:
                        cached=pd.read_csv(path) if path.exists() else None
                        start_date=(pd.Timestamp(cached.date.iloc[-1])-pd.Timedelta(days=12)).strftime('%Y-%m-%d') if cached is not None and len(cached)>=150 else '2021-01-01'
                        text=wsfeed.kline(code,start_date,dt.date.today().isoformat(),strict=False)
                        fresh=(us_etf.parse(text) if key=='SPX' else core.parse_westock(text))[['date','close']]
                        if fresh.empty:raise ValueError('基准日线为空')
                        joined=pd.concat([cached[['date','close']],fresh],ignore_index=True) if cached is not None else fresh
                        joined=joined.drop_duplicates('date',keep='last').sort_values('date')
                        joined.to_csv(path,index=False)
                    except Exception as error:warnings.append(key+' 基准更新未完成；末日未覆盖的比较不展示：'+str(error))
            value=module.build()
            if kind=='cn':value['sector_fetched_at']=dt.datetime.now().isoformat(timespec='seconds')
            value=normalize(kind,value)
            module.save(clean(value))
        value=clean(value);validate(kind,value)
        if archive:
            next_archive=read(stage/archive,{})
            if not isinstance(next_archive,dict) or not set(previous_archive).issubset(next_archive):raise ValueError('历史归档不完整，保留原快照与归档')
        # Publish only this channel's caches/archives, never another channel's result.
        folders={'momentum':['oos','us'],'valuation':[],'cn':['senti'],'us':['us_senti'],'hk':['hk_senti'],'apac':['apac']}[kind]
        for folder in folders:
            for file in (stage/folder).glob('*'):
                if not file.is_file() or (kind=='momentum' and file.name=='valuation.json'):continue
                target=DATA/folder/file.name;target.parent.mkdir(parents=True,exist_ok=True)
                if archive and target==DATA/archive and target.exists():shutil.copy2(target,str(target)+'.bak')
                fd,tmp=tempfile.mkstemp(dir=target.parent);os.close(fd)
                try:shutil.copy2(file,tmp);os.replace(tmp,target)
                finally:
                    if os.path.exists(tmp):os.unlink(tmp)
        if kind=='valuation':atomic(DATA/'oos/valuation.json',value)
        result={'data':value,'updated':dt.datetime.now().isoformat(timespec='seconds'),'elapsed':round(time.time()-start,1),'warnings':warnings,'origin':'本服务已更新'}
        atomic(DATA/(kind+'.json'),result)
        return result

def refresh(kind):
    with lease(DATA/('.'+kind+'.lock')):
        return compute_refresh(kind)

def escaped(value):
    if isinstance(value,str):return html.escape(value,quote=True).replace('`','&#96;')
    if isinstance(value,dict):return {k:escaped(v) for k,v in value.items()}
    if isinstance(value,list):return [escaped(v) for v in value]
    return value

def document(kind,offline=False):
    panes=(ROOT/'scripts/temperature/panes.html').read_text(encoding='utf-8')
    payload={k:escaped(snapshot(k).get('data')) for k in KINDS}
    selected=list(KINDS).index(kind)+1
    encoded=json.dumps({'kind':kind,'pane':selected,'payload':payload},ensure_ascii=False).replace('<','\\u003c')
    head='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+KINDS[kind][1]+'</title>'
    data='<script id="temperature-snapshot" type="application/json">'+encoded+'</script>'
    if not offline:
        return '<!doctype html><html lang="zh-CN"><head>'+head+'<link rel="stylesheet" href="/temperature/reference.css"><link rel="stylesheet" href="/temperature/theme.css"></head><body><main id="temperature-document">'+panes+'</main>'+data+'<script src="/vendor/echarts-5.5.0.min.js"></script><script src="/temperature/render.js"></script><script src="/temperature/bootstrap.js"></script></body></html>'
    styles='\n'.join((ROOT/'public/temperature'/name).read_text(encoding='utf-8') for name in ('reference.css','theme.css'))
    scripts='\n'.join((ROOT/'public'/name).read_text(encoding='utf-8') for name in ('vendor/echarts-5.5.0.min.js','temperature/render.js','temperature/bootstrap.js'))
    nav='<nav class="offline-nav">'+''.join('<button data-temperature="%s">%s</button>'%(key,value[1]) for key,value in KINDS.items())+'</nav>'
    offline_script="document.querySelectorAll('[data-temperature]').forEach(b=>b.onclick=()=>window.postMessage({type:'temperature-data',kind:b.dataset.temperature},'*'));document.querySelectorAll('.sbar button').forEach(b=>b.onclick=()=>alert('当前为离线快照，无法刷新。请访问本机网站的对应页面更新数据。'));"
    return '<!doctype html><html lang="zh-CN"><head>'+head+'<style>'+styles+'.sbar .r{display:flex}.offline-nav{display:flex;gap:10px;flex-wrap:wrap;padding:15px}body{padding:15px}.offline-nav button{padding:9px;border:1px solid #dce7f3;border-radius:7px;background:white;color:#245d94}</style></head><body>'+nav+'<main id="temperature-document">'+panes+'</main>'+data+'<script>'+scripts.replace('</script','<\\/script')+'\n'+offline_script+'</script></body></html>'

def main():
    try:
        action=sys.argv[1];kind=sys.argv[2]
        if kind not in KINDS:raise ValueError('未知温度页面')
        with contextlib.redirect_stdout(sys.stderr):
            result={'html':document(kind,action=='offline')} if action in ('document','offline') else refresh(kind) if action=='refresh' else snapshot(kind)
        print(json.dumps({'ok':True,**result},ensure_ascii=False,allow_nan=False))
        return 0
    except Exception as error:
        print(json.dumps({'ok':False,'error':str(error),'status':429 if isinstance(error,BusyError) else 500},ensure_ascii=False));return 1

if __name__=='__main__':
    raise SystemExit(main())
