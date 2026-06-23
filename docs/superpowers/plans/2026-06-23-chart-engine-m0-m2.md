# Chart Engine M0-M2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first reusable SimonCharts chart engine core through M0 Engine Contract, M1 Static Canvas Renderer, and M2 Interaction Engine, without any TradingReviewSystem business coupling.

**Architecture:** The repository starts as a small TypeScript workspace with one engine package and one playground app. `packages/chart-engine` owns neutral contracts, viewport math, canvas rendering, layers, indicators, and interactions; `apps/playground` consumes only the public engine API and fixture data. Host applications remain outside this plan and can only communicate with the engine through neutral `HostAdapter` callbacks and neutral chart data.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright, Canvas 2D API, npm scripts.

---

## Source Spec

Read before implementation:

- `docs/superpowers/specs/2026-06-23-chart-engine-platform-design.md`

Implementation scope:

- Include M0, M1, and M2 only.
- Exclude M3 TradingReviewSystem host integration.
- Exclude watchlists, review notes, strategy candidates, AI conclusions, auth, persistence, backend APIs, broker trading, backtesting, accounts, billing, and subscription features.

## Boundary Rules

These rules are required for every task:

- Engine code under `packages/chart-engine` must not import host app APIs, stores, schemas, routes, backend response types, or business models.
- Engine code must not contain TradingReviewSystem business vocabulary as model types or package imports: `review`, `strategy`, `candidate`, `watchlist`, `AI`, `auth`, `portfolio`, `trading-review-system`.
- Business concepts can enter only after conversion by a host into neutral engine inputs such as `ChartMark`, `DrawingObject`, `CandleSeries`, or adapter callbacks.
- `apps/playground` may import `@simoncharts/chart-engine`; the engine package must not import from `apps/*`.
- Rendering and interaction modules may use browser APIs. Core model and viewport modules must stay pure TypeScript and browser-independent.

## Planned File Structure

Create:

- `package.json` - root scripts for typecheck, test, boundary guard, build, dev, and Playwright.
- `tsconfig.base.json` - shared strict TypeScript configuration.
- `vitest.config.ts` - unit test configuration for engine and scripts.
- `playwright.config.ts` - browser test configuration for the playground.
- `scripts/check-engine-boundary.mjs` - import and vocabulary guard for engine source files.
- `packages/chart-engine/package.json` - public engine package metadata and export map.
- `packages/chart-engine/tsconfig.json` - engine build configuration.
- `packages/chart-engine/src/index.ts` - public API barrel.
- `packages/chart-engine/src/model/market.ts` - `Candle`, `CandleSeries`, `Quote`, `TradingCalendar`, timeframe and adjust-mode contracts.
- `packages/chart-engine/src/model/theme.ts` - `ChartTheme` and default theme.
- `packages/chart-engine/src/model/visual.ts` - `ChartMark`, `DrawingObject`, indicator contracts, visual output types.
- `packages/chart-engine/src/model/runtime.ts` - `ViewportState`, `ChartCommand`, neutral chart events.
- `packages/chart-engine/src/model/adapter.ts` - neutral `HostAdapter` interface.
- `packages/chart-engine/src/model/helpers.ts` - pure model helpers for candle validation and lookup.
- `packages/chart-engine/src/fixtures/dailyCandles.ts` - deterministic daily fixture series.
- `packages/chart-engine/src/viewport/viewport.ts` - visible range, x/y coordinate mapping, zoom, and pan math.
- `packages/chart-engine/src/viewport/priceRange.ts` - visible price range calculation.
- `packages/chart-engine/src/indicators/movingAverage.ts` - deterministic MA calculation for MA5, MA10, MA20, and MA60.
- `packages/chart-engine/src/render/canvasManager.ts` - canvas sizing and device pixel ratio handling.
- `packages/chart-engine/src/render/renderTypes.ts` - render context and layer contracts.
- `packages/chart-engine/src/render/staticRenderer.ts` - full static render orchestration.
- `packages/chart-engine/src/render/layers/gridLayer.ts` - grid layer.
- `packages/chart-engine/src/render/layers/axisLayer.ts` - price and time axis layer.
- `packages/chart-engine/src/render/layers/candlestickLayer.ts` - candle body and wick layer.
- `packages/chart-engine/src/render/layers/volumeLayer.ts` - volume bar layer.
- `packages/chart-engine/src/render/layers/movingAverageLayer.ts` - MA line layer.
- `packages/chart-engine/src/render/layers/crosshairLayer.ts` - M2 overlay crosshair layer.
- `packages/chart-engine/src/render/layers/tooltipLayer.ts` - M2 overlay tooltip layer.
- `packages/chart-engine/src/interaction/interactionEngine.ts` - pointer, wheel, drag, reset, and neutral event translation.
- `packages/chart-engine/src/interaction/hitTest.ts` - candle lookup from cursor coordinates.
- `packages/chart-engine/src/__tests__/model.test.ts` - M0 model and fixture tests.
- `packages/chart-engine/src/__tests__/viewport.test.ts` - M1 and M2 viewport math tests.
- `packages/chart-engine/src/__tests__/movingAverage.test.ts` - MA tests.
- `packages/chart-engine/src/__tests__/interaction.test.ts` - interaction engine tests.
- `apps/playground/package.json` - playground package metadata.
- `apps/playground/index.html` - Vite entry HTML.
- `apps/playground/src/main.ts` - chart playground bootstrapping using engine public API.
- `apps/playground/src/styles.css` - playground layout styles.
- `apps/playground/tests/static-chart.spec.ts` - screenshot and nonblank rendering tests.
- `apps/playground/tests/interaction.spec.ts` - zoom, pan, crosshair, tooltip, and event tests.

Do not create:

- `apps/trading-review-system/*`
- host adapter implementations for TradingReviewSystem
- API clients
- persistence modules
- watchlist, review, strategy, AI, auth, account, billing, or broker modules

## M0: Engine Contract

### Task 1: Create TypeScript Workspace Scaffold

**Files:**

- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `packages/chart-engine/package.json`
- Create: `packages/chart-engine/tsconfig.json`
- Create: `apps/playground/package.json`
- Create: `apps/playground/tsconfig.json`
- Create: `apps/playground/index.html`

- [ ] **Step 1: Add root package scripts and dev dependencies**

Create `package.json` with npm workspaces for `packages/*` and `apps/*`.

Required scripts:

```json
{
  "scripts": {
    "typecheck": "tsc -b packages/chart-engine apps/playground",
    "test": "vitest run",
    "test:watch": "vitest",
    "guard:engine-boundary": "node scripts/check-engine-boundary.mjs",
    "build": "npm run build -w @simoncharts/chart-engine && npm run build -w @simoncharts/playground",
    "dev": "npm run dev -w @simoncharts/playground",
    "test:e2e": "playwright test"
  }
}
```

Required dev dependencies:

```json
{
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vite": "^5.3.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Add strict shared TypeScript settings**

Create `tsconfig.base.json` with `strict: true`, `moduleResolution: "Bundler"`, and `target: "ES2022"`. Do not put the `@simoncharts/chart-engine` source alias in the shared base config; app projects should resolve the workspace package through npm linking and package metadata.

- [ ] **Step 3: Add Vitest and Playwright configs**

Create `vitest.config.ts` with `environment: "node"` and include `packages/**/*.test.ts`.

Create `playwright.config.ts` with:

```ts
webServer: {
  command: "npm run dev -- --host 127.0.0.1",
  url: "http://127.0.0.1:5173",
  reuseExistingServer: !process.env.CI
}
```

- [ ] **Step 4: Add engine and playground package metadata**

`packages/chart-engine/package.json` must expose only `src/index.ts` during the first implementation:

```json
{
  "name": "@simoncharts/chart-engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -b",
    "typecheck": "tsc -b"
  }
}
```

`apps/playground/package.json` must depend on `@simoncharts/chart-engine` through version `0.0.0`; npm workspaces will link the local package during install.

Create `apps/playground/tsconfig.json` as a TypeScript project with `noEmit: true`, an empty `files: []` list, and a project reference to `../../packages/chart-engine`. Task 9 will add `src/main.ts` and update this project to include playground source.

- [ ] **Step 5: Verify scaffold**

Run:

```bash
npm install
npm run typecheck
```

Expected:

- `npm install` creates `package-lock.json`.
- `npm run typecheck` fails only because source entry files are not created yet, or passes after Task 2 creates them.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts playwright.config.ts packages/chart-engine/package.json packages/chart-engine/tsconfig.json apps/playground/package.json apps/playground/tsconfig.json apps/playground/index.html
git commit -m "chore: scaffold chart engine workspace"
```

### Task 2: Define Neutral Engine Contracts

**Files:**

- Create: `packages/chart-engine/src/model/market.ts`
- Create: `packages/chart-engine/src/model/theme.ts`
- Create: `packages/chart-engine/src/model/visual.ts`
- Create: `packages/chart-engine/src/model/runtime.ts`
- Create: `packages/chart-engine/src/model/adapter.ts`
- Create: `packages/chart-engine/src/index.ts`
- Test: `packages/chart-engine/src/__tests__/model.test.ts`

- [ ] **Step 1: Write failing contract test**

Create `packages/chart-engine/src/__tests__/model.test.ts` with assertions that a neutral `CandleSeries` can be created, a `HostAdapter` can receive neutral viewport changes, and no host business type is required.

The test must import only from `../index`.

Validation command:

```bash
npm run test -- packages/chart-engine/src/__tests__/model.test.ts
```

Expected before implementation:

- FAIL because `packages/chart-engine/src/index.ts` does not exist.

- [ ] **Step 2: Add market contracts**

Create `market.ts` with exported types:

- `Timeframe = "1d" | "1w" | "1mo"`
- `AdjustMode = "none" | "forward" | "backward"`
- `Candle`
- `CandleSeries`
- `Quote`
- `TradingCalendar`

`Candle` must use neutral market fields only: `time`, `open`, `high`, `low`, `close`, `volume`, `turnover`.

- [ ] **Step 3: Add theme contract**

Create `theme.ts` with:

- `ChartTheme`
- `defaultChartTheme`

The theme must include semantic colors for background, grid, text, bullish candle, bearish candle, volume, crosshair, tooltip, and MA lines.

- [ ] **Step 4: Add visual extension contracts**

Create `visual.ts` with:

- `ChartMark`
- `DrawingObject`
- `IndicatorDefinition`
- `IndicatorResult`
- line, histogram, band, marker, and panel output contracts

`ChartMark.metadata` and `DrawingObject.metadata` must be `Record<string, unknown>` so hosts can attach their own data without engine business imports.

- [ ] **Step 5: Add runtime and adapter contracts**

Create `runtime.ts` with:

- `ViewportState`
- `ChartCommand`
- `ChartEvent`
- `VisibleRange`
- `PriceScaleMode = "linear" | "log" | "percent"`

Create `adapter.ts` with:

- `HostAdapter`
- optional callbacks `resolveData`, `onRangeNeedMoreData`, `onViewportChange`, `onDrawingChange`, `onCommand`, `onMarkClick`, `persistLayout`

The adapter must reference only neutral engine types.

- [ ] **Step 6: Export public API**

Create `index.ts` exporting contracts from model files. Do not export any file from `apps/*`.

- [ ] **Step 7: Verify contracts**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/model.test.ts
npm run typecheck
```

Expected:

- Model test passes.
- Typecheck passes for created engine files.

- [ ] **Step 8: Commit**

```bash
git add packages/chart-engine/src/model packages/chart-engine/src/index.ts packages/chart-engine/src/__tests__/model.test.ts
git commit -m "feat: define neutral chart engine contracts"
```

### Task 3: Add Fixture Data and Model Helpers

**Files:**

- Create: `packages/chart-engine/src/fixtures/dailyCandles.ts`
- Create: `packages/chart-engine/src/model/helpers.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Modify: `packages/chart-engine/src/__tests__/model.test.ts`

- [ ] **Step 1: Add failing fixture and helper tests**

Extend `model.test.ts` with tests for:

- fixture series has symbol, timeframe, adjust mode, data version, and at least 120 candles
- candle times are strictly increasing
- every candle satisfies `low <= open/high/close <= high`
- `findCandleByTime(series, time)` returns the matching candle
- `getCandleAtIndex(series, index)` returns `undefined` outside bounds

Validation command:

```bash
npm run test -- packages/chart-engine/src/__tests__/model.test.ts
```

Expected before implementation:

- FAIL because fixture and helper exports do not exist.

- [ ] **Step 2: Add deterministic fixture**

Create `dailyCandles.ts` exporting `fixtureDailyCandleSeries`.

Requirements:

- `symbol: "SIMON"`
- `timeframe: "1d"`
- `adjustMode: "none"`
- `dataVersion: "fixture-2026-06-23"`
- at least 120 daily candles
- deterministic numeric values
- no host business fields

- [ ] **Step 3: Add model helpers**

Create `helpers.ts` exporting:

- `isValidCandle(candle: Candle): boolean`
- `assertCandleSeries(series: CandleSeries): void`
- `getCandleAtIndex(series: CandleSeries, index: number): Candle | undefined`
- `findCandleByTime(series: CandleSeries, time: number): Candle | undefined`

`assertCandleSeries` must throw a plain `Error` with a specific message for empty candles, invalid OHLC bounds, or non-increasing time.

- [ ] **Step 4: Export fixture and helpers**

Update `index.ts` to export fixture and helper modules.

- [ ] **Step 5: Verify fixture contract**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/model.test.ts
npm run typecheck
```

Expected:

- All M0 model tests pass.
- Fixture can instantiate a neutral `CandleSeries`.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/fixtures packages/chart-engine/src/model/helpers.ts packages/chart-engine/src/index.ts packages/chart-engine/src/__tests__/model.test.ts
git commit -m "feat: add neutral candle fixtures"
```

### Task 4: Add Engine Boundary Guard

**Files:**

- Create: `scripts/check-engine-boundary.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write boundary guard script**

Create `scripts/check-engine-boundary.mjs`.

The script must scan `packages/chart-engine/src/**/*.ts` and fail on:

- relative imports that leave `packages/chart-engine/src`
- imports containing `apps/`
- imports containing `trading-review-system`
- import paths containing business vocabulary: `review`, `strategy`, `candidate`, `watchlist`, `auth`, `portfolio`, `trading-review-system`
- source tokens containing business vocabulary as standalone identifiers or identifier segments: `Review`, `Strategy`, `Candidate`, `Watchlist`, `AI`, `Auth`, `Portfolio`, `TradingReviewSystem`

The vocabulary scan must not reject neutral words that merely contain the same letters, such as `dailyCandles`, `main`, or `maintain`.

- [ ] **Step 2: Add root guard script**

Ensure `package.json` contains:

```json
"guard:engine-boundary": "node scripts/check-engine-boundary.mjs"
```

- [ ] **Step 3: Verify guard**

Run:

```bash
npm run guard:engine-boundary
```

Expected:

- PASS with current neutral engine files.

- [ ] **Step 4: Verify full M0**

Run:

```bash
npm run typecheck
npm run test
npm run guard:engine-boundary
```

Expected:

- Type checks pass.
- Unit tests pass.
- Boundary guard passes.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-engine-boundary.mjs package.json
git commit -m "test: guard chart engine host boundary"
```

## M1: Static Canvas Renderer

### Task 5: Implement Viewport Coordinate Mapping

**Files:**

- Create: `packages/chart-engine/src/viewport/viewport.ts`
- Create: `packages/chart-engine/src/viewport/priceRange.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Test: `packages/chart-engine/src/__tests__/viewport.test.ts`

- [ ] **Step 1: Write failing viewport tests**

Create tests for:

- visible candle range from candle count, width, scroll offset, and canvas width
- x coordinate maps candle index to the candle center
- y coordinate maps max price to top plot area and min price to bottom plot area
- visible price range includes only visible candles and adds deterministic padding
- linear scale works first
- `log` and `percent` scale modes are accepted in types but return a clear unsupported error when used by coordinate mapping in M1

Validation command:

```bash
npm run test -- packages/chart-engine/src/__tests__/viewport.test.ts
```

Expected before implementation:

- FAIL because viewport exports do not exist.

- [ ] **Step 2: Add price range helper**

Create `priceRange.ts` exporting:

- `computeVisiblePriceRange(series: CandleSeries, visibleRange: VisibleRange): { min: number; max: number }`

Rules:

- use candle `low` and `high`
- clamp visible indexes to available candles
- add 5% padding
- return a non-zero span for flat data

- [ ] **Step 3: Add viewport state and coordinate helpers**

Create `viewport.ts` exporting:

- `createInitialViewport(candleCount: number, width: number): ViewportState`
- `computeVisibleRange(viewport: ViewportState, candleCount: number, width: number): VisibleRange`
- `indexToX(index: number, viewport: ViewportState, plotLeft: number): number`
- `xToIndex(x: number, viewport: ViewportState, plotLeft: number): number`
- `priceToY(price: number, priceRange: { min: number; max: number }, plotTop: number, plotHeight: number, scaleMode: PriceScaleMode): number`
- `yToPrice(y: number, priceRange: { min: number; max: number }, plotTop: number, plotHeight: number, scaleMode: PriceScaleMode): number`

Rules:

- support `linear` scale
- throw `Error("Price scale mode is not implemented: log")` and `Error("Price scale mode is not implemented: percent")` for non-linear modes in M1
- keep functions deterministic and DOM-free

- [ ] **Step 4: Export viewport API**

Update `index.ts` to export viewport modules.

- [ ] **Step 5: Verify viewport**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/viewport.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected:

- Viewport tests pass.
- Typecheck passes.
- Boundary guard passes.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/viewport packages/chart-engine/src/index.ts packages/chart-engine/src/__tests__/viewport.test.ts
git commit -m "feat: add chart viewport mapping"
```

### Task 6: Implement Moving Average Indicator Calculation

**Files:**

- Create: `packages/chart-engine/src/indicators/movingAverage.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Test: `packages/chart-engine/src/__tests__/movingAverage.test.ts`

- [ ] **Step 1: Write failing MA tests**

Create tests for:

- MA5 returns `undefined` for the first 4 candles and the arithmetic close average at index 4
- MA10, MA20, and MA60 return deterministic values from fixture data
- calculation returns one output point per candle
- invalid period `0` throws `Error("Moving average period must be greater than 0")`

Validation command:

```bash
npm run test -- packages/chart-engine/src/__tests__/movingAverage.test.ts
```

Expected before implementation:

- FAIL because MA exports do not exist.

- [ ] **Step 2: Add MA calculation**

Create `movingAverage.ts` exporting:

- `MovingAveragePeriod = 5 | 10 | 20 | 60`
- `calculateMovingAverage(series: CandleSeries, period: number): Array<{ time: number; value: number | undefined }>`
- `calculateDefaultMovingAverages(series: CandleSeries): Record<"MA5" | "MA10" | "MA20" | "MA60", Array<{ time: number; value: number | undefined }>>`

Rules:

- use candle close prices
- preserve candle order
- return `undefined` until enough candles exist
- round only in rendering, not in calculation

- [ ] **Step 3: Export indicator API**

Update `index.ts` to export moving average functions.

- [ ] **Step 4: Verify indicator**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/movingAverage.test.ts
npm run test
npm run typecheck
npm run guard:engine-boundary
```

Expected:

- MA tests pass.
- Full unit test suite passes.
- Typecheck and boundary guard pass.

- [ ] **Step 5: Commit**

```bash
git add packages/chart-engine/src/indicators packages/chart-engine/src/index.ts packages/chart-engine/src/__tests__/movingAverage.test.ts
git commit -m "feat: calculate moving averages"
```

### Task 7: Add Canvas Manager and Render Contracts

**Files:**

- Create: `packages/chart-engine/src/render/canvasManager.ts`
- Create: `packages/chart-engine/src/render/renderTypes.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Test: `packages/chart-engine/src/__tests__/renderTypes.test.ts`

- [ ] **Step 1: Write failing canvas manager test**

Create `renderTypes.test.ts` using a minimal fake canvas object to assert:

- CSS width and height are preserved
- backing store width and height are multiplied by device pixel ratio
- context transform is reset before scaling
- plot area reserves right axis width and bottom time axis height

Validation command:

```bash
npm run test -- packages/chart-engine/src/__tests__/renderTypes.test.ts
```

Expected before implementation:

- FAIL because render exports do not exist.

- [ ] **Step 2: Add render contracts**

Create `renderTypes.ts` exporting:

- `ChartLayout`
- `RenderState`
- `LayerRenderContext`
- `ChartLayer`

`ChartLayer` must be a plain object with:

```ts
{
  id: string;
  render(context: LayerRenderContext): void;
}
```

- [ ] **Step 3: Add canvas manager**

Create `canvasManager.ts` exporting:

- `resizeCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number, devicePixelRatio: number): CanvasRenderingContext2D`
- `createChartLayout(width: number, height: number): ChartLayout`

Rules:

- use Canvas 2D API only
- no React
- no host imports
- no data fetching

- [ ] **Step 4: Export render API**

Update `index.ts` to export canvas and render contracts.

- [ ] **Step 5: Verify canvas manager**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/renderTypes.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected:

- Canvas manager tests pass.
- Typecheck and boundary guard pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/render packages/chart-engine/src/index.ts packages/chart-engine/src/__tests__/renderTypes.test.ts
git commit -m "feat: add canvas render contracts"
```

### Task 8: Implement Static Render Layers

**Files:**

- Create: `packages/chart-engine/src/render/staticRenderer.ts`
- Create: `packages/chart-engine/src/render/layers/gridLayer.ts`
- Create: `packages/chart-engine/src/render/layers/axisLayer.ts`
- Create: `packages/chart-engine/src/render/layers/candlestickLayer.ts`
- Create: `packages/chart-engine/src/render/layers/volumeLayer.ts`
- Create: `packages/chart-engine/src/render/layers/movingAverageLayer.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Test: `packages/chart-engine/src/__tests__/staticRenderer.test.ts`

- [ ] **Step 1: Write failing static renderer tests**

Create tests with a fake canvas context recording draw calls. Assert:

- render order is grid, axis, candlestick, volume, moving average
- each layer receives the same neutral `RenderState`
- candlestick layer draws one body and one wick per visible candle
- volume layer draws one bar per visible candle
- moving average layer skips `undefined` values and draws continuous segments where values exist

Validation command:

```bash
npm run test -- packages/chart-engine/src/__tests__/staticRenderer.test.ts
```

Expected before implementation:

- FAIL because static render modules do not exist.

- [ ] **Step 2: Add layer factories**

Each layer file must export one factory:

- `createGridLayer(): ChartLayer`
- `createAxisLayer(): ChartLayer`
- `createCandlestickLayer(): ChartLayer`
- `createVolumeLayer(): ChartLayer`
- `createMovingAverageLayer(): ChartLayer`

Layer rules:

- consume `LayerRenderContext`
- draw from neutral `CandleSeries`, `ViewportState`, theme, layout, and computed MA results
- do not mutate series data
- do not fetch data
- do not emit host events

- [ ] **Step 3: Add static renderer**

Create `staticRenderer.ts` exporting:

- `createStaticLayers(): ChartLayer[]`
- `renderStaticChart(context: LayerRenderContext, layers?: ChartLayer[]): void`

Render order must be:

1. grid
2. axis
3. candlestick
4. volume
5. moving average

- [ ] **Step 4: Export static renderer API**

Update `index.ts` to export static renderer and layer factories.

- [ ] **Step 5: Verify static renderer**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/staticRenderer.test.ts
npm run test
npm run typecheck
npm run guard:engine-boundary
```

Expected:

- Static renderer tests pass.
- Full unit test suite passes.
- Typecheck and boundary guard pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/render packages/chart-engine/src/index.ts packages/chart-engine/src/__tests__/staticRenderer.test.ts
git commit -m "feat: render static candle chart layers"
```

### Task 9: Add Static Playground and Screenshot Verification

**Files:**

- Create: `apps/playground/src/main.ts`
- Create: `apps/playground/src/styles.css`
- Modify: `apps/playground/index.html`
- Create: `apps/playground/tests/static-chart.spec.ts`

- [ ] **Step 1: Write failing Playwright static chart test**

Create `static-chart.spec.ts` with checks:

- page loads at `/`
- canvas with `data-testid="chart-canvas"` exists
- chart canvas has nonblank pixels after render
- screenshot is stable enough to compare manually through Playwright artifacts

Validation command:

```bash
npm run test:e2e -- apps/playground/tests/static-chart.spec.ts
```

Expected before implementation:

- FAIL because playground entry code is missing.

- [ ] **Step 2: Add playground markup and styles**

`index.html` must contain:

```html
<div id="app"></div>
<script type="module" src="/src/main.ts"></script>
```

`styles.css` must create a full viewport chart workspace with no host navigation, no TradingReviewSystem labels, and no business panels.

- [ ] **Step 3: Add playground bootstrapping**

`main.ts` must:

- create a `<canvas data-testid="chart-canvas">`
- use `fixtureDailyCandleSeries`
- call `assertCandleSeries`
- create an initial viewport
- calculate default moving averages
- resize canvas using `resizeCanvas`
- build `LayerRenderContext`
- call `renderStaticChart`

Do not import any host app module.

- [ ] **Step 4: Verify static playground**

Run:

```bash
npm run test:e2e -- apps/playground/tests/static-chart.spec.ts
npm run build
npm run guard:engine-boundary
```

Expected:

- Playwright confirms nonblank chart output.
- Build succeeds.
- Boundary guard passes.

- [ ] **Step 5: Commit**

```bash
git add apps/playground packages/chart-engine package.json playwright.config.ts
git commit -m "feat: add static chart playground"
```

## M2: Interaction Engine

### Task 10: Implement Interaction Engine Core

**Files:**

- Create: `packages/chart-engine/src/interaction/interactionEngine.ts`
- Create: `packages/chart-engine/src/interaction/hitTest.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Modify: `packages/chart-engine/src/__tests__/viewport.test.ts`
- Test: `packages/chart-engine/src/__tests__/interaction.test.ts`

- [ ] **Step 1: Write failing interaction unit tests**

Create tests for:

- wheel up zooms in around cursor index
- wheel down zooms out around cursor index
- drag pan changes visible range by candle delta
- reset view returns to latest candles
- pointer move emits crosshair state with candle index, time, price, and OHLCV values
- visible range changes emit a neutral `viewportChanged` event

Validation command:

```bash
npm run test -- packages/chart-engine/src/__tests__/interaction.test.ts
```

Expected before implementation:

- FAIL because interaction modules do not exist.

- [ ] **Step 2: Add hit testing**

Create `hitTest.ts` exporting:

- `hitTestCandleAtX(series: CandleSeries, viewport: ViewportState, x: number, plotLeft: number): { index: number; candle: Candle } | undefined`
- `priceAtY(y: number, priceRange: { min: number; max: number }, plotTop: number, plotHeight: number, scaleMode: PriceScaleMode): number`

Rules:

- clamp candle index to available visible candles
- return `undefined` when outside candle bounds
- use neutral candle data only

- [ ] **Step 3: Add interaction engine**

Create `interactionEngine.ts` exporting:

- `InteractionState`
- `CrosshairState`
- `createInteractionEngine(options)`

`createInteractionEngine` must expose methods:

- `handleWheel(input)`
- `handlePointerDown(input)`
- `handlePointerMove(input)`
- `handlePointerUp(input)`
- `resetView()`
- `getViewport()`
- `getCrosshair()`

The engine must emit neutral events:

- `{ type: "viewportChanged", viewport, visibleRange }`
- `{ type: "crosshairMoved", crosshair }`

- [ ] **Step 4: Add zoom and pan helpers to viewport module**

Extend `viewport.ts` with:

- `zoomViewportAtIndex(viewport: ViewportState, anchorIndex: number, deltaY: number, candleCount: number): ViewportState`
- `panViewportByPixels(viewport: ViewportState, deltaX: number, candleCount: number): ViewportState`
- `resetViewportToLatest(candleCount: number, width: number): ViewportState`

Rules:

- keep candle width within deterministic min and max bounds
- preserve cursor-centered zoom behavior
- clamp pan so the viewport does not scroll past available data

- [ ] **Step 5: Export interaction API**

Update `index.ts` to export interaction modules.

- [ ] **Step 6: Verify interaction core**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/interaction.test.ts
npm run test -- packages/chart-engine/src/__tests__/viewport.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected:

- Interaction tests pass.
- Viewport regression tests pass.
- Typecheck and boundary guard pass.

- [ ] **Step 7: Commit**

```bash
git add packages/chart-engine/src/interaction packages/chart-engine/src/viewport packages/chart-engine/src/index.ts packages/chart-engine/src/__tests__/interaction.test.ts packages/chart-engine/src/__tests__/viewport.test.ts
git commit -m "feat: add neutral chart interaction engine"
```

### Task 11: Add Crosshair and Tooltip Overlay Layers

**Files:**

- Create: `packages/chart-engine/src/render/layers/crosshairLayer.ts`
- Create: `packages/chart-engine/src/render/layers/tooltipLayer.ts`
- Modify: `packages/chart-engine/src/render/renderTypes.ts`
- Modify: `packages/chart-engine/src/render/staticRenderer.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Test: `packages/chart-engine/src/__tests__/overlayLayers.test.ts`

- [ ] **Step 1: Write failing overlay tests**

Create tests with fake canvas context asserting:

- crosshair layer draws vertical and horizontal guide lines when crosshair is visible
- crosshair layer draws nothing when crosshair is absent
- tooltip layer renders time, open, high, low, close, volume, and turnover from the candle under the cursor
- tooltip layer does not require host metadata

Validation command:

```bash
npm run test -- packages/chart-engine/src/__tests__/overlayLayers.test.ts
```

Expected before implementation:

- FAIL because overlay layer modules do not exist.

- [ ] **Step 2: Extend render state for overlay**

Update `renderTypes.ts` so `RenderState` can include optional `crosshair: CrosshairState | undefined`.

Do not make `RenderState` depend on DOM events or host state.

- [ ] **Step 3: Add overlay layer factories**

Create:

- `createCrosshairLayer(): ChartLayer`
- `createTooltipLayer(): ChartLayer`

Rules:

- consume `CrosshairState`
- draw through Canvas 2D API
- use theme colors
- display OHLCV tooltip values from neutral `Candle`
- no TradingReviewSystem labels or business fields

- [ ] **Step 4: Add overlay render entry point**

Update `staticRenderer.ts` to export:

- `createOverlayLayers(): ChartLayer[]`
- `renderOverlay(context: LayerRenderContext, layers?: ChartLayer[]): void`

Overlay order must be:

1. crosshair
2. tooltip

- [ ] **Step 5: Verify overlay layers**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/overlayLayers.test.ts
npm run test
npm run typecheck
npm run guard:engine-boundary
```

Expected:

- Overlay tests pass.
- Full unit test suite passes.
- Typecheck and boundary guard pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/render packages/chart-engine/src/index.ts packages/chart-engine/src/__tests__/overlayLayers.test.ts
git commit -m "feat: render crosshair and tooltip overlays"
```

### Task 12: Wire Playground Interactions and E2E Verification

**Files:**

- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/src/styles.css`
- Create: `apps/playground/tests/interaction.spec.ts`

- [ ] **Step 1: Write failing Playwright interaction tests**

Create `interaction.spec.ts` covering:

- wheel over chart changes visible range
- drag over chart pans the visible range
- mouse move shows crosshair and OHLCV tooltip
- reset button restores latest visible range
- page records neutral `viewportChanged` events on `window.__SIMON_CHART_EVENTS__`

Validation command:

```bash
npm run test:e2e -- apps/playground/tests/interaction.spec.ts
```

Expected before implementation:

- FAIL because playground interaction wiring does not exist.

- [ ] **Step 2: Add neutral event recording for tests**

In `main.ts`, create a test-visible array:

```ts
declare global {
  interface Window {
    __SIMON_CHART_EVENTS__?: unknown[];
  }
}
```

Push only neutral engine events into that array. Do not push host business data.

- [ ] **Step 3: Wire pointer, wheel, and reset interactions**

In `main.ts`:

- instantiate `createInteractionEngine`
- forward canvas `wheel`, `pointerdown`, `pointermove`, and `pointerup` events to engine methods
- call full static render when viewport changes
- call overlay render when crosshair changes
- add a button with `data-testid="reset-view"` that calls `resetView()`

The playground remains a demo harness, not a host app.

- [ ] **Step 4: Add stable test selectors**

Add:

- `data-testid="chart-canvas"`
- `data-testid="reset-view"`
- `data-testid="ohlcv-tooltip"` if tooltip is DOM-backed

If tooltip remains canvas-backed, assert tooltip rendering through nonblank overlay pixels and event payload values.

- [ ] **Step 5: Verify M2 playground interactions**

Run:

```bash
npm run test:e2e -- apps/playground/tests/interaction.spec.ts
npm run test:e2e
npm run build
npm run guard:engine-boundary
```

Expected:

- Playwright confirms zoom, pan, crosshair, tooltip, reset, and neutral event emission.
- Build succeeds.
- Boundary guard passes.

- [ ] **Step 6: Commit**

```bash
git add apps/playground/src apps/playground/tests
git commit -m "feat: wire chart playground interactions"
```

## Final M0-M2 Verification

Run from repository root:

```bash
npm run typecheck
npm run test
npm run guard:engine-boundary
npm run build
npm run test:e2e
```

Expected:

- Type checks pass.
- Unit tests pass.
- Boundary guard passes.
- Playground build passes.
- Playwright static and interaction tests pass.
- No file under `packages/chart-engine` imports from host apps, host stores, host schemas, host routes, or TradingReviewSystem business models.

## Self-Review Checklist

- M0 coverage: neutral chart model types, host adapter interfaces, fixture candle data, boundary guard, and model tests are covered by Tasks 1-4.
- M1 coverage: canvas manager, viewport coordinate mapping, static layers, MA calculation, playground, and screenshot verification are covered by Tasks 5-9.
- M2 coverage: wheel zoom, drag pan, crosshair, tooltip, reset view, and visible range neutral event emission are covered by Tasks 10-12.
- Host decoupling: the plan creates no TradingReviewSystem files and includes an engine boundary guard before renderer and interaction work.
- Deferred scope: TradingReviewSystem `/chart`, symbol search, data fetch/cache, watchlist workspace, review dock, persisted drawings, advanced indicators, worker rendering, and realtime data remain outside this plan.
