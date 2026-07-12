# @simoncharts/chart-engine

Host-independent chart engine kernel for SimonCharts.

## Install

```bash
npm install @simoncharts/chart-engine
```

## Usage

Import from the package root:

```ts
import {
  createChartEngine,
  createDrawingEditor,
  createDefaultSeriesRendererRegistry,
  createStaticLayers,
  renderStaticChart,
  supportedSeriesTypes
} from "@simoncharts/chart-engine";
```

The package root is the public SDK entrypoint. Internal files under `dist/` or `src/` are not stable public API. Runtime exports are guarded by `npm run guard:public-api`; TypeScript public symbols are guarded by `npm run guard:public-types`.

## Engine Scope

The engine provides neutral contracts and behavior for:

- market data models and viewport state
- eight canonical timeframes and linear, log, and percentage price scales
- built-in chart series render models and renderers
- canvas static rendering and overlay layers
- interaction state, crosshair state, and render scheduling
- visual output renderers
- drawing tools, drawing editor commands, hotkeys, magnet helpers, and serialization
- canonical drawing projection and a same-history domain/screen coordinate adapter
- layout snapshot serialization
- extension registration for series, visual, drawing, and figure contributions

Hosts own data loading, auth, routing, persistence, collaboration, user accounts, and product workflows.

## Supported Series Types

`supportedSeriesTypes` currently contains:

```ts
[
  "bars",
  "candles",
  "hollowCandles",
  "volumeCandles",
  "line",
  "lineWithMarkers",
  "stepLine",
  "area",
  "hlcArea",
  "baseline",
  "columns",
  "highLow",
  "heikinAshi",
  "renko",
  "lineBreak",
  "kagi",
  "pointAndFigure"
]
```

## Drawing Editor

Use `createDrawingEditor()` with neutral `DrawingObject` payloads:

```ts
const editor = createDrawingEditor({
  drawings: [],
  onEvent(event) {
    console.log(event);
  }
});

editor.executeCommand({ type: "setTool", tool: "trendLine" });
editor.pointerDown({ x: 120, y: 180 });
editor.pointerMove({ x: 200, y: 210 });
const preview = editor.getState().previewDrawing;
editor.pointerDown({ x: 260, y: 240 });
```

Step tools commit anchors on `pointerDown()` and expose the current anchors plus an ephemeral hover
anchor through `previewDrawing`. Continuous tools (`path`, `brush`, and `forecastPath`) sample
distinct `x`/`y` points from `pointerDown()` through `pointerMove()`, then commit once on
`pointerUp()` after reaching their declared minimum anchor count. `cancel()` discards an active
creation without adding history. Preview changes are also emitted as `drawingPreviewChanged`.

The editor supports creation, selection, drag, anchor editing where anchors are editable, style
editing, text editing, z-order commands, copy, paste, duplicate, lock, hide, delete, undo, and redo.
Hosts that edit projected screen anchors can provide `coordinateAdapter.toScreen()` with
`projectDrawingObject()` and `coordinateAdapter.toDomain()` with `unprojectDrawingObject()`.
The editor stores domain drawings in history and projects `getState()`, preview events, handles,
selection, geometry edits, paste, and duplicate through the current adapter. Changing the adapter's
viewport/scale context therefore reprojects reads without adding history or events. Persist the
result of `toDomain()` rather than the projected `getState()` drawing.

## Extensions

Extensions are installed into Engine-owned registries:

```ts
import {
  applyChartExtension,
  createChartExtension,
  createChartExtensionRegistry
} from "@simoncharts/chart-engine";

const extension = createChartExtension({
  id: "acme.tools",
  label: "Acme Tools",
  version: "1.0.0"
});

const registry = createChartExtensionRegistry();
registry.register(extension);
```

Custom drawing types must be namespaced, for example `acme.measurement-box`.

## Checkpointed Calculations

Use `calculateCoreIndicatorChunk()` and `transformSeriesChunk()` when source candles arrive in
pages. Their JSON-safe checkpoints retain bounded algorithm state, and the full-series indicator
and synthetic transform APIs use the same calculation runners. Apply a transform result's
`replaceTailCount` before appending its points. Pass `{ finalize: true }` as the fifth indicator
chunk argument at end-of-stream; this flushes any pending SAR first point and makes the checkpoint
terminal. Repeated empty finalization is idempotent, while later non-empty input is rejected.

## Validation

Release candidate validation uses the single release gate:

```bash
npm run check:release-gate
```

Expanded release gate for auditability:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run build
npm run check:host-smoke
npm run check:package-consumer
npm run check:package-types
npm run check:performance
npm run check:release-readiness
npm run check:package-artifact
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
