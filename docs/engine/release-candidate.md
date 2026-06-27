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
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

## Residual Risks

- The package is marked `UNLICENSED` until a repository license is chosen.
- The extension kernel manages local install/uninstall lifecycle but does not manage remote loading, sandboxing, trust policy, or persistence.
- Performance coverage includes deterministic local 10k-candle and 50k-candle acceptance baselines. Broader device, browser, and production telemetry benchmarks remain post-RC work.
- npm audit currently reports development dependency vulnerabilities; fixing them may require dependency upgrades outside this RC hardening scope.

## Acceptance Evidence

Completed on 2026-06-27:

- `npm run test` passed: 32 test files, 393 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 141 files scanned.
- `npm run guard:public-api` passed: 110 runtime exports.
- `npm run guard:public-types` passed: 291 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 112 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 32 browser tests.
