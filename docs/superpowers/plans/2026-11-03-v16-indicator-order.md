# V1.6 Indicator Card Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let the user reorder indicator cards within each Indicator Catalog category and retain that order on this computer across refreshes and local preview ports.

**Architecture:** Keep order as indicator IDs, separate from readings. Validate and normalize stored IDs against the live catalog so new indicators append and removed IDs disappear. Save the preference in a local server file through a localhost-only route; the client provides drag handles and keyboard move buttons.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Testing Library, native HTML drag events.

**Spec:** `docs/superpowers/specs/2026-11-03-v16-indicator-order-design.md`

## Global Constraints

- Only `/canary` Indicator Catalog changes; the other three canary pages stay as they are.
- Moves stay within macro, US, or China categories.
- Order persists on one computer and across local preview ports; no account or multi-device sync.
- Readings, refresh behavior, sources, explanations, and the placeholder card remain intact.

## Review Focus

- A stored removed or duplicate indicator ID must not break the catalog.
- A newly added catalog indicator must appear after saved cards, before the placeholder.
- A failed save must be visible and must not silently claim persistence.
- Dragging must not accidentally toggle a card's details.
- Reordering one category must not disturb another category.

---

### Task 1: Order model and local storage

**Files:** Create `src/lib/canary-order.ts`, `src/lib/canary-order.test.ts`, `src/lib/canary-order-store.ts`, `src/lib/canary-order-store.test.ts`, `src/app/api/canary-order/route.ts`, `src/app/api/canary-order/route.test.ts`.

**Interfaces:** `normalizeCanaryOrder(raw): CanaryOrder`, `moveCanaryIndicator(order, band, sourceId, targetId, after): CanaryOrder`, `readStoredCanaryOrder(directory?): Promise<CanaryOrder>`, `writeStoredCanaryOrder(value, directory?): Promise<void>`.

- [x] Write tests for defaults, valid moves, stale IDs, new IDs, file roundtrip, invalid writes, and local route access.
- [x] Run targeted tests to observe the missing-feature failures.
- [x] Implement model, atomic file store, and localhost-only GET/PUT route.
- [x] Run targeted tests until green; commit Task 1.

### Task 2: Card controls and persistence

**Files:** Modify `src/components/canary-dashboard.tsx`, `src/components/canary-dashboard.test.tsx`, `src/app/canary.css`.

**Interfaces:** Client loads `/api/canary-order` on entry and saves moved order through `PUT`. Reorder controls operate only in the current category.

- [x] Write tests for independent category move, refresh data preserving order, save failure feedback, and controls that do not expand cards.
- [x] Run targeted tests to observe failures.
- [x] Add drag handle, drop target styling, keyboard up/down controls, reset action, and server persistence.
- [x] Run targeted tests until green; commit Task 2.

### Task 3: Version record and verification

**Files:** Update `docs/v1.6-status.md`, `docs/README.md`, and the V1.6 design doc if decisions changed.

- [x] Run focused tests, TypeScript, ESLint, and production build.
- [x] Check the page in a separate preview, including drag/drop, refresh, and persisted order.
- [x] Record delivered behavior, limits, and test results; commit documentation.
- [x] Push `codex/v1.6-indicator-order` and open a V1.6 PR with matching description.
