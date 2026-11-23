"""Asset direction runs independently of market overview and portfolio data."""
import contextlib
import datetime
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path
import fetch
import score
import build

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get('AWE_PORTFOLIO_DATA_DIR', str(Path.home() / 'Documents/Codex/.awe-terminal-data'))) / 'asset-direction'
DATA.mkdir(parents=True, exist_ok=True)

def read(file, default=None):
    if not file.exists():
        return default
    return json.loads(file.read_text(encoding='utf-8-sig'))

def atomic(file, value, text=False):
    file.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(dir=file.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as stream:
            if text:
                stream.write(value)
            else:
                json.dump(value, stream, ensure_ascii=False, indent=1, allow_nan=False)
        os.replace(temp, file)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)

for name in ('policy_answers.json', 'notes.json'):
    if not (DATA / name).exists():
        atomic(DATA / name, read(ROOT / 'data/asset-direction' / name))

def validate(value):
    ids = [a['id'] for a in value['assets']]
    expanded = [key for group in value['groups'] for key in group['ids']]
    if ids != expanded or ids != [a[0] for a in score.ASSETS] or len(ids) != 14:
        raise ValueError('矩阵列与资产顺序不一致，拒绝发布')
    if len(value['indicators']) != 19:
        raise ValueError('指标数不是19项，拒绝发布')
    for mod in value['risk_appetite']['modules_used']:
        if value['modules'][mod]['weak']:
            raise ValueError('弱样本模块不得参与总分')

def render(directory=DATA):
    value = read(directory / 'score.json')
    if not value:
        return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><body>资产风向尚未生成，请点击“更新本页”获取数据并计算。</body></html>'
    validate(value)
    build.DATA = str(directory)
    body = build.render(embed=True)
    skin = '''
    :root{--bg:#f5f8fc;--card:#fff;--line:#dce7f3;--line2:#eaf0f7;--ink:#203950;--ink2:#61788e;--ink3:#8b9db1}
    body{background:#f5f8fc;margin:0;font:12px/1.7 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
    main{max-width:none;padding:0 0 24px}.card{border-radius:12px;box-shadow:0 3px 14px #244d7b04}.hero{border-top:3px solid #568ac3}
    .note{border-color:#dce7f3;background:#edf4fb;color:#61788e}.tbl{border-radius:10px;background:#fff}.sec-h{margin:0 0 20px}
    .sec-h h2{font-size:18px}.hnote{font-size:11px;color:#8094a9}h2{color:#254e75}td,th{font-variant-numeric:tabular-nums}
    .big,.ascore,.score,.mscore{font-family:ui-monospace,Consolas,monospace}.agroup{margin-top:22px}.acard{padding:18px}
    .import-note{font-size:11px;color:#8193a7;margin:0 0 14px}.mscore{font-size:10px!important}.mrow{grid-template-columns:42px 55px minmax(50px,1fr) 72px 135px;gap:8px}.pdim summary{cursor:pointer;font-weight:600}.pdim li{line-height:1.8}
    @media(max-width:620px){.hero{padding:16px}.card{min-width:0}.sec-h{display:block}.hnote{margin-top:8px}.mrow{grid-template-columns:38px 45px minmax(45px,1fr) 75px;gap:6px}.mscore{display:none}}
    '''
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>资产风向 · Enterprise AWE</title><style>' + build.css(embed=True) + skin + '</style></head><body><main><p class="import-note">政策与笔记首次导入自提供的人工文件，保留其原始确认状态；确认状态不代表系统已逐条独立核验。每项观测日期与滞后见读数明细。资产价格来自 Yahoo：股票与商品使用美元计价 ETF 代理（中国 FXI、日本 EWJ、韩国 EWY、台湾 EWT、印度 INDA，不等同于本币指数）；美元项为美元指数。评分源为 FRED / CBOE，政策利率来自 BIS / 台湾央行。</p>' + body + '</main></body></html>'

def main():
    action = sys.argv[1]
    if action == 'document':
        return {'ok': True, 'html': render()}
    if action == 'read':
        value = read(DATA / 'score.json')
        if value:
            validate(value)
        return {'ok': True, 'score': value, 'attempt': read(DATA / 'last-attempt.json')}
    if action != 'refresh':
        raise ValueError('未知操作')
    with tempfile.TemporaryDirectory(prefix='awe-regime-', dir=DATA) as temp:
        stage = Path(temp)
        for name in ('policy_answers.json', 'notes.json'):
            shutil.copy2(DATA / name, stage / name)
        if (DATA / 'raw').exists():
            shutil.copytree(DATA / 'raw', stage / 'raw')
        fetch.DATA = str(stage)
        fetch.RAW = str(stage / 'raw')
        fetch.main()
        raw = read(stage / 'series.json')
        errors = raw.get('errors', [])
        atomic(DATA / 'last-attempt.json', {'fetched_at':raw['fetched_at'], 'errors': errors})
        if len(errors) > 3:
            raise ValueError('取数缺项超过3项，保留上次评分：' + '；'.join(e['id'] for e in errors))
        today = datetime.datetime.now(fetch.TZ).date()
        for key, series in {**raw.get('series', {}), **raw.get('prices', {})}.items():
            dates = series.get('dates') or []
            if dates and datetime.date.fromisoformat(dates[-1]) > today:
                raise ValueError(key + ' 包含未来观测日期，保留上次评分')
        score.DATA = str(stage)
        score.main()
        value = read(stage / 'score.json')
        validate(value)
        document = render(stage)  # Validate the shared rendering before publishing.
        if (stage / 'raw').exists():
            shutil.copytree(stage / 'raw', DATA / 'raw', dirs_exist_ok=True)
        atomic(DATA / 'series.json', raw)
        for snap in (stage / 'snapshot').glob('*.json'):
            atomic(DATA / 'snapshot' / snap.name, read(snap))
        atomic(DATA / 'score.json', value)
        atomic(DATA / 'asset-direction.html', document, text=True)
    return {'ok': True, 'score': value}

try:
    with contextlib.redirect_stdout(sys.stderr):
        result = main()
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
except Exception as error:
    print(json.dumps({'ok':False,'error':str(error)}, ensure_ascii=False))
    sys.exit(1)
