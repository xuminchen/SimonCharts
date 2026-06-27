# Chart Engine v1.0 Extension Lifecycle Implementation Plan

**Goal:** Add a local, host-independent extension lifecycle manager to SimonCharts Engine while preserving existing direct extension installation behavior.

## Task 1: Registry Removal Primitives

**Files:**
- Modify: `packages/chart-engine/src/series/seriesRegistry.ts`
- Modify: `packages/chart-engine/src/visuals/visualRegistry.ts`
- Modify: `packages/chart-engine/src/drawing/drawingRegistry.ts`
- Modify: `packages/chart-engine/src/drawing/drawingToolRegistry.ts`
- Modify: `packages/chart-engine/src/figures/figureRegistry.ts`
- Modify: registry unit tests

**Steps:**
1. Add `unregister(type)` to renderer/tool registries.
2. Add `get(type)` to registries that currently only expose `require()`.
3. Preserve deterministic `list()` order.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/seriesRegistry.test.ts packages/chart-engine/src/__tests__/visualRegistry.test.ts packages/chart-engine/src/__tests__/drawingToolRegistry.test.ts`

## Task 2: Extension Lifecycle Manager

**Files:**
- Modify: `packages/chart-engine/src/extensions/chartExtension.ts`
- Modify: `packages/chart-engine/src/__tests__/chartExtension.test.ts`

**Steps:**
1. Add lifecycle state/result interfaces.
2. Implement `createChartExtensionLifecycle(context)`.
3. Reject duplicate installed extension ids.
4. Reject duplicate installed contribution keys.
5. Capture previous registry entries before install.
6. Restore previous registry entries on uninstall.
7. Keep `applyChartExtension()` behavior unchanged.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts`

## Task 3: Public API And SDK Consumers

**Files:**
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`

**Steps:**
1. Update runtime API snapshot for new lifecycle export.
2. Update type API snapshot for new lifecycle symbols.
3. Exercise lifecycle install/uninstall in runtime package consumer smoke.
4. Exercise lifecycle types in the external type consumer fixture.

**Verification:**
- `npm run guard:public-api`
- `npm run guard:public-types`
- `npm run check:package-consumer`
- `npm run check:package-types`

## Task 4: Documentation And Release Evidence

**Files:**
- Modify: `docs/engine/platform-extensibility.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/engine/public-api.md`
- Modify: this implementation plan with acceptance evidence

**Steps:**
1. Document local extension lifecycle install/uninstall.
2. Keep remote loading, sandboxing, marketplace, trust policy, and persistence as non-goals.
3. Record validation evidence.

**Verification:**
- `rg -n "createChartExtensionLifecycle|uninstall|lifecycle" docs/engine docs/superpowers/plans/2026-06-27-chart-engine-v1-0-extension-lifecycle-*.md`

## Task 5: Full Validation

**Verification:**
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run guard:public-types`
- `npm run guard:sdk-imports`
- `npm run check:package-consumer`
- `npm run check:package-types`
- `npm run check:performance`
- `npm run check:release-readiness`
- `npm run build`
- `npm pack --dry-run -w @simoncharts/chart-engine`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- Focused lifecycle and registry tests passed: 4 test files, 24 tests.
- `npm run test` passed: 32 test files, 393 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 141 files scanned.
- `npm run guard:public-api` passed: 110 runtime exports.
- `npm run guard:public-types` passed: 291 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed and covers lifecycle install/uninstall.
- `npm run check:package-types` passed and covers lifecycle public types.
- `npm run check:performance` passed: 1 test file, 2 tests.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for `@simoncharts/chart-engine@1.0.0-rc.0` and `@simoncharts/playground`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 112 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 32 browser tests.
