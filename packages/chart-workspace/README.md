# @simoncharts/charts

Private, `UNLICENSED` embeddable Advanced Charts SDK for approved SimonCharts partners.

The host owns authentication, routes, market-data rights, symbols, immutable snapshots, and business workflows. The SDK owns chart rendering, request coordination, validation, bounded history paging, optional technical tools, and browser preferences. It never fabricates candles or silently changes a requested data combination.

## Install

```bash
npm install ./simoncharts-charts-1.0.0-rc.30.tgz
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
unsubscribe();
chart.destroy();
```

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

The public handle controls series type, price scale, indicators, drawings, drawing tools/history, grid visibility, and host-owned marks without clicking the built-in UI. `exportLayout()` and `importLayout()` use a JSON-safe, versioned `ChartLayoutV2`; import validates the complete payload before changing chart state. V2 gives every indicator a stable `instanceId`, so multiple copies of the same definition remain independent. Wait for the current selection's initial `data-loaded` event before importing, exporting, or replacing drawings. Symbol, timeframe, adjustment, visible range, marks, executions, market data, and host business state deliberately remain outside the layout and keep their existing dedicated APIs.

```ts
import type { ChartLayoutV2, ChartMark } from "@simoncharts/charts";

const layoutStorageKey = `${dataContextId}:${initialSymbol.id}:${initialAdjustMode}`;
const savedLayout: ChartLayoutV2 = JSON.parse(await loadHostLayout(layoutStorageKey));
const marks: readonly ChartMark[] = [
  { id: "earnings", time: earningsCandleTime, price: earningsPrice, label: "E", color: "#a855f7" }
];

const unsubscribeEvents = chart.subscribeEvents((event) => {
  if (event.type === "data-loaded" && event.phase === "initial") {
    chart.importLayout(savedLayout);
    chart.setSeriesType("candles");
    chart.setPriceScaleMode("percentage");
    chart.setIndicators([{
      instanceId: "review-ma-5",
      id: "MA",
      params: { period: 5 },
      visible: true
    }]);
    chart.setDrawings([{
      id: "support",
      type: "horizontalLine",
      anchors: [{ time: supportCandleTime, price: supportPrice }]
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
```

`createStudy()` returns an opaque indicator entity ID and generates a non-reused UUID instance ID when the caller does not provide one. The generic Entity API accepts indicators too, but their `instanceId` is required because the host owns that immutable identity and must not reuse it for a different study. Missing indicator inputs are normalized to the built-in defaults before validation and persistence. Same-definition studies calculate, cache, render, hide, edit, remove, persist, and restore independently; a layout accepts at most 32 studies. rc.29 stores these V2 instances in a separate browser namespace and leaves older indicator records untouched instead of guessing an identity or deleting legacy data.

`entity-created`, `entity-updated`, and `entity-removed` events carry the final defensive entity snapshot. Drawing IDs are isolated by chart, persistence scope, data context, symbol, and adjustment; mark IDs additionally follow the current symbol; indicator IDs follow the chart's persisted indicator scope. A stale or foreign ID cannot mutate the current selection.

## Show host-owned execution marks

Execution marks are opt-in, read-only host data. Add the `executions` feature, then supply or replace the current symbol's real executions. The SDK never creates trades, infers T classifications, or writes an execution back to the host.

```ts
import { advancedChartFeatures, type ChartExecution } from "@simoncharts/charts";

const executions: readonly ChartExecution[] = [{
  id: brokerExecutionId,
  time: executionEpochMilliseconds,
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

Buys use the host theme's rising color and an upward arrow below price; sells use the falling color and a downward arrow above price. Minute views map by the real execution time and place a grouped marker at its latest real execution price. Daily, weekly, and monthly views attach to the containing real candle while details retain the unadjusted execution price. Same-candle executions of the same side and label are grouped without dropping their individual details; different labels on the same side are stacked. Changing the symbol clears the previous symbol's executions immediately, so the host must provide the new symbol's rows. Hover shows details on desktop, click or touch pins them, and clicking chart blank space closes them.

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

`ChartFeature` is a stable union of `symbol-search`, `timeframes`, `adjustment`, `series-type`, `price-scale`, `indicators`, `drawing-tools`, `drawing-history`, `settings`, and `bottom-panel`. Passing a feature controls construction: disabled controls are not mounted and do not bind listeners. `advancedChartFeatures` explicitly enables the complete 17-series, 16-indicator, 63-drawing, three-scale workbench.

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

Host adapters may throw `ChartDatafeedError` with a safe code (`NOT_CONFIGURED`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `NO_DATA`, or `UNAVAILABLE`), a user-facing message, and a recoverable flag. `onError` receives a normalized `ChartError`; known datafeed codes are available at `error.context?.datafeedCode`. Unknown upstream details are never exposed.

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

Current rc.30 adds frame-batched public crosshair movement and leave events with complete real candle and visible-study values while preserving rc.29's independent study instances, rc.28's scope-safe Entity API, rc.26 execution marks, intraday scaling, and the real-data-only contract.
