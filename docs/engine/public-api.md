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
  createChartExtension,
  createChartExtensionLifecycle,
  applyChartExtension,
  serializeChartLayoutSnapshot,
  deserializeChartLayoutSnapshot,
  createVisualRendererRegistry,
  supportedSeriesTypes
} from "@simoncharts/chart-engine";
```

The package root is backed by the built SDK artifacts:

- runtime: `packages/chart-engine/dist/index.js`
- declarations: `packages/chart-engine/dist/index.d.ts`
- export map: `@simoncharts/chart-engine`

`packages/chart-engine/api-surface.json` is the runtime public API snapshot. `npm run guard:public-api` fails when root exports change without an intentional snapshot update.

`packages/chart-engine/api-types.json` is the package-root TypeScript symbol snapshot. `npm run guard:public-types` uses the TypeScript checker to resolve exports from `packages/chart-engine/src/index.ts` and fails when public type symbols change without an intentional snapshot update.

SimonCharts v0.8 adds SDK consumer gates:

- `npm run check:package-types` compiles an external TypeScript consumer fixture against the package root and built declarations.
- `npm run guard:public-types` verifies the complete package-root TypeScript symbol snapshot.
- `npm run guard:sdk-imports` verifies host-facing code uses `@simoncharts/chart-engine` from the package root instead of internal package subpaths or `packages/chart-engine/src`.
- `npm run check:package-consumer` verifies runtime package consumption, including drawing editor command and capability APIs.

The stable SDK rule is simple: external consumers import from `@simoncharts/chart-engine` only. Internal source paths are not a public API.

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
- property schema: `getDrawingPropertySchema()`, `getDrawingPropertyDefinitionsForDrawing()`, `DrawingPropertySchema`, `DrawingPropertyDefinition`, `isTextDrawingType()`, `isFillDrawingType()`
- drawing conversion and render: `createFiguresForDrawing()`, `createDefaultDrawingRendererRegistry()`, `createDrawingLayer()`
- drawing persistence: `currentDrawingSchemaVersion`, `SerializedDrawingObject`, `serializeDrawingObject()`, `deserializeDrawingObject()`, `migrateSerializedDrawing()`
- drawing commands: `mergeDrawingStyle()`, `defaultDrawingHotkeyBindings`, `getDrawingCommandForHotkey()`
- magnet helpers: `createOhlcMagnetTargets()`, `createDrawingAnchorMagnetTargets()`, `createVisualPointMagnetTargets()`, `findNearestMagnetTarget()`, `snapPointToMagnetTargets()`
- indicators: `coreIndicatorIds`, `coreIndicatorDefinitions`, `calculateCoreIndicator()`
- extensions: `createChartExtension()`, `createChartExtensionRegistry()`, `applyChartExtension()`, `isBuiltInDrawingType()`, `isCustomDrawingType()`, `isDrawingType()`

These APIs use neutral drawing objects, figure primitives, visual outputs, command payloads, and serialized drawing payloads. They do not give the engine ownership of host APIs, stores, schemas, routes, TradingReviewSystem, review, strategy, watchlist, AI, or other product business models.

## v0.4 SDK And Layout Persistence

v0.4 adds package-level integration contracts:

- package output: `dist/index.js`, `dist/index.d.ts`, and root `exports`
- API guard: `api-surface.json` and `npm run guard:public-api`
- host smoke: `scripts/check-package-consumer.mjs`
- layout persistence: `currentLayoutSnapshotSchemaVersion`, `serializeChartLayoutSnapshot()`, `deserializeChartLayoutSnapshot()`

`ChartLayoutSnapshot` is neutral. It contains `viewport`, serialized `drawings`, `indicatorIds`, and optional `settings`. It does not contain host account, route, persistence, review, strategy, watchlist, AI, auth, or product workflow fields.

## v0.8 API Stabilization

v0.8 keeps the package root as the only stable entrypoint and adds verification for both runtime and type consumers:

- runtime exports: `packages/chart-engine/api-surface.json` plus `npm run guard:public-api`
- type exports: `packages/chart-engine/api-types.json` plus `npm run guard:public-types`
- type consumers: `scripts/fixtures/package-consumer-types.ts` plus `npm run check:package-types`
- host-facing imports: `npm run guard:sdk-imports`
- runtime package smoke: `npm run check:package-consumer`

New public APIs should be added through `packages/chart-engine/src/index.ts`, documented here, and accepted by updating the relevant guard evidence intentionally.

## v0.9 Platform Extensibility

v0.9 adds a neutral extension kernel:

- `ChartExtensionManifest`
- `ChartExtension`
- `ChartExtensionContributions`
- `ChartExtensionInstallContext`
- `ChartExtensionInstallResult`
- `ChartExtensionLifecycle`
- `ChartExtensionLifecycleState`
- `ChartExtensionUninstallResult`
- `createChartExtension()`
- `createChartExtensionRegistry()`
- `createChartExtensionLifecycle()`
- `applyChartExtension()`

Extension contributions install into existing Engine registries for series renderers, visual renderers, drawing renderers, drawing tools, and figure renderers. Use `createChartExtensionLifecycle(context)` for local install state, duplicate contribution detection, installed extension snapshots, and uninstall restoration. Use `applyChartExtension()` for direct one-way installs.

## v1.0 Drawing Property Schema

v1.0 adds Engine-owned drawing property metadata so complete drawing editor property panels can be generated from package-root APIs:

- `getDrawingPropertySchema(type)`
- `getDrawingPropertyDefinitionsForDrawing(drawing)`
- `DrawingPropertySchema`
- `DrawingPropertyDefinition`
- `isTextDrawingType(type)`
- `isFillDrawingType(type)`

The schema is command-oriented and host-independent. Style properties point to `updateSelectedStyle`, text content points to `updateSelectedText`, and state properties point to visibility and locking commands. Hosts still own DOM controls, layout, persistence, collaboration, and product workflows.

Custom drawing types are allowed only when namespaced, for example `acme.measurement-box`. `drawingTypes` remains the built-in drawing list. Use `isBuiltInDrawingType()`, `isCustomDrawingType()`, and `isDrawingType()` for validation.

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
