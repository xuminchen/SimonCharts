import type {
  IndicatorVisualOutput,
  SeriesRenderModel
} from "@simoncharts/chart-engine";
import { describe, expect, it } from "vitest";
import type { Candle, ChartIndicator, ChartSymbol } from "../contracts";
import type { ComparisonDataSnapshot } from "../data/comparisonCoordinator";
import { indicatorOutputId } from "../runtime/indicatorRuntime";
import { createDataTableSnapshot } from "../runtime/dataTable";

const symbol: ChartSymbol = {
  id: "SZSE:000001",
  code: "000001",
  name: "平安银行",
  exchange: "SZSE",
  kind: "stock",
  pricePrecision: 2
};

const candles: Candle[] = [
  { time: Date.UTC(2026, 6, 16), open: 10, high: 12, low: 9, close: 11, volume: 100, turnover: 1_100 },
  { time: Date.UTC(2026, 6, 17), open: 11, high: 13, low: 10, close: 12, volume: 200, turnover: 2_400 }
];

function snapshot(input: Partial<Parameters<typeof createDataTableSnapshot>[0]> = {}) {
  return createDataTableSnapshot({
    seriesType: "candles",
    timeframe: "1d",
    candles,
    pricePrecision: 2,
    locale: "zh-CN",
    indicators: [],
    studyOutputs: [],
    comparisons: [],
    visibleRange: { from: 0, to: 1 },
    ...input
  });
}

describe("data table snapshot", () => {
  it("uses the current render model and lists the newest row first", () => {
    const seriesModel: SeriesRenderModel = {
      type: "heikinAshi",
      source: { symbol, timeframe: "1d", candles },
      sourceIndexOffset: 0,
      points: [
        { time: candles[0]!.time, open: 20, high: 22, low: 19, close: 21 },
        { time: candles[1]!.time, open: 21, high: 23, low: 20, close: 22 }
      ]
    };

    const result = snapshot({ seriesType: "heikinAshi", seriesModel });

    expect(result.rows.map((row) => row.time)).toEqual([
      candles[1]!.time,
      candles[0]!.time
    ]);
    expect(result.rows[0]!.cells().slice(1, 5)).toEqual(["21.00", "23.00", "20.00", "22.00"]);
  });

  it("keeps the plotted high, low, and close values for HLC Area", () => {
    const result = snapshot({ seriesType: "hlcArea" });

    expect(result.columns.slice(1, 4).map((column) => column.id))
      .toEqual(["high", "low", "close"]);
    expect(result.columns.map((column) => column.id)).not.toContain("open");
    expect(result.rows[0]!.cells().slice(1, 4)).toEqual(["13.00", "10.00", "12.00"]);
  });

  it("includes only visible study outputs", () => {
    const indicators: ChartIndicator[] = [{
      instanceId: "ma",
      id: "MA",
      params: { period: 5 },
      visible: true
    }];
    const studyOutputs: IndicatorVisualOutput[] = [
      {
        id: indicatorOutputId("ma", "MA"),
        label: "MA",
        type: "line",
        values: candles.map((candle) => ({ time: candle.time, value: candle.close })),
        visible: true
      },
      {
        id: indicatorOutputId("ma", "hidden"),
        label: "Hidden",
        type: "line",
        values: candles.map((candle) => ({ time: candle.time, value: 999 })),
        visible: false
      }
    ];

    const result = snapshot({ indicators, studyOutputs });

    expect(result.columns.map((column) => column.id)).toContain("study:ma:MA");
    expect(result.columns.map((column) => column.id)).not.toContain("study:ma:hidden");
    expect(result.rows[0]!.cells().at(-1)).toBe("12");
  });

  it("adds each ready visible comparison once without changing row time", () => {
    const comparison: ComparisonDataSnapshot = {
      comparison: {
        symbol: { ...symbol, id: "SSE:000300", code: "000300", name: "沪深300" },
        visible: true,
        color: "#7c83ff"
      },
      status: "ready",
      candles: candles.map((candle) => ({ ...candle, close: candle.close * 2 })),
      dataVersion: "compare-v1"
    };

    const result = snapshot({ comparisons: [comparison] });

    expect(result.columns.at(-1)).toMatchObject({
      id: "comparison:SSE:000300",
      color: "#7c83ff"
    });
    expect(result.rows[0]!.time).toBe(candles[1]!.time);
    expect(result.rows[0]!.cells().at(-1)).toContain("24.00");
  });

  it("builds 20,000 rows and 32 columns without quadratic work", () => {
    const largeCandles = Array.from({ length: 20_000 }, (_, index): Candle => ({
      time: Date.UTC(2000, 0, 1) + index * 60_000,
      open: 10 + index / 100,
      high: 11 + index / 100,
      low: 9 + index / 100,
      close: 10.5 + index / 100,
      volume: index + 1,
      turnover: (index + 1) * 10
    }));
    const indicators = Array.from({ length: 23 }, (_, index): ChartIndicator => ({
      instanceId: `study-${index}`,
      id: "MA",
      params: { period: index + 1 },
      visible: true
    }));
    const studyOutputs = indicators.map((indicator, index): IndicatorVisualOutput => ({
      id: indicatorOutputId(indicator.instanceId, "MA"),
      label: `MA${index + 1}`,
      type: "line",
      values: largeCandles.map((candle) => ({ time: candle.time, value: candle.close }))
    }));
    const started = performance.now();

    const result = snapshot({ candles: largeCandles, indicators, studyOutputs });
    const firstBatchCellCount = result.rows
      .slice(0, 250)
      .reduce((count, row) => count + row.cells().length, 0);

    expect(result.columns).toHaveLength(32);
    expect(result.rows).toHaveLength(20_000);
    expect(firstBatchCellCount).toBe(8_000);
    expect(result.rows[0]!.time).toBe(largeCandles.at(-1)!.time);
    expect(performance.now() - started).toBeLessThan(3_000);
  });
});
