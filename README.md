# SimonCharts

SimonCharts is a host-independent chart engine workspace. The reusable package is `@simoncharts/chart-engine`; the playground app exists only to exercise and verify the engine.

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
