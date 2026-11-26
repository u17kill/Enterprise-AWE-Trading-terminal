# V1.16 Intelligence and Holdings Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent backend, five-page renderer and native portfolio work; root integrates navigation, documentation and verification.

**Goal:** Replace the five market-intelligence pages and update current portfolio in investment tools, preserving the latest local holdings.

**Architecture:** Native Next route shell, five isolated reference renderers, durable Python-backed read/refresh channels; native portfolio editor and revision-aware atomic file store.

**Tech Stack:** Next.js16, React, TypeScript, Python standard library plus existing environment, local CSS/JS.

**Spec:** docs/superpowers/specs/2026-11-24-v116-intelligence-holdings.md; docs/intelligence-holdings-requirements.md.

## Global constraints

No initial private holdings overwrite; failures never clear old data. No unrelated top-level navigation changes. No generated investment judgments or hidden missing values. Freshness per page. Live market data remains out of scope for this group.

## Tasks

- [x] Back up and record latest local portfolio checksums; capture public-source provenance separately.
- [x] Five-channel backend: exact API responses, disk snapshots, process locks, wind/13F detached progress jobs; schema/error tests with temporary data.
- [x] Five-page UI: all reference functional sections, source flags, filters, sidebar destinations and consistent title→tabs→content order; responsive layouts.
- [x] Native portfolio: debounce by captured book, seven save states, conflicts, strict sums, weight states, complete review/date diagnostics; two-book isolated save tests.
- [x] Integrate five shared tabs inside 市场情报; portfolio stays 投资工具. Preserve aliases consumed by market overview and explicit oldhash compatibility.
- [x] Offline snapshot export and no-CDN validation; keep local-only editing clearly labeled.
- [x] Real refresh/progress checks, failure/429 recovery, desktop/mobile pages, source counts and unchanged holdings checksum checks.
- [x] Independent review, fix findings, build/lint/tests, docs/README + v1.16-status + draftPR synchronized. Do not merge before acceptance.

## Review focus

Private draft/file conflict; two-book debounce crossover; artificial source judgments; old13F incorrectly labeled latest; all-network-failure counted success; snapshot clocks; XSS/URL handling; cross-page refresh progress; missing calendar evidence; offline save provenance.

验证证据、数据源限制、首次SEC中断与重试成功、持仓保护和兼容决定统一记录于 docs/v1.16-status.md。版本以草稿PR交付，尚未用户验收或合并。
