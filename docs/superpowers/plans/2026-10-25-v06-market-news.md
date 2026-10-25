# V0.6 Market News Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a manually refreshed, sourced market news briefing with four categories and a persistent last successful snapshot.

**Architecture:** A Next.js server route collects candidate articles from public RSS, optional GDELT, and the connected Longbridge news search. A pure normalization/ranking module filters by window, assigns categories, merges duplicates and selects highlights. A client page renders the result and stores the last successful public snapshot locally.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, RSS XML parser.

**Spec:** `docs/superpowers/specs/2026-10-25-v06-market-news-design.md`

## Global Constraints

- Manual refresh only; time window 3, 5 or 7 days, default 3.
- Four sections plus cross-category focus; importance precedes publisher preference.
- Show only reliable short excerpts available from a feed, otherwise title and source link; do not copy paywalled text or invent summaries.
- Preserve last successful snapshot across navigation and failed updates.
- Keep Longbridge credentials on the server.

## Review Focus

- Feed returns malformed XML: skip that source, report partial failure.
- Feed item lacks a valid date or safe HTTPS link: do not show it.
- Multiple feeds repeat one article or event: show one card.
- A source times out: other sources still render and update finishes within a bounded time.
- Browser local storage is malformed or unavailable: page still loads and fresh data can still display.

---

### Task 1: Candidate feeds and ranking

**Files:** `src/lib/market-news.ts`, `src/lib/market-news.test.ts`, `src/lib/market-news-feeds.ts`, `package.json`, `pnpm-lock.yaml`.

**Interfaces:** `NewsItem`, `NewsCategory`, `NewsSnapshot`, `parseRssFeed(xml, publisher)`, `selectMarketNews(candidates, days, now)`.

- [x] Write tests for RSS parse, date/link validation, category assignment, duplicate collapse, importance-first scoring, and per-category/highlight caps.
- [x] Run those tests and see the intended failures.
- [x] Add explicit XML dependency, feed parsing, and pure selection logic. Use focused Google News RSS searches, including Sina by domain, and an optional GDELT adapter; direct Sina RSS was found stale. Keep excerpts only if genuinely provided by a source.
- [x] Run the focused tests and check they pass.
- [x] Include the source logic in the final V0.6 commit.

### Task 2: Refresh API

**Files:** `src/app/api/news/route.ts`, `src/app/api/news/route.test.ts`.

**Interfaces:** `GET /api/news?days=3|5|7` returns `NewsSnapshot` with `items`, `highlights`, `asOf`, `partial`, `missing`; invalid windows return 400.

- [x] Write tests for validation, all-source failure, partial failure, safe public payload and no-store headers.
- [x] Run and see failures.
- [x] Implement bounded parallel source fetches and optional connected Longbridge search; public feeds work without Longbridge auth.
- [x] Run focused tests and check they pass.
- [x] Include the route in the final V0.6 commit.

### Task 3: News page and navigation

**Files:** `src/components/market-news.tsx`, `src/components/market-news.test.tsx`, `src/app/news/page.tsx`, `src/app/market-news.css`, `src/app/layout.tsx`, and the four existing page components with navigation.

**Interfaces:** A new `/news` page shows time window, manual refresh, highlights, four categories, expand-to-20, sources and original links; stored snapshot restores after navigation.

- [x] Write interaction tests for refresh, window selection, saved snapshot and failed refresh retention.
- [x] Run and see failures.
- [x] Implement page, light styling, nav links and client persistence using the existing calendar pattern.
- [x] Run focused tests and check they pass.
- [x] Include the UI in the final V0.6 commit.

### Task 4: Verify and record

**Files:** `docs/v0.6-status.md`, `docs/README.md`, PR #9 body.

- [x] Run focused tests, full test suite, lint, type check, and production build.
- [x] Smoke-test the running page and one manual refresh; record source coverage and response time limitations.
- [x] Update version record, PR description and README with actual behavior, fixes and evidence.
- [x] Commit and push the finished branch.
