# Chart Engine v1.0 Drawing Magnet Snap Writing Plan

**Problem:** SimonCharts Engine exposes deterministic magnet helpers for OHLC, drawing-anchor, and visual-point targets, and `InteractionSession` can hold neutral magnet state. However, drawing creation and edit flows in the playground do not apply those helpers, so the documented magnet mode is not yet exercised as a complete drawing editor behavior.

**Goal:** Add an Engine-owned magnet snap state contract and wire the playground drawing editor to snap drawing creation and anchor dragging through that contract.

**Boundary:** Keep the Engine independent. This phase must not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, product persistence, DOM APIs, or browser event types into `packages/chart-engine`.

## Current State

- `createOhlcMagnetTargets()`, `createDrawingAnchorMagnetTargets()`, `createVisualPointMagnetTargets()`, `findNearestMagnetTarget()`, and `snapPointToMagnetTargets()` are package-root APIs.
- `InteractionSession` accepts neutral `{ type: "magnet"; magnet }` input and exposes `magnetState` diagnostics in the playground.
- `DrawingEditor.pointerDown()` and handle-drag flows accept points, but the playground passes raw pointer coordinates.
- The playground has no deterministic end-to-end proof that drawing anchors snap to candle, drawing-anchor, or visual-point targets.

## Target Contract

Add package-root APIs:

- `getMagnetSnapState(options)`
- `MagnetSnapState`
- `MagnetSnapStateOptions`

The function is pure and DOM-free. Hosts pass a point, a list of `MagnetSnapTarget`, and a radius. The Engine returns:

- `point`: snapped point when a target is found, otherwise the original point
- `target`: cloned matched target when found
- `magnet`: `InteractionSession`-compatible neutral magnet state

Mapping rules:

- `target.type === "ohlc"` maps to `magnet.mode === "ohlc"`
- `target.type === "drawingAnchor"` maps to `magnet.mode === "drawingAnchor"`
- `target.type === "visualPoint"` maps to `magnet.mode === "visualPoint"`
- no target maps to `{ mode: "off" }`

## Non-Goals

- No DOM cursor mutation, CSS, pointer capture, or browser event logic in Engine.
- No new drawing geometry or renderer behavior.
- No configurable UI toggle in this phase; playground can use a fixed snap radius for acceptance.
- No persistence, collaboration, or host workflow behavior.

## Verification

1. Engine magnet snap state
   - Verify: Vitest proves hit/miss behavior, cloned target output, target-type to magnet-mode mapping, snapped point preservation, radius behavior, and tie order inherited from existing magnet target rules.
2. Playground drawing integration
   - Verify: Playwright proves a created drawing anchor snaps to a deterministic existing drawing anchor or fixture point, and `magnet-state` changes during snap then clears away from targets.
3. SDK/public API
   - Verify: public API/type guards and package consumer/type fixture checks pass after intentional snapshot updates.
4. Engine boundary
   - Verify: `npm run guard:engine-boundary` passes.
