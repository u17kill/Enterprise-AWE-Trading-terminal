# Master Philosophy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a light themed「大师哲学」page with the user's 12 investor profiles and complete quote selections from PPT slides 21–23.

**Architecture:** Keep the anthology as static typed data, with one route and one page component. Reuse the existing shell/navigation pattern. Bundle the 12 user-provided PPT portraits as local assets with source notes; build quote expansion with native `<details>` to avoid extra state.

**Tech Stack:** Next.js 16.4 App Router, React 19, TypeScript, CSS, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-27-master-philosophy-design.md`

## Global Constraints

- Use the user's AWE PPT slides 21–23 as the quote and portrait source; keep all 12 people and three original groups in order.
- Preserve the excerpt wording except whitespace/punctuation cleanup. Describe it as a personal excerpt collection, with original publication attribution not independently verified.
- No market fetch, OAuth dependency, editing, or 13F linkage.
- Update `docs/v0.10-status.md`, `docs/README.md`, and the version PR before completion.

## Review Focus

- A card with many quotes must expand to show every quote, in order, without clipping: component test in Task 2.
- A portrait that cannot load must still have an accessible person name: `alt` and initial fallback in Task 2.
- Each quote group must map to the correct person despite PPT XML ordering: data assertions in Task 1.
- Mobile width must not cut off cards or horizontal navigation: visual browser check in Task 2.
- Navigation from existing modules must reach `/philosophy` and mark it active there: component/navigation check in Task 2.

---

### Task 1: Source anthology

**Files:**
- Create: `src/lib/master-philosophy.ts`
- Create: `src/lib/master-philosophy.test.ts`
- Create: `public/master-philosophy/*.png` (the 12 embedded PPT portraits, extracted and mapped by slide image relationship)
- Modify: `docs/superpowers/specs/2026-10-27-master-philosophy-design.md` (record source mapping and any attribution limits)

**Interfaces:**
- Produces: `type Master = { id: string; name: string; englishName: string; portrait: string; bio: string; bioSource: string; quotes: readonly string[] }` and `MASTER_GROUPS: readonly { id: string; name: string; masters: readonly Master[] }[]`.

- [ ] **Step 1: Write failing data test** asserting group order, 4 people per group, nonempty bio/source/portrait, unique IDs, and exact first/last quote per person from the three source slides.
- [ ] **Step 2: Run** `pnpm exec vitest run src/lib/master-philosophy.test.ts`; expect failure before data exists.
- [ ] **Step 3: Extract images and implement anthology** with all PPT quotations; cross-check names and image relationship mapping against slides 21–23. Keep biographies brief, stable and sourced.
- [ ] **Step 4: Re-run the test** and verify all assertions pass.

### Task 2: Page, navigation, responsive layout

**Files:**
- Create: `src/app/philosophy/page.tsx`
- Create: `src/components/master-philosophy.tsx`
- Create: `src/components/master-philosophy.test.tsx`
- Create: `src/app/master-philosophy.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/dashboard.tsx`, `financial-calendar.tsx`, `leader-holdings.tsx`, `market-news.tsx`, `portfolio-map.tsx`, `options-calculator.tsx`, `chart-workspace.tsx`

**Interfaces:**
- Consumes: `MASTER_GROUPS` from Task 1; route `/philosophy`.
- Produces: a one-page three-section view, accessible portrait and expandable quote lists, and navigation links from existing screens.

- [ ] **Step 1: Write failing component/navigation tests** for page title, 12 names, all three groups, quote expansion, portrait alt text, source note, and link/active state.
- [ ] **Step 2: Run** `pnpm exec vitest run src/components/master-philosophy.test.tsx src/components/dashboard.test.tsx`; expect failure on absent route/nav.
- [ ] **Step 3: Implement route, component, CSS and navigation** using the existing shell styles and native `<details>` for long quote lists.
- [ ] **Step 4: Re-run focused tests** until green; check desktop and narrow viewport in the browser.

### Task 3: Version record and final checks

**Files:**
- Create: `docs/v0.10-status.md`
- Modify: `docs/README.md`
- Modify: version PR body on GitHub.

- [ ] **Step 1: Record** requirements, delivered page, portrait/quote provenance, limitations and verification in the version status document and README index.
- [ ] **Step 2: Run** full `pnpm exec vitest run --maxWorkers=2`, `pnpm lint`, `pnpm build`, `git diff --check`; resolve concrete failures.
- [ ] **Step 3: Verify** `/philosophy` in the local 3101 browser, including navigation and visible profiles.
- [ ] **Step 4: Commit and push** branch `codex/v0.10-master-philosophy`; create or update PR with matching scope, limits and test results.
