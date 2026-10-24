# V0.3 Portfolio Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the editable, persistent portfolio matrix shown in the reference screenshot.

**Architecture:** Keep the V1.3 data model and key intact. Add a V0.3 matrix model and seeded reference data, then replace the portfolio page and stylesheet with a responsive table plus modal editors.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, browser localStorage.

**Spec:** `docs/superpowers/specs/2026-10-24-v03-portfolio-matrix.md`

## Global Constraints
- Preserve old private browser data.
- Screenshot amounts are reference labels, not calculated or live positions.
- Every tile and grouping can be edited and removed.

## Review Focus
- Corrupt local data falls back to the reference matrix.
- Deleting a theme or region removes only its contained tiles after confirmation.
- Editing a tile keeps its identity and placement.
- Empty matrix can be rebuilt with add controls.
- Narrow screens retain alignment via scrolling.

### Task 1: Matrix model and seed

**Files:** Create `src/lib/portfolio-matrix.ts`, `src/lib/portfolio-matrix.test.ts`.

- [x] Test the seed's group/theme/region structure, status examples and parsing of malformed data.
- [x] Run the focused test and confirm failure.
- [x] Add typed model, screenshot transcription, local storage loader and validator.
- [x] Run focused tests and confirm pass.

### Task 2: Editable matrix UI

**Files:** Replace `src/components/portfolio-map.tsx`, `src/app/portfolio-map.css`; create `src/components/portfolio-map.test.tsx`.

- [x] Test a tile edit, new tile, theme edit/delete, state color, and saved remount.
- [x] Run the focused test and confirm failure.
- [x] Build the matrix table, controls, modal editors and local persistence.
- [x] Run focused tests and confirm pass.

### Task 3: Verify and deliver

**Files:** Update `docs/v1.3-status.md` only if a status note is needed; otherwise add `docs/v0.3-status.md`.

- [x] Run all tests, lint and production build.
- [x] Review the diff and create a branch commit.
- [x] Push and open a draft PR stacked on the existing V1.3 branch.
