# Chart Engine v1.0 Performance Acceptance Implementation Plan

**Goal:** Add a dedicated SimonCharts Engine performance acceptance gate for v1.0 RC, including a larger deterministic 50k-candle scenario and documentation evidence.

## Task 1: Dedicated Performance Gate

**Files:**
- Modify: `package.json`

**Steps:**
1. Add `check:performance`.
2. Run only `packages/chart-engine/src/__tests__/performanceBaseline.test.ts`.

**Verification:**
- `npm run check:performance`

## Task 2: Large Dataset Performance Scenario

**Files:**
- Modify: `packages/chart-engine/src/__tests__/performanceBaseline.test.ts`

**Steps:**
1. Add a deterministic 50k-candle scenario.
2. Measure source render model creation.
3. Measure full-range autoscale.
4. Measure all core indicator calculations.
5. Measure static rendering over a visible window.
6. Measure render scheduler invalidation throughput.

**Verification:**
- `npm run check:performance`

## Task 3: Documentation And Release Gate

**Files:**
- Modify: `README.md`
- Modify: `packages/chart-engine/README.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/superpowers/plans/2026-06-27-chart-engine-v1-0-release-candidate-writing-plan.md`
- Modify: `docs/superpowers/plans/2026-06-27-chart-engine-v1-0-release-candidate-implementation-plan.md`
- Modify: this implementation plan with acceptance evidence

**Steps:**
1. Add `check:performance` to the documented release gate.
2. Document the 50k-candle local performance acceptance scope.
3. Keep broader device and production telemetry benchmarking as a post-RC item.

**Verification:**
- `rg -n "check:performance|50k|50,000" README.md packages/chart-engine/README.md docs/engine docs/superpowers/plans/2026-06-27-chart-engine-v1-0-*.md`

## Task 4: Full Validation

**Steps:**
1. Run the full validation gate.
2. Record acceptance evidence.
3. Confirm git status contains only intended Engine performance acceptance changes.

**Verification:**
- `npm run check:performance`
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run guard:sdk-imports`
- `npm run check:package-consumer`
- `npm run check:package-types`
- `npm run check:release-readiness`
- `npm run build`
- `npm pack --dry-run -w @simoncharts/chart-engine`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- `npm run check:performance` passed: 1 test file, 2 tests.
- The performance baseline now includes deterministic 10k-candle and 50k-candle scenarios.
- `npm run test` passed: 32 test files, 387 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 141 files scanned.
- `npm run guard:public-api` passed: 109 runtime exports.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 112 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 32 browser tests.
