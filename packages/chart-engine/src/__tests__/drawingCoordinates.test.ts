import { describe, expect, it } from "vitest";
import {
  createPriceScale,
  drawingPointFromPointer,
  indexToX,
  priceToY,
  projectDrawingObject,
  unprojectDrawingObject,
  yToPrice,
  type CandleSeries,
  type DrawingCoordinateContext,
  type DrawingObject,
  type PriceScaleMode,
  type ViewportState
} from "../index";

const series: CandleSeries = {
  symbol: "TEST",
  timeframe: "1d",
  adjustMode: "none",
  dataVersion: "v1",
  candles: [
    { time: 100, open: 90, high: 110, low: 80, close: 100, volume: 1, turnover: 100 },
    { time: 200, open: 180, high: 220, low: 160, close: 200, volume: 1, turnover: 200 },
    { time: 300, open: 270, high: 330, low: 240, close: 300, volume: 1, turnover: 300 }
  ]
};

function createContext(
  candleSeries: CandleSeries,
  mode: PriceScaleMode = "linear",
  options: {
    viewport?: Partial<ViewportState>;
    plotArea?: DrawingCoordinateContext["plotArea"];
  } = {}
): DrawingCoordinateContext {
  const viewport = {
    visibleRange: options.viewport?.visibleRange ?? {
      from: 0,
      to: candleSeries.candles.length - 1
    },
    candleWidth: 20,
    scrollOffset: 0,
    priceScaleMode: mode,
    ...options.viewport
  };

  return {
    series: candleSeries,
    viewport,
    plotArea: options.plotArea ?? { x: 40, y: 20, width: 300, height: 200 },
    priceScale: createPriceScale(candleSeries, viewport.visibleRange, mode)
  };
}

describe("drawing coordinates", () => {
  it("projects canonical time and price into finite screen coordinates", () => {
    const drawing: DrawingObject = {
      id: "domain-line",
      type: "trendLine",
      anchors: [
        { time: 100, price: 100 },
        { time: 200, price: 200 }
      ]
    };

    const projected = projectDrawingObject(drawing, createContext(series));

    expect(projected.anchors[0].time).toBe(100);
    expect(projected.anchors[0].price).toBe(100);
    expect(Number.isFinite(projected.anchors[0].x)).toBe(true);
    expect(Number.isFinite(projected.anchors[0].y)).toBe(true);
  });

  it("uses the shared linear, log, and percentage scales without rewriting domain values", () => {
    const drawing: DrawingObject = {
      id: "scale-line",
      type: "trendLine",
      anchors: [{ time: 200, price: 200 }]
    };

    const projected = (["linear", "log", "percentage"] as const).map((mode) => {
      const context = createContext(series, mode);
      const result = projectDrawingObject(drawing, context);
      const anchor = result.anchors[0];

      expect(anchor.time).toBe(200);
      expect(anchor.price).toBe(200);
      expect(anchor.y).toBe(
        priceToY(200, context.priceScale, context.plotArea.y, context.plotArea.height)
      );
      expect(Number.isFinite(anchor.x)).toBe(true);
      expect(Number.isFinite(anchor.y)).toBe(true);

      return anchor;
    });

    expect(projected[0].y).not.toBe(projected[1].y);
  });

  it("moves transient x on pan and zoom while keeping canonical time and price stable", () => {
    const drawing: DrawingObject = {
      id: "viewport-line",
      type: "trendLine",
      anchors: [{ time: 200, price: 200 }]
    };
    const base = projectDrawingObject(drawing, createContext(series));
    const panned = projectDrawingObject(
      drawing,
      createContext(series, "linear", {
        viewport: { visibleRange: { from: 1, to: 2 }, scrollOffset: 1 }
      })
    );
    const zoomed = projectDrawingObject(
      drawing,
      createContext(series, "linear", { viewport: { candleWidth: 40 } })
    );

    expect(panned.anchors[0].x).not.toBe(base.anchors[0].x);
    expect(zoomed.anchors[0].x).not.toBe(base.anchors[0].x);
    for (const result of [base, panned, zoomed]) {
      expect(result.anchors[0].time).toBe(200);
      expect(result.anchors[0].price).toBe(200);
    }
  });

  it("prefers exact time, ignores persisted index, and drops stale coordinate fields", () => {
    const context = createContext(series);
    const drawing: DrawingObject = {
      id: "exact-time",
      type: "trendLine",
      anchors: [{ time: 200, price: 190, index: 0, x: -999, y: -999 }]
    };

    const anchor = projectDrawingObject(drawing, context).anchors[0];

    expect(anchor).toEqual({
      time: 200,
      price: 190,
      x: indexToX(1, context.viewport, context.plotArea.x),
      y: priceToY(190, context.priceScale, context.plotArea.y, context.plotArea.height)
    });
    expect("index" in anchor).toBe(false);
  });

  it("uses nearest candle time only for x fallback and resolves equal-distance ties first", () => {
    const context = createContext(series);
    const drawing: DrawingObject = {
      id: "nearest-time",
      type: "trendLine",
      anchors: [
        { time: 240, price: 180, index: 2 },
        { time: 250, price: 180, index: 2 },
        { time: 999, price: 180, index: 0 }
      ]
    };

    const anchors = projectDrawingObject(drawing, context).anchors;

    expect(anchors.map((anchor) => anchor.time)).toEqual([240, 250, 999]);
    expect(anchors.map((anchor) => anchor.x)).toEqual([
      indexToX(1, context.viewport, context.plotArea.x),
      indexToX(1, context.viewport, context.plotArea.x),
      indexToX(2, context.viewport, context.plotArea.x)
    ]);
    expect(anchors.every((anchor) => !("index" in anchor))).toBe(true);
  });

  it("reprojects by time across timeframes without trusting the prior candle index", () => {
    const weeklySeries: CandleSeries = {
      ...series,
      timeframe: "1w",
      candles: [series.candles[0], { ...series.candles[2], time: 260 }]
    };
    const context = createContext(weeklySeries);
    const drawing: DrawingObject = {
      id: "cross-timeframe",
      type: "trendLine",
      anchors: [{ time: 200, price: 200, index: 0 }]
    };

    const anchor = projectDrawingObject(drawing, context).anchors[0];

    expect(anchor.time).toBe(200);
    expect(anchor.price).toBe(200);
    expect(anchor.x).toBe(indexToX(1, context.viewport, context.plotArea.x));
    expect("index" in anchor).toBe(false);
  });

  it("deeply isolates the output and preserves drawing metadata and style", () => {
    const drawing: DrawingObject = {
      id: "isolated-line",
      type: "trendLine",
      anchors: [{ time: 100, price: 100 }],
      style: { color: "#123456", lineDash: [2, 4] },
      text: "note",
      visible: true,
      locked: false,
      zIndex: 3,
      metadata: { nested: { labels: ["original"] } }
    };
    const context = createContext(series);
    const drawingBefore = structuredClone(drawing);
    const contextBefore = structuredClone(context);

    const projected = projectDrawingObject(drawing, context);

    expect(projected).toMatchObject({
      id: drawing.id,
      type: drawing.type,
      style: drawing.style,
      text: drawing.text,
      visible: drawing.visible,
      locked: drawing.locked,
      zIndex: drawing.zIndex,
      metadata: drawing.metadata
    });
    expect(projected).not.toBe(drawing);
    expect(projected.anchors).not.toBe(drawing.anchors);
    expect(projected.style).not.toBe(drawing.style);
    expect(projected.style?.lineDash).not.toBe(drawing.style?.lineDash);
    expect(projected.metadata).not.toBe(drawing.metadata);

    projected.style?.lineDash?.push(8);
    const nested = projected.metadata?.nested as { labels: string[] };
    nested.labels.push("changed");

    expect(drawing).toEqual(drawingBefore);
    expect(context).toEqual(contextBefore);
  });

  it("keeps empty-series and zero-sized plot projection geometry finite", () => {
    const emptySeries: CandleSeries = { ...series, candles: [] };
    const context = createContext(emptySeries, "linear", {
      viewport: { candleWidth: 0 },
      plotArea: { x: 12, y: 34, width: 0, height: 0 }
    });
    const drawing: DrawingObject = {
      id: "empty",
      type: "trendLine",
      anchors: [{ time: 200, price: 0.5, index: 99 }]
    };

    const anchor = projectDrawingObject(drawing, context).anchors[0];

    expect(anchor.time).toBe(200);
    expect(anchor.price).toBe(0.5);
    expect(Number.isFinite(anchor.x)).toBe(true);
    expect(Number.isFinite(anchor.y)).toBe(true);
    expect(anchor.y).toBe(context.plotArea.y);
    expect("index" in anchor).toBe(false);
  });

  it("round-trips domain anchors exactly through all three scale projections", () => {
    const drawing: DrawingObject = {
      id: "round-trip",
      type: "trendLine",
      anchors: [{ time: 200, price: 200 }],
      metadata: { source: { name: "canonical" } }
    };

    for (const mode of ["linear", "log", "percentage"] as const) {
      const context = createContext(series, mode);
      const projected = projectDrawingObject(drawing, context);
      const canonical = unprojectDrawingObject(projected, context);

      expect(canonical.anchors).toEqual([{ time: 200, price: 200 }]);
      expect(canonical.metadata).toEqual(drawing.metadata);
      expect(canonical.metadata).not.toBe(drawing.metadata);
    }
  });

  it("maps edited screen coordinates to nearest candle time and absolute price", () => {
    const drawing: DrawingObject = {
      id: "edited",
      type: "trendLine",
      anchors: [{ time: 100, price: 100 }]
    };

    for (const mode of ["linear", "log", "percentage"] as const) {
      const context = createContext(series, mode);
      const projected = projectDrawingObject(drawing, context);
      projected.anchors[0] = {
        ...projected.anchors[0],
        index: 0,
        x: indexToX(2, context.viewport, context.plotArea.x),
        y: priceToY(150, context.priceScale, context.plotArea.y, context.plotArea.height)
      };

      const canonical = unprojectDrawingObject(projected, context).anchors[0];

      expect(canonical.time).toBe(300);
      expect(canonical.price).toBeCloseTo(150, 8);
      expect("x" in canonical).toBe(false);
      expect("y" in canonical).toBe(false);
      expect("index" in canonical).toBe(false);
    }
  });

  it("snaps an edited cross-timeframe anchor to the current series candle time", () => {
    const weeklySeries: CandleSeries = {
      ...series,
      timeframe: "1w",
      candles: [series.candles[0], { ...series.candles[2], time: 260 }]
    };
    const context = createContext(weeklySeries, "log");
    const drawing: DrawingObject = {
      id: "weekly-edit",
      type: "trendLine",
      anchors: [{ time: 200, price: 200, index: 0 }]
    };
    const projected = projectDrawingObject(drawing, context);

    const canonical = unprojectDrawingObject(projected, context);

    expect(canonical.anchors).toEqual([{ time: 260, price: 200 }]);
  });

  it("clamps edited x to the first and last available candles", () => {
    const context = createContext(series);
    const drawing: DrawingObject = {
      id: "clamped-edit",
      type: "trendLine",
      anchors: [
        { x: context.plotArea.x - 10_000, y: context.plotArea.y },
        {
          x: context.plotArea.x + context.plotArea.width + 10_000,
          y: context.plotArea.y + context.plotArea.height
        }
      ]
    };

    const anchors = unprojectDrawingObject(drawing, context).anchors;

    expect(anchors[0].time).toBe(100);
    expect(anchors[1].time).toBe(300);
    expect(anchors.every((anchor) => Number.isFinite(anchor.price))).toBe(true);
  });

  it("does not invent a fallback time for an empty series and keeps zero-height price finite", () => {
    const emptySeries: CandleSeries = { ...series, candles: [] };
    const context = createContext(emptySeries, "linear", {
      plotArea: { x: 12, y: 34, width: 0, height: 0 }
    });
    const drawing: DrawingObject = {
      id: "empty-edit",
      type: "trendLine",
      anchors: [{ time: 777, index: 99, x: -100, y: 999 }],
      style: { lineDash: [1, 2] },
      metadata: { nested: { value: 1 } }
    };
    const before = structuredClone(drawing);

    const canonical = unprojectDrawingObject(drawing, context);
    const anchor = canonical.anchors[0];

    expect(anchor.time).toBeUndefined();
    expect(Number.isFinite(anchor.price)).toBe(true);
    expect("x" in anchor).toBe(false);
    expect("y" in anchor).toBe(false);
    expect("index" in anchor).toBe(false);
    expect(canonical.style).not.toBe(drawing.style);
    expect(canonical.style?.lineDash).not.toBe(drawing.style?.lineDash);
    expect(canonical.metadata).not.toBe(drawing.metadata);
    expect(drawing).toEqual(before);
  });

  it("returns the same pointer x and y with nearest candle time and absolute price", () => {
    const pointer = { x: 70, y: 90 };

    for (const mode of ["linear", "log", "percentage"] as const) {
      const context = createContext(series, mode);
      const contextBefore = structuredClone(context);

      const point = drawingPointFromPointer(pointer, context);

      expect(point.x).toBe(pointer.x);
      expect(point.y).toBe(pointer.y);
      expect(point.time).toBe(200);
      expect(point.price).toBeCloseTo(
        yToPrice(pointer.y, context.priceScale, context.plotArea.y, context.plotArea.height),
        8
      );
      expect(Number.isFinite(point.price)).toBe(true);
      expect(context).toEqual(contextBefore);
    }
  });

  it("clamps pointer time to candle bounds without clamping its screen position or price", () => {
    const context = createContext(series);
    const leftPointer = { x: context.plotArea.x - 10_000, y: context.plotArea.y - 25 };
    const rightPointer = {
      x: context.plotArea.x + context.plotArea.width + 10_000,
      y: context.plotArea.y + context.plotArea.height + 25
    };

    const left = drawingPointFromPointer(leftPointer, context);
    const right = drawingPointFromPointer(rightPointer, context);

    expect(left).toEqual({
      ...leftPointer,
      time: 100,
      price: yToPrice(
        leftPointer.y,
        context.priceScale,
        context.plotArea.y,
        context.plotArea.height
      )
    });
    expect(right).toEqual({
      ...rightPointer,
      time: 300,
      price: yToPrice(
        rightPointer.y,
        context.priceScale,
        context.plotArea.y,
        context.plotArea.height
      )
    });
    expect(left.price).toBeGreaterThan(
      yToPrice(context.plotArea.y, context.priceScale, context.plotArea.y, context.plotArea.height)
    );
    expect(right.price).toBeLessThan(
      yToPrice(
        context.plotArea.y + context.plotArea.height,
        context.priceScale,
        context.plotArea.y,
        context.plotArea.height
      )
    );
  });

  it("uses xToIndex candle cells for pointer nearest-time ties", () => {
    const context = createContext(series);

    expect(drawingPointFromPointer({ x: 59.999, y: 100 }, context).time).toBe(100);
    expect(drawingPointFromPointer({ x: 60, y: 100 }, context).time).toBe(200);
  });

  it("keeps an empty-series zero-height pointer finite without inventing time", () => {
    const emptySeries: CandleSeries = { ...series, candles: [] };
    const context = createContext(emptySeries, "linear", {
      viewport: { candleWidth: 0 },
      plotArea: { x: 12, y: 34, width: 0, height: 0 }
    });
    const pointer = { x: -500, y: 999 };

    const point = drawingPointFromPointer(pointer, context);

    expect(point.x).toBe(pointer.x);
    expect(point.y).toBe(pointer.y);
    expect(point.time).toBeUndefined();
    expect(Number.isFinite(point.price)).toBe(true);
  });
});
