"""Regression checks for agreed scoring rules; no external requests."""
import contextlib
import io
import json
import os
import runpy
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import score
import build
import fetch

class Scoring(unittest.TestCase):
    def test_trim_and_weak(self):
        self.assertEqual(score.trim_mean([-2, -1, 0, 1, 2])[0], 0)
        result = score.module_from([{'mod':'macro','band':1}], 'macro')
        self.assertTrue(result['weak'])
        self.assertIsNone(score.module_from([], 'macro')['score'])

    def test_no_phantom_downgrade(self):
        result = score.module_from([{'mod':'macro','band':-2},{'mod':'macro','band':2}], 'macro')
        self.assertEqual(result['band'], 'y')
        self.assertFalse(result['downgraded'])

    def test_assets_have_single_order_and_correct_signs(self):
        self.assertEqual([a[0] for a in score.ASSETS], [a for _,_,ids in score.GROUPS for a in ids])
        self.assertLess(score.ELASTIC['policy']['us_bond'], 0)
        self.assertGreater(score.ELASTIC['macro']['us_bond'], 0)

    def compute(self, pending=False):
        indicators = [{'id':f'M{i}', 'mod':'macro','band':1} for i in range(1,9)] + [{'id':f'I{i}', 'mod':'industry','band':0} for i in range(1,8)]
        tech = [{'id':f'T{i}','mod':'tech','band':-1 if i<4 else None} for i in range(1,5)]
        policy = {'score':None if pending else 100,'band':'na' if pending else 'dg','label':'未获取' if pending else '深绿','disp':0,'n':0 if pending else 1,'weak':True,'downgraded':False}
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)
            raw={'series':{},'prices':{ticker:{'dates':['2026-11-20'],'close':[100]} for _,_,ticker in score.ASSETS},'fetched_at':'2026-11-24 00:00:00','errors':[]}
            (path/'series.json').write_text(json.dumps(raw),encoding='utf-8')
            with contextlib.ExitStack() as stack:
                stack.enter_context(patch.object(score,'DATA',temp))
                stack.enter_context(patch.object(score,'build_indicators',return_value=indicators))
                stack.enter_context(patch.object(score,'tech_factors',return_value=tech))
                stack.enter_context(patch.object(score,'tech_score',return_value=(0,[],'')))
                stack.enter_context(patch.object(score,'policy_module',return_value=(policy,[], -50 if pending else None)))
                stack.enter_context(patch.object(score,'build_local_rates',return_value={}))
                with contextlib.redirect_stdout(io.StringIO()):
                    score.main()
            result=json.loads((path/'score.json').read_text(encoding='utf-8'))
            snapshot=json.loads(next((path/'snapshot').glob('*.json')).read_text(encoding='utf-8'))
            return result,snapshot

    def test_single_indicator_module_excluded_entirely(self):
        result,_=self.compute()
        self.assertNotIn('policy',result['risk_appetite']['modules_used'])
        self.assertEqual(result['risk_appetite']['score'], 6.2)
        self.assertTrue(all(c['m']!='policy' for a in result['assets'] for c in a['contrib']))

    def test_pending_policy_remains_visible_but_not_in_total(self):
        result,_=self.compute(pending=True)
        self.assertNotIn('policy',result['risk_appetite']['modules_used'])
        for asset in result['assets']:
            self.assertTrue(next(c for c in asset['contrib'] if c['m']=='policy')['pending'])
            terms=[c for c in asset['contrib'] if not c.get('pending')]
            denominator=sum(result['weights'][c['m']]*abs(c['e']) for c in terms)
            # Recompute with unrounded module scores, not displayed contribution sums.
            numerator=sum(result['weights'][c['m']]*result['modules'][c['m']]['score']*c['e'] for c in terms)
            self.assertAlmostEqual(asset['score'],round(numerator/denominator,1),places=1)

    def test_daily_snapshot_contains_19_indicators(self):
        _,snapshot=self.compute()
        self.assertEqual(len(snapshot['indicators']),19)
        self.assertIn('T4',snapshot['indicators'])
        self.assertIsNone(snapshot['indicators']['T4'])

    def test_render_escapes_user_text(self):
        self.assertEqual(build.esc('<script>'), '&lt;script&gt;')

    def test_missing_technical_data_keeps_four_rows(self):
        items=score.tech_factors({}, {})
        self.assertEqual([i['id'] for i in items],['T1','T2','T3','T4'])
        self.assertTrue(all(i['band'] is None for i in items))

    def test_missing_macro_and_industry_keep_all_evidence_rows(self):
        items=score.build_indicators({}, {})
        self.assertEqual([i['id'] for i in items], [f'M{i}' for i in range(1,9)] + [f'I{i}' for i in range(1,8)])
        self.assertTrue(all(i['band'] is None and i['date'] is None for i in items))
        self.assertEqual(len(items + score.tech_factors({}, {})),19)

    def test_failed_refresh_preserves_previous_score(self):
        with tempfile.TemporaryDirectory() as temp:
            data=Path(temp)/'asset-direction'
            data.mkdir()
            previous=b'{"sentinel":"previous complete score"}'
            (data/'score.json').write_bytes(previous)
            def failed_fetch():
                (Path(fetch.DATA)/'series.json').write_text(json.dumps({'fetched_at':'2026-11-24','errors':[{'id':str(i)} for i in range(4)]}),encoding='utf-8')
            with patch.dict(os.environ,{'AWE_PORTFOLIO_DATA_DIR':temp}),patch.object(sys,'argv',['bridge.py','refresh']),patch.object(fetch,'main',side_effect=failed_fetch),contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit):
                    runpy.run_path(str(Path(__file__).with_name('bridge.py')),run_name='__main__')
            self.assertEqual((data/'score.json').read_bytes(), previous)
            self.assertFalse((data/'snapshot').exists())

if __name__=='__main__':
    unittest.main()
