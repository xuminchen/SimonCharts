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

Direct chart types render from source `CandleSeries`. Synthetic chart types use transform modules such as `transformToHeikinAshi`, `transformToRenko`, `transformToKagi`, `transformToLineBreak`, and `transformToPointAndFigure`.

Synthetic output points keep source traceability through `sourceIndex` or `sourceRange`. This lets hit-testing and tooltips return back to the original source candle range without importing host-specific data.

Use `createDefaultSeriesRendererRegistry()` with `createSeriesLayer()` for the built-in renderers. Use `createSeriesRenderModel(series, seriesType)` when a host needs the neutral render model before drawing.
