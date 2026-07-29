import { describe, expect, it } from "vitest";
import type { Candle, ChartComparison } from "../contracts";
import { createComparisonLineOutput } from "../runtime/comparisonProjection";

const comparison: ChartComparison = {
  symbol: {
    id: "stock:SZSE:000001",
    code: "000001",
    name: "平安银行",
    exchange: "SZSE",
    kind: "stock"
  },
  color: "#7c83ff",
  visible: true
};

const candle = (time: number, close: number): Candle => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1,
  turnover: close
});

describe("comparison projection", () => {
  it("normalizes each symbol from its own first visible exact-time value", () => {
    const output = createComparisonLineOutput({
      comparison,
      mainCandles: [candle(1, 100), candle(2, 101), candle(3, 102)],
      comparisonCandles: [candle(1, 10), candle(2, 11), candle(3, 9)],
      visibleRange: { from: 0, to: 2 }
    });

    expect(output).toMatchObject({
      id: "comparison:stock:SZSE:000001",
      type: "line",
      panelId: "main",
      color: "#7c83ff",
      coordinateSpace: "percentage"
    });
    expect(output.values).toEqual([
      { time: 1, value: 0 },
      { time: 2, value: 10.000000000000009 },
      { time: 3, value: -9.999999999999998 }
    ]);
  });

  it("re-bases when the visible window moves", () => {
    const output = createComparisonLineOutput({
      comparison,
      mainCandles: [candle(1, 100), candle(2, 101), candle(3, 102)],
      comparisonCandles: [candle(1, 10), candle(2, 11), candle(3, 12)],
      visibleRange: { from: 1, to: 2 }
    });

    expect(output.values).toHaveLength(2);
    expect(output.values[0]).toEqual({ time: 2, value: 0 });
    expect(output.values[1]!.value).toBeCloseTo(9.0909, 4);
  });

  it("keeps exact-time gaps as null and never forward-fills", () => {
    const output = createComparisonLineOutput({
      comparison,
      mainCandles: [candle(1, 100), candle(2, 101), candle(3, 102)],
      comparisonCandles: [candle(1, 10), candle(3, 12)],
      visibleRange: { from: 0, to: 2 }
    });

    expect(output.values).toEqual([
      { time: 1, value: 0 },
      { time: 2, value: null },
      { time: 3, value: 19.999999999999996 }
    ]);
  });

  it("uses the trusted intraday previous close when provided", () => {
    const output = createComparisonLineOutput({
      comparison,
      mainCandles: [candle(1, 100), candle(2, 101)],
      comparisonCandles: [candle(1, 10.5), candle(2, 11)],
      visibleRange: { from: 0, to: 1 },
      previousClose: 10
    });

    expect(output.values[0]!.value).toBeCloseTo(5, 8);
    expect(output.values[1]!.value).toBeCloseTo(10, 8);
  });

  it("fails closed when no finite positive base exists", () => {
    const output = createComparisonLineOutput({
      comparison,
      mainCandles: [candle(1, 100), candle(2, 101)],
      comparisonCandles: [candle(1, 0), candle(2, -1)],
      visibleRange: { from: 0, to: 1 }
    });

    expect(output.values).toEqual([
      { time: 1, value: null },
      { time: 2, value: null }
    ]);
  });
});
