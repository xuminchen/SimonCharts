# Chart Engine v0.1 Full Engine Design

## Problem

SimonCharts M0-M2 established a reusable chart engine baseline: neutral contracts, static K-line rendering, viewport math, interaction handling, overlays, and a playground harness. That baseline is good enough for the first engine proof, but it is not yet a professional chart engine.

The next version must not turn SimonCharts into a business platform. It must mature the engine itself: chart types, visual output extensibility, panels, drawing tools, actions, settings, and documentation. Host applications such as TradingReviewSystem should still provide data, business models, persistence, authentication, and product UI.

This design uses the observed chart-engine surface of a mature trading chart workspace as a benchmark, while explicitly excluding host/product features such as watchlists, AI panels, news, membership, replay business workflows, and account state.

## Goal

Build SimonCharts v0.1 as a full professional chart engine kernel.

v0.1 should provide:

- Complete core chart-type rendering for the 17 confirmed chart types.
- A registry-based visual output pipeline.
- Main/sub-panel rendering and scale routing.
- A complete neutral drawing editor.
- A command/action model suitable for toolbar and shortcut binding.
- Theme/settings contracts.
- Documentation sufficient for host integration and future contributors.

The engine must remain host-independent. It must not import host APIs, stores, schemas, routes, persistence models, AI models, watchlist models, review models, strategy models, auth models, or subscription/account models.

## Non-Goals

v0.1 does not implement:

- TradingReviewSystem integration.
- Watchlists.
- News panels.
- AI analysis workspace.
- Review workspace.
- Strategy center business UI.
- Order flow business panels.
- Login, membership, billing, authorization, or account state.
- Host-side data synchronization.
- Backend API clients.
- Indicator marketplace or user-script runtime.
- Full multi-symbol workspace product UI.

Host applications may later map business data into neutral engine inputs such as `CandleSeries`, `IndicatorResult`, `ChartMark`, `DrawingObject`, and neutral command/event payloads.

## Scope Baseline

SimonCharts v0.1 is a full chart engine release, split into five internal milestones. All five are part of v0.1.

1. **V0.1-A: Chart Type Engine**
2. **V0.1-B: Visual Output + Panel Engine**
3. **V0.1-C: Drawing Object Model + Rendering**
4. **V0.1-D: Drawing Editor Interaction**
5. **V0.1-E: Actions, Undo/Redo, Settings, Docs**

This split is for implementation and acceptance control only. It does not move features to v0.2.

## V0.1-A: Chart Type Engine

### Supported Chart Types

v0.1 must support these 17 chart types:

- `bars`
- `candles`
- `hollowCandles`
- `volumeCandles`
- `line`
- `lineWithMarkers`
- `stepLine`
- `area`
- `hlcArea`
- `baseline`
- `columns`
- `highLow`
- `heikinAshi`
- `renko`
- `lineBreak`
- `kagi`
- `pointAndFigure`

### Architecture

Add a registry-based series rendering model:

- `SeriesType`
- `SeriesRenderer`
- `SeriesRendererRegistry`
- `SeriesTransform`
- `SeriesRenderModel`
- `SeriesHitTestResult`
- `SeriesTooltipRow`

The active chart state includes the selected `seriesType`. Rendering, autoscale, hit testing, and tooltip generation read from the active `SeriesRenderModel`.

### Direct Render Types

These types render directly from the source `CandleSeries`:

- `bars`
- `candles`
- `hollowCandles`
- `volumeCandles`
- `line`
- `lineWithMarkers`
- `stepLine`
- `area`
- `hlcArea`
- `baseline`
- `columns`
- `highLow`

They share the source candle timeline and must preserve source candle index/time in hit tests and tooltips.

### Synthetic Series Types

These types transform the source `CandleSeries` into render-only synthetic points:

- `heikinAshi`
- `renko`
- `lineBreak`
- `kagi`
- `pointAndFigure`

Synthetic series must not replace the source `CandleSeries`. Each synthetic point must retain traceability through `sourceIndex`, `sourceRange`, or equivalent metadata so host-visible events remain explainable and neutral.

### Acceptance

- Playground can switch among all 17 chart types.
- Every chart type has unit coverage for render model generation, autoscale, hit testing, and tooltip data.
- Every chart type has at least one visual/E2E rendering assertion.
- Synthetic types preserve source traceability.
- Boundary guard passes.

## V0.1-B: Visual Output + Panel Engine

### Visual Output Types

v0.1 supports:

- `line`
- `histogram`
- `band`
- `marker`

Each visual output supports:

- renderer
- autoscale contribution
- hit-test contribution
- tooltip rows
- style override
- visibility toggle

### Visual Registry

Add:

- `VisualRenderer`
- `VisualRendererRegistry`
- `VisualRenderContext`
- `VisualAutoscaleContribution`
- `VisualHitTestResult`
- `VisualTooltipRow`

The visual layer must dispatch by output `type` through the registry. Static renderer orchestration must not hard-code every visual output type.

### Panel Engine

v0.1 supports:

- one main panel
- multiple sub panels
- shared x-scale / viewport
- per-panel y-scale
- per-panel grid
- per-panel axis
- panel height allocation
- panel titles and indicator labels
- output routing by panel id

Panel resize is configuration-driven in v0.1. Drag-resizable panel splitters are not part of v0.1.

### Indicator Routing

`IndicatorResult` outputs can target:

- the main panel
- a named sub panel
- multiple outputs in the same panel
- markers over either main or sub panels

v0.1 must include fixture/demo indicators that exercise:

- main-panel line
- main-panel band
- sub-panel histogram
- marker output

### Acceptance

- Playground shows main price panel and at least one sub panel.
- Crosshair tooltip can include rows from both main and sub panels.
- Visual output renderers are registered through the registry.
- Panel autoscale and hit testing are covered by tests.
- Boundary guard passes.

## V0.1-C: Drawing Object Model + Rendering

### Drawing Types

v0.1 supports these drawing types:

- `trendLine`
- `ray`
- `extendedLine`
- `horizontalLine`
- `verticalLine`
- `crossLine`
- `parallelChannel`
- `regressionChannel`
- `fibonacciRetracement`
- `fibonacciExtension`
- `text`
- `callout`
- `rectangle`
- `rotatedRectangle`
- `circle`
- `ellipse`
- `polygon`
- `path`
- `brush`
- `arrow`
- `longPosition`
- `shortPosition`
- `datePriceRange`

Complex pattern tools are not part of v0.1:

- XABCD
- Elliott waves
- Gann tools
- complex Fibonacci fans/arcs/spirals/wedges
- harmonic pattern editors

The v0.1 drawing model must still leave a clear extension path for these future types.

### Drawing Model

Add or harden:

- `DrawingObject`
- `DrawingType`
- `DrawingAnchor`
- `DrawingStyle`
- `DrawingInteractionState`
- `DrawingSelectionState`
- `DrawingBounds`
- `DrawingHitTestResult`

Drawing objects are neutral JSON. They may include `metadata: Record<string, unknown>`, but engine code must not interpret host business metadata.

### Drawing Rendering

Add:

- `DrawingRenderer`
- `DrawingRendererRegistry`
- selected-state rendering
- hover-state rendering
- anchor handle rendering
- locked/hidden rendering semantics

Drawing renderers use viewport and panel coordinate mapping. They must not depend on DOM APIs or host state.

### Acceptance

- Every v0.1 drawing type can render from serialized neutral data.
- Selected and hover states render visibly.
- Anchor handles render for editable drawings.
- Hidden drawings do not render.
- Locked drawings render but do not expose editing handles.
- Boundary guard passes.

## V0.1-D: Drawing Editor Interaction

### Editor State Machine

The drawing editor supports:

- select mode
- tool mode
- create by anchors
- preview while creating
- cancel creation
- hover hit-test
- select object
- multi-select
- drag object
- drag anchor
- delete selected
- lock selected
- hide selected
- keep drawing mode
- magnet mode

Magnet mode snaps drawing anchors to relevant candle points such as OHLC values. Snapping must be deterministic and testable.

### Editor Events

The engine emits neutral drawing events:

- drawing created
- drawing updated
- drawing deleted
- selection changed
- active tool changed
- drawing command failed, when applicable

Events must not include host business concepts.

### Undo / Redo Integration

Undo/redo covers:

- drawing create
- drawing move
- drawing anchor edit
- drawing delete
- drawing style change
- drawing lock/hide state changes

Viewport pan/zoom should not enter the undo stack by default. Otherwise normal navigation pollutes drawing history.

### Acceptance

- Playground can create, select, move, edit anchors, delete, lock, hide, undo, and redo drawings.
- Pointer cancellation and lost-capture paths clear editor drag state.
- Drawing interactions are tested independently from host UI.
- Serialized drawing JSON can round-trip through engine APIs.
- Boundary guard passes.

## V0.1-E: Actions, Settings, Docs

### Command Model

Add or harden a command/action model for:

- `setSeriesType`
- `setTimeframe`
- `setViewport`
- `zoomIn`
- `zoomOut`
- `resetZoom`
- `pan`
- `toggleGrid`
- `invertPriceScale`
- `setTheme`
- `setDrawingTool`
- `deleteSelectedDrawing`
- `lockSelectedDrawing`
- `hideSelectedDrawing`
- `undo`
- `redo`

Host applications can bind commands to toolbars, menus, or shortcuts. Engine code does not own host UI.

### Settings and Theme

v0.1 supports theme/settings contracts for:

- light and dark themes
- A-share red-up/green-down candle scheme
- international green-up/red-down candle scheme
- grid visibility
- crosshair style
- axis/text style
- volume color mode
- background, border, and panel separator colors
- density and spacing tokens

### Public API Hardening

v0.1 should expose stable public entry points and reduce accidental internal exports.

Required public surfaces:

- engine creation / disposal
- data update
- viewport update
- series type update
- indicator/visual output update
- drawing object update
- command dispatch
- event subscription
- theme/settings update
- registry extension points

Internal helpers and concrete layer implementations should remain internal unless they are intentionally part of the public API.

### Documentation

Create:

- `docs/engine/overview.md`
- `docs/engine/public-api.md`
- `docs/engine/chart-types.md`
- `docs/engine/visual-outputs.md`
- `docs/engine/panels.md`
- `docs/engine/drawing-editor.md`
- `docs/engine/actions-and-commands.md`
- `docs/engine/host-integration.md`
- `docs/engine/boundary-rules.md`
- `docs/engine/testing-strategy.md`

Docs must make clear that playground is a demo harness, not a host app.

## Playground Acceptance Surface

The playground becomes the v0.1 engine acceptance harness.

It should include:

- chart type selector for all 17 chart types
- main/sub-panel demo
- visual output demo
- drawing toolbar
- drawing style controls
- undo/redo controls
- theme/settings controls
- event recorder for neutral events
- reset controls

The playground must not become a business product. It remains a controlled test/demo host for the engine.

## Testing Strategy

Required validation:

- TypeScript typecheck.
- Unit tests for chart type render models.
- Unit tests for synthetic series transforms.
- Unit tests for visual registry dispatch.
- Unit tests for panel layout and autoscale.
- Unit tests for drawing geometry, hit testing, and serialization.
- Unit tests for drawing editor state transitions.
- Unit tests for command history.
- Boundary guard.
- Playwright E2E for chart type switching.
- Playwright E2E for visual outputs and sub panels.
- Playwright E2E for drawing create/edit/delete/undo/redo.
- Playwright E2E for theme/settings controls.

The implementation plan must keep these tests incremental. A single final E2E suite is not enough.

## Boundary Rules

The engine must not import or define host business models.

Forbidden in engine source:

- TradingReviewSystem APIs, routes, stores, schemas, or response types.
- watchlist models.
- review models.
- strategy models.
- AI conclusion models.
- auth, account, billing, membership, or subscription models.
- order-flow product models.
- news panel models.

Allowed:

- neutral `ChartMark`
- neutral `DrawingObject`
- neutral `IndicatorResult`
- neutral `ChartEvent`
- neutral `HostAdapter`
- metadata typed as `Record<string, unknown>` without engine interpretation.

## Implementation Planning Guidance

The v0.1 implementation plan must be split into multiple milestones and tasks. It should not be implemented as one large change.

Recommended implementation order:

1. Public API and registry hardening.
2. Chart type render models and direct chart renderers.
3. Synthetic chart transforms.
4. Visual output registry and panels.
5. Drawing model and read-only rendering.
6. Drawing editor interaction.
7. Command history and settings.
8. Documentation and final playground acceptance.

Each task must include explicit verification commands and boundary checks.

## Success Criteria

v0.1 is complete when:

- all 17 chart types render and can be switched in the playground;
- direct and synthetic chart types have autoscale, hit-test, and tooltip support;
- `line`, `histogram`, `band`, and `marker` visual outputs render through a registry;
- main and sub panels work with shared viewport and independent y scales;
- v0.1 drawing types render from neutral JSON;
- drawing editor can create, select, edit, move, delete, lock, hide, undo, and redo drawings;
- commands and settings are available through neutral engine APIs;
- documentation explains API, lifecycle, chart types, visual outputs, panels, drawing editor, commands, host integration, boundary rules, and testing;
- playground demonstrates v0.1 without host business concepts;
- typecheck, unit tests, E2E tests, build, and boundary guard pass;
- engine remains decoupled from host applications.
