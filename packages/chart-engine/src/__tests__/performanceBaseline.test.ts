import { describe, expect, it } from "vitest";
import {
  calculateCoreIndicator,
  computeVisiblePriceRange,
  coreIndicatorIds,
  createFiguresForDrawing,
  createMainPanelPriceScale,
  createRenderScheduler,
  createSourceSeriesRenderModel,
  defaultChartTheme,
  defaultChartTimeFormatter,
  drawingTypes,
  renderStaticChart
} from "../index";
import type {
  CandleSeries,
  ChartLayout,
  DrawingObject,
  DrawingType,
  LayerRenderContext,
  RenderState,
  ViewportState
} from "../index";

const candleCount = 10_000;
const largeCandleCount = 50_000;
const visibleCandleCount = 600;
const largeVisibleCandleCount = 1_200;

class FakeCanvasContext {
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  font = "";
  textAlign = "start";
  textBaseline = "alphabetic";

  beginPath(): void {}
  moveTo(_x: number, _y: number): void {}
  lineTo(_x: number, _y: number): void {}
  stroke(): void {}
  fillRect(_x: number, _y: number, _width: number, _height: number): void {}
  fillText(_text: string, _x: number, _y: number): void {}
  save(): void {}
  restore(): void {}
  rect(_x: number, _y: number, _width: number, _height: number): void {}
  clip(): void {}
  clearRect(_x: number, _y: number, _width: number, _height: number): void {}
  setLineDash(_dash: number[]): void {}
}

describe("performance baseline", () => {
  it("keeps large-series engine paths within conservative upper bounds", () => {
    const series = createLargeSeries(candleCount);
    const viewport = createViewport(candleCount);

    const renderModelMs = measure(() => {
      const model = createSourceSeriesRenderModel("candles", series);

      expect(model.points).toHaveLength(candleCount);
    });

    const autoscaleMs = measure(() => {
      const range = computeVisiblePriceRange(series, { from: 0, to: candleCount - 1 });

      expect(range.max).toBeGreaterThan(range.min);
    });

    const indicatorsMs = measure(() => {
      for (const id of coreIndicatorIds) {
        const result = calculateCoreIndicator(id, series);

        expect(result.outputs.length).toBeGreaterThan(0);
      }
    });

    const drawingFiguresMs = measure(() => {
      const figures = drawingTypes.flatMap((type, index) =>
        createFiguresForDrawing(createDrawing(type, index))
      );

      expect(figures.length).toBeGreaterThan(drawingTypes.length);
    });

    const staticRendererMs = measure(() => {
      renderStaticChart(createRenderContext(series, viewport));
    });

    const schedulerMs = measure(() => {
      const scheduler = createRenderScheduler({
        requestFrame(callback) {
          callback();
          return 1;
        },
        renderPass() {}
      });

      for (let index = 0; index < 1_000; index += 1) {
        scheduler.invalidate({
          layers: ["series", "crosshair"],
          reason: `perf-${index}`
        });
      }
    });

    expect(renderModelMs).toBeLessThan(250);
    expect(autoscaleMs).toBeLessThan(100);
    expect(indicatorsMs).toBeLessThan(2_500);
    expect(drawingFiguresMs).toBeLessThan(250);
    expect(staticRendererMs).toBeLessThan(1_000);
    expect(schedulerMs).toBeLessThan(250);
  });

  it("keeps 50k-candle release paths within conservative upper bounds", () => {
    const series = createLargeSeries(largeCandleCount);
    const viewport = createViewport(largeCandleCount, largeVisibleCandleCount);

    const renderModelMs = measure(() => {
      const model = createSourceSeriesRenderModel("candles", series);

      expect(model.points).toHaveLength(largeCandleCount);
    });

    const autoscaleMs = measure(() => {
      const range = computeVisiblePriceRange(series, { from: 0, to: largeCandleCount - 1 });

      expect(range.max).toBeGreaterThan(range.min);
    });

    const indicatorsMs = measure(() => {
      for (const id of coreIndicatorIds) {
        const result = calculateCoreIndicator(id, series);

        expect(result.outputs.length).toBeGreaterThan(0);
      }
    });

    const staticRendererMs = measure(() => {
      renderStaticChart(createRenderContext(series, viewport));
    });

    const schedulerMs = measure(() => {
      const scheduler = createRenderScheduler({
        requestFrame(callback) {
          callback();
          return 1;
        },
        renderPass() {}
      });

      for (let index = 0; index < 5_000; index += 1) {
        scheduler.invalidate({
          layers: ["series", "crosshair"],
          reason: `perf-50k-${index}`
        });
      }
    });

    expect(renderModelMs).toBeLessThan(1_000);
    expect(autoscaleMs).toBeLessThan(500);
    expect(indicatorsMs).toBeLessThan(8_000);
    expect(staticRendererMs).toBeLessThan(3_000);
    expect(schedulerMs).toBeLessThan(1_000);
  });
});

function measure(action: () => void): number {
  const startedAt = performance.now();

  action();

  return performance.now() - startedAt;
}

function createLargeSeries(count: number): CandleSeries {
  const candles: CandleSeries["candles"] = [];

  for (let index = 0; index < count; index += 1) {
    const base = 100 + Math.sin(index / 20) * 8 + index * 0.01;
    const open = base + Math.sin(index / 7);
    const close = base + Math.cos(index / 9);
    const high = Math.max(open, close) + 1 + (index % 5) * 0.1;
    const low = Math.min(open, close) - 1 - (index % 3) * 0.1;

    candles.push({
      time: 1_700_000_000 + index * 86_400,
      open,
      high,
      low,
      close,
      volume: 100_000 + (index % 200) * 1_000,
      turnover: close * (100_000 + (index % 200) * 1_000)
    });
  }

  return {
    symbol: "PERF",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "perf-10k",
    candles
  };
}

function createViewport(count: number, visibleCount = visibleCandleCount): ViewportState {
  return {
    visibleRange: { from: count - visibleCount, to: count - 1 },
    candleWidth: 6,
    scrollOffset: 0,
    priceScaleMode: "linear"
  };
}

function createRenderContext(series: CandleSeries, viewport: ViewportState): LayerRenderContext {
  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    state: createRenderState(series, viewport)
  };
}

function createRenderState(series: CandleSeries, viewport: ViewportState): RenderState {
  return {
    series,
    seriesType: "candles",
    viewport,
    priceScale: createMainPanelPriceScale(
      series,
      viewport.visibleRange,
      viewport.priceScaleMode,
      [],
      []
    ),
    formatTime: defaultChartTimeFormatter,
    theme: defaultChartTheme,
    layout: createLayout()
  };
}

function createLayout(): ChartLayout {
  return {
    width: 1_000,
    height: 620,
    rightAxisWidth: 64,
    bottomAxisHeight: 28,
    plotArea: { x: 0, y: 0, width: 936, height: 592 },
    priceAxisArea: { x: 936, y: 0, width: 64, height: 592 },
    timeAxisArea: { x: 0, y: 592, width: 936, height: 28 }
  };
}

function createDrawing(type: DrawingType, index: number): DrawingObject {
  const x = 20 + index * 3;
  const y = 40 + (index % 11) * 7;
  const anchors = [
    { x, y, time: index, price: 100 + index },
    { x: x + 40, y: y + 20, time: index + 1, price: 101 + index },
    { x: x + 80, y: y - 12, time: index + 2, price: 102 + index },
    { x: x + 120, y: y + 32, time: index + 3, price: 103 + index },
    { x: x + 160, y: y - 24, time: index + 4, price: 104 + index }
  ];

  return {
    id: `perf-${type}-${index}`,
    type,
    anchors,
    text: "Perf",
    style: { color: "#2563eb", lineWidth: 2, fill: "rgba(37,99,235,0.12)" }
  };
}
