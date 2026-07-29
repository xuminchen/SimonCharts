import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChartComparison,
  ChartOptions,
  ChartState
} from "../contracts";

const mocks = vi.hoisted(() => ({
  comparisonOptions: undefined as undefined | {
    onChange?: (snapshots: readonly unknown[]) => void;
  },
  controllerOptions: undefined as undefined | Record<string, unknown>,
  runtimeOptions: undefined as undefined | Record<string, unknown>,
  comparisonSnapshots: [] as Array<Record<string, unknown>>,
  setContext: vi.fn<() => Promise<boolean>>(),
  ensureTimeRange: vi.fn<(range: unknown) => Promise<boolean>>(),
  destroyComparisons: vi.fn(),
  createChartController: vi.fn(),
  createChartEngineRuntime: vi.fn(),
  createComparisonCoordinator: vi.fn()
}));

vi.mock("../controller/chartController", () => ({
  createChartController: mocks.createChartController
}));
vi.mock("../data/calculationCheckpointStore", () => ({
  createCalculationCheckpointStore: () => ({ clear: vi.fn() })
}));
vi.mock("../data/comparisonCoordinator", () => ({
  createComparisonCoordinator: mocks.createComparisonCoordinator
}));
vi.mock("../data/dataCoordinator", () => ({
  createDataCoordinator: () => ({})
}));
vi.mock("../data/pagedSeriesStore", () => ({
  createPagedSeriesStore: () => ({})
}));
vi.mock("../data/symbolSearchCoordinator", () => ({
  createSymbolSearchCoordinator: () => ({})
}));
vi.mock("../persistence/browserPersistence", async (loadOriginal) => {
  const actual = await loadOriginal<typeof import("../persistence/browserPersistence")>();
  return {
    ...actual,
    createBrowserPersistence: () => ({})
  };
});
vi.mock("../runtime/chartEngineRuntime", () => ({
  createChartEngineRuntime: mocks.createChartEngineRuntime
}));
vi.mock("../runtime/checkpointedCalculationRuntime", () => ({
  createCheckpointedCalculationRuntime: () => ({})
}));
vi.mock("../runtime/workspaceTheme", () => ({
  applyWorkspaceThemeOverrides: vi.fn()
}));
vi.mock("../ui/workspaceShell", () => ({
  createWorkspaceShell: () => ({
    root: { dataset: {}, remove: vi.fn() },
    staticCanvas: {},
    overlayCanvas: {},
    chartRegion: {},
    render: vi.fn(),
    renderDataWindow: vi.fn(),
    renderExecutionTooltip: vi.fn(),
    bind: () => vi.fn(),
    destroy: vi.fn()
  })
}));

import { createChart } from "../createChart";

const main = {
  id: "stock:SSE:600000",
  code: "600000",
  name: "浦发银行",
  exchange: "SSE",
  kind: "stock"
} as const;
const comparison: ChartComparison = {
  symbol: {
    id: "stock:SZSE:000001",
    code: "000001",
    name: "平安银行",
    exchange: "SZSE",
    kind: "stock"
  },
  color: "#7c83ff"
};

class FakeElement {
  ownerDocument = { defaultView: null };
  append = vi.fn();
}

function options(overrides: Partial<ChartOptions> = {}): ChartOptions {
  return {
    chartId: "compare",
    persistenceScopeId: "tests",
    dataContextId: "offline",
    initialSymbol: { ...main },
    datafeed: {
      getCapabilities: vi.fn(async () => ({
        series: [{ timeframe: "1d" as const, adjustModes: ["forward" as const] }]
      })),
      searchSymbols: vi.fn(async () => []),
      loadSeries: vi.fn()
    },
    ...overrides
  };
}

describe("createChart comparison wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.comparisonSnapshots = [];
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    vi.stubGlobal("localStorage", {});
    mocks.setContext.mockResolvedValue(true);
    mocks.ensureTimeRange.mockResolvedValue(true);
    mocks.createComparisonCoordinator.mockImplementation((value) => {
      mocks.comparisonOptions = value;
      return {
        setContext: mocks.setContext,
        ensureTimeRange: mocks.ensureTimeRange,
        getSnapshots: () => structuredClone(mocks.comparisonSnapshots),
        destroy: mocks.destroyComparisons
      };
    });
    mocks.createChartEngineRuntime.mockImplementation((value) => {
      mocks.runtimeOptions = value;
      return {
        getPaneLayouts: () => [],
        getPanes: () => [],
        setExecutions: vi.fn(),
        setPricePrecision: vi.fn(),
        refreshTheme: vi.fn(),
        selectDrawings: vi.fn()
      };
    });
    mocks.createChartController.mockImplementation((value) => {
      mocks.controllerOptions = value;
      let revision = 0;
      let viewModel = {
        state: {
          symbol: structuredClone(main),
          timeframe: "1d",
          view: "timeframe",
          intradayDays: 1,
          adjustMode: "forward",
          loading: false
        } satisfies ChartState,
        status: { type: "ready" },
        intradayView: false,
        seriesType: "candles",
        seriesProperties: [],
        favoriteTimeframes: [],
        priceScaleMode: "linear",
        indicators: [],
        drawings: [],
        marks: [],
        comparisons: structuredClone(value.initialComparisons ?? []),
        comparisonData: [],
        selectedDrawingIds: [],
        bottomPanel: "hidden",
        drawingPalette: "expanded",
        canUndoDrawing: false,
        canRedoDrawing: false,
        gridVisible: true,
        executionsVisible: false,
        calculationStatus: { type: "idle" },
        search: { query: "", loading: false, results: [] }
      } as any;
      const publish = () => value.onViewModelChanged?.(viewModel, ++revision);
      return {
        getViewModel: () => viewModel,
        getState: () => structuredClone(viewModel.state),
        getVisibleRange: () => ({ from: 100, to: 200 }),
        shouldPublishVisibleRange: () => true,
        setMarks: vi.fn(),
        setComparisons: (comparisons: readonly ChartComparison[]) => {
          viewModel = { ...viewModel, comparisons: structuredClone(comparisons) };
          publish();
        },
        setSymbol: (symbol: typeof main) => {
          viewModel = {
            ...viewModel,
            state: { ...viewModel.state, symbol: structuredClone(symbol) }
          };
          publish();
        },
        setTimeframe: (timeframe: string) => {
          viewModel = { ...viewModel, state: { ...viewModel.state, timeframe } };
          publish();
        },
        setView: (view: string) => {
          viewModel = { ...viewModel, state: { ...viewModel.state, view } };
          publish();
        },
        setAdjustMode: (adjustMode: string) => {
          viewModel = { ...viewModel, state: { ...viewModel.state, adjustMode } };
          publish();
        },
        handleComparisonData: (snapshots: readonly unknown[]) => {
          viewModel = { ...viewModel, comparisonData: structuredClone(snapshots) };
          publish();
        },
        start: () => {
          publish();
          value.onDataLoaded?.({
            state: structuredClone(viewModel.state),
            dataVersion: "main-v1",
            phase: "initial"
          });
          value.onPresentationReady?.(structuredClone(viewModel.state));
        },
        deactivate: vi.fn(),
        retry: vi.fn(),
        destroy: vi.fn()
      };
    });
  });

  it("accepts the feature and defensively wires initial comparisons", async () => {
    const source = [{ ...comparison, symbol: { ...comparison.symbol } }];
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ features: ["symbol-compare"], comparisons: source })
    );

    source[0]!.symbol.name = "changed";
    expect(mocks.controllerOptions?.initialComparisons).toEqual([{
      ...comparison,
      symbol: { ...comparison.symbol },
      visible: true
    }]);
    expect(chart.getComparisons()[0]!.symbol.name).toBe("平安银行");
    expect(await chart.dataReady()).toBe(true);
  });

  it("rejects an invalid initial comparison batch before creating runtime state", async () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ comparisons: [{ symbol: main }] })
    );

    expect(chart.getState().symbol.id).toBe("invalid");
    expect(chart.getComparisons()).toEqual([]);
    expect(await chart.dataReady()).toBe(false);
    expect(mocks.createChartController).not.toHaveBeenCalled();
    expect(mocks.createComparisonCoordinator).not.toHaveBeenCalled();
  });

  it("validates replacement batches before mutating the current comparisons", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ comparisons: [comparison] })
    );
    const replacement = [{ ...comparison, color: "#112233" }];

    chart.setComparisons(replacement);
    replacement[0]!.symbol.name = "changed";
    expect(chart.getComparisons()[0]!.symbol.name).toBe("平安银行");
    expect(() => chart.setComparisons([{ ...comparison, visible: "yes" } as any]))
      .toThrow(TypeError);
    expect(chart.getComparisons()[0]!.color).toBe("#112233");
  });

  it("waits for the current comparison context and reports failures", async () => {
    mocks.setContext.mockResolvedValueOnce(false);
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ comparisons: [comparison] })
    );

    expect(await chart.dataReady()).toBe(false);
    expect(mocks.setContext).toHaveBeenCalledWith(expect.objectContaining({
      comparisons: expect.any(Array),
      mainSymbol: main,
      timeframe: "1d",
      adjustMode: "forward",
      intraday: false
    }));
  });

  it("invalidates readiness and reloads after replacing comparisons", async () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ comparisons: [comparison] })
    );
    expect(await chart.dataReady()).toBe(true);
    const next = {
      symbol: {
        id: "index:SSE:000001",
        code: "000001",
        name: "上证指数",
        exchange: "SSE",
        kind: "index"
      }
    } as const;
    let resolve!: (ready: boolean) => void;
    mocks.setContext.mockImplementationOnce(() => new Promise((done) => {
      resolve = done;
    }));

    chart.setComparisons([next]);
    const readiness = chart.dataReady();
    let settled = false;
    void readiness.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolve(true);
    expect(await readiness).toBe(true);
    expect(mocks.setContext).toHaveBeenLastCalledWith(expect.objectContaining({
      comparisons: [expect.objectContaining({ ...next, visible: true })]
    }));
  });

  it("loads the visible comparison range, forwards snapshots, and destroys resources", async () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ comparisons: [comparison] })
    );
    await chart.dataReady();

    expect(mocks.ensureTimeRange).toHaveBeenCalledWith({ from: 100, to: 200 });
    (mocks.runtimeOptions?.onVisibleRangeChanged as (range: { from: number; to: number }) => void)({
      from: 50,
      to: 150
    });
    await vi.waitFor(() => expect(mocks.ensureTimeRange).toHaveBeenCalledWith({
      from: 50,
      to: 150
    }));
    mocks.comparisonOptions?.onChange?.([{
      comparison,
      status: "ready",
      candles: []
    }]);
    chart.destroy();
    expect(mocks.destroyComparisons).toHaveBeenCalledOnce();
  });

  it("resynchronizes comparisons with main selection and view changes", async () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ comparisons: [comparison] })
    );
    expect(await chart.dataReady()).toBe(true);

    chart.setTimeframe("5m");
    await vi.waitFor(() => expect(mocks.setContext).toHaveBeenLastCalledWith(
      expect.objectContaining({ timeframe: "5m" })
    ));
    chart.setAdjustMode("none");
    await vi.waitFor(() => expect(mocks.setContext).toHaveBeenLastCalledWith(
      expect.objectContaining({ adjustMode: "none" })
    ));
    chart.setView("intraday");
    await vi.waitFor(() => expect(mocks.setContext).toHaveBeenLastCalledWith(
      expect.objectContaining({ intraday: true })
    ));
    chart.setSymbol({
      id: "stock:SSE:600519",
      code: "600519",
      name: "贵州茅台",
      exchange: "SSE",
      kind: "stock"
    });
    await vi.waitFor(() => expect(mocks.setContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mainSymbol: expect.objectContaining({ id: "stock:SSE:600519" })
      })
    ));
  });

  it("starts the latest visible-range load without waiting for an obsolete load", async () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ comparisons: [comparison] })
    );
    expect(await chart.dataReady()).toBe(true);
    let resolveFirst!: (ready: boolean) => void;
    let resolveSecond!: (ready: boolean) => void;
    mocks.ensureTimeRange
      .mockImplementationOnce(() => new Promise((done) => {
        resolveFirst = done;
      }))
      .mockImplementationOnce(() => new Promise((done) => {
        resolveSecond = done;
      }));
    const onRange = mocks.runtimeOptions?.onVisibleRangeChanged as (
      range: { from: number; to: number }
    ) => void;

    onRange({ from: 80, to: 180 });
    await vi.waitFor(() => expect(mocks.ensureTimeRange).toHaveBeenCalledWith({
      from: 80,
      to: 180
    }));
    onRange({ from: 10, to: 110 });
    const readiness = chart.dataReady();
    let settled = false;
    void readiness.then(() => {
      settled = true;
    });

    await vi.waitFor(() => expect(mocks.ensureTimeRange).toHaveBeenCalledWith({
      from: 10,
      to: 110
    }));
    expect(settled).toBe(false);

    resolveSecond(true);
    expect(await readiness).toBe(true);
    resolveFirst(false);
  });

  it("retries a failed comparison context explicitly", async () => {
    mocks.comparisonSnapshots = [{
      comparison,
      status: "error",
      candles: []
    }];
    mocks.setContext.mockResolvedValueOnce(false);
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ comparisons: [comparison] })
    );
    expect(await chart.dataReady()).toBe(false);
    mocks.setContext.mockResolvedValueOnce(true);

    chart.retry();
    mocks.comparisonSnapshots = [{
      comparison,
      status: "ready",
      candles: []
    }];

    expect(await chart.dataReady()).toBe(true);
    expect(mocks.setContext).toHaveBeenCalledTimes(2);
  });

  it("maps comparison values into the public crosshair snapshot", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ comparisons: [comparison] })
    );
    const listener = vi.fn();
    chart.subscribeCrosshair(listener);

    (mocks.runtimeOptions?.onCrosshairChanged as (snapshot: unknown) => void)({
      symbolId: main.id,
      timeframe: "1d",
      adjustMode: "forward",
      dataVersion: "main-v1",
      crosshair: { index: 0, time: 100, price: 10 },
      offsetX: 10,
      offsetY: 20,
      candle: {
        time: 100,
        open: 10,
        high: 11,
        low: 9,
        close: 10,
        volume: 1,
        turnover: 10
      },
      referencePrice: 9,
      change: 1,
      changePercent: 11.11,
      studies: [],
      comparisons: [{
        symbolId: comparison.symbol.id,
        code: comparison.symbol.code,
        name: comparison.symbol.name,
        label: "internal",
        color: comparison.color,
        value: 12,
        changePercent: 20,
        dataVersion: "compare-v1"
      }]
    });

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      type: "crosshair-moved",
      crosshair: expect.objectContaining({
        comparisons: [{
          symbolId: comparison.symbol.id,
          code: comparison.symbol.code,
          name: comparison.symbol.name,
          color: comparison.color,
          value: 12,
          changePercent: 20,
          dataVersion: "compare-v1"
        }]
      })
    }));
  });

  it("keeps comparisons out of Layout V3", async () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options({ comparisons: [comparison] })
    );
    await chart.dataReady();

    expect(chart.exportLayout()).not.toHaveProperty("comparisons");
  });
});
