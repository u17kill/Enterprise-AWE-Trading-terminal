# V1.18 Personal Notes Implementation Plan

> Agentic workers: use subagent-driven-development for independent store and UI boundaries; root owns save controller and integration. User approved design on 2026-11-26; proceed continuously.

**Goal:** Private single notes board in Investment Tools with original-text preservation and safe autosave.
**Architecture:** Native dynamic Next page; validated board model; external JSON file with revision/lock/backups; observable client autosave controller and browser draft adapter; native board/drawer.
**Tech Stack:** existing React/Next/TypeScript/Vitest/Playwright, no new dependencies.
**Spec:** docs/superpowers/specs/2026-11-26-v118-personal-notes-design.md

## Global Constraints

No user text in Git or tests. External notes.json, notes-backups rolling40. Default3 empty columns only if missing. 600ms debounce, one save in flight, revision conflicts halt autosave. 2MiB request/file bound, UTF16 body.length stats. Pure text; preserve whitespace and unknown fields. Correct local time. No offline-install claims.

## Review Focus

- Input during slow saves must remain dirty and survive late responses.
- Reload must wait for writes and never erase drafts on failed GET.
- Duplicated tabs must fork draft keys; no foreign draft deletion.
- Moving cards must preserve text/unknown metadata and update position timestamps.
- Search-hidden matches and IME must not break editing or reorder actual data.

## Shared interfaces

notes-document.ts: NotesCard{id,title,body,created,updated,[key:string]:unknown}, NotesColumn{id,title,cards,[key:string]:unknown}, NotesBoard{schemaVersion:1,updated,columns,[key:string]:unknown}, NotesStats{columns,cards,chars}, NotesSnapshot{ok,notes:NotesBoard|null,revision,updatedAt:string|null,stats?,warnings:string[],error?,backup?,bytes?}. defaultNotes(), validateNotes(raw)->{errors,warnings}, notesStats(board), formatNotesTime(value,short?).

## Task1 Store/API and model

Files src/lib/notes-document.ts, notes-store.ts and tests; src/app/api/notes/route.ts and tests.
- [x] Write/run failing tests: defaults absent, body exact/emoji stats, duplicate ids, unknown roundtrip, stale revision, cross-process lock, backup40, damaged/backup failure preservation, local Host matching and 2MiB API.
- [x] Implement readNotes(dir?), saveNotes(notes,revision,dir?) -> NotesSnapshot; NotesStoreError codes. data dir override AWE_NOTES_DATA_DIR/portfolio root fallback, notes-backups only.
- [x] Verify tests and targeted lint. Review diff; no private data writes.

## Task2 Save controller and drafts (root)

Files src/lib/notes-session.ts + tests; src/hooks/use-notes-board.ts.
- [x] Write/run failing concurrency tests: one request, pending new input preserved, revision chaining, 409 pauses, offline draft, retry, reload failure preserves, reload waits for write and blocks edit.
- [x] Implement observable NotesSession and hook exposing board/status/error/draftError/locked/conflict/choices/change/retry/reload/resolve/restore.
- [x] Every input synchronously preserves browser draft; reload is read-first; per-mount key/session pointer forks duplicate tabs; only own key cleared; historical drafts manual. Tests and lint.

## Task3 Board/UI (independent)

Files src/components/personal-notes.tsx + test, src/app/personal-notes.css. Consumes useNotesBoard. No navigation/page mutations until integration.
- [x] Write/run failing tests CRUD, drawer, search, reordering/move, empty/long titles, exact body, keyboard, count.
- [x] Implement same-tool heading/nav, board-internal scroll, lane inline rename, DnD+buttons, card drawer and disabled search reorder, export all board.
- [x] Verify targeted tests/lint. Read-only review and fix.

## Task4 Integration and verification

Files src/app/notes/page.tsx, app-sidebar.tsx, tools-page-nav.tsx, navigation tests, gitignore, docs.
- [x] Dynamic request-time read and safe unavailable state; add fourth tool entry both navs; explicitly ignore private notes data/backup patterns.
- [x] Full tests/type/lint/build; browser isolated preview: CRUD/search/move/save/reload/restart/conflict, 4 viewports and200 cards/50k text; no writes real notes.
- [x] Independent review, fix any meaningful issues with tests. Update design/status/README/PR35; push branch; no merge. Normal preview updated only after checks.
