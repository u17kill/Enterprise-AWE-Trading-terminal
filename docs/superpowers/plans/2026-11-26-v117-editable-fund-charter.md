# V1.17 Editable Fund Charter Implementation Plan

**Goal:** Edit one existing charter, add pillars/principles, keep changes across application iterations.
**Spec:** docs/superpowers/specs/2026-11-26-v117-editable-fund-charter.md
**Architecture:** Shared typed/validated document and original-text defaults; native client editor; server file store with revisions and backups; GET/PUT API. Existing /charter route and prominent entry retained.

- [x] Define model/default migration and safe validation in fund-charter-document.ts.
- [x] Independently implement store/API + temp-file tests; no writes to real source files during tests.
- [x] Native read/edit UI, add/delete/move/reorder, browser draft recovery, file conflicts, import/export.
- [x] Browser validation against isolated data root, original-text/unit/API tests, layout checks, final review.
- [x] Version status/README/design + draft GitHub PR with verification and limits; no automatic merge.

Ruling: local source file wins over code defaults, but unsaved browser drafts are preserved and conflicts require a choice. A malformed source file must not silently reset the constitution.
