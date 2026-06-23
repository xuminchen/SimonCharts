# Chart Engine Platform Design

## Problem

SimonCharts should be designed as an independent, reusable chart engine core, not as a page-specific implementation inside TradingReviewSystem.

The immediate motivation came from analyzing a mature trading chart workspace: a professional K-line platform is not just a chart component. It needs a neutral data contract, viewport engine, canvas rendering pipeline, layer system, interaction model, indicator system, drawing system, and host adapter boundary. If the first implementation is built directly inside a business page, TradingReviewSystem concepts such as review notes, strategy candidates, watchlists, and AI conclusions will leak into the engine and make it hard to reuse.

## Goal

Build a standalone charting platform core that can later be hosted by TradingReviewSystem and other applications.

The engine must remain objective. It should know how to render and interact with market chart primitives, but it should not know what a trading review, strategy signal, AI conclusion, or application watchlist means.

## Non-Goals

This design does not implement a TradingReviewSystem `/chart` page in the first iteration.

This design does not include:

- Minute-line support in the first implementation cycle.
- WebSocket realtime quote streaming in the first implementation cycle.
- TradingReviewSystem watchlist management.
- TradingReviewSystem review notes.
- Strategy candidate business logic.
- AI conclusions or automatic investment advice.
- Broker trading integration.
- Backtesting execution.
- Community, account, billing, or subscription product features.

## Positioning

SimonCharts is the engine core. TradingReviewSystem is the first host application.

The boundary is:

- Host applications fetch data, handle authentication, own persistence, and convert business concepts into neutral chart inputs.
- The chart engine receives neutral inputs and emits neutral events.
- The chart engine must not import host API clients, host stores, host schemas, Next.js routes, FastAPI response types, or TradingReviewSystem business models.

Business features can enter the engine only through neutral adapters:

- A strategy hit becomes a `ChartMark`.
- A review note anchor becomes a `ChartMark` or future `DrawingObject` metadata.
- An AI annotation becomes a `ChartMark`.
- A persisted drawing becomes a serialized `DrawingObject`.

## Neutral Contracts

The engine should define and consume neutral types.

Core input contracts:

- `Candle`: time, open, high, low, close, volume, turnover.
- `CandleSeries`: symbol, timeframe, adjust mode, candles, data version.
- `Quote`: last, open, high, low, previous close, change, change percent, volume, turnover, timestamp.
- `TradingCalendar`: session dates and optional intraday session metadata.
- `ChartTheme`: colors, typography, spacing, line widths, and semantic chart colors.

Visual extension contracts:

- `IndicatorDefinition`: indicator id, params schema, output panels, and calculation strategy.
- `IndicatorResult`: line, histogram, band, marker, or panel output values.
- `DrawingObject`: neutral drawing object with type, anchors, style, and metadata.
- `ChartMark`: neutral overlay marker with time/index, price, direction, severity, label, and metadata.

Runtime contracts:

- `ViewportState`: visible range, candle width, scroll offset, price scale, selected scale mode.
- `ChartCommand`: reset view, set symbol, set timeframe, toggle indicator, select drawing, delete drawing.
- `HostAdapter`: callbacks and services exposed by the host application.

## Module Architecture

### 1. Core Model

Owns neutral types and pure helpers.

Responsibilities:

- Define chart data contracts.
- Define series and symbol metadata contracts.
- Define theme contracts.
- Define mark, drawing, and indicator contracts.
- Keep runtime-independent utilities close to the model.

Core Model must not import React, browser APIs, host application APIs, or rendering code.

### 2. Viewport Engine

Owns coordinate mapping and visible state.

Responsibilities:

- Map candle index or time to x coordinate.
- Map price to y coordinate.
- Compute visible candle range.
- Compute visible price range.
- Support linear scale first.
- Reserve type boundaries for log and percent scales.
- Apply zoom and pan operations.
- Preserve cursor-centered zoom behavior.

### 3. Render Engine

Owns canvas setup and render scheduling.

Responsibilities:

- Create and size canvas surfaces.
- Handle device pixel ratio.
- Coordinate layer rendering order.
- Provide full render and overlay render entry points.
- Keep the later path open for dirty-region rendering.
- Keep the later path open for OffscreenCanvas and worker rendering.

Initial implementation may render on the main thread. The public design should not block a future worker bridge.

### 4. Layer System

Owns renderable chart layers.

Initial layers:

- Grid layer.
- Axis layer.
- Candlestick layer.
- Volume layer.
- Moving average layer.
- Crosshair layer.
- Tooltip layer.

Future layers:

- Indicator panel layer.
- Drawing layer.
- Mark layer.
- Price alert layer.
- Session gap layer.

Each layer receives neutral rendering context and chart state. Layers must not fetch data or mutate host application state.

### 5. Interaction Engine

Owns user input translation.

Responsibilities:

- Mouse move.
- Wheel zoom.
- Drag pan.
- Crosshair positioning.
- Hover hit testing.
- Reset view.
- Keyboard command dispatch.
- Selection state for future drawings.

Interaction Engine should emit neutral events such as `viewportChanged`, `crosshairMoved`, `markClicked`, or `drawingChanged`.

### 6. Indicator Engine

Owns indicator definitions, calculation, and output mapping.

Initial implementation:

- Moving averages: MA5, MA10, MA20, MA60.
- Synchronous calculation is acceptable for M1-M2.
- Results should be deterministic and testable.

Future implementation:

- MACD, RSI, KDJ, BOLL.
- Indicator registry.
- Parameter schema.
- Main-panel and sub-panel output.
- Calculation cache.
- Worker pool.
- Script indicator adapter.

### 7. Drawing Engine

Owns neutral drawing objects and interaction rules.

This is not part of M0-M2 implementation, but the design must reserve the boundary.

Future responsibilities:

- Trend line.
- Horizontal line.
- Text.
- Rectangle.
- Fibonacci tools.
- Hit testing.
- Selection.
- Dragging and resizing.
- Copy and paste.
- Serialization and deserialization.

### 8. Host Adapter Interface

Owns the boundary between engine and host applications.

The adapter is an interface, not a TradingReviewSystem implementation.

Adapter capabilities:

- `resolveData`: host-provided data loading.
- `onRangeNeedMoreData`: ask host for earlier or later data.
- `onViewportChange`: notify host about chart range.
- `onDrawingChange`: notify host about drawing updates.
- `onCommand`: notify host about user commands.
- `onMarkClick`: notify host when a neutral mark is selected.
- `persistLayout`: optional host persistence hook.

## Roadmap

### M0: Engine Contract

Goal: establish the engine boundary before UI or host integration.

Deliverables:

- Neutral chart model types.
- Host adapter interfaces.
- Fixture candle data.
- Architecture guard preventing engine code from importing host code.
- Minimal tests for model helpers.

Verification:

- Type checks pass.
- Boundary guard passes.
- Fixture data can instantiate a neutral candle series.

### M1: Static Canvas Renderer

Goal: render a deterministic static chart from fixture candles.

Deliverables:

- Canvas manager.
- Viewport coordinate mapping.
- Grid, axis, candlestick, volume, and MA layers.
- Static playground page or demo harness.

Verification:

- Given fixture candles, the chart renders without runtime errors.
- Coordinate mapping tests pass.
- Screenshot checks confirm nonblank chart output.

### M2: Interaction Engine

Goal: make the chart usable before host application integration.

Deliverables:

- Wheel zoom.
- Drag pan.
- Crosshair.
- OHLCV tooltip.
- Reset view command.
- Visible range callback.

Verification:

- Playwright interaction tests cover zoom, pan, and crosshair.
- Tooltip values match the candle under the cursor.
- Visible range changes are emitted as neutral events.

### M3: Host Integration

Goal: integrate SimonCharts into TradingReviewSystem as the first host.

Deliverables:

- TradingReviewSystem `/chart` page.
- A-share symbol search.
- On-demand daily K-line fetch and cache.
- Watchlist workspace.
- Review dock.
- Data source and cache status strip.

Verification:

- Search arbitrary A-share symbol.
- Load and cache daily K-line data.
- Render in SimonCharts.
- Add symbol to watchlist.
- Switch chart by clicking watchlist item.

### M4: Drawing System

Goal: turn the engine into a real chart workspace.

Deliverables:

- Trend line, horizontal line, text, and rectangle.
- Drawing selection and dragging.
- Drawing serialization.
- Host persistence through adapter.

Verification:

- Drawings survive page refresh through host persistence.
- Dragged drawing anchors remain correct across zoom and pan.

### M5: Indicator Platform

Goal: support professional indicator workflows.

Deliverables:

- Indicator registry.
- Parameter schema.
- Main-panel and sub-panel output.
- MACD, RSI, KDJ, BOLL.
- Calculation cache.
- Initial worker pool if needed.

Verification:

- Indicator outputs are deterministic.
- Indicator panels resize correctly.
- Large candle sets remain responsive.

### M6: Performance and Worker Architecture

Goal: establish the path toward a mature charting platform.

Deliverables:

- Dirty region rendering.
- Overlay-only rendering.
- OffscreenCanvas worker bridge.
- Worker fallback path.
- Multi-chart layout preparation.
- Performance baseline.

Verification:

- 10k candles can be rendered and interacted with within the defined performance budget.
- Worker unavailable path falls back to main-thread rendering.
- Crosshair movement does not force full chart re-render.

## First Implementation Scope

The first implementation plan should cover M0-M2 only.

It should not implement TradingReviewSystem host integration yet. Host integration begins at M3 after the engine has a neutral contract, deterministic static rendering, and baseline interaction behavior.

The first implementation plan should include:

- Project scaffolding for engine and playground.
- Core model types.
- Fixture data.
- Boundary guard.
- Canvas manager.
- Viewport engine.
- Static render layers.
- MA indicator calculation.
- Basic interaction engine.
- Tests and screenshot verification.

## Testing Strategy

M0 tests:

- Type checks.
- Boundary import guard.
- Model helper unit tests.

M1 tests:

- Viewport coordinate unit tests.
- Indicator calculation unit tests.
- Canvas smoke test.
- Nonblank screenshot test.

M2 tests:

- Wheel zoom behavior.
- Drag pan behavior.
- Crosshair mapping.
- Tooltip value mapping.
- Visible range event emission.

Future M3 tests:

- Host adapter integration.
- Data fetch and cache behavior.
- Watchlist-driven symbol switching.

## Architecture Guard

The engine must enforce that core packages do not import host application code.

Forbidden dependencies from engine code:

- TradingReviewSystem API modules.
- TradingReviewSystem repository or backend schema types.
- TradingReviewSystem React pages.
- TradingReviewSystem stores.
- Review, strategy, candidate, watchlist, AI, or auth business models.

Allowed dependencies:

- TypeScript standard tooling.
- Rendering utilities.
- Test fixtures.
- Neutral adapter interfaces.
- Browser APIs in rendering and interaction modules only.

## Open Decisions Deferred To Implementation Planning

- Exact monorepo package manager.
- Whether the initial playground uses Vite, Next.js, or a minimal static harness.
- Exact file names under `packages/chart-engine`.
- Exact screenshot test tooling.
- Exact performance budget for M6.

These decisions are intentionally deferred because they do not affect the approved platform boundary.
