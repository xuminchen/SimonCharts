# Visual Outputs

Visual extensions use `IndicatorVisualOutput` as the neutral output model. Built-in output types include line, histogram, band, and marker outputs.

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

Visual outputs should carry only neutral chart coordinates, values, styles, labels, and ids. Host-specific indicator configuration, persistence ids, and product workflow state stay outside the engine.
