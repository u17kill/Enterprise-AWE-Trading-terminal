# V1.8 Institutional Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a matrix-first institutional research page using the 67 curated reports and a rolling three-calendar-month window.

**Architecture:** A server-only reader loads and validates the curated JSON on every refresh request. A pure model derives the window, matrix coverage, and counts from one validated dataset. A client page renders the matrix and cards with local filters, keeping the last valid display if refresh fails.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, existing CSS system.

**Spec:** `docs/superpowers/specs/2026-11-08-v18-institutional-research-design.md`

## Global Constraints

- Follow existing light theme and two-level sidebar. Add `/research` under “市场情报”.
- Seed data: 5 topics, 30 institutions, 67 reports, 62 filled cells as of 2026-11-03.
- Accept only publication dates in the last three calendar months, inclusive, in Asia/Singapore time.
- Refresh re-reads curated local JSON; it does not scrape or publish reports.
- Label `call` as “关键判断／读数”; 13 of 67 seed values are qualitative.
- Show source text and data snapshot date; do not claim original documents were independently verified.

## Review Focus

- Missing or corrupt JSON must not replace a previously valid UI snapshot.
- Old reports must not return when falling back to cached data.
- A cell with multiple reports counts as one covered cell but shows its report count.
- Matrix labels and controls must remain usable on narrow screens without whole-page horizontal overflow.
- Search, institution and topic filters must compose, and clearing filters must restore all current reports.

### Task 1: Model and rolling window

**Files:** Create `src/lib/institutional-research.ts`, `src/lib/institutional-research.test.ts`.

**Interfaces:** `parseResearchDataset(raw: unknown): ResearchDataset`; `buildResearchSnapshot(dataset: ResearchDataset, today: string): ResearchSnapshot`; `filterResearchSnapshot(snapshot: ResearchSnapshot, today: string): ResearchSnapshot`.

- [ ] Add failing tests for IDs/foreign keys/date/tag validation, three-month cutoff including month-end, current counts, duplicate reports in one cell, and expired fallback filtering.
- [ ] Run focused Vitest; confirm expected failures.
- [ ] Implement types, validation, Singapore date helper, sorted current reports, and one-source statistics.
- [ ] Run focused Vitest; confirm pass.
- [ ] Commit model and tests.

### Task 2: Curated seed and read API

**Files:** Create `data/research/research.json`, `src/lib/institutional-research-store.ts`, `src/app/api/research/route.ts`, `src/app/api/research/route.test.ts`.

**Interfaces:** `readResearchSnapshot(today?: string): Promise<ResearchSnapshot>`; `GET(): Promise<Response>`.

- [ ] Add failing API tests for seed totals, no-store response, missing/corrupt source error, and no network access.
- [ ] Run focused Vitest; confirm expected failures.
- [ ] Copy the 2026-11-03 curated JSON into the repo and implement a server-only file reader and route using Task 1.
- [ ] Run focused Vitest and verify the actual seed gives 5 topics, 30 institutions, 67 reports, and 62 covered cells on 2026-11-08.
- [ ] Commit seed, route and tests.

### Task 3: Matrix-first page

**Files:** Create `src/components/institutional-research.tsx`, `src/components/institutional-research.test.tsx`, `src/app/research/page.tsx`, `src/app/institutional-research.css`; modify `src/components/app-sidebar.tsx` and its test.

**Interfaces:** Client component fetches `/api/research` on mount and refresh. Search/selection use the snapshot from Task 1.

- [ ] Add failing component tests for navigation, matrix cell filtering, institution/subject/search combination, reset, empty state and failed refresh retaining current data.
- [ ] Run focused Vitest; confirm expected failures.
- [ ] Implement page shell, matrix, search, theme chips, cards and responsive CSS aligned with existing terminal.
- [ ] Run focused Vitest; confirm pass.
- [ ] Commit page and tests.

### Task 4: Verification and version archive

**Files:** Modify `docs/v1.8-status.md`, design doc if decisions change, `docs/README.md`, and PR #25 description.

- [ ] Run focused tests, TypeScript, ESLint and isolated Next.js production build.
- [ ] Inspect `/research` in a local browser at desktop and narrow widths and confirm current counts, filters and no overflow.
- [ ] Record delivered behavior, source limits, test evidence and any remaining gaps in V1.8 status and PR body.
- [ ] Commit and push the final docs.
