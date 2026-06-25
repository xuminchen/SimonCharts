# Chart Engine v0.3 Visual Drawing Platform Design

## Problem

SimonCharts now has a real engine baseline: neutral contracts, 17 series types, visual outputs, panels, drawing objects, a drawing editor, command history, interaction session state, render scheduling, tests, and a playground.

That baseline is still not enough for a platform-level chart engine. The current drawing surface is broad in type names but shallow in editing depth. The playground only exposes a small subset of tools, renderer logic is still directly tied to drawing renderers instead of a reusable figure primitive model, and the editor lacks the tool registry, object manager, property editing, hotkeys, advanced snapping, and advanced technical-analysis drawing families expected in a mature K-line workspace.

The next work should close the graphics and drawing-editor gap without turning SimonCharts into TradingReviewSystem. The engine remains a reusable kernel.

## Reference Evidence

The reference projects are used as capability benchmarks, not as source-code dependencies.

- KLineChart advertises built-in indicators, line drawing models, style configuration, APIs, mobile support, and TypeScript definitions: <https://github.com/klinecharts/KLineChart>
- KLineChart overlay design uses registered overlays, `totalStep`, step or continuous drawing modes, visibility, locking, and custom figure creation: <https://klinecharts.com/en-US/guide/overlay> and <https://klinecharts.com/en-US/api/chart/registerOverlay>
- KLineChart v9 indicator documentation lists a large built-in indicator set: MA, EMA, SMA, BBI, VOL, MACD, BOLL, KDJ, RSI, BIAS, BRAR, CCI, DMI, CR, PSY, DMA, TRIX, OBV, VR, WR, MTM, EMV, SAR, AO, ROC, PVT, and AVP: <https://v9.klinecharts.com/en-US/guide/indicator>
- TradingView Lightweight Charts exposes plugins for custom series and primitives; primitives cover custom visualizations, drawing tools, annotations, and pane-level drawings: <https://github.com/tradingview/lightweight-charts/blob/master/website/docs/plugins/intro.md>
- Lightweight Charts custom series are renderer-based and include hit testing and price-to-coordinate conversion in their plugin contracts: <https://github.com/tradingview/lightweight-charts/blob/master/website/docs/plugins/custom_series.md>
- `lightweight-charts-drawing` is a focused reference for a drawing manager architecture with 68 tools, a drawing class plus pane-view split, lifecycle orchestration, selection, drag editing, and events: <https://github.com/deepentropy/lightweight-charts-drawing>

## Current SimonCharts Inventory

Series types currently defined by `packages/chart-engine/src/series/seriesTypes.ts`:

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

Visual output types currently supported by the visual registry:

- `line`
- `histogram`
- `band`
- `marker`

Drawing types currently defined by `packages/chart-engine/src/drawing/drawingTypes.ts`:

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

Current editor capability:

- set tool
- create drawings by click count
- select one drawing
- drag selected drawings
- drag an anchor through API
- delete selected drawings
- lock selected drawings
- hide selected drawings
- undo and redo
- emit neutral drawing events

Current playground exposure:

- Select
- Line
- Horizontal line
- Vertical line
- Rectangle
- Text
- delete, lock, hide, undo, redo

## Goals

v0.3 should make the visual and drawing surface credible as an independent chart-engine platform:

- Add a reusable figure primitive kernel under the engine.
- Convert drawing renderers to use figure primitives where practical.
- Add a drawing tool-definition registry with exact tool metadata, creation rules, style defaults, categories, hotkey ids, and edit handles.
- Expand built-in drawing types to cover basic overlays, measurement tools, advanced Fibonacci tools, Gann tools, pitchfork tools, and common pattern/forecast tools.
- Harden drawing serialization with a versioned schema and deterministic migration helpers.
- Complete the neutral drawing editor with multi-select, handle editing, z-order, duplication, copy/paste, style editing, text editing, object manager state, keyboard commands, snapping, and touch-friendly pointer behavior.
- Expand indicator and visual contracts enough to exercise line, histogram, band, marker, and multi-output sub-panel use through a registry.
- Build a playground workbench that exposes every built-in drawing tool and every built-in indicator category through engine APIs.
- Add acceptance tests that prove each drawing type renders from neutral JSON, can be created by its tool definition, survives serialization, and does not import host business models.

## Non-Goals

v0.3 does not implement:

- TradingReviewSystem integration.
- Watchlists.
- Review notes.
- Strategy center business UI.
- AI conclusions.
- Broker order placement.
- Account, membership, billing, or authorization features.
- Host-owned persistence services.
- User script runtime or Pine-compatible language.
- Importing KLineChart, Lightweight Charts, or `lightweight-charts-drawing` into the engine.

Host apps may map business concepts into neutral `ChartMark`, `DrawingObject`, `IndicatorResult`, or command payloads. The engine must not import host APIs, host stores, host schemas, host routes, review models, strategy models, watchlist models, AI models, auth models, or account models.

## Target Drawing Coverage

v0.3 keeps all current drawing types and adds these built-in drawing types:

### Basic Overlay Tools

- `segment`
- `straightLine`
- `rayLine`
- `horizontalRayLine`
- `horizontalSegment`
- `horizontalStraightLine`
- `verticalRayLine`
- `verticalSegment`
- `verticalStraightLine`
- `priceLine`
- `priceChannelLine`
- `simpleAnnotation`
- `simpleTag`
- `triangle`
- `arc`
- `curve`

### Measurement And Position Tools

- `dateRange`
- `priceRange`
- `measure`
- `trendAngle`
- `profitLossRange`

### Fibonacci Tools

- `fibTrendBasedExtension`
- `fibTimeZone`
- `fibFan`
- `fibArc`
- `fibChannel`
- `fibWedge`

### Gann Tools

- `gannFan`
- `gannBox`
- `gannSquare`

### Pitchfork Tools

- `pitchfork`
- `schiffPitchfork`
- `modifiedSchiffPitchfork`
- `insidePitchfork`

### Pattern And Forecast Tools

- `elliottImpulseWave`
- `elliottCorrectionWave`
- `xabcdPattern`
- `cypherPattern`
- `headAndShouldersPattern`
- `forecastPath`

This target list gives SimonCharts 62 built-in drawing types after combining the existing 23 types with 39 additions. The number is not the product goal; the product goal is coverage of the tool families users expect in a professional K-line drawing editor.

## Target Indicator Coverage

v0.3 should add neutral indicator definitions and fixture calculations for:

- `MA`
- `EMA`
- `SMA`
- `VOL`
- `MACD`
- `BOLL`
- `KDJ`
- `RSI`
- `BIAS`
- `CCI`
- `DMI`
- `OBV`
- `VR`
- `WR`
- `MTM`
- `SAR`

The engine should expose indicator definitions, parameter schemas, calculations, visual outputs, panel routing, and tooltip rows. Host apps own indicator selection persistence and any product-specific indicator presets.

## Architecture

### Figure Primitive Kernel

Add a low-level figure model independent of drawings and indicators:

- figure types: line, polyline, polygon, rect, rotated rect, circle, ellipse, arc, curve, text, label, arrow, band, marker
- figure renderer registry
- figure hit testing
- figure bounds
- figure style normalization

Drawing renderers and advanced indicator visuals can generate figures first, then pass figures to the renderer. This keeps canvas details out of every drawing tool implementation.

### Drawing Tool Registry

Add a registry that describes how each drawing is created and edited:

- type
- label
- category
- total step count
- required anchor count
- drawing mode: step or continuous
- pane support
- default style
- editable handles
- style fields
- text fields
- hotkey id
- cursor mode
- magnet policy

The editor should read from this registry instead of hard-coding anchor counts in `drawingEditor.ts`.

### Versioned Drawing Schema

Add a serialized schema with an explicit version:

- schema version
- drawing id
- drawing type
- anchors
- style
- text
- visible and locked state
- z-index
- metadata

Migration helpers must be pure and deterministic. The host may persist the serialized JSON, but persistence remains outside the engine.

### Complete Drawing Editor

The editor owns neutral editing state only:

- active tool
- creation draft
- selection state
- hovered object
- active handle
- z-order
- clipboard
- style patch
- text edit draft
- object manager snapshot
- undo and redo history

The host owns DOM inputs, menus, persistence, account state, and business workflow state.

### Playground Workbench

The playground should become an engine acceptance harness, not a host application:

- all tool categories visible
- all built-in drawing tools creatable
- object manager panel
- property panel
- indicator panel selector
- serialization import/export panel using neutral JSON
- diagnostics for selected tool, selected drawing ids, render pass, and interaction state

## Acceptance Gates

Every task in the implementation plan must be validated with focused tests and at least one broader gate. The final v0.3 acceptance suite is:

- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run build`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

Feature-specific acceptance:

- Every built-in drawing type has renderer coverage.
- Every built-in drawing type has hit-test or selection coverage.
- Every built-in drawing type can be created from its tool definition.
- Every built-in drawing type can round-trip through serialization.
- Every tool exposed in the playground has a stable `data-testid`.
- Drawing editor commands do not mutate locked drawings.
- Hidden drawings do not render or hit-test.
- Z-order changes are deterministic.
- Copy/paste assigns new ids and preserves anchors, style, text, type, and visibility.
- Multi-select operations preserve selection order.
- Style changes enter undo history.
- Text changes enter undo history.
- Magnet snapping is deterministic for OHLC anchors, drawing anchors, and visual points.
- No engine file imports TradingReviewSystem or any host business module.
