# Chart Types

Chart type selection is represented by `SeriesType`. v0.1 supports every value in `supportedSeriesTypes`:

```ts
[
  "bars",
  "candles",
  "hollowCandles",
  "volumeCandles",
  "line",
  "lineWithMarkers",
  "stepLine",
  "area",
  "hlcArea",
  "baseline",
  "columns",
  "highLow",
  "heikinAshi",
  "renko",
  "lineBreak",
  "kagi",
  "pointAndFigure"
]
```

Direct chart types render from source `CandleSeries`. Synthetic chart types use
`transformHeikinAshi()`, `transformRenko()`, `transformKagi()`, `transformLineBreak()`, and
`transformPointAndFigure()`.

Synthetic output points keep source traceability through `sourceIndex` or `sourceRange`. A
`SeriesRenderModel` also carries `sourceIndexOffset`; hit-testing subtracts it before resolving a
global source index against a bounded `source.candles` slice.

Use `createDefaultSeriesRendererRegistry()` with `createSeriesLayer()` for the built-in renderers.
Use `createSourceSeriesRenderModel(type, series)` when a host needs a direct neutral model.

Paged hosts can call `transformSeriesChunk(type, chunk, options, checkpoint)`. Its frozen,
JSON-safe checkpoint contains only the active transform state and processed source count.
`replaceTailCount` tells the host when a provisional Point & Figure tail must be replaced before
appending returned points. A host may pass the exact merged model as `RenderState.seriesModel`;
the layer uses it only when model type, symbol, timeframe, adjustment, and data version match the
current render selection.
