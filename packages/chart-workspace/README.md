# @simoncharts/charts

Private, `UNLICENSED` embeddable Advanced Charts SDK for approved SimonCharts partners.

The host owns authentication, routes, market-data rights, symbols, immutable snapshots, and business workflows. The SDK owns chart rendering, request coordination, validation, bounded history paging, optional technical tools, and browser preferences. It never fabricates candles or silently changes a requested data combination.

## Install

```bash
npm install ./simoncharts-charts-1.0.0-rc.43.tgz
```

## Embed the default chart

The default creates only timeframe, adjustment, and indicator controls. Symbol search, raw series selection, price-scale controls, drawing tools/history, settings, and the right inspector are not created. If the exact host capability matrix includes `1m`, the timeframe strip begins with an intraday close-line preset followed by the ordinary 1-minute candle control. Intraday exposes a 1–9 day selector, reuses the same real `1m` revision, does not imply live streaming, and does not persist a minimal chart's temporary line style.

```ts
import { createChart, type ChartDatafeed } from "@simoncharts/charts";
import "@simoncharts/charts/styles.css";

const datafeed: ChartDatafeed = {
  getCapabilities: (symbol, signal) => getCapabilitiesFromHost(symbol, signal),
  searchSymbols: (query, signal) => searchSymbolsFromHost(query, signal),
  loadSeries: (request, signal) => loadSeriesFromHost(request, signal)
};

const chart = createChart(container, {
  chartId: "review-detail",
  persistenceScopeId: authenticatedUserId,
  dataContextId: marketSnapshotRevision,
  initialSymbol,
  initialTimeframe: "1d",
  initialAdjustMode: "forward",
  dataCutoffTime: reviewCutoffEpochMilliseconds,
  datafeed,
  theme: "light",
  locale: "zh-CN",
  onError(error) {
    showSafeChartMessage(error);
  }
});

const unsubscribe = chart.subscribe((state) => updateHostState(state));
function destroyChart() {
  unsubscribe();
  chart.destroy();
}
```

## Format symbol prices and search accessibly

`ChartSymbol.pricePrecision` is optional. When present, it must be an integer from `0` through `8` and pads raw price displays to that many decimals. It applies to the main price axes, current and crosshair price labels, OHLC/change displays, the data window, and execution prices. Percentage values remain at two decimals, while volume, turnover, quantity, amount, fees, Study panes, and raw Candle/event values are unchanged. Omitting the field preserves the rc.38 formatter.

```ts
const symbol = {
  id: "stock:SSE:600000",
  code: "600000",
  name: "浦发银行",
  exchange: "SSE",
  kind: "stock",
  pricePrecision: 4
} as const;
```

The field follows the host-owned symbol through `ChartState` and `SeriesRequest`; it is not stored in `ChartLayoutV3` or browser layout preferences. Calling `setSymbol()` with corrected metadata for the same `id` reloads that selection. The SDK validates and defensively clones initial, programmatic, and search-result symbols without changing their raw market values.

Advanced symbol search uses the existing host `searchSymbols(query, signal)` method and a native ARIA combobox. Focus remains on the input while Arrow keys, Home/End, and Enter navigate or select; Escape closes without changing the selection, and Tab leaves normally. Search waits for IME composition to finish, does not call the host for a blank query, aborts stale requests, and announces loading, result count, empty, and error states. Results and failures are rendered as text only.

## Override the chart theme

`theme` selects the built-in `dark` or `light` base. `themeOverrides` replaces selected public color tokens without changing data, layout, readiness, or browser persistence. Runtime calls use whole-object replacement; pass `{}` to return to the active base theme.

```ts
const chart = createChart(container, {
  // ...required host-owned options
  theme: "dark",
  themeOverrides: {
    backgroundColor: "#111827",
    surfaceColor: "#1f2937",
    gridColor: "rgba(148, 163, 184, 0.16)",
    textColor: "#f8fafc",
    mutedTextColor: "#94a3b8",
    accentColor: "#6366f1",
    upColor: "#ef4444",
    downColor: "#10b981",
    intradayAverageColor: "#eab308"
  }
});

chart.setTheme("light"); // keeps the current overrides
chart.setThemeOverrides({ upColor: "#f04455", downColor: "#00aa91" });
chart.getTheme();
chart.getThemeOverrides(); // defensive snapshot
chart.setThemeOverrides({}); // reset to the active base theme
```

The public override keys are `backgroundColor`, `surfaceColor`, `surfaceHoverColor`, `borderColor`, `gridColor`, `textColor`, `mutedTextColor`, `accentColor`, `upColor`, `downColor`, and `intradayAverageColor`. Values must be bounded concrete CSS colors; indirect `var(...)`, `currentColor`, CSS-wide keywords, accessors, unknown fields, and invalid colors are rejected before any token changes.

## Control the view and visible range

The host can switch between the intraday close line and the ordinary timeframe view without changing the underlying `1m` revision. Visible-range values are Unix epoch milliseconds. A range request may load older cursor pages before it becomes visible; `getVisibleRange()` returns `undefined` while a new selection has no accepted materialized data. Intraday always fits its complete 1–9 day window, so wheel, drag, axis scaling, keyboard viewport commands, and `setVisibleRange()` do not zoom or pan that view.

```ts
chart.setVisibleRange({ from: rangeStartEpochMs, to: rangeEndEpochMs });
chart.setView("intraday");
chart.setIntradayDays(5);

const unsubscribeEvents = chart.subscribeEvents((event) => {
  if (event.type === "data-loaded") {
    recordAcceptedRevision(event.dataVersion, event.phase); // initial | history
  } else if (event.type === "visible-range") {
    syncHostRange(event.range);
  }
});

chart.resetToLatest();
const visibleRange = chart.getVisibleRange();
// On host teardown: unsubscribeEvents();
```

For imperative host workflows, `dataReady()` waits for the exact current symbol, timeframe, adjustment mode, view, and intraday-day selection to finish materializing and commit its first scheduled paint. It resolves `true` once that presentation is usable, or `false` if the selection is replaced, cannot be materialized, becomes blocked, or the chart is destroyed. Calling `retry()` before `dataReady()` binds the new Promise to that retry instead of the failed attempt.

```ts
if (await chart.dataReady()) {
  chart.setVisibleRange({ from: rangeStartEpochMs, to: rangeEndEpochMs });
}
```

## Compare symbols

Symbol Compare is host-owned and available through the initial `comparisons` option plus `setComparisons()` and `getComparisons()`. Advanced mode includes its search UI through the `symbol-compare` feature. A batch contains at most four distinct symbols, cannot repeat the main symbol, and is validated atomically.

```ts
import {
  advancedChartFeatures,
  createChart,
  type ChartComparison
} from "@simoncharts/charts";

const comparisons: readonly ChartComparison[] = [{
  symbol: {
    id: "index:SSE:000001",
    code: "000001",
    name: "上证指数",
    exchange: "SSE",
    kind: "index"
  },
  color: "#2962ff",
  visible: true
}];

const chart = createChart(container, {
  // ...required host-owned options
  features: advancedChartFeatures,
  comparisons
});

chart.setComparisons([
  ...chart.getComparisons(),
  {
    symbol: {
      id: "index:SZSE:399001",
      code: "399001",
      name: "深证成指",
      exchange: "SZSE",
      kind: "index"
    },
    color: "#f59e0b"
  }
]);
chart.setComparisons([]); // restores the price-scale mode used before comparison
```

The main series owns the time axis. Comparison values are projected only at exact main-series timestamps; the SDK does not interpolate, forward-fill, backfill, add calendar rows, or construct market data. For an ordinary period, each comparison is normalized independently from its first visible finite positive real value. Intraday instead uses that comparison symbol's trusted positive `intradayScale.previousClose`; an unavailable baseline produces no fabricated line.

While the comparison list is non-empty, the main price scale uses percentage display. Removing the final comparison restores the price-scale mode active before comparison began. Comparison symbols and candles are not serialized into `ChartLayoutV3`, `exportLayout()` / `importLayout()`, or automatic browser persistence snapshots; the host must provide them again. `getComparisons()` and crosshair events return defensive current snapshots.

`dataReady()` waits for the current main presentation, comparison context, and requested visible comparison range. It resolves `false` if a visible comparison is empty, unsupported, fails to load, is superseded, or the chart is destroyed; hidden comparisons do not block readiness. Use the existing `retry()` path after repairing a recoverable host datafeed failure.

## Subscribe to crosshair data

`subscribeCrosshair()` publishes the latest real crosshair position once per animation frame without making unrelated lifecycle subscribers pay the per-pointer payload cost. `crosshair-moved` includes the exact host candle, accepted selection and data revision, raw price and change values, canvas-local CSS pixel offsets, and every output of each visible study. Missing warm-up or reference values stay `null`; leaving or clearing the chart emits one `crosshair-left`.

```ts
const stopCrosshair = chart.subscribeCrosshair((event) => {
  if (event.type === "crosshair-moved") {
    syncExternalPanel({
      time: event.crosshair.time,
      price: event.crosshair.price,
      candle: event.crosshair.candle,
      studies: event.crosshair.studies
    });
  } else if (event.type === "crosshair-left") {
    clearExternalPanel();
  }
});

// On host teardown: stopCrosshair();
```

`time` uses the same Unix epoch milliseconds as `Candle.time`; `symbolId`, `timeframe`, `adjustMode`, and `dataVersion` identify the accepted host revision. `referencePrice`, `change`, and `changePercent` are `null` when no real prior reference exists. Same-candle vertical movement still publishes updated `price` and `offsetY`; a pointer burst is coalesced to its latest position for that frame. Events are defensive snapshots, so one listener cannot mutate another listener's payload. Hidden studies, synthetic candles, formatted display strings, and latest-candle fallbacks are not added.

## Program the chart and persist its layout

The public handle controls series type, panes, pane price scales, indicators, drawings, drawing tools/history, grid visibility, and host-owned marks without clicking the built-in UI. `exportLayout()` returns a JSON-safe `ChartLayoutV3`; `importLayout()` accepts both V3 and legacy `ChartLayoutV2` and validates the complete payload before changing chart state. V3 adds pane order, height ratios, collapsed state, inversion, and automatic or explicit visible price ranges. Wait for the current selection's initial `data-loaded` event before importing, exporting, replacing drawings, or using Pane APIs. Symbol, timeframe, adjustment, candle visible range, marks, executions, market data, and host business state deliberately remain outside the layout and keep their existing dedicated APIs.

```ts
import type { ChartLayout, ChartMark } from "@simoncharts/charts";

const layoutStorageKey = `${dataContextId}:${initialSymbol.id}:${initialAdjustMode}`;
const savedLayout: ChartLayout = JSON.parse(await loadHostLayout(layoutStorageKey));
const marks: readonly ChartMark[] = [
  { id: "earnings", time: earningsCandleTime, price: earningsPrice, label: "E", color: "#a855f7" }
];

const unsubscribeEvents = chart.subscribeEvents((event) => {
  if (event.type === "data-loaded" && event.phase === "initial") {
    chart.importLayout(savedLayout);
    chart.setSeriesProperties({ type: "renko", brickSize: 2 });
    chart.setSeriesType("renko");
    chart.setPriceScaleMode("percentage");
    chart.setIndicators([{
      instanceId: "review-ma-5",
      id: "MA",
      params: { period: 5 },
      visible: true
    }]);
    chart.setDrawings([{
      id: "planned-entry-range",
      type: "datePriceRange",
      anchors: [
        { time: planStartCandleTime, price: planLowPrice },
        { time: planEndCandleTime, price: planHighPrice }
      ],
      interactive: false,
      affectsPriceScale: true,
      locked: true
    }]);
    chart.setMarks(marks);
    chart.setDrawingTool("trendLine");
    chart.undoDrawing();
    void chart.exportLayout();
  } else if (event.type === "layout-changed") {
    void saveHostLayout(layoutStorageKey, JSON.stringify(event.layout));
  } else if (event.type === "mark-clicked") {
    openHostEvent(event.mark.id);
  }
});

// On host teardown: unsubscribeEvents();
```

Separate Study panes use the stable ID `study:${instanceId}`; the fixed main pane ID is `main`. Pane handles stay live until their pane is removed. The main pane must remain first and cannot collapse; Study panes may be reordered after it, resized, or collapsed. Height ratios must satisfy `0 < ratio <= 100`. Calling `setVisibleRange()` switches that pane to manual scale, while `setAutoScale(false)` freezes the currently computed range and `setAutoScale(true)` returns it to data-driven scaling. Manual ranges must contain finite, strictly ascending endpoints with a finite span; the main pane additionally requires a positive lower endpoint in log mode. Study panes are linear; the main pane also supports the existing linear, log, and percentage modes.

```ts
const macdPane = chart.getPaneApi("study:review-macd");
macdPane?.setHeightRatio(1.5);
macdPane?.moveTo(1);
macdPane?.setCollapsed(false);
macdPane?.getPriceScale().setVisibleRange({ from: -5, to: 5 });
macdPane?.getPriceScale().setInverted(true);
macdPane?.getPriceScale().setAutoScale(true);
```

Ordinary timeframe views also support native right-axis drag for manual scaling and double-click to restore automatic scaling. Changing symbol, timeframe, adjustment, or intraday presentation restores automatic scale while preserving pane order, ratios, collapse, and inversion. Intraday rejects Pane Price Scale mutations and V3 pane state that would alter its fixed presentation; the legacy `chart.setPriceScaleMode()` may still preselect the mode used after returning to an ordinary timeframe.

`interactive` defaults to `true`. Setting it to `false` keeps the Drawing visible and available to `setDrawings()`, `getDrawings()`, Entity API, and layout export/import, but removes it from hover, hit testing, handles, selection, pointer capture, drag, and keyboard edits. It therefore cannot change the crosshair cursor or block chart pan, zoom, crosshair, execution-mark, or host-mark interaction. `locked` is separate: a locked Drawing remains interactive unless `interactive: false` is also set.

`affectsPriceScale` defaults to `false`. For `datePriceRange` and `priceRange`, setting it to `true` extends the automatic main price scale only while the Drawing is visible, both price anchors are finite and valid for the active scale, and its time interval intersects the visible real candle interval. Hidden, off-window, invalid, and default Drawings do not affect the axis. Manual price-axis scaling remains host/user controlled.

Because drawings are inside the portable layout, host storage must scope each saved layout by `dataContextId + symbol.id + adjustMode`; recompute that key after changing symbol or adjustment and ignore stale async loads. Intraday is always a line view, so importing a non-line layout or selecting a non-line series while intraday is active is rejected instead of partially applying.

Marks attach only to an exact real candle timestamp and are replaced, not merged, by `setMarks()`. Changing the symbol clears them. A mark renders as a host-colored point and emits `mark-clicked`; marks are data annotations and are not persisted in the layout. One layout accepts at most 1,000 drawings, 10,000 anchors per drawing, 50,000 anchors and 50,000 JSON metadata nodes in total; `setMarks()` accepts at most 50,000 marks.

## Manage individual chart entities

Use the Entity API when one object changes; keep the collection setters for intentional batch replacement and layout restore. Entity IDs are opaque—store and pass them back unchanged.

```ts
const ma5Id = chart.createStudy({
  id: "MA",
  params: { period: 5 },
  visible: true
});
const ma20Id = chart.createStudy({
  id: "MA",
  params: { period: 20 },
  visible: true
});

chart.getStudyById(ma20Id);
chart.getAllStudies();
chart.removeStudy(ma5Id);

const ma20 = chart.getStudyApi(ma20Id);
ma20?.setInputs({ period: 30 }); // Partial, validated input update.
ma20?.setVisible(false);
ma20?.getInputs();
ma20?.isVisible();

if (await chart.dataReady()) {
  const entityId = chart.createEntity({
    kind: "drawing",
    value: {
      id: "review-support",
      type: "horizontalLine",
      anchors: [{ time: supportCandleTime, price: supportPrice }]
    }
  });

  const entity = chart.getEntity(entityId);
  if (entity?.kind === "drawing") {
    chart.updateEntity({
      ...entity,
      value: { ...entity.value, locked: true }
    });
  }

  const drawings = chart.getEntities("drawing");
  chart.removeEntity(entityId);
}
```

`createStudy()` returns an opaque indicator entity ID and generates a non-reused UUID instance ID when the caller does not provide one. The generic Entity API accepts indicators too, but their `instanceId` is required because the host owns that immutable identity and must not reuse it for a different study. Missing indicator inputs are normalized to the built-in defaults before validation and persistence. Same-definition studies calculate, cache, render, hide, edit, remove, persist, and restore independently; a layout accepts at most 32 studies. rc.29 stores these V2 instances in a separate browser namespace and leaves older indicator records untouched instead of guessing an identity or deleting legacy data.

`getStudyApi()` returns a live handle over the existing study entity. It reads current state on every call, returns defensive input snapshots, and routes partial input changes through the same public validator as `createStudy()`. A handle whose study no longer exists throws `NotFoundError` for reads or updates; after chart destruction, reads and updates throw `InvalidStateError` and `remove()` returns `false`.

`entity-created`, `entity-updated`, and `entity-removed` events carry the final defensive entity snapshot. Drawing IDs are isolated by chart, persistence scope, data context, symbol, and adjustment; mark IDs additionally follow the current symbol; indicator IDs follow the chart's persisted indicator scope. A stale or foreign ID cannot mutate the current selection.

## Select entities and subscribe to user actions

Selection reuses the existing opaque Entity IDs. A chart may select multiple interactive Drawings or exactly one Study; marks, mixed Drawing/Study batches, missing IDs, and `interactive: false` Drawings are rejected atomically. Selection is transient host/UI state: it is not exported in `ChartLayoutV3` and is not written to browser persistence.

```ts
const stopActions = chart.subscribeEvents((event) => {
  if (event.type === "selection-changed") syncInspector(event.selection);
  if (event.type === "drawing-clicked") openDrawingEditor(event.entity);
  if (event.type === "study-clicked") openStudyEditor(event.entity);
  if (event.type === "execution-clicked") openExecutionDetails(event.executions);
});

chart.setSelection([drawingEntityIdA, drawingEntityIdB]);
chart.getSelection();
chart.clearSelection();
```

Drawing and Study actions are emitted only after a primary Canvas click/tap; right clicks, secondary pointers, pans, and edit drags do not emit an action. Replacing the action's Drawing, Study output, execution source, or active market presentation before release cancels that pending action. If a synchronous selection listener removes or reselects the entity, the stale action is suppressed. Study hit testing follows the rendered line, histogram, band, or marker geometry in the active panel and resolves overlaps to the topmost rendered output rather than a DOM legend. Execution actions preserve every execution in the native grouped marker and share the pinned tooltip click/touch gesture. Drawing selection survives entity updates, retains surviving IDs after removal, and drops an entity changed to `interactive: false`. All payloads are defensive snapshots, and `locked` remains independent from Drawing interactivity.

## Define host-owned custom studies

Custom Study definitions are chart-scoped trusted host code. They reuse the existing Study, Entity, checkpoint, visual-output, pane, crosshair, layout, failure/retry, and `dataReady()` paths; the SDK does not create a global registry or a second indicator engine.

```ts
import {
  createChart,
  type ChartCustomStudyDefinition,
  type ChartCustomStudyInput
} from "@simoncharts/charts";

const studyDefinitions = [{
  id: "custom:review.range",
  version: "1",
  title: "Review Range",
  pane: "separate",
  inputs: [{
    id: "factor",
    title: "Factor",
    defaultValue: 1,
    minValue: 0.1
  }],
  outputs: [
    { id: "range", title: "Range", type: "line", color: "#7c3aed" },
    { id: "strength", title: "Strength", type: "histogram", color: "#ea580c" }
  ],
  calculate({ candles, inputs }) {
    const values = candles.map(
      (candle) => (candle.high - candle.low) * inputs.factor
    );
    return {
      outputs: {
        range: values,
        strength: values
      }
    };
  }
}] satisfies readonly ChartCustomStudyDefinition[];

const chart = createChart(container, {
  // ...the required host configuration above
  studyDefinitions
});

const customStudy: ChartCustomStudyInput = {
  instanceId: "review-range",
  id: "custom:review.range",
  definitionVersion: "1",
  params: {},
  visible: true
};
const entityId = chart.createStudy(customStudy);
chart.getStudyApi(entityId)?.setInputs({ factor: 2 });
await chart.dataReady();
```

Definition IDs must use the `custom:` namespace. A chart accepts at most 32 definitions, 16 numeric inputs and 16 fixed outputs per definition; outputs are `line`, `histogram`, `band`, or `marker`. `calculate()` is synchronous and receives only the current chronological real-candle chunk, normalized inputs, accepted selection/data revision, `processedCount`, and the prior JSON-safe checkpoint state. Every declared output must return one dense finite-or-`null` value per input candle; a band returns matching `upper` and `lower` arrays. The SDK assigns candle times and rejects missing, extra, sparse, non-finite, accessor-backed, or oversized data before publishing a visual or checkpoint.

Instances must name the exact registered `definitionVersion`; missing or mismatched versions are rejected atomically by creation, batch replacement, Entity update, and layout import. Use `ChartCustomStudyInput` for the statically exact custom contract. The legacy extendable `ChartIndicator` and `ChartIndicatorInput` interfaces remain source-compatible, while the same ID/version rules are enforced at runtime.

Definitions and callback functions never enter the portable layout, JSON export, or browser storage. Layouts contain only the custom instance's `id`, exact `definitionVersion`, `instanceId`, normalized numeric `params`, and `visible` state. Custom instances are also excluded from automatic browser indicator preferences: the host must retain its definitions and explicitly save/import the layout. The built-in UI displays the custom title and supports visibility/removal, but rc.34 intentionally provides no code editor, marketplace, arbitrary DOM/Canvas renderer, async callback, or custom input form.

Thrown calculations fail closed through the existing `CALCULATION_FAILED` state and `retry()` path. Superseded or cancelled generations cannot publish visuals or checkpoints, and `dataReady()` remains pending until all concurrent study and stateful-series calculations have settled and the resulting presentation has painted.

## Show host-owned execution marks

Execution marks are opt-in, read-only host data. Add the `executions` feature, then supply or replace the current symbol's real executions. The SDK never creates trades, infers T classifications, or writes an execution back to the host.

```ts
import { advancedChartFeatures, type ChartExecution } from "@simoncharts/charts";

const executions: readonly ChartExecution[] = [{
  id: brokerExecutionId,
  time: lastExecutionEpochMilliseconds,
  firstTime: firstExecutionEpochMilliseconds,
  lastTime: lastExecutionEpochMilliseconds,
  side: "buy",
  price: executionPrice,
  quantity: executionQuantity,
  label: "T买",
  amount: executionAmount,
  fee: executionFees,
  tQuantity: matchedTQuantity
}];

const chart = createChart(container, {
  // ...the required host configuration above
  features: [...advancedChartFeatures, "executions"],
  executions
});

chart.setExecutions(nextSymbolExecutions);
chart.setExecutionsVisible(false);
```

`firstTime` and `lastTime` are optional, but must be supplied together in the same epoch-millisecond basis as `time`, with `firstTime <= time <= lastTime`. They describe the trusted first and last trade represented by one aggregated execution and never move its marker away from `time`. Omitted fields retain the legacy single-time detail; equal endpoints display once; distinct endpoints display one compact localized range.

Buys use the host theme's rising color and an upward arrow below price; sells use the falling color and a downward arrow above price. Minute views map by the real execution time and place a grouped marker at its latest real execution price. Daily, weekly, and monthly views attach to the containing real candle while details retain the unadjusted execution price. Same-candle executions of the same side and label are grouped without dropping their individual details or recomputing their time ranges; different labels on the same side are stacked. Changing the symbol clears the previous symbol's executions immediately, so the host must provide the new symbol's rows. Hover shows details on desktop, click or touch pins the same rows, and clicking chart blank space closes them.

Older pages are requested as the viewport demands them. Accepted history is prepended without moving the candle that was under the user's cursor, while the in-memory materialization remains bounded. `data-loaded` is emitted only after an accepted initial or history page has been materialized for the current symbol, timeframe, adjustment, cutoff, and `dataVersion`.

### Intraday scale and day-count contract

`getCapabilities()` may add cutoff-specific intraday scale metadata beside the exact series matrix:

```ts
{
  series: [{ timeframe: "1m", adjustModes: ["none"] }],
  intradayScale: {
    previousClose: officialPreviousCloseAtCutoff,
    priceLimitPercent: applicableDailyLimitPercent // omit when no fixed limit applies
  }
}
```

- `previousClose` is the official finite positive previous close for the symbol at the chart cutoff. `priceLimitPercent`, when present, is finite and within `(0, 100]`. The host owns board, risk-warning, listing-day, and rule-date decisions; the SDK does not guess them.
- A one-day intraday view uses `previousClose` as `0%`. With `priceLimitPercent`, the right axis defaults symmetrically to `-limit% … 0% … +limit%`. If a real high or low exceeds that nominal range because of price-tick rounding, both sides expand to the next 0.1 percentage point after a 0.1-point drawing margin; without the limit, the percentage axis auto-scales to the real data.
- `setIntradayDays(days)` accepts an integer from 1 through 9 and updates `ChartState.intradayDays`. The visible selector calls the same API.
- A 2–9 day view selects the latest requested number of real Shanghai trading-day keys in the accepted cursor chain. Its `0%` baseline is the final real `1m` close immediately before the earliest selected day, and its vertical scale is automatic so cumulative movement is not clipped by a one-day limit.
- Every selected trading day receives an equal-width horizontal slot. Real `09:30–11:30` and `13:00–15:00` minute bars occupy distinct slot centers, day separators stay at slot boundaries, and no lunch-break or calendar candles are inserted.
- The intraday price path uses one red/green direction color for the complete window and remains visually continuous at real day boundaries. The yellow intraday average is recalculated independently for each trading day as cumulative `turnover / volume`; it is undefined until that day's cumulative volume becomes positive.
- The SDK loads enough cursor history to identify the selected days and their preceding reference day, then fits all selected candles into the initial viewport. If the host has fewer real days, it displays only those days; it never creates calendar placeholders or synthetic candles.

## Opt into the advanced workbench

```ts
import { advancedChartFeatures, createChart } from "@simoncharts/charts";

const chart = createChart(container, {
  chartId: "advanced-chart",
  persistenceScopeId: authenticatedUserId,
  dataContextId: marketSnapshotRevision,
  initialSymbol,
  datafeed,
  features: advancedChartFeatures,
  theme: "dark",
  locale: "zh-CN"
});
```

`getSeriesProperties(type)` returns a defensive, normalized full object. `setSeriesProperties(properties)` replaces one configurable type without switching the current series. Defaults are Renko `brickSize: 1`, Line Break `lineCount: 3`, Kagi `reversalAmount: 2`, and Point & Figure `boxSize: 1, reversalBoxes: 3`. Amounts must be positive finite numbers; `lineCount` is an integer from 1 to 500 and `reversalBoxes` from 1 to 10,000. Non-default values are stored sparsely in the portable layout and browser preferences; explicit `ChartOptions.seriesProperties` wins for matching types. Importing a legacy layout without the field restores defaults. Intraday stays a fixed line, though properties may be prepared for the next timeframe view.

`ChartFeature` is a stable union of `symbol-search`, `timeframes`, `adjustment`, `series-type`, `price-scale`, `indicators`, `drawing-tools`, `drawing-history`, `settings`, `bottom-panel`, `symbol-compare`, `executions`, and `replay`. Passing a feature controls construction: disabled controls are not mounted and do not bind listeners. `advancedChartFeatures` explicitly enables the complete 17-series, 16-indicator, 63-drawing, three-scale workbench, Symbol Compare, and Historical Replay; host executions remain opt-in.

The advanced shell is chart-first: a 40 px market toolbar, fixed 44 px drawing rail, uninterrupted chart and native axes, collapsed 40 px object/property/data inspector, and 26 px status bar. The crosshair updates OHLC, volume, indicator rows, and price/time axis badges directly. Wheel/keyboard zoom, captured drag pan, price-axis and time-axis drag, double-click reset, drawing body/handle editing, chart/axis context menus, and native fullscreen are included. The inspector expands only on demand and reuses the existing versioned layout namespace.

Charts intentionally does not create watchlists, news, broker/order/account panels, or multi-chart trading layouts. Those are host or Trading Platform responsibilities, not inert SDK controls.

## Data contract

- Capabilities are declared per timeframe as `{ timeframe, adjustModes }`; unsupported combinations are not rendered or requested.
- `Candle.time` and `dataCutoffTime` use Unix epoch milliseconds.
- The cutoff is included in every initial and history request; a page containing any future candle is rejected atomically.
- Pages are strictly ascending, atomically validated, and tied to one `dataVersion` across the cursor chain.
- Cursor paging can span trading days; intraday resolves the latest 1–9 available real Shanghai trading days plus the preceding reference close when available, while ordinary minute timeframes remain continuous across days.
- The SDK does not aggregate, adjust, repair, or fill candles.
- `AbortSignal` cancellation is normal control flow and is not surfaced as an error.

Host adapters may throw `ChartDatafeedError` with a safe code (`NOT_CONFIGURED`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `NO_DATA`, or `UNAVAILABLE`), a user-facing message, and a recoverable flag. `onError` receives a normalized `ChartError`; known datafeed codes are available at `error.context?.datafeedCode`. Indicator and stateful-series calculation failures use `CALCULATION_FAILED` with scope `calculation` and `error.context?.calculationKind`; Canvas paint failures remain `RENDER_FAILED` with scope `render`. Both are recoverable through `retry()`, and readiness returns only after the failed calculation or paint is actually replaced. TypeScript hosts with exhaustive `ChartErrorCode` or `ChartErrorScope` switches must add the new calculation cases when upgrading from rc.31. Unknown upstream details are never exposed.

## Replay accepted history

Historical Replay is transient and uses only accepted host Candle timestamps. `startReplay(time)` requires an exact available Candle time before the latest Candle. `stepReplay()` advances to the next real Candle, so weekends, suspensions, and missing host rows are never synthesized. `playReplay()` uses the selected fixed speed and pauses at the final Candle or on a blocking render/calculation failure.

```ts
chart.startReplay(replayStartEpochMs);
chart.setReplaySpeed(4); // 1 | 2 | 4 | 8
chart.stepReplay();
chart.playReplay();
chart.pauseReplay();

const state = chart.getReplayState(); // inactive | paused | playing
const unsubscribeReplay = chart.subscribeEvents((event) => {
  if (event.type === "replay-changed") updateReplayUi(event.replay);
});

chart.stopReplay();
unsubscribeReplay();
```

Each commit gives the existing chart runtime only Candles through the cursor. Studies, stateful series, comparisons, marks, executions, volume, crosshair values, and automatic price scaling therefore share the same causal cutoff. Programmatic visible-range, symbol, timeframe, view, intraday-day, and adjustment changes exit replay before applying the new selection. Replay state is intentionally absent from `ChartLayoutV3`, export/import, and browser persistence.

## Persistence and lifecycle

Layout, preferences, and indicators are isolated by `chartId + persistenceScopeId`. Drawings additionally include the required `dataContextId`, `symbol.id`, and adjustment mode. Candle history, credentials, and provider details are never stored. `destroy()` is idempotent, aborts pending work, clears subscriptions, and removes mounted DOM resources.

## RC validation

```bash
npm run check:workspace-release-gate
```

The gate covers unit/type tests, runtime and declaration snapshots, package allowlisting, packed JavaScript/TypeScript consumers, and the complete advanced playground in Chrome and Edge. `npm run pack:workspace` is reserved for final orchestration and writes an immutable tarball plus SHA-256/SHA-512 sidecars.

The previous rc.9 candidate passed `67 files / 1,050` repository tests, `12 files / 96` Charts tests, combined Chrome `91/91`, and the workspace Chrome/Edge matrix at `40/40` per browser. Its immutable SHA-256 is `ddc20fed0b8ea7f8813644ca188d595461bf49564fa113f32a4b31a9e29bf3d5`; TradingReviewSystem separately accepted the advanced and embedded product paths against the identical vendored bytes.

rc.10 introduced the intraday scale and 2–9 day contracts above. Accepted rc.11 additionally preserves the reference-day baseline through bounded-cache reloads and fits a full nine-day A-share window at 390 px. Its immutable 32-file artifact passed `67 files / 1,058` repository tests, `12 files / 104` Charts tests, combined Chrome `92/92`, and Charts Chrome/Edge `41/41` per browser before byte-identical TradingReviewSystem acceptance. SHA-256 is `9b1243b1841448f34a49b100ad2ec8e4276a1a7002b07a69bc4bb9dee5986062`; SHA-512 is `3bf3fd836e7365c2a1f3434cb0f9fe9edca6b618fe01783be6540e1774decdf089673e5ff26a9cf23ec61f69a903e5fcfb56327b0df71e68ea2fe9904858d431`.

Accepted rc.12 keeps ordinary K-line zoom/pan with the latest candle right-anchored, while one-to-nine-day intraday views always fit the complete real-data window and reject viewport zoom or pan. It also adds left-price/right-percentage axes, separate price and volume regions, direction-colored intraday lines, a chart-header day selector and OHLC summary, and Advanced Charts-style period and 17-type chart menus. Its immutable 32-file artifact passed `67 files / 1,068` repository tests, `12 files / 106` Charts tests, combined Chrome `92/92`, and Charts Chrome/Edge `41/41` per browser before byte-identical TradingReviewSystem acceptance. SHA-256 is `683050ed196ab30a757cfa863f823826872d373bf8f690125c1c4001d31e83e5`; SHA-512 is `fed1ffa05049cfacc04f2d9d0863399b68095fe662ad4ea1db05a70967f5caee4b2fb2530a65b5ef98da941e02ed41a0148a4a628250deb935ad86f716ec82fd`.

Accepted rc.15 finalized the preceding time-axis scope. It keeps the rc.12 public behavior and completely clears any static date label intersecting the crosshair time badge, eliminating partial neighboring date fragments after K-line zoom. Its immutable 32-file artifact passed `67 files / 1,069` repository tests, `12 files / 106` Charts tests, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, five runtime exports, and four public declaration files before byte-identical TradingReviewSystem acceptance. SHA-256 is `08f6c652dab93c3aeb8ab832049218e78e387b1d7f6c7bc1d1797ff7a4a3bb87`; SHA-512 is `28a538f9556f5522bac437aba4b0384ff7e5e72bb52123f74c1fae0b01f3e776d6c973ba75fc33079c7e066538848abba50c3946cae258f5c81989ccfb7959b8`.

Accepted rc.16 supersedes rc.15 only to constrain the center position of intraday dual-axis boundary labels, keeping the top and bottom price/percentage extremes fully visible. Its immutable 32-file artifact passed the unchanged `67 files / 1,069` repository tests, `12 files / 106` Charts tests, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, five runtime exports, and four public declaration files before byte-identical TradingReviewSystem acceptance. SHA-256 is `5e9f805c10eafa1fca09dfcee9850985aad1df6e116eea50a11963951a055baa`; SHA-512 is `92750a05e7cdc2f03f0a646200e17dd612c77fed0e5501b6f9c5c8f53fd1eb88d1b130a86433c7d44efab9fde09ee62f97eb04f6e8959e9bcaf26fc09e0b0cee`.

Accepted rc.17 reserves a 34 px plot inset below the chart header so boundary-axis labels stay complete without overlapping OHLC. A latest viewport also remains exactly right-anchored during zoom (`to = lastIndex`, `scrollOffset = 0`); anchor-based zoom begins only after the user pans into history. Its immutable 32-file artifact passed `67 files / 1,070` repository tests, `12 files / 106` Charts tests, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, five runtime exports, and four public declaration files before byte-identical TradingReviewSystem acceptance. SHA-256 is `8f6a1be2e255d845da1a7d809c4a994a359c14a1798d52a92c117d7f076dba71`; SHA-512 is `dc3a3c526b2b10688f64984562e5f7612f4e1440ca4240d5581080c60b36c11260aa8972e98d8a197de57ba0b0f750a4bd33e356acba5779d35c6354610d6c88`.

Accepted rc.22 adds the production multi-day intraday presentation contract: equal-width real trading-day slots, distinct `09:30–11:30` and `13:00–15:00` minute centers, real day separators, one direction-colored continuous price path, a symmetric percentage scale based on the real close before the first visible day, and a yellow per-day cumulative `turnover / volume` line. Runtime market fixtures remain excluded. Its package gate passed `68 files / 1,087` repository tests, `13 files / 114` Charts tests, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, 162 Engine runtime exports / 415 type symbols, five Charts runtime exports / four declaration files, and a 33-file artifact allowlist.

Accepted rc.23 keeps the official pre-window close as the preferred intraday direction reference. When shorter real history does not contain that close, the line color alone falls back to comparing the last close with the first real candle's open; the price axis remains raw and no candle or percentage baseline is fabricated.

Current rc.43 adds Historical Replay over accepted host candles. Replay exposes an exact candle cursor, paused/playing state, and fixed `1×`, `2×`, `4×`, or `8×` speed; it advances by real candle timestamps and never constructs calendar rows. Each replay commit sends the existing runtime only candles at or before the cursor, so studies, stateful series, comparisons, marks, executions, the data window, volume, and price scale share one causal presentation. An execution time range is withheld until its `lastTime` maps to a revealed candle. Explicit range or selection changes stop replay, blocking render/calculation failures pause it, and replay state is not exported or persisted. rc.43 preserves rc.42 and every earlier RC contract.
