import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
import pandas as pd
import bridge
import indicator_core as core
import sentiment
import apac
import valuation
from locks import lease,BusyError

class TemperatureContracts(unittest.TestCase):
    def test_percentile_window_and_ties(self):
        result=core.pr(pd.Series([1.0]*250))
        self.assertTrue(pd.isna(result.iloc[173]))
        self.assertAlmostEqual(result.iloc[-1],50.2)
        self.assertEqual(core.pr(pd.Series(range(250))).iloc[-1],100)

    def test_band_exact_boundaries(self):
        self.assertEqual(list(core.bk(pd.Series([15,30,30.1,70,85,85.1]))),['极端超卖','警戒超卖','正常','正常','警戒超买','极端超买'])

    def test_ema_not_raw_sum(self):
        rng=np.random.default_rng(5);n=550;c=100*np.exp(np.cumsum(rng.normal(0,.015,n)))
        frame=pd.DataFrame({'date':pd.bdate_range('2023-01-01',periods=n).strftime('%Y-%m-%d'),'close':c,'amount':rng.uniform(1e8,4e8,n),'turnover':rng.uniform(1,5,n),'amt_all':1e11})
        out=core.build(frame)
        raw=.4*out.s_pos+.35*out.s_crowd+.25*out.s_mom
        i=n-1
        self.assertAlmostEqual(out.score.iloc[i],.5*raw.iloc[i]+.5*out.score.iloc[i-1])
        self.assertNotAlmostEqual(out.score.iloc[i],raw.iloc[i])
        self.assertEqual(out.crowd_mode.iloc[-1],'v4')

    def test_emotion_formula(self):
        self.assertEqual(sentiment.temperature(13.59,28,2),31.2)

    def test_hk_empty_short_degrades(self):
        value=bridge.normalize('hk',{'short':{'n':0,'cover':100,'degraded':False,'ratio':None}})
        self.assertTrue(value['short']['degraded'])
        self.assertIn('未取到',value['short']['reason'])

    def test_position_rules_removed_from_old_snapshot(self):
        value=bridge.normalize('cn',{'gap':{'concl':'仓位建议','rule':'仓位上限3成'}})
        self.assertNotIn('3成',value['gap']['rule'])
        self.assertNotIn('建议',value['gap']['concl'])

    def test_valuation_percentile_is_own_history(self):
        points=[['2020-01-01',10],['2021-01-01',20],['2022-01-01',30],['2023-01-01',20]]
        self.assertEqual(valuation.percentile(points),25)

    def test_apac_returns_align_and_curve_endpoint(self):
        dates=pd.bdate_range('2025-01-01',periods=150).strftime('%Y-%m-%d')
        local=pd.DataFrame({'date':dates,'close':np.arange(150)+100.0})
        selected=list(dates[::2])+[dates[-1]]
        bench=pd.DataFrame({'date':selected,'close':np.arange(len(selected))+100.0})
        table=apac.rs_table(local,bench)
        curve=apac.rs_curve(local,bench)
        self.assertAlmostEqual(table['r120']['ex'],curve['last'],places=2)

    def test_apac_does_not_extend_stale_benchmark_tail(self):
        local=pd.DataFrame({'date':pd.bdate_range('2025-01-01',periods=150).strftime('%Y-%m-%d'),'close':np.arange(150)+100.0})
        bench=local.iloc[:-5].copy()
        self.assertIsNone(apac.rs_table(local,bench)['r120']['ex'])
        self.assertIsNone(apac.rs_curve(local,bench))

    def test_partial_breadth_is_rejected_before_temperature(self):
        with patch.object(sentiment,'market_overview',return_value=[]):
            with self.assertRaisesRegex(RuntimeError,'必需读数'):
                sentiment.build('2026-11-23')

    def test_zero_primary_breadth_is_failure(self):
        with self.assertRaises(ValueError):bridge.validate('cn',{'breadth':{'total':0}})

    def test_channel_leases_independent_and_release(self):
        with tempfile.TemporaryDirectory() as temp:
            one=Path(temp)/'one.lock';two=Path(temp)/'two.lock'
            with lease(one):
                with lease(two):pass
                with self.assertRaises(BusyError):
                    with lease(one):pass
            with lease(one):pass

    def test_failed_refresh_preserves_score_and_archive(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'oos').mkdir();(root/'us_senti').mkdir()
            previous=b'{"data":{"previous":true}}';(root/'valuation.json').write_bytes(previous)
            archive=root/'us_senti/fng_archive.json';archive.write_text('{"2020-01-01":{"score":50}}')
            with patch.object(bridge,'DATA',root),patch.object(bridge.valuation,'fetch_all',side_effect=RuntimeError('offline')):
                with self.assertRaises(RuntimeError):bridge.refresh('valuation')
            self.assertEqual((root/'valuation.json').read_bytes(),previous)
            self.assertIn('2020-01-01',json.loads(archive.read_text()))

    def test_unsafe_payload_strings_escaped(self):
        result=bridge.escaped({'name':'<img src=x onerror="alert(1)">', 'v':0})
        self.assertNotIn('<',result['name']);self.assertEqual(result['v'],0)

if __name__=='__main__':unittest.main()
