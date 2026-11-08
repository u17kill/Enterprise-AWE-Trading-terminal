# V1.10 Latest Voices Curated Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sparse news-index view with a 125-person curated viewpoint map matching the supplied data and interactions.

**Architecture:** Commit nine curated JSON shards. A server-only loader merges and validates them on each request, computes stats and freshness, and exposes a no-store API. The page receives an initial snapshot from the server; a client component handles filtering, scrolling, brief expansion and manual reload without generating viewpoints.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, CSS.

**Spec:** `docs/superpowers/specs/2026-11-09-v110-latest-voices-curated-design.md`

## Global Constraints

- Keep the 125 people, 448 points, six fixed categories, 11 human-written brief items and original dated source labels.
- State that source originals have not been verified individually; never synthesize a viewpoint on refresh.
- Keep V1.9 and other sections unaffected; maintain V1.10 records in GitHub.

## Review Focus

- A source shard with a duplicate id must keep the first occurrence, while invalid required fields must fail loading.
- `YYYY-MM` dates must not be silently expanded to a fabricated day in the UI.
- Searching a hidden point must still find its person; compact mode must keep the first point.
- Clicking a category hidden by filters must clear them visibly before scrolling.
- Failed refresh must leave the prior snapshot and counts intact.

---

### Task 1: Curated data and loader

**Files:** `data/voices/part1.json` … `part9.json`, `src/lib/voices-curated.ts`, `src/lib/voices-curated-source.ts`, `src/lib/voices-curated.test.ts`.

- [ ] Copy the nine reference shards and write failing tests for merge, validation, counts, date precision and freshness.
- [ ] Implement pure types/validation/stats plus server-only file loading; run focused tests.
- [ ] Add build gate for structural validation and check the real 125/448 snapshot.

### Task 2: API and page

**Files:** `src/app/api/voices/route.ts`, `src/app/voices/page.tsx`, `src/components/latest-voices.tsx`, `src/app/latest-voices.css`, tests.

- [ ] Write failing tests for API reload, visible counts, search, filtering, compact mode, jump and refresh failure.
- [ ] Implement the server initial read and client page in the existing visual system; run focused tests and TypeScript.

### Task 3: Source audit and release record

**Files:** `docs/v1.10-source-audit.md`, `docs/v1.10-status.md`, `docs/README.md`.

- [ ] Audit ten stratified source claims using primary or named outlets and record supported/uncertain results.
- [ ] Run focused tests, lint and Next production build; update limits and version index.
- [ ] Commit, push `codex/v1.10-latest-voices`, create a draft PR based on V1.9 and sync its body to records.
