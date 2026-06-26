# Public API

Import from the package root:

```ts
import {
  createChartEngine,
  renderStaticChart,
  createStaticLayers,
  createInteractionEngine,
  createInteractionSession,
  createRenderScheduler,
  createDrawingEditor,
  createVisualRendererRegistry,
  supportedSeriesTypes
} from "@simoncharts/chart-engine";
```

## Facade

`ChartEngine` is the public state facade:

```ts
const engine = createChartEngine({ series });

engine.setSeriesType("line");
engine.setViewport({
  visibleRange: { from: 1, to: 80 },
  candleWidth: 8,
  scrollOffset: 0,
  priceScaleMode: "linear"
});

const state = engine.getState();
```

The facade state is neutral: `CandleSeries`, `SeriesType`, `ViewportState`, `IndicatorVisualOutput[]`, `DrawingObject[]`, `ChartSettings`, `timeframe`, and command state. It does not contain host account, route, persistence, review, strategy, watchlist, AI, or auth fields.

Events use `ChartEngineEvent`:

```ts
const unsubscribe = engine.subscribe((event) => {
  if (event.type === "seriesTypeChanged") {
    console.log(event.seriesType);
  }
});

unsubscribe();
engine.destroy();
```

For lower-level integration, hosts can use rendering and interaction modules directly. `HostAdapter` remains a neutral callback surface for viewport and event handoff without giving the engine access to host internals.

## v0.3 Visual Drawing Platform

Drawing platform exports include:

- figures: `FigureObject`, `FigureType`, `FigureStyle`, `createBuiltInFigureRenderers()`, `createFigureRendererRegistry()`, `getFigureBounds()`, `hitTestFigure()`
- drawing tools: `drawingTypes`, `DrawingType`, `DrawingToolDefinition`, `builtInDrawingToolDefinitions`, `createDrawingToolRegistry()`
- editor state: `createDrawingEditor()`, `DrawingEditor`, `DrawingEditorCommand`, `DrawingObjectManagerItem`
- drawing conversion and render: `createFiguresForDrawing()`, `createDefaultDrawingRendererRegistry()`, `createDrawingLayer()`
- drawing persistence: `currentDrawingSchemaVersion`, `SerializedDrawingObject`, `serializeDrawingObject()`, `deserializeDrawingObject()`, `migrateSerializedDrawing()`
- drawing commands: `mergeDrawingStyle()`, `defaultDrawingHotkeyBindings`, `getDrawingCommandForHotkey()`
- magnet helpers: `createOhlcMagnetTargets()`, `createDrawingAnchorMagnetTargets()`, `createVisualPointMagnetTargets()`, `findNearestMagnetTarget()`, `snapPointToMagnetTargets()`
- indicators: `coreIndicatorIds`, `coreIndicatorDefinitions`, `calculateCoreIndicator()`

These APIs use neutral drawing objects, figure primitives, visual outputs, command payloads, and serialized drawing payloads. They do not give the engine ownership of host APIs, stores, schemas, routes, TradingReviewSystem, review, strategy, watchlist, AI, or other product business models.

## v0.2 Interaction And Rendering

Use `createInteractionSession()` for neutral input state and `createRenderScheduler()` for render lifecycle scheduling.

```ts
import {
  createInteractionSession,
  createRenderScheduler,
  type InteractionInput,
  type RenderInvalidation
} from "@simoncharts/chart-engine";

interface HostRenderState {
  canvas: unknown;
  context: unknown;
  chartState: unknown;
}

const hostRenderState: HostRenderState = {
  canvas: {},
  context: {},
  chartState: {}
};

function requestHostFrame(callback: () => void): number {
  return requestAnimationFrame(callback);
}

function renderStaticLayer(state: HostRenderState, invalidation: RenderInvalidation): void {
  // Host-owned canvas/context/state drawing. The engine only supplies invalidation data.
  void state;
  void invalidation;
}

function renderDynamicLayer(state: HostRenderState, invalidation: RenderInvalidation): void {
  // Host-owned dynamic drawing.
  void state;
  void invalidation;
}

function renderOverlayLayer(state: HostRenderState, invalidation: RenderInvalidation): void {
  // Host-owned overlay drawing.
  void state;
  void invalidation;
}

const scheduler = createRenderScheduler({
  requestFrame: requestHostFrame,
  renderPass(pass, invalidation) {
    if (pass === "static") {
      renderStaticLayer(hostRenderState, invalidation);
    }

    if (pass === "dynamic") {
      renderDynamicLayer(hostRenderState, invalidation);
    }

    if (pass === "overlay") {
      renderOverlayLayer(hostRenderState, invalidation);
    }
  }
});

const session = createInteractionSession({
  onEvent(event) {
    if (event.type === "pointerMoved") {
      scheduler.invalidate({ layers: ["crosshair"], reason: event.type });
    }
  }
});

function handleHostPointerMove(point: { x: number; y: number }): void {
  const input: InteractionInput = { type: "pointerMove", point };

  session.handleInput(input);
}
```

Hosts translate native or browser events into `InteractionInput`, then translate `renderPass(pass, invalidation)` callbacks into canvas render calls. Canvas, context, and render state stay host-owned; the scheduler only passes the render pass and `RenderInvalidation`. `ChartEngine.setInteractionState()` and `ChartEngine.setRenderState()` can store neutral snapshots for facade subscribers.

These APIs are host-independent. The engine does not import DOM events, host APIs, stores, schemas, routes, TradingReviewSystem, review, strategy, watchlist, AI, or other product business models.
