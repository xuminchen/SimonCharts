# SimonCharts

SimonCharts contains a host-independent chart kernel and a private embeddable Advanced Charts SDK. `@simoncharts/chart-engine` is the low-level package; `@simoncharts/charts` is the browser SDK delivered to approved hosts. The playground apps exist only to exercise and verify those packages.

The engine owns neutral chart contracts, renderers, interaction state, drawing tools, commands, persistence payloads, visual outputs, and extension registration. Host applications own data loading, account state, routes, storage, business workflows, and product UI.

## Package

```bash
npm install @simoncharts/chart-engine
```

Import from the package root only:

```ts
import {
  createChartEngine,
  createDrawingEditor,
  renderStaticChart,
  supportedSeriesTypes
} from "@simoncharts/chart-engine";
```

Internal source paths are not public API. Runtime exports are guarded by `npm run guard:public-api`; TypeScript public symbols are guarded by `npm run guard:public-types`.

## Current RC Scope

`@simoncharts/chart-engine@1.0.0-rc.1` includes:

- eight canonical timeframes and linear, log, and percentage price scales
- 17 built-in chart series types
- bounded checkpoint runners for all 16 core indicators and five synthetic series transforms
- static canvas rendering and layered rendering primitives
- neutral interaction and render scheduler state
- visual output renderers for line, histogram, band, and marker outputs
- 63 built-in drawing tools, step/continuous creation previews, and a command-driven drawing editor
- canonical time/absolute-price drawing coordinates with shared render and edit projection
- drawing serialization and layout snapshot contracts
- extension registration for series, visual, drawing, and figure contributions

The engine does not import TradingReviewSystem, host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, or product persistence services.

## Charts RC

`@simoncharts/charts@1.0.0-rc.48` exposes `createChart(container, options)`. Its default embedded mode creates only timeframe, adjustment, and indicator controls and does not touch drawing persistence; hosts explicitly pass `advancedChartFeatures` for the professional chart-first shell and the full 17-series, 16-indicator, 63-drawing workbench. Both modes negotiate the host's exact timeframe and adjustment matrix through `ChartDatafeed.getCapabilities`.

The production SDK neither provides nor constructs market data. It renders only candles returned by the host datafeed; when the host has no real rows, the result stays empty. Deterministic fixtures live only in tests, scripts, and the private playground harness and are excluded from the production package and runtime path.

rc.33 adds optional paired `ChartExecution.firstTime` and `lastTime` fields for host-confirmed aggregated execution ranges. The existing native execution tooltip displays the original single `time`, one non-repeated endpoint, or a compact localized range; hover and mouse/touch pinned details share the same safe-text rows. The range never changes marker placement, grouping, coordinates, shape, persistence, or host ownership.

rc.34 adds chart-scoped, versioned Custom Study definitions with bounded numeric inputs and fixed line, histogram, band, or marker outputs. Synchronous causal calculations reuse the existing checkpoint, pane, crosshair, Study/Entity, Layout, failure/retry, and readiness paths; no new dependency, global mutable registry, second renderer, or browser code persistence was added. Definitions and callbacks remain host-owned, while layouts preserve only exact-version custom instances and their normalized inputs.

rc.35 adds strict programmable build properties for Renko, Line Break, Kagi, and Point & Figure. Non-default values round-trip through the existing Layout V2 and browser preference paths, active changes reuse the checkpointed generation lifecycle, stale calculations are aborted, and intraday remains the fixed real-data close line.

rc.36 adds strict host-owned Theme Overrides over the existing Workspace color tokens, plus runtime `getTheme()`, `setTheme()`, `getThemeOverrides()`, and `setThemeOverrides()` APIs. Overrides use atomic whole-object replacement, remain independent from Layout V2 and browser persistence, preserve across dark/light base switches, and repaint DOM and Canvas without recalculating market data, studies, or synthetic series.

rc.37 adds typed transient Selection for multiple interactive Drawings or one Study, plus semantic `drawing-clicked`, `study-clicked`, and grouped `execution-clicked` events through the existing defensive event stream. Primary Canvas clicks/taps remain distinct from secondary pointers, pan and edit drags; stale source replacement cancels pending actions, while Study actions use the topmost rendered visual geometry in the active panel rather than DOM controls.

rc.38 adds live Pane and per-pane Price Scale APIs over the existing main and separate Study panels. Hosts can inspect, resize, collapse, and reorder Study panes, switch between automatic and explicit ranges, and invert scales; native right-axis drag and double-click share that same state. `ChartLayoutV3` persists these settings, exports/events always emit V3, and strict V2 import migrates to deterministic defaults without changing market data or browser-owned preferences.

rc.39 adds optional `ChartSymbol.pricePrecision` formatting for raw prices and a keyboard-operable symbol-search combobox. Explicit precision is an integer from 0 through 8 and is applied consistently to main price axes, current/crosshair labels, OHLC and change displays, the data window, and execution prices without rounding host candles or events; omitting it preserves the rc.38 display rules. Search keeps focus on the input, supports Arrow/Home/End/Enter/Escape/Tab, waits for IME composition, aborts stale work, announces loading/results/empty/error states, and uses only safe text from host-owned results.

rc.42 adds host-owned Symbol Compare through `ChartOptions.comparisons`, `setComparisons()`, and `getComparisons()`, with at most four defensively cloned `ChartComparison` records. Each comparison uses exact main-series timestamps without interpolation or fill; ordinary periods normalize from that comparison's first visible real value, while intraday uses its trusted `previousClose`. The main series owns the time axis, a non-empty comparison list uses percentage display, and removing the final comparison restores the prior price-scale mode. Comparisons remain outside Layout V3, layout export/import, and automatic browser persistence snapshots. `dataReady()` includes the current comparison context and visible range and resolves `false` when a visible comparison cannot become ready.

rc.43 adds Historical Replay over accepted host candles. `startReplay()`, `stepReplay()`, `playReplay()`, `pauseReplay()`, `setReplaySpeed()`, `stopReplay()`, and `getReplayState()` reveal only real candles at or before the cursor, advance across cached materialized windows by the next real candle timestamp, and restore the current full presentation on exit. The existing calculation, comparison, mark, execution, price-scale, crosshair, and readiness paths consume the same truncated presentation; replay state remains transient and outside Layout V3 and browser persistence.

rc.44 adds a frozen `getTimeScale()` handle for visible ranges, bounded bar spacing, plot width, exact loaded-Candle coordinate conversion, Bar-based scrolling, zoom, bounded fit, and reset. A finite `executeActionById()` union exposes `timeScaleReset`, `chartReset`, `zoomIn`, `zoomOut`, and `fitContent` without publishing the engine dispatcher or creating a second history path. Fixed intraday remains non-zoomable, and viewport state stays transient.

rc.45 adds sparse, type-specific `ChartSeriesVisualOverrides` and per-Study-output `ChartStudyOutputVisualOverride` contracts. Main-series colors and line widths preserve independently by series type through runtime APIs, Layout V3, and browser preferences; Study line, histogram, band, and marker outputs can be styled or hidden through the existing Study API. Style-only changes reuse current calculations and repaint only their owned layers, while hidden outputs leave rendering, auto-scale, hit testing, crosshair, and the data window.

rc.46 adds a transient native Data Table View through `getDisplayMode()` and `setDisplayMode()`. It reads the current rendered main-series model, visible Study outputs, and ready visible comparisons without requesting or constructing market data; rows are newest first and rendered in lazy 250-row batches. The advanced More menu and chart context menu share the same action, chart interaction is cancelled while the table is active, keyboard focus transfers safely, and display mode remains outside Layout V3 and browser persistence.

rc.47 adds native Drawing Groups through `getDrawingGroupsApi()` and the existing Objects inspector. Groups keep members contiguous in the shared Drawing z-order, participate in the same undo/redo snapshots, and batch rename, membership, visibility, locking, movement, ungroup, and deletion without creating a second Drawing store. Optional `ChartLayoutV3.drawingGroups` and the existing symbol/adjust-scoped browser Drawing document preserve groups atomically while accepting legacy ungrouped layouts and stored Drawing arrays.

rc.48 keeps the rc.43 Historical Replay API unchanged while allowing a replay cursor to cross newer pages whose Candle payloads were evicted from the bounded cache. The controller reuses trusted page descriptors and the existing Datafeed reload path, leaves the current causal presentation unchanged while a page is pending, coalesces concurrent steps, and resumes only from exact host Candle timestamps. Failed reloads pause without retry spinning; replay sessions, selection revisions, data generations, and data versions suppress stale stop/start, A→B→A, and snapshot-refresh completions.

rc.41 adds no public API or dependency. It strengthens the browser and lifecycle gates around a lazy one-million-candle source: exact 50,000-candle historical traversal, a bounded 2,000-page descriptor chain, 63 Drawings with MA/RSI/MACD, and Chrome/Edge crosshair, pan, and zoom budgets. Rendering now skips the empty dynamic pass and reconciles layout once per static frame, preserving price-axis geometry across scale, precision, Drawing, and Study changes. Same-selection recovery no longer inherits stale `dataReady()` state, failed requested ranges settle readiness as `false`, and `destroy()` releases cached and materialized market/visual data under reentry or host callback failure.

rc.32 adds `getStudyApi()` for live, validated study input and visibility control without replacing the existing Entity engine. It also adds `dataReady()`, a Promise bound to the exact current symbol, timeframe, adjustment, view, and intraday-day selection and its first scheduled paint; it resolves `false` instead of leaking readiness across replacement, terminal materialization failure, blocked data, or destruction. Calculation failures are now distinct from Canvas failures, and retries do not report ready until every failed indicator or stateful-series calculation has been recomputed and painted.

rc.31 added independent public Drawing controls for interaction and automatic price-scale contribution. A visible, finite, time-intersecting `datePriceRange` or `priceRange` with `affectsPriceScale: true` remains fully visible outside the candle range; `interactive: false` keeps it rendered and programmable while excluding it from hover, hit testing, handles, selection, pointer capture, and keyboard edits. Defaults preserve rc.30 behavior, and `locked` remains an independent edit constraint. rc.30's frame-batched `crosshair-moved` and `crosshair-left` subscriptions remain unchanged.

When the host declares real `1m` data, the timeframe group adds an intraday close-line view beside the ordinary continuous 1-minute candles. The optional capability `intradayScale: { previousClose, priceLimitPercent? }` gives the SDK the cutoff-specific official previous close and, when applicable, a nominal daily price-limit range. A one-day intraday chart keeps that symmetric default while every real high and low remains inside it; an actual excursion beyond the nominal percentage expands both sides to the next 0.1 percentage point after a 0.1-point drawing margin. It auto-scales when the limit is omitted. A 2–9 day view gives every real trading day an equal-width 242-slot session, centers real points in their slots, compresses the lunch break without overlapping 11:30 and 13:00, draws real day separators, and keeps one continuous price path. Its yellow intraday average resets each Shanghai trading day and equals cumulative turnover divided by cumulative volume; the complete price path uses one window-direction color. The official pre-window close remains the preferred direction reference; if shorter real history does not contain it, only the line color compares the final close with the first real open while the axis stays raw. Price, average, volume, crosshair, and the symmetric percentage axis share the same time coordinates when that official baseline exists. No missing day or minute is added. Ordinary K-line views retain bounded pan/zoom independently.

Advanced mode exposes the complete period menu and at most four persistent starred shortcuts in fixed product order; trying to pin a fifth displays `最多固定 4 个周期，请先取消一个`. Intraday and multi-day intraday are fixed line views, while ordinary periods default to candles. The 17 bilingual series choices and all 63 implemented bilingual drawing tools use visible semantic SVG icons; the SDK does not advertise tools that the engine cannot create, edit, serialize, and restore. The crosshair guide continues through the separate volume region, and ordinary K-line headers and hover panels include OHLC plus change information and the full candle data window. Locale now propagates consistently through the workspace shell and chart region. The plot reserves 34 px below the header so boundary-axis labels remain complete and separate from the summary. See `packages/chart-workspace/README.md` for the public contract and examples.

The optional `executions` feature renders only host-supplied real executions as read-only B/S/T marks. Buys use the rising color with an upward arrow below price; sells use the falling color with a downward arrow above price. The SDK groups matching same-candle marks, preserves every execution in hover or pinned details, and never constructs trades or infers T classifications.

The accepted immutable package artifact is `dist/packages/simoncharts-charts-1.0.0-rc.48.tgz` (8 files), SHA-256 `6a83d8bf662ecd798bef6988a25b91e90d8f084c662a32fe0ee0d9a910c7fdfb`, SHA-512 `c59ddf6f36f6e762ab2ebf6df3091a935be47c2e15a29bfcf370505724a19902f43b6b997bbafb76c212f1bd8eb2430b5ea8a5931b9e4608680759a149e854e5`. Its package-only commercial gate passed `79 files / 1,367 tests`, combined Chrome `161/161`, Charts `23 files / 345 tests`, Charts Chrome/Edge `110/110` per browser, and exact packed JavaScript/TypeScript Chrome/Edge consumer execution. Historical artifacts remain immutable; authenticated reference-host acceptance remains the separate final commercial gate described below.

## Validation

Run the release candidate gate:

```bash
npm run check:release-gate
```

Expanded release gate for auditability:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run build
npm run check:host-smoke
npm run check:package-consumer
npm run check:package-types
npm run check:performance
npm run check:release-readiness
npm run check:package-artifact
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

See `docs/engine/release-candidate.md` for release scope and evidence.

Run the dedicated Workspace release gate with:

```bash
npm run check:workspace-release-gate
```

The Workspace gate exercises the packed JavaScript and TypeScript consumer, artifact allowlist, runtime export snapshot, emitted declaration-signature snapshot, and the complete browser suite in installed desktop Chrome and Edge.

Commercial orchestration has two explicit levels:

```bash
npm run check:commercial-package-gate # Engine full gate + Workspace package/browser gate
npm run check:commercial-release-gate # package gate + authenticated TradingReviewSystem host
```

The final gate is only valid after the reference host has installed the exact candidate tarball and has real provider credentials. To create a versioned RC artifact exactly once, run:

```bash
npm run pack:workspace
```

The command reruns the package-only commercial gate, writes the tarball plus SHA-256 and SHA-512 sidecars under `dist/packages/`, and refuses to overwrite any existing output.
