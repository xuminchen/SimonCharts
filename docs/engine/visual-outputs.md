# Visual Outputs

Visual extensions use `IndicatorVisualOutput` as the neutral output model. Built-in output types are line, histogram, band, and marker outputs.

Register renderers through `VisualRenderer`:

```ts
const registry = createVisualRendererRegistry();

registry.register(createLineVisualRenderer());
registry.register(createHistogramVisualRenderer());
registry.register(createBandVisualRenderer());
registry.register(createMarkerVisualRenderer());
```

Then render them through `createVisualLayer(registry)` and pass outputs in `RenderState.visualOutputs`.

Main-panel outputs receive the exact `RenderState.priceScale` used by candles, axes, crosshair,
interaction, and OHLC magnet projection. Sub-panel outputs receive a separate linear
`valueScale`, so oscillators such as MACD can render zero and negative values even when the main
panel uses log or percentage mode. In log mode, non-positive main-panel values are skipped.

The visual subsystem includes:

- `renderer.getAutoscale(output)` for panel scale calculation
- `renderer.hitTest(context, x, y)` for pointer interaction
- `renderer.getTooltipRows(hit, { formatTime, timeframe })` for host-formatted neutral tooltip rows

## Core Indicators

Core indicator metadata is exported as:

- `coreIndicatorIds`
- `CoreIndicatorId`
- `CoreIndicatorDefinition`
- `coreIndicatorDefinitions`

`CoreIndicatorDefinition.panelId` is the routing key used by visual rendering. `main` outputs draw over the price panel. Non-main ids such as `MACD`, `VOL`, `RSI`, or `KDJ` route to indicator sub-panels.

`calculateCoreIndicator(id, series, params)` returns an `IndicatorResult` with neutral `outputs`. The current core list is `MA`, `EMA`, `SMA`, `VOL`, `MACD`, `BOLL`, `KDJ`, `RSI`, `BIAS`, `CCI`, `DMI`, `OBV`, `VR`, `WR`, `MTM`, and `SAR`.

Visual outputs should carry only neutral chart coordinates, values, styles, labels, and ids. Host-specific indicator configuration, persistence ids, and product workflow state stay outside the engine.
