import { describe, expect, it } from "vitest";
import {
  createSourceSeriesRenderModel,
  getDefaultSeriesTooltipRows,
  getSeriesAutoscaleRange,
  hitTestSeriesPoint,
  type CandleSeries
} from "../index";
import { defaultChartTimeFormatter } from "../model/formatters";

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
  it("provides a host-neutral default time formatter", () => {
    expect(defaultChartTimeFormatter(1_725_000_000, "1m")).toBe("1725000000");
  });

  it("maps source candles to render points with source index traceability", () => {
    const model = createSourceSeriesRenderModel("candles", createSeries());

    expect(model.type).toBe("candles");
    expect(model.sourceIndexOffset).toBe(0);
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

  it("computes autoscale from high and low values", () => {
    const model = createSourceSeriesRenderModel("candles", createSeries());

    expect(getSeriesAutoscaleRange(model, { from: 0, to: 1 })).toEqual({ min: 9, max: 13 });
  });

  it("hit-tests the closest visible point by x distance", () => {
    const model = createSourceSeriesRenderModel("line", createSeries());
    const hit = hitTestSeriesPoint(model, 12, {
      plotLeft: 0,
      candleWidth: 10,
      visibleRange: { from: 0, to: 1 }
    });

    expect(hit?.point.sourceIndex).toBe(1);
    expect(hit?.sourceCandle?.time).toBe(2);
  });

  it("returns undefined for x before the visible series slots", () => {
    const model = createSourceSeriesRenderModel("line", createSeries());

    expect(
      hitTestSeriesPoint(model, -1, {
        plotLeft: 0,
        candleWidth: 10,
        visibleRange: { from: 0, to: 1 }
      })
    ).toBeUndefined();
  });

  it("returns undefined for x beyond the last visible series slot", () => {
    const model = createSourceSeriesRenderModel("line", createSeries());

    expect(
      hitTestSeriesPoint(model, 20, {
        plotLeft: 0,
        candleWidth: 10,
        visibleRange: { from: 0, to: 1 }
      })
    ).toBeUndefined();
  });

  it("returns undefined for nonpositive hit-test candle width", () => {
    const model = createSourceSeriesRenderModel("line", createSeries());

    expect(
      hitTestSeriesPoint(model, 0, {
        plotLeft: 0,
        candleWidth: 0,
        visibleRange: { from: 0, to: 1 }
      })
    ).toBeUndefined();
  });

  it("formats neutral tooltip rows from a hit-test result", () => {
    const model = createSourceSeriesRenderModel("candles", createSeries());
    const hit = hitTestSeriesPoint(model, 2, {
      plotLeft: 0,
      candleWidth: 10,
      visibleRange: { from: 0, to: 1 }
    });

    expect(
      hit
        ? getDefaultSeriesTooltipRows(hit, {
            formatTime: (time, timeframe) => `SH:${time}:${timeframe}`,
            timeframe: "1m"
          }).map((row) => row.label)
        : []
    ).toEqual([
      "Time",
      "Open",
      "High",
      "Low",
      "Close",
      "Volume",
      "Turnover"
    ]);
  });

  it("uses the host time formatter for the series tooltip time row", () => {
    const model = createSourceSeriesRenderModel("candles", createSeries());
    const hit = hitTestSeriesPoint(model, 2, {
      plotLeft: 0,
      candleWidth: 10,
      visibleRange: { from: 0, to: 1 }
    });

    expect(
      hit
        ? getDefaultSeriesTooltipRows(hit, {
            formatTime: (time, timeframe) => `SH:${time}:${timeframe}`,
            timeframe: "1m"
          })[0]
        : undefined
    ).toEqual({ label: "Time", value: "SH:1:1m" });
  });
});
