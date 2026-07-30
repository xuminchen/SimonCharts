import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChartActionId,
  ChartDisplayMode,
  ChartDrawingGroup,
  ChartIndicator,
  ChartOptions,
  ChartSeriesVisualOverrides,
  ChartState,
  ChartStudyOutputVisualOverride,
  ChartTimeScaleApi
} from "../contracts";

const mocks = vi.hoisted(() => ({
  controllerOptions: undefined as undefined | Record<string, unknown>,
  viewModel: undefined as undefined | Record<string, unknown>,
  createChartController: vi.fn(),
  createChartEngineRuntime: vi.fn(),
  createComparisonCoordinator: vi.fn(),
  controller: {
    getVisibleRange: vi.fn(() => ({ from: 100, to: 200 })),
    prepareTimeScaleMutation: vi.fn(() => true),
    setVisibleRange: vi.fn(),
    resetToLatest: vi.fn(),
    setIndicators: vi.fn(),
    setSeriesVisualOverrides: vi.fn(),
    createDrawingGroup: vi.fn(() => "drawing-group:1" as const),
    setDrawingGroupName: vi.fn(),
    setDrawingGroupMembers: vi.fn(),
    setDrawingGroupVisible: vi.fn(),
    setDrawingGroupLocked: vi.fn(),
    moveDrawingGroup: vi.fn(),
    ungroupDrawingGroup: vi.fn(),
    deleteDrawingGroupDrawings: vi.fn(),
    undoDrawing: vi.fn(),
    redoDrawing: vi.fn()
  },
  runtime: {
    getVisibleRange: vi.fn(() => ({ from: 100, to: 200 })),
    getBarSpacing: vi.fn(() => 8),
    setBarSpacing: vi.fn(),
    getWidth: vi.fn(() => 720),
    timeToCoordinate: vi.fn((time: number) => time === 150 ? 360 : undefined),
    coordinateToTime: vi.fn((coordinate: number) => coordinate === 360 ? 150 : undefined),
    scrollByBars: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitContent: vi.fn(),
    setDataTableActive: vi.fn(),
    getPanes: vi.fn(() => []),
    setPaneAutoScale: vi.fn(),
    resetToLatest: vi.fn(),
    getDataTableSnapshot: vi.fn(() => ({ status: "ready" as const, columns: [], rows: [] })),
    clearTransientInteraction: vi.fn(),
    clearCrosshair: vi.fn()
  },
  shell: {
    setDisplayMode: vi.fn(),
    renderDataTable: vi.fn()
  }
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
    renderDataTable: mocks.shell.renderDataTable,
    renderExecutionTooltip: vi.fn(),
    setDisplayMode: mocks.shell.setDisplayMode,
    bind: () => vi.fn(),
    destroy: vi.fn()
  })
}));

import { createChart } from "../createChart";

const symbol = {
  id: "stock:SSE:600000",
  code: "600000",
  name: "浦发银行",
  exchange: "SSE",
  kind: "stock"
} as const;

class FakeElement {
  ownerDocument = { defaultView: null };
  append = vi.fn();
}

function options(): ChartOptions {
  return {
    chartId: "time-scale-actions",
    persistenceScopeId: "tests",
    dataContextId: "offline",
    initialSymbol: { ...symbol },
    datafeed: {
      getCapabilities: vi.fn(async () => ({
        series: [{ timeframe: "1d" as const, adjustModes: ["forward" as const] }]
      })),
      searchSymbols: vi.fn(async () => []),
      loadSeries: vi.fn()
    }
  };
}

type Rc44Chart = ReturnType<typeof createChart> & {
  getTimeScale(): ChartTimeScaleApi;
  executeActionById(actionId: ChartActionId): void;
};

describe("createChart rc.44 time-scale and action API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    vi.stubGlobal("localStorage", {});
    mocks.runtime.getVisibleRange.mockReturnValue({ from: 100, to: 200 });
    mocks.runtime.getBarSpacing.mockReturnValue(8);
    mocks.runtime.getWidth.mockReturnValue(720);
    mocks.runtime.timeToCoordinate.mockImplementation((time) => time === 150 ? 360 : undefined);
    mocks.runtime.coordinateToTime.mockImplementation(
      (coordinate) => coordinate === 360 ? 150 : undefined
    );
    mocks.controller.getVisibleRange.mockReturnValue({ from: 100, to: 200 });
    mocks.controller.prepareTimeScaleMutation.mockReturnValue(true);
    mocks.createComparisonCoordinator.mockReturnValue({
      setContext: vi.fn(async () => true),
      ensureTimeRange: vi.fn(async () => true),
      getSnapshots: () => [],
      destroy: vi.fn()
    });
    mocks.createChartEngineRuntime.mockReturnValue({
      ...mocks.runtime,
      getPaneLayouts: () => [],
      getPanes: mocks.runtime.getPanes,
      setExecutions: vi.fn(),
      setPricePrecision: vi.fn(),
      refreshTheme: vi.fn(),
      selectDrawings: vi.fn()
    });
    mocks.createChartController.mockImplementation((value) => {
      mocks.controllerOptions = value;
      const state: ChartState = {
        symbol: structuredClone(symbol),
        timeframe: "1d",
        view: "timeframe",
        intradayDays: 1,
        adjustMode: "forward",
        loading: false
      };
      const viewModel = {
        state,
        status: { type: "ready" },
        intradayView: false,
        seriesType: "candles",
        seriesProperties: [],
        seriesVisualOverrides: [] as ChartSeriesVisualOverrides[],
        favoriteTimeframes: [],
        priceScaleMode: "linear",
        indicators: [] as ChartIndicator[],
        drawings: [],
        drawingGroups: [] as ChartDrawingGroup[],
        marks: [],
        comparisons: [],
        comparisonData: [],
        selectedDrawingIds: [],
        bottomPanel: "hidden",
        drawingPalette: "expanded",
        canUndoDrawing: false,
        canRedoDrawing: false,
        gridVisible: true,
        executionsVisible: false,
        replay: { status: "inactive", speed: 1 },
        calculationStatus: { type: "idle" },
        search: { query: "", loading: false, results: [] }
      };
      mocks.viewModel = viewModel;
      return {
        getViewModel: () => viewModel,
        getState: () => structuredClone(state),
        getVisibleRange: mocks.controller.getVisibleRange,
        prepareTimeScaleMutation: mocks.controller.prepareTimeScaleMutation,
        shouldPublishVisibleRange: () => true,
        setMarks: vi.fn(),
        setComparisons: vi.fn(),
        setIndicators: (indicators: readonly ChartIndicator[]) => {
          viewModel.indicators = structuredClone(indicators);
          mocks.controller.setIndicators(indicators);
        },
        setSeriesVisualOverrides: (overrides: ChartSeriesVisualOverrides) => {
          viewModel.seriesVisualOverrides = [
            ...viewModel.seriesVisualOverrides.filter(
              (candidate) => candidate.type !== overrides.type
            ),
            ...(Object.keys(overrides).length === 1 ? [] : [structuredClone(overrides)])
          ];
          mocks.controller.setSeriesVisualOverrides(overrides);
        },
        createDrawingGroup: (drawingIds: readonly string[], name?: string) => {
          const id = mocks.controller.createDrawingGroup(drawingIds, name);
          viewModel.drawingGroups.push({
            id,
            name: name ?? "Group 1",
            drawingIds: [...drawingIds]
          });
          return id;
        },
        setDrawingGroupName: (id: `drawing-group:${string}`, name: string) => {
          viewModel.drawingGroups = viewModel.drawingGroups.map((group) =>
            group.id === id ? { ...group, name } : group
          );
          mocks.controller.setDrawingGroupName(id, name);
        },
        setDrawingGroupMembers: mocks.controller.setDrawingGroupMembers,
        setDrawingGroupVisible: mocks.controller.setDrawingGroupVisible,
        setDrawingGroupLocked: mocks.controller.setDrawingGroupLocked,
        moveDrawingGroup: mocks.controller.moveDrawingGroup,
        ungroupDrawingGroup: mocks.controller.ungroupDrawingGroup,
        deleteDrawingGroupDrawings: mocks.controller.deleteDrawingGroupDrawings,
        setVisibleRange: mocks.controller.setVisibleRange,
        resetToLatest: mocks.controller.resetToLatest,
        undoDrawing: mocks.controller.undoDrawing,
        redoDrawing: mocks.controller.redoDrawing,
        start: () => {
          value.onViewModelChanged?.(viewModel, 1);
          value.onDataLoaded?.({
            state: structuredClone(state),
            dataVersion: "main-v1",
            phase: "initial"
          });
          value.onPresentationReady?.(structuredClone(state));
        },
        deactivate: vi.fn(),
        retry: vi.fn(),
        destroy: vi.fn()
      };
    });
  });

  it("returns one immutable handle and reuses the top-level visible-range path", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options()
    ) as Rc44Chart;
    const first = chart.getTimeScale();
    const second = chart.getTimeScale();

    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.getVisibleRange()).toEqual({ from: 100, to: 200 });
    first.setVisibleRange({ from: 120, to: 180 });
    chart.setVisibleRange({ from: 130, to: 170 });
    expect(mocks.controller.setVisibleRange.mock.calls).toEqual([
      [{ from: 120, to: 180 }],
      [{ from: 130, to: 170 }]
    ]);
  });

  it("exposes one validated drawing-groups controller without a second state store", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options()
    );
    const first = chart.getDrawingGroupsApi();

    expect(chart.getDrawingGroupsApi()).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(() => first.create(["a"], "One")).toThrow();
    expect(() => first.create(["a", "a"], "Duplicate")).toThrow();
    expect(() => first.create(["a", "b"], " ")).toThrow();
    expect(() => first.create(["a", "b"], "x".repeat(257))).toThrow();
    expect(mocks.controller.createDrawingGroup).not.toHaveBeenCalled();

    const id = first.create(["a", "b"], "Plan");
    expect(id).toBe("drawing-group:1");
    expect(first.getAll()).toEqual([
      { id, name: "Plan", drawingIds: ["a", "b"] }
    ]);
    const snapshot = first.getAll() as Array<{ name: string; drawingIds: string[] }>;
    snapshot[0]!.name = "Changed";
    snapshot[0]!.drawingIds.push("changed");
    expect(first.getAll()[0]).toEqual({ id, name: "Plan", drawingIds: ["a", "b"] });

    first.setName(id, "Renamed");
    expect(() => first.setName(id, "x".repeat(257))).toThrow();
    first.setMembers(id, ["b"]);
    first.setVisible(id, false);
    first.setLocked(id, true);
    first.move(id, "front");
    first.ungroup(id);
    first.deleteDrawings(id);

    expect(mocks.controller.setDrawingGroupName).toHaveBeenCalledWith(id, "Renamed");
    expect(mocks.controller.setDrawingGroupName).toHaveBeenCalledTimes(1);
    expect(mocks.controller.setDrawingGroupMembers).toHaveBeenCalledWith(id, ["b"]);
    expect(mocks.controller.setDrawingGroupVisible).toHaveBeenCalledWith(id, false);
    expect(mocks.controller.setDrawingGroupLocked).toHaveBeenCalledWith(id, true);
    expect(mocks.controller.moveDrawingGroup).toHaveBeenCalledWith(id, "front");
    expect(mocks.controller.ungroupDrawingGroup).toHaveBeenCalledWith(id);
    expect(mocks.controller.deleteDrawingGroupDrawings).toHaveBeenCalledWith(id);
    expect(() => first.setVisible(id, "yes" as never)).toThrow();
    expect(() => first.setLocked(id, 1 as never)).toThrow();
    expect(() => first.move(id, "sideways" as never)).toThrow();
    expect(chart.exportLayout().drawingGroups).toEqual([
      { id, name: "Renamed", drawingIds: ["a", "b"] }
    ]);
  });

  it("delegates geometry and viewport operations to the native runtime", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options()
    ) as Rc44Chart;
    const timeScale = chart.getTimeScale();

    expect(timeScale.getBarSpacing()).toBe(8);
    expect(timeScale.getWidth()).toBe(720);
    expect(timeScale.timeToCoordinate(150)).toBe(360);
    expect(timeScale.coordinateToTime(360)).toBe(150);
    timeScale.setBarSpacing(12);
    timeScale.scrollByBars(5);
    timeScale.zoomIn();
    timeScale.zoomOut();
    timeScale.fitContent();
    timeScale.reset();

    expect(mocks.runtime.setBarSpacing).toHaveBeenCalledWith(12);
    expect(mocks.runtime.scrollByBars).toHaveBeenCalledWith(5);
    expect(mocks.runtime.zoomIn).toHaveBeenCalledOnce();
    expect(mocks.runtime.zoomOut).toHaveBeenCalledOnce();
    expect(mocks.runtime.fitContent).toHaveBeenCalledOnce();
    expect(mocks.controller.prepareTimeScaleMutation).toHaveBeenCalledTimes(5);
    expect(mocks.controller.resetToLatest).toHaveBeenCalledWith(false);
  });

  it("rejects invalid public values before mutating runtime or controller state", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options()
    ) as Rc44Chart;
    const timeScale = chart.getTimeScale();

    for (const spacing of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => timeScale.setBarSpacing(spacing)).toThrow();
    }
    for (const bars of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => timeScale.scrollByBars(bars)).toThrow();
    }
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => timeScale.timeToCoordinate(value)).toThrow();
      expect(() => timeScale.coordinateToTime(value)).toThrow();
    }
    expect(() => timeScale.setVisibleRange({ from: 3, to: 2 })).toThrow();
    expect(() => timeScale.setVisibleRange({ from: 1, to: 2, extra: true } as never))
      .toThrow();

    expect(mocks.runtime.setBarSpacing).not.toHaveBeenCalled();
    expect(mocks.runtime.scrollByBars).not.toHaveBeenCalled();
    expect(mocks.runtime.timeToCoordinate).not.toHaveBeenCalled();
    expect(mocks.runtime.coordinateToTime).not.toHaveBeenCalled();
    expect(mocks.controller.setVisibleRange).not.toHaveBeenCalled();
  });

  it("hides and freezes old viewport geometry while the current presentation is unavailable", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options()
    ) as Rc44Chart;
    const timeScale = chart.getTimeScale();
    mocks.controller.getVisibleRange.mockReturnValue(undefined);
    mocks.controller.prepareTimeScaleMutation.mockReturnValue(false);
    vi.mocked(mocks.runtime.timeToCoordinate).mockClear();
    vi.mocked(mocks.runtime.coordinateToTime).mockClear();
    vi.mocked(mocks.runtime.setBarSpacing).mockClear();
    vi.mocked(mocks.runtime.scrollByBars).mockClear();
    vi.mocked(mocks.runtime.zoomIn).mockClear();
    vi.mocked(mocks.runtime.zoomOut).mockClear();
    vi.mocked(mocks.runtime.fitContent).mockClear();
    vi.mocked(mocks.controller.setVisibleRange).mockClear();
    vi.mocked(mocks.controller.resetToLatest).mockClear();
    vi.mocked(mocks.controller.prepareTimeScaleMutation).mockClear();

    expect(timeScale.getVisibleRange()).toBeUndefined();
    expect(timeScale.timeToCoordinate(150)).toBeUndefined();
    expect(timeScale.coordinateToTime(360)).toBeUndefined();
    timeScale.setBarSpacing(12);
    timeScale.scrollByBars(5);
    timeScale.zoomIn();
    timeScale.zoomOut();
    timeScale.fitContent();

    expect(mocks.runtime.timeToCoordinate).not.toHaveBeenCalled();
    expect(mocks.runtime.coordinateToTime).not.toHaveBeenCalled();
    expect(mocks.runtime.setBarSpacing).not.toHaveBeenCalled();
    expect(mocks.runtime.scrollByBars).not.toHaveBeenCalled();
    expect(mocks.runtime.zoomIn).not.toHaveBeenCalled();
    expect(mocks.runtime.zoomOut).not.toHaveBeenCalled();
    expect(mocks.runtime.fitContent).not.toHaveBeenCalled();
    expect(mocks.controller.prepareTimeScaleMutation).toHaveBeenCalledTimes(5);

    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => timeScale.timeToCoordinate(invalid)).toThrow();
      expect(() => timeScale.coordinateToTime(invalid)).toThrow();
    }
    expect(() => timeScale.setBarSpacing(0)).toThrow();
    expect(() => timeScale.scrollByBars(1.5)).toThrow();

    timeScale.setVisibleRange({ from: 120, to: 180 });
    timeScale.reset();
    expect(mocks.controller.setVisibleRange).toHaveBeenCalledWith({ from: 120, to: 180 });
    expect(mocks.controller.resetToLatest).toHaveBeenCalledWith(false);
    expect(mocks.controller.prepareTimeScaleMutation).toHaveBeenCalledTimes(5);
  });

  it("keeps public time-scale validation active for a blocked chart", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      { ...options(), chartId: "" }
    ) as Rc44Chart;
    const timeScale = chart.getTimeScale();

    expect(() => timeScale.setVisibleRange({ from: 3, to: 2 })).toThrow();
    expect(() => timeScale.setVisibleRange({ from: 1, to: 2, extra: true } as never))
      .toThrow();
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => timeScale.timeToCoordinate(invalid)).toThrow();
      expect(() => timeScale.coordinateToTime(invalid)).toThrow();
    }
    expect(() => timeScale.setBarSpacing(0)).toThrow();
    expect(() => timeScale.scrollByBars(1.5)).toThrow();
    expect(() => chart.executeActionById("unknown" as ChartActionId)).toThrow();
    expect(chart.getDrawingGroupsApi().getAll()).toEqual([]);
    expect(() => chart.getDrawingGroupsApi().create(["a", "b"])).toThrowError(
      expect.objectContaining({ name: "InvalidStateError" })
    );

    expect(timeScale.getVisibleRange()).toBeUndefined();
    expect(timeScale.timeToCoordinate(1)).toBeUndefined();
    expect(timeScale.coordinateToTime(1)).toBeUndefined();
    timeScale.setVisibleRange({ from: 1, to: 2 });
    timeScale.setBarSpacing(8);
    timeScale.scrollByBars(1);
    chart.executeActionById("fitContent");
  });

  it("routes only the finite public action identifiers", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options()
    ) as Rc44Chart;

    mocks.runtime.getPanes.mockReturnValueOnce([{
      id: "main",
      kind: "main",
      title: "Main",
      visible: true,
      heightRatio: 3,
      collapsed: false,
      priceScale: {
        mode: "linear",
        autoScale: false,
        inverted: false,
        visibleRange: { from: 90, to: 110 }
      }
    }]);
    chart.executeActionById("timeScaleReset");
    chart.executeActionById("chartReset");
    chart.executeActionById("zoomIn");
    chart.executeActionById("zoomOut");
    chart.executeActionById("fitContent");

    expect(mocks.controller.resetToLatest.mock.calls).toEqual([[false], []]);
    expect(mocks.runtime.setPaneAutoScale).toHaveBeenCalledWith("main", true);
    expect(mocks.runtime.zoomIn).toHaveBeenCalledOnce();
    expect(mocks.runtime.zoomOut).toHaveBeenCalledOnce();
    expect(mocks.runtime.fitContent).toHaveBeenCalledOnce();
    expect(() => chart.executeActionById("unknown" as ChartActionId)).toThrow();
  });

  it("switches chart/table mode atomically without persisting or duplicating events", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options()
    );
    const events: Array<{ type: string; mode?: ChartDisplayMode }> = [];
    chart.subscribeEvents((event) => events.push(event));

    const layout = chart.exportLayout();
    expect(chart.getDisplayMode()).toBe("chart");
    chart.setDisplayMode("table");
    expect(chart.getDisplayMode()).toBe("table");
    expect(mocks.runtime.setDataTableActive).toHaveBeenLastCalledWith(true);
    expect(mocks.runtime.clearTransientInteraction).toHaveBeenCalledOnce();
    expect(mocks.shell.setDisplayMode).toHaveBeenLastCalledWith("table");
    expect(mocks.shell.renderDataTable).toHaveBeenLastCalledWith({
      columns: [],
      rows: [],
      status: "ready"
    });
    expect(chart.exportLayout()).toEqual(layout);
    expect(chart.exportLayout()).not.toHaveProperty("displayMode");
    expect(events).toContainEqual({
      type: "display-mode-changed",
      mode: "table"
    });

    const eventCount = events.length;
    chart.setDisplayMode("table");
    expect(events).toHaveLength(eventCount);
    expect(() => chart.setDisplayMode("invalid" as ChartDisplayMode)).toThrow();
    expect(chart.getDisplayMode()).toBe("table");

    chart.setDisplayMode("chart");
    expect(chart.getDisplayMode()).toBe("chart");
    expect(mocks.runtime.setDataTableActive).toHaveBeenLastCalledWith(false);
    expect(mocks.shell.setDisplayMode).toHaveBeenLastCalledWith("chart");
  });

  it("clears stale table rows with an explicit loading state", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options()
    );
    chart.setDisplayMode("table");
    const viewModel = mocks.viewModel as {
      state: ChartState;
      status: { type: string };
      calculationStatus: { type: string };
    };
    viewModel.state.loading = true;
    const onViewModelChanged = mocks.controllerOptions?.onViewModelChanged as
      | ((value: typeof viewModel, revision: number) => void)
      | undefined;
    onViewModelChanged?.(viewModel, 2);

    expect(mocks.shell.renderDataTable).toHaveBeenLastCalledWith({
      columns: [],
      rows: [],
      status: "loading"
    });
  });

  it("keeps a reentrant display-mode listener on the latest requested mode", () => {
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      options()
    );
    const modes: ChartDisplayMode[] = [];
    chart.subscribeEvents((event) => {
      if (event.type !== "display-mode-changed") return;
      modes.push(event.mode);
      if (event.mode === "table") chart.setDisplayMode("chart");
    });

    chart.setDisplayMode("table");

    expect(modes).toEqual(["table", "chart"]);
    expect(chart.getDisplayMode()).toBe("chart");
    expect(mocks.shell.setDisplayMode).toHaveBeenLastCalledWith("chart");
  });

  it("round-trips rc.45 series and study visual overrides through public handles", () => {
    const configured = {
      ...options(),
      seriesVisualOverrides: [{
        type: "candles" as const,
        upColor: "#ff3355",
        downColor: "#00aa88"
      }]
    };
    const chart = createChart(
      new FakeElement() as unknown as HTMLElement,
      configured
    );
    expect(mocks.controllerOptions?.initialSeriesVisualOverrides).toEqual(
      configured.seriesVisualOverrides
    );

    const lineOverrides = {
      type: "line" as const,
      color: "#5566ff",
      lineWidth: 3
    };
    chart.setSeriesVisualOverrides(lineOverrides);
    lineOverrides.color = "#000000";
    expect(chart.getSeriesVisualOverrides("line")).toEqual({
      type: "line",
      color: "#5566ff",
      lineWidth: 3
    });

    const entityId = chart.createStudy({
      instanceId: "ma-visual",
      id: "MA",
      params: { period: 5 },
      visible: true
    });
    const study = chart.getStudyApi(entityId)!;
    const visualOverrides: ChartStudyOutputVisualOverride[] = [{
      outputId: "MA",
      type: "line",
      color: "#ff00aa",
      lineWidth: 4
    }];
    study.setVisualOverrides(visualOverrides);
    visualOverrides[0] = { outputId: "MA", type: "line", visible: false };
    expect(study.getVisualOverrides()).toEqual([{
      outputId: "MA",
      type: "line",
      color: "#ff00aa",
      lineWidth: 4
    }]);
    expect(chart.exportLayout()).toMatchObject({
      seriesVisualOverrides: [{
        type: "line",
        color: "#5566ff",
        lineWidth: 3
      }],
      indicators: [{
        instanceId: "ma-visual",
        visualOverrides: [{
          outputId: "MA",
          type: "line",
          color: "#ff00aa",
          lineWidth: 4
        }]
      }]
    });

    expect(() => study.setVisualOverrides([{
      outputId: "missing",
      type: "line",
      color: "#fff"
    }])).toThrow();
    expect(() => study.setVisualOverrides(undefined as never)).toThrow(TypeError);
    expect(study.getVisualOverrides()[0]?.outputId).toBe("MA");
  });
});
