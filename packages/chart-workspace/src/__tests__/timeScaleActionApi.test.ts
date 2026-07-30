import { describe, expect, it } from "vitest";
import {
  createChartLayout,
  indexToX,
  type IndicatorResult,
  type SeriesRenderModel,
  type ViewportState
} from "@simoncharts/chart-engine";
import type { ChartPane, ChartPriceRange, ChartVisibleRange } from "../contracts";
import type { MaterializedSeries } from "../data/materializedSeries";
import type { CheckpointedCalculationRuntime } from "../runtime/checkpointedCalculationRuntime";
import { createChartEngineRuntime } from "../runtime/chartEngineRuntime";

class FakeCanvas {
  width = 800;
  height = 500;
  clientWidth = 800;
  clientHeight = 500;
  style: Record<string, string> = {};
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly context = new Proxy(
    { canvas: this },
    {
      get: (target, key) => {
        if (key in target) return target[key as keyof typeof target];
        if (key === "measureText") {
          return (value: unknown) => ({ width: String(value).length * 7 });
        }
        return () => undefined;
      },
      set(target, key, value) {
        (target as Record<PropertyKey, unknown>)[key] = value;
        return true;
      }
    }
  );

  getContext() {
    return this.context as unknown as CanvasRenderingContext2D;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }
  focus() {}
  setPointerCapture() {}
  hasPointerCapture() { return false; }
  releasePointerCapture() {}
  addEventListener(type: string, listener: EventListener) {
    const entries = this.listeners.get(type) ?? new Set<EventListener>();
    entries.add(listener);
    this.listeners.set(type, entries);
  }
  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }
}

const calculationRuntime: CheckpointedCalculationRuntime = {
  async calculateIndicators() {
    return new Map<string, IndicatorResult>();
  },
  async calculateSeries(input) {
    return {
      type: input.type,
      source: materialized().series,
      sourceIndexOffset: 0,
      points: []
    } satisfies SeriesRenderModel;
  }
};

function materialized(count = 120): MaterializedSeries {
  const candles = Array.from({ length: count }, (_, index) => ({
    time: index + 1,
    open: 100 + index,
    high: 102 + index,
    low: 99 + index,
    close: 101 + index,
    volume: 1_000,
    turnover: 101_000
  }));
  return {
    selection: {
      symbol: {
        id: "stock:SSE:600000",
        code: "600000",
        name: "浦发银行",
        exchange: "SSE",
        kind: "stock"
      },
      timeframe: "1m",
      adjustMode: "forward"
    },
    series: {
      symbol: "stock:SSE:600000",
      timeframe: "1m",
      adjustMode: "forward",
      dataVersion: "v1",
      candles
    },
    sourceIndexOffset: 0,
    sourceMinTime: 1,
    sourceMaxTime: count,
    hasMoreBefore: false,
    hasKnownOlderData: false,
    hasKnownNewerPages: false,
    missingRequestCursors: []
  };
}

interface Rc44Runtime {
  getVisibleRange(): Readonly<ChartVisibleRange> | undefined;
  getBarSpacing(): number;
  setBarSpacing(spacing: number): void;
  getWidth(): number;
  timeToCoordinate(time: number): number | undefined;
  coordinateToTime(coordinate: number): number | undefined;
  scrollByBars(bars: number): void;
  zoomIn(): void;
  zoomOut(): void;
  fitContent(): void;
  resetToLatest(resetPriceScale?: boolean): void;
  getPanes(): readonly ChartPane[];
  setPaneVisibleRange(id: "main", range: ChartPriceRange): void;
  destroy(): void;
}

function runtimeFixture(input = materialized()) {
  const frames = new Map<number, () => void>();
  const viewports: ViewportState[] = [];
  let nextFrame = 1;
  const runtime = createChartEngineRuntime({
    staticCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
    overlayCanvas: new FakeCanvas() as unknown as HTMLCanvasElement,
    themeRoot: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
    observer: { observe() {}, disconnect() {} },
    calculationRuntime,
    requestFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      frames.delete(id);
    },
    devicePixelRatio: 1,
    getComputedStyle: () => ({
      getPropertyValue: () => ""
    }) as CSSStyleDeclaration,
    onViewportChanged(viewport) {
      viewports.push(structuredClone(viewport));
    }
  });
  runtime.setMaterializedSeries(input);
  while (frames.size > 0) {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  }
  return {
    runtime: runtime as unknown as Rc44Runtime,
    viewports
  };
}

describe("rc.44 runtime time-scale API", () => {
  it("reports geometry, converts coordinates, and changes bar spacing", () => {
    const { runtime, viewports } = runtimeFixture();
    const layout = createChartLayout(800, 500);
    const viewport = viewports.at(-1)!;
    const index = Math.floor((viewport.visibleRange.from + viewport.visibleRange.to) / 2);
    const coordinate = indexToX(index, viewport, layout.plotArea.x) - layout.plotArea.x;

    expect(runtime.getWidth()).toBe(layout.plotArea.width);
    expect(runtime.getBarSpacing()).toBe(viewport.candleWidth);
    expect(runtime.timeToCoordinate(index + 1)).toBeCloseTo(coordinate);
    expect(runtime.coordinateToTime(coordinate)).toBe(index + 1);

    runtime.setBarSpacing(12);
    expect(runtime.getBarSpacing()).toBeCloseTo(12, 0);
    runtime.destroy();
  });

  it("exposes bounded zoom, scroll, fit, and reset operations", () => {
    const { runtime } = runtimeFixture();
    const initialRange = runtime.getVisibleRange();
    const initialSpacing = runtime.getBarSpacing();

    runtime.zoomIn();
    expect(runtime.getBarSpacing()).toBeGreaterThan(initialSpacing);
    runtime.zoomOut();
    expect(runtime.getBarSpacing()).toBeCloseTo(initialSpacing, 0);

    runtime.scrollByBars(5);
    expect(runtime.getVisibleRange()).not.toEqual(initialRange);
    runtime.scrollByBars(-5);
    const restoredRange = runtime.getVisibleRange()!;
    expect(Math.abs(restoredRange.from - initialRange!.from)).toBeLessThanOrEqual(1);
    expect(Math.abs(restoredRange.to - initialRange!.to)).toBeLessThanOrEqual(1);

    runtime.setBarSpacing(20);
    runtime.fitContent();
    expect(runtime.getVisibleRange()).toEqual({ from: 1, to: 120 });
    runtime.setBarSpacing(20);
    runtime.resetToLatest(false);
    expect(runtime.getVisibleRange()).toEqual(initialRange);
    runtime.destroy();
  });

  it("preserves manual price scale for time reset and clears it for chart reset", () => {
    const { runtime } = runtimeFixture();
    const manualRange = { from: 50, to: 150 };
    runtime.setPaneVisibleRange("main", manualRange);
    expect(runtime.getPanes()[0]!.priceScale).toEqual({
      mode: "linear",
      autoScale: false,
      inverted: false,
      visibleRange: manualRange
    });

    runtime.resetToLatest(false);
    expect(runtime.getPanes()[0]!.priceScale).toEqual({
      mode: "linear",
      autoScale: false,
      inverted: false,
      visibleRange: manualRange
    });

    runtime.resetToLatest(true);
    expect(runtime.getPanes()[0]!.priceScale).toEqual({
      mode: "linear",
      autoScale: true,
      inverted: false
    });
    runtime.destroy();
  });

  it("keeps every time-scale mutation a no-op in the fixed intraday view", () => {
    const source = {
      ...materialized(241),
      intradayDays: 1 as const,
      intradayScale: {
        previousClose: 100,
        priceLimitPercent: 10
      }
    };
    const { runtime } = runtimeFixture(source);
    const before = {
      range: runtime.getVisibleRange(),
      spacing: runtime.getBarSpacing()
    };

    runtime.setBarSpacing(20);
    runtime.scrollByBars(5);
    runtime.zoomIn();
    runtime.zoomOut();
    runtime.fitContent();
    runtime.resetToLatest(false);

    expect(runtime.getVisibleRange()).toEqual(before.range);
    expect(runtime.getBarSpacing()).toBe(before.spacing);
    runtime.destroy();
  });

  it("invalidates retained time-scale geometry after destroy", () => {
    const { runtime } = runtimeFixture();
    expect(runtime.getBarSpacing()).toBeGreaterThan(0);
    expect(runtime.getWidth()).toBeGreaterThan(0);

    runtime.destroy();

    expect(runtime.getBarSpacing()).toBe(0);
    expect(runtime.getWidth()).toBe(0);
    expect(runtime.timeToCoordinate(60)).toBeUndefined();
    expect(runtime.coordinateToTime(60)).toBeUndefined();
  });
});
