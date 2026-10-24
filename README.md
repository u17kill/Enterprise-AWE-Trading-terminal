# AWE Trading Terminal

A light-theme market dashboard and TradingView Lightweight Charts workspace built with Next.js. V0.2 adds manual Longbridge MCP refresh, multiple moving averages, MACD and RSI panes, and direct deletion of individual drawings.

## Run locally

Requires Node.js 22 or newer and pnpm 11.

```bash
pnpm install
pnpm exec next dev --hostname 127.0.0.1 --port 3100
```

Open `http://127.0.0.1:3100`. Click **连接 Longbridge** and approve access in Longbridge. Then click **更新数据** on the dashboard or chart page. The app requests market data only on that click; it does not poll or stream. The Longbridge OAuth token stays in the Next.js server process, keyed by an opaque HttpOnly browser cookie. Do not paste a token into the browser or commit it. The Codex/ChatGPT Longbridge connection is separate from this app's authorization.

The local preview keeps OAuth sessions in server memory. Restarting the server requires reconnecting. A public or multi-instance deployment needs a durable, encrypted, per-user session store and a configured `AWE_BASE_URL` before enabling this integration. The app never submits trades; its server requests only `quote` and `candlesticks` MCP tools.

## Data and chart behavior

- The curated dashboard catalog and watchlist are saved in browser `localStorage`. Search covers that catalog, not the full market.
- Before refresh, all values and candles are clearly labeled demonstration data. After refresh, supported cards show Longbridge quote values and source times. Their miniature trend charts remain labeled as sample trends.
- The verified Longbridge mapping currently covers SPX, NDX, DJI, AAPL, NVDA, MSFT, TSLA, AMZN, GOOGL, and META. Gold, US Treasury yield, and Bitcoin remain sample data until their Longbridge symbols and quote coverage are verified.
- The chart requests daily, weekly, and monthly candles on each manual refresh. If Longbridge returns too few candles, that interval remains in sample mode. MA200/MA250 need at least 200/250 bars in the selected interval; the available history depends on Longbridge entitlement.
- MACD uses periods 12/26/9 and RSI uses 14. Both appear in independent lower panes when selected. MA5, MA10, MA20, MA200, and MA250 can be shown together.
- Straight lines and Fibonacci drawings are saved per symbol and interval in this browser. Select a drawing to reveal its direct delete button. Live-candle drawings use a separate storage key from sample-candle drawings so their coordinates do not silently shift when the source changes.
- The S&P 500 breadth selectors are present, but their panes explicitly say data is unavailable. Longbridge's constituent response observed during development reported 501 constituents but returned only 20 stock entries. We will not calculate or label a full-index MA50/MA200 breadth percentage from that partial set. This needs a complete constituent universe and sufficient history for every included stock, or a verified precomputed full-index series.

Run `pnpm test`, `pnpm lint`, and `pnpm build` before contributing. V0.2 requirements and remaining data gaps are tracked in [GitHub issue #2](https://github.com/u17kill/Enterprise-AWE-Trading-terminal/issues/2).
