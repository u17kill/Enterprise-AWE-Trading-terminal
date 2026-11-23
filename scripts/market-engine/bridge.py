"""Next.js JSON bridge. All writable data lives outside the source checkout."""
import contextlib
import json
import os
import sys
import tempfile
from pathlib import Path
import market

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get('AWE_PORTFOLIO_DATA_DIR', str(Path.home() / 'Documents/Codex/.awe-terminal-data')))
OUT = DATA / 'market'
OUT.mkdir(parents=True, exist_ok=True)
market.BASE = str(ROOT)
market.OUTDIR = str(OUT)
market.CFG = str(OUT / 'config.json')
market.CACHE = str(OUT / 'market.json')
market.BRIEF = str(OUT / 'brief.json')
market.MOF_CACHE = str(OUT / 'jgb_hist.csv')
market.MATRIX = str(DATA / 'portfolio-matrix.json')
market.SYMBOLS = str(ROOT / 'data/market/symbols.json')
market.SRC_LABEL['usDJI'] = 'DJI 指数'

def atomic(file, value):
    fd, temp = tempfile.mkstemp(dir=OUT, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as stream:
            json.dump(value, stream, ensure_ascii=False, allow_nan=False)
        os.replace(temp, file)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)

market.save_state = lambda value: atomic(market.CACHE, value)
market.save_config = lambda value: atomic(market.CFG, value)
original_load_config = market.load_config
def load_config():
    try:
        return original_load_config()
    except (json.JSONDecodeError, UnicodeDecodeError):
        # Do not overwrite a damaged user file with defaults.
        return json.loads((ROOT / 'data/market/default-config.json').read_text(encoding='utf-8-sig'))
market.load_config = load_config
if not Path(market.CFG).exists():
    market.save_config(json.loads((ROOT / 'data/market/default-config.json').read_text(encoding='utf-8-sig')))

# The reference mapping contains exceptions such as SKHY and BRK. Resolve these
# before generic ticker syntax, otherwise a valid but unrelated instrument can win.
derive = market.derive_code
def resolve(symbol):
    return market.load_symbols().get('map', {}).get(symbol) or derive(symbol)
market.derive_code = resolve

def dirty(state):
    if not state:
        return state
    hold = state.setdefault('holdings', {})
    hold['hold_dirty'] = int(Path(market.MATRIX).stat().st_mtime if Path(market.MATRIX).exists() else 0) > hold.get('matrix_mtime', 0)
    state['brief'] = market.load_brief(state.get('date'))
    return state

def main():
    action = sys.argv[1]
    if action == 'read':
        return {'ok': True, 'market': dirty(market.load())}
    if action == 'config':
        return {'ok': True, 'config': market.load_config()}
    if action == 'plan':
        cfg = market.load_config()
        asset_codes = [a['code'] for a in cfg['assets'] if a['kind'] == 'eq']
        codes = set(asset_codes + [w['code'] for w in cfg['watchlist']])
        for item in market.load_matrix().get('items', []):
            if item.get('status') not in ('held', 'add', 'watch'):
                continue
            hit = resolve(item.get('symbol'))
            if hit and hit.get('src') == 'tx':
                codes.add(hit['code'])
        return {'ok': True, 'codes': sorted(codes), 'assets': asset_codes}
    if action == 'save':
        payload = json.load(sys.stdin)
        cfg = market.load_config()
        if Path(market.CFG).exists():
            try:
                json.loads(Path(market.CFG).read_text(encoding='utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                raise ValueError('配置文件损坏，请先备份并修复，避免覆盖原清单')
        for key in ('assets', 'watchlist', 'sectors'):
            if key in payload:
                if not isinstance(payload[key], list):
                    raise ValueError(key + ' 必须是数组')
                cfg[key] = payload[key]
        for key in ('assets', 'watchlist'):
            codes = [x.get('code') for x in cfg[key]]
            if not all(isinstance(code, str) and code for code in codes) or len(set(codes)) != len(codes):
                raise ValueError(key + ' 代码不能为空或重复')
        if any(a.get('kind') not in ('eq','fu','fx','gi','cr','bd') for a in cfg['assets']):
            raise ValueError('不支持的资产类型')
        market.save_config(cfg)
        state = market.load()
        if state:
            market.save_state(market.apply_order(state, cfg))
        return {'ok': True, 'config': cfg}
    if action == 'search':
        return {'ok': True, 'items': market.search(sys.argv[2], sys.argv[3])}
    if action == 'brief':
        state = market.load() or {}
        brief = market.load_brief(state.get('date'))
        return {'ok': True, 'brief': brief, 'date': state.get('date'), 'changed': (state.get('brief') or {}).get('as_of') != brief.get('as_of')}
    if action == 'refresh':
        payload = json.load(sys.stdin)
        preferred = payload.get('quotes', {})
        minute_data = payload.get('minutes', {})
        original_quote = market.quote
        original_minute = market.minute
        def quote(codes):
            available = {c: preferred[c] for c in codes if c in preferred}
            rest = [c for c in codes if c not in available]
            if rest:
                available.update(original_quote(rest))
            for code in codes:
                date = preferred.get(code, {}).get('date')
                if code.startswith(('sh', 'sz', 'bj')) and date:
                    market._QUOTE_DATES.append(date)
            return available
        market.quote = quote
        market.minute = lambda code: minute_data[code] if code in minute_data else original_minute(code)
        state = market.build(save=False)
        state['provider_note'] = payload.get('provider_note', '公开来源')
        for asset in state['assets']:
            if asset['code'] in preferred:
                asset['src'] = 'Longbridge · ' + (market.SRC_LABEL.get(asset['code']) or asset['code'])
                asset['asof'] = preferred[asset['code']].get('timestamp')
        for row in state.get('watchlist', {}).get('rows', []):
            if row['code'] in preferred:
                row['src'] = 'Longbridge'
        for key in ('items', 'watching'):
            for row in state.get('holdings', {}).get(key, []):
                if row.get('code') in preferred:
                    row['src'] = 'Longbridge'
        expected = {a['code'] for a in market.load_config()['assets'] if a['kind'] != 'bd'}
        missing = expected - {a['code'] for a in state['assets']}
        if missing:
            raise RuntimeError('行情不完整，保留上次缓存；缺失：' + ', '.join(sorted(missing)))
        market.save_state(state)
        return {'ok': True, 'market': dirty(state), 'elapsed': state['elapsed']}
    raise ValueError('未知操作')

try:
    with contextlib.redirect_stdout(sys.stderr):
        result = main()
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
except Exception as error:
    print(json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=False))
    sys.exit(1)
