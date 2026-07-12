import { describe, expect, it, vi } from "vitest";
import type { IndicatorResult, SeriesRenderModel } from "@simoncharts/chart-engine";
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
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly context = new Proxy(
    { canvas: this },
    {
      get(target, key) {
        if (key in target) return target[key as keyof typeof target];
        return () => undefined;
      },
      set(target, key, value) {
        (target as Record<PropertyKey, unknown>)[key] = value;
        return true;
      }
    }
  );

  getContext() { return this.context as unknown as CanvasRenderingContext2D; }
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

function materialized(): MaterializedSeries {
  const candles = Array.from({ length: 100 }, (_, index) => ({
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
      symbol: { id: "SSE:600000", code: "600000", name: "浦发银行", exchange: "SSE", kind: "stock" },
      timeframe: "1m",
      adjustMode: "forward"
    },
    series: { symbol: "SSE:600000", timeframe: "1m", adjustMode: "forward", dataVersion: "v1", candles },
    sourceIndexOffset: 0,
    sourceMinTime: 1,
    sourceMaxTime: 100,
    hasMoreBefore: false,
    hasKnownNewerPages: false,
    missingRequestCursors: []
  };
}

describe("workspace engine runtime", () => {
  it("wires dark A-share theme, isolates overlay frames, and destroys exactly once", async () => {
    const staticCanvas = new FakeCanvas();
    const overlayCanvas = new FakeCanvas();
    const frames = new Map<number, () => void>();
    let nextFrame = 1;
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    const cancelFrame = vi.fn((id: number) => frames.delete(id));
    const onDrawingsChanged = vi.fn();
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
      onDrawingsChanged
    });

    runtime.setMaterializedSeries(materialized());
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
});
