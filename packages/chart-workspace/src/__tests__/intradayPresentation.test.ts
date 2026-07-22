import { hitTestCandleAtX, type CandleSeries, type ViewportState } from "@simoncharts/chart-engine";
import { describe, expect, it } from "vitest";
import type { Candle } from "../contracts";
import {
  calculateFixedIntradayPercentExtent,
  calculateIntradayAverage,
  createIntradayTimeCoordinates
} from "../runtime/intradayPresentation";

function candle(time: number, volume: number, turnover: number): Candle {
  return { time, open: 10, high: 10, low: 10, close: 10, volume, turnover };
}

describe("intraday presentation", () => {
  it("keeps the nominal daily limit unless real highs or lows exceed it", () => {
    const point = candle(Date.UTC(2026, 6, 17, 1, 30), 1, 10);

    expect(calculateFixedIntradayPercentExtent([
      { ...point, high: 10.61, low: 8.69 }
    ], 9.65, 10)).toBe(10);
    expect(calculateFixedIntradayPercentExtent([
      { ...point, high: 10.62, low: 9.65 }
    ], 9.65, 10)).toBeCloseTo(10.2);
    expect(calculateFixedIntradayPercentExtent([
      { ...point, high: 9.65, low: 8.68 }
    ], 9.65, 10)).toBeCloseTo(10.2);
  });

  it("calculates the cumulative intraday average and resets it on every Shanghai trading day", () => {
    const firstDay = Date.UTC(2026, 6, 15, 1, 30);
    const secondDay = Date.UTC(2026, 6, 16, 1, 30);

    expect(calculateIntradayAverage([
      candle(firstDay, 0, 0),
      candle(firstDay + 60_000, 100, 1_000),
      candle(firstDay + 120_000, 100, 1_200),
      candle(secondDay, 200, 4_000),
      candle(secondDay + 60_000, 0, 0)
    ])).toEqual([
      { time: firstDay, value: undefined },
      { time: firstDay + 60_000, value: 10 },
      { time: firstDay + 120_000, value: 11 },
      { time: secondDay, value: 20 },
      { time: secondDay + 60_000, value: 20 }
    ]);
  });

  it("gives each real trading day the same slot without adding missing candles", () => {
    const firstDay = Date.UTC(2026, 6, 15, 1, 30);
    const secondDay = Date.UTC(2026, 6, 16, 1, 30);
    const candles = [
      candle(firstDay, 1, 10),
      candle(firstDay + 330 * 60_000, 1, 10),
      candle(secondDay, 1, 10),
      candle(secondDay + 60 * 60_000, 1, 10),
      candle(secondDay + 210 * 60_000, 1, 10),
      candle(secondDay + 330 * 60_000, 1, 10)
    ];

    const coordinates = createIntradayTimeCoordinates(candles, 400);

    expect(coordinates?.positions).toHaveLength(candles.length);
    expect(coordinates?.dayStartIndices).toEqual([0, 2]);
    expect(coordinates?.dayStartOffsets).toEqual([0, 200]);
    expect(coordinates?.positions[0]).toBeCloseTo(0.4132, 4);
    expect(coordinates?.positions[1]).toBeCloseTo(199.5868, 4);
    expect(coordinates?.positions[2]).toBeCloseTo(200.4132, 4);
    expect(coordinates?.positions[3]).toBeCloseTo(250, 4);
    expect(coordinates?.positions[4]).toBeCloseTo(300.4132, 4);
    expect(coordinates?.positions[5]).toBeCloseTo(399.5868, 4);
    expect(coordinates!.positions[1]).toBeLessThan(coordinates!.positions[2]);

    const series: CandleSeries = {
      symbol: "stock:SZSE:000001",
      timeframe: "1m",
      adjustMode: "none",
      dataVersion: "real",
      candles
    };
    const viewport: ViewportState = {
      visibleRange: { from: 0, to: candles.length - 1 },
      candleWidth: 1,
      scrollOffset: 0,
      priceScaleMode: "percentage"
    };
    expect(hitTestCandleAtX(series, viewport, coordinates!.positions[1], 0, coordinates)?.index)
      .toBe(1);
    expect(hitTestCandleAtX(series, viewport, coordinates!.positions[2], 0, coordinates)?.index)
      .toBe(2);
  });

  it("keeps the morning close and afternoon open in separate minute slots", () => {
    const day = Date.UTC(2026, 6, 16, 1, 30);
    const coordinates = createIntradayTimeCoordinates([
      candle(day + 120 * 60_000, 1, 10),
      candle(day + 210 * 60_000, 1, 10)
    ], 242);

    expect(coordinates?.positions).toEqual([120.5, 121.5]);
  });
});
