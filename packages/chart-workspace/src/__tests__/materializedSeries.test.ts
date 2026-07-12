import { describe, expect, it } from "vitest";
import type { Candle, ChartSymbol } from "../index";
import { materializeSeriesAroundTime } from "../data/materializedSeries";
import { createPagedSeriesStore, type SeriesSelection } from "../data/pagedSeriesStore";
import type { ValidatedSeriesPage } from "../data/seriesPageValidation";

const symbol: ChartSymbol = {
  id: "SSE:600000",
  code: "600000",
  name: "浦发银行",
  exchange: "SSE",
  kind: "stock"
};
const selection: SeriesSelection = { symbol, timeframe: "1m", adjustMode: "forward" };

function candle(time: number): Candle {
  const close = 100 + time / 10_000;
  return { time, open: close - 0.2, high: close + 0.8, low: close - 0.8, close, volume: 100, turnover: close * 100 };
}

function page(candles: readonly Candle[], beforeCursor?: string): ValidatedSeriesPage {
  return Object.freeze({
    candles: Object.freeze(candles.map((item) => Object.freeze({ ...item }))),
    ...(beforeCursor === undefined ? {} : { beforeCursor }),
    hasMoreBefore: beforeCursor !== undefined,
    dataVersion: "v1"
  });
}

describe("materialized series", () => {
  it("returns only the bounded visible and overscan window without inventing candles", () => {
    const store = createPagedSeriesStore({ maxPages: 60, maxEstimatedBytes: 1_000_000 });
    const allCandles = Array.from({ length: 1_000 }, (_, index) => candle(index + 1));
    store.reset(selection, "v1");
    for (let pageIndex = 0; pageIndex < 50; pageIndex += 1) {
      const from = 1_000 - (pageIndex + 1) * 20;
      const requestCursor = pageIndex === 0 ? undefined : `cursor-${pageIndex}`;
      const beforeCursor = pageIndex === 49 ? undefined : `cursor-${pageIndex + 1}`;
      expect(store.mergePage(requestCursor, page(allCandles.slice(from, from + 20), beforeCursor)).ok).toBe(true);
    }

    const materialized = materializeSeriesAroundTime({
      store,
      selection,
      anchorTime: 500,
      visibleCount: 300,
      overscanCount: 100
    });

    expect(materialized.series.candles.length).toBeLessThanOrEqual(500);
    expect(materialized.series.candles.some((item) => item.time === 500)).toBe(true);
    expect(materialized.missingRequestCursors).toEqual([]);
    expect(materialized.series.candles.every((item) => allCandles.some((source) => source.time === item.time))).toBe(true);
  });

  it("reports an evicted anchor descriptor instead of fabricating its payload", () => {
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 128 });
    store.reset(selection, "v1");
    store.mergePage(undefined, page([candle(300), candle(400)], "older"));
    store.mergePage("older", page([candle(100), candle(200)]));

    const materialized = materializeSeriesAroundTime({
      store,
      selection,
      anchorTime: 350,
      visibleCount: 2,
      overscanCount: 0
    });
    expect(materialized.missingRequestCursors).toContain(undefined);
    expect(materialized.series.candles.some((item) => item.time === 350)).toBe(false);
  });
});
