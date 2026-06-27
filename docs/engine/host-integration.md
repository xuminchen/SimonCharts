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
3. Translate browser or native input into neutral viewport, interaction, drawing, and command calls.
4. Persist layout snapshots with `serializeChartLayoutSnapshot()` and restore them with `deserializeChartLayoutSnapshot()`.
5. Store the serialized payload in host-owned persistence.

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

`HostAdapter` can be used for neutral callback integration. It should adapt from engine events to host behavior outside the engine package.

The package build emits `dist/index.js` and `dist/index.d.ts`. Host applications should import from `@simoncharts/chart-engine`, not from `packages/chart-engine/src` or internal paths.
