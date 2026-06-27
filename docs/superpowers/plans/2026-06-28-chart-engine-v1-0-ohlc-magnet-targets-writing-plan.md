# Chart Engine v1.0 OHLC Magnet Targets Writing Plan

**Problem:** SimonCharts Engine has neutral magnet target matching and snap state, and the playground now snaps drawing anchors to existing drawing anchors. The spec also requires magnet mode to snap drawing anchors to candle OHLC points, but hosts currently need to hand-roll conversion from candle data and viewport coordinates into `ohlc` magnet targets.

**Goal:** Add an Engine-owned OHLC magnet target factory that converts neutral candle series, viewport, plot area, and optional price range into deterministic `MagnetSnapTarget[]`, then wire the playground to include those targets in drawing creation and anchor-drag snapping.

**Boundary:** Keep the Engine independent. This phase must not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, product persistence, DOM APIs, canvas APIs, or browser event types into `packages/chart-engine`.

## Current State

- `createOhlcMagnetTargets(points)` creates `ohlc` targets from already-projected points.
- `getMagnetSnapState()` returns snapped point, matched target, and neutral magnet session state.
- `indexToX()`, `priceToY()`, and `computeVisiblePriceRange()` already provide deterministic coordinate mapping.
- Playground snap target collection currently uses only `createDrawingAnchorMagnetTargets()`.

## Target Contract

Add package-root APIs:

- `createOhlcMagnetTargetsFromSeries(options)`
- `OhlcMagnetTargetOptions`
- `MagnetPlotArea`
- `MagnetPriceRange`

The function is pure and DOM-free. Hosts pass:

- `series: CandleSeries`
- `viewport: ViewportState`
- `plotArea: { x; y; width; height }`
- optional `priceRange`
- optional OHLC `fields`

The Engine returns finite `MagnetSnapTarget[]` for visible candle OHLC values. Each target includes:

- `type: "ohlc"`
- screen `x` and `y`
- `field`
- `dataIndex`

Defaults:

- `fields` defaults to `["open", "high", "low", "close"]`
- `priceRange` defaults to `computeVisiblePriceRange(series, viewport.visibleRange)`
- visible candle bounds are clamped to existing candle indices
- invalid/empty series returns `[]`

## Non-Goals

- No DOM cursor mutation, pointer capture, CSS, or browser events in Engine.
- No host UI toggle for magnet modes in this phase.
- No visual marker rendering for snap targets.
- No percent/log price scale support beyond the existing `priceToY()` behavior.
- No persistence, collaboration, or host workflow behavior.

## Verification

1. Engine OHLC target factory
   - Verify: Vitest proves visible-range filtering, field selection, price-to-y mapping, x index mapping, optional priceRange override, empty series, and invalid field/price filtering.
2. Playground integration
   - Verify: Playwright proves drawing creation can snap to an OHLC target and `magnet-state` becomes `ohlc`.
3. SDK/public API
   - Verify: public API/type guards and package consumer/type fixture checks pass after intentional snapshot updates.
4. Engine boundary
   - Verify: `npm run guard:engine-boundary` passes.
