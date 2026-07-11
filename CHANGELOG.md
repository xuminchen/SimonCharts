# Changelog

## 1.0.0-rc.0 - 2026-06-27

- Added exact bounded JSON checkpoints for all 16 core indicators and five stateful synthetic series transforms.
- Added Point & Figure provisional-tail replacement and precomputed bounded render models with global source-index offsets.
- Prepared `@simoncharts/chart-engine` as the first v1.0 release candidate.
- Documented package usage, root-only SDK imports, release scope, and release validation.
- Added package metadata for external consumption without adding host app coupling.
- Added `npm run check:release-readiness` to verify required package metadata, docs, exports, and release scripts.
- Preserved the Engine boundary: no host API, store, schema, route, TradingReviewSystem, review, strategy, watchlist, AI, auth, account, billing, portfolio, or product persistence imports.

## 0.9.0 - 2026-06-27

- Added the neutral extension kernel for chart, visual, drawing, and figure contributions.
- Added namespaced custom drawing type validation.
- Added SDK consumer checks for extension APIs.

## 0.8.0 - 2026-06-27

- Hardened package-root SDK consumption.
- Added runtime and type consumer checks.
- Added SDK import boundary guard.

## 0.7.0 - 2026-06-27

- Productized drawing editor command execution and capability snapshots.
- Added toolbar-ready command state for copy, paste, duplicate, z-order, lock, hide, undo, and redo.

## 0.6.0 - 2026-06-27

- Hardened render scheduler diagnostics and static renderer clear behavior.
- Added deterministic performance baseline coverage.
