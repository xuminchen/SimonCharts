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

`@simoncharts/charts@1.0.0-rc.26` exposes `createChart(container, options)`. Its default embedded mode creates only timeframe, adjustment, and indicator controls and does not touch drawing persistence; hosts explicitly pass `advancedChartFeatures` for the professional chart-first shell and the full 17-series, 16-indicator, 63-drawing workbench. Both modes negotiate the host's exact timeframe and adjustment matrix through `ChartDatafeed.getCapabilities`.

The production SDK neither provides nor constructs market data. It renders only candles returned by the host datafeed; when the host has no real rows, the result stays empty. Deterministic fixtures live only in tests, scripts, and the private playground harness and are excluded from the production package and runtime path.

When the host declares real `1m` data, the timeframe group adds an intraday close-line view beside the ordinary continuous 1-minute candles. The optional capability `intradayScale: { previousClose, priceLimitPercent? }` gives the SDK the cutoff-specific official previous close and, when applicable, a nominal daily price-limit range. A one-day intraday chart keeps that symmetric default while every real high and low remains inside it; an actual excursion beyond the nominal percentage expands both sides to the next 0.1 percentage point after a 0.1-point drawing margin. It auto-scales when the limit is omitted. A 2–9 day view gives every real trading day an equal-width 242-slot session, centers real points in their slots, compresses the lunch break without overlapping 11:30 and 13:00, draws real day separators, and keeps one continuous price path. Its yellow intraday average resets each Shanghai trading day and equals cumulative turnover divided by cumulative volume; the complete price path uses one window-direction color. The official pre-window close remains the preferred direction reference; if shorter real history does not contain it, only the line color compares the final close with the first real open while the axis stays raw. Price, average, volume, crosshair, and the symmetric percentage axis share the same time coordinates when that official baseline exists. No missing day or minute is added. Ordinary K-line views retain bounded pan/zoom independently.

Advanced mode exposes the complete period menu and at most four persistent starred shortcuts in fixed product order; trying to pin a fifth displays `最多固定 4 个周期，请先取消一个`. Intraday and multi-day intraday are fixed line views, while ordinary periods default to candles. The 17 bilingual series choices and all 63 implemented bilingual drawing tools use visible semantic SVG icons; the SDK does not advertise tools that the engine cannot create, edit, serialize, and restore. The crosshair guide continues through the separate volume region, and ordinary K-line headers and hover panels include OHLC plus change information and the full candle data window. Locale now propagates consistently through the workspace shell and chart region. The plot reserves 34 px below the header so boundary-axis labels remain complete and separate from the summary. See `packages/chart-workspace/README.md` for the public contract and examples.

The optional `executions` feature renders only host-supplied real executions as read-only B/S/T marks. Buys use the rising color with an upward arrow below price; sells use the falling color with a downward arrow above price. The SDK groups matching same-candle marks, preserves every execution in hover or pinned details, and never constructs trades or infers T classifications.

The accepted immutable artifact is `dist/packages/simoncharts-charts-1.0.0-rc.26.tgz` (34 files), SHA-256 `44fca92c30e9ef1dc200e07c56a1e90f612cead15cd4aa10fb47cb899b72f616`. The release gate passed Engine `69 files / 1,107 tests`, Charts `14 files / 131 tests`, Charts Chrome `42/42`, Charts Edge `42/42`, TypeScript, artifact allowlisting, and external-consumer checks.

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
