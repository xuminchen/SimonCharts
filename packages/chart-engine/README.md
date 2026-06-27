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
- built-in chart series render models and renderers
- canvas static rendering and overlay layers
- interaction state, crosshair state, and render scheduling
- visual output renderers
- drawing tools, drawing editor commands, hotkeys, magnet helpers, and serialization
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
editor.pointerDown({ x: 260, y: 240 });
```

The editor supports creation, selection, drag, anchor editing where anchors are editable, style editing, text editing, z-order commands, copy, paste, duplicate, lock, hide, delete, undo, and redo.

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

## Validation

Release candidate validation includes:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-artifact
npm run check:package-types
npm run check:performance
npm run check:release-readiness
npm run build
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
