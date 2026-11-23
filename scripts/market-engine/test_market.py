"""Offline contract tests: no private portfolio and no external requests."""
import unittest
from unittest.mock import patch
import market

class Contracts(unittest.TestCase):
    def test_thinning_retains_endpoint(self):
        values = [[str(i), i] for i in range(1500)]
        result = market.thin(values)
        self.assertLessEqual(len(result), 140)
        self.assertEqual(result[-1], values[-1])

    def test_exact_ticker_syntax(self):
        self.assertEqual(market.derive_code('jp4063')['code'], '4063.T')
        self.assertEqual(market.derive_code('kr005930')['code'], '005930.KS')
        self.assertEqual(market.derive_code('BRK.B')['code'], 'usBRK.B')
        self.assertIsNone(market.derive_code('黄金'))

    def test_yield_change_is_basis_points(self):
        with patch.object(market, '_yield_series_us_cn', return_value=[('2026-11-20',4.80),('2026-11-23',4.86)]):
            card = market.bond_card('us10y')
        self.assertEqual(card['price'], 4.86)
        self.assertAlmostEqual(card['chg'], 6.0)

    def test_missing_quote_fails_entire_asset_batch(self):
        with patch.object(market, 'quote', return_value={}):
            with self.assertRaisesRegex(RuntimeError, 'eq 类行情缺失'):
                market.build_assets({'assets':[{'kind':'eq','code':'usIVV','name':'标普500','cls':'股指'}]})

    def test_order_preserves_price_and_spark(self):
        a = {'code':'a','price':1,'spark':{'pts':[1,2]}}
        b = {'code':'b','price':2,'spark':{'pts':[3,4]}}
        result = market.apply_order({'assets':[a,b],'watchlist':{}}, {'assets':[{'code':'b'},{'code':'a'}],'watchlist':[],'sectors':[]})
        self.assertEqual(result['assets'],[b,a])
        self.assertIs(result['assets'][0], b)

if __name__ == '__main__':
    unittest.main()
