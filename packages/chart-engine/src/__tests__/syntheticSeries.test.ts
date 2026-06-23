import { describe, expect, it } from "vitest";
import {
  transformHeikinAshi,
  transformKagi,
  transformLineBreak,
  transformPointAndFigure,
  transformRenko,
  type CandleSeries
} from "../index";

function createSeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: [
      { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100, turnover: 1100 },
      { time: 2, open: 11, high: 14, low: 10, close: 13, volume: 120, turnover: 1560 },
      { time: 3, open: 13, high: 15, low: 12, close: 12, volume: 90, turnover: 1080 },
      { time: 4, open: 12, high: 16, low: 11, close: 15, volume: 130, turnover: 1950 },
      { time: 5, open: 15, high: 17, low: 14, close: 16, volume: 110, turnover: 1760 }
    ]
  };
}

function createEmptySeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: []
  };
}

describe("synthetic series transforms", () => {
  it("creates Heikin Ashi points with source indexes", () => {
    const model = transformHeikinAshi(createSeries());

    expect(model.type).toBe("heikinAshi");
    expect(model.points).toHaveLength(5);
    expect(model.points[0].sourceIndex).toBe(0);
    expect(model.points[0].close).toBe(10.5);
  });

  it("creates Renko bricks with source ranges", () => {
    const model = transformRenko(createSeries(), { brickSize: 2 });

    expect(model.type).toBe("renko");
    expect(model.points.length).toBeGreaterThan(0);
    expect(model.points.every((point) => point.sourceRange)).toBe(true);
  });

  it("creates Line Break points with source traceability", () => {
    const model = transformLineBreak(createSeries(), { lineCount: 3 });

    expect(model.type).toBe("lineBreak");
    expect(model.points.length).toBeGreaterThan(0);
    expect(model.points.every((point) => point.sourceIndex !== undefined)).toBe(true);
  });

  it("creates Kagi points with source traceability", () => {
    const model = transformKagi(createSeries(), { reversalAmount: 2 });

    expect(model.type).toBe("kagi");
    expect(model.points.length).toBeGreaterThan(0);
    expect(model.points.every((point) => point.sourceIndex !== undefined)).toBe(true);
  });

  it("creates Point and Figure columns with source ranges", () => {
    const model = transformPointAndFigure(createSeries(), { boxSize: 1, reversalBoxes: 3 });

    expect(model.type).toBe("pointAndFigure");
    expect(model.points.length).toBeGreaterThan(0);
    expect(model.points.every((point) => point.sourceRange)).toBe(true);
  });

  it("returns empty models for empty source series", () => {
    const series = createEmptySeries();

    expect(transformHeikinAshi(series).points).toEqual([]);
    expect(transformRenko(series, { brickSize: 1 }).points).toEqual([]);
    expect(transformLineBreak(series, { lineCount: 3 }).points).toEqual([]);
    expect(transformKagi(series, { reversalAmount: 1 }).points).toEqual([]);
    expect(transformPointAndFigure(series, { boxSize: 1, reversalBoxes: 3 }).points).toEqual([]);
  });

  it("throws clear errors for invalid transform options", () => {
    const series = createSeries();

    expect(() => transformRenko(series, { brickSize: 0 })).toThrow("brickSize must be a positive number");
    expect(() => transformLineBreak(series, { lineCount: 0 })).toThrow("lineCount must be a positive integer");
    expect(() => transformKagi(series, { reversalAmount: 0 })).toThrow(
      "reversalAmount must be a positive number"
    );
    expect(() => transformPointAndFigure(series, { boxSize: 0, reversalBoxes: 3 })).toThrow(
      "boxSize must be a positive number"
    );
    expect(() => transformPointAndFigure(series, { boxSize: 1, reversalBoxes: 0 })).toThrow(
      "reversalBoxes must be a positive integer"
    );
  });

  it("does not mutate source candles", () => {
    const series = createSeries();
    const before = JSON.stringify(series);

    transformHeikinAshi(series);
    transformRenko(series, { brickSize: 2 });
    transformLineBreak(series, { lineCount: 3 });
    transformKagi(series, { reversalAmount: 2 });
    transformPointAndFigure(series, { boxSize: 1, reversalBoxes: 3 });

    expect(JSON.stringify(series)).toBe(before);
  });
});
