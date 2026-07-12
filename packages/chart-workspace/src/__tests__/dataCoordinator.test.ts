import { describe, expect, it } from "vitest";
import type { ChartWorkspaceDataSource, SeriesPage } from "../index";
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

describe("data coordinator", () => {
  it("aborts and ignores a stale generation before store or event commit", async () => {
    const first = deferred<SeriesPage>();
    const second = deferred<SeriesPage>();
    const signals: AbortSignal[] = [];
    const dataSource: ChartWorkspaceDataSource = {
      async searchSymbols() {
        return [];
      },
      loadSeries(_request, signal) {
        signals.push(signal);
        return signals.length === 1 ? first.promise : second.promise;
      }
    };
    const events: DataCoordinatorEvent[] = [];
    const store = createPagedSeriesStore();
    const coordinator = createDataCoordinator({ dataSource, store, onEvent: (event) => events.push(event) });

    const firstRun = coordinator.start(stockSelection);
    const secondRun = coordinator.start(indexSelection);
    first.resolve(page(100));
    second.resolve(page(200));
    await Promise.all([firstRun, secondRun]);

    expect(signals[0].aborted).toBe(true);
    expect(events.filter((event) => event.type === "initialPageAccepted")).toHaveLength(1);
    expect(store.getSnapshot().selection?.symbol.id).toBe("index");
    expect(store.getSnapshot().candles.map((item) => item.time)).toEqual([200]);
  });

  it("treats AbortError as silent control flow", async () => {
    const dataSource: ChartWorkspaceDataSource = {
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

  it("keeps trusted data when a history version change replacement fails", async () => {
    const responses = [
      Promise.resolve(page(200, "v1", "older")),
      Promise.resolve(page(100, "v2")),
      Promise.reject(new Error("replacement failed"))
    ];
    const dataSource: ChartWorkspaceDataSource = {
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
    const dataSource: ChartWorkspaceDataSource = {
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
    const dataSource: ChartWorkspaceDataSource = {
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
});
