# Host Integration

A host application integrates SimonCharts by translating its own data and UI into neutral engine contracts.

Typical host flow:

```ts
const engine = createChartEngine({ series });
const unsubscribe = engine.subscribe((event) => {
  if (event.type === "viewportChanged") {
    saveViewport(event.viewport);
  }
});
```

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
