# Complete Chart Workspace SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the framework-neutral `@simoncharts/chart-workspace` package with complete data coordination, bounded history, browser persistence, engine runtime, professional dark UI, and full 17/16/63 browser acceptance.

**Architecture:** `createChartWorkspace` is the only composition root. A controller owns product state, a data coordinator owns requests and page consistency, a bounded page store owns history, a runtime adapter owns Canvas/engine lifecycle, and a DOM shell owns all visible controls; none of those layers knows TradingReviewSystem or a market-data vendor.

**Tech Stack:** TypeScript 5.5, DOM APIs, Canvas 2D, bundled `@simoncharts/chart-engine`, Vite 5, Vitest 1.6, Playwright, npm workspaces.

## Global Constraints

- Phase 1 engine-readiness plan and its full gate must pass first.
- Public package name: `@simoncharts/chart-workspace`; initial integration build: `1.0.0-rc.0`; license: `UNLICENSED`.
- Runtime bundle contains engine code and has no runtime dependency or bare import of `@simoncharts/chart-engine`.
- Public root exports only `createChartWorkspace` and the contracts approved in the design specification.
- Market scope, timeframes, adjustment modes, chart types, indicators, drawings, scales, UI layout, browser scope, error model, persistence rules, and performance budgets are exactly those in the approved specification.
- No Shadow DOM, React, Vue, host API, host route, host store, auth, provider SDK, server persistence, WebSocket, or synthetic/filler source-market-data generation in the package. The five approved derived render transforms may operate on validated source candles but never replace, persist, or return derived points as source candles.
- Each page is accepted or rejected atomically; conflicting boundary candles, cursor cycles, stale generations, and mixed `dataVersion` snapshots never enter trusted state.
- Candle payload memory and engine materialization remain bounded while lightweight cursor descriptors retain reloadability.
- All browser state uses versioned `localStorage` namespaces; schema mismatch discards that namespace rather than migrating it.
- All DOM text originating from data uses `textContent`; never insert a symbol name, error message, or drawing text through `innerHTML`.
- `destroy()` is idempotent and removes DOM, listeners, observers, timers, animation frames, and pending requests.
- Every task begins with a failing test, ends with focused verification, and creates one commit.

---

## File Structure

### Package

```text
packages/chart-workspace/
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── api-surface.json
├── api-types.json
└── src/
    ├── index.ts
    ├── contracts.ts
    ├── errors.ts
    ├── createChartWorkspace.ts
    ├── controller/chartWorkspaceController.ts
    ├── data/seriesPageValidation.ts
    ├── data/pagedSeriesStore.ts
    ├── data/dataCoordinator.ts
    ├── data/symbolSearchCoordinator.ts
    ├── data/materializedSeries.ts
    ├── data/calculationCheckpointStore.ts
    ├── persistence/browserPersistence.ts
    ├── runtime/chartEngineRuntime.ts
    ├── runtime/indicatorRuntime.ts
    ├── runtime/checkpointedCalculationRuntime.ts
    ├── runtime/shanghaiTimeFormatter.ts
    ├── runtime/workspaceTheme.ts
    ├── ui/workspaceShell.ts
    ├── ui/topToolbar.ts
    ├── ui/symbolSearch.ts
    ├── ui/indicatorManager.ts
    ├── ui/drawingPalette.ts
    ├── ui/bottomPanel.ts
    ├── ui/propertyEditor.ts
    ├── ui/dataWindow.ts
    ├── ui/errorPanel.ts
    ├── styles.css
    └── __tests__/
        ├── publicContract.test.ts
        ├── seriesPageValidation.test.ts
        ├── pagedSeriesStore.test.ts
        ├── dataCoordinator.test.ts
        ├── symbolSearchCoordinator.test.ts
        ├── materializedSeries.test.ts
        ├── checkpointedCalculationRuntime.test.ts
        ├── browserPersistence.test.ts
        ├── shanghaiTimeFormatter.test.ts
        ├── chartWorkspaceController.test.ts
        ├── capabilityMatrix.test.ts
        └── performanceAcceptance.test.ts
```

### Browser Acceptance App

```text
apps/workspace-playground/
├── index.html
├── package.json
├── tsconfig.json
├── src/main.ts
├── src/styles.css
├── src/fixtures/createFixtureDataSource.ts
└── tests/
    ├── workspace-layout.spec.ts
    ├── workspace-data.spec.ts
    ├── workspace-capabilities.spec.ts
    ├── workspace-drawing.spec.ts
    ├── workspace-persistence-errors.spec.ts
    ├── workspace-lifecycle.spec.ts
    └── workspace-performance.spec.ts
```

## Task 1: Package Scaffold And Approved Public Contracts

**Files:**
- Create: `packages/chart-workspace/package.json`
- Create: `packages/chart-workspace/README.md`
- Create: `packages/chart-workspace/tsconfig.json`
- Create: `packages/chart-workspace/vite.config.ts`
- Create: `packages/chart-workspace/src/contracts.ts`
- Create: `packages/chart-workspace/src/errors.ts`
- Create: `packages/chart-workspace/src/index.ts`
- Create: `packages/chart-workspace/src/styles.css`
- Create: `packages/chart-workspace/src/__tests__/publicContract.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: every public type in specification §5 and structured error helpers.
- Consumed by: every later workspace task and the TradingReviewSystem adapter.

- [ ] **Step 1: Write the failing compile/runtime contract test**

Create `publicContract.test.ts`:

```ts
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  ChartWorkspace,
  ChartWorkspaceDataSource,
  ChartWorkspaceError,
  ChartWorkspaceOptions,
  SeriesPage,
  SeriesRequest
} from "../index";

describe("workspace public contract", () => {
  it("keeps the approved data source signatures", () => {
    expectTypeOf<ChartWorkspaceDataSource["searchSymbols"]>().toEqualTypeOf<(
      query: string,
      signal: AbortSignal
    ) => Promise<readonly import("../index").ChartSymbol[]>>();
    expectTypeOf<ChartWorkspaceDataSource["loadSeries"]>().toEqualTypeOf<(
      request: SeriesRequest,
      signal: AbortSignal
    ) => Promise<SeriesPage>>();
  });

  it("keeps the approved workspace handle", () => {
    expectTypeOf<ChartWorkspace>().toHaveProperty("getState");
    expectTypeOf<ChartWorkspace>().toHaveProperty("setSymbol");
    expectTypeOf<ChartWorkspace>().toHaveProperty("setTimeframe");
    expectTypeOf<ChartWorkspace>().toHaveProperty("setAdjustMode");
    expectTypeOf<ChartWorkspace>().toHaveProperty("retry");
    expectTypeOf<ChartWorkspace>().toHaveProperty("destroy");
    expectTypeOf<ChartWorkspaceOptions>().toHaveProperty("workspaceId");
    expectTypeOf<ChartWorkspaceError>().toHaveProperty("recoverable");
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify the package is absent**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/publicContract.test.ts
```

Expected: FAIL because `packages/chart-workspace` does not exist.

- [ ] **Step 3: Create package/build metadata**

Use this `package.json`:

```json
{
  "name": "@simoncharts/chart-workspace",
  "version": "1.0.0-rc.0",
  "private": true,
  "description": "Complete commercial browser chart workspace for SimonCharts partners.",
  "license": "UNLICENSED",
  "type": "module",
  "sideEffects": ["./dist/styles.css"],
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "vite build && tsc -b --force",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "@simoncharts/chart-engine": "1.0.0-rc.1"
  }
}
```

Use the engine composite config pattern in `tsconfig.json`, with `rootDir: "src"`, `declarationDir: "dist"`, tests excluded, and a project reference to `../chart-engine`. Configure Vite ES library output from `src/index.ts`; do not externalize engine. Set Rollup `assetFileNames` to return `styles.css` for the CSS asset. Add `import "./styles.css";` to `src/index.ts`, and create a real initial stylesheet so Task 1 proves the declared CSS export exists:

```css
.sc-workspace {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
}

.sc-workspace *,
.sc-workspace *::before,
.sc-workspace *::after {
  box-sizing: inherit;
}
```

Create an RC `README.md` that identifies the private `UNLICENSED` package, shows local `.tgz` installation, root/CSS imports, the two required data-source methods, mount, and `destroy()`. It must not mention registry publication, engine imports, provider credentials, or internal paths; Commercial Release Task 9 expands this same file.

- [ ] **Step 4: Define every public type exactly once**

Put the specification types in `contracts.ts`, including these exact value unions:

```ts
export type SymbolKind = "stock" | "index";
export type Exchange = "SSE" | "SZSE" | "BSE";
export type Timeframe = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1w" | "1mo";
export type AdjustMode = "none" | "forward" | "backward";

export interface ChartSymbol {
  id: string;
  code: string;
  name: string;
  exchange: Exchange;
  kind: SymbolKind;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

export interface SeriesRequest {
  symbol: ChartSymbol;
  timeframe: Timeframe;
  adjustMode: AdjustMode;
  beforeCursor?: string;
}

export interface SeriesPage {
  candles: readonly Candle[];
  beforeCursor?: string;
  hasMoreBefore: boolean;
  dataVersion: string;
}
```

Define the exact `ChartWorkspaceDataSource`, `ChartWorkspaceOptions`, `ChartWorkspaceState`, and `ChartWorkspace` signatures from specification §5. Define the approved error-code and scope unions in `errors.ts`; expose `createWorkspaceError(code, scope, recoverable, message, context?)` that copies context into a frozen plain object.

`index.ts` must export only public contracts/error types at this stage; no engine type may cross the root entry.

- [ ] **Step 5: Wire root scripts and lockfile**

Change root scripts so engine builds before workspace and typecheck includes both packages:

```json
{
  "typecheck": "tsc -b packages/chart-engine packages/chart-workspace apps/playground",
  "build": "npm run build -w @simoncharts/chart-engine && npm run build -w @simoncharts/chart-workspace && npm run build -w @simoncharts/playground"
}
```

Run:

```bash
npm install --package-lock-only
npm run test -- packages/chart-workspace/src/__tests__/publicContract.test.ts
npm run typecheck -w @simoncharts/chart-workspace
npm run build -w @simoncharts/chart-workspace
```

Expected: PASS; `dist/index.js` contains no browser-global access at module import time.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json packages/chart-workspace
git commit -m "feat(workspace): establish public package contract"
```

## Task 2: Atomic Series Page Validation

**Files:**
- Create: `packages/chart-workspace/src/data/seriesPageValidation.ts`
- Create: `packages/chart-workspace/src/__tests__/seriesPageValidation.test.ts`

**Interfaces:**
- Consumes: `Candle`, `SeriesPage`.
- Produces: `validateSeriesPage(page, context): SeriesPageValidationResult` and immutable `ValidatedSeriesPage`.

- [ ] **Step 1: Write failing valid/invalid page tests**

Cover valid data, NaN/Infinity, non-positive OHLC, invalid OHLC bounds, negative volume/turnover, page-local duplicate, descending time, cursor cycle, and no earlier data:

```ts
const context = {
  requestCursor: "cursor-2",
  seenCursors: new Set(["cursor-1", "cursor-2"]),
  currentEarliestTime: 200
};

expect(validateSeriesPage(validPage, context)).toMatchObject({ ok: true });
expect(validateSeriesPage({ ...validPage, beforeCursor: "cursor-1" }, context)).toMatchObject({
  ok: false,
  code: "CURSOR_NOT_ADVANCING"
});
expect(validateSeriesPage({ ...validPage, candles: [invalidCandle] }, context)).toMatchObject({
  ok: false,
  code: "INVALID_CANDLE"
});
```

- [ ] **Step 2: Run and verify the validator is missing**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/seriesPageValidation.test.ts
```

Expected: FAIL because `validateSeriesPage` is not defined.

- [ ] **Step 3: Implement an atomic result contract**

Use:

```ts
export type SeriesPageValidationCode =
  | "EMPTY_DATA_VERSION"
  | "INVALID_CANDLE"
  | "DUPLICATE_TIME"
  | "NON_INCREASING_TIME"
  | "MISSING_CURSOR"
  | "CURSOR_NOT_ADVANCING"
  | "PAGE_NOT_EARLIER";

export type SeriesPageValidationResult =
  | { ok: true; page: ValidatedSeriesPage }
  | { ok: false; code: SeriesPageValidationCode; message: string; invalidIndex?: number };
```

Validation order is deterministic: `dataVersion`, candle fields, page-local uniqueness/order, `hasMoreBefore` cursor, cursor cycle, earlier-page progress. Clone and freeze every accepted candle and the page array. Never drop a bad row or rewrite a value.

- [ ] **Step 4: Run focused validation tests**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/seriesPageValidation.test.ts
```

Expected: PASS; each invalid page returns one stable code and zero accepted candles.

- [ ] **Step 5: Commit**

```bash
git add packages/chart-workspace/src/data/seriesPageValidation.ts packages/chart-workspace/src/__tests__/seriesPageValidation.test.ts
git commit -m "feat(workspace): validate series pages atomically"
```

## Task 3: Cursor Descriptor Store And Bounded Candle LRU

**Files:**
- Create: `packages/chart-workspace/src/data/pagedSeriesStore.ts`
- Create: `packages/chart-workspace/src/__tests__/pagedSeriesStore.test.ts`

**Interfaces:**
- Consumes: `ValidatedSeriesPage`, `SeriesSelection`.
- Produces: `PagedSeriesStore`, `PageDescriptor`, `SeriesStoreSnapshot`, cache diagnostics.

- [ ] **Step 1: Write failing merge, conflict, and eviction tests**

Assert these behaviors:

```ts
const store = createPagedSeriesStore({ maxPages: 2, maxEstimatedBytes: 512 });
store.reset(selection, "v1");
expect(store.mergePage(undefined, firstPage).ok).toBe(true);
expect(store.mergePage("cursor-1", olderPage).ok).toBe(true);
expect(store.mergePage("cursor-2", conflictingBoundaryPage)).toMatchObject({
  ok: false,
  code: "CONFLICTING_BOUNDARY_CANDLE"
});

store.mergePage("cursor-2", oldestPage);
expect(store.getDiagnostics().cachedPageCount).toBeLessThanOrEqual(2);
expect(store.listDescriptors()).toHaveLength(3);
expect(store.listDescriptors().some((descriptor) => descriptor.candles === undefined)).toBe(true);
expect(store.getReloadCursorForTime(oldestPage.candles[0].time)).toBe("cursor-2");
```

- [ ] **Step 2: Run and verify the store is missing**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/pagedSeriesStore.test.ts
```

Expected: FAIL because the page store does not exist.

- [ ] **Step 3: Define the descriptor and store API**

Use this descriptor:

```ts
export interface PageDescriptor {
  requestCursor?: string;
  beforeCursor?: string;
  hasMoreBefore: boolean;
  dataVersion: string;
  minTime: number;
  maxTime: number;
  candleCount: number;
  candles?: readonly Candle[];
  lastAccess: number;
  estimatedBytes: number;
}
```

Expose:

```ts
export interface PagedSeriesStore {
  reset(selection: SeriesSelection, dataVersion: string): void;
  mergePage(requestCursor: string | undefined, page: ValidatedSeriesPage): PageMergeResult;
  getNextBeforeCursor(): string | undefined;
  getDescriptorForCursor(requestCursor: string | undefined): PageDescriptor | undefined;
  getReloadCursorForTime(time: number): string | undefined;
  listDescriptors(): readonly PageDescriptor[];
  touch(requestCursor: string | undefined): void;
  getSnapshot(): SeriesStoreSnapshot;
  getDiagnostics(): SeriesStoreDiagnostics;
  clear(): void;
}
```

- [ ] **Step 4: Implement atomic merge and payload-only eviction**

Use deterministic limits in the production factory:

```ts
export const defaultMaxCachedPages = 128;
export const defaultMaxEstimatedBytes = 64 * 1024 * 1024;
const estimatedBytesPerCandle = 64;
```

Before committing a page, compare a duplicate boundary timestamp field-by-field (`time`, OHLC, volume, turnover); identical data is deduplicated, conflicting data rejects the whole new page. LRU eviction sets `descriptor.candles = undefined` and `estimatedBytes = 0` but never removes request cursor, next cursor, times, count, or version. Pin the currently touched descriptor during one eviction pass.

- [ ] **Step 5: Run focused store tests**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/pagedSeriesStore.test.ts
```

Expected: PASS; accepted pages remain ordered newest-to-oldest by descriptor chain, conflicts do not mutate state, and cache diagnostics stay under both limits.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/data/pagedSeriesStore.ts packages/chart-workspace/src/__tests__/pagedSeriesStore.test.ts
git commit -m "feat(workspace): add bounded paged series store"
```

## Task 4: Generation-Safe Data And Symbol Search Coordinators

**Files:**
- Create: `packages/chart-workspace/src/data/dataCoordinator.ts`
- Create: `packages/chart-workspace/src/data/symbolSearchCoordinator.ts`
- Create: `packages/chart-workspace/src/__tests__/dataCoordinator.test.ts`
- Create: `packages/chart-workspace/src/__tests__/symbolSearchCoordinator.test.ts`

**Interfaces:**
- Consumes: public data source, validator, page store.
- Produces: `DataCoordinator`, `SymbolSearchCoordinator`, and typed internal events only.

- [ ] **Step 1: Write failing stale-response and abort tests**

Use deferred promises to prove that generation 1 cannot overwrite generation 2:

```ts
const first = deferred<SeriesPage>();
const second = deferred<SeriesPage>();
const dataSource = createQueuedDataSource([first.promise, second.promise]);
const events: DataCoordinatorEvent[] = [];
const coordinator = createDataCoordinator({ dataSource, store, onEvent: (event) => events.push(event) });

void coordinator.start(stockSelection);
void coordinator.start(indexSelection);
first.resolve(stockPage);
second.resolve(indexPage);
await Promise.allSettled([first.promise, second.promise]);

expect(dataSource.signals[0].aborted).toBe(true);
expect(events.filter((event) => event.type === "initialPageAccepted")).toHaveLength(1);
expect(store.getSnapshot().selection?.symbol.id).toBe(indexSelection.symbol.id);
```

Also test `AbortError` emits nothing, initial failure emits `initialRequestFailed`, history failure emits `historyRequestFailed`, and a changed `dataVersion` emits `snapshotRefreshing` then restarts without mixing pages.

- [ ] **Step 2: Run and verify coordinator APIs are absent**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/dataCoordinator.test.ts packages/chart-workspace/src/__tests__/symbolSearchCoordinator.test.ts
```

Expected: FAIL because the coordinators do not exist.

- [ ] **Step 3: Define exact coordinator events and ownership**

Use:

```ts
export type DataCoordinatorEvent =
  | { type: "loadingInitial"; selection: SeriesSelection; generation: number }
  | { type: "initialPageAccepted"; selection: SeriesSelection; generation: number }
  | { type: "historyPageAccepted"; selection: SeriesSelection; generation: number }
  | { type: "snapshotRefreshing"; selection: SeriesSelection; generation: number }
  | { type: "pageRejected"; phase: "initial" | "history"; code: string; message: string }
  | { type: "initialRequestFailed"; error: unknown }
  | { type: "historyRequestFailed"; cursor: string; error: unknown };

export interface DataCoordinator {
  start(selection: SeriesSelection): Promise<void>;
  loadMoreBefore(): Promise<void>;
  reloadPage(requestCursor?: string): Promise<void>;
  retryInitial(): Promise<void>;
  getGeneration(): number;
  destroy(): void;
}
```

The coordinator exclusively owns generation, `AbortController`, pending cursor set, validation, version restart, and store writes.

- [ ] **Step 4: Implement current-generation commit guards**

Every request captures:

```ts
const requestGeneration = generation;
const controller = new AbortController();
activeControllers.add(controller);
```

Before validation and before event/store commit, require:

```ts
if (destroyed || requestGeneration !== generation || controller.signal.aborted) {
  return;
}
```

On a version mismatch, increment generation, abort remaining requests, emit `snapshotRefreshing`, and issue a new no-cursor request for the same selection without clearing the trusted store or runtime frame. Validate the replacement page first; only then synchronously `reset`/merge the store and emit `initialPageAccepted` so the controller swaps the materialized frame atomically. If replacement fails, retain the old store/frame and emit a nonblocking refresh warning. Treat `AbortError` and stale responses as silent control flow.

Add a regression where a history page changes `dataVersion`, the replacement initial request fails, and the previously trusted candle times remain rendered with `readyWithWarning`; no empty frame or mixed-version store snapshot is observable.

Implement symbol search with an independent monotonically increasing search generation and one active `AbortController`; clone results and require unique nonempty ids/codes/names, kind in `stock/index`, and exchange in `SSE/SZSE/BSE`. Any malformed or duplicate result rejects that search response as `SYMBOL_SEARCH_FAILED`; it never mutates the current chart selection.

- [ ] **Step 5: Run focused coordinator tests**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/dataCoordinator.test.ts packages/chart-workspace/src/__tests__/symbolSearchCoordinator.test.ts
```

Expected: PASS; stale/aborted work emits no user error and never mutates trusted state.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/data/dataCoordinator.ts packages/chart-workspace/src/data/symbolSearchCoordinator.ts packages/chart-workspace/src/__tests__/dataCoordinator.test.ts packages/chart-workspace/src/__tests__/symbolSearchCoordinator.test.ts
git commit -m "feat(workspace): coordinate cancellable market data"
```

## Task 5: Bounded Windows And Exact Checkpointed Calculations

**Files:**
- Create: `packages/chart-workspace/src/data/materializedSeries.ts`
- Create: `packages/chart-workspace/src/data/calculationCheckpointStore.ts`
- Create: `packages/chart-workspace/src/runtime/checkpointedCalculationRuntime.ts`
- Create: `packages/chart-workspace/src/runtime/indicatorRuntime.ts`
- Create: `packages/chart-workspace/src/__tests__/materializedSeries.test.ts`
- Create: `packages/chart-workspace/src/__tests__/checkpointedCalculationRuntime.test.ts`

**Interfaces:**
- Consumes: page descriptors/payloads plus Phase 1 indicator/series chunk APIs.
- Produces: bounded raw windows, a bounded checkpoint LRU, and exact visible indicator/synthetic-series output relative to the complete currently known descriptor chain.

Internal calculation status is:

```ts
export type CalculationStatus =
  | { type: "idle" }
  | { type: "calculating"; kind: "indicator" | "series"; id: string; generation: number };
```

- [ ] **Step 1: Write failing bounded-window and full-equivalence tests**

Build 50 pages of deterministic candles, retain the concatenated full-series reference, and force candle/checkpoint eviction. Assert the raw window remains bounded and never invents data:

```ts
const materialized = materializeSeriesAroundTime({
  store,
  selection,
  anchorTime: 50_000,
  visibleCount: 300,
  overscanCount: 100
});
expect(materialized.series.candles.length).toBeLessThanOrEqual(500);
expect(materialized.series.candles.some((candle) => candle.time === 50_000)).toBe(true);
expect(materialized.missingRequestCursors).toEqual([]);
```

For all 16 indicators and five stateful chart types, compare the target visible output after page eviction/reload with the engine's full-series output:

```ts
expectIndicatorResultsToEqual(windowed.indicators.get(id), sliceIndicatorResult(fullIndicator, targetTimes));
expect(resolveSourceTimes(windowed.seriesModel)).toEqual(resolveSourceTimes(fullSeriesModel, targetTimes));
const checkpointDiagnostics = checkpointStore.getDiagnostics();
expect(checkpointDiagnostics.entryCount).toBeLessThanOrEqual(2048);
expect(checkpointDiagnostics.estimatedBytes).toBeLessThanOrEqual(4 * 1024 * 1024);
```

- [ ] **Step 2: Run and verify exact calculation infrastructure is absent**

```bash
npm run test -- packages/chart-workspace/src/__tests__/materializedSeries.test.ts packages/chart-workspace/src/__tests__/checkpointedCalculationRuntime.test.ts
```

Expected: FAIL because the materializer, checkpoint store, and calculation runtime do not exist.

- [ ] **Step 3: Define bounded raw-window and checkpoint contracts**

```ts
export interface MaterializedSeries {
  series: CandleSeries;
  sourceIndexOffset: number;
  anchorTime?: number;
  sourceMinTime?: number;
  sourceMaxTime?: number;
  hasMoreBefore: boolean;
  hasKnownNewerPages: boolean;
  missingRequestCursors: Array<string | undefined>;
}

export interface CalculationCheckpointStore {
  get(key: CalculationCheckpointKey): CalculationCheckpoint | undefined;
  set(key: CalculationCheckpointKey, value: CalculationCheckpoint): void;
  invalidateAfter(selectionKey: string, descriptorCursor?: string): void;
  invalidateConfiguration(kind: "indicator" | "series", id: string): void;
  getDiagnostics(): { entryCount: number; estimatedBytes: number };
  clear(): void;
}
```

Production limits are fixed internal constants `2048` entries and `4 MiB`; tests may inject smaller limits. Keys contain selection, `dataVersion`, calculation kind/id, canonical sorted-JSON params hash, and descriptor request cursor. Values contain only engine checkpoints—never candles, outputs, credentials, or provider data—and are never written to localStorage.

- [ ] **Step 4: Stream pages chronologically and publish atomically**

`CheckpointedCalculationRuntime` walks descriptors oldest-to-target. It resumes from the nearest valid predecessor checkpoint; if a required payload/checkpoint was evicted, it calls the coordinator's exact `reloadPage(requestCursor)` and processes one page at a time. Only one page payload plus the target raw/output window is retained by the calculation. It feeds engine `calculateCoreIndicatorChunk` and `transformSeriesChunk`, stores page-boundary checkpoints, discards intermediate outputs, and publishes indicator results/`SeriesRenderModel` only after the entire target result is ready.

When an older descriptor is inserted, invalidate its downstream checkpoints because the chronological seed changed. Selection, `dataVersion`, indicator params, or synthetic-series options invalidate the matching key space. During recomputation, retain the previous trusted chart; a newly selected indicator shows `计算中`, and a newly selected stateful chart type becomes active only after its exact model is ready. Abort/stale generation results publish nothing. Never use finite `*10` warmup guesses or approximate OBV/SAR/EMA values.

Finite-lookback indicators may start from their exact dependency boundary; stateful indicator/series calculations must start from a valid predecessor checkpoint or the oldest currently known descriptor. `SeriesRenderModel.sourceIndexOffset` keeps global `sourceIndex/sourceRange` traceable while the model's raw source slice remains bounded.

- [ ] **Step 5: Run eviction, insertion, abort, and equivalence tests**

```bash
npm run test -- packages/chart-workspace/src/__tests__/materializedSeries.test.ts packages/chart-workspace/src/__tests__/checkpointedCalculationRuntime.test.ts
```

Expected: PASS; every visible result matches full calculation within the engine's floating comparison tolerance, adding an older page cannot cause a partial/reset output, checkpoint/candle bytes stay within limits, and reloaded candles come only from the data source.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/data/materializedSeries.ts packages/chart-workspace/src/data/calculationCheckpointStore.ts packages/chart-workspace/src/runtime/checkpointedCalculationRuntime.ts packages/chart-workspace/src/runtime/indicatorRuntime.ts packages/chart-workspace/src/__tests__/materializedSeries.test.ts packages/chart-workspace/src/__tests__/checkpointedCalculationRuntime.test.ts
git commit -m "feat(workspace): checkpoint exact bounded calculations"
```

## Task 6: Versioned Browser Persistence With Exact Namespaces

**Files:**
- Create: `packages/chart-workspace/src/persistence/browserPersistence.ts`
- Create: `packages/chart-workspace/src/__tests__/browserPersistence.test.ts`

**Interfaces:**
- Consumes: workspace id, selection, indicator configs, serialized drawing objects.
- Produces: `BrowserPersistence` with layout/preferences/indicators/drawings read/write methods.

- [ ] **Step 1: Write failing namespace and corruption tests**

Use an in-memory `Storage` implementation and assert:

```ts
const persistence = createBrowserPersistence("trs", storage, onError);
persistence.saveDrawings(stock, "forward", drawings);
expect(persistence.loadDrawings(stock, "forward")).toEqual(drawings);
expect(persistence.loadDrawings(stock, "backward")).toEqual([]);
expect(persistence.loadDrawings({ ...stock, id: "stock:SZSE:000001" }, "forward")).toEqual([]);

storage.setItem("simoncharts:workspace:v1:trs:layout", "{bad-json");
expect(persistence.loadLayout()).toEqual(defaultLayoutState);
expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "STORAGE_READ_FAILED" }));
expect([...storage.values()].join(" ")).not.toContain("candles");
```

- [ ] **Step 2: Run and verify persistence is absent**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/browserPersistence.test.ts
```

Expected: FAIL because `createBrowserPersistence` does not exist.

- [ ] **Step 3: Implement exact key construction**

Use:

```ts
const schemaVersion = 1;
const prefix = `simoncharts:workspace:v${schemaVersion}:${encodeURIComponent(workspaceId)}`;
const layoutKey = `${prefix}:layout`;
const preferencesKey = `${prefix}:preferences`;
const indicatorsKey = `${prefix}:indicators`;
const drawingKey = (symbolId: string, adjustMode: AdjustMode) =>
  `${prefix}:drawings:${encodeURIComponent(symbolId)}:${adjustMode}`;
```

Do not include timeframe in `drawingKey`. Index callers always pass `none`.

- [ ] **Step 4: Implement validate-or-discard reads and safe writes**

Every value has the envelope `{ schemaVersion: 1, value: persistedValue }`. A JSON error, wrong schema, wrong shape, or drawing deserialization error removes only that key, returns defaults, and calls `onError(createWorkspaceError("STORAGE_READ_FAILED", "storage", true, "Stored workspace state is invalid"))`. `QuotaExceededError` and other write failures call `STORAGE_WRITE_FAILED` without the raw storage key and leave runtime state unchanged. There is no migration branch; storage error context never exposes workspace keys.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/browserPersistence.test.ts
```

Expected: PASS; drawings share across timeframes but not symbols/adjustments, and no key/value contains candle history or credentials.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/persistence/browserPersistence.ts packages/chart-workspace/src/__tests__/browserPersistence.test.ts
git commit -m "feat(workspace): persist browser workspace state"
```

## Task 7: Single Engine Runtime Adapter And Deterministic Destroy

**Files:**
- Create: `packages/chart-workspace/src/runtime/chartEngineRuntime.ts`
- Create: `packages/chart-workspace/src/runtime/shanghaiTimeFormatter.ts`
- Create: `packages/chart-workspace/src/runtime/workspaceTheme.ts`
- Create: `packages/chart-workspace/src/__tests__/shanghaiTimeFormatter.test.ts`
- Create: `packages/chart-workspace/src/__tests__/performanceAcceptance.test.ts`

**Interfaces:**
- Consumes: static/overlay canvases, materialized series, indicator configs, drawing snapshots.
- Produces: `ChartEngineRuntime` and runtime callbacks for viewport boundary, crosshair, drawings, render errors, and metrics.

- [ ] **Step 1: Write a failing runtime type/lifecycle test**

Use a canvas/observer test harness that records cleanup functions and assert:

```ts
const runtime = createChartEngineRuntime(options);
runtime.setMaterializedSeries(materialized);
runtime.setSeriesType("candles");
runtime.setPriceScaleMode("percentage");
runtime.setIndicators([{ id: "MA", params: { period: 5 }, visible: true }]);
runtime.destroy();
runtime.destroy();

expect(options.observer.disconnect).toHaveBeenCalledTimes(1);
expect(options.cancelFrame).toHaveBeenCalled();
expect(options.staticCanvas.listenerCount()).toBe(0);
expect(options.overlayCanvas.listenerCount()).toBe(0);

expect(formatShanghaiTime(Date.UTC(2026, 5, 5, 1, 30), "1m")).toBe("2026-06-05 09:30");
expect(formatShanghaiTime(Date.UTC(2026, 5, 5, 1, 30), "1d")).toBe("2026-06-05");

const theme = readWorkspaceChartTheme(themeRoot, fakeComputedStyle({
  "--sc-bg": "#08090d",
  "--sc-up": "#f04455",
  "--sc-down": "#00aa91"
}));
expect(theme.colors.background).toBe("#08090d");
expect(theme.colors.bullishCandle).toBe("#f04455");
expect(theme.colors.bearishCandle).toBe("#00aa91");
```

- [ ] **Step 2: Run and verify the runtime is absent**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/performanceAcceptance.test.ts
npm run test -- packages/chart-workspace/src/__tests__/shanghaiTimeFormatter.test.ts
```

Expected: FAIL because the runtime adapter does not exist.

- [ ] **Step 3: Define the only runtime interface**

Use:

```ts
export interface ChartEngineRuntime {
  setMaterializedSeries(input: MaterializedSeries, anchorTime?: number): void;
  setSeriesType(type: SeriesType): void;
  setIndicators(configs: readonly IndicatorConfig[]): void;
  setPriceScaleMode(mode: PriceScaleMode): void;
  setDrawings(drawings: readonly DrawingObject[]): void;
  setDrawingTool(tool: DrawingEditorTool): void;
  executeDrawingCommand(command: DrawingEditorCommand): void;
  undoDrawing(): void;
  redoDrawing(): void;
  setGridVisible(visible: boolean): void;
  retryRender(): void;
  getMetrics(): WorkspaceRuntimeMetrics;
  destroy(): void;
}

export interface WorkspaceRuntimeMetrics extends RenderMetrics {
  maxMaterializedCandleCount: number;
}

export interface DataWindowIndicatorRow {
  id: string;
  label: string;
  value: string;
}

export interface DataWindowSnapshot {
  crosshair: ChartCrosshairState;
  candle: Readonly<Candle>;
  formattedTime: string;
  change: number;
  changePercent: number;
  indicatorRows: readonly DataWindowIndicatorRow[];
}
```

Callbacks are `onViewportChanged`, `onHistoryBoundary`, `onCalculationStatusChanged(CalculationStatus)`, `onDataWindowChanged(DataWindowSnapshot | undefined)`, `onDrawingsChanged`, `onDrawingHistoryChanged({ canUndo, canRedo })`, and `onRenderError`.

Implement `formatShanghaiTime()` with `Intl.DateTimeFormat(...).formatToParts()` and the fixed `Asia/Shanghai` timezone. Intraday timeframes (`1m/5m/15m/30m/60m`) return `YYYY-MM-DD HH:mm`; daily/weekly/monthly return `YYYY-MM-DD`. It receives only validated epoch milliseconds.

- [ ] **Step 4: Extract orchestration, not UI, from the engine playground**

Instantiate one `ChartEngine`, `InteractionEngine`, `InteractionSession`, `DrawingEditor`, and `RenderScheduler`, and consume the Task 5 `CheckpointedCalculationRuntime` as a dependency. Resize two canvases with one `ResizeObserver`. Static/dynamic passes render source/derived series, checkpointed indicator outputs, and drawings to the static canvas; overlay pass clears/renders only crosshair and tooltip. Pointer/wheel/keyboard handlers route chart actions to engine/interaction and drawing actions to the editor.

`setIndicators()` and stateful `setSeriesType()` request checkpointed calculation; they never call the full-series calculator on the bounded raw window. On completion, pass the exact indicator outputs and optional precomputed `SeriesRenderModel` into render state atomically. Stale calculation generations are ignored and the previous trusted render stays visible until replacement output is ready.

At each static pass, call `readWorkspaceChartTheme(themeRoot)` once, using computed CSS variables with the approved fallbacks. Pass a dark A-share `ChartTheme` to every renderer: background `--sc-bg/#08090d`, grid `--sc-grid`, text `--sc-text`, bullish `--sc-up/#f04455`, bearish `--sc-down/#00aa91`, selection `--sc-accent/#6266f1`, and `lineDashes.grid: [1, 3]`. Initialize engine settings to `themeMode: "dark"` and `candleColorScheme: "aShare"`; CSS is not a substitute for Canvas theme wiring. Pass `formatShanghaiTime` as the engine render-state time formatter.

When the crosshair changes, read the source candle and existing calculated visual outputs, build one `DataWindowSnapshot`, and emit it. Do not call an indicator calculator from the crosshair path. `undoDrawing()`/`redoDrawing()` delegate to the editor methods and emit history enabled state; `setGridVisible()` dispatches `toggleGrid` only when the desired value differs from engine state.

On `setMaterializedSeries`, preserve the candle under the previous viewport anchor time:

```ts
const anchorIndex = next.series.candles.findIndex((candle) => candle.time === anchorTime);
const nextViewport = anchorIndex >= 0
  ? reanchorViewport(previousViewport, anchorIndex, next.series.candles.length)
  : resetViewportToLatest(next.series.candles.length, layout.plotArea.width);
```

Project domain drawings before render and unproject editor results before `onDrawingsChanged`. Recreate projection whenever series, viewport, layout, or price scale changes.

- [ ] **Step 5: Prove overlay invalidation stays isolated**

Move the crosshair 100 times in the runtime harness, flush frames, and assert:

```ts
expect(runtime.getMetrics().renderCountByPass.static).toBe(staticCountBefore);
expect(runtime.getMetrics().renderCountByPass.overlay).toBeGreaterThan(overlayCountBefore);
```

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/performanceAcceptance.test.ts
npm run test -- packages/chart-workspace/src/__tests__/shanghaiTimeFormatter.test.ts
```

Expected: PASS; duplicate destroy is harmless and crosshair never increments the static pass count.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/runtime/chartEngineRuntime.ts packages/chart-workspace/src/runtime/shanghaiTimeFormatter.ts packages/chart-workspace/src/runtime/workspaceTheme.ts packages/chart-workspace/src/__tests__/shanghaiTimeFormatter.test.ts packages/chart-workspace/src/__tests__/performanceAcceptance.test.ts
git commit -m "feat(workspace): compose the chart engine runtime"
```

## Task 8: Controller State, Adjustment Normalization, Errors, And Retry

**Files:**
- Create: `packages/chart-workspace/src/controller/chartWorkspaceController.ts`
- Create: `packages/chart-workspace/src/__tests__/chartWorkspaceController.test.ts`

**Interfaces:**
- Consumes: coordinators, store/materializer, persistence, runtime.
- Produces: `ChartWorkspaceController`, `WorkspaceViewModel`, `WorkspaceUiActions`.

- [ ] **Step 1: Write failing controller behavior tests**

Assert:

```ts
const controller = createChartWorkspaceController(dependencies);
controller.setAdjustMode("backward");
expect(dataCoordinator.start).toHaveBeenCalledWith(expect.objectContaining({ adjustMode: "backward" }));

controller.setSymbol(indexSymbol);
expect(controller.getState().adjustMode).toBe("none");
expect(dataCoordinator.start).toHaveBeenLastCalledWith(expect.objectContaining({
  symbol: indexSymbol,
  adjustMode: "none"
}));

dataCoordinator.start.mockClear();
controller.setAdjustMode("forward");
expect(controller.getState().adjustMode).toBe("none");
expect(dataCoordinator.start).not.toHaveBeenCalled();

controller.retry();
expect(dataCoordinator.retryInitial).not.toHaveBeenCalled();
expect(runtime.retryRender).not.toHaveBeenCalled();

dependencies.emitDataEvent({ type: "initialRequestFailed", error: new Error("offline") });
controller.retry();
expect(dataCoordinator.retryInitial).toHaveBeenCalledTimes(1);

dependencies.emitRenderError(new Error("canvas failed"));
controller.retry();
expect(runtime.retryRender).toHaveBeenCalledTimes(1);
controller.destroy();
controller.destroy();
expect(runtime.destroy).toHaveBeenCalledTimes(1);
```

Test that search/history/storage errors are nonblocking, initial-data/render errors are blocking, `AbortError` is ignored, and safe `context` never includes an arbitrary provider error body.

- [ ] **Step 2: Run and verify the controller is absent**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/chartWorkspaceController.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Define controller/view-model contracts**

Use a discriminated status:

```ts
export type WorkspaceStatus =
  | { type: "loading" }
  | { type: "ready" }
  | { type: "blocked"; error: ChartWorkspaceError }
  | { type: "readyWithWarning"; error: ChartWorkspaceError };

export interface WorkspaceViewModel {
  state: ChartWorkspaceState;
  status: WorkspaceStatus;
  seriesType: SeriesType;
  priceScaleMode: PriceScaleMode;
  indicators: readonly IndicatorConfig[];
  drawings: readonly DrawingObject[];
  selectedDrawingIds: readonly string[];
  bottomPanel: BottomPanelState;
  drawingPalette: DrawingPaletteState;
  dataWindow?: DataWindowSnapshot;
  canUndoDrawing: boolean;
  canRedoDrawing: boolean;
  gridVisible: boolean;
  calculationStatus: CalculationStatus;
}
```

Controller methods exactly mirror public setters plus UI actions for search, history retry, chart type, scale, indicators, drawings, drawing undo/redo, grid visibility, palette, and bottom panel. Undo/redo enabled state comes from the runtime's drawing-history callback, not a duplicate UI history stack.

- [ ] **Step 4: Implement state transitions and retry ownership**

- An initial valid page clears blocking state, materializes a window, calculates indicators, and updates runtime.
- A viewport boundary requests the adjacent cursor; accepted history re-materializes around the prior anchor time.
- A missing evicted payload calls `reloadPage(cursor)` before re-materialization.
- `retry()` only retries `initial-data` or `render` when `recoverable` is true.
- Search retry stays in search actions; history retry carries its failed cursor.
- Storage errors call `onError` and keep `ready` data.
- Destroy marks the controller inactive before destroying dependencies, so late callbacks are ignored.

- [ ] **Step 5: Run focused controller tests**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/chartWorkspaceController.test.ts
```

Expected: PASS with one request per normalized selection and exact error/retry ownership.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/controller/chartWorkspaceController.ts packages/chart-workspace/src/__tests__/chartWorkspaceController.test.ts
git commit -m "feat(workspace): orchestrate workspace product state"
```

## Task 9: Composition Root, Browser App, And Required Spatial Shell

**Files:**
- Create: `packages/chart-workspace/src/createChartWorkspace.ts`
- Modify: `packages/chart-workspace/src/index.ts`
- Create: `packages/chart-workspace/src/ui/workspaceShell.ts`
- Create: `packages/chart-workspace/src/ui/topToolbar.ts`
- Create: `packages/chart-workspace/src/ui/bottomPanel.ts`
- Create: `packages/chart-workspace/src/ui/errorPanel.ts`
- Modify: `packages/chart-workspace/src/styles.css`
- Create: `apps/workspace-playground/package.json`
- Create: `apps/workspace-playground/tsconfig.json`
- Create: `apps/workspace-playground/index.html`
- Create: `apps/workspace-playground/src/main.ts`
- Create: `apps/workspace-playground/src/styles.css`
- Create: `apps/workspace-playground/src/fixtures/createFixtureDataSource.ts`
- Create: `apps/workspace-playground/tests/workspace-layout.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: package layers from Tasks 1–8.
- Produces: the exact public `createChartWorkspace(container, options): ChartWorkspace`, a DOM-only `WorkspaceShell`, and the deterministic browser host used by every later UI task.

- [ ] **Step 1: Write a failing browser layout test**

Create `workspace-layout.spec.ts` and wait for an actual ready render rather than a fixed delay:

```ts
await page.goto("/");
await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
await expect(page.locator(".sc-top-toolbar")).toHaveCount(1);
await expect(page.locator(".sc-chart-region")).toHaveCount(1);
await expect(page.locator(".sc-bottom-panel")).toHaveCount(1);
await expect(page.locator(".sc-right-sidebar")).toHaveCount(0);

const chartBox = await page.locator(".sc-chart-region").boundingBox();
const rootBox = await page.locator(".sc-workspace").boundingBox();
expect(chartBox?.width).toBe(rootBox?.width);
```

Run `PLAYWRIGHT_CHANNEL=chrome npm run test:workspace:e2e -- apps/workspace-playground/tests/workspace-layout.spec.ts`. Expected: FAIL because the composition root, shell, and app do not exist.

- [ ] **Step 2: Build the shell with DOM APIs only**

Expose:

```ts
export interface WorkspaceShell {
  readonly root: HTMLDivElement;
  readonly chartRegion: HTMLDivElement;
  readonly staticCanvas: HTMLCanvasElement;
  readonly overlayCanvas: HTMLCanvasElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
  destroy(): void;
}
```

Append toolbar, chart region, static canvas, overlay canvas, floating-palette host, horizontal resizer, and bottom panel in that order. `render()` sets `root.dataset.state` to `loading`, `ready`, `ready-with-warning`, or `blocked` from the controller status. Store listener cleanup callbacks in an array and execute each once in `destroy()`.

- [ ] **Step 3: Apply the approved dark full-width layout**

Extend `styles.css` with the exact tokens and grid:

```css
.sc-workspace {
  --sc-bg: #08090d;
  --sc-surface: #15171c;
  --sc-border: #282b33;
  --sc-grid: rgba(118, 126, 148, 0.16);
  --sc-text: #d8dbe4;
  --sc-muted: #858b9a;
  --sc-accent: #6266f1;
  --sc-up: #f04455;
  --sc-down: #00aa91;
  position: relative;
  display: grid;
  grid-template-rows: 42px minmax(0, 1fr) auto;
  width: 100%;
  height: 100%;
  min-width: 1280px;
  overflow: hidden;
  color: var(--sc-text);
  background: var(--sc-bg);
  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
}

.sc-top-toolbar { height: 42px; border-bottom: 1px solid var(--sc-border); background: var(--sc-bg); }
.sc-chart-region { position: relative; min-height: 0; width: 100%; overflow: hidden; }
.sc-chart-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.sc-overlay-canvas { touch-action: none; }
.sc-bottom-panel { min-height: 0; border-top: 1px solid var(--sc-border); background: var(--sc-surface); }
```

Bottom tabs are exactly `objects`, `properties`, `data`. The resizer clamps height between `120` and `40%` of root height; collapsed height is `32`. No `.sc-right-sidebar` rule or DOM node exists.

- [ ] **Step 4: Implement the only composition root**

If `container` is not an `HTMLElement`, throw `TypeError` synchronously because there is nowhere to mount. With a valid container, validate workspace ID, every initial-symbol field, and both data-source functions before any request. Invalid options mount a nonrecoverable blocked `INVALID_CONFIGURATION` panel, call a valid `onError` callback once, hide retry, keep public setters inert, and still return an idempotently destroyable handle; no provider/auth/raw option value enters the error context. Valid options construct persistence, stores/coordinators, shell, runtime, and controller in dependency order. Append the shell before starting the initial request so loading state is visible. Return only the approved frozen handle:

```ts
return Object.freeze({
  getState: () => controller.getState(),
  setSymbol: (symbol) => controller.setSymbol(symbol),
  setTimeframe: (timeframe) => controller.setTimeframe(timeframe),
  setAdjustMode: (adjustMode) => controller.setAdjustMode(adjustMode),
  retry: () => controller.retry(),
  destroy: () => {
    if (destroyed) return;
    destroyed = true;
    unbind();
    controller.destroy();
    shell.destroy();
    shell.root.remove();
  }
});
```

Export the function and approved public types only; no fixture, diagnostics object, controller, or engine type crosses `src/index.ts`.

- [ ] **Step 5: Create the minimal deterministic host and Playwright project**

The fixture implements `ChartWorkspaceDataSource` with one valid deterministic page and search results for `stock:SSE:600000` and `index:SSE:000001`; it lives only under the app. `main.ts` imports `@simoncharts/chart-workspace/styles.css`, creates the workspace with `workspaceId: "workspace-playground"` and the stock as its initial symbol in a full-viewport container, and contains no source/internal import. Configure the app on port `5174`, add the `workspace-playground` Playwright project, and add:

```json
{
  "name": "@simoncharts/workspace-playground",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "npm run build -w @simoncharts/chart-workspace && vite --host 127.0.0.1 --port 5174",
    "build": "vite build",
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "@simoncharts/chart-workspace": "1.0.0-rc.0"
  }
}
```

Root scripts are:

```json
{
  "dev:workspace": "npm run dev -w @simoncharts/workspace-playground",
  "test:workspace:e2e": "playwright test --project=workspace-playground"
}
```

Keep the existing engine app/server/project unchanged. Extend the root commands so the new app cannot escape build/type checks:

```json
{
  "typecheck": "tsc -b packages/chart-engine packages/chart-workspace apps/playground apps/workspace-playground",
  "build": "npm run build -w @simoncharts/chart-engine && npm run build -w @simoncharts/chart-workspace && npm run build -w @simoncharts/playground && npm run build -w @simoncharts/workspace-playground"
}
```

- [ ] **Step 6: Run the first browser slice**

```bash
npm install --package-lock-only
npm run typecheck
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:workspace:e2e -- apps/workspace-playground/tests/workspace-layout.spec.ts
```

Expected: PASS at 1280×800 and 1920×1080, zero workspace overflow, one ready chart shell, and no browser console errors.

- [ ] **Step 7: Commit**

```bash
git add packages/chart-workspace/src/createChartWorkspace.ts packages/chart-workspace/src/index.ts packages/chart-workspace/src/ui packages/chart-workspace/src/styles.css apps/workspace-playground package.json package-lock.json playwright.config.ts
git commit -m "feat(workspace): compose the commercial workspace shell"
```

## Task 10: Top Toolbar, Search, And Complete Market Controls

**Files:**
- Create: `packages/chart-workspace/src/ui/symbolSearch.ts`
- Create: `packages/chart-workspace/src/ui/indicatorManager.ts`
- Modify: `packages/chart-workspace/src/ui/topToolbar.ts`
- Modify: `packages/chart-workspace/src/ui/workspaceShell.ts`
- Modify: `packages/chart-workspace/src/styles.css`
- Test: `packages/chart-workspace/src/__tests__/capabilityMatrix.test.ts`
- Test: `apps/workspace-playground/tests/workspace-data.spec.ts`

**Interfaces:**
- Consumes: canonical timeframe/chart/indicator/scale arrays and controller actions.
- Produces: symbol search, 8 timeframe controls, stock/index adjustment behavior, 17 chart types, 16 indicators, 3 scales, undo/redo/settings/bottom-panel controls.

- [ ] **Step 1: Write failing control-count and request tests**

Unit assertion:

```ts
const model = createToolbarModel(engineManifest);
expect(model.timeframes).toHaveLength(8);
expect(model.seriesTypes).toHaveLength(17);
expect(model.indicators).toHaveLength(16);
expect(model.priceScaleModes).toEqual(["linear", "log", "percentage"]);
```

Browser assertion:

```ts
await page.getByRole("button", { name: "5分钟" }).click();
await expect.poll(() => requestLog(page)).toContainEqual(expect.objectContaining({ timeframe: "5m" }));
await page.getByTestId("symbol-search-input").fill("000001");
await expect(page.getByRole("option", { name: /上证指数/ })).toBeVisible();
await page.getByRole("option", { name: /上证指数/ }).click();
await expect(page.getByTestId("adjust-select")).toBeDisabled();

await page.getByTestId("indicator-manager-open").click();
await page.getByRole("button", { name: "Moving Average" }).click();
await page.getByLabel("MA period").fill("20");
await page.getByRole("button", { name: "Apply MA" }).click();
await expect(page.getByTestId("indicator-legend-MA")).toContainText("20");
await page.getByLabel("Hide MA").click();
await expect(page.getByTestId("indicator-legend-MA")).toBeHidden();

await expect(page.getByTestId("drawing-undo")).toBeDisabled();
```

- [ ] **Step 2: Implement safe searchable symbol UI**

Debounce input by 200 ms in the UI and call `actions.searchSymbols(query)`. Cancel the timer on a new input or destroy. Render each option with `textContent`; selecting sends the complete `ChartSymbol`. Search error stays inside the popup with a retry button.

- [ ] **Step 3: Render canonical controls from manifests**

Build options from engine `supportedSeriesTypes`, `coreIndicatorDefinitions`, and workspace timeframe/scale arrays. Map labels explicitly:

```ts
const timeframeLabels: Record<Timeframe, string> = {
  "1m": "1分钟",
  "5m": "5分钟",
  "15m": "15分钟",
  "30m": "30分钟",
  "60m": "60分钟",
  "1d": "日线",
  "1w": "周线",
  "1mo": "月线"
};
```

Stock adjustment labels are `不复权/前复权/后复权`; index adjustment control is disabled and fixed to `不复权`. Scale labels are `线性/对数/百分比`.

- [ ] **Step 4: Implement the indicator and chart-settings popovers**

Build the indicator list directly from `coreIndicatorDefinitions`. Each enabled row owns id, validated params, visibility, style, and engine-declared panel id; it supports add, parameter apply, show/hide, and remove. Integer period/fast/slow/signal values must be positive integers with `fast < slow`; deviation/SAR step/max must be positive finite values with `step <= max`. Invalid edits stay in the popover and do not replace the last valid runtime/persisted config. Controller updates runtime, legend, data-window rows, and the versioned indicator persistence namespace together.

Toolbar undo/redo uses `canUndoDrawing`/`canRedoDrawing` and the dedicated controller/runtime actions. The settings popover contains the v1 grid visibility toggle; it calls `setGridVisible`, persists the UI preference, and schedules one static redraw. It does not expose a light theme because the approved v1 product theme is dark.

- [ ] **Step 5: Run the focused unit and browser tests**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__/capabilityMatrix.test.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:workspace:e2e -- apps/workspace-playground/tests/workspace-data.spec.ts
```

Expected: PASS with exact counts, request payloads, index adjustment normalization, and no hard-coded duplicate capability arrays beyond labels.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/ui/symbolSearch.ts packages/chart-workspace/src/ui/indicatorManager.ts packages/chart-workspace/src/ui/topToolbar.ts packages/chart-workspace/src/ui/workspaceShell.ts packages/chart-workspace/src/styles.css packages/chart-workspace/src/__tests__/capabilityMatrix.test.ts apps/workspace-playground/tests/workspace-data.spec.ts
git commit -m "feat(workspace): add complete market toolbar controls"
```

## Task 11: Floating Drawing Palette And 63-Tool Interaction

**Files:**
- Create: `packages/chart-workspace/src/ui/drawingPalette.ts`
- Modify: `packages/chart-workspace/src/ui/workspaceShell.ts`
- Modify: `packages/chart-workspace/src/styles.css`
- Test: `apps/workspace-playground/tests/workspace-drawing.spec.ts`

**Interfaces:**
- Consumes: all `builtInDrawingToolDefinitions`, persistence palette state, runtime drawing actions.
- Produces: draggable/collapsible palette, adjacent category popup, recent tool, and all drawing editor actions.

- [ ] **Step 1: Write failing 63-tool and drag persistence browser tests**

```ts
await page.getByTestId("drawing-palette-expand").click();
const toolTypes: string[] = [];
for (const category of await page.locator("[data-drawing-category]").all()) {
  await category.click();
  toolTypes.push(...await page.locator("[data-drawing-tool]").evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("data-drawing-tool") ?? "")
  ));
}
expect(toolTypes).toHaveLength(63);
expect(new Set(toolTypes).size).toBe(63);
await page.getByTestId("drawing-category-basic").click();
await page.getByRole("button", { name: "Trend Line" }).click();
const beforeDrawing = await page.locator("canvas.sc-static-canvas").screenshot();
await drawGesture(page, [[200, 200], [400, 300]]);
const afterDrawing = await page.locator("canvas.sc-static-canvas").screenshot();
expect(afterDrawing.equals(beforeDrawing)).toBe(false);
await expect.poll(() => persistedDrawingCount(page)).toBe(1);
await expect(page.getByTestId("drawing-undo")).toBeEnabled();
await page.getByTestId("drawing-undo").click();
await expect.poll(() => persistedDrawingCount(page)).toBe(0);
await expect(page.getByTestId("drawing-redo")).toBeEnabled();
await page.getByTestId("drawing-redo").click();
await expect.poll(() => persistedDrawingCount(page)).toBe(1);

const before = await page.getByTestId("drawing-palette").boundingBox();
await page.getByTestId("drawing-palette-drag-handle").dragTo(page.locator(".sc-chart-region"), {
  targetPosition: { x: 500, y: 160 }
});
await page.reload();
const after = await page.getByTestId("drawing-palette").boundingBox();
expect(after?.x).not.toBe(before?.x);
```

Define the test helper without reaching into package internals:

```ts
async function persistedDrawingCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.startsWith("simoncharts:workspace:v1:workspace-playground:drawings:")
    );
    if (!key) return 0;
    const envelope = JSON.parse(localStorage.getItem(key) ?? "null") as { value?: unknown[] } | null;
    return Array.isArray(envelope?.value) ? envelope.value.length : 0;
  });
}
```

- [ ] **Step 2: Build categories from registry definitions**

Group `builtInDrawingToolDefinitions` by `category`; do not repeat a 63-item list. The collapsed button shows the recent tool. Expanding a category opens one adjacent popup within chart bounds. Tool buttons have `data-drawing-tool=<type>` and use definition labels.

- [ ] **Step 3: Implement pointer-capture drag and bounds clamping**

On palette header pointer down, call `setPointerCapture`. During move clamp left/top to `[0, chartWidth - paletteWidth]` and `[0, chartHeight - paletteHeight]`. On pointer up persist `{ x, y, collapsed, recentTool }`. Re-clamp after `ResizeObserver` changes chart bounds.

- [ ] **Step 4: Route complete drawing lifecycle and editor commands**

Canvas down/move/up/cancel routes through runtime. Palette/object actions include select, delete, lock/unlock, and hide/show; top-toolbar undo/redo calls the runtime's dedicated `undoDrawing()`/`redoDrawing()` methods. The runtime renders `previewDrawing` during creation and persists only committed domain drawings.

- [ ] **Step 5: Run the focused browser test**

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:workspace:e2e -- apps/workspace-playground/tests/workspace-drawing.spec.ts
```

Expected: PASS for palette enumeration/drag persistence, one step-tool create/preview/complete cycle, and the continuous pointer lifecycle for path/brush/forecastPath. Task 14 runs the full 63-tool select/property/serialize/restore matrix after the bottom workbench exists.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/ui/drawingPalette.ts packages/chart-workspace/src/ui/workspaceShell.ts packages/chart-workspace/src/styles.css apps/workspace-playground/tests/workspace-drawing.spec.ts
git commit -m "feat(workspace): expose all drawing tools in a floating palette"
```

## Task 12: Bottom Object, Property, And Data Panels

**Files:**
- Create: `packages/chart-workspace/src/ui/propertyEditor.ts`
- Create: `packages/chart-workspace/src/ui/dataWindow.ts`
- Modify: `packages/chart-workspace/src/ui/bottomPanel.ts`
- Modify: `packages/chart-workspace/src/ui/workspaceShell.ts`
- Modify: `packages/chart-workspace/src/styles.css`
- Test: `apps/workspace-playground/tests/workspace-capabilities.spec.ts`

**Interfaces:**
- Consumes: object manager items, drawing property schemas, crosshair OHLC and indicator rows.
- Produces: synchronized `objects`, `properties`, and `data` tabs below the chart.

- [ ] **Step 1: Write failing panel synchronization tests**

```ts
await createTrendLine(page);
await page.getByRole("tab", { name: "对象" }).click();
await page.getByRole("row", { name: /trendLine/ }).click();
await page.getByRole("tab", { name: "属性" }).click();
await page.getByLabel("Color").fill("#f04455");
await expect.poll(() => persistedSelectedDrawingColor(page)).toBe("#f04455");
expect(await canvasColorNearCount(page, [240, 68, 85], 3)).toBeGreaterThan(0);

await enableIndicator(page, "MA");
await page.mouse.move(600, 300);
await page.getByRole("tab", { name: "数据窗口" }).click();
await expect(page.getByTestId("data-window-open")).not.toHaveText("--");
await expect(page.getByTestId("data-window-MA")).not.toHaveText("--");
```

`enableIndicator` uses the Task 10 indicator popover and waits for its legend. `persistedSelectedDrawingColor` parses only the public localStorage envelope. `canvasColorNearCount` reads the static canvas pixels and counts pixels whose RGB channels are each within the supplied tolerance, avoiding an antialiasing-sensitive screenshot baseline.

- [ ] **Step 2: Render object manager actions from editor state**

Each object row displays type, visibility, lock, and selection. Clicking selects; eye/lock buttons issue editor commands; ordering actions use bring-forward/send-backward. Do not maintain a second object list in UI state.

- [ ] **Step 3: Render schema-driven properties**

Use `getDrawingPropertyDefinitionsForDrawing(selected)` and map `color`, `number`, `lineDash`, `text`, `numberList`, and `boolean` to controls. On change, issue the definition's exact command (`updateSelectedStyle`, `updateSelectedMetadata`, `updateSelectedText`, show/hide, lock/unlock). Validation uses schema min/max/step and does not invent per-tool fields.

- [ ] **Step 4: Render crosshair data without recomputation**

Data window consumes the runtime's `DataWindowSnapshot` directly. It displays `formattedTime`, OHLC, change/percent, volume, turnover, and the supplied visible-indicator rows. It never formats epoch values independently or invokes an indicator calculator. Moving the crosshair only updates this data DOM and the overlay canvas.

- [ ] **Step 5: Run the focused browser test**

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:workspace:e2e -- apps/workspace-playground/tests/workspace-capabilities.spec.ts
```

Expected: PASS; the chart remains full width above the horizontal panel and no right sidebar appears.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/ui/propertyEditor.ts packages/chart-workspace/src/ui/dataWindow.ts packages/chart-workspace/src/ui/bottomPanel.ts packages/chart-workspace/src/ui/workspaceShell.ts packages/chart-workspace/src/styles.css apps/workspace-playground/tests/workspace-capabilities.spec.ts
git commit -m "feat(workspace): add bottom object and data workbench"
```

## Task 13: Controlled Fixture States And Lifecycle Cleanup

**Files:**
- Modify: `packages/chart-workspace/src/createChartWorkspace.ts`
- Modify: `packages/chart-workspace/src/controller/chartWorkspaceController.ts`
- Modify: `packages/chart-workspace/src/ui/workspaceShell.ts`
- Modify: `apps/workspace-playground/src/main.ts`
- Modify: `apps/workspace-playground/src/fixtures/createFixtureDataSource.ts`
- Create: `apps/workspace-playground/tests/workspace-lifecycle.spec.ts`
- Modify: `apps/workspace-playground/tests/workspace-data.spec.ts`

**Interfaces:**
- Consumes: the public composition root and UI completed in Tasks 9–12.
- Produces: deterministic failure/version/latency controls, observable host-owned request counts, and proof that `destroy()` leaves no live work.

- [ ] **Step 1: Write failing controlled-state and cleanup assertions**

Instrument `ResizeObserver`, `requestAnimationFrame`, and event listeners in the app before creating the workspace; expose only those host-owned counters and fixture request counters to Playwright:

```ts
await expect(page.locator('.sc-workspace[data-state="ready"]')).toHaveCount(1);
await page.getByTestId("destroy-workspace").click();
await expect(page.locator(".sc-workspace")).toHaveCount(0);
expect(await page.evaluate(() => window.__hostCounters.activeRequests)).toBe(0);
expect(await page.evaluate(() => window.__hostCounters.activeObservers)).toBe(0);
expect(await page.evaluate(() => window.__hostCounters.activeAnimationFrames)).toBe(0);
```

Add a second test that selects a slow symbol, immediately selects another, and expects the first signal to be aborted and only the second symbol to reach ready state.

- [ ] **Step 2: Expand the deterministic cursor fixture without importing it into production**

The app fixture logs requests/signals and accepts query-string controls for latency, initial/history failure, invalid page, cursor cycle, boundary conflict, and version change. Candle values remain deterministic and app-only:

```ts
function candleAt(index: number): Candle {
  const close = 100 + Math.sin(index / 25) * 8 + index * 0.0001;
  return {
    time: Date.UTC(2000, 0, 1) + index * 60_000,
    open: close - 0.2,
    high: close + 0.8,
    low: close - 0.8,
    close,
    volume: 10_000 + (index % 500),
    turnover: (10_000 + (index % 500)) * close
  };
}
```

The production package contains no fixture import, generator, global test counter, or test-only public export.

- [ ] **Step 3: Make teardown order explicit and late callbacks inert**

`destroy()` first marks the workspace/controller inactive and aborts search/series requests, then unsubscribes/binds, destroys runtime and shell resources, and removes the root. All promise completions and frame callbacks check the inactive flag before mutating state or DOM. Repeated `destroy()` is a no-op. Keep `.sc-workspace[data-state]` as an internal DOM state marker; do not add a public diagnostic method.

- [ ] **Step 4: Verify blocking, warning, version, and lifecycle transitions**

Browser tests cover initial loading → ready, recoverable blocking retry, unrecoverable invalid data, nonblocking history warning, stale response suppression, cursor-cycle rejection, atomic version rebuild, and double destroy. Unit tests continue to own observer/listener/frame cleanup counts inside the runtime harness.

Also call `createChartWorkspace` through `page.evaluate` with a non-element and expect a synchronous `TypeError`. Mount with an empty workspace ID, malformed symbol, and missing data-source methods in separate cases; each case must show `INVALID_CONFIGURATION`, expose no retry button, make setters issue zero requests, call `onError` once, and cleanly destroy.

- [ ] **Step 5: Run the complete browser slice created so far**

```bash
npm run test -- packages/chart-workspace/src/__tests__/chartWorkspaceController.test.ts packages/chart-workspace/src/__tests__/performanceAcceptance.test.ts
npm run typecheck
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:workspace:e2e
```

Expected: PASS; there are zero console errors, stale commits, live fixture requests, observers, or animation frames after destroy.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/createChartWorkspace.ts packages/chart-workspace/src/controller/chartWorkspaceController.ts packages/chart-workspace/src/ui/workspaceShell.ts apps/workspace-playground/src apps/workspace-playground/tests/workspace-lifecycle.spec.ts apps/workspace-playground/tests/workspace-data.spec.ts
git commit -m "test(workspace): harden controlled states and teardown"
```

## Task 14: Full Capability, Error, Persistence, And Performance Matrices

**Files:**
- Complete: `apps/workspace-playground/tests/workspace-data.spec.ts`
- Complete: `apps/workspace-playground/tests/workspace-capabilities.spec.ts`
- Complete: `apps/workspace-playground/tests/workspace-drawing.spec.ts`
- Complete: `apps/workspace-playground/tests/workspace-layout.spec.ts`
- Create: `apps/workspace-playground/tests/workspace-persistence-errors.spec.ts`
- Complete: `apps/workspace-playground/tests/workspace-lifecycle.spec.ts`
- Create: `apps/workspace-playground/tests/workspace-performance.spec.ts`
- Modify: `packages/chart-workspace/src/__tests__/capabilityMatrix.test.ts`
- Modify: `packages/chart-workspace/src/__tests__/performanceAcceptance.test.ts`
- Modify: `packages/chart-workspace/src/__tests__/checkpointedCalculationRuntime.test.ts`

**Interfaces:**
- Consumes: the complete package and deterministic fixture controls.
- Produces: Phase 2 acceptance evidence and regression gates for later release work.

- [ ] **Step 1: Parameterize exact capability matrices**

Unit tests iterate canonical arrays and assert counts `17`, `16`, `63`, `8`, `3`, and `3`. Browser tests switch every chart type, add/configure/remove every indicator, create/edit/serialize/restore every drawing tool, request every timeframe, request all stock adjustments, normalize every index adjustment to none, and switch every scale.

Each loop asserts a usable rendered frame and zero console errors; no test merely checks that an option exists.

The layout/browser test inspects static-canvas pixels with a per-channel tolerance of 3 and requires nonzero counts near background `#08090d`, one rising candle `#f04455`, and one falling candle `#00aa91`. Axis/tooltip unit tests own time-label calls; the bottom data-window browser assertion requires `2026-06-05 09:30` for an intraday fixture and rejects any 13-digit epoch text.

- [ ] **Step 2: Cover data consistency and error levels**

Use fixture controls to verify initial empty/invalid/network/render errors block with retry; history invalid/network and storage failures keep the trusted chart; stale/aborted responses display nothing; version change rebuilds without mixed candles; conflicting boundary pages are rejected as a whole.

- [ ] **Step 3: Cover persistence scopes**

Reload and assert palette position/collapse/recent tool, bottom panel state, chart type, scale, indicators, and drawing objects restore. Switch timeframe and assert drawings remain; switch adjustment or symbol and assert the drawing namespace changes. Inspect localStorage and assert no candle timestamps, OHLC values, search results, tokens, or provider strings.

- [ ] **Step 4: Enforce performance budgets**

The million-candle fixture exposes pages lazily. In Playwright, measure with `performance.now()` from fixture response resolution until `.sc-workspace[data-state="ready"]` appears, and measure interaction frames with `requestAnimationFrame`. Keep memory/materialization assertions in `performanceAcceptance.test.ts` against internal store/runtime metrics rather than exposing diagnostics through the public workspace handle:

```ts
expect(responseToFrameMs).toBeLessThanOrEqual(100);
expect(percentile(interactionFrameDurations, 0.95)).toBeLessThanOrEqual(16.7);
expect(store.getDiagnostics().cachedPageCount).toBeLessThanOrEqual(128);
expect(store.getDiagnostics().estimatedBytes).toBeLessThanOrEqual(64 * 1024 * 1024);
expect(checkpointStore.getDiagnostics().entryCount).toBeLessThanOrEqual(2048);
expect(checkpointStore.getDiagnostics().estimatedBytes).toBeLessThanOrEqual(4 * 1024 * 1024);
expect(runtime.getMetrics().maxMaterializedCandleCount).toBeLessThan(20_000);
```

Create one instance of every 63 drawing tool plus multiple indicators and rerun the interaction budget. Confirm crosshair moves leave static render count unchanged in the focused runtime unit harness.

- [ ] **Step 5: Run the Phase 2 gate**

Run:

```bash
npm run test -- packages/chart-workspace/src/__tests__
npm run typecheck
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:workspace:e2e
PLAYWRIGHT_CHANNEL=msedge npm run test:workspace:e2e
git diff --check
```

Expected: all commands exit 0; Chrome and Edge have no console errors, layout overflow, stale request commits, or performance budget failures.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-workspace/src/__tests__/capabilityMatrix.test.ts packages/chart-workspace/src/__tests__/performanceAcceptance.test.ts packages/chart-workspace/src/__tests__/checkpointedCalculationRuntime.test.ts apps/workspace-playground/tests/workspace-layout.spec.ts apps/workspace-playground/tests/workspace-data.spec.ts apps/workspace-playground/tests/workspace-capabilities.spec.ts apps/workspace-playground/tests/workspace-drawing.spec.ts apps/workspace-playground/tests/workspace-persistence-errors.spec.ts apps/workspace-playground/tests/workspace-lifecycle.spec.ts apps/workspace-playground/tests/workspace-performance.spec.ts
git commit -m "test(workspace): certify the complete capability matrix"
```

## Phase Acceptance

- `createChartWorkspace` is the only partner runtime entry and imports safely before DOM creation.
- All data comes from `ChartWorkspaceDataSource`; invalid/stale/mixed pages never enter trusted state.
- All available history is navigable through descriptors and rehydration while candle payloads/materialization stay bounded.
- UI has the approved top/full-chart/floating-palette/bottom-panel layout and dark A-share visual system.
- All 17 chart types, 16 indicators, 63 drawing tools, 8 timeframes, stock/index adjustment rules, and 3 scales work rather than merely appear.
- Browser persistence, error recovery, lifecycle cleanup, and performance budgets pass before packaging or host integration begins.
