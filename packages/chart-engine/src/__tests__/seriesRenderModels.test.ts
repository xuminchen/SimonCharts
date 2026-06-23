import { describe, expect, it } from "vitest";
import { createSourceSeriesRenderModel, type CandleSeries } from "../index";

function createSeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: [
      { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100, turnover: 1100 },
      { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 120, turnover: 1440 }
    ]
  };
}

describe("source series render model", () => {
  it("maps source candles to render points with source index traceability", () => {
    const model = createSourceSeriesRenderModel("candles", createSeries());

    expect(model.type).toBe("candles");
    expect(model.points).toEqual([
      { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100, turnover: 1100, sourceIndex: 0 },
      { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 120, turnover: 1440, sourceIndex: 1 }
    ]);
  });

  it("does not mutate source candles", () => {
    const series = createSeries();
    const before = JSON.stringify(series);

    createSourceSeriesRenderModel("line", series);

    expect(JSON.stringify(series)).toBe(before);
  });
});
