# Chart Engine v0.1 Full Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SimonCharts v0.1 as a full professional chart engine kernel with 17 chart types, visual output/panel extensibility, complete neutral drawing editor, command/settings contracts, docs, and playground acceptance.

**Architecture:** Keep `packages/chart-engine` as the reusable engine kernel and `apps/playground` as a neutral demo/acceptance harness. Add registry-based series, visual, and drawing subsystems so renderers, hit tests, tooltips, and autoscale contributions are composed through explicit contracts instead of host-specific logic. Preserve the engine/host boundary: no TradingReviewSystem, watchlist, review, strategy, AI, auth, account, billing, news, or order-flow business imports in engine source.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright, Canvas 2D API, npm workspaces.

---

## Source Spec

Implement from:

- `docs/superpowers/specs/2026-06-24-chart-engine-v0-1-full-engine-design.md`

Reference baseline:

- `docs/superpowers/specs/2026-06-23-chart-engine-platform-design.md`
- `docs/superpowers/plans/2026-06-23-chart-engine-m0-m2.md`

## Scope Check

This v0.1 spec intentionally covers multiple engine subsystems. Treat the A-E milestones as one v0.1 release, but execute them as separate reviewable implementation slices:

- V0.1-A: Chart Type Engine
- V0.1-B: Visual Output + Panel Engine
- V0.1-C: Drawing Object Model + Rendering
- V0.1-D: Drawing Editor Interaction
- V0.1-E: Actions, Undo/Redo, Settings, Docs

Do not implement host product features. The playground may expose controls only to exercise engine APIs.

## Boundary Rules

Required for every task:

- Engine code under `packages/chart-engine/src` must not import from `apps/*`.
- Engine code must not import host APIs, stores, schemas, routes, persistence models, AI models, watchlist models, review models, strategy models, auth models, account models, billing models, membership models, news models, or order-flow product models.
- Engine events must be neutral.
- Host business concepts can only enter through neutral `CandleSeries`, `IndicatorResult`, `ChartMark`, `DrawingObject`, `ChartCommand`, `ChartEvent`, `HostAdapter`, or `metadata: Record<string, unknown>` that engine code does not interpret.
- Every task runs `npm run guard:engine-boundary` before approval.

## Planned File Structure

### Core Public API

- Modify: `packages/chart-engine/src/index.ts` - public exports only.
- Create: `packages/chart-engine/src/engine/chartEngine.ts` - engine facade lifecycle.
- Create: `packages/chart-engine/src/engine/chartState.ts` - normalized engine state.
- Create: `packages/chart-engine/src/engine/events.ts` - event subscription helpers.
- Create: `packages/chart-engine/src/commands/chartCommands.ts` - command types and dispatcher.
- Create: `packages/chart-engine/src/commands/history.ts` - undo/redo command history.

### Series / Chart Types

- Create: `packages/chart-engine/src/series/seriesTypes.ts` - `SeriesType`, render models, tooltip rows.
- Create: `packages/chart-engine/src/series/seriesRegistry.ts` - registry for renderers and transforms.
- Create: `packages/chart-engine/src/series/renderModel.ts` - source-to-render model helpers.
- Create: `packages/chart-engine/src/series/autoscale.ts` - series autoscale contribution.
- Create: `packages/chart-engine/src/series/hitTest.ts` - series hit testing.
- Create: `packages/chart-engine/src/series/tooltip.ts` - series tooltip rows.
- Create: `packages/chart-engine/src/series/transforms/heikinAshi.ts`
- Create: `packages/chart-engine/src/series/transforms/renko.ts`
- Create: `packages/chart-engine/src/series/transforms/lineBreak.ts`
- Create: `packages/chart-engine/src/series/transforms/kagi.ts`
- Create: `packages/chart-engine/src/series/transforms/pointAndFigure.ts`
- Create: `packages/chart-engine/src/render/series/seriesLayer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/barsRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/candlesRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/hollowCandlesRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/volumeCandlesRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/lineRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/lineWithMarkersRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/stepLineRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/areaRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/hlcAreaRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/baselineRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/columnsRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/highLowRenderer.ts`
- Create: `packages/chart-engine/src/render/series/renderers/syntheticOhlcRenderer.ts`

### Visual Outputs / Panels

- Create: `packages/chart-engine/src/panels/panelTypes.ts`
- Create: `packages/chart-engine/src/panels/panelLayout.ts`
- Create: `packages/chart-engine/src/panels/panelScales.ts`
- Create: `packages/chart-engine/src/visuals/visualTypes.ts`
- Create: `packages/chart-engine/src/visuals/visualRegistry.ts`
- Create: `packages/chart-engine/src/visuals/visualAutoscale.ts`
- Create: `packages/chart-engine/src/visuals/visualHitTest.ts`
- Create: `packages/chart-engine/src/visuals/visualTooltip.ts`
- Create: `packages/chart-engine/src/render/visuals/visualLayer.ts`
- Create: `packages/chart-engine/src/render/visuals/renderers/lineVisualRenderer.ts`
- Create: `packages/chart-engine/src/render/visuals/renderers/histogramVisualRenderer.ts`
- Create: `packages/chart-engine/src/render/visuals/renderers/bandVisualRenderer.ts`
- Create: `packages/chart-engine/src/render/visuals/renderers/markerVisualRenderer.ts`

### Drawing Model / Rendering / Editor

- Create: `packages/chart-engine/src/drawing/drawingTypes.ts`
- Create: `packages/chart-engine/src/drawing/drawingSerialization.ts`
- Create: `packages/chart-engine/src/drawing/drawingGeometry.ts`
- Create: `packages/chart-engine/src/drawing/drawingRegistry.ts`
- Create: `packages/chart-engine/src/drawing/drawingHitTest.ts`
- Create: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Create: `packages/chart-engine/src/drawing/drawingCommands.ts`
- Create: `packages/chart-engine/src/drawing/drawingMagnet.ts`
- Create: `packages/chart-engine/src/render/drawing/drawingLayer.ts`
- Create: `packages/chart-engine/src/render/drawing/renderers/lineDrawingRenderer.ts`
- Create: `packages/chart-engine/src/render/drawing/renderers/channelDrawingRenderer.ts`
- Create: `packages/chart-engine/src/render/drawing/renderers/fibonacciDrawingRenderer.ts`
- Create: `packages/chart-engine/src/render/drawing/renderers/textDrawingRenderer.ts`
- Create: `packages/chart-engine/src/render/drawing/renderers/shapeDrawingRenderer.ts`
- Create: `packages/chart-engine/src/render/drawing/renderers/pathDrawingRenderer.ts`
- Create: `packages/chart-engine/src/render/drawing/renderers/positionDrawingRenderer.ts`
- Create: `packages/chart-engine/src/render/drawing/renderers/rangeDrawingRenderer.ts`

### Theme / Settings

- Create: `packages/chart-engine/src/settings/chartSettings.ts`
- Modify: `packages/chart-engine/src/model/theme.ts`

### Playground

- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/src/styles.css`
- Create: `apps/playground/src/playgroundState.ts`
- Create: `apps/playground/src/toolbar.ts`
- Create: `apps/playground/src/drawingToolbar.ts`
- Create: `apps/playground/src/fixtures/visualFixtures.ts`

### Tests

- Create: `packages/chart-engine/src/__tests__/seriesRegistry.test.ts`
- Create: `packages/chart-engine/src/__tests__/seriesRenderModels.test.ts`
- Create: `packages/chart-engine/src/__tests__/syntheticSeries.test.ts`
- Create: `packages/chart-engine/src/__tests__/seriesRenderers.test.ts`
- Create: `packages/chart-engine/src/__tests__/panelEngine.test.ts`
- Create: `packages/chart-engine/src/__tests__/visualRegistry.test.ts`
- Create: `packages/chart-engine/src/__tests__/visualRenderers.test.ts`
- Create: `packages/chart-engine/src/__tests__/drawingModel.test.ts`
- Create: `packages/chart-engine/src/__tests__/drawingRenderers.test.ts`
- Create: `packages/chart-engine/src/__tests__/drawingEditor.test.ts`
- Create: `packages/chart-engine/src/__tests__/commands.test.ts`
- Create: `packages/chart-engine/src/__tests__/chartEngine.test.ts`
- Create: `apps/playground/tests/chart-types.spec.ts`
- Create: `apps/playground/tests/visual-panels.spec.ts`
- Create: `apps/playground/tests/drawing-editor.spec.ts`
- Create: `apps/playground/tests/settings-actions.spec.ts`

### Documentation

- Create: `docs/engine/overview.md`
- Create: `docs/engine/public-api.md`
- Create: `docs/engine/chart-types.md`
- Create: `docs/engine/visual-outputs.md`
- Create: `docs/engine/panels.md`
- Create: `docs/engine/drawing-editor.md`
- Create: `docs/engine/actions-and-commands.md`
- Create: `docs/engine/host-integration.md`
- Create: `docs/engine/boundary-rules.md`
- Create: `docs/engine/testing-strategy.md`

---

## Milestone V0.1-A: Chart Type Engine

### Task 1: Define Series Type Contracts and Registry

**Files:**

- Create: `packages/chart-engine/src/series/seriesTypes.ts`
- Create: `packages/chart-engine/src/series/seriesRegistry.ts`
- Test: `packages/chart-engine/src/__tests__/seriesRegistry.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing registry tests**

Create `packages/chart-engine/src/__tests__/seriesRegistry.test.ts` with this shape:

```ts
import { describe, expect, it } from "vitest";
import {
  createSeriesRendererRegistry,
  supportedSeriesTypes,
  type SeriesRenderer
} from "../index";

describe("series renderer registry", () => {
  it("declares the 17 v0.1 chart types in deterministic order", () => {
    expect(supportedSeriesTypes).toEqual([
      "bars",
      "candles",
      "hollowCandles",
      "volumeCandles",
      "line",
      "lineWithMarkers",
      "stepLine",
      "area",
      "hlcArea",
      "baseline",
      "columns",
      "highLow",
      "heikinAshi",
      "renko",
      "lineBreak",
      "kagi",
      "pointAndFigure"
    ]);
  });

  it("registers and retrieves a renderer by series type", () => {
    const registry = createSeriesRendererRegistry();
    const renderer: SeriesRenderer = {
      type: "line",
      render() {},
      getAutoscale() {
        return undefined;
      },
      hitTest() {
        return undefined;
      },
      getTooltipRows() {
        return [];
      }
    };

    registry.register(renderer);

    expect(registry.get("line")).toBe(renderer);
  });

  it("throws a clear error when a renderer is missing", () => {
    const registry = createSeriesRendererRegistry();

    expect(() => registry.require("renko")).toThrow("Series renderer is not registered: renko");
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/seriesRegistry.test.ts
```

Expected: FAIL because `createSeriesRendererRegistry`, `supportedSeriesTypes`, and `SeriesRenderer` are not exported.

- [ ] **Step 3: Implement series contracts**

Create `packages/chart-engine/src/series/seriesTypes.ts`:

```ts
import type { Candle, CandleSeries } from "../model/market";
import type { ChartLayout, LayerRenderContext } from "../render/renderTypes";

export const supportedSeriesTypes = [
  "bars",
  "candles",
  "hollowCandles",
  "volumeCandles",
  "line",
  "lineWithMarkers",
  "stepLine",
  "area",
  "hlcArea",
  "baseline",
  "columns",
  "highLow",
  "heikinAshi",
  "renko",
  "lineBreak",
  "kagi",
  "pointAndFigure"
] as const;

export type SeriesType = (typeof supportedSeriesTypes)[number];

export interface SeriesPointSource {
  sourceIndex?: number;
  sourceRange?: {
    from: number;
    to: number;
  };
}

export interface SeriesRenderPoint extends SeriesPointSource {
  time: number;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
  turnover?: number;
}

export interface SeriesRenderModel {
  type: SeriesType;
  source: CandleSeries;
  points: SeriesRenderPoint[];
}

export interface SeriesAutoscaleRange {
  min: number;
  max: number;
}

export interface SeriesHitTestResult {
  type: SeriesType;
  point: SeriesRenderPoint;
  sourceCandle?: Candle;
  distance: number;
}

export interface SeriesTooltipRow {
  label: string;
  value: string;
}

export interface SeriesRendererContext extends LayerRenderContext {
  model: SeriesRenderModel;
  layout: ChartLayout;
}

export interface SeriesRenderer {
  type: SeriesType;
  render(context: SeriesRendererContext): void;
  getAutoscale(model: SeriesRenderModel): SeriesAutoscaleRange | undefined;
  hitTest(model: SeriesRenderModel, x: number, y: number): SeriesHitTestResult | undefined;
  getTooltipRows(hit: SeriesHitTestResult): SeriesTooltipRow[];
}
```

- [ ] **Step 4: Implement registry**

Create `packages/chart-engine/src/series/seriesRegistry.ts`:

```ts
import type { SeriesRenderer, SeriesType } from "./seriesTypes";

export interface SeriesRendererRegistry {
  register(renderer: SeriesRenderer): void;
  get(type: SeriesType): SeriesRenderer | undefined;
  require(type: SeriesType): SeriesRenderer;
  list(): SeriesRenderer[];
}

export function createSeriesRendererRegistry(): SeriesRendererRegistry {
  const renderers = new Map<SeriesType, SeriesRenderer>();

  return {
    register(renderer) {
      renderers.set(renderer.type, renderer);
    },
    get(type) {
      return renderers.get(type);
    },
    require(type) {
      const renderer = renderers.get(type);

      if (!renderer) {
        throw new Error(`Series renderer is not registered: ${type}`);
      }

      return renderer;
    },
    list() {
      return [...renderers.values()];
    }
  };
}
```

- [ ] **Step 5: Export series contracts**

Add to `packages/chart-engine/src/index.ts`:

```ts
export * from "./series/seriesRegistry";
export * from "./series/seriesTypes";
```

- [ ] **Step 6: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/seriesRegistry.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/chart-engine/src/series packages/chart-engine/src/__tests__/seriesRegistry.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add series renderer registry contracts"
```

### Task 2: Build Source Series Render Models

**Files:**

- Create: `packages/chart-engine/src/series/renderModel.ts`
- Test: `packages/chart-engine/src/__tests__/seriesRenderModels.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing render model tests**

Create `packages/chart-engine/src/__tests__/seriesRenderModels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSourceSeriesRenderModel, type CandleSeries } from "../index";

function createSeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: [
      { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100, turnover: 1100 },
      { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 120, turnover: 1440 }
    ]
  };
}

describe("source series render model", () => {
  it("maps source candles to render points with source index traceability", () => {
    const model = createSourceSeriesRenderModel("candles", createSeries());

    expect(model.type).toBe("candles");
    expect(model.points).toEqual([
      { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100, turnover: 1100, sourceIndex: 0 },
      { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 120, turnover: 1440, sourceIndex: 1 }
    ]);
  });

  it("does not mutate source candles", () => {
    const series = createSeries();
    const before = JSON.stringify(series);

    createSourceSeriesRenderModel("line", series);

    expect(JSON.stringify(series)).toBe(before);
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/seriesRenderModels.test.ts
```

Expected: FAIL because `createSourceSeriesRenderModel` is not exported.

- [ ] **Step 3: Implement source render model**

Create `packages/chart-engine/src/series/renderModel.ts`:

```ts
import type { CandleSeries } from "../model/market";
import type { SeriesRenderModel, SeriesRenderPoint, SeriesType } from "./seriesTypes";

export function createSourceSeriesRenderModel(
  type: SeriesType,
  series: CandleSeries
): SeriesRenderModel {
  const points: SeriesRenderPoint[] = series.candles.map((candle, sourceIndex) => ({
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    turnover: candle.turnover,
    sourceIndex
  }));

  return {
    type,
    source: series,
    points
  };
}
```

- [ ] **Step 4: Export render model helpers**

Add to `packages/chart-engine/src/index.ts`:

```ts
export * from "./series/renderModel";
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/seriesRenderModels.test.ts
npm run test -- packages/chart-engine/src/__tests__/seriesRegistry.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/series/renderModel.ts packages/chart-engine/src/__tests__/seriesRenderModels.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: build source series render models"
```

### Task 3: Add Series Autoscale, Hit-Test, and Tooltip Helpers

**Files:**

- Create: `packages/chart-engine/src/series/autoscale.ts`
- Create: `packages/chart-engine/src/series/hitTest.ts`
- Create: `packages/chart-engine/src/series/tooltip.ts`
- Test: `packages/chart-engine/src/__tests__/seriesRenderModels.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [x] **Step 1: Extend failing tests**

Add tests to `seriesRenderModels.test.ts`:

```ts
import {
  getSeriesAutoscaleRange,
  hitTestSeriesPoint,
  getDefaultSeriesTooltipRows
} from "../index";

it("computes autoscale from high and low values", () => {
  const model = createSourceSeriesRenderModel("candles", createSeries());

  expect(getSeriesAutoscaleRange(model, { from: 0, to: 1 })).toEqual({ min: 9, max: 13 });
});

it("hit-tests the closest visible point by x distance", () => {
  const model = createSourceSeriesRenderModel("line", createSeries());
  const hit = hitTestSeriesPoint(model, 12, {
    plotLeft: 0,
    candleWidth: 10,
    visibleRange: { from: 0, to: 1 }
  });

  expect(hit?.point.sourceIndex).toBe(1);
  expect(hit?.sourceCandle?.time).toBe(2);
});

it("formats neutral tooltip rows from a hit-test result", () => {
  const model = createSourceSeriesRenderModel("candles", createSeries());
  const hit = hitTestSeriesPoint(model, 2, {
    plotLeft: 0,
    candleWidth: 10,
    visibleRange: { from: 0, to: 1 }
  });

  expect(hit ? getDefaultSeriesTooltipRows(hit).map((row) => row.label) : []).toEqual([
    "Time",
    "Open",
    "High",
    "Low",
    "Close",
    "Volume",
    "Turnover"
  ]);
});
```

- [x] **Step 2: Verify the tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/seriesRenderModels.test.ts
```

Expected: FAIL because the helper functions are missing.

- [x] **Step 3: Implement autoscale**

Create `packages/chart-engine/src/series/autoscale.ts`:

```ts
import type { VisibleRange } from "../model/runtime";
import type { SeriesAutoscaleRange, SeriesRenderModel } from "./seriesTypes";

export function getSeriesAutoscaleRange(
  model: SeriesRenderModel,
  visibleRange: VisibleRange
): SeriesAutoscaleRange | undefined {
  const from = Math.max(0, visibleRange.from);
  const to = Math.min(model.points.length - 1, visibleRange.to);

  if (model.points.length === 0 || from > to) {
    return undefined;
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = from; index <= to; index += 1) {
    const point = model.points[index];
    const low = point.low ?? point.close;
    const high = point.high ?? point.close;

    min = Math.min(min, low, point.close);
    max = Math.max(max, high, point.close);
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : undefined;
}
```

- [x] **Step 4: Implement hit-test**

Create `packages/chart-engine/src/series/hitTest.ts`:

```ts
import type { Candle } from "../model/market";
import type { VisibleRange } from "../model/runtime";
import type { SeriesHitTestResult, SeriesRenderModel } from "./seriesTypes";

export interface SeriesHitTestInput {
  plotLeft: number;
  candleWidth: number;
  visibleRange: VisibleRange;
}

export function hitTestSeriesPoint(
  model: SeriesRenderModel,
  x: number,
  input: SeriesHitTestInput
): SeriesHitTestResult | undefined {
  const from = Math.max(0, input.visibleRange.from);
  const to = Math.min(model.points.length - 1, input.visibleRange.to);

  if (model.points.length === 0 || from > to || input.candleWidth <= 0) {
    return undefined;
  }

  const rawIndex = from + Math.floor((x - input.plotLeft) / input.candleWidth);
  const index = Math.max(from, Math.min(to, rawIndex));
  const point = model.points[index];
  const centerX = input.plotLeft + (index - from) * input.candleWidth + input.candleWidth / 2;
  const sourceCandle = getSourceCandle(model, point.sourceIndex);

  return {
    type: model.type,
    point,
    sourceCandle,
    distance: Math.abs(x - centerX)
  };
}

function getSourceCandle(model: SeriesRenderModel, sourceIndex: number | undefined): Candle | undefined {
  if (sourceIndex === undefined) {
    return undefined;
  }

  return model.source.candles[sourceIndex];
}
```

- [x] **Step 5: Implement tooltip rows**

Create `packages/chart-engine/src/series/tooltip.ts`:

```ts
import type { SeriesHitTestResult, SeriesTooltipRow } from "./seriesTypes";

export function getDefaultSeriesTooltipRows(hit: SeriesHitTestResult): SeriesTooltipRow[] {
  const point = hit.point;

  return [
    { label: "Time", value: String(point.time) },
    { label: "Open", value: formatNumber(point.open ?? point.close) },
    { label: "High", value: formatNumber(point.high ?? point.close) },
    { label: "Low", value: formatNumber(point.low ?? point.close) },
    { label: "Close", value: formatNumber(point.close) },
    { label: "Volume", value: formatNumber(point.volume ?? hit.sourceCandle?.volume ?? 0) },
    { label: "Turnover", value: formatNumber(point.turnover ?? hit.sourceCandle?.turnover ?? 0) }
  ];
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
```

- [x] **Step 6: Export helpers**

Add to `packages/chart-engine/src/index.ts`:

```ts
export * from "./series/autoscale";
export * from "./series/hitTest";
export * from "./series/tooltip";
```

- [x] **Step 7: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/seriesRenderModels.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [x] **Step 8: Commit**

```bash
git add packages/chart-engine/src/series packages/chart-engine/src/__tests__/seriesRenderModels.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add series autoscale hit-test and tooltips"
```

### Task 4: Implement Direct Chart Type Renderers

**Files:**

- Create: files under `packages/chart-engine/src/render/series/renderers/`
- Create: `packages/chart-engine/src/render/series/seriesLayer.ts`
- Test: `packages/chart-engine/src/__tests__/seriesRenderers.test.ts`
- Test: `packages/chart-engine/src/__tests__/staticRenderer.test.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Modify: `packages/chart-engine/src/render/staticRenderer.ts`

- [ ] **Step 1: Write failing renderer order and smoke tests**

Create `packages/chart-engine/src/__tests__/seriesRenderers.test.ts` with fake canvas tests for the direct types:

```ts
import { describe, expect, it } from "vitest";
import {
  createDefaultSeriesRendererRegistry,
  createSeriesLayer,
  createSourceSeriesRenderModel,
  type CandleSeries,
  type LayerRenderContext,
  type RenderState
} from "../index";

class FakeCanvasContext {
  calls: string[] = [];
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  beginPath(): void { this.calls.push("beginPath"); }
  moveTo(): void { this.calls.push("moveTo"); }
  lineTo(): void { this.calls.push("lineTo"); }
  rect(): void { this.calls.push("rect"); }
  fill(): void { this.calls.push("fill"); }
  stroke(): void { this.calls.push("stroke"); }
  fillRect(): void { this.calls.push("fillRect"); }
  arc(): void { this.calls.push("arc"); }
  save(): void { this.calls.push("save"); }
  restore(): void { this.calls.push("restore"); }
  clip(): void { this.calls.push("clip"); }
}

function createSeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: [
      { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100, turnover: 1100 },
      { time: 2, open: 11, high: 13, low: 10, close: 10, volume: 120, turnover: 1200 },
      { time: 3, open: 10, high: 15, low: 8, close: 14, volume: 140, turnover: 1960 }
    ]
  };
}

function createRenderState(type = "candles"): RenderState {
  return {
    series: createSeries(),
    viewport: { visibleRange: { from: 0, to: 2 }, candleWidth: 10, scrollOffset: 0, priceScaleMode: "linear" },
    theme: {
      colors: {
        background: "#fff",
        grid: "#eee",
        text: "#111",
        bullishCandle: "#f00",
        bearishCandle: "#0a0",
        volume: "#999",
        crosshair: "#555",
        tooltip: { background: "#111", text: "#fff", border: "#333" },
        maLines: ["#00f"]
      },
      typography: { fontFamily: "system-ui", fontSize: 12 },
      spacing: { axisPadding: 8, panelGap: 8 },
      lineWidths: { grid: 1, candleWick: 1, crosshair: 1, indicator: 2 }
    },
    layout: {
      width: 120,
      height: 100,
      rightAxisWidth: 20,
      bottomAxisHeight: 20,
      plotArea: { x: 0, y: 0, width: 100, height: 80 },
      priceAxisArea: { x: 100, y: 0, width: 20, height: 80 },
      timeAxisArea: { x: 0, y: 80, width: 100, height: 20 }
    },
    seriesType: type
  } as RenderState;
}

function createContext(type: string): LayerRenderContext {
  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    state: createRenderState(type)
  };
}

describe("direct series renderers", () => {
  it.each([
    "bars",
    "candles",
    "hollowCandles",
    "volumeCandles",
    "line",
    "lineWithMarkers",
    "stepLine",
    "area",
    "hlcArea",
    "baseline",
    "columns",
    "highLow"
  ])("renders %s without host data", (type) => {
    const registry = createDefaultSeriesRendererRegistry();
    const layer = createSeriesLayer(registry);
    const context = createContext(type);

    layer.render(context);

    expect((context.context as unknown as FakeCanvasContext).calls.length).toBeGreaterThan(0);
  });

  it("provides registered renderers for direct chart types before synthetic types are added", () => {
    const registry = createDefaultSeriesRendererRegistry();

    expect(registry.list().map((renderer) => renderer.type)).toEqual([
      "bars",
      "candles",
      "hollowCandles",
      "volumeCandles",
      "line",
      "lineWithMarkers",
      "stepLine",
      "area",
      "hlcArea",
      "baseline",
      "columns",
      "highLow"
    ]);
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/seriesRenderers.test.ts
```

Expected: FAIL because direct renderers and `seriesType` render state are missing.

- [ ] **Step 3: Extend render state**

Modify `packages/chart-engine/src/render/renderTypes.ts`:

```ts
import type { SeriesType } from "../series/seriesTypes";

export interface RenderState {
  series: CandleSeries;
  viewport: ViewportState;
  theme: ChartTheme;
  layout: ChartLayout;
  movingAverages?: MovingAveragePoint[][];
  crosshair?: CrosshairState | undefined;
  seriesType?: SeriesType;
}
```

- [ ] **Step 4: Implement `createSeriesLayer`**

Create `packages/chart-engine/src/render/series/seriesLayer.ts`:

```ts
import { createSourceSeriesRenderModel } from "../../series/renderModel";
import type { SeriesRendererRegistry } from "../../series/seriesRegistry";
import type { SeriesType } from "../../series/seriesTypes";
import type { ChartLayer } from "../renderTypes";

export function createSeriesLayer(registry: SeriesRendererRegistry): ChartLayer {
  return {
    id: "series",
    render(context) {
      const type: SeriesType = context.state.seriesType ?? "candles";
      const renderer = registry.require(type);
      const model = createSourceSeriesRenderModel(type, context.state.series);

      renderer.render({
        ...context,
        model,
        layout: context.state.layout
      });
    }
  };
}
```

- [ ] **Step 5: Implement default direct renderers**

Create one renderer file per direct type under `packages/chart-engine/src/render/series/renderers/`. Each renderer must satisfy `SeriesRenderer` and draw using `CanvasRenderingContext2D`. Keep implementations small:

- OHLC-style renderers draw from `open/high/low/close`.
- Line/step/area renderers draw from `close`.
- Columns draw `close` as vertical bars against zero or the visible min baseline.
- Baseline draws two colors split by a baseline value, defaulting to first visible close.
- HLC area fills between high and low.

Create `packages/chart-engine/src/render/series/renderers/defaultSeriesRenderers.ts`:

```ts
import { createSeriesRendererRegistry } from "../../../series/seriesRegistry";
import type { SeriesRendererRegistry } from "../../../series/seriesRegistry";
import { createAreaSeriesRenderer } from "./areaRenderer";
import { createBarsSeriesRenderer } from "./barsRenderer";
import { createBaselineSeriesRenderer } from "./baselineRenderer";
import { createCandlesSeriesRenderer } from "./candlesRenderer";
import { createColumnsSeriesRenderer } from "./columnsRenderer";
import { createHighLowSeriesRenderer } from "./highLowRenderer";
import { createHlcAreaSeriesRenderer } from "./hlcAreaRenderer";
import { createHollowCandlesSeriesRenderer } from "./hollowCandlesRenderer";
import { createLineSeriesRenderer } from "./lineRenderer";
import { createLineWithMarkersSeriesRenderer } from "./lineWithMarkersRenderer";
import { createStepLineSeriesRenderer } from "./stepLineRenderer";
import { createVolumeCandlesSeriesRenderer } from "./volumeCandlesRenderer";

export function createDefaultSeriesRendererRegistry(): SeriesRendererRegistry {
  const registry = createSeriesRendererRegistry();

  registry.register(createBarsSeriesRenderer());
  registry.register(createCandlesSeriesRenderer());
  registry.register(createHollowCandlesSeriesRenderer());
  registry.register(createVolumeCandlesSeriesRenderer());
  registry.register(createLineSeriesRenderer());
  registry.register(createLineWithMarkersSeriesRenderer());
  registry.register(createStepLineSeriesRenderer());
  registry.register(createAreaSeriesRenderer());
  registry.register(createHlcAreaSeriesRenderer());
  registry.register(createBaselineSeriesRenderer());
  registry.register(createColumnsSeriesRenderer());
  registry.register(createHighLowSeriesRenderer());

  return registry;
}
```

- [ ] **Step 6: Wire series layer into static renderer**

Modify `packages/chart-engine/src/render/staticRenderer.ts` so the old candlestick layer is replaced by the registry-backed series layer:

```ts
import { createDefaultSeriesRendererRegistry } from "./series/renderers/defaultSeriesRenderers";
import { createSeriesLayer } from "./series/seriesLayer";

const defaultSeriesRegistry = createDefaultSeriesRendererRegistry();

export function createStaticLayers(): ChartLayer[] {
  return [
    createGridLayer(),
    createAxisLayer(),
    createSeriesLayer(defaultSeriesRegistry),
    createVolumeLayer(),
    createMovingAverageLayer()
  ];
}
```

Keep existing `createCandlestickLayer` export temporarily for compatibility with existing tests until Task 5 updates static renderer tests.

- [ ] **Step 7: Update static renderer tests for the series layer**

Modify `packages/chart-engine/src/__tests__/staticRenderer.test.ts` so deterministic layer order expects `series` instead of `candlestick`:

```ts
expect(createStaticLayers().map((layer) => layer.id)).toEqual([
  "grid",
  "axis",
  "series",
  "volume",
  "movingAverage"
]);
```

Keep the existing direct `createCandlestickLayer()` unit test until all old layer-specific tests are moved to `seriesRenderers.test.ts`.

- [ ] **Step 8: Export direct renderer API**

Add exports to `packages/chart-engine/src/index.ts` for:

```ts
export * from "./render/series/seriesLayer";
export * from "./render/series/renderers/defaultSeriesRenderers";
```

- [ ] **Step 9: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/seriesRenderers.test.ts
npm run test -- packages/chart-engine/src/__tests__/staticRenderer.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add packages/chart-engine/src/render packages/chart-engine/src/__tests__/seriesRenderers.test.ts packages/chart-engine/src/__tests__/staticRenderer.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: render direct chart series types"
```

### Task 5: Add Synthetic Series Transforms

**Files:**

- Create: `packages/chart-engine/src/series/transforms/heikinAshi.ts`
- Create: `packages/chart-engine/src/series/transforms/renko.ts`
- Create: `packages/chart-engine/src/series/transforms/lineBreak.ts`
- Create: `packages/chart-engine/src/series/transforms/kagi.ts`
- Create: `packages/chart-engine/src/series/transforms/pointAndFigure.ts`
- Test: `packages/chart-engine/src/__tests__/syntheticSeries.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing synthetic transform tests**

Create `packages/chart-engine/src/__tests__/syntheticSeries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  transformHeikinAshi,
  transformKagi,
  transformLineBreak,
  transformPointAndFigure,
  transformRenko,
  type CandleSeries
} from "../index";

function createSeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: [
      { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100, turnover: 1100 },
      { time: 2, open: 11, high: 14, low: 10, close: 13, volume: 120, turnover: 1560 },
      { time: 3, open: 13, high: 15, low: 12, close: 12, volume: 90, turnover: 1080 },
      { time: 4, open: 12, high: 16, low: 11, close: 15, volume: 130, turnover: 1950 },
      { time: 5, open: 15, high: 17, low: 14, close: 16, volume: 110, turnover: 1760 }
    ]
  };
}

describe("synthetic series transforms", () => {
  it("creates Heikin Ashi points with source indexes", () => {
    const model = transformHeikinAshi(createSeries());

    expect(model.type).toBe("heikinAshi");
    expect(model.points).toHaveLength(5);
    expect(model.points[0].sourceIndex).toBe(0);
    expect(model.points[0].close).toBe(10.5);
  });

  it("creates Renko bricks with source ranges", () => {
    const model = transformRenko(createSeries(), { brickSize: 2 });

    expect(model.type).toBe("renko");
    expect(model.points.length).toBeGreaterThan(0);
    expect(model.points.every((point) => point.sourceRange)).toBe(true);
  });

  it("creates Line Break points with source traceability", () => {
    const model = transformLineBreak(createSeries(), { lineCount: 3 });

    expect(model.type).toBe("lineBreak");
    expect(model.points.length).toBeGreaterThan(0);
    expect(model.points.every((point) => point.sourceIndex !== undefined)).toBe(true);
  });

  it("creates Kagi points with source traceability", () => {
    const model = transformKagi(createSeries(), { reversalAmount: 2 });

    expect(model.type).toBe("kagi");
    expect(model.points.length).toBeGreaterThan(0);
    expect(model.points.every((point) => point.sourceIndex !== undefined)).toBe(true);
  });

  it("creates Point and Figure columns with source ranges", () => {
    const model = transformPointAndFigure(createSeries(), { boxSize: 1, reversalBoxes: 3 });

    expect(model.type).toBe("pointAndFigure");
    expect(model.points.length).toBeGreaterThan(0);
    expect(model.points.every((point) => point.sourceRange)).toBe(true);
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/syntheticSeries.test.ts
```

Expected: FAIL because transform functions are missing.

- [ ] **Step 3: Implement deterministic synthetic transforms**

Implement each transform as a pure function returning `SeriesRenderModel`.

Rules:

- `transformHeikinAshi(series)` computes standard HA open/high/low/close and preserves `sourceIndex`.
- `transformRenko(series, { brickSize })` builds close-based bricks and records `sourceRange`.
- `transformLineBreak(series, { lineCount })` builds close-based line break points and records `sourceIndex`.
- `transformKagi(series, { reversalAmount })` builds close-based reversal points and records `sourceIndex`.
- `transformPointAndFigure(series, { boxSize, reversalBoxes })` builds close-based X/O-style columns represented as render points and records `sourceRange`.
- Empty series returns an empty model of the requested type.
- Invalid `brickSize`, `lineCount`, `reversalAmount`, `boxSize`, or `reversalBoxes` throws a clear `Error`.

- [ ] **Step 4: Export transform functions**

Add to `packages/chart-engine/src/index.ts`:

```ts
export * from "./series/transforms/heikinAshi";
export * from "./series/transforms/renko";
export * from "./series/transforms/lineBreak";
export * from "./series/transforms/kagi";
export * from "./series/transforms/pointAndFigure";
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/syntheticSeries.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/series/transforms packages/chart-engine/src/__tests__/syntheticSeries.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add synthetic chart transforms"
```

### Task 6: Register Synthetic Chart Renderers and Hit Tests

**Files:**

- Create: `packages/chart-engine/src/render/series/renderers/syntheticOhlcRenderer.ts`
- Modify: `packages/chart-engine/src/render/series/seriesLayer.ts`
- Modify: `packages/chart-engine/src/render/series/renderers/defaultSeriesRenderers.ts`
- Test: `packages/chart-engine/src/__tests__/seriesRenderers.test.ts`

- [ ] **Step 1: Add failing synthetic renderer tests**

Extend `seriesRenderers.test.ts`:

```ts
it.each(["heikinAshi", "renko", "lineBreak", "kagi", "pointAndFigure"])(
  "renders synthetic chart type %s through default registry",
  (type) => {
    const registry = createDefaultSeriesRendererRegistry();
    const layer = createSeriesLayer(registry);
    const context = createContext(type);

    layer.render(context);

    expect((context.context as unknown as FakeCanvasContext).calls.length).toBeGreaterThan(0);
  }
);
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/seriesRenderers.test.ts
```

Expected: FAIL because synthetic renderers are not registered or transformed.

- [ ] **Step 3: Update series layer to build synthetic models**

Modify `packages/chart-engine/src/render/series/seriesLayer.ts` so it routes synthetic types through transform functions:

```ts
import { transformHeikinAshi } from "../../series/transforms/heikinAshi";
import { transformKagi } from "../../series/transforms/kagi";
import { transformLineBreak } from "../../series/transforms/lineBreak";
import { transformPointAndFigure } from "../../series/transforms/pointAndFigure";
import { transformRenko } from "../../series/transforms/renko";

function createRenderModel(type: SeriesType, series: CandleSeries): SeriesRenderModel {
  if (type === "heikinAshi") return transformHeikinAshi(series);
  if (type === "renko") return transformRenko(series, { brickSize: 2 });
  if (type === "lineBreak") return transformLineBreak(series, { lineCount: 3 });
  if (type === "kagi") return transformKagi(series, { reversalAmount: 2 });
  if (type === "pointAndFigure") return transformPointAndFigure(series, { boxSize: 1, reversalBoxes: 3 });

  return createSourceSeriesRenderModel(type, series);
}
```

- [ ] **Step 4: Implement synthetic renderer**

Create `packages/chart-engine/src/render/series/renderers/syntheticOhlcRenderer.ts` that renders synthetic points as OHLC/candle-like marks using `open/high/low/close` when available and close-only marks when synthetic point shape is close-only. Export:

```ts
export function createSyntheticOhlcSeriesRenderer(type: SeriesType): SeriesRenderer
```

The renderer must delegate autoscale to `getSeriesAutoscaleRange`, hit-test to `hitTestSeriesPoint`, and tooltip rows to `getDefaultSeriesTooltipRows`.

- [ ] **Step 5: Register synthetic renderers**

Modify `defaultSeriesRenderers.ts`:

```ts
registry.register(createSyntheticOhlcSeriesRenderer("heikinAshi"));
registry.register(createSyntheticOhlcSeriesRenderer("renko"));
registry.register(createSyntheticOhlcSeriesRenderer("lineBreak"));
registry.register(createSyntheticOhlcSeriesRenderer("kagi"));
registry.register(createSyntheticOhlcSeriesRenderer("pointAndFigure"));
```

- [ ] **Step 6: Update registry list test to include all 17 renderers**

Modify the registry list assertion in `seriesRenderers.test.ts`:

```ts
expect(registry.list().map((renderer) => renderer.type)).toEqual([
  "bars",
  "candles",
  "hollowCandles",
  "volumeCandles",
  "line",
  "lineWithMarkers",
  "stepLine",
  "area",
  "hlcArea",
  "baseline",
  "columns",
  "highLow",
  "heikinAshi",
  "renko",
  "lineBreak",
  "kagi",
  "pointAndFigure"
]);
```

- [ ] **Step 7: Verify all 17 renderers**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/seriesRenderers.test.ts
npm run test -- packages/chart-engine/src/__tests__/syntheticSeries.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/chart-engine/src/render/series packages/chart-engine/src/__tests__/seriesRenderers.test.ts
git commit -m "feat: render synthetic chart types"
```

### Task 7: Add Playground Chart Type Selector and E2E

**Files:**

- Create: `apps/playground/src/playgroundState.ts`
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/src/styles.css`
- Create: `apps/playground/tests/chart-types.spec.ts`

- [ ] **Step 1: Write failing chart type E2E**

Create `apps/playground/tests/chart-types.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const chartTypes = [
  "bars",
  "candles",
  "hollowCandles",
  "volumeCandles",
  "line",
  "lineWithMarkers",
  "stepLine",
  "area",
  "hlcArea",
  "baseline",
  "columns",
  "highLow",
  "heikinAshi",
  "renko",
  "lineBreak",
  "kagi",
  "pointAndFigure"
];

test("can switch every v0.1 chart type", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chart-canvas")).toBeVisible();

  for (const type of chartTypes) {
    await page.getByTestId("series-type").selectOption(type);
    await expect(page.getByTestId("active-series-type")).toHaveText(type);
    await expect.poll(() =>
      page.getByTestId("chart-canvas").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const context = canvas.getContext("2d");
        if (!context) return 0;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let nonTransparent = 0;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] !== 0) nonTransparent += 1;
        }
        return nonTransparent;
      })
    ).toBeGreaterThan(1000);
  }
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/chart-types.spec.ts
```

Expected: FAIL because `series-type` and `active-series-type` controls are missing.

- [ ] **Step 3: Add playground state**

Create `apps/playground/src/playgroundState.ts`:

```ts
import type { SeriesType } from "@simoncharts/chart-engine";

export interface PlaygroundState {
  seriesType: SeriesType;
}

export const playgroundState: PlaygroundState = {
  seriesType: "candles"
};
```

- [ ] **Step 4: Add chart type selector**

Modify `apps/playground/src/main.ts`:

- import `supportedSeriesTypes`.
- create a `<select data-testid="series-type">`.
- create a status label `<span data-testid="active-series-type">`.
- on select change, update `playgroundState.seriesType`, update label text, and re-render static + overlay canvases.
- pass `seriesType: playgroundState.seriesType` into `RenderState`.

- [ ] **Step 5: Style selector**

Add to `apps/playground/src/styles.css`:

```css
.top-controls {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
}

.top-controls select {
  height: 28px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: #ffffff;
}
```

- [ ] **Step 6: Verify**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/chart-types.spec.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/playground/src apps/playground/tests/chart-types.spec.ts
git commit -m "feat: add playground chart type selector"
```

---

## Milestone V0.1-B: Visual Output + Panel Engine

### Task 8: Define Panel Layout Contracts

**Files:**

- Create: `packages/chart-engine/src/panels/panelTypes.ts`
- Create: `packages/chart-engine/src/panels/panelLayout.ts`
- Create: `packages/chart-engine/src/panels/panelScales.ts`
- Test: `packages/chart-engine/src/__tests__/panelEngine.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing panel tests**

Create `packages/chart-engine/src/__tests__/panelEngine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createPanelLayout, type PanelDefinition } from "../index";

describe("panel engine", () => {
  it("allocates one main panel and sub panels with shared x geometry", () => {
    const panels: PanelDefinition[] = [
      { id: "main", kind: "main", label: "Price", heightRatio: 3 },
      { id: "macd", kind: "sub", label: "MACD", heightRatio: 1 }
    ];

    expect(createPanelLayout({ width: 500, height: 400, rightAxisWidth: 64, bottomAxisHeight: 28, panels })).toEqual([
      {
        id: "main",
        kind: "main",
        label: "Price",
        plotArea: { x: 0, y: 0, width: 436, height: 279 },
        priceAxisArea: { x: 436, y: 0, width: 64, height: 279 }
      },
      {
        id: "macd",
        kind: "sub",
        label: "MACD",
        plotArea: { x: 0, y: 279, width: 436, height: 93 },
        priceAxisArea: { x: 436, y: 279, width: 64, height: 93 }
      }
    ]);
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/panelEngine.test.ts
```

Expected: FAIL because panel contracts are missing.

- [ ] **Step 3: Implement panel types**

Create `packages/chart-engine/src/panels/panelTypes.ts`:

```ts
import type { IndicatorPanelKind } from "../model/visual";

export interface PanelDefinition {
  id: string;
  kind: IndicatorPanelKind;
  label: string;
  heightRatio: number;
}

export interface PanelArea {
  id: string;
  kind: IndicatorPanelKind;
  label: string;
  plotArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  priceAxisArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

- [ ] **Step 4: Implement panel layout**

Create `packages/chart-engine/src/panels/panelLayout.ts`:

```ts
import type { PanelArea, PanelDefinition } from "./panelTypes";

export interface CreatePanelLayoutInput {
  width: number;
  height: number;
  rightAxisWidth: number;
  bottomAxisHeight: number;
  panels: PanelDefinition[];
}

export function createPanelLayout(input: CreatePanelLayoutInput): PanelArea[] {
  const chartHeight = Math.max(0, input.height - input.bottomAxisHeight);
  const plotWidth = Math.max(0, input.width - input.rightAxisWidth);
  const totalRatio = input.panels.reduce((sum, panel) => sum + Math.max(0, panel.heightRatio), 0);

  if (input.panels.length === 0 || totalRatio <= 0) {
    return [];
  }

  let y = 0;

  return input.panels.map((panel, index) => {
    const remainingHeight = chartHeight - y;
    const rawHeight = index === input.panels.length - 1
      ? remainingHeight
      : Math.floor((chartHeight * Math.max(0, panel.heightRatio)) / totalRatio);
    const height = Math.max(0, rawHeight);
    const area: PanelArea = {
      id: panel.id,
      kind: panel.kind,
      label: panel.label,
      plotArea: { x: 0, y, width: plotWidth, height },
      priceAxisArea: { x: plotWidth, y, width: input.rightAxisWidth, height }
    };

    y += height;

    return area;
  });
}
```

- [ ] **Step 5: Implement panel scale lookup helper**

Create `packages/chart-engine/src/panels/panelScales.ts`:

```ts
import type { PanelArea } from "./panelTypes";

export function findPanelArea(panels: PanelArea[], panelId: string): PanelArea | undefined {
  return panels.find((panel) => panel.id === panelId);
}
```

- [ ] **Step 6: Export panel API**

Add to `packages/chart-engine/src/index.ts`:

```ts
export * from "./panels/panelLayout";
export * from "./panels/panelScales";
export * from "./panels/panelTypes";
```

- [ ] **Step 7: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/panelEngine.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/chart-engine/src/panels packages/chart-engine/src/__tests__/panelEngine.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add panel layout engine"
```

### Task 9: Define Visual Renderer Registry

**Files:**

- Create: `packages/chart-engine/src/visuals/visualTypes.ts`
- Create: `packages/chart-engine/src/visuals/visualRegistry.ts`
- Create: `packages/chart-engine/src/visuals/visualAutoscale.ts`
- Create: `packages/chart-engine/src/visuals/visualHitTest.ts`
- Create: `packages/chart-engine/src/visuals/visualTooltip.ts`
- Test: `packages/chart-engine/src/__tests__/visualRegistry.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing visual registry tests**

Create `packages/chart-engine/src/__tests__/visualRegistry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createVisualRendererRegistry, type VisualRenderer } from "../index";

describe("visual renderer registry", () => {
  it("registers and retrieves a renderer by visual output type", () => {
    const registry = createVisualRendererRegistry();
    const renderer: VisualRenderer = {
      type: "line",
      render() {},
      getAutoscale() { return undefined; },
      hitTest() { return undefined; },
      getTooltipRows() { return []; }
    };

    registry.register(renderer);

    expect(registry.require("line")).toBe(renderer);
  });

  it("throws a clear error for missing visual renderer", () => {
    const registry = createVisualRendererRegistry();

    expect(() => registry.require("band")).toThrow("Visual renderer is not registered: band");
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/visualRegistry.test.ts
```

Expected: FAIL because the visual registry is missing.

- [ ] **Step 3: Implement visual types**

Create `packages/chart-engine/src/visuals/visualTypes.ts`:

```ts
import type { IndicatorVisualOutput } from "../model/visual";
import type { PanelArea } from "../panels/panelTypes";
import type { LayerRenderContext } from "../render/renderTypes";

export type VisualOutputType = IndicatorVisualOutput["type"];

export interface VisualRenderContext extends LayerRenderContext {
  output: IndicatorVisualOutput;
  panel: PanelArea;
}

export interface VisualAutoscaleRange {
  min: number;
  max: number;
}

export interface VisualHitTestResult {
  outputId: string;
  outputType: VisualOutputType;
  time: number;
  value?: number;
  distance: number;
}

export interface VisualTooltipRow {
  label: string;
  value: string;
}

export interface VisualRenderer {
  type: VisualOutputType;
  render(context: VisualRenderContext): void;
  getAutoscale(output: IndicatorVisualOutput): VisualAutoscaleRange | undefined;
  hitTest(output: IndicatorVisualOutput, x: number, y: number): VisualHitTestResult | undefined;
  getTooltipRows(hit: VisualHitTestResult): VisualTooltipRow[];
}
```

- [ ] **Step 4: Implement visual registry**

Create `packages/chart-engine/src/visuals/visualRegistry.ts`:

```ts
import type { VisualOutputType, VisualRenderer } from "./visualTypes";

export interface VisualRendererRegistry {
  register(renderer: VisualRenderer): void;
  get(type: VisualOutputType): VisualRenderer | undefined;
  require(type: VisualOutputType): VisualRenderer;
  list(): VisualRenderer[];
}

export function createVisualRendererRegistry(): VisualRendererRegistry {
  const renderers = new Map<VisualOutputType, VisualRenderer>();

  return {
    register(renderer) {
      renderers.set(renderer.type, renderer);
    },
    get(type) {
      return renderers.get(type);
    },
    require(type) {
      const renderer = renderers.get(type);

      if (!renderer) {
        throw new Error(`Visual renderer is not registered: ${type}`);
      }

      return renderer;
    },
    list() {
      return [...renderers.values()];
    }
  };
}
```

- [ ] **Step 5: Add neutral helper modules**

Create `visualTooltip.ts` with:

```ts
export function formatVisualValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
```

Create `visualAutoscale.ts` with:

```ts
import type { VisualAutoscaleRange } from "./visualTypes";

export function mergeVisualAutoscaleRanges(
  ranges: Array<VisualAutoscaleRange | undefined>
): VisualAutoscaleRange | undefined {
  const defined = ranges.filter((range): range is VisualAutoscaleRange => range !== undefined);

  if (defined.length === 0) {
    return undefined;
  }

  return {
    min: Math.min(...defined.map((range) => range.min)),
    max: Math.max(...defined.map((range) => range.max))
  };
}
```

Create `visualHitTest.ts` with:

```ts
import type { VisualHitTestResult } from "./visualTypes";

export function chooseNearestVisualHit(
  hits: Array<VisualHitTestResult | undefined>
): VisualHitTestResult | undefined {
  return hits
    .filter((hit): hit is VisualHitTestResult => hit !== undefined)
    .sort((left, right) => left.distance - right.distance)[0];
}
```

- [ ] **Step 6: Export visual API**

Add to `packages/chart-engine/src/index.ts`:

```ts
export * from "./visuals/visualAutoscale";
export * from "./visuals/visualHitTest";
export * from "./visuals/visualRegistry";
export * from "./visuals/visualTooltip";
export * from "./visuals/visualTypes";
```

- [ ] **Step 7: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/visualRegistry.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/chart-engine/src/visuals packages/chart-engine/src/__tests__/visualRegistry.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add visual renderer registry"
```

### Task 10: Implement Visual Output Renderers

**Files:**

- Create: `packages/chart-engine/src/render/visuals/visualLayer.ts`
- Create: `packages/chart-engine/src/render/visuals/renderers/lineVisualRenderer.ts`
- Create: `packages/chart-engine/src/render/visuals/renderers/histogramVisualRenderer.ts`
- Create: `packages/chart-engine/src/render/visuals/renderers/bandVisualRenderer.ts`
- Create: `packages/chart-engine/src/render/visuals/renderers/markerVisualRenderer.ts`
- Test: `packages/chart-engine/src/__tests__/visualRenderers.test.ts`
- Modify: `packages/chart-engine/src/render/renderTypes.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing visual renderer tests**

Create `packages/chart-engine/src/__tests__/visualRenderers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createBandVisualRenderer,
  createHistogramVisualRenderer,
  createLineVisualRenderer,
  createMarkerVisualRenderer,
  type IndicatorVisualOutput
} from "../index";

class FakeCanvasContext {
  calls: string[] = [];
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  beginPath(): void { this.calls.push("beginPath"); }
  moveTo(): void { this.calls.push("moveTo"); }
  lineTo(): void { this.calls.push("lineTo"); }
  fill(): void { this.calls.push("fill"); }
  stroke(): void { this.calls.push("stroke"); }
  fillRect(): void { this.calls.push("fillRect"); }
  arc(): void { this.calls.push("arc"); }
}

describe("visual renderers", () => {
  it.each([
    ["line", createLineVisualRenderer()],
    ["histogram", createHistogramVisualRenderer()],
    ["band", createBandVisualRenderer()],
    ["marker", createMarkerVisualRenderer()]
  ])("renders %s output", (_type, renderer) => {
    const output = createOutput(renderer.type);
    const context = createVisualContext(output);

    renderer.render(context);

    expect((context.context as unknown as FakeCanvasContext).calls.length).toBeGreaterThan(0);
  });
});

function createOutput(type: IndicatorVisualOutput["type"]): IndicatorVisualOutput {
  if (type === "line") return { type, id: "line", label: "Line", values: [{ time: 1, value: 10 }, { time: 2, value: 11 }] };
  if (type === "histogram") return { type, id: "hist", label: "Histogram", values: [{ time: 1, value: 1 }, { time: 2, value: -1 }] };
  if (type === "band") return { type, id: "band", label: "Band", upper: [{ time: 1, value: 12 }], lower: [{ time: 1, value: 8 }] };
  return { type, id: "marker", label: "Marker", marks: [{ id: "m1", time: 1, price: 10, label: "M" }] };
}

function createVisualContext(output: IndicatorVisualOutput) {
  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    output,
    panel: {
      id: "main",
      kind: "main",
      label: "Price",
      plotArea: { x: 0, y: 0, width: 100, height: 80 },
      priceAxisArea: { x: 100, y: 0, width: 40, height: 80 }
    },
    state: {
      series: {
        symbol: "TEST",
        timeframe: "1d",
        adjustMode: "none",
        dataVersion: "test",
        candles: [{ time: 1, open: 10, high: 12, low: 8, close: 11, volume: 100, turnover: 1100 }]
      },
      viewport: { visibleRange: { from: 0, to: 0 }, candleWidth: 10, scrollOffset: 0, priceScaleMode: "linear" },
      theme: {
        colors: {
          background: "#fff",
          grid: "#eee",
          text: "#111",
          bullishCandle: "#f00",
          bearishCandle: "#0a0",
          volume: "#999",
          crosshair: "#555",
          tooltip: { background: "#111", text: "#fff", border: "#333" },
          maLines: ["#00f"]
        },
        typography: { fontFamily: "system-ui", fontSize: 12 },
        spacing: { axisPadding: 8, panelGap: 8 },
        lineWidths: { grid: 1, candleWick: 1, crosshair: 1, indicator: 2 }
      },
      layout: {
        width: 140,
        height: 100,
        rightAxisWidth: 40,
        bottomAxisHeight: 20,
        plotArea: { x: 0, y: 0, width: 100, height: 80 },
        priceAxisArea: { x: 100, y: 0, width: 40, height: 80 },
        timeAxisArea: { x: 0, y: 80, width: 100, height: 20 }
      }
    }
  };
}
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/visualRenderers.test.ts
```

Expected: FAIL because visual renderers are missing.

- [ ] **Step 3: Extend render state for visuals and panels**

Modify `packages/chart-engine/src/render/renderTypes.ts`:

```ts
import type { IndicatorVisualOutput } from "../model/visual";
import type { PanelArea } from "../panels/panelTypes";

export interface RenderState {
  series: CandleSeries;
  viewport: ViewportState;
  theme: ChartTheme;
  layout: ChartLayout;
  movingAverages?: MovingAveragePoint[][];
  crosshair?: CrosshairState | undefined;
  seriesType?: SeriesType;
  panels?: PanelArea[];
  visualOutputs?: IndicatorVisualOutput[];
}
```

- [ ] **Step 4: Implement four visual renderers**

Create renderer files. Each exports one factory:

```ts
export function createLineVisualRenderer(): VisualRenderer
export function createHistogramVisualRenderer(): VisualRenderer
export function createBandVisualRenderer(): VisualRenderer
export function createMarkerVisualRenderer(): VisualRenderer
```

Each renderer:

- draws only within its panel plot area;
- skips `null` line/band values;
- uses output color/style override when present;
- returns autoscale range from its values;
- returns neutral tooltip rows from hit results;
- does not read host metadata.

- [ ] **Step 5: Implement visual layer**

Create `packages/chart-engine/src/render/visuals/visualLayer.ts`:

```ts
import type { VisualRendererRegistry } from "../../visuals/visualRegistry";
import type { ChartLayer } from "../renderTypes";

export function createVisualLayer(registry: VisualRendererRegistry): ChartLayer {
  return {
    id: "visuals",
    render(context) {
      const outputs = context.state.visualOutputs ?? [];
      const panels = context.state.panels ?? [];

      for (const output of outputs) {
        const panel = panels.find((candidate) => candidate.id === "main") ?? panels[0];

        if (!panel) {
          continue;
        }

        registry.require(output.type).render({
          ...context,
          output,
          panel
        });
      }
    }
  };
}
```

- [ ] **Step 6: Export visual renderers**

Add exports:

```ts
export * from "./render/visuals/visualLayer";
export * from "./render/visuals/renderers/bandVisualRenderer";
export * from "./render/visuals/renderers/histogramVisualRenderer";
export * from "./render/visuals/renderers/lineVisualRenderer";
export * from "./render/visuals/renderers/markerVisualRenderer";
```

- [ ] **Step 7: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/visualRenderers.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/chart-engine/src/render/visuals packages/chart-engine/src/render/renderTypes.ts packages/chart-engine/src/__tests__/visualRenderers.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: render visual outputs"
```

### Task 11: Add Playground Visual Panels

**Files:**

- Create: `apps/playground/src/fixtures/visualFixtures.ts`
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/src/styles.css`
- Create: `apps/playground/tests/visual-panels.spec.ts`

- [ ] **Step 1: Write failing E2E for panel and visual outputs**

Create `apps/playground/tests/visual-panels.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("renders main and sub panel visual outputs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chart-canvas")).toBeVisible();
  await expect(page.getByTestId("panel-count")).toHaveText("2 panels");
  await expect(page.getByTestId("visual-output-count")).toHaveText("4 visuals");

  await expect.poll(() =>
    page.getByTestId("chart-canvas").evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (!context) return 0;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonTransparent = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 0) nonTransparent += 1;
      }
      return nonTransparent;
    })
  ).toBeGreaterThan(1000);
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/visual-panels.spec.ts
```

Expected: FAIL because panel count and visual output controls are missing.

- [ ] **Step 3: Add visual fixtures**

Create `apps/playground/src/fixtures/visualFixtures.ts`:

```ts
import type { IndicatorVisualOutput } from "@simoncharts/chart-engine";

export const playgroundVisualOutputs: IndicatorVisualOutput[] = [
  {
    type: "line",
    id: "fixture-line",
    label: "Fixture Line",
    values: [
      { time: 1, value: 10 },
      { time: 2, value: 11 }
    ],
    color: "#2563eb"
  },
  {
    type: "band",
    id: "fixture-band",
    label: "Fixture Band",
    upper: [{ time: 1, value: 12 }, { time: 2, value: 13 }],
    lower: [{ time: 1, value: 8 }, { time: 2, value: 9 }],
    fill: "rgba(37, 99, 235, 0.14)"
  },
  {
    type: "histogram",
    id: "fixture-histogram",
    label: "Fixture Histogram",
    values: [{ time: 1, value: 1 }, { time: 2, value: -1 }]
  },
  {
    type: "marker",
    id: "fixture-marker",
    label: "Fixture Marker",
    marks: [{ id: "marker-1", time: 1, price: 10, label: "M" }]
  }
];
```

- [ ] **Step 4: Wire panels and visual outputs into playground render state**

Modify `main.ts` to:

- create main and sub panel definitions;
- call `createPanelLayout`;
- pass `panels` and `visualOutputs` into render state;
- render visual layer through registered visual renderers;
- add `data-testid="panel-count"` and `data-testid="visual-output-count"` labels.

- [ ] **Step 5: Verify**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/visual-panels.spec.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/playground/src apps/playground/tests/visual-panels.spec.ts
git commit -m "feat: demonstrate visual panels in playground"
```

---

## Milestone V0.1-C: Drawing Object Model + Rendering

### Task 12: Define Drawing Model and Serialization

**Files:**

- Create: `packages/chart-engine/src/drawing/drawingTypes.ts`
- Create: `packages/chart-engine/src/drawing/drawingSerialization.ts`
- Test: `packages/chart-engine/src/__tests__/drawingModel.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing drawing model tests**

Create `packages/chart-engine/src/__tests__/drawingModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  drawingTypes,
  parseDrawingObject,
  serializeDrawingObject,
  type DrawingObject
} from "../index";

describe("drawing model", () => {
  it("declares v0.1 drawing types", () => {
    expect(drawingTypes).toContain("trendLine");
    expect(drawingTypes).toContain("fibonacciRetracement");
    expect(drawingTypes).toContain("datePriceRange");
  });

  it("round-trips a neutral drawing object", () => {
    const drawing: DrawingObject = {
      id: "d1",
      type: "trendLine",
      anchors: [
        { time: 1, price: 10 },
        { time: 2, price: 12 }
      ],
      style: { color: "#2563eb", lineWidth: 2 },
      visible: true,
      locked: false,
      metadata: { hostId: "opaque" }
    };

    expect(parseDrawingObject(serializeDrawingObject(drawing))).toEqual(drawing);
  });

  it("rejects unsupported drawing types with a clear error", () => {
    expect(() =>
      parseDrawingObject({
        id: "bad",
        type: "hostReview",
        anchors: []
      })
    ).toThrow("Unsupported drawing type: hostReview");
  });
});

function createLayerContext(drawings: DrawingObject[]) {
  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    state: {
      series: {
        symbol: "TEST",
        timeframe: "1d",
        adjustMode: "none",
        dataVersion: "test",
        candles: [{ time: 1, open: 10, high: 12, low: 8, close: 11, volume: 100, turnover: 1100 }]
      },
      viewport: { visibleRange: { from: 0, to: 0 }, candleWidth: 10, scrollOffset: 0, priceScaleMode: "linear" },
      theme: {
        colors: {
          background: "#fff",
          grid: "#eee",
          text: "#111",
          bullishCandle: "#f00",
          bearishCandle: "#0a0",
          volume: "#999",
          crosshair: "#555",
          tooltip: { background: "#111", text: "#fff", border: "#333" },
          maLines: ["#00f"]
        },
        typography: { fontFamily: "system-ui", fontSize: 12 },
        spacing: { axisPadding: 8, panelGap: 8 },
        lineWidths: { grid: 1, candleWick: 1, crosshair: 1, indicator: 2 }
      },
      layout: {
        width: 140,
        height: 100,
        rightAxisWidth: 40,
        bottomAxisHeight: 20,
        plotArea: { x: 0, y: 0, width: 100, height: 80 },
        priceAxisArea: { x: 100, y: 0, width: 40, height: 80 },
        timeAxisArea: { x: 0, y: 80, width: 100, height: 20 }
      },
      drawings
    }
  };
}
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingModel.test.ts
```

Expected: FAIL because drawing model exports are missing.

- [ ] **Step 3: Implement drawing types**

Create `packages/chart-engine/src/drawing/drawingTypes.ts`:

```ts
export const drawingTypes = [
  "trendLine",
  "ray",
  "extendedLine",
  "horizontalLine",
  "verticalLine",
  "crossLine",
  "parallelChannel",
  "regressionChannel",
  "fibonacciRetracement",
  "fibonacciExtension",
  "text",
  "callout",
  "rectangle",
  "rotatedRectangle",
  "circle",
  "ellipse",
  "polygon",
  "path",
  "brush",
  "arrow",
  "longPosition",
  "shortPosition",
  "datePriceRange"
] as const;

export type DrawingType = (typeof drawingTypes)[number];

export interface DrawingAnchor {
  time?: number;
  index?: number;
  price?: number;
  x?: number;
  y?: number;
}

export interface DrawingStyle {
  color?: string;
  lineWidth?: number;
  lineDash?: number[];
  fill?: string;
  textColor?: string;
  fontSize?: number;
}

export interface DrawingObject {
  id: string;
  type: DrawingType;
  anchors: DrawingAnchor[];
  style?: DrawingStyle;
  text?: string;
  visible?: boolean;
  locked?: boolean;
  metadata?: Record<string, unknown>;
}
```

- [ ] **Step 4: Implement serialization**

Create `packages/chart-engine/src/drawing/drawingSerialization.ts`:

```ts
import { drawingTypes, type DrawingObject } from "./drawingTypes";

export function serializeDrawingObject(drawing: DrawingObject): DrawingObject {
  return JSON.parse(JSON.stringify(drawing)) as DrawingObject;
}

export function parseDrawingObject(value: unknown): DrawingObject {
  if (!isRecord(value)) {
    throw new Error("Drawing object must be an object");
  }

  if (typeof value.id !== "string") {
    throw new Error("Drawing object id must be a string");
  }

  if (typeof value.type !== "string" || !drawingTypes.includes(value.type as DrawingObject["type"])) {
    throw new Error(`Unsupported drawing type: ${String(value.type)}`);
  }

  if (!Array.isArray(value.anchors)) {
    throw new Error("Drawing object anchors must be an array");
  }

  return serializeDrawingObject(value as DrawingObject);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

- [ ] **Step 5: Export drawing model**

Add to `packages/chart-engine/src/index.ts`:

```ts
export * from "./drawing/drawingSerialization";
export * from "./drawing/drawingTypes";
```

- [ ] **Step 6: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingModel.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/chart-engine/src/drawing packages/chart-engine/src/__tests__/drawingModel.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: define neutral drawing model"
```

### Task 13: Add Drawing Geometry, Registry, and Hit Tests

**Files:**

- Create: `packages/chart-engine/src/drawing/drawingGeometry.ts`
- Create: `packages/chart-engine/src/drawing/drawingRegistry.ts`
- Create: `packages/chart-engine/src/drawing/drawingHitTest.ts`
- Test: `packages/chart-engine/src/__tests__/drawingModel.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Add failing drawing geometry tests**

Append to `drawingModel.test.ts`:

```ts
import {
  createDrawingRendererRegistry,
  getDrawingBounds,
  hitTestDrawingAnchor,
  type DrawingRenderer
} from "../index";

it("computes drawing bounds from anchors", () => {
  expect(getDrawingBounds({
    id: "d1",
    type: "rectangle",
    anchors: [{ x: 10, y: 20 }, { x: 30, y: 40 }]
  })).toEqual({ x: 10, y: 20, width: 20, height: 20 });
});

it("hit-tests drawing anchors", () => {
  const hit = hitTestDrawingAnchor({
    id: "d1",
    type: "trendLine",
    anchors: [{ x: 10, y: 20 }, { x: 30, y: 40 }]
  }, { x: 11, y: 21 }, 4);

  expect(hit).toEqual({ drawingId: "d1", anchorIndex: 0, distance: expect.any(Number) });
});

it("registers drawing renderers by type", () => {
  const registry = createDrawingRendererRegistry();
  const renderer: DrawingRenderer = { type: "trendLine", render() {}, hitTest() { return undefined; } };

  registry.register(renderer);

  expect(registry.require("trendLine")).toBe(renderer);
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingModel.test.ts
```

Expected: FAIL because geometry, hit-test, and registry functions are missing.

- [ ] **Step 3: Implement geometry and hit tests**

Create `drawingGeometry.ts` and `drawingHitTest.ts`:

```ts
import type { DrawingObject } from "./drawingTypes";

export interface DrawingBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getDrawingBounds(drawing: DrawingObject): DrawingBounds | undefined {
  const points = drawing.anchors.filter((anchor) => anchor.x !== undefined && anchor.y !== undefined);

  if (points.length === 0) {
    return undefined;
  }

  const xs = points.map((point) => point.x as number);
  const ys = points.map((point) => point.y as number);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
```

```ts
import type { DrawingObject } from "./drawingTypes";

export interface DrawingAnchorHit {
  drawingId: string;
  anchorIndex: number;
  distance: number;
}

export function hitTestDrawingAnchor(
  drawing: DrawingObject,
  point: { x: number; y: number },
  radius: number
): DrawingAnchorHit | undefined {
  let best: DrawingAnchorHit | undefined;

  drawing.anchors.forEach((anchor, anchorIndex) => {
    if (anchor.x === undefined || anchor.y === undefined) {
      return;
    }

    const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);

    if (distance <= radius && (!best || distance < best.distance)) {
      best = { drawingId: drawing.id, anchorIndex, distance };
    }
  });

  return best;
}
```

- [ ] **Step 4: Implement drawing renderer registry**

Create `packages/chart-engine/src/drawing/drawingRegistry.ts`:

```ts
import type { DrawingObject, DrawingType } from "./drawingTypes";

export interface DrawingRenderContext {
  drawing: DrawingObject;
  context: CanvasRenderingContext2D;
}

export interface DrawingHitTestResult {
  drawingId: string;
  distance: number;
}

export interface DrawingRenderer {
  type: DrawingType;
  render(context: DrawingRenderContext): void;
  hitTest(drawing: DrawingObject, point: { x: number; y: number }): DrawingHitTestResult | undefined;
}

export interface DrawingRendererRegistry {
  register(renderer: DrawingRenderer): void;
  require(type: DrawingType): DrawingRenderer;
  list(): DrawingRenderer[];
}

export function createDrawingRendererRegistry(): DrawingRendererRegistry {
  const renderers = new Map<DrawingType, DrawingRenderer>();

  return {
    register(renderer) {
      renderers.set(renderer.type, renderer);
    },
    require(type) {
      const renderer = renderers.get(type);

      if (!renderer) {
        throw new Error(`Drawing renderer is not registered: ${type}`);
      }

      return renderer;
    },
    list() {
      return [...renderers.values()];
    }
  };
}
```

- [ ] **Step 5: Export drawing helpers**

Add to `packages/chart-engine/src/index.ts`:

```ts
export * from "./drawing/drawingGeometry";
export * from "./drawing/drawingHitTest";
export * from "./drawing/drawingRegistry";
```

- [ ] **Step 6: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingModel.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/chart-engine/src/drawing packages/chart-engine/src/__tests__/drawingModel.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add drawing geometry and registry"
```

### Task 14: Implement Drawing Renderers

**Files:**

- Create: files under `packages/chart-engine/src/render/drawing/`
- Test: `packages/chart-engine/src/__tests__/drawingRenderers.test.ts`
- Modify: `packages/chart-engine/src/render/renderTypes.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing drawing renderer tests**

Create `packages/chart-engine/src/__tests__/drawingRenderers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultDrawingRendererRegistry, createDrawingLayer, type DrawingObject } from "../index";

class FakeCanvasContext {
  calls: string[] = [];
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  beginPath(): void { this.calls.push("beginPath"); }
  moveTo(): void { this.calls.push("moveTo"); }
  lineTo(): void { this.calls.push("lineTo"); }
  rect(): void { this.calls.push("rect"); }
  fill(): void { this.calls.push("fill"); }
  stroke(): void { this.calls.push("stroke"); }
  fillText(): void { this.calls.push("fillText"); }
  arc(): void { this.calls.push("arc"); }
  save(): void { this.calls.push("save"); }
  restore(): void { this.calls.push("restore"); }
}

describe("drawing renderers", () => {
  it.each([
    "trendLine",
    "ray",
    "extendedLine",
    "horizontalLine",
    "verticalLine",
    "crossLine",
    "parallelChannel",
    "regressionChannel",
    "fibonacciRetracement",
    "fibonacciExtension",
    "text",
    "callout",
    "rectangle",
    "rotatedRectangle",
    "circle",
    "ellipse",
    "polygon",
    "path",
    "brush",
    "arrow",
    "longPosition",
    "shortPosition",
    "datePriceRange"
  ])("renders %s from neutral JSON", (type) => {
    const registry = createDefaultDrawingRendererRegistry();
    const layer = createDrawingLayer(registry);
    const drawing: DrawingObject = {
      id: `${type}-1`,
      type,
      anchors: [{ x: 10, y: 20 }, { x: 80, y: 60 }, { x: 120, y: 40 }],
      text: "Label",
      visible: true,
      locked: false
    } as DrawingObject;
    const context = createLayerContext([drawing]);

    layer.render(context);

    expect((context.context as unknown as FakeCanvasContext).calls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingRenderers.test.ts
```

Expected: FAIL because drawing renderers are missing.

- [ ] **Step 3: Extend render state**

Modify `renderTypes.ts`:

```ts
import type { DrawingObject } from "../drawing/drawingTypes";

export interface RenderState {
  series: CandleSeries;
  viewport: ViewportState;
  theme: ChartTheme;
  layout: ChartLayout;
  movingAverages?: MovingAveragePoint[][];
  crosshair?: CrosshairState | undefined;
  seriesType?: SeriesType;
  panels?: PanelArea[];
  visualOutputs?: IndicatorVisualOutput[];
  drawings?: DrawingObject[];
  selectedDrawingIds?: string[];
  hoveredDrawingId?: string;
}
```

- [ ] **Step 4: Implement drawing renderers and layer**

Create:

- `lineDrawingRenderer.ts` for `trendLine`, `ray`, `extendedLine`, `horizontalLine`, `verticalLine`, `crossLine`.
- `channelDrawingRenderer.ts` for `parallelChannel`, `regressionChannel`.
- `fibonacciDrawingRenderer.ts` for `fibonacciRetracement`, `fibonacciExtension`.
- `textDrawingRenderer.ts` for `text`, `callout`.
- `shapeDrawingRenderer.ts` for `rectangle`, `rotatedRectangle`, `circle`, `ellipse`, `polygon`.
- `pathDrawingRenderer.ts` for `path`, `brush`, `arrow`.
- `positionDrawingRenderer.ts` for `longPosition`, `shortPosition`.
- `rangeDrawingRenderer.ts` for `datePriceRange`.
- `drawingLayer.ts` to render visible drawings and selected/hover handles.

The default registry factory must register all 23 drawing types:

```ts
export function createDefaultDrawingRendererRegistry(): DrawingRendererRegistry
```

- [ ] **Step 5: Export drawing renderers**

Add exports for `drawingLayer` and `createDefaultDrawingRendererRegistry`.

- [ ] **Step 6: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingRenderers.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/chart-engine/src/render/drawing packages/chart-engine/src/render/renderTypes.ts packages/chart-engine/src/__tests__/drawingRenderers.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: render neutral drawing objects"
```

---

## Milestone V0.1-D: Drawing Editor Interaction

### Task 15: Implement Drawing Editor State Machine

**Files:**

- Create: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Create: `packages/chart-engine/src/drawing/drawingCommands.ts`
- Create: `packages/chart-engine/src/drawing/drawingMagnet.ts`
- Test: `packages/chart-engine/src/__tests__/drawingEditor.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing drawing editor tests**

Create `packages/chart-engine/src/__tests__/drawingEditor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDrawingEditor, type DrawingObject } from "../index";

describe("drawing editor", () => {
  it("creates a drawing by anchors and emits neutral events", () => {
    const events: unknown[] = [];
    const editor = createDrawingEditor({ drawings: [], onEvent: (event) => events.push(event) });

    editor.setTool("trendLine");
    editor.pointerDown({ x: 10, y: 20, time: 1, price: 10 });
    editor.pointerDown({ x: 80, y: 60, time: 2, price: 12 });

    expect(editor.getState().drawings).toHaveLength(1);
    expect(events.map((event) => (event as { type: string }).type)).toContain("drawingCreated");
  });

  it("moves a selected drawing", () => {
    const drawing: DrawingObject = {
      id: "d1",
      type: "trendLine",
      anchors: [{ x: 10, y: 20 }, { x: 80, y: 60 }]
    };
    const editor = createDrawingEditor({ drawings: [drawing] });

    editor.selectDrawing("d1");
    editor.dragSelected({ dx: 5, dy: -10 });

    expect(editor.getState().drawings[0].anchors).toEqual([{ x: 15, y: 10 }, { x: 85, y: 50 }]);
  });

  it("does not edit locked drawings", () => {
    const editor = createDrawingEditor({
      drawings: [{ id: "d1", type: "trendLine", anchors: [{ x: 1, y: 1 }], locked: true }]
    });

    editor.selectDrawing("d1");
    editor.dragSelected({ dx: 10, dy: 10 });

    expect(editor.getState().drawings[0].anchors).toEqual([{ x: 1, y: 1 }]);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingEditor.test.ts
```

Expected: FAIL because `createDrawingEditor` is missing.

- [ ] **Step 3: Implement editor API**

Create `drawingEditor.ts` with:

```ts
export interface DrawingEditorPoint {
  x: number;
  y: number;
  time?: number;
  price?: number;
}

export interface DrawingEditorState {
  drawings: DrawingObject[];
  selectedDrawingIds: string[];
  activeTool: DrawingType | "select";
  isCreating: boolean;
}

export interface DrawingEditor {
  setTool(tool: DrawingType | "select"): void;
  pointerDown(point: DrawingEditorPoint): void;
  pointerMove(point: DrawingEditorPoint): void;
  pointerUp(point: DrawingEditorPoint): void;
  cancel(): void;
  selectDrawing(id: string): void;
  dragSelected(delta: { dx: number; dy: number }): void;
  dragAnchor(id: string, anchorIndex: number, point: DrawingEditorPoint): void;
  deleteSelected(): void;
  lockSelected(): void;
  hideSelected(): void;
  getState(): DrawingEditorState;
}
```

Implement deterministic immutable state updates. Use generated drawing ids in the form `drawing-${n}`.

- [ ] **Step 4: Implement magnet helper**

Create `drawingMagnet.ts`:

```ts
export function snapPointToCandidates(
  point: { x: number; y: number },
  candidates: Array<{ x: number; y: number }>,
  radius: number
): { x: number; y: number } {
  let best = point;
  let bestDistance = radius;

  for (const candidate of candidates) {
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);

    if (distance <= bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}
```

- [ ] **Step 5: Export editor API**

Add to `packages/chart-engine/src/index.ts`:

```ts
export * from "./drawing/drawingCommands";
export * from "./drawing/drawingEditor";
export * from "./drawing/drawingMagnet";
```

- [ ] **Step 6: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingEditor.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/chart-engine/src/drawing packages/chart-engine/src/__tests__/drawingEditor.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add drawing editor state machine"
```

### Task 16: Add Drawing History and Undo/Redo

**Files:**

- Create: `packages/chart-engine/src/commands/history.ts`
- Test: `packages/chart-engine/src/__tests__/commands.test.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing history tests**

Create `packages/chart-engine/src/__tests__/commands.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCommandHistory } from "../index";

describe("command history", () => {
  it("applies undo and redo for drawing commands", () => {
    const history = createCommandHistory<number>(0);

    history.apply({ label: "increment", do: (value) => value + 1, undo: (value) => value - 1 });

    expect(history.current()).toBe(1);
    expect(history.undo()).toBe(0);
    expect(history.redo()).toBe(1);
  });

  it("clears redo stack after a new command", () => {
    const history = createCommandHistory<number>(0);

    history.apply({ label: "one", do: (value) => value + 1, undo: (value) => value - 1 });
    history.undo();
    history.apply({ label: "two", do: (value) => value + 2, undo: (value) => value - 2 });

    expect(history.redo()).toBe(2);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/commands.test.ts
```

Expected: FAIL because history API is missing.

- [ ] **Step 3: Implement command history**

Create `packages/chart-engine/src/commands/history.ts`:

```ts
export interface ReversibleCommand<TState> {
  label: string;
  do(state: TState): TState;
  undo(state: TState): TState;
}

export interface CommandHistory<TState> {
  apply(command: ReversibleCommand<TState>): TState;
  undo(): TState;
  redo(): TState;
  current(): TState;
}

export function createCommandHistory<TState>(initialState: TState): CommandHistory<TState> {
  let state = initialState;
  const undoStack: ReversibleCommand<TState>[] = [];
  const redoStack: ReversibleCommand<TState>[] = [];

  return {
    apply(command) {
      state = command.do(state);
      undoStack.push(command);
      redoStack.length = 0;
      return state;
    },
    undo() {
      const command = undoStack.pop();
      if (!command) return state;
      state = command.undo(state);
      redoStack.push(command);
      return state;
    },
    redo() {
      const command = redoStack.pop();
      if (!command) return state;
      state = command.do(state);
      undoStack.push(command);
      return state;
    },
    current() {
      return state;
    }
  };
}
```

- [ ] **Step 4: Wire drawing editor undo and redo**

Modify `drawingEditor.ts` so drawing create, move, anchor edit, delete, style change, lock, and hide operations use command history. Add editor methods:

```ts
undo(): void;
redo(): void;
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/commands.test.ts
npm run test -- packages/chart-engine/src/__tests__/drawingEditor.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/commands packages/chart-engine/src/drawing/drawingEditor.ts packages/chart-engine/src/__tests__/commands.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add command history for drawings"
```

### Task 17: Add Playground Drawing Editor and E2E

**Files:**

- Create: `apps/playground/src/drawingToolbar.ts`
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/src/styles.css`
- Create: `apps/playground/tests/drawing-editor.spec.ts`

- [ ] **Step 1: Write failing drawing E2E**

Create `apps/playground/tests/drawing-editor.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("creates edits deletes and restores a trend line drawing", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  await page.getByTestId("drawing-tool-trendLine").click();
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay missing");

  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");

  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.click(box.x + 180, box.y + 210);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 250);
  await page.mouse.up();

  await page.getByTestId("delete-drawing").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("0 drawings");
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  await page.getByTestId("redo").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("0 drawings");
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
```

Expected: FAIL because drawing toolbar and controls are missing.

- [ ] **Step 3: Implement drawing toolbar**

Create `apps/playground/src/drawingToolbar.ts` with buttons for:

- select
- trendLine
- horizontalLine
- verticalLine
- rectangle
- text
- delete
- lock
- hide
- undo
- redo

Use `data-testid` values:

- `drawing-tool-select`
- `drawing-tool-trendLine`
- `drawing-tool-horizontalLine`
- `drawing-tool-verticalLine`
- `drawing-tool-rectangle`
- `drawing-tool-text`
- `delete-drawing`
- `lock-drawing`
- `hide-drawing`
- `undo`
- `redo`

- [ ] **Step 4: Wire playground pointer events to drawing editor**

Modify `main.ts`:

- instantiate `createDrawingEditor`;
- forward overlay pointer events to drawing editor when active drawing tool is not `select` or when a drawing is selected;
- render drawings through drawing layer;
- update `data-testid="drawing-count"`;
- push only neutral drawing events into `window.__SIMON_CHART_EVENTS__`.

- [ ] **Step 5: Verify**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/playground/src apps/playground/tests/drawing-editor.spec.ts
git commit -m "feat: add playground drawing editor"
```

---

## Milestone V0.1-E: Actions, Settings, Docs, Final Acceptance

### Task 18: Add Chart Command Dispatcher

**Files:**

- Create: `packages/chart-engine/src/commands/chartCommands.ts`
- Test: `packages/chart-engine/src/__tests__/commands.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Add failing command dispatcher tests**

Append to `commands.test.ts`:

```ts
import { createChartCommandDispatcher, type ChartCommandState } from "../index";

it("dispatches neutral chart commands", () => {
  const initial: ChartCommandState = {
    seriesType: "candles",
    timeframe: "1d",
    gridVisible: true,
    invertedPriceScale: false,
    themeMode: "light",
    drawingTool: "select"
  };
  const dispatcher = createChartCommandDispatcher(initial);

  expect(dispatcher.dispatch({ type: "setSeriesType", seriesType: "line" }).seriesType).toBe("line");
  expect(dispatcher.dispatch({ type: "toggleGrid" }).gridVisible).toBe(false);
  expect(dispatcher.dispatch({ type: "invertPriceScale" }).invertedPriceScale).toBe(true);
  expect(dispatcher.dispatch({ type: "setDrawingTool", drawingTool: "trendLine" }).drawingTool).toBe("trendLine");
  expect(dispatcher.dispatch({ type: "undo" }).lastCommandType).toBe("undo");
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/commands.test.ts
```

Expected: FAIL because chart command dispatcher is missing.

- [ ] **Step 3: Implement command dispatcher**

Create `packages/chart-engine/src/commands/chartCommands.ts`:

```ts
import type { DrawingType } from "../drawing/drawingTypes";
import type { ViewportState } from "../model/runtime";
import type { SeriesType } from "../series/seriesTypes";

export type ChartEngineCommand =
  | { type: "setSeriesType"; seriesType: SeriesType }
  | { type: "setTimeframe"; timeframe: "1d" | "1w" | "1mo" }
  | { type: "setViewport"; viewport: ViewportState }
  | { type: "zoomIn" }
  | { type: "zoomOut" }
  | { type: "resetZoom" }
  | { type: "pan"; deltaX: number }
  | { type: "toggleGrid" }
  | { type: "invertPriceScale" }
  | { type: "setThemeMode"; themeMode: ThemeMode }
  | { type: "setDrawingTool"; drawingTool: DrawingType | "select" }
  | { type: "deleteSelectedDrawing" }
  | { type: "lockSelectedDrawing" }
  | { type: "hideSelectedDrawing" }
  | { type: "undo" }
  | { type: "redo" };

export type ChartCommandThemeMode = "light" | "dark";

export interface ChartCommandState {
  seriesType: SeriesType;
  timeframe: "1d" | "1w" | "1mo";
  viewport?: ViewportState;
  gridVisible: boolean;
  invertedPriceScale: boolean;
  themeMode: ChartCommandThemeMode;
  drawingTool: DrawingType | "select";
  lastCommandType?: ChartEngineCommand["type"];
}

export interface ChartCommandDispatcher {
  dispatch(command: ChartEngineCommand): ChartCommandState;
  getState(): ChartCommandState;
}

export function createChartCommandDispatcher(initialState: ChartCommandState): ChartCommandDispatcher {
  let state = initialState;

  return {
    dispatch(command) {
      state = { ...state, lastCommandType: command.type };

      if (command.type === "setSeriesType") {
        state = { ...state, seriesType: command.seriesType };
      } else if (command.type === "setTimeframe") {
        state = { ...state, timeframe: command.timeframe };
      } else if (command.type === "setViewport") {
        state = { ...state, viewport: command.viewport };
      } else if (command.type === "toggleGrid") {
        state = { ...state, gridVisible: !state.gridVisible };
      } else if (command.type === "invertPriceScale") {
        state = { ...state, invertedPriceScale: !state.invertedPriceScale };
      } else if (command.type === "setThemeMode") {
        state = { ...state, themeMode: command.themeMode };
      } else if (command.type === "setDrawingTool") {
        state = { ...state, drawingTool: command.drawingTool };
      }

      return state;
    },
    getState() {
      return state;
    }
  };
}
```

- [ ] **Step 4: Export commands**

Add:

```ts
export * from "./commands/chartCommands";
export * from "./commands/history";
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/commands.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/commands packages/chart-engine/src/__tests__/commands.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add chart command dispatcher"
```

### Task 19: Harden Theme and Settings Contracts

**Files:**

- Create: `packages/chart-engine/src/settings/chartSettings.ts`
- Modify: `packages/chart-engine/src/model/theme.ts`
- Test: `packages/chart-engine/src/__tests__/model.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Add failing settings tests**

Append to `model.test.ts`:

```ts
import { defaultChartSettings, mergeChartSettings } from "../index";

it("supports v0.1 chart settings without host business fields", () => {
  const settings = mergeChartSettings(defaultChartSettings, {
    themeMode: "dark",
    candleColorScheme: "aShare",
    gridVisible: false
  });

  expect(settings.themeMode).toBe("dark");
  expect(settings.candleColorScheme).toBe("aShare");
  expect(settings.gridVisible).toBe(false);
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/model.test.ts
```

Expected: FAIL because chart settings are missing.

- [ ] **Step 3: Implement settings contract**

Create `packages/chart-engine/src/settings/chartSettings.ts`:

```ts
export type ThemeMode = "light" | "dark";
export type CandleColorScheme = "aShare" | "international";
export type VolumeColorMode = "fixed" | "followCandle";

export interface ChartSettings {
  themeMode: ThemeMode;
  candleColorScheme: CandleColorScheme;
  gridVisible: boolean;
  volumeColorMode: VolumeColorMode;
  density: "compact" | "comfortable";
}

export const defaultChartSettings: ChartSettings = {
  themeMode: "light",
  candleColorScheme: "international",
  gridVisible: true,
  volumeColorMode: "followCandle",
  density: "comfortable"
};

export function mergeChartSettings(
  base: ChartSettings,
  override: Partial<ChartSettings>
): ChartSettings {
  return {
    ...base,
    ...override
  };
}
```

- [ ] **Step 4: Extend theme if needed**

Modify `theme.ts` only for settings-required semantic colors:

- panel separator
- selected drawing
- hovered drawing
- marker default

- [ ] **Step 5: Export settings**

Add:

```ts
export * from "./settings/chartSettings";
```

- [ ] **Step 6: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/model.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/chart-engine/src/settings packages/chart-engine/src/model/theme.ts packages/chart-engine/src/__tests__/model.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: harden chart settings contracts"
```

### Task 20: Add Engine Facade Public API

**Files:**

- Create: `packages/chart-engine/src/engine/chartState.ts`
- Create: `packages/chart-engine/src/engine/events.ts`
- Create: `packages/chart-engine/src/engine/chartEngine.ts`
- Test: `packages/chart-engine/src/__tests__/chartEngine.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing engine facade tests**

Create `packages/chart-engine/src/__tests__/chartEngine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createChartEngine, fixtureDailyCandleSeries } from "../index";

describe("chart engine facade", () => {
  it("updates neutral state through public API", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });

    engine.setSeriesType("line");
    engine.setViewport({ visibleRange: { from: 1, to: 10 }, candleWidth: 8, scrollOffset: 0, priceScaleMode: "linear" });

    expect(engine.getState().seriesType).toBe("line");
    expect(engine.getState().viewport.visibleRange).toEqual({ from: 1, to: 10 });
  });

  it("emits neutral events", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });
    const events: unknown[] = [];
    const unsubscribe = engine.subscribe((event) => events.push(event));

    engine.setSeriesType("area");
    unsubscribe();
    engine.setSeriesType("line");

    expect(events).toEqual([{ type: "seriesTypeChanged", seriesType: "area" }]);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartEngine.test.ts
```

Expected: FAIL because `createChartEngine` is missing.

- [ ] **Step 3: Implement facade**

Create a neutral facade with:

```ts
export interface ChartEngine {
  getState(): ChartEngineState;
  setSeries(series: CandleSeries): void;
  setSeriesType(seriesType: SeriesType): void;
  setViewport(viewport: ViewportState): void;
  setVisualOutputs(outputs: IndicatorVisualOutput[]): void;
  setDrawings(drawings: DrawingObject[]): void;
  dispatch(command: ChartEngineCommand): void;
  subscribe(listener: (event: ChartEngineEvent) => void): () => void;
  destroy(): void;
}
```

Event types:

```ts
export type ChartEngineEvent =
  | { type: "seriesChanged"; series: CandleSeries }
  | { type: "seriesTypeChanged"; seriesType: SeriesType }
  | { type: "viewportChanged"; viewport: ViewportState }
  | { type: "visualOutputsChanged"; outputs: IndicatorVisualOutput[] }
  | { type: "drawingsChanged"; drawings: DrawingObject[] };
```

- [ ] **Step 4: Export facade**

Add:

```ts
export * from "./engine/chartEngine";
export * from "./engine/chartState";
export * from "./engine/events";
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartEngine.test.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/engine packages/chart-engine/src/__tests__/chartEngine.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add chart engine facade"
```

### Task 21: Add Settings and Actions Playground E2E

**Files:**

- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/src/styles.css`
- Create: `apps/playground/tests/settings-actions.spec.ts`

- [ ] **Step 1: Write failing settings/action E2E**

Create `apps/playground/tests/settings-actions.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("toolbar actions update neutral engine state", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("toggle-grid").click();
  await expect(page.getByTestId("grid-state")).toHaveText("grid off");

  await page.getByTestId("invert-price-scale").click();
  await expect(page.getByTestId("scale-state")).toHaveText("inverted");

  await page.getByTestId("theme-mode").selectOption("dark");
  await expect(page.getByTestId("theme-state")).toHaveText("dark");
});
```

- [ ] **Step 2: Verify test fails**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/settings-actions.spec.ts
```

Expected: FAIL because controls are missing.

- [ ] **Step 3: Add controls**

Modify playground to add:

- `data-testid="toggle-grid"`
- `data-testid="grid-state"`
- `data-testid="invert-price-scale"`
- `data-testid="scale-state"`
- `data-testid="theme-mode"`
- `data-testid="theme-state"`

Controls must dispatch neutral engine commands or settings updates.

- [ ] **Step 4: Verify**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/settings-actions.spec.ts
npm run typecheck
npm run guard:engine-boundary
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/playground/src apps/playground/tests/settings-actions.spec.ts
git commit -m "feat: expose settings actions in playground"
```

### Task 22: Write Engine Documentation

**Files:**

- Create: `docs/engine/overview.md`
- Create: `docs/engine/public-api.md`
- Create: `docs/engine/chart-types.md`
- Create: `docs/engine/visual-outputs.md`
- Create: `docs/engine/panels.md`
- Create: `docs/engine/drawing-editor.md`
- Create: `docs/engine/actions-and-commands.md`
- Create: `docs/engine/host-integration.md`
- Create: `docs/engine/boundary-rules.md`
- Create: `docs/engine/testing-strategy.md`

- [ ] **Step 1: Create documentation files**

Write each file with concrete examples from the implemented API. Include this required positioning in `docs/engine/overview.md`:

```md
# SimonCharts Engine Overview

SimonCharts is a reusable chart engine kernel. It is not a host application and not a business platform.

Host applications own data loading, authentication, persistence, business workflows, and product UI. The engine owns neutral chart data contracts, rendering, interaction, drawing, commands, and neutral events.
```

- [ ] **Step 2: Verify docs include required topics**

Run:

```bash
rg -n "not a host application|SeriesType|VisualRenderer|PanelDefinition|DrawingObject|ChartEngine|HostAdapter|boundary|Playwright" docs/engine
```

Expected: output includes matches across the docs.

- [ ] **Step 3: Commit**

```bash
git add docs/engine
git commit -m "docs: add chart engine v0.1 documentation"
```

### Task 23: Final v0.1 Verification and Cleanup

**Files:**

- Modify only if final verification exposes a defect.

- [ ] **Step 1: Run full unit tests**

Run:

```bash
npm run test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript build passes for engine and playground.

- [ ] **Step 3: Run boundary guard**

Run:

```bash
npm run guard:engine-boundary
```

Expected: engine boundary guard passes.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: engine and playground build pass.

- [ ] **Step 5: Run full E2E**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Expected: all Playwright tests pass.

- [ ] **Step 6: Clean generated artifacts**

Run:

```bash
rm -rf apps/playground/dist test-results playwright-report
```

Expected: generated build and test artifacts are removed.

- [ ] **Step 7: Check git status**

Run:

```bash
git status --short
```

Expected: no generated artifacts are pending. Source changes from v0.1 tasks are committed.

- [ ] **Step 8: Commit final fixes if any were needed**

If final verification required source changes:

```bash
git add <changed-source-files>
git commit -m "fix: stabilize chart engine v0.1 verification"
```

If no source changes were required, do not create an empty commit.

---

## Final Acceptance Checklist

- [ ] All 17 chart types render and switch in playground.
- [ ] Direct and synthetic chart types have autoscale, hit-test, and tooltip support.
- [ ] Synthetic chart types preserve source candle traceability.
- [ ] `line`, `histogram`, `band`, and `marker` visual outputs render through registry.
- [ ] Main and sub panels share x viewport and keep independent y scales.
- [ ] Drawing objects serialize as neutral JSON.
- [ ] All v0.1 drawing types render from neutral JSON.
- [ ] Drawing editor can create, select, move, edit anchors, delete, lock, hide, undo, and redo.
- [ ] Command/settings contracts support chart type, grid, scale, theme, drawing tool, delete, lock, hide, undo, redo.
- [ ] Playground demonstrates v0.1 engine behavior without becoming a business product.
- [ ] Documentation covers public API, chart types, visual outputs, panels, drawing editor, actions, host integration, boundary rules, and testing.
- [ ] `npm run test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passes.
- [ ] `npm run guard:engine-boundary` passes.
