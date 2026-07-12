# Actions And Commands

Command input uses `ChartEngineCommand`:

```ts
engine.dispatch({ type: "setSeriesType", seriesType: "area" });
engine.dispatch({ type: "setViewport", viewport });
engine.dispatch({ type: "setPriceScaleMode", mode: "percentage" });
engine.dispatch({ type: "zoomIn" });
engine.dispatch({ type: "zoomOut" });
engine.dispatch({ type: "resetZoom" });
engine.dispatch({ type: "pan", deltaX: 24 });
engine.dispatch({ type: "toggleGrid" });
engine.dispatch({ type: "setThemeMode", themeMode: "dark" });
```

The exact chart command set covers:

- series type
- viewport and price scale mode
- zoom, reset zoom, and pan
- grid visibility and theme mode

Timeframe selection belongs to the workspace data controller. Read the active timeframe from `engine.getState().series.timeframe`; `engine.setSeries(series)` is the only way engine data changes timeframe.

The canonical timeframe values are exactly `1m`, `5m`, `15m`, `30m`, `60m`, `1d`, `1w`, and `1mo`. The Playground control creates a new `CandleSeries` and calls `setSeries()`; it does not maintain a separate timeframe flag. Its scale control dispatches `setPriceScaleMode` with exactly `linear`, `log`, or `percentage`, then rebuilds the shared main price scale used by rendering, interaction, magnet targets, and drawing coordinates.

Drawing tool selection, selected-drawing actions, undo, and redo belong to `DrawingEditor`:

```ts
drawingEditor.executeCommand({ type: "setTool", tool: "trendLine" });
drawingEditor.undo();
```

The Playground maps a horizontal Arrow nudge to the current candle width so the screen move
survives conversion back to candle-time domain coordinates; vertical Arrow nudges remain pixel
steps. The neutral `nudgeSelected` command itself continues to accept host-chosen screen deltas.

Use `ChartEngine.dispatch(command)` for chart commands. The facade stores neutral command results in fields such as `seriesType`, `viewport`, `settings.gridVisible`, `settings.themeMode`, and `lastCommandType`.

Price-scale inversion remains a direct facade action rather than a `ChartEngineCommand`:

```ts
engine.invertPriceScale();
```

Commands are not host actions. They do not navigate routes, call APIs, mutate host stores, or persist product workflows.
