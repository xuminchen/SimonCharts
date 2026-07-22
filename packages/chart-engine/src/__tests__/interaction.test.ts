import { describe, expect, it } from "vitest";
import {
  createInitialViewport,
  createInteractionEngine,
  createPriceScaleFromBounds,
  hitTestCandleAtX,
  indexToX
} from "../index";
import { createMainPanelPriceScale } from "../render/mainPriceScale";
import type { CandleSeries, InteractionEvent, ViewportState } from "../index";
import { fixtureDailyCandleSeries } from "./fixtures/dailyCandles";

const width = 240;
const plotLeft = 16;
const plotTop = 20;
const plotHeight = 180;

function createEngine(
  events: InteractionEvent[] = [],
  priceScaleMode: ViewportState["priceScaleMode"] = "linear"
) {
  const viewport = {
    ...createInitialViewport(fixtureDailyCandleSeries.candles.length, width),
    priceScaleMode
  };

  return createInteractionEngine({
    series: fixtureDailyCandleSeries,
    viewport,
    priceScale: createMainPanelPriceScale(
      fixtureDailyCandleSeries,
      viewport.visibleRange,
      priceScaleMode,
      [],
      []
    ),
    width,
    plotLeft,
    plotTop,
    plotHeight,
    onEvent: (event) => events.push(event)
  });
}

function createSeries(count: number): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: Array.from({ length: count }, (_, index) => ({
      time: index,
      open: index + 1,
      high: index + 2,
      low: index,
      close: index + 1.5,
      volume: index + 10,
      turnover: index + 20
    }))
  };
}

describe("interaction engine", () => {
  it("uses a replacement shared price scale for inverse mapping", () => {
    const engine = createEngine();
    const viewport = engine.getViewport();
    const index = viewport.visibleRange.from + 1;

    engine.setPriceScale(createPriceScaleFromBounds({ min: 100, max: 200 }, 100, "linear"));
    engine.handlePointerMove({
      x: indexToX(index, viewport, plotLeft),
      y: plotTop + plotHeight / 2
    });

    expect(engine.getCrosshair()?.price).toBeCloseTo(150);
  });

  it.each(["linear", "log", "percentage"] as const)(
    "inverse-maps crosshair coordinates with the shared %s scale",
    (priceScaleMode) => {
      const events: InteractionEvent[] = [];
      const engine = createEngine(events, priceScaleMode);
      const viewport = engine.getViewport();
      const index = viewport.visibleRange.from + 1;

      engine.handlePointerMove({
        x: indexToX(index, viewport, plotLeft),
        y: plotTop + plotHeight / 2
      });

      expect(events.at(-1)).toMatchObject({
        type: "crosshairMoved",
        crosshair: { index }
      });
      expect(engine.getCrosshair()?.price).toBeGreaterThan(0);
    }
  );

  it("zooms in around the cursor candle index on wheel up", () => {
    const events: InteractionEvent[] = [];
    const engine = createEngine(events);
    const before = engine.getViewport();
    const anchorIndex = before.visibleRange.from + 10;
    const anchorX = indexToX(anchorIndex, before, plotLeft);

    engine.handleWheel({ x: anchorX, deltaY: -100 });

    const after = engine.getViewport();
    expect(after.candleWidth).toBeGreaterThan(before.candleWidth);
    expect(after.visibleRange.to - after.visibleRange.from).toBeLessThan(
      before.visibleRange.to - before.visibleRange.from
    );
    expect(after.visibleRange.from).toBeLessThanOrEqual(anchorIndex);
    expect(after.visibleRange.to).toBeGreaterThanOrEqual(anchorIndex);
    expect(events.at(-1)).toEqual({
      type: "viewportChanged",
      viewport: after,
      visibleRange: after.visibleRange
    });
  });

  it("zooms out around the cursor candle index on wheel down", () => {
    const events: InteractionEvent[] = [];
    const engine = createEngine(events);
    const first = engine.getViewport();
    const anchorIndex = first.visibleRange.from + 10;
    const anchorX = indexToX(anchorIndex, first, plotLeft);

    engine.handleWheel({ x: anchorX, deltaY: -100 });
    const zoomed = engine.getViewport();
    engine.handleWheel({ x: indexToX(anchorIndex, zoomed, plotLeft), deltaY: 100 });

    const after = engine.getViewport();
    expect(after.candleWidth).toBeLessThan(zoomed.candleWidth);
    expect(after.visibleRange.to - after.visibleRange.from).toBeGreaterThan(
      zoomed.visibleRange.to - zoomed.visibleRange.from
    );
    expect(after.visibleRange.from).toBeLessThanOrEqual(anchorIndex);
    expect(after.visibleRange.to).toBeGreaterThanOrEqual(anchorIndex);
  });

  it("makes further wheel zoom-out a no-op at the bounded K-line capacity", () => {
    const series = createSeries(6_000);
    const chartWidth = 1_132;
    const viewport = createInitialViewport(series.candles.length, chartWidth);
    const engine = createInteractionEngine({
      series,
      viewport,
      priceScale: createMainPanelPriceScale(series, viewport.visibleRange, "linear", [], []),
      width: chartWidth,
      plotLeft: 0,
      plotTop,
      plotHeight,
      onEvent: () => undefined
    });

    for (let count = 0; count < 64; count += 1) {
      const current = engine.getViewport();
      const anchorIndex = Math.floor((current.visibleRange.from + current.visibleRange.to) / 2);
      engine.handleWheel({ x: indexToX(anchorIndex, current, 0), deltaY: 100 });
    }

    const stopped = engine.getViewport();
    expect(stopped.candleWidth).toBe(2);
    expect(stopped.visibleRange).toEqual({ from: 5_434, to: 5_999 });
    expect(indexToX(stopped.visibleRange.from, stopped, 0) - stopped.candleWidth / 2).toBe(0);
    expect(indexToX(stopped.visibleRange.to, stopped, 0) + stopped.candleWidth / 2).toBe(chartWidth);

    engine.handleWheel({ x: chartWidth / 2, deltaY: 100 });
    expect(engine.getViewport()).toEqual(stopped);
  });

  it("changes the visible range by candle delta while dragging", () => {
    const events: InteractionEvent[] = [];
    const engine = createEngine(events);
    const before = engine.getViewport();

    engine.handlePointerDown({ x: 120, y: 80 });
    engine.handlePointerMove({ x: 120 + before.candleWidth * 3, y: 80 });
    engine.handlePointerUp({ x: 120 + before.candleWidth * 3, y: 80 });

    const after = engine.getViewport();
    expect(after.scrollOffset).toBe(before.scrollOffset + 3);
    expect(after.visibleRange.from).toBe(before.visibleRange.from - 3);
    expect(after.visibleRange.to).toBe(before.visibleRange.to - 3);
    expect(events.some((event) => event.type === "viewportChanged")).toBe(true);
  });

  it("resets the view to the latest candles", () => {
    const engine = createEngine();
    const before = engine.getViewport();

    engine.handlePointerDown({ x: 120, y: 80 });
    engine.handlePointerMove({ x: 120 + before.candleWidth * 4, y: 80 });
    engine.handlePointerUp({ x: 120 + before.candleWidth * 4, y: 80 });
    engine.resetView();

    expect(engine.getViewport()).toEqual(
      createInitialViewport(fixtureDailyCandleSeries.candles.length, width)
    );
  });

  it("emits crosshair state with candle index, time, price, and OHLCV values", () => {
    const events: InteractionEvent[] = [];
    const engine = createEngine(events);
    const viewport = engine.getViewport();
    const index = viewport.visibleRange.from + 5;
    const candle = fixtureDailyCandleSeries.candles[index];

    engine.handlePointerMove({
      x: indexToX(index, viewport, plotLeft),
      y: plotTop + plotHeight / 2
    });

    const crosshair = engine.getCrosshair();
    expect(crosshair).toMatchObject({
      index,
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      turnover: candle.turnover
    });
    expect(crosshair?.price).toEqual(expect.any(Number));
    expect(events.at(-1)).toEqual({ type: "crosshairMoved", crosshair });
  });

  it("clears crosshair and emits undefined when pointer x misses data", () => {
    const events: InteractionEvent[] = [];
    const engine = createEngine(events);
    const viewport = engine.getViewport();
    const index = viewport.visibleRange.from + 5;

    engine.handlePointerMove({
      x: indexToX(index, viewport, plotLeft),
      y: plotTop + plotHeight / 2
    });
    engine.handlePointerMove({ x: plotLeft - 1, y: plotTop + plotHeight / 2 });

    expect(engine.getCrosshair()).toBeUndefined();
    expect(events.at(-1)).toEqual({ type: "crosshairMoved", crosshair: undefined });
  });

  it("clears crosshair and emits undefined when pointer y is outside the plot", () => {
    const events: InteractionEvent[] = [];
    const engine = createEngine(events);
    const viewport = engine.getViewport();
    const index = viewport.visibleRange.from + 5;
    const x = indexToX(index, viewport, plotLeft);

    engine.handlePointerMove({ x, y: plotTop + plotHeight / 2 });
    engine.handlePointerMove({ x, y: plotTop + plotHeight + 1 });

    expect(engine.getCrosshair()).toBeUndefined();
    expect(events.at(-1)).toEqual({ type: "crosshairMoved", crosshair: undefined });
  });

  it("clears crosshair and emits undefined when pointer input lacks y", () => {
    const events: InteractionEvent[] = [];
    const engine = createEngine(events);
    const viewport = engine.getViewport();
    const index = viewport.visibleRange.from + 5;
    const x = indexToX(index, viewport, plotLeft);

    engine.handlePointerMove({ x, y: plotTop + plotHeight / 2 });
    engine.handlePointerMove({ x });
    engine.handlePointerMove({ x });

    expect(engine.getCrosshair()).toBeUndefined();
    expect(events.filter((event) => event.type === "crosshairMoved").at(-1)).toEqual({
      type: "crosshairMoved",
      crosshair: undefined
    });
    expect(events.filter((event) => event.type === "crosshairMoved" && !event.crosshair)).toHaveLength(
      1
    );
  });

  it("clears crosshair when reset view runs", () => {
    const events: InteractionEvent[] = [];
    const engine = createEngine(events);
    const viewport = engine.getViewport();
    const index = viewport.visibleRange.from + 5;

    engine.handlePointerMove({
      x: indexToX(index, viewport, plotLeft),
      y: plotTop + plotHeight / 2
    });
    engine.resetView();

    expect(engine.getCrosshair()).toBeUndefined();
    expect(events.at(-1)).toEqual({ type: "crosshairMoved", crosshair: undefined });
  });

  it("clears crosshair after a wheel viewport change", () => {
    const events: InteractionEvent[] = [];
    const engine = createEngine(events);
    const viewport = engine.getViewport();
    const index = viewport.visibleRange.from + 5;
    const x = indexToX(index, viewport, plotLeft);

    engine.handlePointerMove({ x, y: plotTop + plotHeight / 2 });
    engine.handleWheel({ x, deltaY: -100 });

    expect(engine.getCrosshair()).toBeUndefined();
    expect(events.at(-1)).toEqual({ type: "crosshairMoved", crosshair: undefined });
  });

  it("exposes interaction state with dragging status", () => {
    const engine = createEngine();

    expect(engine.getState().isDragging).toBe(false);
    engine.handlePointerDown({ x: 120, y: 80 });
    expect(engine.getState().isDragging).toBe(true);
    engine.handlePointerUp({ x: 120, y: 80 });
    expect(engine.getState().isDragging).toBe(false);
  });

  it("emits a neutral viewportChanged event when visible range changes", () => {
    const events: InteractionEvent[] = [];
    const engine = createEngine(events);
    const before = engine.getViewport();

    engine.handleWheel({ x: indexToX(before.visibleRange.from + 8, before, plotLeft), deltaY: -100 });

    expect(events).toContainEqual({
      type: "viewportChanged",
      viewport: engine.getViewport(),
      visibleRange: engine.getViewport().visibleRange
    });
  });
});

describe("hit testing", () => {
  it("uses the same subpixel candle width as rendering", () => {
    const series = createSeries(2_169);
    const viewport: ViewportState = {
      visibleRange: { from: 0, to: 2_168 },
      candleWidth: 0.17,
      scrollOffset: 0,
      priceScaleMode: "linear"
    };
    const index = 1_700;
    const x = indexToX(index, viewport, plotLeft);

    expect(hitTestCandleAtX(series, viewport, x, plotLeft)).toEqual({
      index,
      candle: series.candles[index]
    });
  });

  it("uses the same irregular intraday coordinates as rendering", () => {
    const series = createSeries(4);
    const viewport: ViewportState = {
      visibleRange: { from: 0, to: 3 },
      candleWidth: 50,
      scrollOffset: 0,
      priceScaleMode: "linear"
    };
    const timeCoordinates = {
      positions: [0, 100, 100, 200],
      barWidth: 1,
      dayStartIndices: [0, 2],
      dayStartOffsets: [0, 100]
    };

    expect(hitTestCandleAtX(series, viewport, 160, 0, timeCoordinates)).toEqual({
      index: 3,
      candle: series.candles[3]
    });
    expect(hitTestCandleAtX(series, viewport, 202, 0, timeCoordinates)).toBeUndefined();
  });

  it("returns undefined when x maps beyond clamped visible candle data", () => {
    const series = createSeries(5);
    const viewport: ViewportState = {
      visibleRange: { from: 0, to: 9 },
      candleWidth: 8,
      scrollOffset: 0,
      priceScaleMode: "linear"
    };

    expect(hitTestCandleAtX(series, viewport, 4, 0)).toEqual({
      index: 0,
      candle: series.candles[0]
    });
    expect(hitTestCandleAtX(series, viewport, 36, 0)).toEqual({
      index: 4,
      candle: series.candles[4]
    });
    expect(hitTestCandleAtX(series, viewport, 60, 0)).toBeUndefined();
    expect(
      hitTestCandleAtX(series, { ...viewport, visibleRange: { from: 0, to: -1 } }, 4, 0)
    ).toBeUndefined();
  });

  it("returns undefined when the viewport is entirely before available data", () => {
    const series = createSeries(5);
    const viewport: ViewportState = {
      visibleRange: { from: -10, to: -1 },
      candleWidth: 8,
      scrollOffset: 0,
      priceScaleMode: "linear"
    };

    expect(hitTestCandleAtX(series, viewport, 0, 0)).toBeUndefined();
    expect(hitTestCandleAtX(series, viewport, 40, 0)).toBeUndefined();
    expect(hitTestCandleAtX(series, viewport, 80, 0)).toBeUndefined();
  });
});
