# Actions And Commands

Command input uses `ChartEngineCommand`:

```ts
engine.dispatch({ type: "setSeriesType", seriesType: "area" });
engine.dispatch({ type: "toggleGrid" });
engine.dispatch({ type: "invertPriceScale" });
engine.dispatch({ type: "setThemeMode", themeMode: "dark" });
```

The command dispatcher covers:

- chart type, timeframe, viewport, zoom, pan, grid, price scale, and theme actions
- drawing tool, delete selected drawing, lock selected drawing, hide selected drawing
- undo and redo actions

For standalone command state, use `createChartCommandDispatcher(initialState)`.

For engine-level state, use `ChartEngine.dispatch(command)`. The facade stores neutral command results such as `settings.gridVisible`, `settings.themeMode`, `invertedPriceScale`, `drawingTool`, and `lastCommandType`.

Commands are not host actions. They do not navigate routes, call APIs, mutate host stores, or persist product workflows.
