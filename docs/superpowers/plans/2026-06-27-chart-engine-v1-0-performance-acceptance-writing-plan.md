# Chart Engine v1.0 Performance Acceptance Writing Plan

**Problem:** The v1.0 release candidate has a working performance baseline, but it is only part of the full unit test suite. The RC documentation still lists broader performance evidence as a residual risk. Hosts need a clear Engine-only command that verifies large-series paths without pulling in TradingReviewSystem or host application behavior.

**Goal:** Add a dedicated performance acceptance gate for SimonCharts Engine. The gate should reuse the existing deterministic performance baseline, add a larger 50k-candle data path, and document how the performance evidence fits into the v1.0 RC release gate.

**Boundary:**
- Do not import host app APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, or persistence services.
- Do not add browser/device benchmarking infrastructure in this step.
- Do not optimize runtime code unless the new performance evidence exposes a concrete regression.
- Keep the check deterministic enough to run locally and in CI.

## Success Criteria

1. There is a dedicated performance gate.
   - Verify `npm run check:performance` runs the Engine performance baseline.
2. The baseline covers a larger dataset than the existing 10k path.
   - Verify `performanceBaseline.test.ts` includes a 50k-candle scenario for key large-series paths.
3. The release gate documents performance acceptance.
   - Verify README, package README, testing strategy, and release candidate docs reference `check:performance`.
4. Existing RC guarantees remain intact.
   - Verify tests, typecheck, boundary guard, public API guard, SDK guards, release readiness, build, pack, and e2e still pass.

## Proposed Scope

1. Performance gate
   - Add `check:performance` to root scripts.
   - Use a focused Vitest command for the Engine performance baseline.

2. Large dataset scenario
   - Extend `performanceBaseline.test.ts` with a deterministic 50k-candle scenario.
   - Measure source render model creation, full-range autoscale, core indicator calculation, static render over a visible window, and render scheduler invalidations.
   - Use conservative thresholds to catch structural regressions without making local runs fragile.

3. Documentation
   - Update release and testing docs to include the performance gate.
   - Update the RC residual risk to distinguish local performance acceptance from broader device benchmarking.

## Validation Gate

Run before accepting this phase:

```bash
npm run check:performance
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run check:release-readiness
npm run build
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
