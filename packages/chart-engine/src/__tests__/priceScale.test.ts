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

  it("uses first visible close as percentage base", () => {
    const scale = createPriceScale(series, { from: 0, to: 1 }, "percentage");
    expect(scale.basePrice).toBe(100);
    expect(priceToScaleValue(110, scale)).toBeCloseTo(10, 8);
    expect(scaleValueToPrice(10, scale)).toBeCloseTo(110, 8);
    expect(formatPriceScaleTick(110, scale)).toBe("10.00%");
  });

  it("rejects non-positive values for log mode", () => {
    const invalid = structuredClone(series);
    invalid.candles[0].low = 0;
    expect(() => createPriceScale(invalid, { from: 0, to: 1 }, "log")).toThrow(
      "Log price scale requires positive prices"
    );
  });
});
