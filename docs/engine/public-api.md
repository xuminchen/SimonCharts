# Public API

Import from the package root:

```ts
import {
  createChartEngine,
  renderStaticChart,
  createStaticLayers,
  createInteractionEngine,
  createDrawingEditor,
  createVisualRendererRegistry,
  supportedSeriesTypes
} from "@simoncharts/chart-engine";
```

`ChartEngine` is the public state facade for v0.1:

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
