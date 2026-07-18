import { describe, expect, it, vi } from "vitest";
import {
  createChartLayout,
  createMainPanelPriceScale,
  indexToX,
  priceToY,
  type IndicatorResult,
  type SeriesRenderModel,
  type ViewportState
} from "@simoncharts/chart-engine";
import type { MaterializedSeries } from "../data/materializedSeries";
import type { CheckpointedCalculationRuntime } from "../runtime/checkpointedCalculationRuntime";
import { createChartEngineRuntime } from "../runtime/chartEngineRuntime";
import { readWorkspaceChartTheme } from "../runtime/workspaceTheme";

class FakeCanvas {
  width = 800;
  height = 500;
  clientWidth = 800;
  clientHeight = 500;
  style: Record<string, string> = {};
  readonly texts: string[] = [];
  private readonly capturedPointers = new Set<number>();
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly context = new Proxy(
    { canvas: this },
    {
      get: (target, key) => {
        if (key in target) return target[key as keyof typeof target];
        if (key === "fillText") return (value: unknown) => this.texts.push(String(value));
        if (key === "measureText") return (value: unknown) => ({ width: String(value).length * 7 });
        return () => undefined;
      },
      set(target, key, value) {
        (target as Record<PropertyKey, unknown>)[key] = value;
        return true;
      }
    }
  );

  getContext() { return this.context as unknown as CanvasRenderingContext2D; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  focus() {}
  setPointerCapture(pointerId: number) { this.capturedPointers.add(pointerId); }
  hasPointerCapture(pointerId: number) { return this.capturedPointers.has(pointerId); }
  releasePointerCapture(pointerId: number) { this.capturedPointers.delete(pointerId); }
  addEventListener(type: string, listener: EventListener) {
    const entries = this.listeners.get(type) ?? new Set<EventListener>();
    entries.add(listener);
    this.listeners.set(type, entries);
  }
  removeEventListener(type: string, listener: EventListener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type: string, event: Record<string, unknown>) {
    for (const listener of this.listeners.get(type) ?? []) listener(event as unknown as Event);
  }
  listenerCount() { return [...this.listeners.values()].reduce((total, entries) => total + entries.size, 0); }
}

const calculationRuntime: CheckpointedCalculationRuntime = {
  async calculateIndicators() { return new Map<string, IndicatorResult>(); },
  async calculateSeries(input) {
    return { type: input.type, source: materialized().series, sourceIndexOffset: 0, points: [] } satisfies SeriesRenderModel;
  }
};

function materialized(start = 1, count = 100): MaterializedSeries {
  const candles = Array.from({ length: count }, (_, index) => ({
    time: start + index,
    open: 100 + index,
    high: 102 + index,
    low: 99 + index,
    close: 101 + index,
    volume: 1_000,
    turnover: 101_000
  }));
  return {
    selection: {
      symbol: { id: "SSE:600000", code: "600000", name: "浦发银行", exchange: "SSE", kind: "stock" },
      timeframe: "1m",
      adjustMode: "forward"
    },
    series: { symbol: "SSE:600000", timeframe: "1m", adjustMode: "forward", dataVersion: "v1", candles },
    sourceIndexOffset: 0,
    sourceMinTime: start,
    sourceMaxTime: start + count - 1,
    hasMoreBefore: false,
    hasKnownOlderData: false,
    hasKnownNewerPages: false,
    missingRequestCursors: []
  };
}

describe("workspace engine runtime", () => {
  it("supplies valid defaults for every stateful series transform", async () => {
    const calculateSeries = vi.fn(async (input: Parameters<CheckpointedCalculationRuntime["calculateSeries"]>[0]) => ({
      type: input.type,
      source: materialized().series,
      sourceIndexOffset: 0,
      points: []
    }) satisfies SeriesRenderModel);
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: { async calculateIndicators() { return new Map(); }, calculateSeries },
      requestFrame: () => 1,
      cancelFrame: () => undefined
    });
    runtime.setMaterializedSeries(materialized());

    for (const type of ["heikinAshi", "renko", "lineBreak", "kagi", "pointAndFigure"] as const) {
      runtime.setSeriesType(type);
      await vi.waitFor(() => expect(calculateSeries).toHaveBeenCalledWith(expect.objectContaining({ type })));
    }

    expect(calculateSeries.mock.calls.map(([input]) => [input.type, input.options])).toEqual([
      ["heikinAshi", {}],
      ["renko", { brickSize: 1 }],
      ["lineBreak", { lineCount: 3 }],
      ["kagi", { reversalAmount: 2 }],
      ["pointAndFigure", { boxSize: 1, reversalBoxes: 3 }]
    ]);
    runtime.destroy();
  });

  it("keeps one drag session across multiple viewport updates and captured pointer up", () => {
    const overlayCanvas = new FakeCanvas();
    const viewports: ViewportState[] = [];
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onViewportChanged: (next) => viewports.push(structuredClone(next))
    });
    runtime.setMaterializedSeries(materialized(1, 500));
    const start = viewports.at(-1)!;

    overlayCanvas.dispatch("pointerdown", { pointerId: 7, clientX: 300, clientY: 200 });
    overlayCanvas.dispatch("pointermove", { pointerId: 7, clientX: 300 + start.candleWidth * 3, clientY: 200 });
    overlayCanvas.dispatch("pointermove", { pointerId: 7, clientX: 300 + start.candleWidth * 6, clientY: 200 });
    overlayCanvas.dispatch("pointerup", { pointerId: 7, clientX: 300 + start.candleWidth * 6, clientY: 200 });

    expect(viewports.at(-1)?.scrollOffset).toBe(start.scrollOffset + 6);
    expect(overlayCanvas.hasPointerCapture(7)).toBe(false);
    runtime.destroy();
  });

  it("supports wheel pan, time-axis spacing drag, and Alt+R reset", () => {
    const overlayCanvas = new FakeCanvas();
    const viewports: ViewportState[] = [];
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onViewportChanged: (next) => viewports.push(structuredClone(next))
    });
    runtime.setMaterializedSeries(materialized(1, 500));
    const initial = viewports.at(-1)!;
    const preventDefault = vi.fn();

    overlayCanvas.dispatch("wheel", { clientX: 300, clientY: 200, deltaX: 0, deltaY: 80, shiftKey: true, preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(viewports.at(-1)?.scrollOffset).toBeGreaterThan(initial.scrollOffset);

    const beforeScale = viewports.at(-1)!;
    overlayCanvas.dispatch("pointerdown", { pointerId: 8, clientX: 300, clientY: 490 });
    overlayCanvas.dispatch("pointermove", { pointerId: 8, clientX: 460, clientY: 490 });
    overlayCanvas.dispatch("pointerup", { pointerId: 8, clientX: 460, clientY: 490 });
    expect(viewports.at(-1)!.candleWidth).toBeGreaterThan(beforeScale.candleWidth);

    overlayCanvas.dispatch("keydown", { key: "r", altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: vi.fn() });
    expect(viewports.at(-1)?.scrollOffset).toBe(0);
    runtime.destroy();
  });

  it("computes data-window change from previous close and skips duplicate candle publishes", () => {
    const overlayCanvas = new FakeCanvas();
    const snapshots: Array<import("../runtime/chartEngineRuntime").DataWindowSnapshot | undefined> = [];
    const source = materialized(1, 100);
    source.series.candles[49]!.close = 90;
    source.series.candles[50]!.open = 120;
    source.series.candles[50]!.close = 100;
    const viewports: ViewportState[] = [];
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onViewportChanged: (next) => viewports.push(structuredClone(next)),
      onDataWindowChanged: (snapshot) => snapshots.push(snapshot)
    });
    runtime.setMaterializedSeries(source);
    expect(snapshots.at(-1)?.candle.time).toBe(100);
    snapshots.length = 0;
    const viewport = viewports.at(-1)!;
    const x = indexToX(50, viewport, 0);

    overlayCanvas.dispatch("pointermove", { clientX: x, clientY: 200 });
    overlayCanvas.dispatch("pointermove", { clientX: x + 1, clientY: 220 });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ change: 10, changePercent: 100 / 9 });
    overlayCanvas.dispatch("pointerleave", {});
    expect(snapshots.at(-1)?.candle.time).toBe(100);
    runtime.destroy();
  });

  it("renders a fixed intraday percentage axis and fits all nine days on first paint", () => {
    const staticCanvas = new FakeCanvas();
    const viewports: ViewportState[] = [];
    const renderErrors: unknown[] = [];
    let frame: (() => void) | undefined;
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 390, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: (callback) => { frame = callback; return 1; },
      cancelFrame: () => undefined,
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
      onViewportChanged: (viewport) => viewports.push(structuredClone(viewport)),
      onRenderError: (error) => renderErrors.push(error)
    });
    const source: MaterializedSeries = {
      ...materialized(1, 2_169),
      intradayDays: 9,
      intradayScale: { previousClose: 100, priceLimitPercent: 10 }
    };

    runtime.setMaterializedSeries(source);
    frame?.();

    expect(viewports.at(-1)?.visibleRange).toEqual({ from: 0, to: 2_168 });
    expect(viewports.at(-1)?.candleWidth).toBeGreaterThanOrEqual(0.05);
    expect(viewports.at(-1)?.candleWidth).toBeLessThan(0.25);
    expect(runtime.getVisibleRange()).toEqual({ from: 1, to: 2_169 });
    expect(renderErrors).toEqual([]);
    expect(staticCanvas.texts).toEqual(expect.arrayContaining(["+10.00%", "0.00%", "-10.00%"]));
    runtime.destroy();
  });

  it("keeps every intraday viewport interaction locked to the full materialized window", () => {
    const overlayCanvas = new FakeCanvas();
    const viewports: ViewportState[] = [];
    const themeRoot = { clientWidth: 800, clientHeight: 500 };
    let frame: (() => void) | undefined;
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: themeRoot as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: (callback) => { frame = callback; return 1; },
      cancelFrame: () => undefined,
      onViewportChanged: (viewport) => viewports.push(structuredClone(viewport))
    });
    const source: MaterializedSeries = { ...materialized(1, 2_169), intradayDays: 9 };
    runtime.setMaterializedSeries(source);
    frame?.();
    const locked = structuredClone(viewports.at(-1)!);
    const viewportEventCount = viewports.length;
    const preventDefault = vi.fn();

    overlayCanvas.dispatch("wheel", { clientX: 300, clientY: 200, deltaX: 0, deltaY: -80, shiftKey: false, preventDefault });
    overlayCanvas.dispatch("wheel", { clientX: 300, clientY: 200, deltaX: 0, deltaY: 80, shiftKey: true, preventDefault });
    overlayCanvas.dispatch("pointerdown", { pointerId: 1, clientX: 300, clientY: 200 });
    overlayCanvas.dispatch("pointermove", { pointerId: 1, clientX: 500, clientY: 200 });
    overlayCanvas.dispatch("pointerup", { pointerId: 1, clientX: 500, clientY: 200 });
    overlayCanvas.dispatch("pointerdown", { pointerId: 2, clientX: 780, clientY: 200 });
    overlayCanvas.dispatch("pointermove", { pointerId: 2, clientX: 780, clientY: 300 });
    overlayCanvas.dispatch("pointerup", { pointerId: 2, clientX: 780, clientY: 300 });
    overlayCanvas.dispatch("pointerdown", { pointerId: 3, clientX: 300, clientY: 490 });
    overlayCanvas.dispatch("pointermove", { pointerId: 3, clientX: 500, clientY: 490 });
    overlayCanvas.dispatch("pointerup", { pointerId: 3, clientX: 500, clientY: 490 });
    for (const event of [
      { key: "+", altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
      { key: "-", altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
      { key: "ArrowLeft", altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
      { key: "ArrowUp", altKey: false, ctrlKey: true, metaKey: false, shiftKey: false },
      { key: "0", altKey: false, ctrlKey: false, metaKey: false, shiftKey: false }
    ]) overlayCanvas.dispatch("keydown", { ...event, preventDefault: vi.fn() });

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(viewports).toHaveLength(viewportEventCount);
    expect(viewports.at(-1)).toEqual(locked);
    expect(runtime.setVisibleRange({ from: 500, to: 700 })).toBe(false);

    themeRoot.clientWidth = 600;
    runtime.retryRender();
    frame?.();
    expect(viewports.at(-1)?.visibleRange).toEqual({ from: 0, to: 2_168 });
    expect(viewports.at(-1)?.candleWidth).toBeCloseTo((600 - 128) / 2_169);

    const expanded: MaterializedSeries = { ...materialized(1, 2_200), intradayDays: 9 };
    runtime.setMaterializedSeries(expanded, 1_000);
    expect(viewports.at(-1)?.visibleRange).toEqual({ from: 0, to: 2_199 });
    expect(viewports.at(-1)?.scrollOffset).toBe(0);
    runtime.destroy();
  });

  it("publishes the latest Shanghai intraday day summary only for intraday materialization", () => {
    const snapshots: Array<import("../runtime/chartEngineRuntime").DataWindowSnapshot | undefined> = [];
    const dayOne = Date.UTC(2026, 6, 15, 1, 30);
    const dayTwo = Date.UTC(2026, 6, 16, 1, 30);
    const source = materialized(1, 4);
    source.series.candles = [
      { time: dayOne, open: 10, high: 12, low: 9, close: 11, volume: 1, turnover: 11 },
      { time: dayOne + 60_000, open: 11, high: 13, low: 10, close: 12, volume: 1, turnover: 12 },
      { time: dayTwo, open: 20, high: 24, low: 19, close: 22, volume: 1, turnover: 22 },
      { time: dayTwo + 60_000, open: 22, high: 25, low: 18, close: 24, volume: 1, turnover: 24 }
    ];
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onDataWindowChanged: (snapshot) => snapshots.push(snapshot)
    });

    runtime.setMaterializedSeries({ ...source, intradayDays: 2, intradayScale: { previousClose: 9 } });
    expect(snapshots.at(-1)?.intradaySummary).toEqual({
      open: 20,
      high: 25,
      low: 18,
      close: 24,
      previousClose: 12
    });

    runtime.setMaterializedSeries(source);
    expect(snapshots.at(-1)?.intradaySummary).toBeUndefined();
    runtime.destroy();
  });

  it("selects and body-drags an existing drawing while blank space still pans", () => {
    const overlayCanvas = new FakeCanvas();
    const source = materialized(1, 100);
    const viewports: ViewportState[] = [];
    const drawingUpdates: import("@simoncharts/chart-engine").DrawingObject[][] = [];
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onViewportChanged: (next) => viewports.push(structuredClone(next)),
      onDrawingsChanged: (drawings) => drawingUpdates.push(drawings)
    });
    runtime.setMaterializedSeries(source);
    const viewport = viewports.at(-1)!;
    const scale = createMainPanelPriceScale(source.series, viewport.visibleRange, "linear", [], []);
    runtime.setDrawings([{
      id: "line",
      type: "trendLine",
      anchors: [{ time: 40, price: 140 }, { time: 60, price: 140 }]
    }]);
    const startX = indexToX(50, viewport, 0);
    const plotArea = createChartLayout(800, 500).plotArea;
    const startY = priceToY(140, scale, plotArea.y, plotArea.height);

    overlayCanvas.dispatch("pointerdown", { pointerId: 3, clientX: startX, clientY: startY });
    overlayCanvas.dispatch("pointermove", { pointerId: 3, clientX: startX + viewport.candleWidth * 2, clientY: startY });
    overlayCanvas.dispatch("pointerup", { pointerId: 3, clientX: startX + viewport.candleWidth * 2, clientY: startY });
    expect(drawingUpdates.at(-1)?.[0]?.anchors[0]?.time).toBe(42);

    const handleX = indexToX(source.series.candles.findIndex((candle) => candle.time === 42), viewport, 0);
    overlayCanvas.dispatch("pointerdown", { pointerId: 5, clientX: handleX, clientY: startY });
    overlayCanvas.dispatch("pointermove", { pointerId: 5, clientX: handleX + viewport.candleWidth, clientY: startY });
    overlayCanvas.dispatch("pointerup", { pointerId: 5, clientX: handleX + viewport.candleWidth, clientY: startY });
    expect(drawingUpdates.at(-1)?.[0]?.anchors[0]?.time).toBe(43);

    const beforePan = viewports.at(-1)!.scrollOffset;
    overlayCanvas.dispatch("pointerdown", { pointerId: 4, clientX: 700, clientY: 100 });
    overlayCanvas.dispatch("pointermove", { pointerId: 4, clientX: 700 + viewport.candleWidth * 2, clientY: 100 });
    overlayCanvas.dispatch("pointerup", { pointerId: 4, clientX: 700 + viewport.candleWidth * 2, clientY: 100 });
    expect(viewports.at(-1)?.scrollOffset).toBe(beforePan + 2);
    runtime.destroy();
  });

  it("wires dark A-share theme, isolates overlay frames, and destroys exactly once", async () => {
    const staticCanvas = new FakeCanvas();
    const overlayCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    const cancelFrame = vi.fn((id: number) => frames.delete(id));
    const onDrawingsChanged = vi.fn();
    const onDrawingHistoryChanged = vi.fn();
    const calculationRuntime: CheckpointedCalculationRuntime = {
      async calculateIndicators() { return new Map<string, IndicatorResult>(); },
      async calculateSeries(input) {
        return { type: input.type, source: materialized().series, sourceIndexOffset: 0, points: [] } satisfies SeriesRenderModel;
      }
    };
    const themeRoot = { clientWidth: 800, clientHeight: 500 } as HTMLElement;
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot,
      observer,
      calculationRuntime,
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame,
      getComputedStyle: () => ({
        getPropertyValue(name: string) {
          return ({ "--sc-bg": "#08090d", "--sc-up": "#f04455", "--sc-down": "#00aa91" } as Record<string, string>)[name] ?? "";
        }
      }) as CSSStyleDeclaration,
      devicePixelRatio: 1,
      onDrawingsChanged,
      onDrawingHistoryChanged
    });

    runtime.setMaterializedSeries(materialized());
    runtime.setDrawings([{ id: "restored", type: "trendLine", anchors: [] }]);
    expect(onDrawingsChanged).not.toHaveBeenCalled();
    expect(onDrawingHistoryChanged).toHaveBeenLastCalledWith({ canUndo: false, canRedo: false });
    for (const callback of [...frames.values()]) callback();
    frames.clear();
    const before = runtime.getMetrics();
    for (let index = 0; index < 100; index += 1) {
      overlayCanvas.dispatch("pointermove", { offsetX: 100 + index, offsetY: 200 });
    }
    for (const callback of [...frames.values()]) callback();
    frames.clear();
    const after = runtime.getMetrics();
    expect(after.renderCountByPass.static).toBe(before.renderCountByPass.static);
    expect(after.renderCountByPass.overlay).toBeGreaterThan(before.renderCountByPass.overlay);
    expect(after.maxMaterializedCandleCount).toBeLessThan(20_000);

    runtime.retryRender();
    runtime.destroy();
    runtime.destroy();
    runtime.setDrawings([{ id: "late", type: "trendLine", anchors: [] }]);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(cancelFrame).toHaveBeenCalled();
    expect(staticCanvas.listenerCount()).toBe(0);
    expect(overlayCanvas.listenerCount()).toBe(0);
    expect(onDrawingsChanged).not.toHaveBeenCalled();
  });

  it("reads the approved Canvas colors from workspace variables", () => {
    const theme = readWorkspaceChartTheme({} as Element, {
      getPropertyValue(name: string) {
        return ({ "--sc-bg": "#08090d", "--sc-up": "#f04455", "--sc-down": "#00aa91" } as Record<string, string>)[name] ?? "";
      }
    } as CSSStyleDeclaration);
    expect(theme.colors.background).toBe("#08090d");
    expect(theme.colors.bullishCandle).toBe("#f04455");
    expect(theme.colors.bearishCandle).toBe("#00aa91");
    expect(theme.lineDashes.grid).toEqual([1, 3]);
  });

  it("preserves candle width and the anchor screen slot when history is prepended", () => {
    const staticCanvas = new FakeCanvas();
    const overlayCanvas = new FakeCanvas();
    const viewports: import("@simoncharts/chart-engine").ViewportState[] = [];
    const calculationRuntime: CheckpointedCalculationRuntime = {
      async calculateIndicators() { return new Map<string, IndicatorResult>(); },
      async calculateSeries(input) {
        return { type: input.type, source: materialized().series, sourceIndexOffset: 0, points: [] } satisfies SeriesRenderModel;
      }
    };
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onViewportChanged: (viewport) => viewports.push(structuredClone(viewport))
    });

    runtime.setMaterializedSeries(materialized(1_001, 500));
    expect(runtime.setVisibleRange({ from: 1_401, to: 1_450 })).toBe(true);
    const before = viewports.at(-1)!;
    runtime.setMaterializedSeries(materialized(1_175, 500), 1_425);
    const after = viewports.at(-1)!;

    expect(after.candleWidth).toBe(before.candleWidth);
    expect((1_425 - 1_175) - after.visibleRange.from).toBe((1_425 - 1_001) - before.visibleRange.from);
    expect(runtime.getVisibleRange()).toEqual({ from: 1_401, to: 1_450 });
    runtime.destroy();
  });

  it("raises materialization demand when the viewport zooms out beyond 500 candles", () => {
    const staticCanvas = new FakeCanvas();
    const overlayCanvas = new FakeCanvas();
    const demands: import("../runtime/chartEngineRuntime").MaterializationDemand[] = [];
    const themeRoot = { clientWidth: 800, clientHeight: 500 };
    let frame: (() => void) | undefined;
    const calculationRuntime: CheckpointedCalculationRuntime = {
      async calculateIndicators() { return new Map<string, IndicatorResult>(); },
      async calculateSeries(input) {
        return { type: input.type, source: materialized().series, sourceIndexOffset: 0, points: [] } satisfies SeriesRenderModel;
      }
    };
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: themeRoot as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: (callback) => { frame = callback; return 1; },
      cancelFrame: () => undefined,
      onMaterializationDemandChanged: (demand) => demands.push({ ...demand })
    });
    runtime.setMaterializedSeries(materialized(1, 2_000));
    const initial = runtime.getMaterializationDemand();
    themeRoot.clientWidth = 1_600;
    frame?.();
    const resized = runtime.getMaterializationDemand();
    expect(resized.visibleCount).toBeGreaterThan(initial.visibleCount);

    for (let index = 0; index < 8; index += 1) {
      overlayCanvas.dispatch("wheel", { offsetX: 800, deltaY: 1 });
    }

    const zoomedOut = runtime.getMaterializationDemand();
    expect(zoomedOut.visibleCount).toBeGreaterThan(resized.visibleCount);
    expect(zoomedOut.visibleCount + zoomedOut.overscanCount * 2).toBeGreaterThan(500);
    expect(demands.at(-1)).toEqual(zoomedOut);
    runtime.destroy();
  });

  it("reads the light Canvas and tooltip theme from the host root", () => {
    const theme = readWorkspaceChartTheme({} as Element, {
      getPropertyValue(name: string) {
        return ({
          "--sc-bg": "#ffffff",
          "--sc-surface": "#f7f8fa",
          "--sc-text": "#1b1f2a",
          "--sc-border": "#d9dde5",
          "--sc-up": "#d92d42",
          "--sc-down": "#008a73"
        } as Record<string, string>)[name] ?? "";
      }
    } as CSSStyleDeclaration);

    expect(theme.colors.background).toBe("#ffffff");
    expect(theme.colors.text).toBe("#1b1f2a");
    expect(theme.colors.bullishCandle).toBe("#d92d42");
    expect(theme.colors.bearishCandle).toBe("#008a73");
    expect(theme.colors.tooltip).toEqual({
      background: "#f7f8fa",
      text: "#1b1f2a",
      border: "#d9dde5"
    });
  });
});
