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

The visual subsystem includes:

- `getVisualAutoscaleRange(output)` for panel scale calculation
- `hitTestVisualOutput(context, x, y)` for pointer interaction
- `getVisualTooltipRows(hit)` for neutral tooltip rows

## Core Indicators

Core indicator metadata is exported as:

- `coreIndicatorIds`
- `CoreIndicatorId`
- `CoreIndicatorDefinition`
- `coreIndicatorDefinitions`

`CoreIndicatorDefinition.panelId` is the routing key used by visual rendering. `main` outputs draw over the price panel. Non-main ids such as `MACD`, `VOL`, `RSI`, or `KDJ` route to indicator sub-panels.

`calculateCoreIndicator(id, series, params)` returns an `IndicatorResult` with neutral `outputs`. The current core list is `MA`, `EMA`, `SMA`, `VOL`, `MACD`, `BOLL`, `KDJ`, `RSI`, `BIAS`, `CCI`, `DMI`, `OBV`, `VR`, `WR`, `MTM`, and `SAR`.

Visual outputs should carry only neutral chart coordinates, values, styles, labels, and ids. Host-specific indicator configuration, persistence ids, and product workflow state stay outside the engine.
