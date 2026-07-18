import { describe, expect, it } from "vitest";
import type { ChartDatafeed, SeriesPage, SeriesRequest } from "../index";
import { createDataCoordinator, type DataCoordinatorEvent } from "../data/dataCoordinator";
import { createPagedSeriesStore, type SeriesSelection } from "../data/pagedSeriesStore";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const stockSelection: SeriesSelection = {
  symbol: { id: "stock", code: "600000", name: "浦发银行", exchange: "SSE", kind: "stock" },
  timeframe: "1d",
  adjustMode: "forward"
};
const indexSelection: SeriesSelection = {
  symbol: { id: "index", code: "000001", name: "上证指数", exchange: "SSE", kind: "index" },
  timeframe: "1d",
  adjustMode: "none"
};
const page = (time: number, dataVersion = "v1", beforeCursor?: string): SeriesPage => ({
  candles: [
    { time, open: 10, high: 12, low: 9, close: 11, volume: 100, turnover: 1_100 }
  ],
  ...(beforeCursor === undefined ? {} : { beforeCursor }),
  hasMoreBefore: beforeCursor !== undefined,
  dataVersion
});
const unusedCapabilities: ChartDatafeed["getCapabilities"] = async () => ({
  series: [{ timeframe: "1d", adjustModes: ["none", "forward"] }]
});

describe("data coordinator", () => {
  it("aborts and ignores a stale generation before store or event commit", async () => {
    const first = deferred<SeriesPage>();
    const second = deferred<SeriesPage>();
    const signals: AbortSignal[] = [];
    const requests: SeriesRequest[] = [];
    const dataSource: ChartDatafeed = {
      getCapabilities: unusedCapabilities,
      async searchSymbols() {
        return [];
      },
      loadSeries(request, signal) {
        requests.push(request);
        signals.push(signal);
        return signals.length === 1 ? first.promise : second.promise;
      }
    };
    const events: DataCoordinatorEvent[] = [];
    const store = createPagedSeriesStore();
    const coordinator = createDataCoordinator({ dataSource, dataCutoffTime: 250, store, onEvent: (event) => events.push(event) });

    const firstRun = coordinator.start(stockSelection);
    const secondRun = coordinator.start(indexSelection);
    first.resolve(page(100));
    second.resolve(page(200));
    await Promise.all([firstRun, secondRun]);

    expect(signals[0].aborted).toBe(true);
    expect(requests.every((request) => request.dataCutoffTime === 250)).toBe(true);
    expect(events.filter((event) => event.type === "initialPageAccepted")).toHaveLength(1);
    expect(store.getSnapshot().selection?.symbol.id).toBe("index");
    expect(store.getSnapshot().candles.map((item) => item.time)).toEqual([200]);
  });

  it("treats AbortError as silent control flow", async () => {
    const dataSource: ChartDatafeed = {
      getCapabilities: unusedCapabilities,
      async searchSymbols() {
        return [];
      },
      async loadSeries() {
        throw new DOMException("Aborted", "AbortError");
      }
    };
    const events: DataCoordinatorEvent[] = [];
    const coordinator = createDataCoordinator({
      dataSource,
      store: createPagedSeriesStore(),
      onEvent: (event) => events.push(event)
    });

    await coordinator.start(stockSelection);
    expect(events.map((event) => event.type)).toEqual(["loadingInitial"]);
  });

  it("atomically rejects candles after cutoff on initial and cursor pages", async () => {
    const initialEvents: DataCoordinatorEvent[] = [];
    const initialStore = createPagedSeriesStore();
    const initialCoordinator = createDataCoordinator({
      dataCutoffTime: 150,
      dataSource: {
        getCapabilities: unusedCapabilities,
        async searchSymbols() { return []; },
        async loadSeries() { return page(200); }
      },
      store: initialStore,
      onEvent: (event) => initialEvents.push(event)
    });

    await initialCoordinator.start(stockSelection);
    expect(initialEvents).toContainEqual(expect.objectContaining({
      type: "pageRejected",
      phase: "initial",
      code: "CANDLE_AFTER_CUTOFF"
    }));
    expect(initialStore.getSnapshot().candles).toEqual([]);

    const historyEvents: DataCoordinatorEvent[] = [];
    const historyStore = createPagedSeriesStore();
    const responses = [page(200, "v1", "older"), page(300, "v2")];
    const historyCoordinator = createDataCoordinator({
      dataCutoffTime: 250,
      dataSource: {
        getCapabilities: unusedCapabilities,
        async searchSymbols() { return []; },
        async loadSeries() { return responses.shift()!; }
      },
      store: historyStore,
      onEvent: (event) => historyEvents.push(event)
    });

    await historyCoordinator.start(stockSelection);
    await historyCoordinator.loadMoreBefore();
    expect(historyEvents).toContainEqual(expect.objectContaining({
      type: "pageRejected",
      phase: "history",
      code: "CANDLE_AFTER_CUTOFF"
    }));
    expect(historyEvents.some((event) => event.type === "snapshotRefreshing")).toBe(false);
    expect(historyStore.getSnapshot().candles.map((item) => item.time)).toEqual([200]);
  });

  it("keeps pending cursor ownership across generations and blocks history before initial acceptance", async () => {
    const oldHistory = deferred<SeriesPage>();
    const newInitial = deferred<SeriesPage>();
    const newHistory = deferred<SeriesPage>();
    const responses = [
      Promise.resolve(page(200, "old-v1", "older")),
      oldHistory.promise,
      newInitial.promise,
      newHistory.promise
    ];
    const requests: SeriesRequest[] = [];
    const signals: AbortSignal[] = [];
    const store = createPagedSeriesStore();
    const coordinator = createDataCoordinator({
      dataSource: {
        getCapabilities: unusedCapabilities,
        async searchSymbols() { return []; },
        loadSeries(request, signal) {
          requests.push(request);
          signals.push(signal);
          return responses.shift()!;
        }
      },
      store,
      onEvent: () => undefined
    });

    await coordinator.start(stockSelection);
    const oldHistoryRun = coordinator.loadMoreBefore();
    const newInitialRun = coordinator.start(indexSelection);
    await coordinator.loadMoreBefore();
    expect(requests).toHaveLength(3);

    newInitial.resolve(page(300, "new-v1", "older"));
    await newInitialRun;
    const newHistoryRun = coordinator.loadMoreBefore();
    expect(requests).toHaveLength(4);

    oldHistory.resolve(page(100, "old-v1"));
    await oldHistoryRun;
    expect(signals[1].aborted).toBe(true);
    const joinedNewHistoryRun = coordinator.loadMoreBefore();
    expect(requests).toHaveLength(4);

    newHistory.resolve(page(100, "new-v1"));
    await Promise.all([newHistoryRun, joinedNewHistoryRun]);
    expect(store.getSnapshot().selection?.symbol.id).toBe(indexSelection.symbol.id);
    expect(store.getSnapshot().candles.map((item) => item.time)).toEqual([100, 300]);
  });

  it("keeps trusted data when a history version change replacement fails", async () => {
    const responses = [
      Promise.resolve(page(200, "v1", "older")),
      Promise.resolve(page(100, "v2")),
      Promise.reject(new Error("replacement failed"))
    ];
    const dataSource: ChartDatafeed = {
      getCapabilities: unusedCapabilities,
      async searchSymbols() {
        return [];
      },
      loadSeries() {
        return responses.shift()!;
      }
    };
    const events: DataCoordinatorEvent[] = [];
    const store = createPagedSeriesStore();
    const coordinator = createDataCoordinator({ dataSource, store, onEvent: (event) => events.push(event) });

    await coordinator.start(stockSelection);
    await coordinator.loadMoreBefore();

    expect(events.some((event) => event.type === "snapshotRefreshing")).toBe(true);
    expect(events.some((event) => event.type === "initialRequestFailed")).toBe(true);
    expect(store.getSnapshot().dataVersion).toBe("v1");
    expect(store.getSnapshot().candles.map((item) => item.time)).toEqual([200]);
  });

  it("reports initial and history request failures in their own scopes", async () => {
    const responses = [
      Promise.reject(new Error("initial failed")),
      Promise.resolve(page(200, "v1", "older")),
      Promise.reject(new Error("history failed"))
    ];
    const dataSource: ChartDatafeed = {
      getCapabilities: unusedCapabilities,
      async searchSymbols() {
        return [];
      },
      loadSeries() {
        return responses.shift()!;
      }
    };
    const events: DataCoordinatorEvent[] = [];
    const coordinator = createDataCoordinator({
      dataSource,
      store: createPagedSeriesStore(),
      onEvent: (event) => events.push(event)
    });

    await coordinator.start(stockSelection);
    await coordinator.retryInitial();
    await coordinator.loadMoreBefore();

    expect(events.some((event) => event.type === "initialRequestFailed")).toBe(true);
    expect(events.some((event) => event.type === "historyRequestFailed")).toBe(true);
  });

  it("atomically replaces trusted data after a changed snapshot version", async () => {
    const responses = [
      Promise.resolve(page(200, "v1", "older")),
      Promise.resolve(page(100, "v2")),
      Promise.resolve(page(300, "v2"))
    ];
    const dataSource: ChartDatafeed = {
      getCapabilities: unusedCapabilities,
      async searchSymbols() {
        return [];
      },
      loadSeries() {
        return responses.shift()!;
      }
    };
    const store = createPagedSeriesStore();
    const events: DataCoordinatorEvent[] = [];
    const coordinator = createDataCoordinator({ dataSource, store, onEvent: (event) => events.push(event) });

    await coordinator.start(stockSelection);
    await coordinator.loadMoreBefore();

    expect(events.map((event) => event.type)).toContain("snapshotRefreshing");
    expect(store.getSnapshot().dataVersion).toBe("v2");
    expect(store.getSnapshot().candles.map((item) => item.time)).toEqual([300]);
  });

  it("shares an in-flight history cursor between loadMoreBefore and reloadPage callers", async () => {
    const older = deferred<SeriesPage>();
    const requests: SeriesRequest[] = [];
    const store = createPagedSeriesStore();
    const events: DataCoordinatorEvent[] = [];
    const coordinator = createDataCoordinator({
      dataSource: {
        getCapabilities: unusedCapabilities,
        async searchSymbols() { return []; },
        loadSeries(request) {
          requests.push(request);
          return request.beforeCursor === undefined
            ? Promise.resolve(page(200, "v1", "older"))
            : older.promise;
        }
      },
      store,
      onEvent: (event) => events.push(event)
    });
    await coordinator.start(stockSelection);

    const load = coordinator.loadMoreBefore();
    await Promise.resolve();
    const reload = coordinator.reloadPage("older");
    older.resolve(page(100));
    await Promise.all([load, reload]);

    expect(requests.filter((request) => request.beforeCursor === "older")).toHaveLength(1);
    expect(events.filter((event) => event.type === "historyPageAccepted")).toHaveLength(1);
    expect(store.getSnapshot().candles.map((item) => item.time)).toEqual([100, 200]);
  });
});
