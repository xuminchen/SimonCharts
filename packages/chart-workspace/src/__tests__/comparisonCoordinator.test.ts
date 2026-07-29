import { describe, expect, it, vi } from "vitest";
import type {
  ChartComparison,
  ChartDatafeed,
  ChartSymbol,
  SeriesPage
} from "../contracts";
import { createComparisonCoordinator } from "../data/comparisonCoordinator";

const main: ChartSymbol = {
  id: "stock:SSE:600000",
  code: "600000",
  name: "浦发银行",
  exchange: "SSE",
  kind: "stock"
};
const stock: ChartSymbol = {
  id: "stock:SZSE:000001",
  code: "000001",
  name: "平安银行",
  exchange: "SZSE",
  kind: "stock"
};
const index: ChartSymbol = {
  id: "index:SSE:000001",
  code: "000001",
  name: "上证指数",
  exchange: "SSE",
  kind: "index"
};
const comparison = (symbol: ChartSymbol): ChartComparison => ({
  symbol,
  visible: true
});
const page = (
  times: readonly number[],
  beforeCursor?: string,
  hasMoreBefore = false
): SeriesPage => ({
  candles: times.map((time) => ({
    time,
    open: 10,
    high: 11,
    low: 9,
    close: 10,
    volume: 1,
    turnover: 10
  })),
  ...(beforeCursor === undefined ? {} : { beforeCursor }),
  hasMoreBefore,
  dataVersion: "v1"
});

describe("comparison coordinator", () => {
  it("loads each symbol through an isolated selection with the shared timeframe and cutoff", async () => {
    const requests: Array<{
      symbolId: string;
      adjustMode: string;
      timeframe: string;
      cutoff?: number;
    }> = [];
    const datafeed: ChartDatafeed = {
      getCapabilities: async (symbol) => ({
        series: [{
          timeframe: "1d",
          adjustModes: symbol.kind === "index" ? ["none"] : ["forward", "none"]
        }]
      }),
      searchSymbols: async () => [],
      loadSeries: async (request) => {
        requests.push({
          symbolId: request.symbol.id,
          adjustMode: request.adjustMode,
          timeframe: request.timeframe,
          cutoff: request.dataCutoffTime
        });
        return page([1, 2, 3]);
      }
    };
    const coordinator = createComparisonCoordinator({
      datafeed,
      dataCutoffTime: 3
    });

    expect(await coordinator.setContext({
      comparisons: [comparison(stock), comparison(index)],
      mainSymbol: main,
      timeframe: "1d",
      adjustMode: "forward",
      intraday: false
    })).toBe(true);

    expect(requests).toEqual([
      { symbolId: stock.id, adjustMode: "forward", timeframe: "1d", cutoff: 3 },
      { symbolId: index.id, adjustMode: "none", timeframe: "1d", cutoff: 3 }
    ]);
    expect(coordinator.getSnapshots().map((item) => ({
      symbolId: item.comparison.symbol.id,
      status: item.status,
      dataVersion: item.dataVersion,
      candleCount: item.candles.length
    }))).toEqual([
      { symbolId: stock.id, status: "ready", dataVersion: "v1", candleCount: 3 },
      { symbolId: index.id, status: "ready", dataVersion: "v1", candleCount: 3 }
    ]);
  });

  it("loads independent history until the main materialized boundary", async () => {
    const loadSeries = vi.fn(async (request) =>
      request.beforeCursor === undefined
        ? page([30, 40], "older", true)
        : page([10, 20])
    );
    const coordinator = createComparisonCoordinator({
      datafeed: {
        getCapabilities: async () => ({
          series: [{ timeframe: "1d", adjustModes: ["forward"] }]
        }),
        searchSymbols: async () => [],
        loadSeries
      }
    });
    await coordinator.setContext({
      comparisons: [comparison(stock)],
      mainSymbol: main,
      timeframe: "1d",
      adjustMode: "forward",
      intraday: false
    });

    expect(await coordinator.ensureTimeRange({ from: 10, to: 40 })).toBe(true);
    expect(loadSeries).toHaveBeenCalledTimes(2);
    expect(coordinator.getSnapshots()[0]!.candles.map((item) => item.time))
      .toEqual([10, 20, 30, 40]);
  });

  it("ignores late responses after the comparison context changes", async () => {
    let resolveFirst!: (value: SeriesPage) => void;
    const first = new Promise<SeriesPage>((resolve) => {
      resolveFirst = resolve;
    });
    const datafeed: ChartDatafeed = {
      getCapabilities: async () => ({
        series: [{ timeframe: "1d", adjustModes: ["forward"] }]
      }),
      searchSymbols: async () => [],
      loadSeries: async (request) =>
        request.symbol.id === stock.id ? first : page([7, 8])
    };
    const coordinator = createComparisonCoordinator({ datafeed });
    const stale = coordinator.setContext({
      comparisons: [comparison(stock)],
      mainSymbol: main,
      timeframe: "1d",
      adjustMode: "forward",
      intraday: false
    });
    const current = coordinator.setContext({
      comparisons: [comparison({ ...stock, id: "stock:SZSE:000002", code: "000002" })],
      mainSymbol: main,
      timeframe: "1d",
      adjustMode: "forward",
      intraday: false
    });
    resolveFirst(page([1, 2]));

    await Promise.all([stale, current]);
    expect(coordinator.getSnapshots()).toHaveLength(1);
    expect(coordinator.getSnapshots()[0]!.comparison.symbol.id).toBe("stock:SZSE:000002");
    expect(coordinator.getSnapshots()[0]!.candles.map((item) => item.time)).toEqual([7, 8]);
  });

  it("settles empty comparison data as unavailable without contaminating other symbols", async () => {
    const coordinator = createComparisonCoordinator({
      datafeed: {
        getCapabilities: async () => ({
          series: [{ timeframe: "1d", adjustModes: ["forward"] }]
        }),
        searchSymbols: async () => [],
        loadSeries: async (request) =>
          request.symbol.id === stock.id
            ? { candles: [], hasMoreBefore: false, dataVersion: "empty" }
            : page([1, 2])
      }
    });

    expect(await coordinator.setContext({
      comparisons: [
        comparison(stock),
        comparison({ ...stock, id: "stock:SZSE:000002", code: "000002" })
      ],
      mainSymbol: main,
      timeframe: "1d",
      adjustMode: "forward",
      intraday: false
    })).toBe(false);
    expect(coordinator.getSnapshots().map((item) => item.status))
      .toEqual(["empty", "ready"]);
  });

  it("aborts and releases every comparison on destroy", async () => {
    let aborted = false;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const coordinator = createComparisonCoordinator({
      datafeed: {
        getCapabilities: async () => ({
          series: [{ timeframe: "1d", adjustModes: ["forward"] }]
        }),
        searchSymbols: async () => [],
        loadSeries: async (_request, signal) => new Promise<SeriesPage>((_resolve, reject) => {
          markStarted();
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("aborted", "AbortError"));
          });
        })
      }
    });
    const pending = coordinator.setContext({
      comparisons: [comparison(stock)],
      mainSymbol: main,
      timeframe: "1d",
      adjustMode: "forward",
      intraday: false
    });
    await started;

    coordinator.destroy();

    expect(await pending).toBe(false);
    expect(aborted).toBe(true);
    expect(coordinator.getSnapshots()).toEqual([]);
  });

  it("reloads an evicted descriptor when the visible window returns to it", async () => {
    const loadSeries = vi.fn(async (request) => {
      const time = request.beforeCursor === undefined
        ? 70
        : Number(request.beforeCursor);
      return page(
        [time],
        time > 1 ? String(time - 1) : undefined,
        time > 1
      );
    });
    const coordinator = createComparisonCoordinator({
      datafeed: {
        getCapabilities: async () => ({
          series: [{ timeframe: "1d", adjustModes: ["forward"] }]
        }),
        searchSymbols: async () => [],
        loadSeries
      }
    });
    await coordinator.setContext({
      comparisons: [comparison(stock)],
      mainSymbol: main,
      timeframe: "1d",
      adjustMode: "forward",
      intraday: false
    });

    expect(await coordinator.ensureTimeRange({ from: 1, to: 1 })).toBe(true);
    expect(coordinator.getSnapshots()[0]!.candles.some((item) => item.time === 70)).toBe(false);

    expect(await coordinator.ensureTimeRange({ from: 70, to: 70 })).toBe(true);
    expect(coordinator.getSnapshots()[0]!.candles.some((item) => item.time === 70)).toBe(true);
    expect(loadSeries.mock.calls.filter(([request]) =>
      request.beforeCursor === undefined
    )).toHaveLength(2);
  });

  it("updates color and visibility without reloading unchanged symbol data", async () => {
    const loadSeries = vi.fn(async () => page([1, 2]));
    const coordinator = createComparisonCoordinator({
      datafeed: {
        getCapabilities: async () => ({
          series: [{ timeframe: "1d", adjustModes: ["forward"] }]
        }),
        searchSymbols: async () => [],
        loadSeries
      }
    });
    const context = {
      comparisons: [comparison(stock)],
      mainSymbol: main,
      timeframe: "1d" as const,
      adjustMode: "forward" as const,
      intraday: false
    };
    await coordinator.setContext(context);

    await coordinator.setContext({
      ...context,
      comparisons: [{ ...comparison(stock), color: "#112233", visible: false }]
    });
    expect(coordinator.getSnapshots()[0]).toMatchObject({
      comparison: { color: "#112233", visible: false },
      status: "hidden"
    });

    await coordinator.setContext({
      ...context,
      comparisons: [{ ...comparison(stock), color: "#445566", visible: true }]
    });
    expect(coordinator.getSnapshots()[0]).toMatchObject({
      comparison: { color: "#445566", visible: true },
      status: "ready",
      candles: [{ time: 1 }, { time: 2 }]
    });
    expect(loadSeries).toHaveBeenCalledTimes(1);
  });

  it("waits for an unchanged comparison that is already loading", async () => {
    let resolve!: (value: SeriesPage) => void;
    const pendingPage = new Promise<SeriesPage>((done) => {
      resolve = done;
    });
    const loadSeries = vi.fn(async () => pendingPage);
    const coordinator = createComparisonCoordinator({
      datafeed: {
        getCapabilities: async () => ({
          series: [{ timeframe: "1d", adjustModes: ["forward"] }]
        }),
        searchSymbols: async () => [],
        loadSeries
      }
    });
    const context = {
      comparisons: [comparison(stock)],
      mainSymbol: main,
      timeframe: "1d" as const,
      adjustMode: "forward" as const,
      intraday: false
    };
    const first = coordinator.setContext(context);
    await vi.waitFor(() => expect(loadSeries).toHaveBeenCalledOnce());

    const second = coordinator.setContext({
      ...context,
      comparisons: [{ ...comparison(stock), color: "#112233" }]
    });
    let settled = false;
    void second.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolve(page([1, 2]));
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(loadSeries).toHaveBeenCalledOnce();
  });

  it("retries an errored comparison without changing its data identity", async () => {
    const loadSeries = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page([1, 2]));
    const coordinator = createComparisonCoordinator({
      datafeed: {
        getCapabilities: async () => ({
          series: [{ timeframe: "1d", adjustModes: ["forward"] }]
        }),
        searchSymbols: async () => [],
        loadSeries
      }
    });
    const context = {
      comparisons: [comparison(stock)],
      mainSymbol: main,
      timeframe: "1d" as const,
      adjustMode: "forward" as const,
      intraday: false
    };

    expect(await coordinator.setContext(context)).toBe(false);
    expect(await coordinator.setContext(context)).toBe(true);
    expect(coordinator.getSnapshots()[0]).toMatchObject({
      status: "ready",
      candles: [{ time: 1 }, { time: 2 }]
    });
  });

  it("continues history preparation after an eviction reload refreshes dataVersion", async () => {
    let initialRequests = 0;
    const loadSeries = vi.fn(async (request) => {
      if (request.beforeCursor === undefined) {
        initialRequests += 1;
        return {
          ...page([70], "69", true),
          dataVersion: initialRequests === 1 ? "v1" : "v2"
        };
      }
      const time = Number(request.beforeCursor);
      return {
        ...page(
          [time],
          time > 1 ? String(time - 1) : undefined,
          time > 1
        ),
        dataVersion: initialRequests === 1 ? "v1" : "v2"
      };
    });
    const coordinator = createComparisonCoordinator({
      datafeed: {
        getCapabilities: async () => ({
          series: [{ timeframe: "1d", adjustModes: ["forward"] }]
        }),
        searchSymbols: async () => [],
        loadSeries
      }
    });
    await coordinator.setContext({
      comparisons: [comparison(stock)],
      mainSymbol: main,
      timeframe: "1d",
      adjustMode: "forward",
      intraday: false
    });
    await coordinator.ensureTimeRange({ from: 1, to: 1 });

    expect(await coordinator.ensureTimeRange({ from: 65, to: 70 })).toBe(true);
    expect(coordinator.getSnapshots()[0]).toMatchObject({ dataVersion: "v2" });
    expect(coordinator.getSnapshots()[0]!.candles.map((item) => item.time))
      .toEqual(expect.arrayContaining([65, 70]));
  });

  it("stops an obsolete range intent after its current request settles", async () => {
    let resolveOlder!: (value: SeriesPage) => void;
    const older = new Promise<SeriesPage>((done) => {
      resolveOlder = done;
    });
    const loadSeries = vi.fn(async (request) =>
      request.beforeCursor === undefined
        ? page([100], "older", true)
        : request.beforeCursor === "older"
          ? older
          : page([1])
    );
    const coordinator = createComparisonCoordinator({
      datafeed: {
        getCapabilities: async () => ({
          series: [{ timeframe: "1d", adjustModes: ["forward"] }]
        }),
        searchSymbols: async () => [],
        loadSeries
      }
    });
    await coordinator.setContext({
      comparisons: [comparison(stock)],
      mainSymbol: main,
      timeframe: "1d",
      adjustMode: "forward",
      intraday: false
    });

    const obsolete = coordinator.ensureTimeRange({ from: 1, to: 100 });
    await vi.waitFor(() => expect(loadSeries).toHaveBeenCalledWith(
      expect.objectContaining({ beforeCursor: "older" }),
      expect.any(AbortSignal)
    ));

    const latest = coordinator.ensureTimeRange({ from: 100, to: 100 });
    let latestSettled = false;
    void latest.then(() => {
      latestSettled = true;
    });
    await Promise.resolve();
    expect(latestSettled).toBe(false);
    resolveOlder(page([50], "oldest", true));

    expect(await latest).toBe(true);
    expect(await obsolete).toBe(false);
    expect(loadSeries).not.toHaveBeenCalledWith(
      expect.objectContaining({ beforeCursor: "oldest" }),
      expect.any(AbortSignal)
    );
  });
});
