# Chart Engine v0.4 Integration Readiness Implementation Plan

**Goal:** Make `@simoncharts/chart-engine` usable as a stable, host-independent SDK before the TradingReviewSystem pilot. v0.4 hardens package output, public API boundaries, host adapter examples, persistence contracts, and performance evidence without importing any host business code.

**Architecture:** `packages/chart-engine` remains the reusable kernel. `apps/playground` remains the neutral browser acceptance harness. Host applications may consume only the package root exports and neutral contracts: `CandleSeries`, `ViewportState`, `DrawingObject`, serialized drawings, `IndicatorVisualOutput`, commands, settings, and `HostAdapter`.

## Boundary Rules

- Engine code must not import `apps/*`.
- Engine code must not import TradingReviewSystem APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, or persistence services.
- Package artifacts must be generated from `packages/chart-engine/src` into `packages/chart-engine/dist`.
- Host examples must stay neutral and must not include a concrete TradingReviewSystem adapter.

## Task 1: Package SDK Output

**Files:**
- Modify: `packages/chart-engine/package.json`
- Modify: `packages/chart-engine/tsconfig.json`
- Create: `packages/chart-engine/vite.config.ts`

**Steps:**
1. Configure package exports to point at `dist/index.js` and `dist/index.d.ts`.
2. Build JavaScript with Vite library mode and declarations with TypeScript.
3. Keep package root import compatible for playground and future hosts.

**Verification:**
- `npm run build -w @simoncharts/chart-engine`
- `test -f packages/chart-engine/dist/index.js`
- `test -f packages/chart-engine/dist/index.d.ts`
- `npm pack --dry-run -w @simoncharts/chart-engine`

## Task 2: Public API Surface Guard

**Files:**
- Create: `packages/chart-engine/api-surface.json`
- Create: `scripts/check-public-api.mjs`
- Modify: `package.json`

**Steps:**
1. Add a script that imports the built package and compares runtime exports against `api-surface.json`.
2. Fail when a runtime export is added or removed without updating the snapshot.
3. Keep type-only exports covered by declaration emission and package exports.

**Verification:**
- `npm run build -w @simoncharts/chart-engine`
- `npm run guard:public-api`
- `npm run guard:engine-boundary`

## Task 3: Host Contract Fixtures

**Files:**
- Create: `packages/chart-engine/src/__tests__/hostIntegrationContract.test.ts`
- Modify: `docs/engine/host-integration.md`
- Modify: `docs/engine/public-api.md`

**Steps:**
1. Add a test that creates a neutral `HostAdapter`, dispatches viewport/drawing/layout callbacks, and verifies no host model is required.
2. Add a package-consumer smoke test using only `@simoncharts/chart-engine` after build.
3. Document the minimum integration sequence for future host apps.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/hostIntegrationContract.test.ts`
- `npm run build -w @simoncharts/chart-engine`
- `node scripts/check-package-consumer.mjs`

## Task 4: Persistence And Migration Contract

**Files:**
- Create: `packages/chart-engine/src/persistence/layoutSnapshot.ts`
- Create: `packages/chart-engine/src/__tests__/persistenceContract.test.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/host-integration.md`

**Steps:**
1. Add neutral layout serialization helpers for viewport, drawings, indicator ids, settings, and schema version.
2. Round-trip serialized drawings through current migration helpers.
3. Reject unsupported layout schema versions with clear errors.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/persistenceContract.test.ts packages/chart-engine/src/__tests__/drawingSchema.test.ts`
- `npm run typecheck`
- `npm run guard:engine-boundary`

## Task 5: Performance Baseline

**Files:**
- Create: `packages/chart-engine/src/__tests__/performanceBaseline.test.ts`
- Modify: `docs/engine/testing-strategy.md`

**Steps:**
1. Generate deterministic large candle fixtures in test code.
2. Measure render-model, autoscale, indicator, drawing figure conversion, and static renderer paths with explicit upper bounds.
3. Keep thresholds conservative enough for CI variance but strong enough to catch accidental quadratic regressions.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/performanceBaseline.test.ts`
- `npm run test`

## Task 6: v0.4 Acceptance Gate

**Files:**
- Modify: `docs/engine/testing-strategy.md`

**Steps:**
1. Run the full engine and playground acceptance suite.
2. Confirm package output is installable through dry-run pack.
3. Confirm public API and engine boundary guards pass.

**Verification:**
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run build`
- `npm pack --dry-run -w @simoncharts/chart-engine`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- `npm run test` passed: 31 test files, 373 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 139 engine files scanned.
- `npm run guard:public-api` passed: 103 runtime exports.
- `npm run check:package-consumer` passed.
- `npm run build` passed for `@simoncharts/chart-engine` and `@simoncharts/playground`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed and included `dist/index.js`, `dist/index.d.ts`, and declaration files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 31 browser tests.
