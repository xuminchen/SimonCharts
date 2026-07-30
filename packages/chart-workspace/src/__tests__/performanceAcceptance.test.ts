import { describe, expect, it, vi } from "vitest";
import {
  createChartLayout,
  createMainPanelPriceScale,
  createPanelLayout,
  createPriceScaleFromBounds,
  indexToX,
  priceAtY,
  priceToY,
  type IndicatorResult,
  type SeriesRenderModel,
  type StatefulSeriesTransformType,
  type ViewportState
} from "@simoncharts/chart-engine";
import type { MaterializedSeries } from "../data/materializedSeries";
import type { CheckpointedCalculationRuntime } from "../runtime/checkpointedCalculationRuntime";
import { createChartEngineRuntime } from "../runtime/chartEngineRuntime";
import {
  indicatorOutputId,
  indicatorPanelId
} from "../runtime/indicatorRuntime";
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
  it("applies series visual overrides only to the active timeframe series layer", async () => {
    const staticCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => frames.delete(id),
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration
    });
    const flushFrames = () => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
    };
    runtime.setMaterializedSeries(materialized());
    runtime.setSeriesType("candles");
    runtime.setSeriesVisualOverrides({
      type: "candles",
      upColor: "#ff00aa",
      downColor: "#00ffaa",
      lineWidth: 3
    });
    flushFrames();
    expect(staticCanvas.strokeStyles).toContain("#ff00aa");

    staticCanvas.strokeStyles.splice(0);
    runtime.setSeriesType("line");
    runtime.setSeriesVisualOverrides({ type: "line", color: "#1234ff", lineWidth: 4 });
    flushFrames();
    expect(staticCanvas.strokeStyles).toContain("#1234ff");

    runtime.setSeriesType("renko");
    expect(() => runtime.setSeriesVisualOverrides({
      type: "renko",
      upColor: "#ff5500",
      downColor: "#00aa55"
    })).not.toThrow();
    await Promise.resolve();

    staticCanvas.strokeStyles.splice(0);
    runtime.setMaterializedSeries({
      ...materialized(),
      intradayDays: 1,
      intradayScale: { previousClose: 100, priceLimitPercent: 10 }
    });
    flushFrames();
    expect(staticCanvas.strokeStyles).not.toContain("#1234ff");
    runtime.destroy();
  });

  it("renders comparison data on the native percentage scale and publishes exact crosshair values", () => {
    const staticCanvas = new FakeCanvas();
    const overlayCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    let currentViewport: ViewportState | undefined;
    const snapshots: Array<import("../runtime/chartEngineRuntime").DataWindowSnapshot | undefined> = [];
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500, lang: "zh-CN" } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame(id) { frames.delete(id); },
      devicePixelRatio: 1,
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
      onViewportChanged(viewport) { currentViewport = viewport; },
      onDataWindowChanged(snapshot) { snapshots.push(snapshot); }
    });
    const source = materialized(1, 100);
    const comparisonCandles = source.series.candles.map((item, index) => ({
      ...item,
      open: 10 + index,
      high: 10 + index,
      low: 10 + index,
      close: 10 + index
    }));
    runtime.setMaterializedSeries(source);
    runtime.setPriceScaleMode("percentage");
    runtime.setComparisonData([{
      comparison: {
        symbol: {
          id: "SZSE:000001",
          code: "000001",
          name: "平安银行",
          exchange: "SZSE",
          kind: "stock",
          pricePrecision: 2
        },
        color: "#7c83ff",
        visible: true
      },
      status: "ready",
      candles: comparisonCandles,
      adjustMode: "forward",
      dataVersion: "compare-v1"
    }]);
    while (frames.size > 0) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    }

    expect(staticCanvas.strokeStyles).toContain("#7c83ff");
    const layout = createChartLayout(800, 500);
    const x = indexToX(50, currentViewport!, layout.plotArea.x);
    overlayCanvas.dispatch("pointermove", { clientX: x, clientY: 200, pointerType: "mouse" });
    while (frames.size > 0) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    }

    const comparisonBase = comparisonCandles[currentViewport!.visibleRange.from]!.close;
    expect(snapshots.at(-1)?.comparisonRows).toEqual([{
      symbolId: "SZSE:000001",
      code: "000001",
      name: "平安银行",
      pricePrecision: 2,
      label: "平安银行 000001",
      color: "#7c83ff",
      value: 60,
      changePercent: (60 / comparisonBase - 1) * 100,
      dataVersion: "compare-v1"
    }]);
    runtime.destroy();
  });

  it.each(["indicator", "series"] as const)(
    "publishes idle only after concurrent indicator and series calculations settle (%s first)",
    async (first) => {
      const source = materialized();
      let resolveIndicators!: (value: Map<string, IndicatorResult>) => void;
      let resolveSeries!: (value: SeriesRenderModel) => void;
      const calculateIndicators = vi.fn(() => new Promise<Map<string, IndicatorResult>>(
        (resolve) => { resolveIndicators = resolve; }
      ));
      const calculateSeries = vi.fn(() => new Promise<SeriesRenderModel>(
        (resolve) => { resolveSeries = resolve; }
      ));
      const states: Array<{ type: string }> = [];
      const runtime = createChartEngineRuntime({
        staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
        overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
        themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
        observer: { observe() {}, disconnect() {} },
        calculationRuntime: { calculateIndicators, calculateSeries },
        requestFrame: () => 1,
        cancelFrame: () => undefined,
        getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
        onCalculationStatusChanged: (status) => states.push(status)
      });
      runtime.setMaterializedSeries(source);
      runtime.setIndicators([{
        instanceId: "ma",
        id: "MA",
        params: { period: 5 },
        visible: true
      }]);
      runtime.setSeriesType("heikinAshi");
      await vi.waitFor(() => {
        expect(calculateIndicators).toHaveBeenCalledOnce();
        expect(calculateSeries).toHaveBeenCalledOnce();
      });

      if (first === "indicator") resolveIndicators(new Map());
      else resolveSeries({
        type: "heikinAshi",
        source: source.series,
        sourceIndexOffset: 0,
        points: []
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(states.at(-1)?.type).toBe("calculating");

      if (first === "indicator") {
        resolveSeries({
          type: "heikinAshi",
          source: source.series,
          sourceIndexOffset: 0,
          points: []
        });
      } else {
        resolveIndicators(new Map());
      }
      await vi.waitFor(() => expect(states.at(-1)?.type).toBe("idle"));
      runtime.destroy();
    }
  );

  it("clones, toggles, hovers, and closes execution marker tooltips", () => {
    const staticCanvas = new FakeCanvas();
    const overlayCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    let currentViewport: ViewportState | undefined;
    const onRenderError = vi.fn();
    const onExecutionTooltipChanged = vi.fn();
    const onExecutionClicked = vi.fn();
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
      onExecutionClicked,
      onViewportChanged(viewport) { currentViewport = viewport; }
    });
    const source = materialized(1, 100);
    const rows = [{
      id: "execution",
      time: 51,
      firstTime: 49,
      lastTime: 1_051,
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
    rows[0]!.firstTime = 50;
    rows[0]!.lastTime = 52;
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
    const hoverTooltip = onExecutionTooltipChanged.mock.lastCall?.[0];
    expect(hoverTooltip).toEqual(expect.objectContaining({
      pinned: false,
      title: "T买",
      rows: expect.arrayContaining([{ label: "金额", value: "45,000" }])
    }));
    const hoverTime = hoverTooltip?.rows.find((row) => row.label === "时间")?.value;
    expect(hoverTime).toContain("08:00:01");
    expect(overlayCanvas.texts.some((text) => text.includes("金额:"))).toBe(false);
    expect(onExecutionClicked).not.toHaveBeenCalled();

    overlayCanvas.dispatch("pointerleave", {});
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(undefined);

    overlayCanvas.dispatch("pointerdown", { pointerId: 1, clientX: x, clientY: y });
    flushFrames();
    const pinnedTooltip = onExecutionTooltipChanged.mock.lastCall?.[0];
    expect(pinnedTooltip).toEqual({ ...hoverTooltip, pinned: true });
    expect(onExecutionClicked).not.toHaveBeenCalled();
    overlayCanvas.dispatch("pointerup", { pointerId: 1, clientX: x, clientY: y });
    expect(onExecutionClicked).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "execution", label: "T买" })
    ]);
    overlayCanvas.dispatch("pointerdown", { pointerId: 2, clientX: 700, clientY: 100 });
    overlayCanvas.dispatch("pointerup", { pointerId: 2, clientX: 700, clientY: 100 });
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(undefined);

    rows[0]!.label = "T买";
    rows[0]!.firstTime = 49;
    rows[0]!.lastTime = 1_051;
    runtime.setExecutions(rows);
    flushFrames();
    overlayCanvas.dispatch("pointerdown", { pointerId: 3, clientX: x, clientY: y, pointerType: "touch" });
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith({ ...hoverTooltip, pinned: true });
    overlayCanvas.dispatch("pointerup", { pointerId: 3, clientX: x, clientY: y, pointerType: "touch" });
    expect(onExecutionClicked).toHaveBeenCalledTimes(2);
    runtime.setExecutions(rows);
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(undefined);

    overlayCanvas.dispatch("pointerdown", { pointerId: 4, clientX: x, clientY: y, pointerType: "touch" });
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(expect.objectContaining({ pinned: true }));
    runtime.setExecutions([]);
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(undefined);
    overlayCanvas.dispatch("pointerup", {
      pointerId: 4,
      clientX: x,
      clientY: y,
      pointerType: "touch"
    });
    expect(onExecutionClicked).toHaveBeenCalledTimes(2);

    runtime.setExecutions(rows);
    flushFrames();
    overlayCanvas.dispatch("pointerdown", {
      pointerId: 40,
      clientX: x,
      clientY: y,
      pointerType: "mouse",
      button: 2
    });
    overlayCanvas.dispatch("pointerup", {
      pointerId: 40,
      clientX: x,
      clientY: y,
      pointerType: "mouse",
      button: 2
    });
    expect(onExecutionClicked).toHaveBeenCalledTimes(2);
    overlayCanvas.dispatch("pointerdown", { pointerId: 5, clientX: x, clientY: y });
    flushFrames();
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(expect.objectContaining({ pinned: true }));
    overlayCanvas.dispatch("pointermove", { pointerId: 5, clientX: x + 20, clientY: y });
    overlayCanvas.dispatch("pointerup", { pointerId: 5, clientX: x + 20, clientY: y });
    expect(onExecutionClicked).toHaveBeenCalledTimes(2);

    overlayCanvas.dispatch("pointerdown", { pointerId: 6, clientX: x, clientY: y });
    overlayCanvas.dispatch("pointercancel", { pointerId: 6, clientX: x, clientY: y });
    expect(onExecutionClicked).toHaveBeenCalledTimes(2);

    staticCanvas.texts.splice(0);
    runtime.setExecutionsVisible(false);
    flushFrames();
    expect(staticCanvas.texts).not.toContain("T买");
    expect(onExecutionTooltipChanged).toHaveBeenLastCalledWith(undefined);
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

  it("uses the latest public series properties for calculation and rematerialization", async () => {
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
    runtime.setSeriesType("renko", { type: "renko", brickSize: 4 });
    await vi.waitFor(() => expect(calculateSeries).toHaveBeenCalledWith(expect.objectContaining({
      type: "renko",
      options: { brickSize: 4 }
    })));
    await new Promise((resolve) => setTimeout(resolve, 0));

    calculateSeries.mockClear();
    runtime.setMaterializedSeries(materialized(100, 220));
    await vi.waitFor(() => expect(calculateSeries).toHaveBeenCalledWith(expect.objectContaining({
      type: "renko",
      options: { brickSize: 4 }
    })));
    runtime.destroy();
  });

  it("aborts stale same-type property calculations and commits only the latest generation", async () => {
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    const pending: Array<{
      input: Parameters<CheckpointedCalculationRuntime["calculateSeries"]>[0];
      resolve: (model: SeriesRenderModel) => void;
    }> = [];
    const statuses: Array<{ type: string; kind?: string; generation?: number }> = [];
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: {
        async calculateIndicators() { return new Map(); },
        calculateSeries(input) {
          return new Promise<SeriesRenderModel>((resolve) => pending.push({ input, resolve }));
        }
      },
      requestFrame(callback) {
        const id = nextFrame++;
        frames.set(id, callback);
        return id;
      },
      cancelFrame: (id) => { frames.delete(id); },
      onCalculationStatusChanged: (status) => statuses.push(status)
    });
    const source = materialized();
    const model = (): SeriesRenderModel => ({
      type: "renko",
      source: source.series,
      sourceIndexOffset: 0,
      points: []
    });

    runtime.setMaterializedSeries(source);
    while (frames.size > 0) {
      const current = [...frames.values()];
      frames.clear();
      for (const callback of current) callback();
    }
    runtime.setSeriesType("renko", { type: "renko", brickSize: 2 });
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    runtime.setSeriesType("renko", { type: "renko", brickSize: 4 });
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    runtime.setSeriesType("renko", { type: "renko", brickSize: 6 });
    await vi.waitFor(() => expect(pending).toHaveLength(3));

    expect(pending.map(({ input }) => input.options)).toEqual([
      { brickSize: 2 },
      { brickSize: 4 },
      { brickSize: 6 }
    ]);
    expect(pending[0]!.input.signal.aborted).toBe(true);
    expect(pending[1]!.input.signal.aborted).toBe(true);
    expect(pending[2]!.input.signal.aborted).toBe(false);

    pending[0]!.resolve(model());
    pending[1]!.resolve(model());
    await Promise.resolve();
    expect(frames.size).toBe(0);
    expect(statuses.some((status) => status.type === "idle")).toBe(false);

    pending[2]!.resolve(model());
    await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
    expect(new Set(statuses
      .filter((status) => status.kind === "series")
      .map((status) => status.generation))).toEqual(
        new Set([1, 2, 3])
      );
    expect(statuses.at(-1)?.type).toBe("idle");
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

    runtime.setIndicators([
      {
        instanceId: "macd-a",
        id: "MACD",
        params: { fast: 12, slow: 26, signal: 9 },
        visible: true,
        visualOverrides: [{
          outputId: "MACD-DEA",
          type: "line",
          visible: false
        }]
      },
      { instanceId: "boll-a", id: "BOLL", params: { period: 20, deviation: 2 }, visible: true },
      { instanceId: "sar-a", id: "SAR", params: { step: 0.02, max: 0.2 }, visible: true },
      { instanceId: "hidden-a", id: "MA", params: { period: 5 }, visible: false }
    ]);
    flushFrames();
    expect(calculateIndicators).toHaveBeenCalledTimes(1);
    expect(events.at(-1)?.studies[0]?.outputs.map((output) => output.id)).toEqual([
      "MACD-DIF",
      "MACD-HISTOGRAM"
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
    const paneAreas = createPanelLayout({
      width: layout.plotArea.width + layout.rightAxisWidth,
      height: layout.timeAxisArea.y - layout.plotArea.y,
      rightAxisWidth: layout.rightAxisWidth,
      bottomAxisHeight: 0,
      panels: runtime.getPaneLayouts().map((pane) => ({
        id: pane.id,
        kind: pane.id === "main" ? "main" as const : "sub" as const,
        label: pane.id,
        heightRatio: pane.heightRatio
      }))
    });
    const mainGroupHeight = paneAreas[0]!.plotArea.height;
    const contentHeight = layout.timeAxisArea.y - layout.plotArea.y;
    const volumeHeight = Math.floor(
      mainGroupHeight * layout.volumeArea.height / contentHeight
    );
    const volumeGap = layout.volumeArea.y - layout.plotArea.y - layout.plotArea.height;
    const mainPlotHeight = mainGroupHeight - volumeGap - volumeHeight;
    expect(events.at(-1)?.crosshair.price).toBeCloseTo(
      priceAtY(220, expectedScale, layout.plotArea.y, mainPlotHeight)
    );

    const movesBeforeDrawingScale = events.filter((event) => event !== undefined).length;
    const drawingPrices = [500, 550];
    runtime.setDrawings([{
      id: "autoscale-crosshair",
      type: "datePriceRange",
      anchors: [
        { time: source.series.candles[targetIndex - 5]!.time, price: drawingPrices[0] },
        { time: source.series.candles[targetIndex + 5]!.time, price: drawingPrices[1] }
      ],
      affectsPriceScale: true
    }]);
    flushFrames();
    const drawingScale = createMainPanelPriceScale(
      source.series,
      currentViewport!.visibleRange,
      "linear",
      [
        ...recalculated.get("macd-a")!.outputs,
        ...recalculated.get("boll-a")!.outputs,
        ...recalculated.get("sar-a")!.outputs
      ],
      [],
      drawingPrices
    );
    expect(events.filter((event) => event !== undefined))
      .toHaveLength(movesBeforeDrawingScale + 1);
    expect(events.at(-1)?.offsetY).toBe(220);
    expect(events.at(-1)?.crosshair.price).toBeCloseTo(
      priceAtY(220, drawingScale, layout.plotArea.y, mainPlotHeight)
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

    staticCanvas.texts.splice(0);
    runtime.setComparisonData([{
      comparison: {
        symbol: {
          id: "SZSE:300001",
          code: "300001",
          name: "特锐德",
          exchange: "SZSE",
          kind: "stock"
        },
        visible: true
      },
      status: "ready",
      candles: source.series.candles.map((entry) => ({
        ...entry,
        open: 12.5,
        high: 12.5,
        low: 12.5,
        close: 12.5
      })),
      previousClose: 10,
      dataVersion: "compare-v1"
    }]);
    frame?.();
    expect(Math.max(
      ...staticCanvas.texts
        .filter((value) => value.endsWith("%"))
        .map((value) => Number.parseFloat(value))
    )).toBeGreaterThan(25);

    staticCanvas.texts.splice(0);
    runtime.setDrawings([{
      id: "intraday-plan",
      type: "datePriceRange",
      anchors: [{ time: 40, price: 120 }, { time: 60, price: 130 }],
      affectsPriceScale: true
    }]);
    frame?.();
    expect(Math.max(
      ...staticCanvas.texts.map(Number).filter((value) => Number.isFinite(value))
    )).toBeGreaterThanOrEqual(130);
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

  it("rejects a multi-day drawing range that overflows the previous-close percentage scale", () => {
    const staticCanvas = new FakeCanvas();
    let frame: (() => void) | undefined;
    const source = materialized(1, 2);
    source.series.candles = [
      { time: 1, open: 1e-207, high: 2e-207, low: 1e-207, close: 1e-207, volume: 1, turnover: 1e-207 },
      { time: 2, open: 1e-207, high: 2e-207, low: 1e-207, close: 1e-207, volume: 1, turnover: 1e-207 }
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
      intradayScale: { previousClose: 1e-307 }
    });
    runtime.setDrawings([{
      id: "overflowing-plan",
      type: "datePriceRange",
      anchors: [{ time: 1, price: 0.08561 }, { time: 2, price: 0.08561 }],
      affectsPriceScale: true
    }]);
    frame?.();

    expect(staticCanvas.texts.every((text) => !/Infinity|NaN/.test(text))).toBe(true);

    staticCanvas.texts.splice(0);
    const representable = materialized(1, 2);
    representable.series.candles = [
      { time: 1, open: 1e-307, high: 2e-307, low: 1e-307, close: 1e-307, volume: 1, turnover: 1e-307 },
      { time: 2, open: 1e-307, high: 2e-307, low: 1e-307, close: 1e-307, volume: 1, turnover: 1e-307 }
    ];
    runtime.setMaterializedSeries({
      ...representable,
      intradayDays: 2,
      intradayScale: { previousClose: 1 }
    });
    runtime.setDrawings([{
      id: "representable-plan",
      type: "datePriceRange",
      anchors: [{ time: 1, price: 10 }, { time: 2, price: 10 }],
      affectsPriceScale: true
    }]);
    frame?.();
    expect(Math.max(
      ...staticCanvas.texts.map(Number).filter((value) => Number.isFinite(value))
    )).toBeGreaterThanOrEqual(10);

    staticCanvas.texts.splice(0);
    const largePreviousClose = Number.MAX_VALUE * 0.44;
    const largeDrawingPrice = Number.MAX_VALUE * 0.91;
    runtime.setMaterializedSeries({
      ...representable,
      intradayDays: 2,
      intradayScale: { previousClose: largePreviousClose }
    });
    runtime.setDrawings([{
      id: "large-representable-plan",
      type: "datePriceRange",
      anchors: [{ time: 1, price: largeDrawingPrice }, { time: 2, price: largeDrawingPrice }],
      affectsPriceScale: true
    }]);
    frame?.();
    expect(Math.max(
      ...staticCanvas.texts.map(Number).filter((value) => Number.isFinite(value))
    )).toBeGreaterThanOrEqual(largeDrawingPrice);
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
    const onDrawingClicked = vi.fn();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onViewportChanged: (next) => viewports.push(structuredClone(next)),
      onDrawingsChanged: (drawings) => drawingUpdates.push(drawings),
      onDrawingClicked
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
    expect(onDrawingClicked).not.toHaveBeenCalled();

    const bodyX = indexToX(source.series.candles.findIndex((candle) => candle.time === 47), viewport, 0);
    overlayCanvas.dispatch("pointerdown", {
      pointerId: 20,
      clientX: bodyX,
      clientY: startY,
      pointerType: "mouse",
      button: 2
    });
    overlayCanvas.dispatch("pointerup", {
      pointerId: 20,
      clientX: bodyX,
      clientY: startY,
      pointerType: "mouse",
      button: 2
    });
    expect(onDrawingClicked).not.toHaveBeenCalled();

    overlayCanvas.dispatch("pointerdown", { pointerId: 2, clientX: bodyX, clientY: startY });
    overlayCanvas.dispatch("pointerup", { pointerId: 2, clientX: bodyX, clientY: startY });
    expect(onDrawingClicked).toHaveBeenCalledWith("line");

    overlayCanvas.dispatch("pointerdown", { pointerId: 21, clientX: bodyX, clientY: startY });
    runtime.setDrawings([{
      id: "line",
      type: "trendLine",
      anchors: [{ time: 42, price: 140 }, { time: 62, price: 140 }]
    }]);
    overlayCanvas.dispatch("pointerup", { pointerId: 21, clientX: bodyX, clientY: startY });
    expect(onDrawingClicked).toHaveBeenCalledTimes(1);

    const beforeSlop = structuredClone(drawingUpdates.at(-1));
    overlayCanvas.dispatch("pointerdown", { pointerId: 6, clientX: bodyX, clientY: startY });
    overlayCanvas.dispatch("pointermove", { pointerId: 6, clientX: bodyX, clientY: startY + 3 });
    overlayCanvas.dispatch("pointerup", { pointerId: 6, clientX: bodyX, clientY: startY + 3 });
    expect(drawingUpdates.at(-1)).toEqual(beforeSlop);
    expect(onDrawingClicked).toHaveBeenCalledTimes(2);

    const handleX = indexToX(source.series.candles.findIndex((candle) => candle.time === 42), viewport, 0);
    overlayCanvas.dispatch("pointerdown", { pointerId: 5, clientX: handleX, clientY: startY });
    overlayCanvas.dispatch("pointermove", { pointerId: 5, clientX: handleX + viewport.candleWidth, clientY: startY });
    overlayCanvas.dispatch("pointerup", { pointerId: 5, clientX: handleX + viewport.candleWidth, clientY: startY });
    expect(drawingUpdates.at(-1)?.[0]?.anchors[0]?.time).toBe(43);

    const beforeCancelledDrag = structuredClone(drawingUpdates.at(-1));
    overlayCanvas.dispatch("pointerdown", { pointerId: 22, clientX: bodyX, clientY: startY });
    runtime.clearTransientInteraction();
    overlayCanvas.dispatch("pointermove", {
      pointerId: 22,
      clientX: bodyX + viewport.candleWidth * 4,
      clientY: startY
    });
    overlayCanvas.dispatch("pointerup", {
      pointerId: 22,
      clientX: bodyX + viewport.candleWidth * 4,
      clientY: startY
    });
    expect(drawingUpdates.at(-1)).toEqual(beforeCancelledDrag);

    const beforePan = viewports.at(-1)!.scrollOffset;
    overlayCanvas.dispatch("pointerdown", { pointerId: 4, clientX: 700, clientY: 100 });
    overlayCanvas.dispatch("pointermove", { pointerId: 4, clientX: 700 + viewport.candleWidth * 2, clientY: 100 });
    overlayCanvas.dispatch("pointerup", { pointerId: 4, clientX: 700 + viewport.candleWidth * 2, clientY: 100 });
    expect(viewports.at(-1)?.scrollOffset).toBe(beforePan + 2);
    runtime.destroy();
  });

  it("hit-tests rendered studies without turning drags into study clicks", async () => {
    const overlayCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    let currentViewport: ViewportState | undefined;
    const onStudyClicked = vi.fn();
    const crosshairEvents: Array<Parameters<NonNullable<Parameters<typeof createChartEngineRuntime>[0]["onCrosshairChanged"]>>[0]> = [];
    const source = materialized(1, 100);
    const flushFrames = () => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
    };
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: {
        async calculateIndicators({ configs }) {
          return new Map(configs.map((config) => [config.instanceId, {
            outputs: config.instanceId === "separate"
              ? [
                  {
                    id: indicatorOutputId("separate", "low"),
                    label: "Low",
                    type: "line" as const,
                    panelId: indicatorPanelId("separate"),
                    values: source.series.candles.map((candle) => ({
                      time: candle.time,
                      value: 0
                    }))
                  },
                  {
                    id: indicatorOutputId("separate", "high"),
                    label: "High",
                    type: "line" as const,
                    panelId: indicatorPanelId("separate"),
                    values: source.series.candles.map((candle) => ({
                      time: candle.time,
                      value: 100
                    }))
                  }
                ]
              : [{
                  id: indicatorOutputId(config.instanceId, "MA"),
                  label: "MA",
                  type: "line" as const,
                  panelId: "main",
                  values: source.series.candles.map((candle) => ({
                    time: candle.time,
                    value: 150
                  }))
                }]
          }]));
        },
        async calculateSeries(input) {
          return { type: input.type, source: source.series, sourceIndexOffset: 0, points: [] };
        }
      },
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => { frames.delete(id); },
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
      onViewportChanged: (viewport) => { currentViewport = viewport; },
      hasCrosshairListeners: () => true,
      onCrosshairChanged: (snapshot) => crosshairEvents.push(snapshot),
      onStudyClicked
    });
    runtime.setMaterializedSeries(source);
    runtime.setIndicators([
      {
        instanceId: "bottom",
        id: "MA",
        params: { period: 5 },
        visible: true
      },
      {
        instanceId: "top",
        id: "MA",
        params: { period: 5 },
        visible: true
      },
      {
        instanceId: "separate",
        id: "RSI",
        params: { period: 14 },
        visible: true
      }
    ]);
    await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
    flushFrames();

    const layout = createChartLayout(800, 500);
    const scale = createMainPanelPriceScale(source.series, currentViewport!.visibleRange, "linear", [], []);
    const x = indexToX(50, currentViewport!, layout.plotArea.x);
    const contentHeight = layout.timeAxisArea.y - layout.plotArea.y;
    const contentPanels = createPanelLayout({
      width: layout.plotArea.width + layout.rightAxisWidth,
      height: contentHeight,
      rightAxisWidth: layout.rightAxisWidth,
      bottomAxisHeight: 0,
      panels: [
        { id: "main", kind: "main", label: "Main", heightRatio: 3 },
        {
          id: indicatorPanelId("separate"),
          kind: "sub",
          label: "Separate",
          heightRatio: 1
        }
      ]
    });
    const mainGroup = contentPanels[0]!;
    const volumeRatio = layout.volumeArea.height / contentHeight;
    const volumeHeight = Math.floor(mainGroup.plotArea.height * volumeRatio);
    const volumeGap = layout.volumeArea.y - layout.plotArea.y - layout.plotArea.height;
    const mainPlotHeight = mainGroup.plotArea.height - volumeGap - volumeHeight;
    const y = priceToY(150, scale, layout.plotArea.y, mainPlotHeight);
    overlayCanvas.dispatch("pointerdown", { pointerId: 7, clientX: x, clientY: y });
    overlayCanvas.dispatch("pointerup", { pointerId: 7, clientX: x, clientY: y });
    expect(onStudyClicked).toHaveBeenCalledWith("top");

    const separatePanel = contentPanels[1]!;
    const separateScale = createPriceScaleFromBounds({ min: 0, max: 100 }, 1, "linear");
    const separateY = priceToY(
      100,
      separateScale,
      separatePanel.plotArea.y + layout.plotArea.y,
      separatePanel.plotArea.height
    );
    overlayCanvas.dispatch("pointermove", {
      clientX: x,
      clientY: separateY,
      pointerType: "mouse"
    });
    flushFrames();
    expect(crosshairEvents.at(-1)).toMatchObject({
      offsetX: x,
      offsetY: separateY,
      candle: source.series.candles[50]
    });
    overlayCanvas.dispatch("pointerdown", {
      pointerId: 70,
      clientX: x,
      clientY: separateY
    });
    overlayCanvas.dispatch("pointerup", {
      pointerId: 70,
      clientX: x,
      clientY: separateY
    });
    expect(onStudyClicked).toHaveBeenLastCalledWith("separate");
    const beforeBoundaryMiss = onStudyClicked.mock.calls.length;
    overlayCanvas.dispatch("pointerdown", {
      pointerId: 71,
      clientX: x,
      clientY: separatePanel.plotArea.y + layout.plotArea.y - 3
    });
    overlayCanvas.dispatch("pointerup", {
      pointerId: 71,
      clientX: x,
      clientY: separatePanel.plotArea.y + layout.plotArea.y - 3
    });
    expect(onStudyClicked).toHaveBeenCalledTimes(beforeBoundaryMiss);

    const beforeSlop = structuredClone(currentViewport);
    overlayCanvas.dispatch("pointerdown", { pointerId: 9, clientX: x, clientY: y });
    overlayCanvas.dispatch("pointermove", { pointerId: 9, clientX: x + 3, clientY: y });
    overlayCanvas.dispatch("pointerup", { pointerId: 9, clientX: x + 3, clientY: y });
    expect(currentViewport).toEqual(beforeSlop);
    expect(onStudyClicked).toHaveBeenCalledTimes(beforeBoundaryMiss + 1);

    overlayCanvas.dispatch("pointerdown", { pointerId: 8, clientX: x, clientY: y });
    const beforeDrag = currentViewport!.scrollOffset;
    overlayCanvas.dispatch("pointermove", { pointerId: 8, clientX: x + 20, clientY: y });
    overlayCanvas.dispatch("pointerup", { pointerId: 8, clientX: x + 20, clientY: y });
    expect(currentViewport!.scrollOffset).not.toBe(beforeDrag);
    expect(onStudyClicked).toHaveBeenCalledTimes(beforeBoundaryMiss + 1);

    overlayCanvas.dispatch("pointerdown", { pointerId: 10, clientX: x, clientY: y });
    runtime.setIndicators([]);
    overlayCanvas.dispatch("pointerup", { pointerId: 10, clientX: x, clientY: y });
    expect(onStudyClicked).toHaveBeenCalledTimes(beforeBoundaryMiss + 1);
    runtime.destroy();
  });

  it("preserves a manual pane scale during same-selection history materialization", () => {
    const overlayCanvas = new FakeCanvas();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined
    });
    const source = materialized(100, 100);
    runtime.setMaterializedSeries(source);
    runtime.setPaneVisibleRange("main", { from: 50, to: 150 });

    runtime.setMaterializedSeries({
      ...source,
      series: {
        ...source.series,
        dataVersion: "v2",
        candles: materialized(50, 150).series.candles
      },
      sourceMinTime: 50
    }, 100);
    runtime.setPriceScaleMode("linear");

    expect(runtime.getPanes()[0]?.priceScale).toEqual({
      mode: "linear",
      autoScale: false,
      inverted: false,
      visibleRange: { from: 50, to: 150 }
    });

    const nextSelection = materialized(1_000, 100);
    nextSelection.selection = { ...nextSelection.selection, timeframe: "5m" };
    nextSelection.series = { ...nextSelection.series, timeframe: "5m" };
    runtime.setMaterializedSeries(nextSelection);
    expect(runtime.getPanes()[0]?.priceScale.autoScale).toBe(true);
    runtime.destroy();
  });

  it("does not switch a pane to manual scale until a price-axis drag crosses the slop", () => {
    const overlayCanvas = new FakeCanvas();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined
    });
    runtime.setMaterializedSeries(materialized());
    const axis = createChartLayout(800, 500).priceAxisArea;
    const x = axis.x + axis.width / 2;
    const y = axis.y + axis.height / 2;

    overlayCanvas.dispatch("pointerdown", { pointerId: 42, clientX: x, clientY: y });
    overlayCanvas.dispatch("pointerup", { pointerId: 42, clientX: x, clientY: y });

    expect(runtime.getPanes()[0]?.priceScale).toEqual({
      mode: "linear",
      autoScale: true,
      inverted: false
    });
    runtime.destroy();
  });

  it("discards a canceled price-axis scale preview", () => {
    const overlayCanvas = new FakeCanvas();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined
    });
    runtime.setMaterializedSeries(materialized());
    runtime.setPaneAutoScale("main", false);
    const baseline = runtime.getPanes()[0]?.priceScale.visibleRange;
    runtime.setPaneAutoScale("main", true);
    const axis = createChartLayout(800, 500).priceAxisArea;
    const x = axis.x + axis.width / 2;
    const y = axis.y + axis.height / 2;

    overlayCanvas.dispatch("pointerdown", { pointerId: 43, clientX: x, clientY: y });
    overlayCanvas.dispatch("pointermove", { pointerId: 43, clientX: x, clientY: y + 80 });
    overlayCanvas.dispatch("pointercancel", { pointerId: 43, clientX: x, clientY: y + 80 });
    runtime.setPaneAutoScale("main", false);

    expect(runtime.getPanes()[0]?.priceScale.visibleRange).toEqual(baseline);
    runtime.destroy();
  });

  it("does not let a stale price-axis pointerup override imported or replaced state", () => {
    const overlayCanvas = new FakeCanvas();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined
    });
    runtime.setMaterializedSeries(materialized());
    const axis = createChartLayout(800, 500).priceAxisArea;
    const x = axis.x + axis.width / 2;
    const y = axis.y + 10;
    const beginDrag = (pointerId: number) => {
      overlayCanvas.dispatch("pointerdown", { pointerId, clientX: x, clientY: y });
      overlayCanvas.dispatch("pointermove", { pointerId, clientX: x, clientY: y + 80 });
    };
    const finishDrag = (pointerId: number) => {
      overlayCanvas.dispatch("pointerup", { pointerId, clientX: x, clientY: y + 80 });
    };

    beginDrag(45);
    runtime.applyPaneLayouts([{
      id: "main",
      heightRatio: 3,
      collapsed: false,
      priceScale: { autoScale: true, inverted: false }
    }]);
    finishDrag(45);
    expect(runtime.getPanes()[0]?.priceScale.autoScale).toBe(true);

    beginDrag(46);
    const replacement = materialized();
    replacement.selection = {
      ...replacement.selection,
      symbol: { ...replacement.selection.symbol, id: "SSE:600001", code: "600001" }
    };
    replacement.series = { ...replacement.series, symbol: "SSE:600001" };
    runtime.setMaterializedSeries(replacement);
    finishDrag(46);
    expect(runtime.getPanes()[0]?.priceScale.autoScale).toBe(true);

    runtime.setPaneAutoScale("main", false);
    const committedRange = runtime.getPanes()[0]?.priceScale.visibleRange;
    runtime.setPaneAutoScale("main", true);
    beginDrag(48);
    runtime.setPaneAutoScale("main", false);
    finishDrag(48);
    expect(runtime.getPanes()[0]?.priceScale.visibleRange).toEqual(committedRange);
    runtime.destroy();
  });

  it("keeps a price-axis drag active across unchanged render frames", () => {
    const overlayCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    const flushFrames = () => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
    };
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => { frames.delete(id); }
    });
    runtime.setMaterializedSeries(materialized());
    flushFrames();
    const axis = createChartLayout(800, 500).priceAxisArea;
    const x = axis.x + axis.width / 2;
    const y = axis.y + axis.height / 2;

    overlayCanvas.dispatch("pointerdown", { pointerId: 47, clientX: x, clientY: y });
    overlayCanvas.dispatch("pointermove", { pointerId: 47, clientX: x, clientY: y + 40 });
    flushFrames();
    overlayCanvas.dispatch("pointermove", { pointerId: 47, clientX: x, clientY: y + 80 });
    flushFrames();
    overlayCanvas.dispatch("pointerup", { pointerId: 47, clientX: x, clientY: y + 80 });

    expect(runtime.getPanes()[0]?.priceScale.autoScale).toBe(false);
    runtime.destroy();
  });

  it("scales a large finite price range without overflowing its center", () => {
    const overlayCanvas = new FakeCanvas();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined
    });
    runtime.setMaterializedSeries(materialized());
    const original = { from: 1e308, to: 1.5e308 };
    runtime.setPaneVisibleRange("main", original);
    const axis = createChartLayout(800, 500).priceAxisArea;
    const x = axis.x + axis.width / 2;
    const y = axis.y + axis.height / 2;

    overlayCanvas.dispatch("pointerdown", { pointerId: 44, clientX: x, clientY: y });
    overlayCanvas.dispatch("pointermove", { pointerId: 44, clientX: x, clientY: y - 40 });
    overlayCanvas.dispatch("pointerup", { pointerId: 44, clientX: x, clientY: y - 40 });
    const range = runtime.getPanes()[0]?.priceScale.visibleRange;

    expect(range).not.toEqual(original);
    expect(Number.isFinite(range?.from)).toBe(true);
    expect(Number.isFinite(range?.to)).toBe(true);
    runtime.destroy();
  });

  it("rejects an overflowing percentage range without changing pane state", () => {
    const source = materialized();
    source.series = {
      ...source.series,
      candles: source.series.candles.map((candle) => ({
        ...candle,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1
      }))
    };
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined
    });
    runtime.setMaterializedSeries(source);
    runtime.setPriceScaleMode("percentage");
    const before = runtime.getPanes();

    expect(() => runtime.setPaneVisibleRange("main", {
      from: 0,
      to: Number.MAX_VALUE
    })).toThrow("price range");
    expect(runtime.getPanes()).toEqual(before);
    runtime.destroy();
  });

  it("removes a hidden study pane from the rendered layout", async () => {
    const staticCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    let resolveHidden!: (value: Map<string, IndicatorResult>) => void;
    const source = materialized();
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: {
        async calculateIndicators({ configs }) {
          if (configs[0]?.visible === false) {
            return new Promise<Map<string, IndicatorResult>>(
              (resolve) => { resolveHidden = resolve; }
            );
          }
          return new Map(configs.map((config) => [config.instanceId, {
            outputs: [{
              id: indicatorOutputId(config.instanceId, "RSI"),
              label: "RSI",
              type: "line" as const,
              panelId: indicatorPanelId(config.instanceId),
              values: source.series.candles.map((candle) => ({
                time: candle.time,
                value: 50
              }))
            }]
          }]));
        },
        async calculateSeries(input) {
          return { type: input.type, source: source.series, sourceIndexOffset: 0, points: [] };
        }
      },
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => { frames.delete(id); },
      paneIdFor: (config) => indicatorPanelId(config.instanceId),
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration
    });
    const flushFrames = () => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
    };
    runtime.setMaterializedSeries(source);
    runtime.setIndicators([{
      instanceId: "hidden-rsi",
      id: "RSI",
      params: { period: 14 },
      visible: true
    }]);
    await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
    staticCanvas.texts.splice(0);
    flushFrames();
    const visibleLabelCount = staticCanvas.texts.map(Number).filter(Number.isFinite).length;

    runtime.setIndicators([{
      instanceId: "hidden-rsi",
      id: "RSI",
      params: { period: 14 },
      visible: false
    }]);
    staticCanvas.texts.splice(0);
    flushFrames();

    expect(staticCanvas.texts.map(Number).filter(Number.isFinite).length)
      .toBeLessThan(visibleLabelCount);
    expect(staticCanvas.texts).not.toContain("0.50");
    resolveHidden(new Map());
    await Promise.resolve();
    runtime.destroy();
  });

  it("auto-scales study panes from the visible window instead of hidden history", async () => {
    const staticCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    const source = materialized(1, 100);
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: {
        async calculateIndicators({ configs }) {
          return new Map(configs.map((config) => [config.instanceId, {
            outputs: [{
              id: indicatorOutputId(config.instanceId, "RSI"),
              label: "RSI",
              type: "line" as const,
              panelId: indicatorPanelId(config.instanceId),
              values: source.series.candles.map((candle, index) => ({
                time: candle.time,
                value: index === 0 ? 1_000_000_000 : 50
              }))
            }]
          }]));
        },
        async calculateSeries(input) {
          return { type: input.type, source: source.series, sourceIndexOffset: 0, points: [] };
        }
      },
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => { frames.delete(id); },
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration
    });
    const flushFrames = () => {
      while (frames.size > 0) {
        const callbacks = [...frames.values()];
        frames.clear();
        for (const callback of callbacks) callback();
      }
    };
    runtime.setMaterializedSeries(source);
    expect(runtime.setVisibleRange({ from: 51, to: 100 })).toBe(true);
    runtime.setIndicators([{
      instanceId: "visible-rsi",
      id: "RSI",
      params: { period: 14 },
      visible: true
    }]);
    await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
    staticCanvas.texts.splice(0);
    flushFrames();

    const numericLabels = staticCanvas.texts
      .map(Number)
      .filter(Number.isFinite);
    expect(Math.max(...numericLabels)).toBeLessThan(1_000);
    expect(staticCanvas.texts).not.toContain("NaN");
    expect(staticCanvas.texts).not.toContain("Infinity");
    runtime.destroy();
  });

  it("removes hidden study outputs from pane autoscale without recalculating", async () => {
    const staticCanvas = new FakeCanvas();
    const snapshots: Array<import("../runtime/chartEngineRuntime").DataWindowSnapshot | undefined> = [];
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    const source = materialized(1, 100);
    const calculateIndicators = vi.fn(async ({ configs }) =>
      new Map(configs.map((config) => [config.instanceId, {
        outputs: [
          {
            id: indicatorOutputId(config.instanceId, "RSI"),
            label: "RSI",
            type: "line" as const,
            panelId: indicatorPanelId(config.instanceId),
            values: source.series.candles.map((candle) => ({
              time: candle.time,
              value: 50
            }))
          },
          {
            id: indicatorOutputId(config.instanceId, "RSI-EXTREME"),
            label: "Extreme",
            type: "line" as const,
            panelId: indicatorPanelId(config.instanceId),
            values: source.series.candles.map((candle) => ({
              time: candle.time,
              value: 1_000_000_000
            }))
          }
        ]
      }]))
    );
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: {
        calculateIndicators,
        async calculateSeries(input) {
          return { type: input.type, source: source.series, sourceIndexOffset: 0, points: [] };
        }
      },
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => frames.delete(id),
      paneIdFor: (config) => indicatorPanelId(config.instanceId),
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
      onDataWindowChanged: (snapshot) => snapshots.push(snapshot)
    });
    const flushFrames = () => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
    };
    runtime.setMaterializedSeries(source);
    runtime.setIndicators([{
      instanceId: "rsi-hidden-output",
      id: "RSI",
      params: { period: 14 },
      visible: true
    }]);
    await vi.waitFor(() => expect(calculateIndicators).toHaveBeenCalledTimes(1));
    flushFrames();

    staticCanvas.texts.splice(0);
    runtime.setIndicators([{
      instanceId: "rsi-hidden-output",
      id: "RSI",
      params: { period: 14 },
      visible: true,
      visualOverrides: [{
        outputId: "RSI-EXTREME",
        type: "line",
        visible: false
      }]
    }]);
    flushFrames();
    expect(calculateIndicators).toHaveBeenCalledTimes(1);
    const numericLabels = staticCanvas.texts.map(Number).filter(Number.isFinite);
    expect(Math.max(...numericLabels)).toBeLessThan(1_000);

    runtime.setIndicators([{
      instanceId: "rsi-hidden-output",
      id: "RSI",
      params: { period: 14 },
      visible: true,
      visualOverrides: [
        { outputId: "RSI", type: "line", visible: false },
        { outputId: "RSI-EXTREME", type: "line", visible: false }
      ]
    }]);
    flushFrames();
    expect(calculateIndicators).toHaveBeenCalledTimes(1);
    expect(snapshots.at(-1)?.indicatorRows).toEqual([]);
    runtime.destroy();
  });

  it("auto-scales only eligible drawing ranges", () => {
    const staticCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    const flushFrames = () => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
    };
    const runtime = createChartEngineRuntime({
      staticCanvas: staticCanvas as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => { frames.delete(id); },
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
      onRenderError(error) { throw error; }
    });
    runtime.setMaterializedSeries(materialized(1, 100));
    flushFrames();
    const numericAxisValues = () => staticCanvas.texts
      .map((text) => Number(text))
      .filter((value) => Number.isFinite(value));
    const renderWith = (drawing: import("@simoncharts/chart-engine").DrawingObject) => {
      staticCanvas.texts.splice(0);
      runtime.setDrawings([drawing]);
      flushFrames();
      return numericAxisValues();
    };
    const base = {
      id: "planned-range",
      type: "datePriceRange" as const,
      anchors: [{ time: 40, price: 500 }, { time: 60, price: 550 }]
    };

    expect(Math.max(...renderWith(base))).toBeLessThan(300);
    expect(Math.max(...renderWith({ ...base, affectsPriceScale: true }))).toBeGreaterThan(550);
    expect(Math.max(...renderWith({
      ...base,
      type: "priceRange",
      affectsPriceScale: true
    }))).toBeGreaterThan(550);
    expect(Math.max(...renderWith({
      ...base,
      affectsPriceScale: true,
      visible: false
    }))).toBeLessThan(300);
    expect(Math.max(...renderWith({
      ...base,
      affectsPriceScale: true,
      anchors: [{ time: 1_000, price: 500 }, { time: 1_100, price: 550 }]
    }))).toBeLessThan(300);
    expect(Math.min(...renderWith({
      ...base,
      affectsPriceScale: true,
      anchors: [{ time: 40, price: 1 }, { time: 60, price: 5 }]
    }))).toBeLessThan(1);
    expect(Math.max(...renderWith({
      ...base,
      affectsPriceScale: true,
      anchors: [{ time: 40, price: Number.NaN }, { time: 60, price: 550 }]
    }))).toBeLessThan(300);

    for (const timeframe of ["1m", "5m", "15m", "30m", "60m"] as const) {
      const source = materialized(1, 100);
      source.selection = { ...source.selection, timeframe };
      source.series = { ...source.series, timeframe };
      runtime.setMaterializedSeries(source);
      flushFrames();
      expect(Math.max(...renderWith({ ...base, affectsPriceScale: true })))
        .toBeGreaterThan(550);
    }
    runtime.setPriceScaleMode("log");
    flushFrames();
    expect(renderWith({
      ...base,
      affectsPriceScale: true,
      anchors: [{ time: 40, price: 0 }, { time: 60, price: -1 }]
    }).every((value) => Number.isFinite(value))).toBe(true);
    runtime.destroy();
  });

  it("pans through a non-interactive range without changing the drawing", () => {
    const overlayCanvas = new FakeCanvas();
    const source = materialized(1, 100);
    const viewports: ViewportState[] = [];
    const drawingUpdates = vi.fn();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onViewportChanged: (next) => viewports.push(structuredClone(next)),
      onDrawingsChanged: drawingUpdates
    });
    runtime.setMaterializedSeries(source);
    const viewport = viewports.at(-1)!;
    const scale = createMainPanelPriceScale(source.series, viewport.visibleRange, "linear", [], []);
    const plotArea = createChartLayout(800, 500).plotArea;
    const x = indexToX(50, viewport, plotArea.x);
    const y = priceToY(140, scale, plotArea.y, plotArea.height);
    runtime.setDrawings([{
      id: "passive-range",
      type: "datePriceRange",
      anchors: [{ time: 40, price: 130 }, { time: 60, price: 150 }],
      interactive: false,
      affectsPriceScale: true,
      locked: true
    }]);

    overlayCanvas.dispatch("pointermove", {
      pointerId: 7,
      clientX: x,
      clientY: y,
      pointerType: "mouse"
    });
    expect(overlayCanvas.style.cursor).toBe("crosshair");
    const beforePan = viewports.at(-1)!.scrollOffset;
    overlayCanvas.dispatch("pointerdown", { pointerId: 7, clientX: x, clientY: y });
    overlayCanvas.dispatch("pointermove", {
      pointerId: 7,
      clientX: x + viewport.candleWidth * 2,
      clientY: y
    });
    overlayCanvas.dispatch("pointerup", {
      pointerId: 7,
      clientX: x + viewport.candleWidth * 2,
      clientY: y
    });

    expect(viewports.at(-1)!.scrollOffset).not.toBe(beforePan);
    expect(drawingUpdates).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it("bridges drawing groups atomically and cancels an active drawing gesture", () => {
    const overlayCanvas = new FakeCanvas();
    const drawingUpdates = vi.fn();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: overlayCanvas as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onDrawingsChanged: drawingUpdates
    });
    runtime.setMaterializedSeries(materialized());
    runtime.setDrawings([
      { id: "a", type: "trendLine", anchors: [] },
      { id: "b", type: "trendLine", anchors: [] },
      { id: "c", type: "trendLine", anchors: [] }
    ]);
    runtime.setDrawingTool("trendLine");
    overlayCanvas.dispatch("pointerdown", {
      pointerId: 41,
      clientX: 200,
      clientY: 200
    });
    drawingUpdates.mockClear();

    expect(() => runtime.createDrawingGroup(["a", "missing"], "Invalid")).toThrow();
    expect(overlayCanvas.hasPointerCapture(41)).toBe(true);
    expect(drawingUpdates).not.toHaveBeenCalled();

    const groupId = runtime.createDrawingGroup(["a", "b"], "Plan");

    expect(groupId).toBe("drawing-group:1");
    expect(overlayCanvas.hasPointerCapture(41)).toBe(false);
    expect(drawingUpdates).toHaveBeenCalledTimes(1);
    expect(drawingUpdates).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "a" }),
        expect.objectContaining({ id: "b" }),
        expect.objectContaining({ id: "c" })
      ]),
      [],
      [{ id: groupId, name: "Plan", drawingIds: ["a", "b"] }]
    );

    drawingUpdates.mockClear();
    runtime.setDrawingGroupName(groupId, "Renamed");
    expect(drawingUpdates).toHaveBeenCalledTimes(1);
    expect(drawingUpdates.mock.calls[0]![2]).toEqual([
      { id: groupId, name: "Renamed", drawingIds: ["a", "b"] }
    ]);

    drawingUpdates.mockClear();
    runtime.setDrawingGroupMembers(groupId, ["b", "c"]);
    expect(drawingUpdates).toHaveBeenCalledTimes(1);
    expect(drawingUpdates.mock.calls[0]![2]).toEqual([
      { id: groupId, name: "Renamed", drawingIds: ["b", "c"] }
    ]);

    drawingUpdates.mockClear();
    runtime.setDrawingGroupVisible(groupId, false);
    expect(drawingUpdates).toHaveBeenCalledTimes(1);
    expect(drawingUpdates.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ id: "a" }),
      expect.objectContaining({ id: "b", visible: false }),
      expect.objectContaining({ id: "c", visible: false })
    ]);

    drawingUpdates.mockClear();
    runtime.setDrawingGroupLocked(groupId, true);
    expect(drawingUpdates).toHaveBeenCalledTimes(1);
    runtime.setDrawingGroupLocked(groupId, false);
    runtime.setDrawingGroupVisible(groupId, true);
    drawingUpdates.mockClear();

    runtime.moveDrawingGroup(groupId, "back");
    expect(drawingUpdates).toHaveBeenCalledTimes(1);

    drawingUpdates.mockClear();
    runtime.ungroupDrawingGroup(groupId);
    expect(drawingUpdates).toHaveBeenCalledTimes(1);
    expect(drawingUpdates.mock.calls[0]![2]).toEqual([]);

    drawingUpdates.mockClear();
    const secondGroupId = runtime.createDrawingGroup(["b", "c"], "Delete");
    drawingUpdates.mockClear();
    runtime.deleteDrawingGroupDrawings(secondGroupId);
    expect(drawingUpdates).toHaveBeenCalledTimes(1);
    expect(drawingUpdates).toHaveBeenLastCalledWith(
      [expect.objectContaining({ id: "a" })],
      [],
      []
    );
    drawingUpdates.mockClear();
    runtime.undoDrawing();
    expect(drawingUpdates).toHaveBeenCalledTimes(1);
    expect(drawingUpdates.mock.calls[0]![2]).toEqual([
      { id: secondGroupId, name: "Delete", drawingIds: ["b", "c"] }
    ]);

    runtime.destroy();
    expect(() => runtime.setDrawingGroupName(secondGroupId, "late")).not.toThrow();
    expect(drawingUpdates).toHaveBeenCalledTimes(1);
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
    let runtime!: ReturnType<typeof createChartEngineRuntime>;
    let reenterOnCleanup = false;
    const onExecutionTooltipChanged = vi.fn(() => {
      if (!reenterOnCleanup) return;
      runtime.destroy();
      throw new Error("host cleanup failed");
    });
    const calculationRuntime: CheckpointedCalculationRuntime = {
      async calculateIndicators() { return new Map<string, IndicatorResult>(); },
      async calculateSeries(input) {
        return { type: input.type, source: materialized().series, sourceIndexOffset: 0, points: [] } satisfies SeriesRenderModel;
      }
    };
    const themeRoot = { clientWidth: 800, clientHeight: 500 } as HTMLElement;
    runtime = createChartEngineRuntime({
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
      onDrawingHistoryChanged,
      onExecutionTooltipChanged
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
    expect(runtime.getVisibleRange()).toBeDefined();

    runtime.retryRender();
    reenterOnCleanup = true;
    onExecutionTooltipChanged.mockClear();
    runtime.destroy();
    runtime.destroy();
    runtime.setDrawings([{ id: "late", type: "trendLine", anchors: [] }]);
    expect(runtime.getVisibleRange()).toBeUndefined();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(onExecutionTooltipChanged).toHaveBeenCalledTimes(1);
    expect(cancelFrame).toHaveBeenCalled();
    expect(staticCanvas.listenerCount()).toBe(0);
    expect(overlayCanvas.listenerCount()).toBe(0);
    expect(onDrawingsChanged).not.toHaveBeenCalled();
  });

  it.each(["indicator", "series"] as const)(
    "retries a failed %s calculation before reporting render recovery",
    async (kind) => {
      const frames = new Map<number, () => void>();
      let nextFrame = 1;
      let indicatorAttempts = 0;
      let seriesAttempts = 0;
      const onRenderError = vi.fn();
      const onCalculationError = vi.fn();
      const onRenderRecovered = vi.fn();
      const runtime = createChartEngineRuntime({
        staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
        overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
        themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
        observer: { observe() {}, disconnect() {} },
        calculationRuntime: {
          async calculateIndicators() {
            indicatorAttempts += 1;
            if (kind === "indicator" && indicatorAttempts === 1) {
              throw new Error("controlled indicator failure");
            }
            return new Map<string, IndicatorResult>();
          },
          async calculateSeries(input) {
            seriesAttempts += 1;
            if (kind === "series" && seriesAttempts === 1) {
              throw new Error("controlled series failure");
            }
            return {
              type: input.type,
              source: materialized().series,
              sourceIndexOffset: 0,
              points: []
            } satisfies SeriesRenderModel;
          }
        },
        requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
        cancelFrame: (id) => { frames.delete(id); },
        getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
        onRenderError,
        onCalculationError,
        onRenderRecovered
      });
      const flushFrames = () => {
        while (frames.size > 0) {
          const pending = [...frames.values()];
          frames.clear();
          for (const callback of pending) callback();
        }
      };

      runtime.setMaterializedSeries(materialized());
      if (kind === "indicator") {
        runtime.setIndicators([
          { instanceId: "ma-a", id: "MA", params: { period: 5 }, visible: true }
        ]);
      } else {
        runtime.setSeriesType("renko");
      }
      await vi.waitFor(() => expect(onCalculationError).toHaveBeenCalledWith(
        kind,
        expect.any(Error)
      ));
      expect(onRenderError).not.toHaveBeenCalled();
      flushFrames();
      expect(onRenderRecovered).not.toHaveBeenCalled();

      runtime.retryRender();
      await vi.waitFor(() => expect(
        kind === "indicator" ? indicatorAttempts : seriesAttempts
      ).toBe(2));
      await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
      flushFrames();
      expect(onCalculationError).toHaveBeenCalledTimes(1);
      expect(onRenderError).not.toHaveBeenCalled();
      expect(onRenderRecovered).toHaveBeenCalledTimes(1);
      runtime.destroy();
    }
  );

  it.each([
    { kind: "indicator", calculationFirst: false },
    { kind: "series", calculationFirst: false },
    { kind: "indicator", calculationFirst: true },
    { kind: "series", calculationFirst: true }
  ] as const)(
    "does not complete render recovery while a $kind calculation is pending or failed (calculation first: $calculationFirst)",
    async ({ kind, calculationFirst }) => {
      const frames = new Map<number, () => void>();
      let nextFrame = 1;
      let attempts = 0;
      let rejectCalculation!: (error: Error) => void;
      const onCalculationError = vi.fn();
      const onRenderRecovered = vi.fn();
      const calculation = () => {
        attempts += 1;
        if (attempts === 1) {
          return new Promise<void>((_resolve, reject) => { rejectCalculation = reject; });
        }
        return Promise.resolve();
      };
      const runtime = createChartEngineRuntime({
        staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
        overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
        themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
        observer: { observe() {}, disconnect() {} },
        calculationRuntime: {
          async calculateIndicators() {
            if (kind === "indicator") await calculation();
            return new Map<string, IndicatorResult>();
          },
          async calculateSeries(input) {
            if (kind === "series") await calculation();
            return {
              type: input.type,
              source: materialized().series,
              sourceIndexOffset: 0,
              points: []
            } satisfies SeriesRenderModel;
          }
        },
        requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
        cancelFrame: (id) => { frames.delete(id); },
        getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
        onCalculationError,
        onRenderRecovered
      });
      const flushFrames = () => {
        while (frames.size > 0) {
          const pending = [...frames.values()];
          frames.clear();
          for (const callback of pending) callback();
        }
      };

      runtime.setMaterializedSeries(materialized());
      flushFrames();
      if (!calculationFirst) runtime.retryRender();
      if (kind === "indicator") {
        runtime.setIndicators([
          { instanceId: "ma-a", id: "MA", params: { period: 5 }, visible: true }
        ]);
      } else {
        runtime.setSeriesType("renko");
      }
      await vi.waitFor(() => expect(attempts).toBe(1));
      if (calculationFirst) runtime.retryRender();
      flushFrames();
      expect(onRenderRecovered).not.toHaveBeenCalled();

      rejectCalculation(new Error(`controlled ${kind} failure`));
      await vi.waitFor(() => expect(onCalculationError).toHaveBeenCalledTimes(1));
      flushFrames();
      expect(onRenderRecovered).not.toHaveBeenCalled();

      runtime.retryRender();
      await vi.waitFor(() => expect(attempts).toBe(2));
      await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
      flushFrames();
      expect(onRenderRecovered).toHaveBeenCalledTimes(1);
      runtime.destroy();
    }
  );

  it.each([
    { failReplacement: false, expectedTypes: ["renko", "kagi"], expectedErrors: 1 },
    { failReplacement: true, expectedTypes: ["renko", "kagi", "kagi"], expectedErrors: 2 }
  ] as const)(
    "replaces a failed stateful series without reviving it (replacement failure: $failReplacement)",
    async ({ failReplacement, expectedTypes, expectedErrors }) => {
      const frames = new Map<number, () => void>();
      let nextFrame = 1;
      let kagiAttempts = 0;
      const calculatedTypes: StatefulSeriesTransformType[] = [];
      const onCalculationError = vi.fn();
      const onRenderRecovered = vi.fn();
      const runtime = createChartEngineRuntime({
        staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
        overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
        themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
        observer: { observe() {}, disconnect() {} },
        calculationRuntime: {
          async calculateIndicators() {
            return new Map<string, IndicatorResult>();
          },
          async calculateSeries(input) {
            calculatedTypes.push(input.type);
            if (input.type === "renko") throw new Error("controlled renko failure");
            kagiAttempts += 1;
            if (failReplacement && kagiAttempts === 1) {
              throw new Error("controlled kagi failure");
            }
            return {
              type: input.type,
              source: materialized().series,
              sourceIndexOffset: 0,
              points: []
            } satisfies SeriesRenderModel;
          }
        },
        requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
        cancelFrame: (id) => { frames.delete(id); },
        getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
        onCalculationError,
        onRenderRecovered
      });
      const flushFrames = () => {
        while (frames.size > 0) {
          const pending = [...frames.values()];
          frames.clear();
          for (const callback of pending) callback();
        }
      };

      runtime.setMaterializedSeries(materialized());
      runtime.setSeriesType("renko");
      await vi.waitFor(() => expect(onCalculationError).toHaveBeenCalledTimes(1));
      flushFrames();

      runtime.setSeriesType("kagi");
      if (failReplacement) {
        await vi.waitFor(() => expect(onCalculationError).toHaveBeenCalledTimes(2));
        flushFrames();
        runtime.retryRender();
      }
      await vi.waitFor(() => expect(calculatedTypes).toEqual(expectedTypes));
      await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
      flushFrames();

      expect(onCalculationError).toHaveBeenCalledTimes(expectedErrors);
      expect(onRenderRecovered).toHaveBeenCalledTimes(1);
      runtime.destroy();
    }
  );

  it("does not recover while a replacement stateful series is still calculating", async () => {
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    let resolveKagi!: (model: SeriesRenderModel) => void;
    const calculatedTypes: StatefulSeriesTransformType[] = [];
    const onCalculationError = vi.fn();
    const onRenderRecovered = vi.fn();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: {
        async calculateIndicators() {
          return new Map<string, IndicatorResult>();
        },
        calculateSeries(input) {
          calculatedTypes.push(input.type);
          if (input.type === "renko") return Promise.reject(new Error("controlled renko failure"));
          return new Promise<SeriesRenderModel>((resolve) => { resolveKagi = resolve; });
        }
      },
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => { frames.delete(id); },
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
      onCalculationError,
      onRenderRecovered
    });
    const flushFrames = () => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
    };

    runtime.setMaterializedSeries(materialized());
    runtime.setSeriesType("renko");
    await vi.waitFor(() => expect(onCalculationError).toHaveBeenCalledTimes(1));
    flushFrames();

    runtime.setSeriesType("kagi");
    await vi.waitFor(() => expect(calculatedTypes).toEqual(["renko", "kagi"]));
    runtime.retryRender();
    flushFrames();
    expect(onRenderRecovered).not.toHaveBeenCalled();

    resolveKagi({
      type: "kagi",
      source: materialized().series,
      sourceIndexOffset: 0,
      points: []
    });
    await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
    flushFrames();
    expect(onRenderRecovered).toHaveBeenCalledTimes(1);
    runtime.destroy();
  });

  it("waits for both failed calculation paths before reporting recovery", async () => {
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    let indicatorAttempts = 0;
    let seriesAttempts = 0;
    const onRenderError = vi.fn();
    const onCalculationError = vi.fn();
    const onRenderRecovered = vi.fn();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: {
        async calculateIndicators() {
          indicatorAttempts += 1;
          if (indicatorAttempts === 1) throw new Error("controlled indicator failure");
          return new Map<string, IndicatorResult>();
        },
        async calculateSeries(input) {
          seriesAttempts += 1;
          if (seriesAttempts === 1) throw new Error("controlled series failure");
          return {
            type: input.type,
            source: materialized().series,
            sourceIndexOffset: 0,
            points: []
          } satisfies SeriesRenderModel;
        }
      },
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => { frames.delete(id); },
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
      onRenderError,
      onCalculationError,
      onRenderRecovered
    });
    const flushFrames = () => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
    };

    runtime.setMaterializedSeries(materialized());
    runtime.setIndicators([
      { instanceId: "ma-a", id: "MA", params: { period: 5 }, visible: true }
    ]);
    runtime.setSeriesType("renko");
    await vi.waitFor(() => expect(onCalculationError).toHaveBeenCalledTimes(2));
    expect(onCalculationError.mock.calls.map(([kind]) => kind).sort()).toEqual([
      "indicator",
      "series"
    ]);
    expect(onRenderError).not.toHaveBeenCalled();
    flushFrames();

    runtime.retryRender();
    await vi.waitFor(() => {
      expect(indicatorAttempts).toBe(2);
      expect(seriesAttempts).toBe(2);
    });
    await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
    flushFrames();
    expect(onRenderRecovered).toHaveBeenCalledTimes(1);
    runtime.destroy();
  });

  it("does not let a stale calculation block or fail current recovery", async () => {
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    let attempts = 0;
    let rejectCalculation!: (error: Error) => void;
    let firstSignal: AbortSignal | undefined;
    const calculateIndicators = vi.fn((input: Parameters<CheckpointedCalculationRuntime["calculateIndicators"]>[0]) => {
      attempts += 1;
      if (attempts === 1) {
        firstSignal = input.signal;
        return new Promise<Map<string, IndicatorResult>>(
          (_resolve, reject) => { rejectCalculation = reject; }
        );
      }
      if (attempts === 2) return Promise.reject(new Error("current calculation failure"));
      return Promise.resolve(new Map<string, IndicatorResult>());
    });
    const onCalculationError = vi.fn();
    const onRenderRecovered = vi.fn();
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: {
        calculateIndicators,
        async calculateSeries(input) {
          return {
            type: input.type,
            source: materialized().series,
            sourceIndexOffset: 0,
            points: []
          } satisfies SeriesRenderModel;
        }
      },
      requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelFrame: (id) => { frames.delete(id); },
      getComputedStyle: () => ({ getPropertyValue: () => "" }) as CSSStyleDeclaration,
      onCalculationError,
      onRenderRecovered
    });

    runtime.setMaterializedSeries(materialized());
    const indicators = [
      { instanceId: "ma-a", id: "MA", params: { period: 5 }, visible: true }
    ] as const;
    runtime.setIndicators(indicators);
    await vi.waitFor(() => expect(calculateIndicators).toHaveBeenCalledTimes(1));
    runtime.cancelCalculations();
    expect(firstSignal?.aborted).toBe(true);
    runtime.setIndicators(indicators);
    await vi.waitFor(() => expect(onCalculationError).toHaveBeenCalledTimes(1));
    while (frames.size > 0) {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback();
    }
    runtime.retryRender();
    await vi.waitFor(() => expect(calculateIndicators).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => {
      while (frames.size > 0) {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback();
      }
      expect(onRenderRecovered).toHaveBeenCalledTimes(1);
    });

    rejectCalculation(new Error("stale selection calculation"));
    await Promise.resolve();
    expect(onCalculationError).toHaveBeenCalledTimes(1);
    runtime.destroy();
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

  it("repaints every visual layer after a theme change without recalculating data", () => {
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    const calculateIndicators = vi.fn(async () => new Map<string, IndicatorResult>());
    const calculateSeries = vi.fn(async (input) => ({
      type: input.type,
      source: materialized().series,
      sourceIndexOffset: 0,
      points: []
    } satisfies SeriesRenderModel));
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime: { calculateIndicators, calculateSeries },
      requestFrame(callback) {
        const id = nextFrame++;
        frames.set(id, callback);
        return id;
      },
      cancelFrame: (id) => frames.delete(id)
    });
    runtime.setMaterializedSeries(materialized());
    for (const callback of [...frames.values()]) callback();
    frames.clear();
    const before = runtime.getMetrics();

    runtime.refreshTheme();
    expect(frames.size).toBe(1);
    for (const callback of [...frames.values()]) callback();
    frames.clear();

    const after = runtime.getMetrics();
    expect(after.renderCountByPass.static).toBe(before.renderCountByPass.static + 1);
    expect(after.renderCountByPass.overlay).toBe(before.renderCountByPass.overlay + 1);
    expect(calculateIndicators).not.toHaveBeenCalled();
    expect(calculateSeries).not.toHaveBeenCalled();
    runtime.destroy();
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

  it("notifies data-table changes only while the table is active", async () => {
    let notifications = 0;
    const runtime = createChartEngineRuntime({
      staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
      observer: { observe() {}, disconnect() {} },
      calculationRuntime,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
      onDataTableChanged: () => { notifications += 1; }
    });
    runtime.setMaterializedSeries(materialized(1, 1_000));
    runtime.setVisibleRange({ from: 201, to: 250 });
    await Promise.resolve();
    expect(notifications).toBe(0);

    runtime.setDataTableActive(true);
    runtime.setVisibleRange({ from: 301, to: 350 });
    await Promise.resolve();
    expect(notifications).toBe(1);

    runtime.setDataTableActive(false);
    runtime.setVisibleRange({ from: 401, to: 450 });
    await Promise.resolve();
    expect(notifications).toBe(1);
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
