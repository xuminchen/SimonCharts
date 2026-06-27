# Chart Engine v0.8 API Stabilization Writing Plan

**Problem:** SimonCharts Engine is now a usable v0.7 SDK with rendering diagnostics and a productized drawing editor, but the API stability gate still focuses mainly on runtime exports. A reusable Engine package also needs external type-consumer verification and a guard that host-facing code imports only from the package root.

**Goal:** Stabilize the SDK boundary for external consumers. v0.8 should prove that runtime exports, declaration exports, package installation, and repository consumers use the intended package-root API without importing internal Engine files.

**Boundary:**
- Engine code must not import TradingReviewSystem APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, or persistence services.
- Engine code must not import `apps/*`.
- Host-facing code must import `@simoncharts/chart-engine` from the package root, not internal package subpaths or `packages/chart-engine/src`.
- v0.8 does not add new chart behavior, drawing behavior, host persistence, or TradingReviewSystem work.

## Success Criteria

1. Runtime public exports remain snapshot-guarded.
   - Verify with `npm run guard:public-api`.
2. External type-only package consumers compile against built declarations.
   - Verify with a dedicated package type-consumer check.
3. App and script consumers do not import Engine internals.
   - Verify with a dedicated SDK import guard.
4. Package consumer smoke covers recently added Engine APIs.
   - Verify `createDrawingEditor().executeCommand()` and `getCapabilities()` from the package root.
5. Documentation tells future hosts which import surfaces are stable.
   - Verify docs include v0.8 checks and commands.

## Non-Goals

- No host app integration.
- No new drawing tools or chart series.
- No compatibility wrappers around internal paths.
- No API renaming in this phase.
- No semver automation beyond package version and explicit guards.

## Proposed v0.8 Scope

1. Type consumer fixture
   - Add a small external-consumer TypeScript file under `scripts/fixtures`.
   - Import both runtime values and type-only contracts from `@simoncharts/chart-engine`.
   - Compile it with package exports and built declarations.

2. SDK import guard
   - Add a script that scans apps and scripts for forbidden internal Engine imports.
   - Allow only package-root imports for host-facing code.
   - Exclude docs and package source internals from this host-facing guard.

3. Package consumer smoke expansion
   - Extend the runtime package consumer script to use V0.7 drawing editor command/capability APIs.

4. Documentation
   - Update public API, host integration, and testing strategy docs.
   - Record v0.8 acceptance evidence.

5. Versioning
   - Advance `@simoncharts/chart-engine` to `0.8.0`.

## Validation Gate

Run before accepting v0.8:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run build
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

