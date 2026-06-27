# Chart Engine v1.0 Drawing Hover Intent Writing Plan

**Problem:** SimonCharts Engine can now hit-test drawing bodies and edit handles, and render state already supports `hoveredDrawingId`, but hover target and cursor intent are still assembled implicitly in the host. Hosts need a reusable, DOM-free way to convert Engine hit-test results into a neutral hover/cursor state.

**Goal:** Add an Engine-owned drawing hover intent contract that returns `hoveredDrawingId`, `target`, and `cursor` for handle, body, and empty-space hover states.

**Boundary:** Keep the Engine independent. This phase must not import TradingReviewSystem, host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, persistence workflows, or DOM APIs into `packages/chart-engine`.

## Current State

- `hitTestDrawing()` returns body hit matches from neutral drawings and a renderer registry.
- `hitTestDrawingEditHandle()` returns selected handle hits from Engine-generated handle metadata.
- `RenderState.hoveredDrawingId` already exists and drawing layer renders handles for hovered drawings.
- `InteractionSession.cursor` exists, but it is generic and does not know drawing hit targets.
- The playground does not currently set `hoveredDrawingId` in render state.

## Target Contract

Add package-root APIs:

- `getDrawingHoverState(options)`
- `DrawingHoverState`
- `DrawingHoverTarget`
- `DrawingHoverCursor`
- `DrawingHoverStateOptions`

The function is pure and DOM-free. Hosts pass the current point, drawings, selected edit handles, renderer registry, and optional active operation flag. The Engine evaluates handles before body hits. It returns:

- handle target: `cursor: "resize"` for resize handles, `cursor: "drawing"` for anchor/rotate handles, `hoveredDrawingId`
- body target: `cursor: "drawing"`, `hoveredDrawingId`
- none: `cursor: "crosshair"`, no hovered id
- active operation: `cursor: "drawing"` or `resize`, no hover recomputation if a host supplies `activeTarget`

## Non-Goals

- No DOM cursor mutation, CSS, pointer capture, or event listener logic in Engine.
- No mutation of `InteractionSession` in this phase.
- No hover tooltip, snap/magnet, or property panel behavior.
- No new hit geometry. Hover uses existing handle/body hit-test contracts.

## Verification

1. Engine hover contract
   - Verify: Vitest proves handle precedence, body fallback, no-hit cursor, hidden/locked body behavior via hit-test options, and active target passthrough.
2. Playground integration
   - Verify: Playwright proves hovering a drawing body sets hovered render state by showing handles without selection and cursor diagnostic changes to drawing.
3. SDK/public API
   - Verify: public API/type guards and package consumer/type fixture checks pass after intentional snapshot updates.
4. Engine boundary
   - Verify: `npm run guard:engine-boundary` passes.

