# Chart Engine v0.6 Rendering Hardening Writing Plan

**Problem:** SimonCharts Engine is already a usable v0.4 SDK, but the rendering subsystem is still too thin for a reusable chart platform. The scheduler can coalesce invalidations and the static canvas renderer can draw core layers, yet hosts do not have a strong enough engine-level contract for render diagnostics, pass attribution, frame budgeting, and explicit canvas clear behavior.

**Goal:** Harden the Engine rendering contract without adding host-specific concepts. v0.6 should make render work more observable, deterministic, and testable while keeping `packages/chart-engine` independent from any host app.

**Boundary:**
- Engine code must not import TradingReviewSystem APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, or persistence services.
- Engine code must not import `apps/*`.
- Playground may be used only as a neutral browser acceptance harness.
- v0.6 does not redesign chart types, drawing tools, or host persistence.

## Success Criteria

1. Scheduler diagnostics explain the latest frame at pass level.
   - Verify with focused scheduler unit tests and public API guard.
2. Render invalidation coalescing remains deterministic under same-frame and render-pass invalidations.
   - Verify with existing and new scheduler tests.
3. Static and overlay canvas rendering have explicit clear contracts.
   - Verify with unit tests using fake canvas contexts.
4. Performance baseline includes scheduler overhead in addition to render paths.
   - Verify with `performanceBaseline.test.ts`.
5. Engine boundary stays clean.
   - Verify with `npm run guard:engine-boundary`.

## Non-Goals

- No TradingReviewSystem integration work.
- No new chart business models.
- No DOM event dependencies inside the engine.
- No compatibility layer or fallback renderer.
- No broad public API redesign beyond the render hardening additions needed for v0.6.

## Proposed v0.6 Scope

1. Render frame diagnostics
   - Add neutral `RenderFrameDiagnostic` and pass-level diagnostic records.
   - Expose latest diagnostic through scheduler state.
   - Keep diagnostics immutable from caller mutation.

2. Scheduler hardening
   - Track frame sequence, pass durations, pass count, and rendered layers.
   - Preserve existing `RenderMetrics` fields to avoid unnecessary SDK churn.
   - Keep invalidation reasons ordered by receipt order.

3. Canvas clear contract
   - Add optional clear control to `renderStaticChart()` and `renderOverlay()`.
   - Static rendering can explicitly clear and paint the chart background when requested.
   - Overlay rendering keeps default clearing behavior, with an option for hosts that manage overlay clearing themselves.

4. Performance evidence
   - Add a deterministic scheduler overhead benchmark with conservative bounds.
   - Keep the benchmark host-independent.

5. Documentation
   - Update rendering lifecycle and testing strategy docs with v0.6 behavior and commands.

## Validation Gate

Run before accepting v0.6:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

