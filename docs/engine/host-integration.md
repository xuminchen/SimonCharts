# Host Integration

A host application integrates SimonCharts by translating its own data and UI into neutral engine contracts.

Use the package root as the only SDK entrypoint:

```ts
import {
  createChartEngine,
  deserializeChartLayoutSnapshot,
  serializeChartLayoutSnapshot
} from "@simoncharts/chart-engine";
```

Typical host flow:

```ts
const engine = createChartEngine({ series });
const unsubscribe = engine.subscribe((event) => {
  if (event.type === "viewportChanged") {
    saveViewport(event.viewport);
  }
});
```

Minimum v0.4 integration sequence:

1. Normalize host market data into `CandleSeries`.
2. Create a chart engine from the package root with `createChartEngine({ series })`.
3. Create the current main `PriceScale` with `createMainPanelPriceScale()` and reuse that exact
   object in `RenderState`, `InteractionEngine`, and OHLC magnet projection.
4. Supply an explicit `ChartTimeFormatter` in every `RenderState` and tooltip formatting context.
5. Translate browser or native input into neutral viewport, interaction, drawing, and command calls.
6. Persist layout snapshots with `serializeChartLayoutSnapshot()` and restore them with `deserializeChartLayoutSnapshot()`.
7. Store the serialized payload in host-owned persistence.

The host owns:

- data loading and normalization into `CandleSeries`
- authentication and account context
- persistence of drawings, settings, and layouts
- product workflows and navigation
- application shell and UI composition

The engine owns:

- `SeriesType` transformation and rendering
- `ViewportState` and interaction output
- `IndicatorVisualOutput` rendering, autoscale, hit-test, and tooltip contracts
- `PanelDefinition` layout calculation
- `DrawingObject` editing and rendering
- neutral `ChartEngine` state, commands, and events
- reversible linear, log, and percentage price transforms; hosts own time presentation

`HostAdapter` can be used for neutral callback integration. It should adapt from engine events to host behavior outside the engine package.

The package build emits `dist/index.js` and `dist/index.d.ts`. Host applications should import from `@simoncharts/chart-engine`, not from `packages/chart-engine/src` or internal paths.

v0.8 enforces this import contract for host-facing repository code with:

```bash
npm run guard:sdk-imports
npm run check:host-smoke
npm run check:package-types
npm run check:package-consumer
```

`guard:sdk-imports` scans app and consumer fixture code for internal Engine imports. `check:host-smoke` packs `@simoncharts/chart-engine`, installs the generated tarball into a temporary non-workspace host project, and runs a neutral ESM host script whose only package import is `@simoncharts/chart-engine`. `check:package-types` compiles external type-only usage against the built package declarations. `check:package-consumer` verifies runtime package consumption from the package root.
