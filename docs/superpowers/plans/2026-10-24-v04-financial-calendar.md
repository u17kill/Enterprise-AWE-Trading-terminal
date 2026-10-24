# V0.4 Financial Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a source-labeled monthly financial calendar with official curated dates and user-triggered Longbridge earnings and macro events.

**Architecture:** A client page renders curated events and optional per-month browser cache. A server route validates the month, calls the existing authenticated Longbridge MCP bridge, filters provider results, and returns public event summaries.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, existing MCP SDK, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-v04-financial-calendar.md`

## Global Constraints

- No credentials in the client or browser storage.
- Dates without a verifiable source stay out of calendar cells.
- New data requests happen only after the user presses the calendar update button.
- Version requirements, delivery, fixes and verification go in GitHub docs and PR.

## Review Focus

- Month boundary and leap-year placement.
- Earnings local date versus UTC timestamp.
- Provider result leaking outside the requested month.
- Partial market failure and total authorization failure.
- Retention of last successful update after a later failure.

### Task 1: Event model and dates

**Files:** `src/lib/financial-calendar.ts`, `src/lib/financial-calendar.test.ts`

- [x] Define categories, event provenance and curated official dates.
- [x] Test multiday placement and month cells.
- [x] Parse provider events using market-local report dates and requested-month limits.

### Task 2: Authenticated live calendar route

**Files:** `src/app/api/calendar/route.ts`, `src/app/api/calendar/route.test.ts`

- [x] Validate month and session before provider calls.
- [x] Request major earnings and high-importance macro data through the server MCP bridge.
- [x] Return partial-source diagnostics without discarding successful markets.

### Task 3: Calendar workspace and navigation

**Files:** `src/components/financial-calendar.tsx`, `src/components/financial-calendar.test.tsx`, `src/app/calendar/page.tsx`, `src/app/financial-calendar.css`, existing navigation files.

- [x] Render month grid, selected-day event details, category filters and undated watchlist.
- [x] Add entries from dashboard, portfolio map and chart workspace.
- [x] Save last successful monthly provider data and show fetch errors.

### Task 4: Version release record

**Files:** `docs/v0.4-status.md`, `docs/README.md`, `README.md`

- [x] Run full tests, lint, type check and production build.
- [ ] Record verification and limits in GitHub and open a V0.4 draft PR.
