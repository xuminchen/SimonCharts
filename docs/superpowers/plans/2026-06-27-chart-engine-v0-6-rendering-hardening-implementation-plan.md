# Chart Engine v0.6 Rendering Hardening Implementation Plan

**Goal:** Implement the first Engine-only rendering hardening pass for SimonCharts. This phase improves scheduler diagnostics, canvas clear contracts, and performance evidence without adding any TradingReviewSystem or host business dependency.

## Task 1: Render Diagnostic Contract

**Files:**
- Modify: `packages/chart-engine/src/render/scheduler/renderSchedulerTypes.ts`
- Modify: `packages/chart-engine/src/render/scheduler/renderScheduler.ts`
- Modify: `packages/chart-engine/src/__tests__/renderScheduler.test.ts`

**Steps:**
1. Add `RenderPassDiagnostic` and `RenderFrameDiagnostic` types.
2. Add `lastFrame` to `RenderMetrics`.
3. Record frame id, timestamp, layers, reasons, layout flag, pass order, and per-pass duration.
4. Clone diagnostics in scheduler state so callers cannot mutate stored state.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/renderScheduler.test.ts`
- `npm run typecheck`

## Task 2: Scheduler Determinism Hardening

**Files:**
- Modify: `packages/chart-engine/src/render/scheduler/renderScheduler.ts`
- Modify: `packages/chart-engine/src/__tests__/renderScheduler.test.ts`

**Steps:**
1. Keep dirty layer ordering tied to the engine render layer order.
2. Keep pass ordering tied to `defaultRenderPassOrder`.
3. Add coverage for frame sequence and pass diagnostics across follow-up invalidations.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/renderScheduler.test.ts`
- `npm run guard:engine-boundary`

## Task 3: Static And Overlay Clear Contract

**Files:**
- Modify: `packages/chart-engine/src/render/staticRenderer.ts`
- Modify: `packages/chart-engine/src/__tests__/staticRenderer.test.ts`
- Modify: `packages/chart-engine/src/__tests__/overlayLayers.test.ts`

**Steps:**
1. Add optional `RenderCanvasClearOptions` accepted by `renderStaticChart()` and `renderOverlay()`.
2. Allow static rendering to clear the full chart and optionally paint `theme.colors.background`.
3. Preserve overlay clearing as the default while allowing `{ clear: false }`.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/staticRenderer.test.ts packages/chart-engine/src/__tests__/overlayLayers.test.ts`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/static-rendering.spec.ts`

## Task 4: Scheduler Performance Baseline

**Files:**
- Modify: `packages/chart-engine/src/__tests__/performanceBaseline.test.ts`

**Steps:**
1. Add deterministic scheduler overhead measurement with injected frame and time functions.
2. Use a conservative upper bound that catches accidental excessive scheduling work without depending on host APIs.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/performanceBaseline.test.ts`
- `npm run test`

## Task 5: Documentation And Acceptance Evidence

**Files:**
- Modify: `docs/engine/interaction-rendering-lifecycle.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: this plan with acceptance evidence

**Steps:**
1. Document v0.6 scheduler diagnostics and canvas clear behavior.
2. Document focused and full validation commands.
3. Run the full acceptance gate and record results.

**Verification:**
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run build`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- Focused v0.6 rendering tests passed: 4 test files, 27 tests.
- `npm run test` passed: 31 test files, 377 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 139 engine files scanned.
- `npm run guard:public-api` passed: 103 runtime exports.
- `npm run check:package-consumer` passed.
- `npm run build` passed for `@simoncharts/chart-engine` and `@simoncharts/playground`.
- `@simoncharts/chart-engine` package version was advanced to `0.6.0`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@0.6.0` and included `dist/index.js`, `dist/index.d.ts`, and declaration files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 31 browser tests.
