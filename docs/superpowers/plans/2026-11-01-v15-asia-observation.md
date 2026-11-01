# V1.5 Asia Observation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reviewable V1.5 preview with six market tabs and data-backed EWS/INDA observation, without changing the accepted V1.1 canary page.

**Architecture:** Put the market observation calculation in a pure TypeScript module, call Longbridge from a server-only route, and use a client preview page for manual refresh and locally retained successful readings. Other market panels remain outside this slice until their own sources pass the data gate. The full V1.5 acceptance scope stays in the design document.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, existing Longbridge MCP session.

**Spec:** `docs/superpowers/specs/2026-11-01-v15-canary-redesign-design.md`

## Global Constraints

- EWS.US and INDA.US must be labeled as US-listed ETF proxies, never STI or NIFTY 50.
- Display USD price, US trading date, and price-return windows of 1/5/20 days; do not imply local market close or total return.
- Refresh is manual; retain last valid readings and their original dates on a partial failure.
- Credentials stay server-side. The legacy `/canary` page remains available until V1.5 is complete.
- No V1.5 complete/accepted claim until all seven tabs, eight temperature and eight valuation objects pass their gates.

## Review Focus

- Unsorted or duplicate candles: calculate from distinct trading dates in ascending order, not API response order.
- Missing or nonpositive close: skip invalid bars and report insufficient history instead of NaN.
- One source fails: preserve the other market's last successful reading and report the error.
- ETF dates differ from local exchange dates: show the US date and proxy label on every card.
- Unauthorized Longbridge session: show connection action and no fabricated quote.

---

### Task 1: Pure market observation calculation

**Files:** Create `src/lib/v15-asia-observation.ts`; test `src/lib/v15-asia-observation.test.ts`.

**Interfaces:** `buildAsiaObservation(symbol: "EWS.US" | "INDA.US", bars: unknown): AsiaObservation` returns metadata, as-of date, USD close, and `change1d`, `change5d`, `change20d`, `change60d` as `number | null`.

- [ ] Write failing tests for ordered windows, reversed input, duplicate dates, bad closes, and too-short history. Hand-check percentage results.
- [ ] Run `pnpm exec vitest run src/lib/v15-asia-observation.test.ts`; confirm feature-missing failures.
- [ ] Implement the narrow parser and price-return calculation. `changeNd = 100*(latestClose / closeNTradingBarsEarlier - 1)`.
- [ ] Run focused tests and the full `pnpm test` suite.
- [ ] Commit the independently tested module.

### Task 2: Server route for the two ETF proxies

**Files:** Create `src/app/api/canary-v15/asia/route.ts`; test `src/app/api/canary-v15/asia/route.test.ts`.

**Interfaces:** `POST` reads the existing Longbridge session cookie, requests 70+ daily bars for EWS.US and INDA.US through `callLongbridgeTool`, returns `{readings, errors, refreshedAt}` with independent results and `Cache-Control: no-store`.

- [ ] Write failing tests for an unauthorized session, two successes, and one-source failure without discarding the other.
- [ ] Run focused route tests and confirm the failures are due to missing route behavior.
- [ ] Implement server-only calls and validation with no token or cookie value in the response.
- [ ] Run focused tests and full suite, then commit.

### Task 3: Preview page and persistent manual refresh

**Files:** Create `src/app/canary-v15/page.tsx`, `src/components/v15-asia-preview.tsx`, `src/app/v15-asia.css`; test `src/components/v15-asia-preview.test.tsx`.

**Interfaces:** Client component renders the six-market navigation, two labeled ETF cards and 1/5/20 day changes. Merge successful responses into browser storage; preserve last valid readings and their dates on failures. The preview route is not the production sidebar entry.

- [ ] Write failing interaction tests: explicit refresh, proxy labels and US dates, persistence after remount, partial failure retaining old reading, connection link on unauthorized response.
- [ ] Run focused component test and confirm it fails for the missing preview.
- [ ] Implement preview UI in the terminal's existing blue-white visual language and responsive layout.
- [ ] Run focused and full tests, lint, type-check, and build; browser-check the preview and commit.

### Task 4: Version records and PR

**Files:** Modify `docs/v1.5-status.md`, `docs/v1.5-source-audit.md`, and `docs/README.md` only if index links change.

- [ ] Record delivered preview behavior, source/session limits, test evidence, and remaining full V1.5 gates.
- [ ] Run `git diff --check`, verify the draft PR body matches the version records, and push the branch.
