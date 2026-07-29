import { describe, expect, it } from "vitest";
import type { Candle, ChartSymbol } from "../index";
import type { ValidatedSeriesPage } from "../data/seriesPageValidation";
import {
  createPagedSeriesStore,
  shanghaiTradingDayKey,
  type SeriesSelection
} from "../data/pagedSeriesStore";

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

  it("keeps a complete 2,000-page descriptor chain bounded and reloads evicted data atomically", () => {
    const store = createPagedSeriesStore();
    const totalPages = 2_000;
    const newestPage = page([candle(totalPages)], "cursor-1");
    store.reset(selection, "v1");

    expect(store.mergePage(undefined, newestPage)).toEqual({ ok: true });
    for (let index = 1; index < totalPages; index += 1) {
      const requestCursor = `cursor-${index}`;
      const lastPage = index === totalPages - 1;
      expect(
        store.mergePage(
          requestCursor,
          page(
            [candle(totalPages - index)],
            lastPage ? undefined : `cursor-${index + 1}`,
            !lastPage
          )
        )
      ).toEqual({ ok: true });
    }

    const diagnostics = store.getDiagnostics();
    expect(diagnostics.descriptorCount).toBe(totalPages);
    expect(diagnostics.cachedPageCount).toBeLessThanOrEqual(diagnostics.maxPages);
    expect(diagnostics.estimatedBytes).toBeLessThanOrEqual(diagnostics.maxEstimatedBytes);
    expect(store.getNextBeforeCursor()).toBeUndefined();
    expect(store.getDescriptorForCursor(undefined)?.candles).toBeUndefined();

    const beforeInvalidReload = store.getSnapshot();
    expect(
      store.mergePage(undefined, { ...newestPage, dataVersion: "v2" })
    ).toMatchObject({ ok: false, code: "DATA_VERSION_MISMATCH" });
    expect(store.getSnapshot()).toEqual(beforeInvalidReload);

    expect(store.mergePage(undefined, newestPage)).toEqual({ ok: true });
    expect(store.getDescriptorForCursor(undefined)?.candles).toEqual([candle(totalPages)]);
    expect(store.getSnapshot().dataVersion).toBe("v1");
    expect(store.getDiagnostics()).toMatchObject({
      descriptorCount: totalPages,
      maxPages: diagnostics.maxPages,
      maxEstimatedBytes: diagnostics.maxEstimatedBytes
    });
    expect(store.getDiagnostics().cachedPageCount).toBeLessThanOrEqual(diagnostics.maxPages);
    expect(store.getDiagnostics().estimatedBytes).toBeLessThanOrEqual(
      diagnostics.maxEstimatedBytes
    );
  });

  it("retains Shanghai trading-day metadata across payload eviction and reload", () => {
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 512 });
    const newestTimes = [Date.UTC(2026, 6, 15, 1, 30), Date.UTC(2026, 6, 16, 1, 30)];
    const olderTime = Date.UTC(2026, 6, 14, 1, 30);
    const newestPage = page(newestTimes.map((time) => candle(time)), "older");
    store.reset({ ...selection, timeframe: "1m" }, "v1");

    expect(store.mergePage(undefined, newestPage)).toEqual({ ok: true });
    expect(store.mergePage("older", page([candle(olderTime)], undefined, false))).toEqual({ ok: true });

    const evicted = store.getDescriptorForCursor(undefined);
    expect(evicted?.candles).toBeUndefined();
    expect(evicted?.tradingDayKeys).toEqual(newestTimes.map(shanghaiTradingDayKey));
    expect(Object.isFrozen(evicted?.tradingDayKeys)).toBe(true);

    expect(store.mergePage(undefined, newestPage)).toEqual({ ok: true });
    expect(store.getDescriptorForCursor(undefined)).toMatchObject({
      tradingDayKeys: newestTimes.map(shanghaiTradingDayKey),
      candles: expect.any(Array)
    });
  });

  it("reloads an evicted descriptor only when its trusted boundaries are unchanged", () => {
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 512 });
    const newestPage = page([candle(300), candle(400)], "cursor-1");
    const olderPage = page([candle(100), candle(200)], undefined, false);
    store.reset(selection, "v1");

    expect(store.mergePage(undefined, newestPage)).toEqual({ ok: true });
    expect(store.mergePage("cursor-1", olderPage)).toEqual({ ok: true });
    expect(store.getDescriptorForCursor(undefined)?.candles).toBeUndefined();

    expect(store.mergePage(undefined, newestPage)).toEqual({ ok: true });
    expect(store.getDescriptorForCursor(undefined)?.candles?.map((item) => item.time)).toEqual([
      300,
      400
    ]);
  });

  it("reloads evicted pages with an identical overlapping boundary after deduplication", () => {
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 512 });
    const newestPage = page([candle(200), candle(300)], "cursor-1");
    const olderPage = page([candle(100), candle(200)], undefined, false);
    store.reset(selection, "v1");

    expect(store.mergePage(undefined, newestPage)).toEqual({ ok: true });
    expect(store.mergePage("cursor-1", olderPage)).toEqual({ ok: true });
    expect(store.getDescriptorForCursor(undefined)?.candleCount).toBe(2);
    expect(store.getDescriptorForCursor("cursor-1")?.candleCount).toBe(1);

    expect(store.mergePage(undefined, newestPage)).toEqual({ ok: true });
    expect(store.mergePage("cursor-1", olderPage)).toEqual({ ok: true });
    expect(store.getSnapshot().candles.map((item) => item.time)).toEqual([100]);
    expect(store.listDescriptors().map((descriptor) => descriptor.candleCount)).toEqual([2, 1]);
  });

  it("reloads an evicted middle overlap page when its newer owner is also evicted", () => {
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 512 });
    const newestPage = page([candle(300), candle(400)], "cursor-1");
    const middlePage = page([candle(200), candle(300)], "cursor-2");
    const oldestPage = page([candle(100), candle(200)], undefined, false);
    store.reset(selection, "v1");

    expect(store.mergePage(undefined, newestPage)).toEqual({ ok: true });
    expect(store.mergePage("cursor-1", middlePage)).toEqual({ ok: true });
    expect(store.mergePage("cursor-2", oldestPage)).toEqual({ ok: true });
    expect(store.getDescriptorForCursor(undefined)?.candles).toBeUndefined();
    expect(store.getDescriptorForCursor("cursor-1")?.candles).toBeUndefined();

    expect(store.mergePage("cursor-1", middlePage)).toEqual({ ok: true });
    expect(store.getDescriptorForCursor("cursor-1")?.candles?.map((item) => item.time)).toEqual([
      200
    ]);
    expect(store.listDescriptors().map((descriptor) => descriptor.candleCount)).toEqual([2, 1, 1]);
    expect(store.listDescriptors().map((descriptor) => descriptor.sourceCandleCount)).toEqual([
      2,
      2,
      2
    ]);
  });

  it("rejects rewritten reload cursors and time boundaries without mutating descriptors", () => {
    const createEvictedStore = () => {
      const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 512 });
      store.reset(selection, "v1");
      store.mergePage(undefined, page([candle(300), candle(400)], "cursor-1"));
      store.mergePage("cursor-1", page([candle(100), candle(200)], undefined, false));
      return store;
    };

    const cursorStore = createEvictedStore();
    const cursorBefore = cursorStore.getSnapshot();
    expect(
      cursorStore.mergePage(undefined, page([candle(300), candle(400)], "rewritten-cursor"))
    ).toMatchObject({ ok: false, code: "RELOAD_DESCRIPTOR_MISMATCH" });
    expect(cursorStore.getSnapshot()).toEqual(cursorBefore);

    const boundaryStore = createEvictedStore();
    const boundaryBefore = boundaryStore.getSnapshot();
    expect(
      boundaryStore.mergePage(undefined, page([candle(300), candle(450)], "cursor-1"))
    ).toMatchObject({ ok: false, code: "RELOAD_DESCRIPTOR_MISMATCH" });
    expect(boundaryStore.getSnapshot()).toEqual(boundaryBefore);
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
