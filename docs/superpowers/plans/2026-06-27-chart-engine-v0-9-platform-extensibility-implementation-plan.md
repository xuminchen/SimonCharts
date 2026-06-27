# Chart Engine v0.9 Platform Extensibility Implementation Plan

**Goal:** Add a neutral extension kernel to SimonCharts Engine so third-party chart, visual, drawing, and figure contributions can be installed through public Engine contracts while preserving host independence.

## Task 1: Custom Drawing Type Boundary

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingTypes.ts`
- Modify: `packages/chart-engine/src/drawing/drawingSerialization.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingModel.test.ts`

**Steps:**
1. Add `BuiltInDrawingType` and `CustomDrawingType` type aliases.
2. Keep `drawingTypes` as the built-in list.
3. Add `isBuiltInDrawingType()` and `isCustomDrawingType()` helpers.
4. Allow parsing namespaced custom drawing types such as `acme.measurement-box`.
5. Continue rejecting unscoped host/business terms such as `hostReview`.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingModel.test.ts packages/chart-engine/src/__tests__/drawingSchema.test.ts`

## Task 2: Extension Kernel

**Files:**
- Create: `packages/chart-engine/src/extensions/chartExtension.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Create: `packages/chart-engine/src/__tests__/chartExtension.test.ts`

**Steps:**
1. Define extension manifest, contribution, context, result, and registry contracts.
2. Implement `createChartExtension()`, `createChartExtensionRegistry()`, and `applyChartExtension()`.
3. Register supplied contributions into existing registries.
4. Return deterministic install counts.
5. Fail duplicate extension ids in the extension registry.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts`
- `npm run guard:public-api`

## Task 3: SDK Consumer Coverage

**Files:**
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`

**Steps:**
1. Use extension APIs from the package root in the runtime consumer smoke.
2. Use extension APIs and custom drawing types in the type fixture.
3. Verify all imports remain package-root imports.

**Verification:**
- `npm run guard:sdk-imports`
- `npm run check:package-consumer`
- `npm run check:package-types`

## Task 4: Documentation And Version Metadata

**Files:**
- Create: `docs/engine/platform-extensibility.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `packages/chart-engine/package.json`
- Modify: `apps/playground/package.json`
- Modify: `package-lock.json`
- Modify: this plan with acceptance evidence

**Steps:**
1. Document manifest shape, contribution types, namespace rule, and non-goals.
2. Advance package version to `0.9.0`.
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

- Focused v0.9 tests passed: 3 test files, 26 tests.
- `npm run test` passed: 32 test files, 386 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 141 engine files scanned.
- `npm run guard:public-api` passed: 109 runtime exports.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed and covers extension runtime APIs plus custom drawing type serialization.
- `npm run check:package-types` passed and covers extension type APIs plus custom drawing type usage.
- `npm run build` passed for `@simoncharts/chart-engine` and `@simoncharts/playground`.
- `@simoncharts/chart-engine` package version was advanced to `0.9.0`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@0.9.0` and included `dist/extensions/chartExtension.d.ts`.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 32 browser tests.
