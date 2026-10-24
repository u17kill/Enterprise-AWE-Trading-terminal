# AWE Trading Terminal

V0.1 is a light-theme market dashboard and chart workspace built with Next.js. It has a curated search catalog, separate macro and stock watchlists, and browser-local persistence.

## Run locally

Requires Node.js 22 or newer and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Run `pnpm test`, `pnpm lint`, and `pnpm build` before contributing.

## V0.1 data boundary

All displayed values and trend lines are **static examples**, labeled throughout the UI. They are not live quotes or investment information. The search is limited to the curated catalog in `src/lib/catalog.ts`. Favorites are saved in this browser's `localStorage`; there is no account sync.

The next milestones are TradingView Lightweight Charts, live quotes through a server-side Longbridge adapter, and drawing/Fibonacci tools. Market data credentials must stay in server-only environment variables and must never be placed in a `NEXT_PUBLIC_` variable, client component, or committed file.
