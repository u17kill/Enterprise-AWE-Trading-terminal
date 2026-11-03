# V1.7 Portfolio Totals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a blue option status and transparent USD-only portfolio rollups to the existing editable holdings map.

**Architecture:** Keep the current `PortfolioMatrix` as the source of truth and compute totals with a pure function. Render the same computed result in a top dashboard and per-cell badges, while extending status parsing and styling for options.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, CSS.

**Spec:** `docs/superpowers/specs/2026-11-03-v17-portfolio-totals-design.md`

## Global Constraints

- Count only `held` and `add` items whose entire trimmed amount matches decimal `k` notation; treat them as USD.
- Show `option` items separately; never add option or `watch` amounts to ordinary totals.
- Preserve existing portfolio-matrix persistence, import/export, and user-edited statuses.
- Use existing editable regions, including the combined “日韩台印” group, without inferring individual countries.

## Review Focus

- Malformed amounts and ranges must not accidentally contribute a partial number.
- Duplicate display names must not merge distinct columns or groups.
- Existing backups must parse, and backups with the new option status must round-trip.
- Changing status or deleting an item must recompute every displayed total from current data.
- An empty group or cell must be distinguished from a confirmed zero amount.

---

### Task 1: Pure calculation and status model

**Files:** `src/lib/portfolio-matrix.ts`, `src/lib/portfolio-matrix.test.ts`, `src/lib/portfolio-matrix-totals.ts`, `src/lib/portfolio-matrix-totals.test.ts`

**Interfaces:** `parseUsdKAmount(amount: string): number | null`; `calculateMatrixTotals(matrix: PortfolioMatrix): MatrixTotals` with total, included count, breakdown maps keyed by IDs, and option items.

- [x] Add failing tests for accepted / rejected amount strings, status eligibility, multi-axis subtotals, duplicate names, and option round trip.
- [x] Run targeted tests to confirm the intended failures.
- [x] Extend `TileStatus`, parser validation, and implement the pure totals function.
- [x] Run targeted tests to confirm they pass (7/7).

### Task 2: Dashboard, per-cell totals, and blue cards

**Files:** `src/components/portfolio-map.tsx`, `src/components/portfolio-map.test.tsx`, `src/app/portfolio-map.css`

**Interfaces:** Consume `calculateMatrixTotals(matrix)`; keep editing and persistence path unchanged.

- [x] Add failing UI tests for option status, ordinary total and breakdown, cell subtotal, and exclusion wording.
- [x] Run targeted UI tests to confirm failures.
- [x] Add status option / legend, dashboard sections, per-cell badges in desktop and narrow layouts, and responsive CSS.
- [x] Run targeted UI tests to confirm they pass (focused set 17/17).

### Task 3: Verification and GitHub archive

**Files:** `docs/v1.7-status.md`, `docs/README.md`, this plan, PR description.

- [ ] Run targeted tests, TypeScript, lint, and build; investigate any failures that touch this change.
- [ ] Check desktop and narrow browser views plus local persistence without touching the accepted 3103 preview.
- [ ] Record delivered behavior, data limits, verification, preview location, and known failures in version docs and PR.
- [ ] Commit, push, and open a draft PR targeting `codex/v1.6-indicator-order`; keep V1.7 marked pending user acceptance.
