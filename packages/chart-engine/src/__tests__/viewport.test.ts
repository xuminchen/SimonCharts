import { describe, expect, it } from "vitest";
import {
  computeVisiblePriceRange,
  computeVisibleRange,
  createInitialViewport,
  indexToX,
  panViewportByPixels,
  priceToY,
  resetViewportToLatest,
  zoomViewportAtIndex,
  xToIndex,
  yToPrice
} from "../index";
import type { CandleSeries, ViewportState } from "../index";

function createSeries(highLowPairs: Array<[number, number]>): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: highLowPairs.map(([high, low], index) => ({
      time: index,
      open: low,
      high,
      low,
      close: high,
      volume: 1,
      turnover: high
    }))
  };
}

describe("viewport coordinate mapping", () => {
  it("computes the visible candle range from count, candle width, scroll offset, and width", () => {
    const viewport: ViewportState = {
      visibleRange: { from: 0, to: 0 },
      candleWidth: 10,
      scrollOffset: 5,
      priceScaleMode: "linear"
    };

    expect(computeVisibleRange(viewport, 100, 200)).toEqual({ from: 75, to: 94 });
    expect(computeVisibleRange(viewport, 8, 200)).toEqual({ from: 0, to: 7 });
    expect(computeVisibleRange(viewport, 0, 200)).toEqual({ from: 0, to: -1 });
    expect(computeVisibleRange({ ...viewport, scrollOffset: -5 }, 100, 200)).toEqual({
      from: 80,
      to: 99
    });
    expect(computeVisibleRange({ ...viewport, scrollOffset: 500 }, 100, 200)).toEqual({
      from: 0,
      to: 19
    });
  });

  it("creates an initial viewport aligned to the latest candles", () => {
    expect(createInitialViewport(100, 200)).toEqual({
      visibleRange: { from: 75, to: 99 },
      candleWidth: 8,
      scrollOffset: 0,
      priceScaleMode: "linear"
    });
  });

  it("maps candle index to the candle center x coordinate", () => {
    const viewport: ViewportState = {
      visibleRange: { from: 10, to: 20 },
      candleWidth: 8,
      scrollOffset: 0,
      priceScaleMode: "linear"
    };

    expect(indexToX(10, viewport, 40)).toBe(44);
    expect(indexToX(13, viewport, 40)).toBe(68);
    expect(xToIndex(68, viewport, 40)).toBe(13);
  });

  it("uses normalized candle width for x mapping", () => {
    const zeroWidthViewport: ViewportState = {
      visibleRange: { from: 10, to: 20 },
      candleWidth: 0,
      scrollOffset: 0,
      priceScaleMode: "linear"
    };
    const negativeWidthViewport: ViewportState = {
      ...zeroWidthViewport,
      candleWidth: -4
    };

    expect(indexToX(10, zeroWidthViewport, 40)).toBe(40.5);
    expect(xToIndex(40.5, zeroWidthViewport, 40)).toBe(10);
    expect(Number.isFinite(indexToX(13, zeroWidthViewport, 40))).toBe(true);
    expect(Number.isFinite(xToIndex(43.5, zeroWidthViewport, 40))).toBe(true);
    expect(indexToX(10, negativeWidthViewport, 40)).toBe(40.5);
    expect(xToIndex(40.5, negativeWidthViewport, 40)).toBe(10);
  });

  it("maps max price to top plot area and min price to bottom plot area", () => {
    const priceRange = { min: 100, max: 200 };

    expect(priceToY(200, priceRange, 20, 400, "linear")).toBe(20);
    expect(priceToY(100, priceRange, 20, 400, "linear")).toBe(420);
    expect(yToPrice(20, priceRange, 20, 400, "linear")).toBe(200);
    expect(yToPrice(420, priceRange, 20, 400, "linear")).toBe(100);
  });

  it("computes visible price range from visible candles with deterministic padding", () => {
    const series = createSeries([
      [110, 100],
      [130, 90],
      [160, 120],
      [140, 80],
      [125, 105]
    ]);

    expect(computeVisiblePriceRange(series, { from: 1, to: 3 })).toEqual({
      min: 76,
      max: 164
    });
  });

  it("clamps visible indexes and keeps flat data non-zero", () => {
    const series = createSeries([
      [100, 100],
      [100, 100]
    ]);

    expect(computeVisiblePriceRange(series, { from: -10, to: 10 })).toEqual({
      min: 95,
      max: 105
    });
  });

  it("accepts log and percentage scale modes in types but rejects them for coordinate mapping in M1", () => {
    const priceRange = { min: 100, max: 200 };

    expect(() => priceToY(150, priceRange, 20, 400, "log")).toThrow(
      new Error("Price scale mode is not implemented: log")
    );
    expect(() => yToPrice(220, priceRange, 20, 400, "percentage")).toThrow(
      new Error("Price scale mode is not implemented: percentage")
    );
  });

  it("zooms around an anchor index and keeps the anchor visible", () => {
    const viewport = createInitialViewport(100, 200);
    const anchorIndex = viewport.visibleRange.from + 8;

    const zoomedIn = zoomViewportAtIndex(viewport, anchorIndex, -100, 100);
    expect(zoomedIn.candleWidth).toBeGreaterThan(viewport.candleWidth);
    expect(zoomedIn.visibleRange.from).toBeLessThanOrEqual(anchorIndex);
    expect(zoomedIn.visibleRange.to).toBeGreaterThanOrEqual(anchorIndex);

    const zoomedOut = zoomViewportAtIndex(zoomedIn, anchorIndex, 100, 100);
    expect(zoomedOut.candleWidth).toBeLessThan(zoomedIn.candleWidth);
    expect(zoomedOut.visibleRange.from).toBeLessThanOrEqual(anchorIndex);
    expect(zoomedOut.visibleRange.to).toBeGreaterThanOrEqual(anchorIndex);
  });

  it("pans by whole candle deltas and clamps to available data", () => {
    const viewport = createInitialViewport(100, 200);
    const pannedOlder = panViewportByPixels(viewport, viewport.candleWidth * 4, 100);

    expect(pannedOlder.scrollOffset).toBe(4);
    expect(pannedOlder.visibleRange).toEqual({ from: 71, to: 95 });

    const clampedOlder = panViewportByPixels(viewport, viewport.candleWidth * 500, 100);
    expect(clampedOlder.visibleRange).toEqual({ from: 0, to: 24 });

    const clampedLatest = panViewportByPixels(pannedOlder, -viewport.candleWidth * 500, 100);
    expect(clampedLatest.visibleRange).toEqual(viewport.visibleRange);
  });

  it("resets the viewport to latest candles", () => {
    expect(resetViewportToLatest(100, 200)).toEqual(createInitialViewport(100, 200));
  });
});
