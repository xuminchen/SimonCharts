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

`@simoncharts/charts@1.0.0-rc.18` exposes `createChart(container, options)`. Its default embedded mode creates only timeframe, adjustment, and indicator controls and does not touch drawing persistence; hosts explicitly pass `advancedChartFeatures` for the professional chart-first shell and the full 17-series, 16-indicator, 63-drawing workbench. Both modes negotiate the host's exact timeframe and adjustment matrix through `ChartDatafeed.getCapabilities`.

When the host declares real `1m` data, the timeframe group adds an intraday close-line view beside the ordinary continuous 1-minute candles. The optional capability `intradayScale: { previousClose, priceLimitPercent? }` gives the SDK the cutoff-specific official previous close and, when applicable, a fixed daily price-limit range. A one-day intraday chart uses that fixed percentage axis or auto-scales when the limit is omitted; a 2–9 day view uses real trading days, the close before the first selected day as its percentage baseline, and fits the complete available window without fabricating data. Intraday uses a left price axis, a right percentage axis, a direction-colored line, a separate volume region, compact non-colliding time labels, and no viewport zoom; ordinary K-line views retain pan/zoom, keep a latest viewport at `to = lastIndex` and `scrollOffset = 0`, and use anchor-based zoom only after the user pans into history. Advanced mode exposes the complete period menu, persistent starred shortcuts in fixed product order, a 17-type Chinese-and-English chart menu, and a chart-header 1–9 day/OHLC summary. Ordinary periods default to candles; intraday and multi-day intraday remain line views. The plot reserves 34 px below that header so boundary-axis labels remain complete and separate from OHLC. See `packages/chart-workspace/README.md` for the public contract and examples.

The accepted immutable artifact is `dist/packages/simoncharts-charts-1.0.0-rc.18.tgz` (32 files), SHA-256 `5dcf23227e5280182539457db75579d258443dc6b33f75eef5bddb6289f29d93`, SHA-512 `b1453e8d6c7127c555cacea547ce5cef89f3e3d75ba439ec3446f1cb4e3cab860319dde3d409a41dce69d27235cddd1db25ed296b7c7b5a0e7e9d52adba2a24a`. The release gate passed `67 files / 1,072` repository tests, focused Charts coverage, TypeScript, runtime/declaration API guards, artifact allowlisting, external consumer, and the byte-identical packed TradingReviewSystem host path.

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
