# Release Candidate

`@simoncharts/chart-engine@1.0.0-rc.0` is the first release candidate for the independent SimonCharts Engine package.

## Scope

The release candidate includes:

- neutral market data, viewport, theme, settings, and chart state contracts
- Engine-owned capability manifest for package metadata, API version, release channel, supported series, built-in drawings, core indicators, drawing editor capabilities, interaction capabilities, visual output families, and extension contribution types
- Engine-owned API version compatibility checker for exact package/API/release diagnostics
- Engine-owned capability requirement checker for deterministic manifest compatibility diagnostics
- Engine-owned extension compatibility preflight helpers for deriving contribution requirements and checking them against the capability manifest
- Engine-owned extension validation diagnostics for local extension structure and contribution issues
- Engine-owned lifecycle install validation diagnostics for already-installed ids and local contribution conflicts
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
- extension registration and local lifecycle management for series renderers, visual renderers, drawing renderers, drawing tools, and figure renderers, including atomic local rollback for failed lifecycle installs
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
npm run check:host-smoke
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

Current acceptance evidence refreshed on 2026-07-01:

- `npm run test` passed: 44 test files, 508 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:host-smoke` passed for a packed tarball installed into a temporary non-workspace host.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.

Focused Release Readiness API Snapshot Coverage evidence on 2026-07-01:

- `npm run test -- scripts/__tests__/check-release-readiness.test.mjs -- --reporter=dot` passed: 3 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run build` passed for the Engine package and playground.
- `npm run test` passed: 44 test files, 508 tests.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `lsof -nP -iTCP:5173 -sTCP:LISTEN` returned no listener after e2e.

Focused Runtime API Snapshot Integrity evidence on 2026-07-01:

- `npm run test -- scripts/__tests__/check-public-api.test.mjs -- --reporter=dot` passed: 6 tests.
- `node scripts/check-public-api.mjs --write` passed and left `packages/chart-engine/api-surface.json` unchanged.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run test` passed: 43 test files, 505 tests.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `git diff --check` passed.

Focused Public API Snapshot Writer evidence on 2026-07-01:

- `npm run test -- scripts/__tests__/check-public-api.test.mjs -- --reporter=dot` passed: 3 tests.
- `node scripts/check-public-api.mjs --write` passed and left `packages/chart-engine/api-surface.json` unchanged.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run test` passed: 43 test files, 502 tests.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `git diff --check` passed.

Focused Engine API Version Compatibility evidence on 2026-07-01:

- `npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot` passed: 15 tests.
- `npm run typecheck -w @simoncharts/chart-engine` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime exports `checkEngineApiVersionCompatibility` and `engineApiVersion`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `EngineApiVersionCheckResult`, `EngineApiVersionMismatch`, `EngineApiVersionRequirement`, `EngineReleaseChannel`, `checkEngineApiVersionCompatibility`, and `engineApiVersion`.
- Runtime API snapshot was intentionally refreshed to 148 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 393 type symbols.
- `npm run guard:public-api` passed: 148 runtime exports.
- `npm run guard:public-types` passed: 393 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:sdk-imports` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run test` passed: 42 test files, 499 tests.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `git diff --check` passed.

Focused Extension Lifecycle Rollback evidence on 2026-07-01:

- `npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot` passed: 25 tests.
- `npm run typecheck -w @simoncharts/chart-engine` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run build -w @simoncharts/chart-engine` passed.
- `npm run guard:public-api` passed unchanged: 146 runtime exports.
- `npm run guard:public-types` passed unchanged: 387 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run guard:sdk-imports` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run typecheck` passed.
- `npm run build` passed for the Engine package and playground.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run test` passed on rerun: 42 test files, 495 tests.
- `git diff --check` passed.

Focused Extension Install Validation evidence on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot` passed: 23 tests.
- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` passed unchanged at 146 runtime exports.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `ChartExtensionInstallValidationIssue`, `ChartExtensionInstallValidationIssueCode`, and `ChartExtensionInstallValidationResult`.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 387 type symbols.
- `npm run guard:public-api` passed: 146 runtime exports.
- `npm run guard:public-types` passed: 387 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 160 files scanned.
- `npm run guard:sdk-imports` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run test` passed: 42 test files, 493 tests.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:package-artifact` passed: 121 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 121 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
- `git diff --check` passed.

Focused Extension Validation evidence on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot` passed: 18 tests.
- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `validateChartExtension`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `ChartExtensionValidationIssue`, `ChartExtensionValidationIssueCode`, `ChartExtensionValidationResult`, and `validateChartExtension`.
- Runtime API snapshot was intentionally refreshed to 146 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 384 type symbols.
- `npm run guard:public-api` passed: 146 runtime exports.
- `npm run guard:public-types` passed: 384 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed on the full suite: 43 browser tests.
- `git diff --check` passed.

Focused Extension Compatibility evidence on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts -- --reporter=dot` passed: 13 tests.
- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime exports `checkChartExtensionCompatibility` and `getChartExtensionCapabilityRequirements`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `checkChartExtensionCompatibility` and `getChartExtensionCapabilityRequirements`.
- Runtime API snapshot was intentionally refreshed to 145 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 380 type symbols.
- `npm run guard:public-api` passed: 145 runtime exports.
- `npm run guard:public-types` passed: 380 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- Initial full `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` hit two unrelated timeouts; both failed tests passed individually, and the full e2e suite passed on rerun: 43 browser tests.
- `git diff --check` passed.

Focused Engine Capability Requirements evidence on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot` passed: 11 tests.
- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `checkEngineCapabilityRequirements`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `EngineCapabilityCheckResult`, `EngineCapabilityRequirementGap`, `EngineCapabilityRequirementKey`, `EngineCapabilityRequirements`, and `checkEngineCapabilityRequirements`.
- Runtime API snapshot was intentionally refreshed to 143 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 378 type symbols.
- `npm run guard:public-api` passed: 143 runtime exports.
- `npm run guard:public-types` passed: 378 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `git diff --check` passed.

Focused Engine Capability Manifest evidence on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts -- --reporter=dot` passed: 5 tests.
- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `createEngineCapabilityManifest`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `DrawingEditorCapability`, `EngineCapabilityManifest`, `EngineDrawingToolCapability`, `ExtensionContributionType`, `InteractionCapability`, and `createEngineCapabilityManifest`.
- Runtime API snapshot was intentionally refreshed to 142 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 373 type symbols.
- `npm run guard:public-api` passed: 142 runtime exports.
- `npm run guard:public-types` passed: 373 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `git diff --check` passed.

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
