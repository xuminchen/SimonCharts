# Testing Strategy

The engine test strategy has three layers.

Unit tests cover engine contracts and behavior:

```bash
npm run test
```

Focused examples include model validation, series transforms, renderer registries, autoscale, hit-test, visual outputs, drawing editor operations, command history, `ChartEngine`, and static rendering.

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
npm run check:package-consumer
npm run build
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

## v0.6 Rendering Hardening Verification

Focused rendering hardening coverage:

```bash
npm run test -- packages/chart-engine/src/__tests__/renderScheduler.test.ts packages/chart-engine/src/__tests__/staticRenderer.test.ts packages/chart-engine/src/__tests__/overlayLayers.test.ts packages/chart-engine/src/__tests__/performanceBaseline.test.ts
npm run typecheck
```

`RenderScheduler` verification covers frame diagnostics, pass diagnostics, diagnostic clone isolation, deterministic layer/pass ordering, same-frame coalescing, follow-up invalidations, slow frame counts, and destroy cleanup.

Static and overlay renderer verification covers deterministic layer order, explicit static clear/background options, default overlay clearing, and overlay clear opt-out for hosts that manage overlay surfaces directly.

Performance coverage includes deterministic scheduler overhead in addition to render model creation, autoscale, indicators, drawing figure conversion, and static canvas rendering.

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
