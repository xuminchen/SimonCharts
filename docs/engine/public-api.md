# Public API

Import from the package root:

```ts
import {
  checkEngineCapabilityRequirements,
  checkEngineApiVersionCompatibility,
  createChartEngine,
  createEngineCapabilityManifest,
  engineApiVersion,
  renderStaticChart,
  createStaticLayers,
  createInteractionEngine,
  createInteractionSession,
  createRenderScheduler,
  createDrawingEditor,
  createChartExtension,
  createChartExtensionLifecycle,
  checkChartExtensionCompatibility,
  validateChartExtension,
  applyChartExtension,
  serializeChartLayoutSnapshot,
  deserializeChartLayoutSnapshot,
  createDrawingRendererRegistry,
  hitTestDrawing,
  hitTestDrawingAll,
  getDrawingHoverState,
  createOhlcMagnetTargetsFromSeries,
  getMagnetSnapState,
  createVisualRendererRegistry,
  supportedSeriesTypes
} from "@simoncharts/chart-engine";
```

The package root is backed by the built SDK artifacts:

- runtime: `packages/chart-engine/dist/index.js`
- declarations: `packages/chart-engine/dist/index.d.ts`
- export map: `@simoncharts/chart-engine`

`packages/chart-engine/api-surface.json` is the runtime public API snapshot. It must be a sorted string array of package-root runtime exports. `npm run guard:public-api` fails when root exports change or when the snapshot shape/order is invalid. Use `node scripts/check-public-api.mjs --write` only after reviewing the runtime export diff and deciding the new package-root API is intentional; write mode emits the canonical sorted string array with a trailing newline.

`packages/chart-engine/api-types.json` is the package-root TypeScript symbol snapshot. `npm run guard:public-types` uses the TypeScript checker to resolve exports from `packages/chart-engine/src/index.ts` and fails when public type symbols change without an intentional snapshot update. Use `node scripts/check-public-types.mjs --write` only after reviewing the type symbol diff.

SimonCharts v0.8 adds SDK consumer gates:

- `npm run check:package-types` compiles an external TypeScript consumer fixture against the package root and built declarations.
- `npm run guard:public-types` verifies the complete package-root TypeScript symbol snapshot.
- `npm run guard:sdk-imports` verifies host-facing code uses `@simoncharts/chart-engine` from the package root instead of internal package subpaths or `packages/chart-engine/src`.
- `npm run check:package-consumer` verifies runtime package consumption, including drawing editor command and capability APIs.

The stable SDK rule is simple: external consumers import from `@simoncharts/chart-engine` only. Internal source paths are not a public API.

## Capability Manifest

`createEngineCapabilityManifest()` returns the current Engine capability surface from package-root exports:

```ts
const manifest = createEngineCapabilityManifest();

console.log(manifest.seriesTypes.length); // 17
console.log(manifest.drawingTypes.length); // 63
console.log(manifest.coreIndicatorIds.length); // 16
```

The manifest is deterministic and host-independent. It summarizes package metadata, release channel, supported series types, built-in drawing types, built-in drawing tool summaries, core indicator ids, visual output renderer families, drawing editor capabilities, interaction capabilities, and extension contribution types.

Hosts can render the manifest in diagnostics, documentation, onboarding, and compatibility checks. Hosts still own product feature flags, permissions, persistence, routing, remote plugin loading, collaboration, and business workflows.

Use `checkEngineCapabilityRequirements()` when a consumer needs a deterministic compatibility check against a manifest:

```ts
const result = checkEngineCapabilityRequirements(manifest, {
  seriesTypes: ["candles", "line"],
  drawingTypes: ["trendLine"],
  coreIndicatorIds: ["MA", "MACD"]
});

if (!result.compatible) {
  console.log(result.missing);
}
```

The checker compares neutral manifest fields only. Unknown future strings are reported as missing rather than rejected, which keeps external configuration and future package versions easy to diagnose. The checker is not a host feature flag, permission, persistence, routing, plugin trust, or collaboration system.

Use `checkEngineApiVersionCompatibility()` when a consumer needs exact API contract diagnostics before relying on package-root APIs:

```ts
const result = checkEngineApiVersionCompatibility(manifest, {
  packageName: "@simoncharts/chart-engine",
  apiVersion: engineApiVersion,
  releaseChannel: "rc"
});

if (!result.compatible) {
  console.log(result.mismatches);
}
```

API version diagnostics compare provided strings exactly in deterministic order. They are separate from capability requirements and do not implement semver ranges, host feature flags, permissions, persistence, routing, plugin trust, or TradingReviewSystem workflows.

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
- interaction primitives: `getDrawingEditHandles()`, `getDrawingSelectionBounds()`, `getDrawingIdsInBounds()`, `normalizeDrawingSelectionBounds()`
- body hit-test primitives: `hitTestDrawing()`, `hitTestDrawingAll()`, `DrawingHitTestMatch`, `DrawingHitTestOptions`, `DrawingPoint`
- hover intent primitives: `getDrawingHoverState()`, `DrawingHoverState`, `DrawingHoverStateOptions`, `DrawingHoverTarget`, `DrawingHoverCursor`
- handle drag primitives: `hitTestDrawingEditHandle()`, `beginDrawingHandleDrag()`, `updateDrawingHandleDrag()`, `finishDrawingHandleDrag()`, `getDrawingHandleDragCommand()`, `DrawingHandleDragOperation`, `DrawingHandleDragPreview`
- move drag primitives: `beginDrawingMoveDrag()`, `updateDrawingMoveDrag()`, `finishDrawingMoveDrag()`, `getDrawingMoveDragCommand()`, `DrawingMoveDragOperation`, `DrawingMoveDragPreview`, `DrawingMoveDragCommand`
- selection box primitives: `beginDrawingSelectionBox()`, `updateDrawingSelectionBox()`, `finishDrawingSelectionBox()`, `getDrawingSelectionBoxCommand()`, `DrawingSelectionBoxOperation`, `DrawingSelectionBoxPreview`
- transform primitives: `resizeDrawing()`, `resizeDrawings()`, `rotateDrawing()`, `rotateDrawings()`, `DrawingResizeOptions`, `DrawingRotateOptions`, `DrawingTransformPoint`
- property schema: `getDrawingPropertySchema()`, `getDrawingPropertyDefinitionsForDrawing()`, `DrawingPropertySchema`, `DrawingPropertyDefinition`, `DrawingParameterPropertyDefinition`, `isTextDrawingType()`, `isFillDrawingType()`
- drawing conversion and render: `createFiguresForDrawing()`, `createDefaultDrawingRendererRegistry()`, `createDrawingLayer()`
- drawing persistence: `currentDrawingSchemaVersion`, `SerializedDrawingObject`, `serializeDrawingObject()`, `deserializeDrawingObject()`, `migrateSerializedDrawing()`
- drawing commands: `mergeDrawingStyle()`, `defaultDrawingHotkeyBindings`, `getDrawingCommandForHotkey()`
- magnet helpers: `createOhlcMagnetTargets()`, `createOhlcMagnetTargetsFromSeries()`, `createDrawingAnchorMagnetTargets()`, `createVisualPointMagnetTargets()`, `findNearestMagnetTarget()`, `snapPointToMagnetTargets()`, `getMagnetSnapState()`, `MagnetPlotArea`, `MagnetPriceRange`, `MagnetSnapState`, `MagnetSnapStateOptions`, `OhlcMagnetTargetOptions`
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
- `getChartExtensionCapabilityRequirements()`
- `checkChartExtensionCompatibility()`
- `validateChartExtension()`

Extension contributions install into existing Engine registries for series renderers, visual renderers, drawing renderers, drawing tools, and figure renderers. Use `createChartExtensionLifecycle(context)` for local install state, duplicate contribution detection, installed extension snapshots, atomic local install rollback, and uninstall restoration. If a registry throws during lifecycle install, contribution registry mutations already applied by that install attempt are rolled back before the original error is rethrown. Lifecycle records and contribution owner tracking are committed only after all local contribution registrations succeed. Use `applyChartExtension()` for direct one-way installs.

`getChartExtensionCapabilityRequirements(extension)` derives neutral requirements from local contribution arrays. `checkChartExtensionCompatibility(manifest, extension)` compares those requirements against `EngineCapabilityManifest` before install. These helpers are diagnostics only: they do not load, sandbox, trust, persist, install, or distribute extensions.

`validateChartExtension(extension)` returns deterministic validation issues for local extension definitions. It checks manifest identity fields, duplicate contribution keys, and drawing contribution type names without installing the extension. Hosts still own security review, sandboxing, trust policy, marketplace review, persistence, permissions, and product workflows.

`createChartExtensionLifecycle(context).validateInstall(extension)` returns install-time diagnostics for the current local lifecycle state. It reports structural validation issues, already installed extension ids, and installed contribution conflicts without installing, uninstalling, mutating registries, loading code, sandboxing code, trusting code, persisting extensions, or granting permissions.

## v1.0 Drawing Property Schema

v1.0 adds Engine-owned drawing property metadata so complete drawing editor property panels can be generated from package-root APIs:

- `getDrawingPropertySchema(type)`
- `getDrawingPropertyDefinitionsForDrawing(drawing)`
- `DrawingPropertySchema`
- `DrawingPropertyDefinition`
- `isTextDrawingType(type)`
- `isFillDrawingType(type)`

The schema is command-oriented and host-independent. Style properties point to `updateSelectedStyle`, text content points to `updateSelectedText`, parameter properties point to `updateSelectedMetadata`, and state properties point to visibility and locking commands. Hosts still own DOM controls, layout, persistence, collaboration, and product workflows.

Advanced drawing parameters use Engine-owned metadata keys such as `fibonacciLevels`, `gannRatios`, `positionLabel`, and `rangeLabel`. Rendering consumes valid Fibonacci level lists, Gann ratio lists, and label metadata, while invalid or missing metadata falls back to Engine defaults.

Drawing interaction primitives include `selectDrawingsInBounds`, `nudgeSelected`, `getSelectedEditHandles`, `getDrawingEditHandles`, `getDrawingSelectionBounds`, `getDrawingIdsInBounds`, and `normalizeDrawingSelectionBounds`. Drawing body hit-test primitives include `hitTestDrawing` and `hitTestDrawingAll`; hosts pass neutral drawings, a point, and a `DrawingRendererRegistry`, then the Engine handles hidden/locked filtering plus distance and z-order sorting. Drawing hover intent uses `getDrawingHoverState`; hosts pass neutral drawings, selected handles, a point, and a renderer registry, then the Engine returns a target, hovered drawing id, and cursor intent while staying DOM-free. OHLC target creation uses `createOhlcMagnetTargetsFromSeries`; hosts pass neutral candle series, viewport, plot area, optional price range, and optional fields, then the DOM-free Engine returns visible candle OHLC `MagnetSnapTarget[]`. Drawing magnet snap state uses `getMagnetSnapState`; hosts pass a neutral point, neutral targets, and a radius, then the Engine returns the snapped point, matched target, and neutral magnet session state. Drawing handle drag primitives include `hitTestDrawingEditHandle`, `beginDrawingHandleDrag`, `updateDrawingHandleDrag`, `finishDrawingHandleDrag`, and `getDrawingHandleDragCommand`. Drawing move drag primitives include `beginDrawingMoveDrag`, `updateDrawingMoveDrag`, `finishDrawingMoveDrag`, and `getDrawingMoveDragCommand`; hosts pass neutral drawing snapshots and selected ids, the Engine returns preview drawings from the original operation snapshot, and finish returns one `dragSelected` command. Drawing selection box primitives include `beginDrawingSelectionBox`, `updateDrawingSelectionBox`, `finishDrawingSelectionBox`, and `getDrawingSelectionBoxCommand`. Drawing transform primitives include `resizeDrawing`, `resizeDrawings`, `rotateDrawing`, `rotateDrawings`, `resizeSelected`, and `rotateSelected`. These are DOM-free contracts for selection boxes, keyboard nudging, body hit-testing, hover intent, OHLC target projection, magnet snap state, edit handle metadata, handle drag operation flow, selected drawing move drag flow, and resize/rotate geometry mutation. Hosts still own pointer events, pointer capture, keyboard event routing, magnet toggles, target collection timing, DOM cursor styling, hover and magnet render invalidation, visual handle UI, persistence, collaboration, and UI toggles.

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
