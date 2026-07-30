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
  it("returns an empty window while a new selection has no page descriptor yet", () => {
    const store = createPagedSeriesStore();
    store.reset(selection, "v1");

    const materialized = materializeSeriesAroundTime({
      store,
      selection,
      visibleCount: 300,
      overscanCount: 100
    });

    expect(materialized.series.candles).toEqual([]);
    expect(materialized.missingRequestCursors).toEqual([]);
    expect(materialized.hasMoreBefore).toBe(false);
  });

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

  it("recognizes and requests a known evicted older page at a continuous 1m boundary", () => {
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
    const newest = page(Array.from({ length: 100 }, (_, index) => candle(300 + index)), "older");
    const older = page(Array.from({ length: 100 }, (_, index) => candle(200 + index)));
    store.reset(selection, "v1");
    expect(store.mergePage(undefined, newest)).toEqual({ ok: true });
    expect(store.mergePage("older", older)).toEqual({ ok: true });
    expect(store.mergePage(undefined, newest)).toEqual({ ok: true });

    const latest = materializeSeriesAroundTime({
      store,
      selection,
      visibleCount: 100,
      overscanCount: 0
    });
    expect(latest.sourceMinTime).toBe(300);
    expect(latest.hasKnownOlderData).toBe(true);

    const backward = materializeSeriesAroundTime({
      store,
      selection,
      anchorTime: latest.sourceMinTime,
      visibleCount: 100,
      overscanCount: 0
    });
    expect(backward.missingRequestCursors).toContain("older");
  });

  it("counts a deduplicated boundary candle from its canonical page", () => {
    const store = createPagedSeriesStore();
    store.reset(selection, "v1");
    expect(store.mergePage(undefined, page([candle(200), candle(300)], "older")))
      .toEqual({ ok: true });
    expect(store.mergePage("older", page([candle(100), candle(200)])))
      .toEqual({ ok: true });

    const materialized = materializeSeriesAroundTime({
      store,
      selection,
      anchorTime: 200,
      visibleCount: 1,
      overscanCount: 0
    });

    expect(materialized.series.candles.map((item) => item.time)).toEqual([200]);
    expect(materialized.sourceIndexOffset).toBe(1);
  });

  it("moves backward and forward through one cached page larger than the materialized window", () => {
    const store = createPagedSeriesStore();
    store.reset(selection, "v1");
    expect(store.mergePage(undefined, page(Array.from({ length: 2_000 }, (_, index) => candle(index + 1)))).ok).toBe(true);

    const latest = materializeSeriesAroundTime({ store, selection, visibleCount: 300, overscanCount: 100 });
    expect(latest.series.candles).toHaveLength(500);
    expect(latest.sourceMinTime).toBe(1_501);
    expect(latest.hasKnownOlderData).toBe(true);

    const older = materializeSeriesAroundTime({
      store,
      selection,
      anchorTime: latest.sourceMinTime,
      visibleCount: 300,
      overscanCount: 100
    });
    expect(older.sourceMinTime).toBe(1_251);
    expect(older.hasKnownNewerPages).toBe(true);

    const newer = materializeSeriesAroundTime({
      store,
      selection,
      anchorTime: older.sourceMaxTime,
      visibleCount: 300,
      overscanCount: 100
    });
    const returned = materializeSeriesAroundTime({
      store,
      selection,
      anchorTime: newer.sourceMaxTime,
      visibleCount: 300,
      overscanCount: 100
    });
    expect(returned.sourceMaxTime).toBe(2_000);
    expect(returned.series.candles.at(-1)?.time).toBe(2_000);
  });

  it("uses one 1m snapshot for single-day intraday and continuous multi-day views", () => {
    const store = createPagedSeriesStore();
    const firstDay = Date.UTC(2026, 6, 14, 1, 30);
    const lastDay = Date.UTC(2026, 6, 15, 1, 30);
    const firstDayCandles = Array.from({ length: 10 }, (_, index) => candle(firstDay + index * 60_000));
    const lastDayCandles = Array.from({ length: 241 }, (_, index) => candle(lastDay + index * 60_000));
    store.reset(selection, "v1");
    expect(store.mergePage(undefined, page([...firstDayCandles, ...lastDayCandles], "older")).ok).toBe(true);

    const intraday = materializeSeriesAroundTime({
      store,
      selection,
      visibleCount: 100,
      overscanCount: 0,
      intradayDayCount: 1
    });
    const continuous = materializeSeriesAroundTime({
      store,
      selection,
      anchorTime: firstDay + 9 * 60_000,
      visibleCount: 100,
      overscanCount: 0
    });

    expect(intraday.series.candles).toHaveLength(241);
    expect(intraday.series.candles[0]?.time).toBe(lastDay);
    expect(intraday.series.candles.at(-1)?.time).toBe(lastDay + 240 * 60_000);
    expect(intraday.series.candles.some((item) => item.time < lastDay)).toBe(false);
    expect(continuous.series.candles).toHaveLength(100);
    expect(continuous.series.candles.some((item) => item.time < lastDay)).toBe(true);
    expect(continuous.series.candles.some((item) => item.time >= lastDay)).toBe(true);
    expect(intraday.series.dataVersion).toBe(continuous.series.dataVersion);
    expect(intraday.hasMoreBefore).toBe(false);
    expect(continuous.hasMoreBefore).toBe(true);
  });

  it("caps an invalid oversized intraday candidate at one overflow sentinel candle", () => {
    const store = createPagedSeriesStore();
    const day = Date.UTC(2026, 6, 15, 0, 0);
    store.reset(selection, "v1");
    expect(store.mergePage(undefined, page(
      Array.from({ length: 1_500 }, (_, index) => candle(day + index * 30_000))
    )).ok).toBe(true);

    const intraday = materializeSeriesAroundTime({
      store,
      selection,
      visibleCount: 100,
      overscanCount: 0,
      intradayDayCount: 1
    });
    expect(intraday.series.candles).toHaveLength(1_441);
  });

  it("materializes the latest two through nine Shanghai trading days with the prior day close as baseline", () => {
    const store = createPagedSeriesStore();
    const days = [1, 2, 3, 6, 7, 8, 9, 10, 13, 14].map(
      (day) => Date.UTC(2026, 6, day, 1, 30)
    );
    const candles = days.flatMap((day, dayIndex) =>
      Array.from({ length: 3 }, (_, index) => ({
        ...candle(day + index * 60_000),
        close: 100 + dayIndex + index
      }))
    );
    store.reset(selection, "v1");
    expect(store.mergePage(undefined, page(candles)).ok).toBe(true);

    const twoDays = materializeSeriesAroundTime({
      store,
      selection,
      visibleCount: 100,
      overscanCount: 0,
      intradayDayCount: 2
    });
    const nineDays = materializeSeriesAroundTime({
      store,
      selection,
      visibleCount: 100,
      overscanCount: 0,
      intradayDayCount: 9
    });

    expect(twoDays.series.candles).toHaveLength(6);
    expect(twoDays.series.candles[0]?.time).toBe(days[8]);
    expect(twoDays.intradayScale?.previousClose).toBe(109);
    expect(nineDays.series.candles).toHaveLength(27);
    expect(nineDays.series.candles[0]?.time).toBe(days[1]);
    expect(nineDays.intradayScale).toEqual({ previousClose: 102 });
  });

  it("uses the host previous close and fixed limit only for one day, then renders fewer real days without fabrication", () => {
    const store = createPagedSeriesStore();
    const days = [8, 9, 10, 13, 14].map((day) => Date.UTC(2026, 6, day, 1, 30));
    const candles = days.flatMap((day) =>
      Array.from({ length: 2 }, (_, index) => candle(day + index * 60_000))
    );
    store.reset(selection, "v1");
    expect(store.mergePage(undefined, page(candles)).ok).toBe(true);

    const oneDay = materializeSeriesAroundTime({
      store,
      selection,
      visibleCount: 100,
      overscanCount: 0,
      intradayDayCount: 1,
      intradayScale: { previousClose: 88, priceLimitPercent: 10 }
    });
    const requestedNineDays = materializeSeriesAroundTime({
      store,
      selection,
      visibleCount: 100,
      overscanCount: 0,
      intradayDayCount: 9,
      intradayScale: { previousClose: 88, priceLimitPercent: 10 }
    });

    expect(oneDay.intradayScale).toEqual({ previousClose: 88, priceLimitPercent: 10 });
    expect(requestedNineDays.series.candles).toHaveLength(candles.length);
    expect(new Set(requestedNineDays.series.candles.map((item) => item.time))).toEqual(
      new Set(candles.map((item) => item.time))
    );
    expect(requestedNineDays.intradayScale).toBeUndefined();
  });
});
