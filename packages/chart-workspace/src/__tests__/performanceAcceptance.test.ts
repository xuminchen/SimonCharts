import { describe, expect, it, vi } from "vitest";
import {
  createChartLayout,
  createMainPanelPriceScale,
  indexToX,
  priceAtY,
  priceToY,
  type IndicatorResult,
  type SeriesRenderModel,
  type ViewportState
} from "@simoncharts/chart-engine";
import type { MaterializedSeries } from "../data/materializedSeries";
import type { CheckpointedCalculationRuntime } from "../runtime/checkpointedCalculationRuntime";
import { createChartEngineRuntime } from "../runtime/chartEngineRuntime";
import { indicatorOutputId } from "../runtime/indicatorRuntime";
import { readWorkspaceChartTheme } from "../runtime/workspaceTheme";

class FakeCanvas {
  width = 800;
  height = 500;
  clientWidth = 800;
  clientHeight = 500;
  style: Record<string, string> = {};
  readonly texts: string[] = [];
  readonly strokeStyles: string[] = [];
  private readonly capturedPointers = new Set<number>();
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly context = new Proxy(
    { canvas: this },
    {
      get: (target, key) => {
        if (key in target) return target[key as keyof typeof target];
        if (key === "fillText") return (value: unknown) => this.texts.push(String(value));
        if (key === "measureText") return (value: unknown) => ({ width: String(value).length * 7 });
        if (key === "stroke") return () => this.strokeStyles.push(String((target as { strokeStyle?: unknown }).strokeStyle ?? ""));
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
  it("clones, toggles, hovers, and closes execution marker tooltips", () => {
    const staticCanvas = new FakeCanvas();
    const overlayCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    let currentViewport: ViewportState | undefined;
    const onRenderError = vi.fn();
    const onExecutionTooltipChanged = vi.fn();
    const flushFrames = () => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
    };
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500, lang: "zh-CN" } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => { frames.delete(id); },
      devicePixelRatio: 1,
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
      onRenderError,
      onExecutionTooltipChanged,
      onViewportChanged(viewport) { currentViewport = viewport; }
    });
    const source = materialized(1, 100);
    const rows = [{
      id: "execution",
      time: 51,
      side: "buy" as const,
      price: 150,
      quantity: 300,
      amount: 45_000,
      fee: 5,
      tQuantity: 100,
      label: "T买"
    }];
    runtime.setExecutions(rows);
    rows[0]!.label = "changed";
    runtime.setMaterializedSeries(source);
    flushFrames();
    expect(onRenderError).not.toHaveBeenCalled();
    expect(staticCanvas.texts).toContain("T买");
    expect(staticCanvas.texts).not.toContain("changed");

    const layout = createChartLayout(800, 500);
    const scale = createMainPanelPriceScale(source.series, currentViewport!.visibleRange, "linear", [], []);
    const x = indexToX(50, currentViewport!, layout.plotArea.x);
    const y = priceToY(150, scale, layout.plotArea.y, layout.plotArea.height) + 9;
    overlayCanvas.dispatch("pointermove", { clientX: x, clientY: y, pointerType: "mouse" });
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(expect.objectContaining({
      pinned: false,
      rows: expect.arrayContaining([{ label: "金额", value: "45,000" }])
    }));
    expect(overlayCanvas.texts.some((text) => text.includes("金额:"))).toBe(false);

    overlayCanvas.dispatch("pointerleave", {});
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(undefined);

    overlayCanvas.dispatch("pointerdown", { pointerId: 1, clientX: x, clientY: y });
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(expect.objectContaining({ pinned: true }));
    overlayCanvas.dispatch("pointerdown", { pointerId: 2, clientX: 700, clientY: 100 });
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(undefined);

    staticCanvas.texts.splice(0);
    runtime.setExecutionsVisible(false);
    flushFrames();
    expect(staticCanvas.texts).not.toContain("T买");
    runtime.destroy();
  });

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

  it("publishes one complete crosshair snapshot per frame and one explicit leave", async () => {
    const overlayCanvas = new FakeCanvas();
    const source = materialized(1, 100);
    const frames = new Map<number, () => void>();
    const events: Array<import("../runtime/chartEngineRuntime").RuntimeCrosshairSnapshot | undefined> = [];
    const renderErrors: unknown[] = [];
    const calculationStates: import("../runtime/checkpointedCalculationRuntime").CalculationStatus[] = [];
    let nextFrame = 1;
    let currentViewport: ViewportState | undefined;
    let listening = true;
    const flushFrames = () => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
    };
    const points = (value: number) => source.series.candles.map((candle) => ({
      time: candle.time,
      value
    }));
    const indicatorResults = (dif = 1, bandUpper = 110, bandLower = 90) => new Map<string, IndicatorResult>([
      ["macd-a", {
        outputs: [
          { id: indicatorOutputId("macd-a", "MACD-DIF"), label: "DIF", type: "line", panelId: "macd", values: points(dif) },
          { id: indicatorOutputId("macd-a", "MACD-DEA"), label: "DEA", type: "line", panelId: "macd", values: points(2) },
          { id: indicatorOutputId("macd-a", "MACD-HISTOGRAM"), label: "MACD", type: "histogram", panelId: "macd", values: points(3) }
        ]
      }],
      ["boll-a", {
        outputs: [{
          id: indicatorOutputId("boll-a", "BOLL-BAND"),
          label: "BOLL",
          type: "band",
          upper: points(bandUpper),
          lower: points(bandLower)
        }]
      }],
      ["sar-a", {
        outputs: [{
          id: indicatorOutputId("sar-a", "SAR"),
          label: "SAR",
          type: "marker",
          marks: source.series.candles.map((candle, index) => ({
            id: `sar-${index}`,
            time: candle.time,
            price: 80 + index
          }))
        }]
      }],
      ["hidden-a", {
        outputs: [{
          id: indicatorOutputId("hidden-a", "MA"),
          label: "MA",
          type: "line",
          values: points(999)
        }]
      }]
    ]);
    let deferNextCalculation = false;
    let resolveDeferredCalculation: ((results: Map<string, IndicatorResult>) => void) | undefined;
    const calculateIndicators = vi.fn(() => {
      if (!deferNextCalculation) return Promise.resolve(indicatorResults());
      deferNextCalculation = false;
      return new Promise<Map<string, IndicatorResult>>((resolve) => {
        resolveDeferredCalculation = resolve;
      });
    });
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: {
        calculateIndicators,
        async calculateSeries(input) {
          return { type: input.type, source: source.series, sourceIndexOffset: 0, points: [] };
        }
      },
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => { frames.delete(id); },
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
      onViewportChanged: (viewport) => { currentViewport = viewport; },
      onCalculationStatusChanged: (status) => calculationStates.push(status),
      hasCrosshairListeners: () => listening,
      onCrosshairChanged: (snapshot) => events.push(snapshot),
      onRenderError: (error) => renderErrors.push(error)
    });
    runtime.setMaterializedSeries(source);
    runtime.setIndicators([
      { instanceId: "macd-a", id: "MACD", params: { fast: 12, slow: 26, signal: 9 }, visible: true },
      { instanceId: "boll-a", id: "BOLL", params: { period: 20, deviation: 2 }, visible: true },
      { instanceId: "sar-a", id: "SAR", params: { step: 0.02, max: 0.2 }, visible: true },
      { instanceId: "hidden-a", id: "MA", params: { period: 5 }, visible: false }
    ]);
    await vi.waitFor(() => expect(calculateIndicators).toHaveBeenCalled());
    await vi.waitFor(() => expect(calculationStates.at(-1)).toEqual({ type: "idle" }));
    flushFrames();

    const layout = createChartLayout(800, 500);
    const targetIndex = Math.floor(
      (currentViewport!.visibleRange.from + currentViewport!.visibleRange.to) / 2
    );
    const x = indexToX(targetIndex, currentViewport!, layout.plotArea.x);
    events.length = 0;
    for (let index = 0; index < 100; index += 1) {
      overlayCanvas.dispatch("pointermove", {
        clientX: x,
        clientY: 150 + index / 10,
        pointerType: "mouse"
      });
    }
    expect(events).toEqual([]);
    flushFrames();
    expect(renderErrors).toEqual([]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      offsetX: x,
      offsetY: 159.9,
      candle: source.series.candles[targetIndex]
    });

    const firstPrice = events[0]!.crosshair.price;
    overlayCanvas.dispatch("pointermove", { clientX: x, clientY: 220, pointerType: "mouse" });
    flushFrames();
    expect(events.at(-1)?.crosshair.time).toBe(events[0]!.crosshair.time);
    expect(events.at(-1)?.crosshair.price).not.toBe(firstPrice);
    expect(events.at(-1)?.studies.map((study) => study.indicator.id)).toEqual([
      "MACD",
      "BOLL",
      "SAR"
    ]);
    expect(events.at(-1)?.studies[0]?.outputs).toEqual([
      { id: "MACD-DIF", title: "DIF", type: "line", value: 1 },
      { id: "MACD-DEA", title: "DEA", type: "line", value: 2 },
      { id: "MACD-HISTOGRAM", title: "MACD", type: "histogram", value: 3 }
    ]);
    expect(events.at(-1)?.studies[1]?.outputs).toEqual([
      { id: "BOLL-BAND", title: "BOLL", type: "band", upper: 110, lower: 90 }
    ]);
    expect(events.at(-1)?.studies[2]?.outputs).toEqual([
      { id: "SAR", title: "SAR", type: "marker", value: 80 + targetIndex }
    ]);

    deferNextCalculation = true;
    runtime.setIndicators([
      { instanceId: "macd-a", id: "MACD", params: { fast: 5, slow: 26, signal: 9 }, visible: true },
      { instanceId: "boll-a", id: "BOLL", params: { period: 20, deviation: 10 }, visible: true },
      { instanceId: "sar-a", id: "SAR", params: { step: 0.02, max: 0.2 }, visible: true }
    ]);
    flushFrames();
    expect(events.at(-1)?.studies.every((study) => study.outputs.length === 0)).toBe(true);
    const recalculated = indicatorResults(9, 220, 1);
    resolveDeferredCalculation!(recalculated);
    await vi.waitFor(() => expect(calculationStates.at(-1)).toEqual({ type: "idle" }));
    flushFrames();
    expect(events.at(-1)?.studies[0]?.outputs[0]).toEqual({
      id: "MACD-DIF",
      title: "DIF",
      type: "line",
      value: 9
    });
    const expectedScale = createMainPanelPriceScale(
      source.series,
      currentViewport!.visibleRange,
      "linear",
      [
        ...recalculated.get("macd-a")!.outputs,
        ...recalculated.get("boll-a")!.outputs,
        ...recalculated.get("sar-a")!.outputs
      ],
      []
    );
    expect(events.at(-1)?.crosshair.price).toBeCloseTo(
      priceAtY(220, expectedScale, layout.plotArea.y, layout.plotArea.height)
    );

    const leavesBeforeScaleChange = events.filter((event) => event === undefined).length;
    runtime.setPriceScaleMode("percentage");
    flushFrames();
    expect(events.filter((event) => event === undefined)).toHaveLength(leavesBeforeScaleChange + 1);

    const movesBeforeDrawing = events.filter((event) => event !== undefined).length;
    runtime.setDrawingTool("trendLine");
    overlayCanvas.dispatch("pointermove", { clientX: x, clientY: 210, pointerType: "mouse" });
    flushFrames();
    expect(events.filter((event) => event !== undefined)).toHaveLength(movesBeforeDrawing + 1);
    expect(events.at(-1)?.offsetY).toBe(210);
    runtime.setDrawingTool("select");

    const leavesBeforePointerLeave = events.filter((event) => event === undefined).length;
    overlayCanvas.dispatch("pointerleave", {});
    overlayCanvas.dispatch("pointerleave", {});
    flushFrames();
    expect(events.filter((event) => event === undefined)).toHaveLength(leavesBeforePointerLeave + 1);

    expect(runtime.setVisibleRange({
      from: source.series.candles[0]!.time,
      to: source.series.candles[19]!.time
    })).toBe(true);
    flushFrames();
    const firstX = indexToX(0, currentViewport!, layout.plotArea.x);
    overlayCanvas.dispatch("pointermove", { clientX: firstX, clientY: 180, pointerType: "mouse" });
    flushFrames();
    expect(events.at(-1)).toMatchObject({
      symbolId: source.selection.symbol.id,
      timeframe: source.selection.timeframe,
      adjustMode: source.selection.adjustMode,
      dataVersion: source.series.dataVersion,
      referencePrice: null,
      change: null,
      changePercent: null,
      candle: source.series.candles[0]
    });

    const eventsBeforeFastResume = events.length;
    runtime.clearCrosshair();
    runtime.setMaterializedSeries(source);
    overlayCanvas.dispatch("pointermove", { clientX: firstX, clientY: 190, pointerType: "mouse" });
    expect(events).toHaveLength(eventsBeforeFastResume);
    flushFrames();
    expect(events.slice(eventsBeforeFastResume)).toEqual([
      undefined,
      expect.objectContaining({
        symbolId: source.selection.symbol.id,
        timeframe: source.selection.timeframe
      })
    ]);

    const leavesBeforeSuspension = events.filter((event) => event === undefined).length;
    runtime.clearCrosshair();
    expect(events.filter((event) => event === undefined)).toHaveLength(leavesBeforeSuspension);
    flushFrames();
    expect(events.filter((event) => event === undefined)).toHaveLength(leavesBeforeSuspension + 1);
    const suspendedEventCount = events.length;
    overlayCanvas.dispatch("pointermove", { clientX: firstX, clientY: 190, pointerType: "mouse" });
    overlayCanvas.dispatch("pointerleave", {});
    flushFrames();
    expect(events).toHaveLength(suspendedEventCount);
    runtime.setMaterializedSeries(source);
    flushFrames();
    overlayCanvas.dispatch("pointermove", { clientX: x, clientY: 190, pointerType: "mouse" });
    flushFrames();
    const movesAfterResume = events.filter((event) => event !== undefined).length;

    listening = false;
    overlayCanvas.dispatch("pointermove", { clientX: x, clientY: 180, pointerType: "mouse" });
    flushFrames();
    expect(events.filter((event) => event !== undefined)).toHaveLength(movesAfterResume);

    listening = true;
    overlayCanvas.dispatch("pointermove", { clientX: x, clientY: 190, pointerType: "mouse" });
    runtime.destroy();
    flushFrames();
    expect(events.filter((event) => event !== undefined)).toHaveLength(movesAfterResume);
  });

  it("renders a fixed one-day intraday percentage axis and fits the complete day on first paint", () => {
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
      ...materialized(1, 241),
      intradayDays: 1,
      intradayScale: { previousClose: 100, priceLimitPercent: 10 }
    };
    source.series.candles = source.series.candles.map((entry) => ({
      ...entry,
      open: 100,
      high: 105,
      low: 95,
      close: 100,
      turnover: 100_000
    }));

    runtime.setMaterializedSeries(source);
    frame?.();

    expect(viewports.at(-1)?.visibleRange).toEqual({ from: 0, to: 240 });
    expect(viewports.at(-1)?.candleWidth).toBeGreaterThanOrEqual(0.05);
    expect(viewports.at(-1)?.candleWidth).toBeLessThan(2);
    expect(runtime.getVisibleRange()).toEqual({ from: 1, to: 241 });
    expect(renderErrors).toEqual([]);
    expect(staticCanvas.texts).toEqual(expect.arrayContaining(["+10.00%", "0.00%", "-10.00%"]));
    runtime.destroy();
  });

  it("auto-scales multi-day intraday symmetrically around the close before the first day", () => {
    const staticCanvas = new FakeCanvas();
    let frame: (() => void) | undefined;
    const firstDay = Date.UTC(2026, 6, 15, 1, 30);
    const secondDay = Date.UTC(2026, 6, 16, 1, 30);
    const source = materialized(1, 4);
    source.series.candles = [
      { time: firstDay, open: 100, high: 108, low: 94, close: 102, volume: 100, turnover: 10_200 },
      { time: firstDay + 330 * 60_000, open: 102, high: 106, low: 98, close: 104, volume: 100, turnover: 10_400 },
      { time: secondDay, open: 105, high: 110, low: 96, close: 108, volume: 100, turnover: 10_800 },
      { time: secondDay + 330 * 60_000, open: 108, high: 114, low: 100, close: 112, volume: 100, turnover: 11_200 }
    ];
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: (callback) => { frame = callback; return 1; },
      cancelFrame: () => undefined,
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration
    });

    runtime.setMaterializedSeries({
      ...source,
      intradayDays: 2,
      intradayScale: { previousClose: 100 }
    });
    frame?.();

    expect(staticCanvas.texts).toEqual(expect.arrayContaining([
      "+15.00%",
      "0.00%",
      "-15.00%",
      "115.00",
      "85.00"
    ]));
    expect(staticCanvas.strokeStyles).toContain("#d6a700");
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

  it("clamps an oversized public visible range to the ordinary K-line zoom capacity", () => {
    const viewports: ViewportState[] = [];
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onViewportChanged: (viewport) => viewports.push(structuredClone(viewport))
    });
    runtime.setMaterializedSeries(materialized(1, 1_000));

    expect(runtime.setVisibleRange({ from: 1, to: 1_000 })).toBe(true);

    const viewport = viewports.at(-1)!;
    const plotWidth = createChartLayout(800, 500).plotArea.width;
    expect(viewport.candleWidth).toBeGreaterThanOrEqual(2);
    expect(viewport.visibleRange.to).toBe(999);
    expect(viewport.visibleRange.to - viewport.visibleRange.from + 1).toBe(
      Math.floor(plotWidth / 2)
    );
    expect(runtime.getVisibleRange()).toEqual({
      from: 1_000 - Math.floor(plotWidth / 2) + 1,
      to: 1_000
    });
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
