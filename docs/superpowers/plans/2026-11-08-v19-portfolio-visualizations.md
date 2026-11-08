# V1.9 Portfolio Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three portfolio structure visuals below the unchanged numeric breakdowns.

**Architecture:** Derive chart segments solely from the existing `MatrixTotals`. Render an SVG donut, a CSS proportional strategy bar, and a deterministic area-proportional treemap in a separate presentational component. Keep all storage, editing, and existing totals code unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-08-v19-portfolio-visualizations-design.md`

## Global Constraints

- Use the existing `calculateMatrixTotals` result and dollar formatting. Only complete `数字k` notes on held/add cards are included.
- Do not change the existing numeric summary, portfolio edit/save paths, or imported map format.
- Use the current light terminal style; respond to narrow widths without page overflow.

## Review Focus

- One category or zero total must not divide by zero or render a misleading chart.
- Custom names and repeated theme names must remain distinguishable.
- Very small themes must retain accessible names and amounts.
- Dynamic edits must update all three views from the same totals.
- Rounded percentages may not add to exactly 100%; underlying geometry must use unrounded shares.

---

### Task 1: Chart data and treemap geometry

**Files:** Create `src/lib/portfolio-matrix-visuals.ts`, `src/lib/portfolio-matrix-visuals.test.ts`.

- [ ] Write failing tests for segmentation, zero total, duplicate theme names, and proportional, non-overlapping treemap areas.
- [ ] Implement pure derivation from `PortfolioMatrix` and `MatrixTotals`, plus deterministic rectangle layout.
- [ ] Run focused tests and commit.

### Task 2: Three visuals below the current summary

**Files:** Create `src/components/portfolio-matrix-visuals.tsx`, `src/components/portfolio-matrix-visuals.test.tsx`; modify `src/components/portfolio-matrix-summary.tsx`, `src/app/portfolio-map.css`.

- [ ] Write failing component tests for three sections, values, update after rerender, and empty state.
- [ ] Render donut, strategy bar, and treemap below unchanged breakdowns; add responsive styles.
- [ ] Run focused tests, TypeScript, ESLint, and commit.

### Task 3: Version records and preview

**Files:** Create `docs/v1.9-status.md`; modify `docs/README.md` and the V1.9 PR body.

- [ ] Verify a production build, existing portfolio tests, and desktop/narrow layout where browser access permits.
- [ ] Record requirements, delivery, data boundary, test results, and outstanding issues.
- [ ] Push the V1.9 branch and open a draft PR based on V1.8.
