# Testing Strategy

The engine test strategy has three layers.

Unit tests cover engine contracts and behavior:

```bash
npm run test
```

Focused examples include model validation, series transforms, renderer registries, autoscale, hit-test, visual outputs, drawing editor operations, command history, `ChartEngine`, and static rendering.

Capability manifest tests verify the package-root Engine support summary, including count alignment for 17 series types, 63 built-in drawing types, and 16 core indicators.

Type and boundary verification:

```bash
npm run typecheck
npm run guard:engine-boundary
```

`typecheck` validates the package and playground TypeScript projects. The boundary guard validates that the chart engine stays independent from host application code and business vocabulary.

Browser acceptance uses Playwright:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Playwright coverage verifies static canvas rendering, interaction, every v0.1 chart type, visual panels, drawing editor flows, and settings/action controls.

Before a release candidate, run:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run check:performance
npm run check:release-readiness
npm run build
npm run check:package-artifact
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

## v1.0 Release Candidate Verification

`createEngineCapabilityManifest()` has focused coverage so hosts can inspect the Engine feature surface through a neutral package-root API. The manifest is validated as diagnostics metadata only; it does not control host feature flags, permissions, persistence, remote plugins, or collaboration.

`npm run check:performance` runs the Engine performance baseline as a focused release gate. It covers deterministic 10k-candle and 50k-candle scenarios for render model creation, autoscale, core indicators, static rendering, drawing figure conversion, and render scheduler invalidation throughput.

`npm run guard:public-types` verifies package-root TypeScript symbols against `packages/chart-engine/api-types.json`. It complements `npm run guard:public-api`, which verifies runtime exports.

`npm run check:package-artifact` verifies the dry-run npm tarball contains only package files (`README.md`, `package.json`, and `dist/`) and includes required runtime and declaration artifacts.

`npm run check:release-readiness` verifies the RC package version, package metadata, root export map, required docs, required root scripts, and workspace lockfile version alignment.

The v1.0 RC gate is intentionally package-focused. It does not add TradingReviewSystem or host application checks because SimonCharts Engine is validated as an independent reusable kernel.

## v0.8 API Stabilization Verification

Focused SDK boundary coverage:

```bash
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
```

`guard:public-api` verifies runtime root exports against `packages/chart-engine/api-surface.json`.

`guard:public-types` verifies package-root TypeScript symbols against `packages/chart-engine/api-types.json`.

`guard:sdk-imports` verifies host-facing code imports `@simoncharts/chart-engine` only from the package root.

`check:package-consumer` verifies runtime SDK consumption, including chart engine, drawing serialization, indicators, drawing editor command/capability APIs, drawing metadata commands, drawing interaction primitives, drawing transform primitives, drawing property schema APIs, and OHLC magnet target projection from neutral candle series.

`check:package-types` compiles `scripts/fixtures/package-consumer-types.ts` against the package root and built declarations, covering type-only contracts that runtime export checks cannot see, including drawing property schema, advanced parameter, drawing interaction, drawing magnet snap state, OHLC magnet target projection, and drawing transform types.

## v1.0 OHLC Magnet Target Projection Verification

Focused OHLC magnet target projection coverage:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
npm run check:package-consumer
npm run check:package-types
```

SDK runtime coverage verifies package-root consumers can call `createOhlcMagnetTargetsFromSeries()` with `fixtureDailyCandleSeries`, the Engine viewport, and a neutral plot area, then read visible candle OHLC targets. Type coverage verifies `OhlcMagnetTargetOptions`, `MagnetPlotArea`, and `MagnetPriceRange` against built declarations.

OHLC target creation is DOM-free. Hosts pass neutral candle series, viewport, plot area, optional price range, and optional fields; the Engine returns visible candle OHLC `MagnetSnapTarget[]`. Hosts still own pointer events, magnet toggles, target collection timing, render invalidation, persistence, and collaboration.

## v1.0 Drawing Magnet Snap State Verification

Focused drawing magnet snap state coverage:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
npm run check:package-consumer
npm run check:package-types
```

SDK runtime coverage verifies package-root consumers can call `getMagnetSnapState()` with a neutral point, a drawing-anchor or OHLC target, and a radius, then read the snapped point and neutral magnet mode. Type coverage verifies `MagnetSnapState` and `MagnetSnapStateOptions` against built declarations.

The snap state contract is DOM-free. Hosts pass neutral points, targets, and radius values; the Engine returns the snapped point, matched target, and neutral magnet session state. Hosts still own pointer events, target collection timing, render invalidation, persistence, collaboration, and UI toggles.

## v1.0 Drawing Hover Intent Verification

Focused drawing hover intent coverage:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHover.test.ts
npm run guard:public-api
npm run guard:public-types
npm run check:package-consumer
npm run check:package-types
```

Unit coverage verifies handle-first hover targeting, body hover targeting through a `DrawingRendererRegistry`, no-hit crosshair intent, resize handle cursor intent, and active target cursor stability.

SDK coverage verifies runtime consumers can call `getDrawingHoverState()` from `@simoncharts/chart-engine` with neutral drawings, empty or selected handles, a point, and a renderer registry. Type coverage verifies `DrawingHoverState`, `DrawingHoverTarget`, `DrawingHoverCursor`, `DrawingHoverStateOptions`, and the neutral `{ type: "cursor"; cursor }` interaction input.

Browser or host integration remains responsible for DOM cursor styling, native pointer events, hover rendering invalidation, persistence, and collaboration.

## v1.0 Drawing Hit Test Verification

Focused drawing body hit-test coverage:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHitTest.test.ts
npm run guard:public-api
npm run guard:public-types
npm run check:package-consumer
npm run check:package-types
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
```

Unit coverage verifies `hitTestDrawing`, `hitTestDrawingAll`, hidden filtering, optional locked filtering, distance ordering, equal-distance z-order tie behavior, renderer registry routing, and missing renderer errors.

SDK coverage verifies runtime consumers can call drawing body hit-test APIs from `@simoncharts/chart-engine` with a `DrawingRendererRegistry`, and type consumers can import `DrawingHitTestMatch`, `DrawingHitTestOptions`, and `DrawingPoint`.

Browser coverage verifies the playground routes selected drawing body hits through the Engine-owned hit-test contract while still owning pointer events, cursor UI, hover rendering, persistence, and collaboration.

## v1.0 Drawing Transform Verification

Focused drawing transform coverage:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingTransform.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
```

Unit coverage verifies `resizeDrawing`, `resizeDrawings`, `rotateDrawing`, `rotateDrawings`, editor `resizeSelected` and `rotateSelected` commands, locked drawing protection, update events, and undo/redo behavior.

Browser coverage verifies the playground can execute Engine-owned resize and rotate commands for selected drawings and reflect the transformed coordinates through neutral drawing export JSON.

## v1.0 Drawing Handle Drag Verification

Focused drawing handle drag coverage:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHandleDrag.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
```

Unit coverage verifies handle hit-testing, handle drag operation creation, anchor drag previews, resize previews from the original selection snapshot, rotate previews, final command generation, locked drawing rejection, and the editor `dragAnchor` command.

Browser coverage verifies the playground can route a selected drawing anchor handle drag through the Engine operation flow and commit the resulting neutral command.

## v1.0 Drawing Move Drag Verification

Focused drawing move drag coverage:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingMoveDrag.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
```

Unit coverage verifies move drag operation creation, preview drawings derived from the original operation snapshot, final `dragSelected` command generation, locked drawing protection, zero-distance rejection, and editor undo/redo behavior for the committed move command.

Browser coverage verifies the playground can route selected drawing body movement through the Engine operation flow, render previews during pointer movement, and commit one neutral command on pointer up.

## v1.0 Drawing Selection Box Verification

Focused drawing selection box coverage:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingSelectionBox.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
```

Unit coverage verifies selection box bounds normalization, snapshot isolation, hidden and locked selection options, additive preview ids, and final `selectDrawingsInBounds` command generation.

Browser coverage verifies the playground can route Shift+drag selection through the Engine operation flow without replacing normal no-modifier chart pan behavior.

## v0.9 Platform Extensibility Verification

Focused extension coverage:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts packages/chart-engine/src/__tests__/drawingModel.test.ts packages/chart-engine/src/__tests__/drawingSchema.test.ts
npm run guard:public-api
npm run check:package-consumer
npm run check:package-types
```

Unit coverage verifies extension manifests, install results, duplicate extension ids, contribution installation, cloned manifests, namespaced custom drawing types, and rejection of unscoped drawing type names.

SDK coverage verifies extension APIs and custom drawing types can be consumed from `@simoncharts/chart-engine`.

## v0.6 Rendering Hardening Verification

Focused rendering hardening coverage:

```bash
npm run test -- packages/chart-engine/src/__tests__/renderScheduler.test.ts packages/chart-engine/src/__tests__/staticRenderer.test.ts packages/chart-engine/src/__tests__/overlayLayers.test.ts packages/chart-engine/src/__tests__/performanceBaseline.test.ts
npm run typecheck
```

`RenderScheduler` verification covers frame diagnostics, pass diagnostics, diagnostic clone isolation, deterministic layer/pass ordering, same-frame coalescing, follow-up invalidations, slow frame counts, and destroy cleanup.

Static and overlay renderer verification covers deterministic layer order, explicit static clear/background options, default overlay clearing, and overlay clear opt-out for hosts that manage overlay surfaces directly.

Performance coverage includes deterministic scheduler overhead in addition to render model creation, autoscale, indicators, drawing figure conversion, and static canvas rendering.

## v0.7 Drawing Editor Productization Verification

Focused drawing editor productization coverage:

```bash
npm run test -- packages/chart-engine/src/__tests__/commands.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts packages/chart-engine/src/__tests__/drawingHotkeys.test.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
```

Unit coverage verifies `CommandHistory.canUndo()`, `CommandHistory.canRedo()`, `DrawingEditor.executeCommand()`, `DrawingEditor.getCapabilities()`, clipboard state, command availability, lock/unlock, hide/show, and undo/redo capability updates.

Browser coverage verifies the neutral playground drawing toolbar binds enabled and disabled states to engine capabilities and executes copy, paste, duplicate, z-order, lock, unlock, hide, show, undo, and redo actions.

## v0.4 Integration Readiness Verification

Package SDK output is verified with:

```bash
npm run build -w @simoncharts/chart-engine
test -f packages/chart-engine/dist/index.js
test -f packages/chart-engine/dist/index.d.ts
npm pack --dry-run -w @simoncharts/chart-engine
```

Public API and package-consumer checks are:

```bash
npm run guard:public-api
npm run check:package-consumer
```

Host and persistence contracts are covered by:

```bash
npm run test -- packages/chart-engine/src/__tests__/hostIntegrationContract.test.ts
npm run test -- packages/chart-engine/src/__tests__/persistenceContract.test.ts packages/chart-engine/src/__tests__/drawingSchema.test.ts
```

The performance baseline uses deterministic 10k-candle fixtures and conservative upper bounds for render model creation, full-range autoscale, all core indicators, drawing figure conversion, and static canvas rendering:

```bash
npm run test -- packages/chart-engine/src/__tests__/performanceBaseline.test.ts
```

## v0.2 Interaction And Rendering Verification

`InteractionSession` verification covers neutral idle state, pointer and drag lifecycle, crosshair, tooltip, magnet, keyboard zoom commands, cleanup on leave or blur, and cloned event/state payloads:

```bash
npm run test -- packages/chart-engine/src/__tests__/interactionSession.test.ts
```

`RenderScheduler` verification covers `RenderInvalidation` coalescing, render pass order, pending dirty layers, follow-up invalidations, `RenderMetrics`, slow frame counts, and destroy cleanup:

```bash
npm run test -- packages/chart-engine/src/__tests__/renderScheduler.test.ts
```

`ChartEngine` facade verification covers neutral interaction and render snapshots through `setInteractionState()`, `setRenderState()`, `getState()`, and facade events:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartEngine.test.ts
```

Playground integration exercises playground browser input translation and verifies diagnostics and behavior, including high-frequency pointer movement without static redraw spam and keyboard zoom commands through neutral interaction events:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/interaction-rendering-hardening.spec.ts
```

Boundary verification confirms engine TypeScript files do not import app or host modules through forbidden paths and do not contain blocked host or business vocabulary:

```bash
npm run guard:engine-boundary
```

## v0.3 Visual Drawing Verification

Focused unit coverage for the drawing platform includes:

- `figurePrimitives.test.ts` for figure renderer registration, bounds, hit-test, and render calls
- `drawingToolRegistry.test.ts` for `builtInDrawingToolDefinitions` and `createDrawingToolRegistry()`
- `drawingSchema.test.ts` for `currentDrawingSchemaVersion`, migration, serialization, and deserialization
- `drawingCoverage.test.ts` for every built-in `DrawingType` routing through `createFiguresForDrawing()`
- `drawingEditorComplete.test.ts` for selection, object manager state, z-order, style, text, copy, paste, duplicate, lock, hide, undo, and redo
- `drawingHotkeys.test.ts` for `defaultDrawingHotkeyBindings`, `getDrawingCommandForHotkey()`, and magnet tie order
- `coreIndicators.test.ts` for `coreIndicatorDefinitions` and `calculateCoreIndicator()`

Playground acceptance for the v0.3 workbenches is split across:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-coverage.spec.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/indicator-workbench.spec.ts
```

The drawing workbench verifies grouped tool controls, object manager state, property edits, import/export, and representative built-in tools. The indicator workbench verifies the selector exposes every `coreIndicatorDefinitions` entry and routes visual outputs to the expected panel ids.
