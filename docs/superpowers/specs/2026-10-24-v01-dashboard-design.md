# AWE Trading Terminal V0.1 design

## Intent
Give an individual investor a clean, TradingView-inspired starting point for tracking major assets and stocks, then opening a dedicated chart workspace for one symbol.

## Scope
- Next.js App Router, TypeScript, responsive light theme.
- Dashboard with four cards per row on desktop, separate macro and stock groups.
- Search a curated symbol catalog, add and remove favorites, and retain them in browser storage.
- Cards navigate to a symbol workspace. The workspace shows an explicitly labeled sample chart and symbol context.
- No live data, trade execution, drawing tools, or credentials in V0.1. Future market data must be served through server-side code, never exposed to the browser.

## Approach
Use a curated catalog and localStorage for V0.1. This makes adding assets usable without claiming live symbol discovery or adding account infrastructure. Cards and the workspace use sample data clearly marked as such; a later server data adapter can replace it.

## Acceptance
Users can search by name or ticker, add and remove symbols without duplicates, reload and see the same choices, open a symbol workspace, and return to the dashboard. Invalid chart URLs show a helpful not-found page.
