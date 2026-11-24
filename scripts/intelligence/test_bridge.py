"""Failure and persistence tests; never access the network or personal books."""
import datetime as dt
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

import bridge
from locks import lease


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.data_patch = patch.object(bridge, 'DATA', self.base)
        self.data_patch.start()
        bridge.configure(self.base)

    def tearDown(self):
        self.data_patch.stop()
        self.temp.cleanup()

    def test_public_bootstrap_never_overwrites_existing_source(self):
        file = self.base / 'data/research/research.json'
        file.write_text('{"custom":true}')
        bridge.configure(self.base)
        self.assertEqual(bridge.read(file), {'custom': True})
        self.assertFalse((self.base / 'data/wind/feed.json').exists())
        self.assertFalse((self.base / 'data/news/raw.json').exists())
        self.assertFalse((self.base / 'data/portfolio').exists())

    def test_all_five_contracts_bootstrap_without_reference_runtime(self):
        expected = {'news': 'news', 'wind': 'wind', 'research': 'research',
                    'calendar': 'calendar', 'holdings': 'snapshot'}
        for kind, key in expected.items():
            result = bridge.command('read', kind)
            self.assertTrue(result['ok'], kind)
            self.assertIsInstance(result[key], dict)
        wind = bridge.payload('wind')['wind']
        self.assertLessEqual(len(wind['brief']['items']), 10)
        self.assertEqual(wind['n_points'], sum(len(p.get('points', [])) for p in wind['people']))

    def test_news_all_source_failure_does_not_replace_old_pool(self):
        pool = Path(bridge.news.RAW_FILE)
        bridge.atomic(pool, {'items': [], 'fetched_at': '2026-01-01'})
        before = pool.read_bytes()
        with patch.object(bridge.news, 'fetch', return_value=({'items': []}, [{'ok': False, 'err': 'offline'}])):
            result = bridge.refresh('news')
        self.assertFalse(result['ok'])
        self.assertIn('全部新闻源', result['error'])
        self.assertEqual(pool.read_bytes(), before)

    def test_packaged_news_snapshot_expires_without_raw_pool(self):
        bridge.atomic(Path(bridge.news.NEWS_FILE), {
            'items': [{'id': 'old', 'auto': True, 'date': '2020-01-01T00:00:00+08:00', 'place': 'top', 't': 'old', 'tcn': 'old'}],
            'buckets': bridge.news.BUCKETS, 'brief': {'as_of': '2020-01-01', 'items': [{'h': 'expired', 't': 'expired'}]}})
        result = bridge.payload('news')['news']
        self.assertEqual(result['n_items'], 0)
        self.assertEqual(result['items'], [])
        self.assertTrue(result['brief']['auto'])
        self.assertIn('公开页面快照', result['snapshot_origin'])

    def test_calendar_week_tracks_today_but_source_date_is_preserved(self):
        data = bridge.payload('calendar')['calendar']
        source = bridge.econcal.load(bridge.econcal.SRC)
        monday = dt.date.today() - dt.timedelta(days=dt.date.today().weekday())
        self.assertEqual(data['week']['start'], monday.isoformat())
        self.assertEqual(data['as_of'], source['as_of'])

    def test_partial_sec_keeps_old_filing_and_explicit_failure(self):
        previous = {'built_at': '2026-01-01', 'insts': [{'id': 'a', 'status': 'ok',
                    'period': '2025-09-30', 'holdings': [{'shares': 123}], 'chg': {'ok': True}}]}
        fresh = {'insts': [{'id': 'a', 'status': 'error', 'error': 'SEC offline'},
                           {'id': 'b', 'status': 'ok', 'holdings': [{'shares': 1}]}], 'n_error': 1}
        result = bridge.merge_holdings(fresh, previous)
        self.assertEqual(result['insts'][0]['status'], 'carried')
        self.assertTrue(result['insts'][0]['carried'])
        self.assertEqual(result['insts'][0]['carried_period'], '2025-09-30')
        self.assertEqual(result['insts'][0]['period'], '2025-09-30')
        self.assertEqual(result['insts'][0]['keep_error'], 'SEC offline')
        self.assertEqual(result['n_cached'], 1)
        self.assertEqual(result['n_error'], 0)
        self.assertEqual(result['n_failed'], 1)
        self.assertEqual(result['n_inst'], result['n_ok'] + result['n_carried'] + result['n_error'])
        self.assertEqual(result['n_ok'], 1)

    def test_all_sec_failure_leaves_durable_snapshot_untouched(self):
        path = Path(bridge.holdings.SNAP)
        before = path.read_bytes()
        with patch.object(bridge.holdings, 'build', return_value={'n_ok': 0}):
            with self.assertRaisesRegex(RuntimeError, '全部 SEC'):
                bridge.refresh('holdings')
        self.assertEqual(before, path.read_bytes())

    def test_research_refresh_retains_source_and_numeric_build_fields(self):
        path = Path(bridge.research.RPT_FILE)
        before = path.read_bytes()
        result = bridge.refresh('research')
        self.assertTrue(result['built'])
        self.assertIsInstance(result['build_ms'], int)
        self.assertIsNone(result['build_error'])
        self.assertEqual(path.read_bytes(), before)

    def test_process_lease_blocks_same_channel_but_not_other_channels(self):
        lock = self.base / 'jobs/news.lock'
        code = 'from pathlib import Path;from locks import lease;import sys;\nwith lease(Path(sys.argv[1])): print("acquired")'
        env = {**os.environ, 'PYTHONIOENCODING': 'utf-8'}
        with lease(lock):
            same = subprocess.run([sys.executable, '-c', code, str(lock)], cwd=Path(__file__).parent,
                                  capture_output=True, text=True, encoding='utf-8', env=env)
            other = subprocess.run([sys.executable, '-c', code, str(self.base / 'jobs/research.lock')],
                                   cwd=Path(__file__).parent, capture_output=True, text=True, encoding='utf-8', env=env)
        self.assertNotEqual(same.returncode, 0)
        self.assertEqual(other.returncode, 0)
        self.assertTrue(bridge.alive(os.getpid()))

    def test_stopped_worker_is_reported_and_old_result_survives(self):
        bridge.atomic(bridge.job_path('wind'), {'running': True, 'pid': 99999999, 'result': {'old': True}})
        state = bridge.progress_state('wind')
        self.assertFalse(state['running'])
        self.assertIn('已停止', state['error'])
        self.assertEqual(state['result'], {'old': True})

    def test_detached_worker_publishes_durable_completion(self):
        with patch.dict(os.environ, {'AWE_INTELLIGENCE_DATA_DIR': str(self.base), 'PYTHONIOENCODING': 'utf-8'}):
            started = bridge.start('research')
            self.assertTrue(started['started'])
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                state = bridge.progress_state('research')
                if not state['running']: break
                time.sleep(.05)
            self.assertFalse(state['running'])
            self.assertIsNone(state['error'])
            self.assertTrue(state['built'])
            self.assertIsInstance(state['build_ms'], int)
            while bridge.alive(state.get('pid')) and time.monotonic() < deadline:
                time.sleep(.03)
            self.assertFalse(bridge.alive(state.get('pid')))
            log = (self.base / 'jobs/research.log').read_text(encoding='utf-8')
            self.assertIn('worker started', log)
            self.assertIn('worker completed', log)

    def test_second_background_launch_is_rejected_while_worker_alive(self):
        bridge.atomic(bridge.job_path('wind'), {'running': True, 'pid': os.getpid()})
        with self.assertRaises(bridge.BusyError): bridge.start('wind')

    def test_windows_redirector_acknowledges_a_different_actual_worker_pid(self):
        # Keep the job RUNNING: a fast completion previously masked this bug.
        bridge.atomic(bridge.job_path('wind'), {'running': True, 'token': 'unique', 'pid': os.getpid()})
        child = unittest.mock.Mock(pid=99999999)
        child.poll.return_value = None
        bridge.wait_for_worker(child, 'wind', 'unique', launcher_pid=99999998, timeout=.1)
        self.assertTrue(bridge.read(bridge.job_path('wind'))['running'])

    def test_foreign_launch_token_cannot_acknowledge_worker(self):
        bridge.atomic(bridge.job_path('wind'), {'running': True, 'token': 'other', 'pid': os.getpid()})
        child = unittest.mock.Mock(pid=99999999)
        child.poll.return_value = None
        with self.assertRaisesRegex(RuntimeError, '启动超时'):
            bridge.wait_for_worker(child, 'wind', 'expected', launcher_pid=99999998, timeout=.05)


if __name__ == '__main__': unittest.main()
