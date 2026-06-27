# Chart Engine v0.8 API Stabilization Implementation Plan

**Goal:** Harden SimonCharts Engine SDK consumption by adding type-consumer validation, package-root import guards, expanded package smoke coverage, and updated API documentation.

## Task 1: External Type Consumer Check

**Files:**
- Create: `scripts/fixtures/package-consumer-types.ts`
- Create: `scripts/check-package-types.mjs`
- Modify: `package.json`

**Steps:**
1. Add a TypeScript fixture that imports runtime APIs and type-only contracts from `@simoncharts/chart-engine`.
2. Cover `ChartEngine`, `CandleSeries`, `DrawingEditor`, `DrawingEditorCapabilities`, `RenderFrameDiagnostic`, `ChartLayoutSnapshot`, `IndicatorVisualOutput`, and visual/renderer registry contracts.
3. Add `npm run check:package-types` to compile the fixture with no emit.

**Verification:**
- `npm run build -w @simoncharts/chart-engine`
- `npm run check:package-types`

## Task 2: SDK Import Guard

**Files:**
- Create: `scripts/check-sdk-imports.mjs`
- Modify: `package.json`

**Steps:**
1. Scan host-facing source and scripts for `@simoncharts/chart-engine/` subpath imports.
2. Scan host-facing source and scripts for direct `packages/chart-engine/src` imports.
3. Keep package source and docs out of this guard because they are not external package consumers.

**Verification:**
- `npm run guard:sdk-imports`

## Task 3: Runtime Package Consumer Expansion

**Files:**
- Modify: `scripts/check-package-consumer.mjs`

**Steps:**
1. Add package-root runtime use of `createDrawingEditor()`.
2. Execute `DrawingEditorCommand` payloads through `executeCommand()`.
3. Assert `getCapabilities()` reflects selection, clipboard, paste, and undo/redo state.

**Verification:**
- `npm run build -w @simoncharts/chart-engine`
- `npm run check:package-consumer`

## Task 4: Documentation And Version Metadata

**Files:**
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/host-integration.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `packages/chart-engine/package.json`
- Modify: `apps/playground/package.json`
- Modify: `package-lock.json`
- Modify: this plan with acceptance evidence

**Steps:**
1. Document the root-only import contract and new v0.8 checks.
2. Advance `@simoncharts/chart-engine` to `0.8.0`.
3. Record full acceptance evidence after validation.

**Verification:**
- `npm install --package-lock-only`
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run guard:sdk-imports`
- `npm run check:package-consumer`
- `npm run check:package-types`
- `npm run build`
- `npm pack --dry-run -w @simoncharts/chart-engine`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- `npm run test` passed: 31 test files, 381 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 139 engine files scanned.
- `npm run guard:public-api` passed: 103 runtime exports.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed and covers drawing editor command/capability runtime APIs.
- `npm run check:package-types` passed and compiles external type-only package usage against built declarations.
- `npm run build` passed for `@simoncharts/chart-engine` and `@simoncharts/playground`.
- `@simoncharts/chart-engine` package version was advanced to `0.8.0`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@0.8.0` and included `dist/index.js`, `dist/index.d.ts`, and declaration files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 32 browser tests.
