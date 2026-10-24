# AWE Trading Terminal

A light-theme market dashboard, chart workspace, and private portfolio map built with Next.js. V1.3 adds five editable market-health lights, more macro assets, chart notes and indicators, financial details, and editable holding lanes.

## Run locally

Requires Node.js 22 or newer and pnpm 11.

```bash
pnpm install
pnpm exec next dev --hostname 127.0.0.1 --port 3100
```

Open `http://127.0.0.1:3100`. Click **连接 Longbridge** and approve access in Longbridge. Then click **更新数据** on the dashboard or chart page. The app requests market data only on that click; it does not poll or stream. The Longbridge OAuth token stays in the Next.js server process, keyed by an opaque HttpOnly browser cookie. Do not paste a token into the browser or commit it. The Codex/ChatGPT Longbridge connection is separate from this app's authorization.

The local preview keeps OAuth sessions in server memory. Restarting the server requires reconnecting. A public or multi-instance deployment needs a durable, encrypted, per-user session store and a configured `AWE_BASE_URL` before enabling this integration. The app never submits trades. It requests Longbridge quote, search, candle, valuation-index, and financial-report data from the server. Gold API, Coinbase Exchange, and the US Treasury are also fetched server-side when their cards are refreshed.

## Data and chart behavior

- The curated catalog is available immediately. After connecting Longbridge, a complete US ticker such as `ADBE` is verified directly through `static_info` and returns quickly. English or Chinese name searches load the US security directory in small server-side pages; any oversized page is retried in smaller halves, and the completed directory is cached for ten minutes. Selected stocks and the watchlist are saved in browser `localStorage`. The directory may contain ETFs and other US listed securities; current search does not cover other exchanges.
- Dashboard cards show no price or trend until the user refreshes. Supported Longbridge cards then show the latest quote and the matching trading day's regular-session 5-minute series. Gold spot is a quote-only reference from Gold API; BTC/USD uses Coinbase Exchange, and US 10Y yield uses official US Treasury daily observations. Each card labels its source and observation time. A missing quote or series never falls back to a fabricated card value or line.
- The macro watchlist now has twelve entries. Longbridge mappings for VIX, Shanghai Composite, Hang Seng, Hang Seng Tech, and CSI A500 are attempted on refresh. Nikkei 225 and KOSPI remain explicitly unavailable until a verified direct index feed is integrated. S&P 500 and Nasdaq 100 TTM/forward PE likewise remain unreported until a consistent, dated valuation source is available.
- The chart requests daily, weekly, and monthly candles on each manual refresh. Candle history is requested in batches of up to 80 bars so a large response is not truncated by the MCP tool-result limit. After refresh, a missing candle series shows an empty state; it never remains next to an updated quote as a sample chart. MA200/MA250 need at least 200/250 bars in the selected interval; the available history depends on Longbridge entitlement.
- MACD uses periods 12/26/9 and RSI uses 14. Bollinger Bands (20, 2) and ATR (14) are optional. MA5, MA10, MA20, MA50, MA200, and MA250 can be shown together.
- Straight lines, horizontal lines, Fibonacci drawings, and movable text notes are saved per symbol and interval in this browser. Select a drawing to edit or delete it. Live-candle drawings use a separate storage key from sample-candle drawings so their coordinates do not silently shift when the source changes.
- The chart information panel shows a 52-week range from available daily bars and, where Longbridge supplies them, TTM PE, static PE from the latest reported fiscal-year EPS, PB, dividend yield, and latest quarterly revenue/EPS year-over-year growth. Forward PE stays blank until four upcoming quarterly EPS estimates or another dated annual forecast provide a verifiable denominator. The report period and data source are shown beside reported figures.
- The five-light panel stores your dated assessments locally. Only VIX is quote-backed; the other judgments are edited by you. The portfolio map stores editable lanes, stock holdings, quantities, and original-currency cost totals in the current browser. Export a private JSON backup regularly. An optional localhost-only import preview of an August 15, 2026 historical holdings snapshot requires you to inspect each row and confirm before it replaces browser data. The snapshot is kept under ignored `.local/` and is never committed.
- The S&P 500 breadth control is withheld until the complete series is available. Longbridge's constituent response observed during development reported 501 constituents but returned only 20 stock entries. A full-index MA50/MA200 breadth percentage needs the complete constituent universe and sufficient history for every included stock, or a verified precomputed full-index series. The chart explains this status and links to the indicator definition.

Run `pnpm test`, `pnpm lint`, and `pnpm build` before contributing. V0.2 history is tracked in [GitHub issue #2](https://github.com/u17kill/Enterprise-AWE-Trading-terminal/issues/2); V1.3 design and implementation notes are in `docs/superpowers/`.
