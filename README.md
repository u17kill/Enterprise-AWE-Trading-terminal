# AWE Trading Terminal

V0.1 is a light-theme market dashboard and interactive chart workspace built with Next.js and TradingView Lightweight Charts. It has a curated search catalog, separate macro and stock watchlists, and browser-local persistence.

## Run locally

Requires Node.js 22 or newer and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Run `pnpm test`, `pnpm lint`, and `pnpm build` before contributing.

## V0.1 data boundary

All displayed prices and chart candles are **demonstration data**, labeled throughout the UI. Chart candles are generated locally and are not live quotes or investment information. The search is limited to the curated catalog in `src/lib/catalog.ts`. Favorites are saved in this browser's `localStorage`; there is no account sync.

The chart workspace supports daily, weekly and monthly candles, adjustable simple moving average, volume, straight lines, and Fibonacci retracement. Select a drawing tool, click two positions on the chart, then select the drawing to drag its endpoints or delete it. Drawings are saved per symbol and interval in this browser's `localStorage`. Clearing browser storage removes them.

The next milestone is live quotes through a server-side Longbridge adapter. Market data credentials must stay in server-only environment variables and must never be placed in a `NEXT_PUBLIC_` variable, client component, or committed file. The browser must only receive the market data needed for display.
