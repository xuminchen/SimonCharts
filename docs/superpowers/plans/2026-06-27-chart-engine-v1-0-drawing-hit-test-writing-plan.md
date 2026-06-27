# Chart Engine v1.0 Drawing Hit Test Writing Plan

**Problem:** SimonCharts Engine owns drawing edit handles, selection bounds, selection boxes, and drag operation flows, but drawing body hit-testing is still implemented inside `apps/playground/src/main.ts`. That forces each host to duplicate renderer hit-test ordering, visibility filtering, and z-order selection semantics.

**Goal:** Add a DOM-free Engine-owned drawing body hit-test contract that hosts can call with neutral drawings, a point, and a drawing renderer registry.

**Boundary:** Keep the Engine independent. This phase must not import TradingReviewSystem, host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, persistence workflows, or DOM APIs into `packages/chart-engine`.

## Current State

- `packages/chart-engine/src/drawing/drawingHitTest.ts` only exposes `hitTestDrawingAnchor()`.
- `packages/chart-engine/src/drawing/drawingRegistry.ts` defines `DrawingRenderer.hitTest(drawing, point)`.
- `apps/playground/src/main.ts` has a local `hitTestDrawing(point, drawings)` helper.
- The local helper filters hidden drawings, calls `drawingRendererRegistry.require(drawing.type).hitTest()`, sorts by hit distance, and returns the nearest drawing.
- The local helper does not make z-order tie behavior explicit and is not reusable by SDK consumers.

## Target Contract

Add package-root APIs:

- `hitTestDrawing(drawings, point, options)`
- `hitTestDrawingAll(drawings, point, options)`
- `DrawingHitTestOptions`
- `DrawingPoint`
- `DrawingHitTestMatch`

`DrawingHitTestOptions` includes:

- `registry: DrawingRendererRegistry`
- `includeHidden?: boolean`
- `includeLocked?: boolean`

The Engine returns matches sorted by nearest distance first. Equal-distance ties prefer later drawings in the input array, matching normal topmost/z-order behavior. Hidden drawings are excluded by default. Locked drawings are included by default because locked drawings can still be selected or inspected; hosts can set `includeLocked: false` when an interaction should skip them.

## Non-Goals

- No hover styling, cursor decisions, CSS, DOM event, or pointer-capture logic.
- No new drawing renderer geometry.
- No fallback hit-test when a drawing renderer is missing; missing renderers should keep failing clearly through `registry.require()`.
- No TradingReviewSystem integration.

## Verification

1. Engine hit-test contract
   - Verify: Vitest proves hidden filtering, optional locked filtering, distance ordering, z-order tie behavior, and `hitTestDrawing()` returning the first match from `hitTestDrawingAll()`.
2. Playground integration
   - Verify: Playwright drawing editor tests still select and drag drawings through Engine hit-test.
3. SDK/public API
   - Verify: public API/type guards and package consumer/type fixture checks pass after intentional snapshot updates.
4. Engine boundary
   - Verify: `npm run guard:engine-boundary` passes.
