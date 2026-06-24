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

## v0.2 Interaction And Rendering

Use `createInteractionSession()` for neutral input state and `createRenderScheduler()` for render lifecycle scheduling.

```ts
import {
  createInteractionSession,
  createRenderScheduler,
  type InteractionInput,
  type RenderInvalidation,
  type RenderPass
} from "@simoncharts/chart-engine";

function renderCanvasPass(pass: RenderPass, invalidation: RenderInvalidation): void {
  renderHostCanvas(pass, invalidation.layers);
}

const scheduler = createRenderScheduler({
  requestFrame: requestAnimationFrame,
  renderPass(pass, invalidation) {
    renderCanvasPass(pass, invalidation);
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

Hosts translate native or browser events into `InteractionInput`, then translate `renderPass` callbacks into canvas render calls. `ChartEngine.setInteractionState()` and `ChartEngine.setRenderState()` can store neutral snapshots for facade subscribers.

These APIs are host-independent. The engine does not import DOM events, host APIs, stores, schemas, routes, TradingReviewSystem, review, strategy, watchlist, AI, or other product business models.
