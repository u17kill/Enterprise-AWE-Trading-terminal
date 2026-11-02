# V1.5 Canary Three Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the agreed two-level navigation and substantial US/A-share market temperature, valuation, and short-term sentiment pages using verified data, with the existing indicator encyclopedia unchanged.

**Architecture:** A shared sidebar replaces duplicated menu markup. Three new client pages share a market selector and cached snapshots but own their data and refresh action. Server route handlers fetch and validate source observations; calculation modules preserve source, trade date, coverage, and unavailable reasons.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, existing Longbridge session, validated public sources.

**Spec:** `docs/superpowers/specs/2026-11-02-v15-canary-navigation-design.md` and historical indicator research cited there.

## Global Constraints

- Do not modify the existing `/canary` calculations, V0.9 five lights, or other business content.
- Do not display example numbers as live values. Keep dates, provenance, formula, and limitations beside every observation.
- Store credentials server side only. Do not call a Codex-only MCP connector from a browser page.
- A market selection carries across the three new pages; each page refreshes independently and retains its last valid snapshot.
- No Asia, global composite risk, rotation, or individual stock trading advice in this version.

## Review Focus

- Navigation to an old URL still works and selects its new group.
- Switching market does not show the prior market's readings.
- Incomplete historical data does not produce a fake temperature or percentile.
- An error preserves and dates the last successful snapshot.
- A source with mismatched market date or metric definition is visibly unavailable.

---

### Task 1: Shared navigation

**Files:** Create `src/components/app-sidebar.tsx`, test it; modify the eleven components or pages with copied menus and sidebar CSS.

**Interfaces:** `<AppSidebar currentPath={string} />` selects the active group and link. Existing paths remain.

- [ ] Write navigation tests for all groups, existing URLs, new URLs, and expand/collapse; run to see failure.
- [ ] Implement shared navigation and replace copied menus; run targeted tests to green.
- [ ] Verify responsive layout and keyboard interaction.
- [ ] Commit.

### Task 2: Shared V1.5 page frame and market selection

**Files:** Create `src/components/canary-research-shell.tsx`, `src/lib/canary-v15-storage.ts`, three route pages, tests, and CSS.

**Interfaces:** Market `us | cn` lives in a safe browser store; each route receives current market and exposes a local refresh button.

- [ ] Write failing tests for the four canary links, market persistence, route headings, and unchanged `/canary` behavior.
- [ ] Build the frame matching the approved UI; run tests and review in browser.
- [ ] Commit.

### Task 3: Market temperature

**Files:** Create temperature source, formula, route handler, page view, and tests.

**Interfaces:** Eight instruments; output score, P/C/M, date, trend, sample count, source, definition, and error. Reject missing preheat or incomplete aligned inputs.

- [ ] Write failing tests for formula vectors, 294-bar minimum, SPY denominator handling, split-adjusted SOXX input, dates, and source errors.
- [ ] Implement source adapters and calculations; confirm independent reference vectors.
- [ ] Build four-object overview, selected detail, chart, history distribution, interpretation, and method disclosure.
- [ ] Test both markets and browser refresh; commit.

### Task 4: Valuation analysis

**Files:** Create valuation source/normalizer, route handler, page view, and tests.

**Interfaces:** Eight objects; each metric includes exact definition, current reading, same-method history, 3/5/10-year percentile where supported, source and observation date.

- [ ] Write failing tests for same-method percentile, insufficient years, mixed PE rejection, DIA distribution-yield separation, and error retention.
- [ ] Verify each public or authorized source's current and historic coverage, calculation and display permission.
- [ ] Build overview, price-versus-valuation study, percentile chart, and source notes; test and commit.

### Task 5: Short-term sentiment

**Files:** Create US and A-share close-snapshot sources, route handler, page view, and tests.

**Interfaces:** Market-specific breadth, sectors, participation, risk appetite, and six-session pulse with explicit universe, close date and provenance.

- [ ] Write failing tests for trading dates, market universes, partial sector data, and no intraday/close mixing.
- [ ] Connect verified sources and build the sector heatmap, breadth and pulse charts, leader/laggard study, and explanatory modules.
- [ ] Test both markets, refresh and stale preservation; commit.

### Task 6: Finish and record

**Files:** Update current V1.5 design, `docs/v1.5-status.md`, `docs/v1.5-source-audit.md`, `docs/README.md`, PR body.

- [ ] Run targeted tests, full tests, lint, TypeScript and production build; resolve new failures.
- [ ] Browser-check desktop and narrow layouts, every new route, market switching and refresh errors.
- [ ] Record delivered coverage and unresolved source limits precisely, push branch, update draft PR; request user acceptance.
