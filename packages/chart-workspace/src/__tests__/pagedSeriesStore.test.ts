import { describe, expect, it } from "vitest";
import type { Candle, ChartSymbol } from "../index";
import type { ValidatedSeriesPage } from "../data/seriesPageValidation";
import { createPagedSeriesStore, type SeriesSelection } from "../data/pagedSeriesStore";

const symbol: ChartSymbol = {
  id: "SSE:600000",
  code: "600000",
  name: "浦发银行",
  exchange: "SSE",
  kind: "stock"
};

const selection: SeriesSelection = {
  symbol,
  timeframe: "1d",
  adjustMode: "forward"
};

const candle = (time: number, close = time / 10): Candle => ({
  time,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  volume: 100,
  turnover: 1_000
});

const page = (
  candles: readonly Candle[],
  beforeCursor: string | undefined,
  hasMoreBefore = true
): ValidatedSeriesPage =>
  Object.freeze({
    candles: Object.freeze(candles.map((item) => Object.freeze({ ...item }))),
    ...(beforeCursor === undefined ? {} : { beforeCursor }),
    hasMoreBefore,
    dataVersion: "v1"
  });

describe("paged series store", () => {
  it("merges newest-to-oldest, deduplicates identical boundaries, and rejects conflicts atomically", () => {
    const store = createPagedSeriesStore({ maxPages: 4, maxEstimatedBytes: 4_096 });
    store.reset(selection, "v1");

    expect(store.mergePage(undefined, page([candle(200), candle(300)], "cursor-1"))).toEqual({
      ok: true
    });
    expect(
      store.mergePage("cursor-1", page([candle(100), candle(200)], "cursor-2"))
    ).toEqual({ ok: true });
    expect(store.getSnapshot().candles.map((item) => item.time)).toEqual([100, 200, 300]);

    const before = store.getSnapshot();
    const conflict = page([candle(50), candle(100, 99)], "cursor-3", false);
    expect(store.mergePage("cursor-2", conflict)).toMatchObject({
      ok: false,
      code: "CONFLICTING_BOUNDARY_CANDLE"
    });
    expect(store.getSnapshot()).toEqual(before);
  });

  it("evicts candle payloads while retaining reloadable descriptors", () => {
    const store = createPagedSeriesStore({ maxPages: 2, maxEstimatedBytes: 512 });
    const firstPage = page([candle(300), candle(400)], "cursor-1");
    const olderPage = page([candle(200), candle(300)], "cursor-2");
    const oldestPage = page([candle(100), candle(200)], undefined, false);
    store.reset(selection, "v1");

    expect(store.mergePage(undefined, firstPage).ok).toBe(true);
    expect(store.mergePage("cursor-1", olderPage).ok).toBe(true);
    expect(store.mergePage("cursor-2", oldestPage).ok).toBe(true);

    expect(store.getDiagnostics().cachedPageCount).toBeLessThanOrEqual(2);
    expect(store.getDiagnostics().estimatedBytes).toBeLessThanOrEqual(512);
    expect(store.listDescriptors()).toHaveLength(3);
    expect(store.listDescriptors().some((descriptor) => descriptor.candles === undefined)).toBe(
      true
    );
    expect(store.getReloadCursorForTime(oldestPage.candles[0].time)).toBe("cursor-2");
    expect(store.listDescriptors().map((descriptor) => descriptor.requestCursor)).toEqual([
      undefined,
      "cursor-1",
      "cursor-2"
    ]);
  });

  it("touches cached descriptors and exposes defensive immutable snapshots", () => {
    const store = createPagedSeriesStore({ maxPages: 2, maxEstimatedBytes: 512 });
    store.reset(selection, "v1");
    store.mergePage(undefined, page([candle(300)], "cursor-1"));
    store.mergePage("cursor-1", page([candle(200)], "cursor-2"));
    store.touch(undefined);
    store.mergePage("cursor-2", page([candle(100)], undefined, false));

    expect(store.getDescriptorForCursor(undefined)?.candles).toBeDefined();
    expect(store.getDescriptorForCursor("cursor-1")?.candles).toBeUndefined();
    expect(Object.isFrozen(store.listDescriptors())).toBe(true);
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
    expect(store.getNextBeforeCursor()).toBeUndefined();

    store.clear();
    expect(store.getSnapshot().selection).toBeUndefined();
    expect(store.listDescriptors()).toEqual([]);
  });
});
