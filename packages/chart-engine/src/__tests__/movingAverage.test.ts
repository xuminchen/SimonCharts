import { describe, expect, it } from "vitest";
import {
  calculateDefaultMovingAverages,
  calculateMovingAverage
} from "../index";
import { fixtureDailyCandleSeries } from "./fixtures/dailyCandles";

describe("moving average calculation", () => {
  it("returns undefined until enough candles exist for MA5", () => {
    const result = calculateMovingAverage(fixtureDailyCandleSeries, 5);

    expect(result.slice(0, 4).map((point) => point.value)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined
    ]);
    expect(result[4]).toEqual({
      time: fixtureDailyCandleSeries.candles[4].time,
      value: 99.76
    });
  });

  it("returns deterministic default moving averages from fixture data", () => {
    const result = calculateDefaultMovingAverages(fixtureDailyCandleSeries);

    expect(result.MA10[9].value).toBeCloseTo(101.173);
    expect(result.MA20[19].value).toBeCloseTo(103.058);
    expect(result.MA60[59].value).toBeCloseTo(110.213);
    expect(result.MA5[119].value).toBeCloseTo(141.622);
    expect(result.MA10[119].value).toBeCloseTo(140.209);
    expect(result.MA20[119].value).toBeCloseTo(138.401);
    expect(result.MA60[119].value).toBeCloseTo(131.246);
  });

  it("returns one output point per candle", () => {
    const result = calculateMovingAverage(fixtureDailyCandleSeries, 20);

    expect(result).toHaveLength(fixtureDailyCandleSeries.candles.length);
    expect(result.map((point) => point.time)).toEqual(
      fixtureDailyCandleSeries.candles.map((candle) => candle.time)
    );
  });

  it("throws when period is not greater than zero", () => {
    expect(() => calculateMovingAverage(fixtureDailyCandleSeries, 0)).toThrow(
      new Error("Moving average period must be greater than 0")
    );
    expect(() => calculateMovingAverage(fixtureDailyCandleSeries, -5)).toThrow(
      new Error("Moving average period must be greater than 0")
    );
  });

  it("throws when period is not a finite integer", () => {
    expect(() => calculateMovingAverage(fixtureDailyCandleSeries, 1.5)).toThrow(
      new Error("Moving average period must be a finite integer")
    );
    expect(() => calculateMovingAverage(fixtureDailyCandleSeries, NaN)).toThrow(
      new Error("Moving average period must be a finite integer")
    );
    expect(() => calculateMovingAverage(fixtureDailyCandleSeries, Infinity)).toThrow(
      new Error("Moving average period must be a finite integer")
    );
  });
});
