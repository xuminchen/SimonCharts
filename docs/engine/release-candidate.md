# Release Candidate

`@simoncharts/chart-engine@1.0.0-rc.0` is the first release candidate for the independent SimonCharts Engine package.

## Scope

The release candidate includes:

- neutral market data, viewport, theme, settings, and chart state contracts
- 17 built-in chart series types through `supportedSeriesTypes`
- static canvas rendering and layered rendering primitives
- interaction engine, interaction session, crosshair state, and render scheduler
- visual output renderers for line, histogram, band, and marker outputs
- panel layout and scale helpers
- 63 built-in drawing tools
- command-driven drawing editor with selection, drag, anchor editing, style editing, text editing, z-order, copy, paste, duplicate, lock, hide, delete, undo, and redo
- Engine-owned drawing property schema for host-rendered property panels
- Engine-owned advanced drawing parameters for Fibonacci levels, Gann ratios, position labels, and range labels
- Engine-owned drawing interaction primitives for box selection, keyboard nudging, and edit handles
- Engine-owned drawing body hit-test for neutral drawings, renderer registries, hidden/locked filtering, and distance/z-order sorting
- Engine-owned drawing hover intent for neutral drawings, selected handles, pointer points, renderer registries, target ids, and cursor intent
- Engine-owned OHLC magnet target projection from neutral candle series, viewport, plot area, optional price range, and optional fields
- Engine-owned drawing magnet snap state for neutral points, magnet targets, snap radius, snapped points, matched targets, and neutral magnet session state
- Engine-owned drawing handle drag flow for anchor, resize, and rotate operations
- Engine-owned drawing move drag flow for selected drawing body movement previews and one final command
- Engine-owned drawing selection box flow for preview ids and final selection commands
- Engine-owned drawing transform primitives for resize and rotate commands
- drawing serialization and layout snapshot contracts
- extension registration and local lifecycle management for series renderers, visual renderers, drawing renderers, drawing tools, and figure renderers
- SDK guards for runtime public API, type public API, package-root imports, runtime consumers, and type consumers

## Boundaries

The engine remains host-independent. It does not import TradingReviewSystem, host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, product persistence, or product workflow modules.

Hosts own:

- market data loading
- authentication and user accounts
- persistence and collaboration
- routing and product UI
- DOM cursor styling, pointer events, and hover invalidation
- drawing magnet toggles, target collection timing, render invalidation, and UI toggles
- business workflows
- extension distribution and trust policy

## Non-Goals

`1.0.0-rc.0` does not include:

- remote plugin loading
- plugin sandboxing
- marketplace behavior
- cloud persistence
- collaborative editing
- host app workflows
- TradingReviewSystem integration
- npm publication automation

## Release Gate

Run:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run check:performance
npm run check:release-readiness
npm run build
npm run check:package-artifact
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

## Residual Risks

- The package is marked `UNLICENSED` until a repository license is chosen.
- The extension kernel manages local install/uninstall lifecycle but does not manage remote loading, sandboxing, trust policy, or persistence.
- Performance coverage includes deterministic local 10k-candle and 50k-candle acceptance baselines. Broader device, browser, and production telemetry benchmarks remain post-RC work.
- npm audit currently reports development dependency vulnerabilities; fixing them may require dependency upgrades outside this RC hardening scope.

## Acceptance Evidence

Completed on 2026-06-28:

- `npm run test` passed: 41 test files, 466 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 158 files scanned.
- `npm run guard:public-api` passed: 141 runtime exports.
- `npm run guard:public-types` passed: 367 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run check:package-artifact` passed: 120 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 120 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.

Focused OHLC Magnet Target Projection Task 3 evidence on 2026-06-28:

- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `createOhlcMagnetTargetsFromSeries`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `MagnetPlotArea`, `MagnetPriceRange`, `OhlcMagnetTargetOptions`, and `createOhlcMagnetTargetsFromSeries`.
- Runtime API snapshot was intentionally refreshed to 141 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 367 type symbols.
- `npm run guard:public-api` passed: 141 runtime exports.
- `npm run guard:public-types` passed: 367 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `git diff --check` passed.

Focused Drawing Magnet Snap State Task 3 evidence on 2026-06-28:

- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `getMagnetSnapState`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `MagnetSnapState`, `MagnetSnapStateOptions`, and `getMagnetSnapState`.
- Runtime API snapshot was intentionally refreshed to 140 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 363 type symbols.
- `npm run guard:public-api` passed: 140 runtime exports.
- `npm run guard:public-types` passed: 363 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `git diff --check` passed.

Focused Drawing Hover Intent Task 3 evidence on 2026-06-28:

- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `getDrawingHoverState`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added hover type symbols.
- Runtime API snapshot was intentionally refreshed to 139 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 360 type symbols.
- `npm run guard:public-api` passed: 139 runtime exports.
- `npm run guard:public-types` passed: 360 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.

Completed on 2026-06-27:

- `npm run test` passed: 39 test files, 446 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 155 files scanned.
- `npm run guard:public-api` passed: 138 runtime exports.
- `npm run guard:public-types` passed: 355 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-artifact` passed: 119 package files.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 119 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 39 browser tests.
