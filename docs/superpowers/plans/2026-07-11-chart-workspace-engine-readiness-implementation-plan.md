# Chart Workspace Engine Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@simoncharts/chart-engine` a truthful internal kernel for the commercial workspace by completing eight timeframes, three price scales, effectful chart commands, continuous drawing input, and drawing coordinate projection.

**Architecture:** Keep engine code host-neutral and Canvas-focused. Consolidate chart actions into one command type, centralize all price transforms in one invertible scale object, and keep drawing domain coordinates distinct from their projected screen coordinates so viewport and scale changes remain correct.

**Tech Stack:** TypeScript 5.5, Canvas 2D, Vite 5, Vitest 1.6, existing engine registries and render scheduler.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-11-chart-workspace-commercial-sdk-design.md`.
- Supported timeframes are exactly `1m`, `5m`, `15m`, `30m`, `60m`, `1d`, `1w`, `1mo`.
- Supported price scale modes are exactly `linear`, `log`, `percentage`.
- `percentage` uses the first visible source candle close as `0%`.
- `log` accepts positive prices only and displays absolute price labels.
- Drawings are stored in domain coordinates (`time`/`price`) and projected to `x`/`y` for the current viewport.
- Continuous tools must use pointer down/move/up/cancel and create no object on an incomplete gesture.
- Commands owned by `DrawingEditor` must not be duplicated as no-op `ChartEngineCommand` variants.
- Engine source must not import host, workspace UI, browser storage, TradingReviewSystem, auth, route, or provider modules.
- Do not add a compatibility layer for the pre-release `percent` spelling or the duplicate `ChartCommand` model; update the RC API directly.
- Every task starts with a failing focused test and ends with a commit.

---

## File Structure

### Create

- `packages/chart-engine/src/viewport/priceScale.ts` — invertible linear/log/percentage transform and tick formatting.
- `packages/chart-engine/src/drawing/drawingCoordinates.ts` — domain-to-screen and screen-to-domain drawing projection.
- `packages/chart-engine/src/model/formatters.ts` — host-injected epoch display formatting contract.
- `packages/chart-engine/src/render/mainPriceScale.ts` — one merged candle/main-indicator scale per frame.
- `packages/chart-engine/src/indicators/indicatorChunk.ts` — exact state checkpoints for paged indicator calculation.
- `packages/chart-engine/src/series/transforms/seriesTransformChunk.ts` — exact checkpoints for stateful synthetic series.
- `packages/chart-engine/src/__tests__/priceScale.test.ts` — scale math and formatting contract.
- `packages/chart-engine/src/__tests__/drawingCoordinates.test.ts` — cross-timeframe and cross-scale projection contract.

### Modify

- `packages/chart-engine/src/model/market.ts` — canonical timeframe values.
- `packages/chart-engine/src/model/runtime.ts` — canonical price scale values and single command event type.
- `packages/chart-engine/src/model/helpers.ts` — finite, positive OHLCV validation.
- `packages/chart-engine/src/commands/chartCommands.ts` — one effectful chart command union.
- `packages/chart-engine/src/engine/chartState.ts` — chart state derives timeframe from `series` and owns viewport scale state.
- `packages/chart-engine/src/engine/chartEngine.ts` — exhaustive command application.
- `packages/chart-engine/src/viewport/viewport.ts` — x/index navigation only; delegates price math.
- `packages/chart-engine/src/viewport/priceRange.ts` — raw visible bounds used by the scale factory.
- `packages/chart-engine/src/render/layers/axisLayer.ts` — scale-aware ticks.
- `packages/chart-engine/src/render/layers/candlestickLayer.ts`
- `packages/chart-engine/src/render/layers/crosshairLayer.ts`
- `packages/chart-engine/src/render/layers/movingAverageLayer.ts`
- `packages/chart-engine/src/render/layers/tooltipLayer.ts`
- `packages/chart-engine/src/render/series/renderers/rendererHelpers.ts`
- `packages/chart-engine/src/render/visuals/renderers/visualRendererHelpers.ts`
- `packages/chart-engine/src/drawing/drawingMagnet.ts`
- `packages/chart-engine/src/interaction/hitTest.ts`
- `packages/chart-engine/src/interaction/interactionEngine.ts`
- `packages/chart-engine/src/drawing/drawingCommands.ts` — preview event.
- `packages/chart-engine/src/drawing/drawingEditor.ts` — continuous and step preview lifecycle.
- `packages/chart-engine/src/drawing/drawingEditState.ts` — preview capability state.
- `packages/chart-engine/src/persistence/layoutSnapshot.ts` — `percentage` validation.
- `packages/chart-engine/src/engine/engineCapabilityManifest.ts` — timeframe/scale/lifecycle claims.
- `packages/chart-engine/src/index.ts` — export new engine contracts.
- Existing focused tests under `packages/chart-engine/src/__tests__/`.
- `apps/playground/src/main.ts`, `apps/playground/src/playgroundState.ts`, and relevant Playwright specs — consume the canonical contracts.
- `packages/chart-engine/api-surface.json`, `packages/chart-engine/api-types.json` — intentional RC snapshot refresh.
- `docs/engine/actions-and-commands.md`, `docs/engine/drawing-editor.md`, `docs/engine/public-api.md` — current behavior.

## Task 1: Canonical Timeframe And Command Types

**Files:**
- Modify: `packages/chart-engine/src/model/market.ts`
- Modify: `packages/chart-engine/src/model/runtime.ts`
- Modify: `packages/chart-engine/src/commands/chartCommands.ts`
- Modify: `packages/chart-engine/src/engine/chartState.ts`
- Modify: `packages/chart-engine/src/engine/chartEngine.ts`
- Test: `packages/chart-engine/src/__tests__/model.test.ts`
- Test: `packages/chart-engine/src/__tests__/commands.test.ts`
- Test: `packages/chart-engine/src/__tests__/chartEngine.test.ts`
- Modify: `scripts/fixtures/package-consumer-types.ts`

**Interfaces:**
- Produces: `supportedTimeframes`, `Timeframe`, `supportedPriceScaleModes`, `PriceScaleMode`, and the only chart action type `ChartEngineCommand`.
- Consumed by: all later engine tasks and the workspace public adapter.

- [ ] **Step 1: Write the failing canonical-value tests**

Add these assertions:

```ts
import {
  supportedPriceScaleModes,
  supportedTimeframes,
  type CandleSeries,
  type ChartEngineCommand
} from "../index";

expect(supportedTimeframes).toEqual([
  "1m",
  "5m",
  "15m",
  "30m",
  "60m",
  "1d",
  "1w",
  "1mo"
]);
expect(supportedPriceScaleModes).toEqual(["linear", "log", "percentage"]);

const intradaySeries: CandleSeries = {
  symbol: "SSE:600000",
  timeframe: "1m",
  adjustMode: "forward",
  dataVersion: "v1",
  candles: [{ time: 1, open: 10, high: 11, low: 9, close: 10.5, volume: 100, turnover: 1050 }]
};
expect(intradaySeries.timeframe).toBe("1m");

const scaleCommand: ChartEngineCommand = {
  type: "setPriceScaleMode",
  mode: "percentage"
};
expect(scaleCommand.mode).toBe("percentage");

const packagedTimeframes: Timeframe[] = ["1m", "5m", "15m", "30m", "60m", "1d", "1w", "1mo"];
expect(packagedTimeframes).toEqual(supportedTimeframes);
```

Mirror the eight-value compile assertion in `scripts/fixtures/package-consumer-types.ts` so the packed declaration consumer, not only source tests, proves the canonical union.

- [ ] **Step 2: Run the tests and verify the contract is absent**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/model.test.ts packages/chart-engine/src/__tests__/commands.test.ts packages/chart-engine/src/__tests__/chartEngine.test.ts
```

Expected: FAIL because intraday timeframes, `percentage`, and `setPriceScaleMode` are not part of the current types/runtime values.

- [ ] **Step 3: Add canonical runtime arrays and remove duplicate command types**

Use these exact contracts in `model/market.ts` and `model/runtime.ts`:

```ts
export const supportedTimeframes = [
  "1m",
  "5m",
  "15m",
  "30m",
  "60m",
  "1d",
  "1w",
  "1mo"
] as const;

export type Timeframe = (typeof supportedTimeframes)[number];

export const supportedPriceScaleModes = ["linear", "log", "percentage"] as const;

export type PriceScaleMode = (typeof supportedPriceScaleModes)[number];
```

Delete `ChartCommandTimeframe`, `ChartCommandState`, `createChartCommandDispatcher`, and the duplicate `ChartCommand` union. Timeframe selection belongs to the workspace data controller and engine timeframe is always `state.series.timeframe`; drawing-tool selection belongs to `DrawingEditor`. Define only chart-owned actions in `commands/chartCommands.ts`:

```ts
import type { PriceScaleMode, ViewportState } from "../model/runtime";
import type { ThemeMode } from "../settings/chartSettings";
import type { SeriesType } from "../series/seriesTypes";

export type ChartEngineCommand =
  | { type: "setSeriesType"; seriesType: SeriesType }
  | { type: "setViewport"; viewport: ViewportState }
  | { type: "setPriceScaleMode"; mode: PriceScaleMode }
  | { type: "zoomIn" }
  | { type: "zoomOut" }
  | { type: "resetZoom" }
  | { type: "pan"; deltaX: number }
  | { type: "toggleGrid" }
  | { type: "setThemeMode"; themeMode: ThemeMode };
```

Remove `timeframe` and `drawingTool` from `ChartEngineState`. Callers read `state.series.timeframe`; `setSeries()` is the only way engine data changes timeframe. In `model/runtime.ts`, import `ChartEngineCommand` as a type and use it for the `ChartEvent` command variant.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/model.test.ts packages/chart-engine/src/__tests__/commands.test.ts packages/chart-engine/src/__tests__/chartEngine.test.ts
npm run typecheck
```

Expected: PASS; no source file defines another chart command union or three-value timeframe union.

- [ ] **Step 5: Verify duplicate contracts are gone**

Run:

```bash
rg -n 'ChartCommandTimeframe|ChartCommandState|createChartCommandDispatcher|export type ChartCommand =|drawingTool: DrawingType' packages/chart-engine/src
```

Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/model/market.ts packages/chart-engine/src/model/runtime.ts packages/chart-engine/src/commands/chartCommands.ts packages/chart-engine/src/engine/chartState.ts packages/chart-engine/src/engine/chartEngine.ts packages/chart-engine/src/__tests__/model.test.ts packages/chart-engine/src/__tests__/commands.test.ts packages/chart-engine/src/__tests__/chartEngine.test.ts scripts/fixtures/package-consumer-types.ts
git commit -m "feat(engine): add workspace market contracts"
```

## Task 2: Invertible Price Scale Kernel

**Files:**
- Create: `packages/chart-engine/src/viewport/priceScale.ts`
- Create: `packages/chart-engine/src/__tests__/priceScale.test.ts`
- Modify: `packages/chart-engine/src/viewport/priceRange.ts`
- Modify: `packages/chart-engine/src/viewport/viewport.ts`
- Modify: `packages/chart-engine/src/index.ts`

**Interfaces:**
- Consumes: `CandleSeries`, `VisibleRange`, `PriceScaleMode` from Task 1.
- Produces: `PriceScale`, `createPriceScale`, `createPriceScaleFromBounds`, `priceToScaleValue`, `scaleValueToPrice`, `priceToY`, `yToPrice`, `formatPriceScaleTick`.

- [ ] **Step 1: Write failing transform and round-trip tests**

Create `priceScale.test.ts` with these cases:

```ts
import { describe, expect, it } from "vitest";
import {
  createPriceScale,
  formatPriceScaleTick,
  priceToScaleValue,
  priceToY,
  scaleValueToPrice,
  yToPrice,
  type CandleSeries
} from "../index";

const series: CandleSeries = {
  symbol: "SSE:600000",
  timeframe: "1d",
  adjustMode: "forward",
  dataVersion: "v1",
  candles: [
    { time: 1, open: 100, high: 110, low: 90, close: 100, volume: 1, turnover: 100 },
    { time: 2, open: 100, high: 210, low: 100, close: 200, volume: 1, turnover: 200 }
  ]
};

describe("price scales", () => {
  it("round-trips linear and log prices", () => {
    for (const mode of ["linear", "log"] as const) {
      const scale = createPriceScale(series, { from: 0, to: 1 }, mode);
      const y = priceToY(150, scale, 20, 400);
      expect(yToPrice(y, scale, 20, 400)).toBeCloseTo(150, 8);
    }
  });

  it("uses first visible close as percentage base", () => {
    const scale = createPriceScale(series, { from: 0, to: 1 }, "percentage");
    expect(scale.basePrice).toBe(100);
    expect(priceToScaleValue(110, scale)).toBeCloseTo(10, 8);
    expect(scaleValueToPrice(10, scale)).toBeCloseTo(110, 8);
    expect(formatPriceScaleTick(110, scale)).toBe("10.00%");
  });

  it("rejects non-positive values for log mode", () => {
    const invalid = structuredClone(series);
    invalid.candles[0].low = 0;
    expect(() => createPriceScale(invalid, { from: 0, to: 1 }, "log")).toThrow(
      "Log price scale requires positive prices"
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/priceScale.test.ts
```

Expected: FAIL because `priceScale.ts` and its exports do not exist.

- [ ] **Step 3: Implement the scale object in one file**

Create this public shape in `priceScale.ts`:

```ts
import type { CandleSeries } from "../model/market";
import type { PriceScaleMode, VisibleRange } from "../model/runtime";
import { computeVisiblePriceBounds } from "./priceRange";

export interface PriceScale {
  mode: PriceScaleMode;
  basePrice: number;
  min: number;
  max: number;
}

export function createPriceScale(
  series: CandleSeries,
  visibleRange: VisibleRange,
  mode: PriceScaleMode
): PriceScale {
  const raw = computeVisiblePriceBounds(series, visibleRange);
  const first = series.candles[Math.max(0, visibleRange.from)];
  const basePrice = first?.close ?? 1;

  return createPriceScaleFromBounds(raw, basePrice, mode);
}

export function createPriceScaleFromBounds(
  raw: { min: number; max: number },
  basePrice: number,
  mode: PriceScaleMode
): PriceScale {

  if (mode === "log" && raw.min <= 0) {
    throw new Error("Log price scale requires positive prices");
  }
  if (mode === "percentage" && basePrice <= 0) {
    throw new Error("Percentage price scale requires a positive base price");
  }

  const provisional: PriceScale = { mode, basePrice, min: 0, max: 1 };
  const transformedMin = priceToScaleValue(raw.min, provisional);
  const transformedMax = priceToScaleValue(raw.max, provisional);
  const span = transformedMax - transformedMin;
  const padding = span === 0 ? Math.max(Math.abs(transformedMax), 1) * 0.05 : span * 0.05;

  return {
    mode,
    basePrice,
    min: transformedMin - padding,
    max: transformedMax + padding
  };
}

export function priceToScaleValue(price: number, scale: PriceScale): number {
  if (scale.mode === "linear") return price;
  if (scale.mode === "log") {
    if (price <= 0) throw new Error("Log price scale requires positive prices");
    return Math.log(price);
  }
  return ((price / scale.basePrice) - 1) * 100;
}

export function scaleValueToPrice(value: number, scale: PriceScale): number {
  if (scale.mode === "linear") return value;
  if (scale.mode === "log") return Math.exp(value);
  return scale.basePrice * (1 + value / 100);
}

export function priceToY(price: number, scale: PriceScale, plotTop: number, plotHeight: number): number {
  const value = priceToScaleValue(price, scale);
  const span = scale.max - scale.min;
  return span === 0 ? plotTop + plotHeight / 2 : plotTop + ((scale.max - value) / span) * plotHeight;
}

export function yToPrice(y: number, scale: PriceScale, plotTop: number, plotHeight: number): number {
  const span = scale.max - scale.min;
  const value = span === 0 ? scale.min : scale.max - ((y - plotTop) / plotHeight) * span;
  return scaleValueToPrice(value, scale);
}

export function formatPriceScaleTick(price: number, scale: PriceScale): string {
  if (scale.mode === "percentage") {
    return `${priceToScaleValue(price, scale).toFixed(2)}%`;
  }
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}
```

Add `computeVisiblePriceBounds()` to `priceRange.ts`; it clamps the visible indices and returns the unpadded candle low/high. Keep existing `computeVisiblePriceRange()` for compatibility inside linear-only callers, but implement it from the raw bounds. Price-scale padding must happen only after transforming the raw bounds, otherwise a positive raw range can become non-positive before log conversion. Remove price conversion from `viewport.ts`; keep only viewport/index navigation there. Export `priceScale.ts` from `index.ts`.

- [ ] **Step 4: Run focused and existing viewport tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/priceScale.test.ts packages/chart-engine/src/__tests__/viewport.test.ts
```

Expected: PASS after `viewport.test.ts` imports price conversion from the new module and changes the old “not implemented” assertions into round-trip assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/chart-engine/src/viewport/priceScale.ts packages/chart-engine/src/viewport/priceRange.ts packages/chart-engine/src/viewport/viewport.ts packages/chart-engine/src/index.ts packages/chart-engine/src/__tests__/priceScale.test.ts packages/chart-engine/src/__tests__/viewport.test.ts
git commit -m "feat(engine): implement price scale transforms"
```

## Task 3: Route Price Scales Through Rendering And Interaction

**Files:**
- Modify: `packages/chart-engine/src/render/layers/axisLayer.ts`
- Modify: `packages/chart-engine/src/render/layers/gridLayer.ts`
- Modify: `packages/chart-engine/src/render/layers/candlestickLayer.ts`
- Modify: `packages/chart-engine/src/render/layers/crosshairLayer.ts`
- Modify: `packages/chart-engine/src/render/layers/movingAverageLayer.ts`
- Modify: `packages/chart-engine/src/render/layers/tooltipLayer.ts`
- Create: `packages/chart-engine/src/model/formatters.ts`
- Create: `packages/chart-engine/src/render/mainPriceScale.ts`
- Modify: `packages/chart-engine/src/model/theme.ts`
- Modify: `packages/chart-engine/src/index.ts`
- Modify: `packages/chart-engine/src/render/renderTypes.ts`
- Modify: `packages/chart-engine/src/series/tooltip.ts`
- Modify: `packages/chart-engine/src/series/seriesTypes.ts`
- Modify: `packages/chart-engine/src/render/series/renderers/rendererHelpers.ts`
- Modify: `packages/chart-engine/src/render/visuals/renderers/visualRendererHelpers.ts`
- Modify: `packages/chart-engine/src/render/visuals/visualLayer.ts`
- Modify: `packages/chart-engine/src/visuals/visualTypes.ts`
- Modify: `packages/chart-engine/src/drawing/drawingMagnet.ts`
- Modify: `packages/chart-engine/src/interaction/hitTest.ts`
- Modify: `packages/chart-engine/src/interaction/interactionEngine.ts`
- Test: `packages/chart-engine/src/__tests__/staticRenderer.test.ts`
- Test: `packages/chart-engine/src/__tests__/overlayLayers.test.ts`
- Test: `packages/chart-engine/src/__tests__/seriesRenderModels.test.ts`
- Test: `packages/chart-engine/src/__tests__/visualRenderers.test.ts`
- Test: `packages/chart-engine/src/__tests__/panelEngine.test.ts`
- Test: `packages/chart-engine/src/__tests__/interaction.test.ts`
- Test: `packages/chart-engine/src/__tests__/drawingMagnet.test.ts`

**Interfaces:**
- Consumes: the `PriceScale` API from Task 2.
- Produces: identical render/interaction behavior across all three modes, percentage-aware axis labels, and host-formatted time labels with no epoch text leakage.

- [ ] **Step 1: Add failing scale-coverage tests**

Add a table-driven assertion to each relevant suite using this mode list:

```ts
const priceScaleModes = ["linear", "log", "percentage"] as const;

for (const priceScaleMode of priceScaleModes) {
  it(`renders and hit-tests ${priceScaleMode}`, () => {
    const context = createRenderContext();
    context.state.viewport.priceScaleMode = priceScaleMode;
    expect(() => renderStaticChart(context)).not.toThrow();
    expect(context.context.fillText).toHaveBeenCalled();
  });
}
```

In `interaction.test.ts`, assert inverse mapping:

```ts
expect(events.at(-1)).toMatchObject({
  type: "crosshairMoved",
  crosshair: { index: 1 }
});
expect(engine.getCrosshair()?.price).toBeGreaterThan(0);
```

Add one injected time formatter to the render fixtures and assert axis, candle tooltip, series tooltip rows, and visual tooltip rows all use its return value:

```ts
const formatTime: ChartTimeFormatter = (time, timeframe) => `SH:${time}:${timeframe}`;
expect(context.context.fillText).toHaveBeenCalledWith(expect.stringContaining("SH:"), expect.any(Number), expect.any(Number));
expect(getDefaultSeriesTooltipRows(hit, { formatTime, timeframe: "1m" })[0]).toEqual({
  label: "Time",
  value: `SH:${hit.point.time}:1m`
});
```

Add a BOLL fixture whose upper/lower visible output extends beyond candle OHLC. In each scale mode, assert candles, BOLL, axis, crosshair, and drawing y coordinates use the same merged scale and remain inside the plot. In log mode, a non-positive main-indicator point is skipped without throwing.

Add a dotted-grid test:

```ts
context.state.theme.lineDashes.grid = [1, 3];
renderStaticChart(context);
expect(context.context.setLineDash).toHaveBeenCalledWith([1, 3]);
expect(context.context.restore).toHaveBeenCalled();
```

- [ ] **Step 2: Run focused tests and verify non-linear modes fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/staticRenderer.test.ts packages/chart-engine/src/__tests__/visualRenderers.test.ts packages/chart-engine/src/__tests__/interaction.test.ts packages/chart-engine/src/__tests__/drawingMagnet.test.ts
```

Expected: FAIL at old `priceToY(..., priceRange, ..., mode)` call sites or at the removed `percent` spelling.

- [ ] **Step 3: Use one scale object per visible render calculation**

Create `createMainPanelPriceScale(series, visibleRange, mode, visualOutputs)` in `render/mainPriceScale.ts`. Merge raw candle low/high with every finite main-panel visual autoscale extremum before transform/padding. Absolute main-panel values must be positive; in log mode exclude/skip non-positive visual points rather than passing them to `Math.log`. Then construct one scale with `createPriceScaleFromBounds(rawBounds, firstVisibleClose, mode)`.

Make `RenderState.priceScale` required. The workspace/playground runtime constructs it once for the visible frame; every main chart layer/renderer uses that exact object:

```ts
const y = priceToY(value, state.priceScale, plotArea.y, plotArea.height);
```

In `axisLayer.ts`, derive each raw tick through the inverse transform:

```ts
const priceScale = state.priceScale;
const scaleSpan = priceScale.max - priceScale.min;

for (let step = 0; step <= priceTickCount; step += 1) {
  const y = plotArea.y + (plotArea.height / priceTickCount) * step;
  const scaleValue = priceScale.max - (scaleSpan / priceTickCount) * step;
  const price = scaleValueToPrice(scaleValue, priceScale);
  context.fillText(
    formatPriceScaleTick(price, priceScale),
    priceAxisArea.x + theme.spacing.axisPadding,
    y
  );
}
```

Change `priceAtY` to accept `PriceScale`. Give `InteractionEngine` the current shared main scale whenever series/viewport/visual outputs change, and use it for `yToPrice`, hit testing, and OHLC magnet y-coordinates.

Create the host-neutral formatter contract:

```ts
export type ChartTimeFormatter = (time: number, timeframe: Timeframe) => string;
export const defaultChartTimeFormatter: ChartTimeFormatter = (time) => String(time);
```

Make `RenderState.formatTime` required and pass `state.series.timeframe` at every time-label call. Add `TooltipFormattingContext { formatTime: ChartTimeFormatter; timeframe: Timeframe }`; change `SeriesRenderer.getTooltipRows`, `VisualRenderer.getTooltipRows`, `createTooltipLines`, and both default tooltip helpers to receive that context explicitly. Update default/synthetic renderer factories and tooltip callers together. The engine does not import `Intl`, locale, or a timezone; hosts choose presentation. Update every render fixture to supply either `defaultChartTimeFormatter` or a focused fake.

Main-panel and sub-panel indicators have different scale ownership. Extend `VisualRenderContext` and `VisualHitTestContext` with:

```ts
valueScale: PriceScale;
```

In `visualLayer.ts`, use `state.priceScale` for `panel.kind === "main"`. For a sub panel, build a linear scale from that panel's visual autoscale range with `basePrice: 1`; never pass the main log/percentage mode to MACD, RSI, BIAS, or another oscillator that may be zero/negative:

```ts
const valueScale = routedOutput.panel.kind === "main"
  ? context.state.priceScale
  : createLinearValueScale(rangeByPanelId.get(routedOutput.panel.id));
```

`yForVisualValue()` uses `context.valueScale`. Add a regression where MA/BOLL y-values use the same scale as candles and MACD renders finite values while the main viewport is `log` and `percentage`.

Extend `ChartTheme` with `lineDashes: { grid: number[] }`; the engine default is `[]`. Update every literal theme fixture. `gridLayer` wraps drawing in `save()`/`restore()`, calls `setLineDash(theme.lineDashes.grid)`, and never leaks the dash to later series/drawing layers. The workspace theme supplies `[1, 3]`.

- [ ] **Step 4: Run all rendering and interaction suites**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/staticRenderer.test.ts packages/chart-engine/src/__tests__/overlayLayers.test.ts packages/chart-engine/src/__tests__/seriesRenderModels.test.ts packages/chart-engine/src/__tests__/seriesRenderers.test.ts packages/chart-engine/src/__tests__/visualRenderers.test.ts packages/chart-engine/src/__tests__/panelEngine.test.ts packages/chart-engine/src/__tests__/interaction.test.ts packages/chart-engine/src/__tests__/drawingMagnet.test.ts
```

Expected: PASS for all three modes with no old five-argument `priceToY` call remaining.

- [ ] **Step 5: Verify all conversion call sites use `PriceScale`**

Run:

```bash
rg -n 'priceToY\([^\n]+priceRange|yToPrice\([^\n]+priceRange|"percent"' packages/chart-engine/src
```

Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/model/formatters.ts packages/chart-engine/src/model/theme.ts packages/chart-engine/src/index.ts packages/chart-engine/src/render packages/chart-engine/src/series/tooltip.ts packages/chart-engine/src/series/seriesTypes.ts packages/chart-engine/src/visuals/visualTypes.ts packages/chart-engine/src/drawing/drawingMagnet.ts packages/chart-engine/src/interaction packages/chart-engine/src/__tests__/staticRenderer.test.ts packages/chart-engine/src/__tests__/overlayLayers.test.ts packages/chart-engine/src/__tests__/seriesRenderModels.test.ts packages/chart-engine/src/__tests__/seriesRenderers.test.ts packages/chart-engine/src/__tests__/visualRenderers.test.ts packages/chart-engine/src/__tests__/panelEngine.test.ts packages/chart-engine/src/__tests__/interaction.test.ts packages/chart-engine/src/__tests__/drawingMagnet.test.ts
git commit -m "feat(engine): apply scales across render and interaction"
```

## Task 4: Exact Chunk Checkpoints For Indicators And Stateful Series

**Files:**
- Create: `packages/chart-engine/src/indicators/indicatorChunk.ts`
- Create: `packages/chart-engine/src/series/transforms/seriesTransformChunk.ts`
- Create: `packages/chart-engine/src/__tests__/indicatorChunk.test.ts`
- Create: `packages/chart-engine/src/__tests__/seriesTransformChunk.test.ts`
- Modify: `packages/chart-engine/src/indicators/coreIndicators.ts`
- Modify: `packages/chart-engine/src/series/transforms/heikinAshi.ts`
- Modify: `packages/chart-engine/src/series/transforms/renko.ts`
- Modify: `packages/chart-engine/src/series/transforms/lineBreak.ts`
- Modify: `packages/chart-engine/src/series/transforms/kagi.ts`
- Modify: `packages/chart-engine/src/series/transforms/pointAndFigure.ts`
- Modify: `packages/chart-engine/src/series/seriesTypes.ts`
- Modify: `packages/chart-engine/src/series/hitTest.ts`
- Modify: `packages/chart-engine/src/render/renderTypes.ts`
- Modify: `packages/chart-engine/src/render/series/seriesLayer.ts`
- Modify: `packages/chart-engine/src/index.ts`

**Interfaces:**
- Consumes: existing 16 indicator calculators and five stateful synthetic transforms.
- Produces: JSON-safe immutable calculation checkpoints whose chunked output is equivalent to the existing full-series APIs.

- [ ] **Step 1: Write failing partition-equivalence tests**

For every core indicator, calculate a 2,000-candle fixture once with `calculateCoreIndicator`, then feed the same candles through chunk sizes `[1, 7, 113, 509, 1370]` and concatenate only newly emitted points:

```ts
let indicatorCheckpoint: CoreIndicatorCheckpoint | undefined;
const chunkOutputs: IndicatorResult[] = [];
for (const candles of partition(series.candles, [1, 7, 113, 509, 1370])) {
  const chunk = calculateCoreIndicatorChunk(id, candleSeries(candles), params, indicatorCheckpoint);
  chunkOutputs.push(chunk.result);
  indicatorCheckpoint = chunk.checkpoint;
}
expectIndicatorResultsToEqual(mergeIndicatorChunks(chunkOutputs), calculateCoreIndicator(id, series, params));
```

Do the same for `heikinAshi`, `renko`, `lineBreak`, `kagi`, and `pointAndFigure`, asserting identical point values, time, `sourceIndex`, and `sourceRange`:

```ts
expect(mergeSeriesChunks(chunkModels).points).toEqual(fullModel.points);
```

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/indicatorChunk.test.ts packages/chart-engine/src/__tests__/seriesTransformChunk.test.ts
```

Expected: FAIL because the checkpoint APIs do not exist.

- [ ] **Step 2: Define bounded checkpoint contracts**

Export opaque discriminated checkpoint types and these functions:

```ts
export interface CoreIndicatorChunkResult {
  result: IndicatorResult;
  checkpoint: CoreIndicatorCheckpoint;
}

export function calculateCoreIndicatorChunk(
  id: CoreIndicatorId,
  chunk: CandleSeries,
  params?: CoreIndicatorParams,
  checkpoint?: CoreIndicatorCheckpoint
): CoreIndicatorChunkResult;

export interface SeriesTransformChunkResult {
  model: SeriesRenderModel;
  checkpoint: SeriesTransformCheckpoint;
  replaceTailCount: number;
}

export function transformSeriesChunk(
  type: "heikinAshi" | "renko" | "lineBreak" | "kagi" | "pointAndFigure",
  chunk: CandleSeries,
  options: StatefulSeriesTransformOptions,
  checkpoint?: SeriesTransformCheckpoint
): SeriesTransformChunkResult;
```

Each checkpoint stores only algorithm state, the minimum rolling tail, and processed source count—never an unbounded candle/output array. `replaceTailCount` is `0` for append-only output and otherwise tells the consumer how many provisional tail points/columns to remove before appending this chunk; this is required for Point & Figure and any other transform whose open tail can extend across a chunk boundary. Validate that checkpoint kind, indicator/series id, normalized params, symbol, timeframe, adjustment, and `dataVersion` match the next chunk; mismatch throws before output.

- [ ] **Step 3: Refactor existing full-series functions onto the same runners**

EMA/SMA/MACD/KDJ/OBV/SAR checkpoints retain their recursive accumulators; finite indicators retain only their exact rolling dependency; OBV retains previous close, running value, and the period-sized MA queue. Synthetic checkpoints retain only the state already implicit in each algorithm (for example previous Heikin-Ashi values, current Renko/Kagi/P&F structure, line-break tail, and processed source offset).

Existing `calculateCoreIndicator` and five `transform*` functions call the chunk runner once from an empty checkpoint, preserving their signatures and full-series behavior. Do not create a second formula. Clone/freeze checkpoints on return and never mutate caller input. Partition tests must place chunk boundaries inside Point & Figure column extension and reversal cases and merge chunks by applying `replaceTailCount` before append.

- [ ] **Step 4: Allow a precomputed exact synthetic model at render time**

Add `SeriesRenderModel.sourceIndexOffset` (full-series models use `0`) and make hit/tooltip source resolution subtract that offset before indexing the model's bounded `source.candles`. Add optional `RenderState.seriesModel`. `seriesLayer` uses it only when its type and source selection/version match current state; otherwise it uses the existing full-series transform. This lets the workspace supply checkpointed visible output with global `sourceIndex/sourceRange` plus a bounded source slice, without importing renderer internals. Add a renderer regression proving the supplied model is used and source-hit mapping resolves the same source times as the full model.

- [ ] **Step 5: Run equivalence, mutation, and existing indicator/series tests**

```bash
npm run test -- packages/chart-engine/src/__tests__/indicatorChunk.test.ts packages/chart-engine/src/__tests__/seriesTransformChunk.test.ts packages/chart-engine/src/__tests__/coreIndicators.test.ts packages/chart-engine/src/__tests__/syntheticSeries.test.ts packages/chart-engine/src/__tests__/seriesRenderers.test.ts
npm run typecheck
```

Expected: PASS across different partitions; checkpoint JSON size stays constant with candle count, inputs remain unchanged, and full-series APIs have no snapshot drift.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/indicators packages/chart-engine/src/series/transforms packages/chart-engine/src/series/seriesTypes.ts packages/chart-engine/src/series/hitTest.ts packages/chart-engine/src/render/renderTypes.ts packages/chart-engine/src/render/series/seriesLayer.ts packages/chart-engine/src/index.ts packages/chart-engine/src/__tests__/indicatorChunk.test.ts packages/chart-engine/src/__tests__/seriesTransformChunk.test.ts packages/chart-engine/src/__tests__/coreIndicators.test.ts packages/chart-engine/src/__tests__/syntheticSeries.test.ts packages/chart-engine/src/__tests__/seriesRenderers.test.ts
git commit -m "feat(engine): checkpoint stateful calculations"
```

## Task 5: Make Every Chart Command Effectful

**Files:**
- Modify: `packages/chart-engine/src/commands/chartCommands.ts`
- Modify: `packages/chart-engine/src/engine/chartEngine.ts`
- Modify: `packages/chart-engine/src/engine/chartState.ts`
- Modify: `packages/chart-engine/src/__tests__/commands.test.ts`
- Modify: `packages/chart-engine/src/__tests__/chartEngine.test.ts`
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/settings-actions.spec.ts`

**Interfaces:**
- Consumes: the canonical `ChartEngineCommand`, viewport functions, and price scale modes.
- Produces: exhaustive dispatch with no fall-through and no drawing-editor commands in the chart command union.

- [ ] **Step 1: Write a failing effect matrix test**

Use this command matrix in `chartEngine.test.ts`:

```ts
const cases: Array<{
  command: ChartEngineCommand;
  read: (state: ChartEngineState) => unknown;
  arrange?: (engine: ChartEngine) => void;
}> = [
  { command: { type: "setSeriesType", seriesType: "line" }, read: (state) => state.seriesType },
  { command: { type: "setPriceScaleMode", mode: "log" }, read: (state) => state.viewport.priceScaleMode },
  { command: { type: "zoomIn" }, read: (state) => state.viewport.candleWidth },
  { command: { type: "zoomOut" }, read: (state) => state.viewport.candleWidth },
  {
    command: { type: "resetZoom" },
    read: (state) => state.viewport,
    arrange: (engine) => engine.dispatch({ type: "zoomIn" })
  },
  { command: { type: "pan", deltaX: 24 }, read: (state) => state.viewport.scrollOffset },
  { command: { type: "toggleGrid" }, read: (state) => state.settings.gridVisible },
  { command: { type: "setThemeMode", themeMode: "dark" }, read: (state) => state.settings.themeMode }
];

for (const { command, read, arrange } of cases) {
  const engine = createChartEngine({ series: fixtureCandleSeries(200) });
  arrange?.(engine);
  const before = structuredClone(read(engine.getState()));
  engine.dispatch(command);
  expect(read(engine.getState())).not.toEqual(before);
}
```

Use a dedicated assertion for `setViewport`, because its supplied target may equal the initial value. The 200-candle fixture also ensures `pan` has room to advance its scroll offset.

- [ ] **Step 2: Run tests and observe current no-op commands**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/commands.test.ts packages/chart-engine/src/__tests__/chartEngine.test.ts
```

Expected: FAIL for zoom, reset, and pan because the current reducer only records `lastCommandType`.

- [ ] **Step 3: Replace fall-through with an exhaustive switch**

Use these viewport semantics inside `reduceCommand`:

```ts
case "setPriceScaleMode":
  return { ...nextState, viewport: { ...state.viewport, priceScaleMode: command.mode } };
case "zoomIn":
case "zoomOut": {
  const anchorIndex = Math.floor((state.viewport.visibleRange.from + state.viewport.visibleRange.to) / 2);
  const deltaY = command.type === "zoomIn" ? -1 : 1;
  return {
    ...nextState,
    viewport: zoomViewportAtIndex(state.viewport, anchorIndex, deltaY, state.series.candles.length)
  };
}
case "resetZoom": {
  const visibleCount = Math.max(1, state.viewport.visibleRange.to - state.viewport.visibleRange.from + 1);
  const plotWidth = visibleCount * state.viewport.candleWidth;
  return { ...nextState, viewport: resetViewportToLatest(state.series.candles.length, plotWidth) };
}
case "pan":
  return {
    ...nextState,
    viewport: panViewportByPixels(state.viewport, command.deltaX, state.series.candles.length)
  };
```

Handle every other union member explicitly. End with:

```ts
default:
  return assertNever(command);
```

Define:

```ts
function assertNever(value: never): never {
  throw new Error(`Unhandled chart command: ${JSON.stringify(value)}`);
}
```

Do not re-add `setTimeframe`, `setDrawingTool`, `deleteSelectedDrawing`, `lockSelectedDrawing`, `hideSelectedDrawing`, `undo`, or `redo`. Timeframe is selected by loading a new `CandleSeries`; every drawing operation belongs to `DrawingEditorCommand` and `DrawingEditor`.

- [ ] **Step 4: Route playground buttons to the canonical commands**

Keep keyboard and buttons on these exact dispatches:

```ts
chartEngine.dispatch({ type: "zoomIn" });
chartEngine.dispatch({ type: "zoomOut" });
chartEngine.dispatch({ type: "resetZoom" });
chartEngine.dispatch({ type: "setPriceScaleMode", mode: "percentage" });
```

Route drawing tool selection/delete/lock/hide/undo/redo to `drawingEditor.executeCommand()` or its methods, never `chartEngine.dispatch()`. Route a timeframe control through the data adapter and then `chartEngine.setSeries()`; never dispatch an engine-only timeframe flag.

- [ ] **Step 5: Run focused unit and browser tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/commands.test.ts packages/chart-engine/src/__tests__/chartEngine.test.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/settings-actions.spec.ts
```

Expected: PASS; each chart command changes its owned state and each drawing command changes editor state.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/commands/chartCommands.ts packages/chart-engine/src/engine/chartEngine.ts packages/chart-engine/src/engine/chartState.ts packages/chart-engine/src/__tests__/commands.test.ts packages/chart-engine/src/__tests__/chartEngine.test.ts apps/playground/src/main.ts apps/playground/tests/settings-actions.spec.ts
git commit -m "fix(engine): make chart commands effectful"
```

## Task 6: Complete Step And Continuous Drawing Pointer Lifecycle

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingCommands.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditState.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingEditor.test.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingCoverage.test.ts`

**Interfaces:**
- Consumes: `DrawingToolDefinition.drawingMode` and all 63 built-in definitions.
- Produces: `DrawingEditorState.previewDrawing`, `drawingPreviewChanged`, and complete pointer lifecycle.

- [ ] **Step 1: Write failing step-preview and continuous-gesture tests**

Add these exact expectations:

```ts
it("previews a step tool before its final anchor", () => {
  const editor = createDrawingEditor({ drawings: [] });
  editor.setTool("trendLine");
  editor.pointerDown({ x: 10, y: 20, time: 1, price: 10 });
  editor.pointerMove({ x: 30, y: 40, time: 2, price: 12 });
  expect(editor.getState().previewDrawing?.anchors).toHaveLength(2);
  expect(editor.getState().drawings).toHaveLength(0);
});

for (const type of ["path", "brush", "forecastPath"] as const) {
  it(`commits ${type} on pointer up`, () => {
    const editor = createDrawingEditor({ drawings: [] });
    editor.setTool(type);
    editor.pointerDown({ x: 10, y: 10, time: 1, price: 10 });
    editor.pointerMove({ x: 20, y: 20, time: 2, price: 11 });
    editor.pointerMove({ x: 30, y: 25, time: 3, price: 12 });
    expect(editor.getState().drawings).toHaveLength(0);
    expect(editor.getState().previewDrawing?.anchors.length).toBeGreaterThanOrEqual(3);
    editor.pointerUp({ x: 40, y: 30, time: 4, price: 13 });
    expect(editor.getState().drawings).toHaveLength(1);
    expect(editor.getState().previewDrawing).toBeUndefined();
  });
}

it("cancels an incomplete continuous gesture without history", () => {
  const editor = createDrawingEditor({ drawings: [] });
  editor.setTool("path");
  editor.pointerDown({ x: 10, y: 10, time: 1, price: 10 });
  editor.pointerUp({ x: 10, y: 10, time: 1, price: 10 });
  expect(editor.getState()).toMatchObject({ drawings: [], previewDrawing: undefined });
  expect(editor.getCapabilities().canUndo).toBe(false);
});
```

- [ ] **Step 2: Run focused tests and verify empty handlers fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingEditor.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts packages/chart-engine/src/__tests__/drawingCoverage.test.ts
```

Expected: FAIL because `pointerMove()` and `pointerUp()` currently do nothing and state has no preview.

- [ ] **Step 3: Add preview state and event**

Extend the public state/event shapes exactly:

```ts
export interface DrawingEditorState {
  drawings: DrawingObject[];
  selectedDrawingIds: string[];
  activeTool: DrawingEditorTool;
  isCreating: boolean;
  previewDrawing?: DrawingObject;
}

export type DrawingEditorEvent =
  | { type: "toolChanged"; tool: DrawingEditorTool }
  | { type: "selectionChanged"; selectedDrawingIds: string[] }
  | { type: "drawingCreated"; drawing: DrawingObject }
  | { type: "drawingUpdated"; drawing: DrawingObject }
  | { type: "drawingDeleted"; drawingId: string }
  | { type: "drawingPreviewChanged"; drawing?: DrawingObject }
  | { type: "creationCanceled" };
```

Use a private `previewDrawing` variable and clone it from `getState()`.

- [ ] **Step 4: Implement deterministic pointer behavior**

Use these rules in `drawingEditor.ts`:

```ts
function isContinuousTool(): boolean {
  return activeTool !== "select" && toolRegistry.require(activeTool).drawingMode === "continuous";
}

function emitPreview(drawing: DrawingObject | undefined): void {
  previewDrawing = drawing ? cloneDrawing(drawing) : undefined;
  emit({ type: "drawingPreviewChanged", drawing: previewDrawing ? cloneDrawing(previewDrawing) : undefined });
}
```

- Step tools: `pointerDown` appends a committed anchor; `pointerMove` builds an ephemeral object from `pendingAnchors + hoverAnchor`; reaching `anchorCount` on `pointerDown` commits once and clears preview.
- Continuous tools: `pointerDown` starts one anchor; `pointerMove` appends a point only when it differs from the last sampled `x/y`; `pointerUp` appends a distinct final point and commits exactly once when the definition's `anchorCount` minimum is met. `anchorCount` is the minimum for continuous tools, not a maximum. If pointer-up occurs below that minimum, or pointer-cancel occurs at any point, emit cancellation, clear pending anchors and preview, create no drawing, and add no undo-history entry.
- `cancel`, `setTool`, `undo`, and `redo` clear pending anchors and preview and emit the corresponding preview/cancel event.

The continuous finalization body must use the existing `commitSnapshot` path:

```ts
const drawing: DrawingObject = {
  id: createDrawingId(drawings, nextDrawingNumber),
  type: activeTool,
  anchors: pendingAnchors.map((anchor) => ({ ...anchor }))
};

commitSnapshot(
  "createDrawing",
  { drawings: [...drawings, drawing], selectedDrawingIds: [drawing.id] },
  () => {
    emit({ type: "drawingCreated", drawing: cloneDrawing(drawing) });
    emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
  }
);
```

- [ ] **Step 5: Run drawing lifecycle and 63-tool coverage**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingEditor.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts packages/chart-engine/src/__tests__/drawingCoverage.test.ts
```

Expected: PASS for all 63 definitions; continuous tools commit only on pointer up and canceled gestures create nothing.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/drawing/drawingCommands.ts packages/chart-engine/src/drawing/drawingEditor.ts packages/chart-engine/src/drawing/drawingEditState.ts packages/chart-engine/src/__tests__/drawingEditor.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts packages/chart-engine/src/__tests__/drawingCoverage.test.ts
git commit -m "feat(engine): complete drawing pointer lifecycle"
```

## Task 7: Drawing Domain And Screen Coordinate Projection

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingCoordinates.ts`
- Create: `packages/chart-engine/src/__tests__/drawingCoordinates.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

**Interfaces:**
- Consumes: `CandleSeries`, `ViewportState`, `ChartLayout.plotArea`, `PriceScale`.
- Produces: `DrawingCoordinateContext`, `projectDrawingObject`, `unprojectDrawingObject`, `drawingPointFromPointer`.

- [ ] **Step 1: Write failing projection tests**

Create tests that verify a domain anchor moves on viewport/scale changes while its time/price remains stable:

```ts
const drawing = {
  id: "domain-line",
  type: "trendLine" as const,
  anchors: [
    { time: series.candles[0].time, price: 100 },
    { time: series.candles[1].time, price: 200 }
  ]
};

const linear = createDrawingContext(series, "linear");
const log = createDrawingContext(series, "log");
const projectedLinear = projectDrawingObject(drawing, linear);
const projectedLog = projectDrawingObject(drawing, log);

expect(projectedLinear.anchors[0].time).toBe(drawing.anchors[0].time);
expect(projectedLinear.anchors[0].price).toBe(100);
expect(projectedLinear.anchors[0].x).toBeTypeOf("number");
expect(projectedLinear.anchors[1].y).not.toBe(projectedLog.anchors[1].y);
expect(unprojectDrawingObject(projectedLog, log).anchors[1]).toEqual({
  time: series.candles[1].time,
  price: 200
});
```

- [ ] **Step 2: Run the test and verify missing APIs**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingCoordinates.test.ts
```

Expected: FAIL because the projection module does not exist.

- [ ] **Step 3: Implement one coordinate boundary**

Create this contract:

```ts
export interface DrawingCoordinateContext {
  series: CandleSeries;
  viewport: ViewportState;
  plotArea: { x: number; y: number; width: number; height: number };
  priceScale: PriceScale;
}
```

Implement projection with existing `indexToX`, `xToIndex`, `priceToY`, and `yToPrice`:

```ts
function projectAnchor(anchor: DrawingAnchor, context: DrawingCoordinateContext): DrawingAnchor {
  const index = resolveAnchorIndex(anchor, context.series);
  const price = anchor.price;
  return {
    time: anchor.time,
    price,
    x: indexToX(index, context.viewport, context.plotArea.x),
    y: typeof price === "number"
      ? priceToY(price, context.priceScale, context.plotArea.y, context.plotArea.height)
      : anchor.y
  };
}

function unprojectAnchor(anchor: DrawingAnchor, context: DrawingCoordinateContext): DrawingAnchor {
  const rawIndex = xToIndex(anchor.x ?? context.plotArea.x, context.viewport, context.plotArea.x);
  const index = Math.max(0, Math.min(context.series.candles.length - 1, rawIndex));
  const price = yToPrice(
    anchor.y ?? context.plotArea.y,
    context.priceScale,
    context.plotArea.y,
    context.plotArea.height
  );
  return { time: context.series.candles[index]?.time, price };
}
```

`resolveAnchorIndex` finds an exact `time`, otherwise selects the nearest candle only for transient x placement; projection never rewrites the canonical `anchor.time`, and persisted `index` is never trusted across timeframes. `projectDrawingObject` returns transient `x/y` alongside canonical `time/price`. After an actual pointer edit, `unprojectDrawingObject` maps the edited x/y back to the nearest candle time and absolute price, strips `x`, `y`, and `index`, and returns canonical anchors only. Neither function mutates input.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingCoordinates.test.ts packages/chart-engine/src/__tests__/drawingRenderers.test.ts packages/chart-engine/src/__tests__/drawingHitTest.test.ts
```

Expected: PASS; serialization retains domain fields and projection supplies finite screen fields.

- [ ] **Step 5: Commit**

```bash
git add packages/chart-engine/src/drawing/drawingCoordinates.ts packages/chart-engine/src/__tests__/drawingCoordinates.test.ts packages/chart-engine/src/index.ts
git commit -m "feat(engine): add drawing coordinate projection"
```

## Task 8: Persistence, Capability Manifest, Playground, And Engine Gate

**Files:**
- Modify: `packages/chart-engine/src/model/helpers.ts`
- Modify: `packages/chart-engine/src/persistence/layoutSnapshot.ts`
- Modify: `packages/chart-engine/src/engine/engineCapabilityManifest.ts`
- Modify: `packages/chart-engine/package.json`
- Modify: `apps/playground/package.json`
- Modify: `package-lock.json`
- Modify: `scripts/check-package-artifact.mjs`
- Modify: `scripts/check-host-smoke.mjs`
- Modify: `scripts/check-release-readiness.mjs`
- Modify: `scripts/__tests__/check-release-readiness.test.mjs`
- Modify: `packages/chart-engine/src/__tests__/persistenceContract.test.ts`
- Modify: `packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts`
- Modify: `packages/chart-engine/src/__tests__/hostIntegrationContract.test.ts`
- Modify: `apps/playground/src/playgroundState.ts`
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/interaction-rendering-hardening.spec.ts`
- Modify: `apps/playground/tests/drawing-coverage.spec.ts`
- Modify: `docs/engine/actions-and-commands.md`
- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/public-api.md`
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`

**Interfaces:**
- Consumes: all Task 1–7 contracts.
- Produces: truthful manifest and stable package snapshots consumed by the workspace plan.

- [ ] **Step 1: Write failing manifest and persistence assertions**

Add:

```ts
const manifest = createEngineCapabilityManifest();
expect(manifest.timeframes).toEqual(supportedTimeframes);
expect(manifest.priceScaleModes).toEqual(supportedPriceScaleModes);
expect(manifest.drawingEditorCapabilities).toContain("previewDrawing");
expect(manifest.interactionCapabilities).toContain("continuousDrawing");
expect(manifest.calculationCapabilities).toEqual([
  "checkpointedCoreIndicators",
  "checkpointedSyntheticSeries"
]);

const snapshot = serializeChartLayoutSnapshot({
  viewport: {
    visibleRange: { from: 0, to: 1 },
    candleWidth: 8,
    scrollOffset: 0,
    priceScaleMode: "percentage"
  },
  drawings: [],
  indicatorIds: []
});
expect(deserializeChartLayoutSnapshot(snapshot).viewport.priceScaleMode).toBe("percentage");
```

- [ ] **Step 2: Run focused tests and verify stale contracts fail**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/persistenceContract.test.ts packages/chart-engine/src/__tests__/engineCapabilityManifest.test.ts packages/chart-engine/src/__tests__/hostIntegrationContract.test.ts
```

Expected: FAIL because the manifest does not expose timeframes/scales/lifecycle and snapshot validation rejects `percentage`.

- [ ] **Step 3: Make validation and capability claims exact**

Add these manifest fields:

```ts
timeframes: Timeframe[];
priceScaleModes: PriceScaleMode[];
```

Populate them from the canonical arrays. Extend the capability unions with `previewDrawing`, `continuousDrawing`, `checkpointedCoreIndicators`, and `checkpointedSyntheticSeries`. Update `isViewportState()` to accept exactly the three canonical scale values. Update `isValidCandle()` to require finite time/OHLC/volume/turnover, positive OHLC, nonnegative volume/turnover, and valid OHLC bounds.

- [ ] **Step 4: Expose every new state in the playground**

Add all eight timeframe controls and all three scale controls. Render `drawingEditor.getState().previewDrawing` together with committed drawings:

```ts
const editorState = drawingEditor.getState();
const drawings = editorState.previewDrawing
  ? [...editorState.drawings, editorState.previewDrawing]
  : editorState.drawings;
chartEngine.setDrawings(drawings);
```

Playwright must select `1m`, select `percentage`, complete a brush gesture, cancel a second gesture, and assert the committed object count changes only once.

- [ ] **Step 5: Refresh intentional RC API snapshots**

Before snapshot refresh, advance the changed internal engine RC from `1.0.0-rc.0` to `1.0.0-rc.1`. Update the engine package, capability manifest, playground dependency, lockfile, current README/changelog/release-candidate docs, and current release/artifact/host-smoke expectations. Do not rewrite historical implementation-plan evidence files.

Run:

```bash
npm run build -w @simoncharts/chart-engine
node scripts/check-public-api.mjs --write
node scripts/check-public-types.mjs --write
```

Expected: runtime and type snapshots are rewritten, sorted, and include the new scale, time-formatter, calculation-checkpoint, precomputed-series-model, and drawing-coordinate exports while removing the duplicate dispatcher exports.

- [ ] **Step 6: Run the full engine gate**

Run:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run build
npm run check:package-consumer
npm run check:package-types
npm run check:performance
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Expected: every command exits 0; browser tests have no console errors.

- [ ] **Step 7: Commit**

```bash
git add packages/chart-engine apps/playground package-lock.json README.md CHANGELOG.md docs/engine scripts/check-package-artifact.mjs scripts/check-host-smoke.mjs scripts/check-release-readiness.mjs scripts/__tests__/check-release-readiness.test.mjs
git commit -m "feat(engine): certify workspace readiness"
```

## Phase Acceptance

- Eight timeframes compile in source and packed declarations, persist in series data, load through `setSeries()`, and render in the playground.
- Linear/log/percentage are invertible and used by axes, series, indicators, crosshair, magnet, and drawing projection.
- No `ChartEngineCommand` variant falls through or belongs to the drawing editor.
- Step tools preview before completion; path, brush, and forecast path commit on pointer up and cancel cleanly.
- Domain drawing coordinates survive viewport, timeframe, and price scale projection.
- Chunked indicator and stateful-series calculations equal full-series output while retaining bounded checkpoints.
- Public snapshots and the complete existing engine gate pass before the workspace package begins.
