"""Read-only intelligence bridge. Sources and jobs live outside the checkout."""
import contextlib
import datetime as dt
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import uuid
import shutil
import threading
import traceback

import news
import wind
import windfeed
import research
import econcal
import holdings
from locks import lease, BusyError

DATA = Path(os.environ.get('AWE_INTELLIGENCE_DATA_DIR', str(Path(os.environ.get(
    'AWE_PORTFOLIO_DATA_DIR', str(Path.home() / 'Documents/Codex/.awe-terminal-data'))) / 'intelligence')))
KINDS = ('news', 'wind', 'research', 'calendar', 'holdings')

def read(path, default=None):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else default

def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as out:
            json.dump(value, out, ensure_ascii=False, allow_nan=False)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)

def configure(base=None):
    base = Path(base or DATA) / 'data'
    for kind in KINDS: (base / kind).mkdir(parents=True, exist_ok=True)
    # Bootstrap public curated sources only. Runtime raw/feed remain external;
    # source data is never copied back and existing user updates always win.
    seed = Path(__file__).resolve().parents[2] / 'data/intelligence'
    with lease(base.parent / 'bootstrap.lock', wait=True):
        for kind in KINDS:
            for source in (seed / kind).glob('*.json'):
                if source.name in ('raw.json', 'feed.json'): continue
                target = base / kind / source.name
                if not target.exists(): shutil.copyfile(source, target)
    news.NEWS_DIR = str(base / 'news')
    news.RAW_FILE = str(base / 'news/raw.json')
    news.NEWS_FILE = str(base / 'news/news.json')
    wind.WIND_DIR = windfeed.WIND_DIR = str(base / 'wind')
    wind.WIND_FILE = str(base / 'wind/wind.json')
    windfeed.FEED_FILE = str(base / 'wind/feed.json')
    research.RPT_FILE = str(base / 'research/research.json')
    econcal.SRC = str(base / 'calendar/calendar.json')
    holdings.DATA = str(base / 'holdings')
    holdings.SNAP = str(base / 'holdings/holdings.json')
    return base

def payload(kind):
    if kind == 'news':
        d = news_snapshot()
        return {'ok': True, 'news': d}
    if kind == 'wind':
        d = wind.merge_parts(save=False)
        wind._attach_feed(d)
        errors, warnings = wind.validate(d, strict=False)
        if errors: raise ValueError('；'.join(errors[:5]))
        return {'ok': True, 'wind': wind._finalize(d), 'warnings': warnings}
    if kind == 'research':
        source = research.load()
        if source is None: raise ValueError('没有机构研报源文件')
        errors, warnings = research.validate(source, strict=False)
        if errors: raise ValueError('；'.join(errors[:5]))
        return {'ok': True, 'research': research.build(), 'updated': source.get('as_of'), 'warnings': warnings}
    if kind == 'calendar':
        errors, warnings = econcal.validate(econcal.load(econcal.SRC))
        d = econcal.build(econcal.SRC)
        return {'ok': not errors, 'calendar': d, 'errors': errors, 'warnings': warnings}
    snap = holdings.load()
    if snap:
        holdings.mark_stale(snap.get('insts', []))
        holdings_counts(snap)
    return {'ok': bool(snap), 'snapshot': snap}

def news_snapshot():
    if Path(news.RAW_FILE).exists():
        d = news.compose(save=False)
        d['sources'] = (read(Path(news.RAW_FILE), {}) or {}).get('sources', [])
        return d
    # A fresh checkout has the public rendered snapshot, not the machine raw pool.
    # Enforce the same seven-day boundary rather than making old headlines immortal.
    d = read(Path(news.NEWS_FILE))
    if not d or not isinstance(d.get('items'), list):
        return news.compose(save=False)
    now = news._now()
    cutoff = now - dt.timedelta(days=news.WIN_DAYS)
    old_count = len(d['items'])
    d['items'] = [i for i in d['items'] if (i.get('carry') and i.get('place') == 'top') or (news._ts(i.get('date')) and news._ts(i.get('date')) >= cutoff)]
    d['n_items'] = len(d['items'])
    d['n_top'] = sum(i.get('place') == 'top' for i in d['items'])
    d['n_auto'] = sum(bool(i.get('auto')) for i in d['items'])
    d['n_curated'] = d['n_items'] - d['n_auto']
    d.setdefault('n_drop', {})['raw'] = d.get('n_drop', {}).get('raw', 0) + old_count - d['n_items']
    d['window'] = {'top': [news._iso(cutoff), news._iso(now)], 'flow': [news._iso(cutoff), news._iso(now)], 'days': news.WIN_DAYS}
    brief = d.get('brief') or {}
    if brief.get('auto') or not news._ts(brief.get('as_of')) or now - news._ts(brief.get('as_of')) > dt.timedelta(hours=48):
        d['brief'] = news.auto_brief(d['items'], now=now)
    d['stats'], d['fresh'] = news.stats(d), news.freshness(d, ref=now)
    d['snapshot_origin'] = '已打包的公开页面快照；完整原料池尚未在本机建立，请按需更新新闻'
    return d

def holdings_counts(snap):
    rows = snap.get('insts', [])
    snap['n_inst'] = len(rows)
    snap['n_ok'] = sum(r.get('status') == 'ok' for r in rows)
    snap['n_carried'] = sum(r.get('status') == 'carried' for r in rows)
    snap['n_cached'] = snap['n_carried']
    snap['n_error'] = sum(r.get('status') == 'error' for r in rows)
    snap['n_failed'] = snap['n_carried'] + snap['n_error']
    return snap

def merge_holdings(fresh, previous):
    """Keep an institution's last successful filing when SEC cannot be reached."""
    old = {r['id']: r for r in (previous or {}).get('insts', [])}
    for i, rec in enumerate(fresh['insts']):
        cached = old.get(rec['id'])
        if rec.get('status') != 'ok' and cached and cached.get('holdings'):
            fresh['insts'][i] = {**cached, 'status': 'carried', 'carried': True, 'carried_period': cached.get('period'),
                                 'cached': True, 'keep_error': rec.get('error'), 'refresh_error': rec.get('error'),
                                 'last_success_at': cached.get('last_success_at') or (previous or {}).get('built_at'),
                                 'cache_note': '本次 SEC 核对失败，保留上次成功申报；报告期未改变'}
    return holdings_counts(fresh)

def wind_diff(d, old, out):
    stats = out.get('stats') or {}
    added = stats.get('added_by') or {}
    return {'people': d['n_people'] - old.get('n_people', 0),
            'points': d['n_points'] - old.get('n_points', 0),
            'feed': d['n_feed'] - old.get('n_feed', 0), 'n_feed': d['n_feed'],
            'n_feed_people': d['n_feed_people'], 'feed_fetched_at': d.get('feed_fetched_at'),
            'feed_latest': max([p.get('feed_date', '') for p in d['people']] or ['']),
            'latest': d.get('latest_point'), 'latest_before': old.get('latest_point'),
            'dropped': d.get('brief', {}).get('dropped', []),
            'new': stats.get('new', 0), 'added_by': added,
            'hit_people': stats.get('hit_people', 0), 'items': stats.get('items', 0),
            'total': stats.get('total', 0), 'nofeed': out.get('fail', []),
            'added_names': [{'cn': next((p['cn'] for p in d['people'] if p['id'] == pid), pid), 'n': n}
                            for pid, n in sorted(added.items(), key=lambda kv: -kv[1])]}

def refresh(kind, progress=lambda *_: None):
    started = time.monotonic()
    if kind == 'calendar': raise ValueError('日历为人工策展文件，没有网络刷新')
    if kind == 'news':
        raw, report = news.fetch(save=False)
        if not any(s.get('ok') for s in report):
            return {'ok': False, 'status': 502, 'error': '全部新闻源获取失败，已保留旧原料与快照',
                    'warning': '本次未取得新新闻', 'sources': report, 'built': False,
                    'build_ms': None, 'build_error': '全部新闻源获取失败', **{'news': payload('news')['news']}}
        atomic(Path(news.RAW_FILE), raw)
        d = news.compose(save=False)
        d['sources'] = report
        atomic(Path(news.NEWS_FILE), d)
        result = {'ok': True, 'news': d, 'fetched': {
            'n_pool': d.get('raw', {}).get('n_pool'), 'n_items': d.get('n_items'),
            'n_auto': d.get('n_auto'), 'n_curated': d.get('n_curated'), 'n_drop': d.get('n_drop'),
            'newest': d.get('fresh', {}).get('newest'), 'days': d.get('window', {}).get('days')}}
    elif kind == 'research': result = payload(kind)
    elif kind == 'wind':
        old = payload(kind)['wind']
        out = windfeed.run(write=False, progress=progress)
        if len(out.get('fail', [])) == out.get('stats', {}).get('total', 0):
            raise RuntimeError('所有人物检索均无新命中，已保留旧数据；不代表没有表态')
        atomic(Path(windfeed.FEED_FILE), out)
        result = payload(kind)
        result['diff'] = wind_diff(result['wind'], old, out)
    else:
        previous = holdings.load()
        snap = holdings.build(write=False, verbose=False, progress=progress)
        if not snap['n_ok']: raise RuntimeError('全部 SEC 核对失败，已保留上次完整快照')
        snap = merge_holdings(snap, previous)
        atomic(Path(holdings.SNAP), snap)
        result = {'ok': True, 'snapshot': snap}
    result.update(built=True, build_ms=int((time.monotonic() - started) * 1000),
                  build_error=None, elapsed=round(time.monotonic() - started, 2), persisted=True)
    return result

def job_path(kind): return DATA / 'jobs' / (kind + '.json')

def alive(pid):
    if not pid: return False
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes = (wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD))
        kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        handle = kernel.OpenProcess(0x1000, False, int(pid))
        if not handle: return False
        try:
            code = wintypes.DWORD()
            return bool(kernel.GetExitCodeProcess(handle, ctypes.byref(code))) and code.value == 259
        finally: kernel.CloseHandle(handle)
    try: os.kill(pid, 0); return True
    except OSError: return False

def progress_state(kind):
    state = read(job_path(kind), {'ok': True, 'running': False, 'done': 0, 'total': 0,
                                'failed': 0, 'phase': '', 'error': None, 'result': None, 'snapshot': None})
    if state.get('running') and not alive(state.get('pid')):
        state.update(running=False, error='更新进程已停止，已保留上次数据')
        atomic(job_path(kind), state)
    if kind == 'holdings' and state.get('snapshot'):
        holdings_counts(state['snapshot'])
    return state

def worker(kind, token):
    with lease(DATA / 'jobs' / (kind + '.lock')):
        state = read(job_path(kind), {})
        if state.get('token') != token: return
        state_lock = threading.RLock()
        stopping = threading.Event()
        def update(**values):
            with state_lock:
                state.update(values, heartbeat_at=dt.datetime.now().isoformat(timespec='seconds'))
                atomic(job_path(kind), state)
        def log(message):
            print('%s [%s pid=%s] %s' % (dt.datetime.now().isoformat(timespec='seconds'), kind, os.getpid(), message),
                  file=sys.stderr, flush=True)
        update(pid=os.getpid(), running=True)
        log('worker started token=' + token)
        def heartbeat():
            while not stopping.wait(15):
                update()
                log('heartbeat done=%s/%s current=%s phase=%s' %
                    (state.get('done'), state.get('total'), state.get('currentName', ''), state.get('phase', '')))
        threading.Thread(target=heartbeat, daemon=True).start()
        def cb(done, total, failed):
            update(done=done, total=total, failed=failed, phase='检索中' if kind == 'wind' else '核对中')
            log('progress %s/%s failed=%s' % (done, total, failed))
        original_fetch = holdings._fetch_one
        original_get = holdings._get
        def traced_fetch(inst):
            update(currentName=inst.get('name', ''), currentId=inst.get('id', ''), phase='核对 ' + inst.get('name', ''))
            log('institution begin id=%s name=%s cik=%s' % (inst.get('id'), inst.get('name'), inst.get('cik')))
            try: return original_fetch(inst)
            except BaseException:
                log('institution failed id=' + str(inst.get('id')))
                traceback.print_exc(file=sys.stderr)
                raise
        def traced_get(url, *args, **kwargs):
            began = time.monotonic()
            log('SEC request begin ' + url)
            try:
                raw = original_get(url, *args, **kwargs)
                log('SEC request done bytes=%s elapsed=%.2fs %s' % (len(raw), time.monotonic() - began, url))
                return raw
            except BaseException:
                log('SEC request failed elapsed=%.2fs %s' % (time.monotonic() - began, url))
                traceback.print_exc(file=sys.stderr)
                raise
        if kind == 'holdings':
            holdings._fetch_one = traced_fetch
            holdings._get = traced_get
        try:
            result = refresh(kind, cb)
            update(running=False, error=result.get('error'), result=result if kind == 'wind' else None,
                         snapshot=result.get('snapshot'), built=result.get('built'), build_ms=result.get('build_ms'),
                         build_error=result.get('build_error'), phase='完成')
            log('worker completed')
        except BaseException as exc:
            traceback.print_exc(file=sys.stderr)
            update(running=False, error=str(exc), build_ms=None, build_error=str(exc), phase='失败')
            log('worker failed: ' + str(exc))
        finally:
            stopping.set()
            holdings._fetch_one = original_fetch
            holdings._get = original_get

def wait_for_worker(child, kind, token, launcher_pid, timeout=10):
    """A Windows venv redirector PID need not equal Python's actual worker PID.

    The worker acknowledges ownership through our unique launch token and a
    changed, live PID. Fast jobs may already be completed before this check.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        latest = read(job_path(kind), {})
        if latest.get('token') == token:
            if not latest.get('running'): return
            owner = latest.get('pid')
            if owner != launcher_pid and alive(owner): return
        if child.poll() is not None: raise RuntimeError('更新进程启动失败，已保留旧数据')
        time.sleep(.03)
    raise RuntimeError('更新进程启动超时，已保留旧数据')

def start(kind):
    with lease(DATA / 'jobs' / (kind + '.launch.lock')):
        if progress_state(kind).get('running'): raise BusyError('本页正在更新中')
        token = uuid.uuid4().hex
        total = len(holdings.INSTS) if kind == 'holdings' else len(payload('wind')['wind']['people'])
        state = {'ok': True, 'running': True, 'done': 0, 'total': total, 'failed': 0,
                 'error': None, 'phase': '准备中', 'result': None, 'snapshot': None,
                 'token': token, 'pid': os.getpid(), 'started_at': dt.datetime.now().isoformat()}
        atomic(job_path(kind), state)
        log = open(DATA / 'jobs' / (kind + '.log'), 'a', encoding='utf-8')
        kwargs = {'stdin': subprocess.DEVNULL, 'stdout': log, 'stderr': log, 'close_fds': True}
        if os.name == 'nt': kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
        else: kwargs['start_new_session'] = True
        try:
            child = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), 'worker', kind, token], **kwargs)
            threading.Thread(target=child.wait, daemon=True).start()
            # Only the worker writes after launch. The launcher remains alive until
            # it acknowledges ownership, preventing a second launch in this gap.
            wait_for_worker(child, kind, token, os.getpid())
        finally: log.close()
        return {'ok': True, 'started': True, 'total': total}

def command(action, kind):
    if kind not in KINDS: return {'ok': False, 'status': 404, 'error': '未知情报页面'}
    if action == 'read': return payload(kind)
    if action == 'progress': return progress_state(kind)
    if action == 'refresh':
        if kind in ('wind', 'holdings'): return start(kind)
        with lease(DATA / 'jobs' / (kind + '.lock')): return refresh(kind)
    raise ValueError('未知操作')

if __name__ == '__main__':
    configure()
    try:
        with contextlib.redirect_stdout(sys.stderr):
            if sys.argv[1] == 'worker': worker(sys.argv[2], sys.argv[3]); result = None
            else: result = command(sys.argv[1], sys.argv[2])
    except BusyError as exc: result = {'ok': False, 'status': 429, 'error': str(exc)}
    except BaseException as exc:
        traceback.print_exc(file=sys.stderr)
        result = {'ok': False, 'status': 500, 'error': str(exc), 'build_ms': None, 'build_error': str(exc)}
    if result is not None: print(json.dumps(result, ensure_ascii=False, allow_nan=False))
