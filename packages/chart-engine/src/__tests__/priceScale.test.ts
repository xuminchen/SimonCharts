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

  it("maps prices bottom-to-top when the scale is inverted", () => {
    const scale = {
      ...createPriceScale(series, { from: 0, to: 1 }, "linear"),
      inverted: true
    };

    expect(priceToY(scaleValueToPrice(scale.min, scale), scale, 20, 400)).toBe(20);
    expect(priceToY(scaleValueToPrice(scale.max, scale), scale, 20, 400)).toBe(420);
    expect(yToPrice(20, scale, 20, 400)).toBeCloseTo(
      scaleValueToPrice(scale.min, scale),
      8
    );
    expect(yToPrice(420, scale, 20, 400)).toBeCloseTo(
      scaleValueToPrice(scale.max, scale),
      8
    );
  });

  for (const mode of ["linear", "log", "percentage"] as const) {
    it(`maps a zero-height ${mode} plot to the upper scale bound`, () => {
      const scale = createPriceScale(series, { from: 0, to: 1 }, mode);
      const price = yToPrice(20, scale, 20, 0);

      expect(Number.isFinite(price)).toBe(true);
      expect(price).toBeCloseTo(scaleValueToPrice(scale.max, scale), 8);
    });
  }

  it("uses first visible close as percentage base", () => {
    const scale = createPriceScale(series, { from: 0, to: 1 }, "percentage");
    expect(scale.basePrice).toBe(100);
    expect(priceToScaleValue(110, scale)).toBeCloseTo(10, 8);
    expect(scaleValueToPrice(10, scale)).toBeCloseTo(110, 8);
    expect(formatPriceScaleTick(110, scale)).toBe("+10.00%");
  });

  it("clamps the percentage base index to available candles", () => {
    const beforeStart = createPriceScale(series, { from: -99, to: 0 }, "percentage");
    expect(beforeStart.basePrice).toBe(100);
    expect(priceToScaleValue(100, beforeStart)).toBe(0);

    const afterEnd = createPriceScale(series, { from: 99, to: 100 }, "percentage");
    expect(afterEnd.basePrice).toBe(200);
    expect(priceToScaleValue(200, afterEnd)).toBe(0);
  });

  it("rejects non-positive values for log mode", () => {
    const invalid = structuredClone(series);
    invalid.candles[0].low = 0;
    expect(() => createPriceScale(invalid, { from: 0, to: 1 }, "log")).toThrow(
      "Log price scale requires positive prices"
    );
  });
});
