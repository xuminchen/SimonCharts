import { describe, expect, it, vi } from "vitest";
import {
  assertCandleSeries,
  defaultChartSettings,
  defaultChartTheme,
  findCandleByTime,
  fixtureDailyCandleSeries,
  getCandleAtIndex,
  isValidCandle,
  mergeChartSettings
} from "../index";
import type { CandleSeries, HostAdapter, ViewportState } from "../index";

describe("neutral engine model contracts", () => {
  it("creates a candle series without host business types", () => {
    const series: CandleSeries = {
      symbol: "TEST",
      timeframe: "1d",
      adjustMode: "none",
      dataVersion: "fixture-v1",
      candles: [
        {
          time: 1_718_582_400_000,
          open: 10,
          high: 12,
          low: 9,
          close: 11,
          volume: 1_000,
          turnover: 11_000
        }
      ]
    };

    expect(series.candles[0]).toEqual({
      time: 1_718_582_400_000,
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      volume: 1_000,
      turnover: 11_000
    });
    expect(defaultChartTheme.colors.background).toBeTypeOf("string");
  });

  it("lets a host adapter receive neutral viewport changes", () => {
    const viewport: ViewportState = {
      visibleRange: { from: 0, to: 99 },
      candleWidth: 8,
      scrollOffset: 0,
      priceScaleMode: "linear"
    };
    const onViewportChange = vi.fn();
    const adapter: HostAdapter = {
      onViewportChange
    };

    adapter.onViewportChange?.(viewport);

    expect(onViewportChange).toHaveBeenCalledWith(viewport);
  });

  it("provides a neutral daily candle fixture", () => {
    expect(Object.keys(fixtureDailyCandleSeries)).toEqual([
      "symbol",
      "timeframe",
      "adjustMode",
      "dataVersion",
      "candles"
    ]);
    expect(Object.keys(fixtureDailyCandleSeries.candles[0])).toEqual([
      "time",
      "open",
      "high",
      "low",
      "close",
      "volume",
      "turnover"
    ]);
    expect(fixtureDailyCandleSeries.symbol).toBe("SIMON");
    expect(fixtureDailyCandleSeries.timeframe).toBe("1d");
    expect(fixtureDailyCandleSeries.adjustMode).toBe("none");
    expect(fixtureDailyCandleSeries.dataVersion).toBe("fixture-2026-06-23");
    expect(fixtureDailyCandleSeries.candles.length).toBeGreaterThanOrEqual(120);
  });

  it("keeps fixture candle times strictly increasing", () => {
    for (let index = 1; index < fixtureDailyCandleSeries.candles.length; index += 1) {
      expect(fixtureDailyCandleSeries.candles[index].time).toBeGreaterThan(
        fixtureDailyCandleSeries.candles[index - 1].time
      );
    }
  });

  it("keeps fixture candle OHLC values within bounds", () => {
    for (const candle of fixtureDailyCandleSeries.candles) {
      expect(isValidCandle(candle)).toBe(true);
      expect(candle.low).toBeLessThanOrEqual(candle.open);
      expect(candle.low).toBeLessThanOrEqual(candle.high);
      expect(candle.low).toBeLessThanOrEqual(candle.close);
      expect(candle.open).toBeLessThanOrEqual(candle.high);
      expect(candle.close).toBeLessThanOrEqual(candle.high);
    }
  });

  it("finds a candle by exact time", () => {
    const candle = fixtureDailyCandleSeries.candles[42];

    expect(findCandleByTime(fixtureDailyCandleSeries, candle.time)).toBe(candle);
  });

  it("returns undefined for candle indexes outside bounds", () => {
    expect(getCandleAtIndex(fixtureDailyCandleSeries, -1)).toBeUndefined();
    expect(
      getCandleAtIndex(fixtureDailyCandleSeries, fixtureDailyCandleSeries.candles.length)
    ).toBeUndefined();
  });

  it("asserts candle series integrity with specific errors", () => {
    expect(() =>
      assertCandleSeries({
        ...fixtureDailyCandleSeries,
        candles: []
      })
    ).toThrow(new Error("Candle series must contain at least one candle"));

    expect(() =>
      assertCandleSeries({
        ...fixtureDailyCandleSeries,
        candles: [
          {
            time: 1,
            open: 10,
            high: 9,
            low: 8,
            close: 9,
            volume: 1,
            turnover: 9
          }
        ]
      })
    ).toThrow(new Error("Candle at index 0 has invalid OHLC bounds"));

    expect(() =>
      assertCandleSeries({
        ...fixtureDailyCandleSeries,
        candles: [
          fixtureDailyCandleSeries.candles[0],
          {
            ...fixtureDailyCandleSeries.candles[1],
            time: fixtureDailyCandleSeries.candles[0].time
          }
        ]
      })
    ).toThrow(new Error("Candle time must be strictly increasing at index 1"));
  });

  it("supports v0.1 chart settings without host business fields", () => {
    const settings = mergeChartSettings(defaultChartSettings, {
      themeMode: "dark",
      candleColorScheme: "aShare",
      gridVisible: false
    });

    expect(settings.themeMode).toBe("dark");
    expect(settings.candleColorScheme).toBe("aShare");
    expect(settings.gridVisible).toBe(false);
  });
});
