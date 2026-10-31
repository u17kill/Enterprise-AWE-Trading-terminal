# V1.3 Fund Charter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the user-approved ten principles as a readable page with a persistent top-right entry.

**Architecture:** Store the user text as structured static content and render it in a server page. Reuse one link component in every page header. Keep the page's style isolated in its own CSS file.

**Tech Stack:** Next.js 16 App Router, React 19, CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-v13-fund-charter-design.md`

## Global Constraints

- Preserve the supplied Chinese copy and the exact 3% and 25% risk limits.
- Keep the charter out of the ordinary left navigation.
- The top-right entry must be available from every existing page.
- Record delivery, verification, and limits in the V1.3 status and PR.

## Review Focus

- Both risk limits remain visible and unchanged; test the rendered page.
- Ten principles display in the supplied order; test headings.
- Four pillar anchors and closing anchor resolve; test links.
- All current routes retain a top-right charter link; test shared link plus inspect headers.
- Mobile width has no horizontal overflow; inspect responsive CSS.

---

### Task 1: Charter content and page

**Files:** Create `src/lib/fund-charter.ts`, `src/app/charter/page.tsx`, `src/app/fund-charter.css`; modify `src/app/layout.tsx`; test `src/app/charter/page.test.tsx`.

- [x] Write a test for ten ordered articles, four anchors, full risk limits, and closing principle.
- [x] Run the test and confirm it fails because the page is absent.
- [x] Add exact structured copy and responsive reading page.
- [x] Run the focused test and confirm it passes.

### Task 2: Persistent global entry

**Files:** Create `src/components/fund-charter-link.tsx`; modify all ten existing page headers and `src/app/fund-charter.css`; test `src/components/fund-charter-link.test.tsx`.

- [x] Write a link test for target, name, and icon.
- [x] Run the test and confirm it fails because the component is absent.
- [x] Add the shared link to each header; keep existing header controls available.
- [x] Run focused tests and inspect mobile header CSS.

### Task 3: Version record and release checks

**Files:** Update `docs/v1.3-fund-charter-status.md`, `docs/README.md`, and draft PR #18.

- [x] Run focused tests, lint, and production build.
- [x] Record actual results and known limits.
- [ ] Commit and push branch; sync draft PR description.
