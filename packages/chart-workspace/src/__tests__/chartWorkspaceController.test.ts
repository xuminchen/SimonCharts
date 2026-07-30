import { describe, expect, it, vi } from "vitest";
import type { DrawingObject } from "@simoncharts/chart-engine";
import { ChartDatafeedError } from "../index";
import type { ChartDatafeed, ChartSymbol, SeriesPage, SeriesRequest } from "../index";
import {
  createChartController,
  type ChartControllerDependencies
} from "../controller/chartController";
import { createPagedSeriesStore } from "../data/pagedSeriesStore";
import { createDataCoordinator } from "../data/dataCoordinator";
import { validateSeriesPage } from "../data/seriesPageValidation";
import { defaultLayoutState, defaultPreferences } from "../persistence/browserPersistence";

const stock: ChartSymbol = { id: "stock", code: "600000", name: "浦发银行", exchange: "SSE", kind: "stock" };
const index: ChartSymbol = { id: "index", code: "000001", name: "上证指数", exchange: "SSE", kind: "index" };

function dependencies(): ChartControllerDependencies {
  return {
    initialSymbol: stock,
    chartId: "test",
    drawingPersistenceEnabled: true,
    seriesTypePersistenceEnabled: true,
    executionsEnabled: true,
    getCapabilities: vi.fn(async (symbol: ChartSymbol) => ({
      series: [
        { timeframe: "1d", adjustModes: symbol.kind === "index" ? ["none"] : ["none", "forward", "backward"] },
        { timeframe: "5m", adjustModes: ["none"] }
      ]
    })),
    store: createPagedSeriesStore(),
    dataCoordinator: {
      cancel: vi.fn(),
      start: vi.fn(async () => undefined),
      loadMoreBefore: vi.fn(async () => undefined),
      reloadPage: vi.fn(async () => undefined),
      retryInitial: vi.fn(async () => undefined),
      getGeneration: vi.fn(() => 1),
      destroy: vi.fn()
    },
    searchCoordinator: { search: vi.fn(async () => undefined), destroy: vi.fn() },
    runtime: {
      setMaterializedSeries: vi.fn(), getMaterializationDemand: vi.fn(() => ({ visibleCount: 300, overscanCount: 100 })), getVisibleRange: vi.fn(), setVisibleRange: vi.fn(() => true), getBarSpacing: vi.fn(() => 8), setBarSpacing: vi.fn(), getWidth: vi.fn(() => 800), timeToCoordinate: vi.fn(), coordinateToTime: vi.fn(), scrollByBars: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), fitContent: vi.fn(), resetToLatest: vi.fn(), clearCrosshair: vi.fn(), setSeriesType: vi.fn(), setSeriesVisualOverrides: vi.fn(), setIndicators: vi.fn(), setComparisonData: vi.fn(), setMarks: vi.fn(), setExecutions: vi.fn(), setExecutionsVisible: vi.fn(), setPricePrecision: vi.fn(), setPriceScaleMode: vi.fn(), setDrawings: vi.fn(), selectDrawings: vi.fn(), createDrawingGroup: vi.fn(() => "drawing-group:1"), setDrawingGroupName: vi.fn(), setDrawingGroupMembers: vi.fn(), setDrawingGroupVisible: vi.fn(), setDrawingGroupLocked: vi.fn(), moveDrawingGroup: vi.fn(), ungroupDrawingGroup: vi.fn(), deleteDrawingGroupDrawings: vi.fn(), setDrawingTool: vi.fn(), executeDrawingCommand: vi.fn(), undoDrawing: vi.fn(), redoDrawing: vi.fn(), setGridVisible: vi.fn(), cancelCalculations: vi.fn(), retryRender: vi.fn(), getMetrics: vi.fn(() => ({ totalRenderCount: 0, renderCountByPass: { static: 0, dynamic: 0, overlay: 0 }, lastRenderDuration: 0, lastInvalidationReasons: [], dirtyLayerCount: 0, slowFrameCount: 0, maxMaterializedCandleCount: 0 })), destroy: vi.fn()
    },
    persistence: {
      loadLayout: vi.fn(() => structuredClone(defaultLayoutState)), saveLayout: vi.fn(),
      loadPreferences: vi.fn(() => structuredClone(defaultPreferences)), savePreferences: vi.fn(),
      loadIndicators: vi.fn(() => []), saveIndicators: vi.fn(),
      loadDrawingState: vi.fn(() => ({
        drawings: [] as DrawingObject[],
        drawingGroups: []
      })),
      saveDrawingState: vi.fn()
    },
    onError: vi.fn(),
    onViewModelChanged: vi.fn()
  };
}

function replayPage(
  times: readonly number[],
  options: { readonly beforeCursor?: string; readonly hasMoreBefore: boolean }
) {
  const result = validateSeriesPage({
    candles: times.map((time) => ({
      time,
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 1,
      turnover: 10.5
    })),
    ...(options.beforeCursor === undefined ? {} : { beforeCursor: options.beforeCursor }),
    hasMoreBefore: options.hasMoreBefore,
    dataVersion: "v1"
  }, { seenCursors: new Set() });
  if (!result.ok) throw new Error("fixture invalid");
  return result.page;
}

async function prepareEvictedReplay() {
  const deps = dependencies();
  deps.store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
  const selection = { symbol: stock, timeframe: "1d" as const, adjustMode: "forward" as const };
  const newest = replayPage([5, 6, 7], { beforeCursor: "older", hasMoreBefore: true });
  const older = replayPage([1, 2, 3, 4], { hasMoreBefore: false });
  deps.store.reset(selection, "v1");
  deps.store.mergePage(undefined, newest);
  const controller = createChartController(deps);
  controller.handleDataEvent({
    type: "initialPageAccepted",
    selection,
    generation: 1,
    dataVersion: "v1"
  });
  controller.setVisibleRange({ from: 1, to: 4 });
  deps.store.mergePage("older", older);
  controller.handleDataEvent({
    type: "historyPageAccepted",
    selection,
    generation: 1,
    dataVersion: "v1"
  });
  await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith({
    from: 1,
    to: 4
  }));
  return { controller, deps, newest, selection };
}

describe("chart workspace controller", () => {
  it("atomically replaces comparisons, fixes percentage mode, and restores the prior scale", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    const rows = [{
      symbol: {
        id: "stock:SZSE:000001",
        code: "000001",
        name: "平安银行",
        exchange: "SZSE",
        kind: "stock"
      }
    }];

    controller.setComparisons(rows);
    rows[0]!.symbol.name = "changed";
    expect(controller.getViewModel().comparisons).toEqual([{
      symbol: expect.objectContaining({ name: "平安银行" }),
      color: "#2962ff",
      visible: true
    }]);
    expect(controller.getViewModel().priceScaleMode).toBe("percentage");
    expect(deps.runtime.setPriceScaleMode).toHaveBeenLastCalledWith("percentage");
    expect(deps.persistence.savePreferences).toHaveBeenLastCalledWith(
      expect.objectContaining({ priceScaleMode: "linear" })
    );

    controller.setPriceScaleMode("log");
    expect(controller.getViewModel().priceScaleMode).toBe("percentage");

    controller.setComparisons([]);
    expect(controller.getViewModel().comparisons).toEqual([]);
    expect(controller.getViewModel().priceScaleMode).toBe("linear");
    expect(deps.runtime.setPriceScaleMode).toHaveBeenLastCalledWith("linear");
  });

  it("rejects a comparison that duplicates the main symbol without changing state", () => {
    const controller = createChartController(dependencies());

    expect(() => controller.setComparisons([{ symbol: stock }])).toThrow(TypeError);
    expect(controller.getViewModel().comparisons).toEqual([]);
  });

  it("removes a comparison when it becomes the main symbol", () => {
    const deps = dependencies();
    const controller = createChartController(deps);

    controller.setComparisons([{ symbol: index }]);
    controller.setSymbol(index);

    expect(controller.getViewModel().comparisons).toEqual([]);
    expect(controller.getViewModel().priceScaleMode).toBe("linear");
    expect(deps.runtime.setComparisonData).toHaveBeenLastCalledWith([]);
  });

  it("publishes comparison terminal status without retaining candle payloads", () => {
    const controller = createChartController(dependencies());
    controller.setComparisons([{ symbol: index }]);

    controller.handleComparisonData([{
      comparison: controller.getViewModel().comparisons[0]!,
      status: "empty",
      candles: []
    }]);

    expect(controller.getViewModel().comparisonStatuses).toEqual([
      { symbolId: index.id, status: "empty" }
    ]);
    expect(controller.getViewModel()).not.toHaveProperty("comparisonData");
  });

  it("clears search state and cancels work for an empty query", () => {
    const deps = dependencies();
    const controller = createChartController(deps);

    controller.searchSymbols("浦发");
    expect(controller.getViewModel().search).toMatchObject({ query: "浦发", loading: true });
    controller.searchSymbols("");

    expect(controller.getViewModel().search).toEqual({
      query: "",
      loading: false,
      results: []
    });
    expect(deps.searchCoordinator.search).toHaveBeenNthCalledWith(1, "浦发");
    expect(deps.searchCoordinator.search).toHaveBeenNthCalledWith(2, "");
  });

  it("keeps the host-enabled execution switch visible by default", () => {
    const deps = dependencies();
    const controller = createChartController(deps);

    expect(controller.getViewModel().executionsVisible).toBe(true);
    expect(deps.runtime.setExecutionsVisible).toHaveBeenLastCalledWith(true);
    controller.setExecutionsVisible(false);
    expect(controller.getViewModel().executionsVisible).toBe(false);
    expect(deps.runtime.setExecutionsVisible).toHaveBeenLastCalledWith(false);
  });

  it("clears host executions immediately when the symbol changes", () => {
    const deps = dependencies();
    const controller = createChartController(deps);

    controller.setSymbol(index);

    expect(deps.runtime.setExecutions).toHaveBeenCalledWith([]);
    expect(deps.runtime.setMarks).toHaveBeenCalledWith([]);
    expect(controller.getViewModel().marks).toEqual([]);
  });

  it("keeps host marks and does not clear executions when metadata for the same symbol is corrected", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    const marks = [{ id: "m1", time: 2, price: 11, label: "Event" }];
    controller.setMarks(marks);
    vi.mocked(deps.runtime.setMarks).mockClear();
    vi.mocked(deps.runtime.setExecutions).mockClear();

    controller.setSymbol({ ...stock, pricePrecision: 4 });

    expect(deps.runtime.setMarks).not.toHaveBeenCalled();
    expect(deps.runtime.setExecutions).not.toHaveBeenCalled();
    expect(controller.getViewModel().marks).toEqual(marks);
  });

  it("keeps programmatic drawings when metadata for the same symbol is corrected", async () => {
    const deps = dependencies();
    deps.drawingPersistenceEnabled = false;
    const controller = createChartController(deps);
    const drawings: DrawingObject[] = [
      { id: "d1", type: "trendLine", anchors: [{ time: 1, price: 10 }, { time: 2, price: 11 }] }
    ];
    controller.setDrawings(drawings);

    controller.setSymbol({ ...stock, pricePrecision: 4 });

    expect(controller.getViewModel().drawings).toEqual(drawings);
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalled());
    expect(controller.getViewModel().drawings).toEqual(drawings);
  });

  it("replaces programmable drawings and marks through the single controller state", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    const drawings: DrawingObject[] = [
      { id: "d1", type: "trendLine", anchors: [{ time: 1, price: 10 }, { time: 2, price: 11 }] }
    ];
    const marks = [{ id: "m1", time: 2, price: 11, label: "Event" }];

    controller.setDrawings(drawings);
    controller.setMarks(marks);
    drawings[0]!.anchors[0]!.price = 999;

    expect(controller.getViewModel()).toMatchObject({
      drawings: [{ id: "d1", anchors: [{ price: 10 }, { price: 11 }] }],
      marks
    });
    expect(deps.runtime.setDrawings).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "d1" })]),
      [],
      []
    );
    expect(deps.runtime.setMarks).toHaveBeenLastCalledWith(marks);
    expect(deps.persistence.saveDrawingState).toHaveBeenCalledWith(
      stock,
      "forward",
      expect.objectContaining({ drawings: expect.any(Array), drawingGroups: [] })
    );
  });

  it("keeps drawing groups in the same runtime state and persistence document", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    const drawings: DrawingObject[] = [
      { id: "a", type: "trendLine", anchors: [{ time: 1, price: 10 }, { time: 2, price: 11 }] },
      { id: "b", type: "trendLine", anchors: [{ time: 2, price: 11 }, { time: 3, price: 12 }] }
    ];
    const groups = [{
      id: "drawing-group:1" as const,
      name: "Plan",
      drawingIds: ["a", "b"]
    }];

    controller.setDrawings(drawings, ["a"], groups);
    expect(deps.runtime.setDrawings).toHaveBeenLastCalledWith(drawings, ["a"], groups);

    controller.handleDrawingsChanged(drawings, ["a"], groups);
    groups[0]!.name = "Changed";
    expect(controller.getViewModel().drawingGroups[0]?.name).toBe("Plan");
    expect(deps.persistence.saveDrawingState).toHaveBeenLastCalledWith(
      stock,
      "forward",
      expect.objectContaining({
        drawings: expect.any(Array),
        drawingGroups: [{ id: "drawing-group:1", name: "Plan", drawingIds: ["a", "b"] }]
      })
    );

    expect(controller.createDrawingGroup(["a", "b"], "Group")).toBe("drawing-group:1");
    controller.setDrawingGroupName("drawing-group:1", "Renamed");
    controller.setDrawingGroupMembers("drawing-group:1", ["a"]);
    controller.setDrawingGroupVisible("drawing-group:1", false);
    controller.setDrawingGroupLocked("drawing-group:1", true);
    controller.moveDrawingGroup("drawing-group:1", "front");
    controller.ungroupDrawingGroup("drawing-group:1");
    controller.deleteDrawingGroupDrawings("drawing-group:1");

    expect(deps.runtime.createDrawingGroup).toHaveBeenCalledWith(["a", "b"], "Group");
    expect(deps.runtime.setDrawingGroupName).toHaveBeenCalledWith("drawing-group:1", "Renamed");
    expect(deps.runtime.setDrawingGroupMembers).toHaveBeenCalledWith("drawing-group:1", ["a"]);
    expect(deps.runtime.setDrawingGroupVisible).toHaveBeenCalledWith("drawing-group:1", false);
    expect(deps.runtime.setDrawingGroupLocked).toHaveBeenCalledWith("drawing-group:1", true);
    expect(deps.runtime.moveDrawingGroup).toHaveBeenCalledWith("drawing-group:1", "front");
    expect(deps.runtime.ungroupDrawingGroup).toHaveBeenCalledWith("drawing-group:1");
    expect(deps.runtime.deleteDrawingGroupDrawings).toHaveBeenCalledWith("drawing-group:1");
  });

  it("keeps drawing selection when the same presentation rematerializes", async () => {
    const deps = dependencies();
    const valid = validateSeriesPage({
      candles: [{
        time: 1,
        open: 10,
        high: 11,
        low: 9,
        close: 10,
        volume: 1,
        turnover: 10
      }],
      hasMoreBefore: false,
      dataVersion: "v1"
    }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const controller = createChartController(deps);
    controller.handleDrawingsChanged([{
      id: "d1",
      type: "trendLine",
      anchors: [{ time: 1, price: 10 }, { time: 2, price: 11 }]
    }], ["d1"]);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });

    expect(deps.runtime.setDrawings).toHaveBeenLastCalledWith(
      expect.any(Array),
      ["d1"],
      []
    );
  });

  it("rejects invalid indicator batches at the controller write boundary", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    const indicators = Array.from({ length: 33 }, (_, index) => ({
      instanceId: `ma-${index}`,
      id: "MA" as const,
      params: { period: index + 1 },
      visible: true
    }));

    expect(() => controller.setIndicators(indicators)).toThrow("at most 32");
    expect(controller.getViewModel().indicators).toEqual([]);
    expect(deps.persistence.saveIndicators).not.toHaveBeenCalled();
  });

  it("does not load or save drawings when every drawing surface is disabled", async () => {
    const deps = dependencies();
    deps.drawingPersistenceEnabled = false;
    const controller = createChartController(deps);

    expect(deps.persistence.loadDrawingState).not.toHaveBeenCalled();
    controller.start();
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    expect(deps.persistence.loadDrawingState).not.toHaveBeenCalled();

    controller.handleDrawingsChanged([
      {
        id: "d1",
        type: "trendLine",
        anchors: [{ time: 1, price: 10 }, { time: 2, price: 11 }],
        interactive: false,
        affectsPriceScale: true
      }
    ]);
    expect(deps.persistence.saveDrawingState).not.toHaveBeenCalled();
  });

  it("keeps drawing persistence active when a drawing surface is enabled", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    const drawings: DrawingObject[] = [
      { id: "d1", type: "trendLine", anchors: [{ time: 1, price: 10 }, { time: 2, price: 11 }] }
    ];

    expect(deps.persistence.loadDrawingState).toHaveBeenCalledWith(stock, "forward");
    controller.handleDrawingsChanged(drawings);
    expect(deps.persistence.saveDrawingState).toHaveBeenCalledWith(stock, "forward", {
      drawings,
      drawingGroups: []
    });
  });

  it("keeps minimal series presets transient while advanced charts retain their preference", () => {
    const minimal = dependencies();
    minimal.seriesTypePersistenceEnabled = false;
    minimal.persistence.loadPreferences = vi.fn(() => ({
      ...structuredClone(defaultPreferences),
      seriesType: "area"
    }));
    const minimalController = createChartController(minimal);

    expect(minimalController.getViewModel().seriesType).toBe("candles");
    minimalController.setSeriesType("line");
    expect(minimal.persistence.savePreferences).not.toHaveBeenCalled();
    minimalController.setGridVisible(false);
    expect(minimal.persistence.savePreferences).toHaveBeenLastCalledWith({
      seriesType: "area",
      favoriteTimeframes: defaultPreferences.favoriteTimeframes,
      priceScaleMode: "linear",
      gridVisible: false
    });

    const advanced = dependencies();
    advanced.persistence.loadPreferences = vi.fn(() => ({
      ...structuredClone(defaultPreferences),
      seriesType: "area"
    }));
    const advancedController = createChartController(advanced);

    expect(advancedController.getViewModel().seriesType).toBe("area");
    advancedController.setSeriesType("line");
    expect(advanced.persistence.savePreferences).toHaveBeenLastCalledWith({
      seriesType: "line",
      favoriteTimeframes: defaultPreferences.favoriteTimeframes,
      priceScaleMode: "linear",
      gridVisible: true
    });
  });

  it("retains per-type series properties and recalculates only the active synthetic type", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    vi.mocked(deps.runtime.setSeriesType).mockClear();
    vi.mocked(deps.persistence.savePreferences).mockClear();

    controller.setSeriesProperties({ type: "renko", brickSize: 4 });
    expect(controller.getViewModel().seriesProperties).toEqual([
      { type: "renko", brickSize: 4 }
    ]);
    expect(deps.runtime.setSeriesType).not.toHaveBeenCalled();
    expect(deps.persistence.savePreferences).toHaveBeenLastCalledWith({
      ...defaultPreferences,
      seriesProperties: [{ type: "renko", brickSize: 4 }]
    });

    controller.setSeriesType("renko");
    expect(deps.runtime.setSeriesType).toHaveBeenLastCalledWith(
      "renko",
      { type: "renko", brickSize: 4 }
    );
    vi.mocked(deps.runtime.setSeriesType).mockClear();
    controller.setSeriesProperties({ type: "renko", brickSize: 5 });
    expect(deps.runtime.setSeriesType).toHaveBeenCalledTimes(1);
    expect(deps.runtime.setSeriesType).toHaveBeenLastCalledWith(
      "renko",
      { type: "renko", brickSize: 5 }
    );

    expect(() => controller.setSeriesProperties({
      type: "lineBreak",
      lineCount: 0
    })).toThrow();
    expect(controller.getViewModel().seriesProperties).toEqual([
      { type: "renko", brickSize: 5 }
    ]);
  });

  it("treats identical series properties as a no-op and omits restored defaults", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    controller.setSeriesProperties({ type: "lineBreak", lineCount: 4 });
    controller.setSeriesProperties({ type: "renko", brickSize: 2 });
    vi.mocked(deps.persistence.savePreferences).mockClear();

    controller.setSeriesProperties({ type: "lineBreak", lineCount: 4 });
    expect(deps.persistence.savePreferences).not.toHaveBeenCalled();

    controller.setSeriesProperties({ type: "renko", brickSize: 1 });
    expect(controller.getViewModel().seriesProperties).toEqual([
      { type: "lineBreak", lineCount: 4 }
    ]);
    expect(deps.persistence.savePreferences).toHaveBeenLastCalledWith({
      ...defaultPreferences,
      seriesProperties: [{ type: "lineBreak", lineCount: 4 }]
    });
  });

  it("stores synthetic properties during intraday without changing its fixed line series", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    controller.setView("intraday");
    vi.mocked(deps.runtime.setSeriesType).mockClear();

    controller.setSeriesProperties({ type: "renko", brickSize: 6 });

    expect(controller.getViewModel()).toMatchObject({
      intradayView: true,
      seriesType: "line",
      seriesProperties: [{ type: "renko", brickSize: 6 }]
    });
    expect(deps.runtime.setSeriesType).not.toHaveBeenCalled();
  });

  it("gives explicit chart series properties precedence over saved preferences", () => {
    const deps = dependencies();
    deps.persistence.loadPreferences = vi.fn(() => ({
      ...structuredClone(defaultPreferences),
      seriesProperties: [
        { type: "renko", brickSize: 2 },
        { type: "lineBreak", lineCount: 4 }
      ]
    }));
    deps.initialSeriesProperties = [{ type: "renko", brickSize: 5 }];

    const controller = createChartController(deps);
    expect(controller.getViewModel().seriesProperties).toEqual([
      { type: "lineBreak", lineCount: 4 },
      { type: "renko", brickSize: 5 }
    ]);
  });

  it("normalizes default-valued initial series properties out of sparse state", () => {
    const deps = dependencies();
    deps.persistence.loadPreferences = vi.fn(() => ({
      ...structuredClone(defaultPreferences),
      seriesProperties: [
        { type: "renko", brickSize: 1 },
        { type: "lineBreak", lineCount: 4 }
      ]
    }));
    deps.initialSeriesProperties = [{ type: "kagi", reversalAmount: 2 }];

    const controller = createChartController(deps);
    expect(controller.getViewModel().seriesProperties).toEqual([
      { type: "lineBreak", lineCount: 4 }
    ]);
  });

  it("stores sparse series visual overrides and applies only the active series type", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    vi.mocked(deps.runtime.setSeriesVisualOverrides).mockClear();
    vi.mocked(deps.persistence.savePreferences).mockClear();

    controller.setSeriesVisualOverrides({
      type: "line",
      color: "#2962ff",
      lineWidth: 2
    });
    expect(controller.getViewModel().seriesVisualOverrides).toEqual([
      { type: "line", color: "#2962ff", lineWidth: 2 }
    ]);
    expect(deps.runtime.setSeriesVisualOverrides).not.toHaveBeenCalled();

    const candles = {
      type: "candles" as const,
      upColor: "#ef4444",
      downColor: "#22c55e"
    };
    controller.setSeriesVisualOverrides(candles);
    candles.upColor = "#000000";

    expect(controller.getViewModel().seriesVisualOverrides).toEqual([
      { type: "line", color: "#2962ff", lineWidth: 2 },
      { type: "candles", upColor: "#ef4444", downColor: "#22c55e" }
    ]);
    expect(deps.runtime.setSeriesVisualOverrides).toHaveBeenLastCalledWith({
      type: "candles",
      upColor: "#ef4444",
      downColor: "#22c55e"
    });
    expect(deps.persistence.savePreferences).toHaveBeenLastCalledWith({
      ...defaultPreferences,
      seriesVisualOverrides: [
        { type: "line", color: "#2962ff", lineWidth: 2 },
        { type: "candles", upColor: "#ef4444", downColor: "#22c55e" }
      ]
    });

    vi.mocked(deps.runtime.setSeriesVisualOverrides).mockClear();
    controller.setSeriesType("line");
    expect(deps.runtime.setSeriesVisualOverrides).toHaveBeenLastCalledWith({
      type: "line",
      color: "#2962ff",
      lineWidth: 2
    });

    controller.setSeriesVisualOverrides({ type: "line" });
    expect(controller.getViewModel().seriesVisualOverrides).toEqual([
      { type: "candles", upColor: "#ef4444", downColor: "#22c55e" }
    ]);
    expect(deps.runtime.setSeriesVisualOverrides).toHaveBeenLastCalledWith({
      type: "line"
    });

    vi.mocked(deps.runtime.setSeriesVisualOverrides).mockClear();
    controller.setSeriesType("area");
    expect(deps.runtime.setSeriesVisualOverrides).toHaveBeenCalledWith(undefined);
  });

  it("gives explicit series visual overrides precedence and preserves saved values when persistence is disabled", () => {
    const deps = dependencies();
    deps.seriesTypePersistenceEnabled = false;
    deps.persistence.loadPreferences = vi.fn(() => ({
      ...structuredClone(defaultPreferences),
      seriesType: "line",
      seriesVisualOverrides: [
        { type: "line", color: "#111111" },
        { type: "candles", upColor: "#222222" }
      ]
    }));
    deps.initialSeriesVisualOverrides = [
      { type: "candles", upColor: "#ef4444", downColor: "#22c55e" }
    ];

    const controller = createChartController(deps);
    expect(controller.getViewModel().seriesVisualOverrides).toEqual([
      { type: "candles", upColor: "#ef4444", downColor: "#22c55e" }
    ]);
    expect(deps.runtime.setSeriesVisualOverrides).toHaveBeenLastCalledWith({
      type: "candles",
      upColor: "#ef4444",
      downColor: "#22c55e"
    });

    controller.setGridVisible(false);
    expect(deps.persistence.savePreferences).toHaveBeenLastCalledWith({
      seriesType: "line",
      favoriteTimeframes: defaultPreferences.favoriteTimeframes,
      priceScaleMode: "linear",
      gridVisible: false,
      seriesVisualOverrides: [
        { type: "line", color: "#111111" },
        { type: "candles", upColor: "#222222" }
      ]
    });
  });

  it("merges persisted series visual overrides behind explicit options by series type", () => {
    const deps = dependencies();
    deps.persistence.loadPreferences = vi.fn(() => ({
      ...structuredClone(defaultPreferences),
      seriesVisualOverrides: [
        { type: "line", color: "#111111" },
        { type: "candles", upColor: "#222222" }
      ]
    }));
    deps.initialSeriesVisualOverrides = [
      { type: "candles", upColor: "#ef4444", downColor: "#22c55e" }
    ];

    const controller = createChartController(deps);

    expect(controller.getViewModel().seriesVisualOverrides).toEqual([
      { type: "line", color: "#111111" },
      { type: "candles", upColor: "#ef4444", downColor: "#22c55e" }
    ]);
    expect(deps.runtime.setSeriesVisualOverrides).toHaveBeenLastCalledWith({
      type: "candles",
      upColor: "#ef4444",
      downColor: "#22c55e"
    });
  });

  it("caps timeframe favorites at four without changing the active market selection", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    const initialState = controller.getState();

    expect(controller.setFavoriteTimeframe("30m", true)).toBe(false);
    expect(controller.getViewModel().favoriteTimeframes).toEqual(defaultPreferences.favoriteTimeframes);
    expect(deps.persistence.savePreferences).not.toHaveBeenCalled();

    expect(controller.setFavoriteTimeframe("60m", false)).toBe(true);
    expect(controller.getViewModel().favoriteTimeframes).not.toContain("60m");
    expect(controller.setFavoriteTimeframe("30m", true)).toBe(true);
    expect(controller.getViewModel().favoriteTimeframes).toEqual(["15m", "1d", "intraday", "30m"]);
    expect(deps.persistence.savePreferences).toHaveBeenLastCalledWith({
      ...defaultPreferences,
      favoriteTimeframes: ["15m", "1d", "intraday", "30m"]
    });
    expect(controller.getState()).toEqual(initialState);
    expect(deps.dataCoordinator.start).not.toHaveBeenCalled();
  });

  it("loads capabilities, normalizes index adjustment, and rejects unsupported selections", async () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    controller.setAdjustMode("backward");
    expect(deps.dataCoordinator.start).toHaveBeenCalledWith(expect.objectContaining({ adjustMode: "backward" }));
    vi.mocked(deps.dataCoordinator.start).mockClear();
    controller.setTimeframe("1m");
    expect(deps.dataCoordinator.start).not.toHaveBeenCalled();
    controller.setTimeframe("5m");
    expect(controller.getState()).toMatchObject({ timeframe: "5m", adjustMode: "none" });
    expect(deps.dataCoordinator.start).toHaveBeenCalledWith(expect.objectContaining({ timeframe: "5m", adjustMode: "none" }));
    vi.mocked(deps.dataCoordinator.start).mockClear();
    controller.setAdjustMode("forward");
    expect(deps.dataCoordinator.start).not.toHaveBeenCalled();

    controller.setSymbol(index);
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    expect(controller.getState().adjustMode).toBe("none");
    expect(controller.getState().capabilities?.series[0]?.adjustModes).toEqual(["none"]);
    expect(deps.dataCoordinator.start).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: index, adjustMode: "none" }));
    vi.mocked(deps.dataCoordinator.start).mockClear();
    controller.setAdjustMode("forward");
    expect(controller.getState().adjustMode).toBe("none");
    expect(deps.dataCoordinator.start).not.toHaveBeenCalled();
  });

  it("aborts stale capability and data requests when the symbol changes", async () => {
    let resolveFirst!: (value: { series: readonly [{ timeframe: "1d"; adjustModes: readonly ["forward"] }] }) => void;
    const first = new Promise<{ series: readonly [{ timeframe: "1d"; adjustModes: readonly ["forward"] }] }>(
      (resolve) => { resolveFirst = resolve; }
    );
    const signals: AbortSignal[] = [];
    const deps = dependencies();
    deps.getCapabilities = vi.fn((symbol, signal) => {
      signals.push(signal);
      return symbol.id === stock.id
        ? first
        : Promise.resolve({ series: [{ timeframe: "1d" as const, adjustModes: ["none" as const] }] });
    });
    const controller = createChartController(deps);

    controller.start();
    controller.setSymbol(index);
    resolveFirst({ series: [{ timeframe: "1d", adjustModes: ["forward"] }] });

    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    expect(signals[0].aborted).toBe(true);
    expect(deps.dataCoordinator.cancel).toHaveBeenCalledTimes(2);
    expect(deps.dataCoordinator.start).toHaveBeenCalledWith(expect.objectContaining({ symbol: index }));
  });

  it("applies latest selection intents issued while capabilities are pending", async () => {
    let resolveCapabilities!: (value: {
      series: readonly [
        { timeframe: "1m"; adjustModes: readonly ["none", "backward"] },
        { timeframe: "5m"; adjustModes: readonly ["none"] }
      ];
    }) => void;
    const pending = new Promise<{
      series: readonly [
        { timeframe: "1m"; adjustModes: readonly ["none", "backward"] },
        { timeframe: "5m"; adjustModes: readonly ["none"] }
      ];
    }>((resolve) => { resolveCapabilities = resolve; });
    const deps = dependencies();
    deps.getCapabilities = vi.fn(() => pending);
    const controller = createChartController(deps);

    controller.start();
    controller.setTimeframe("5m");
    controller.setAdjustMode("backward");
    controller.setView("intraday");
    expect(controller.getState()).toMatchObject({
      timeframe: "1m",
      adjustMode: "backward",
      view: "intraday",
      loading: true
    });
    expect(controller.getViewModel().seriesType).toBe("line");
    resolveCapabilities({
      series: [
        { timeframe: "1m", adjustModes: ["none", "backward"] },
        { timeframe: "5m", adjustModes: ["none"] }
      ]
    });

    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    expect(deps.dataCoordinator.start).toHaveBeenCalledWith(expect.objectContaining({
      timeframe: "1m",
      adjustMode: "backward"
    }));
    expect(controller.getState()).toMatchObject({
      timeframe: "1m",
      adjustMode: "backward",
      view: "intraday"
    });
  });

  it("falls an immediate pending intraday request back to timeframe when 1m is unsupported", async () => {
    let resolveCapabilities!: (value: {
      series: readonly [{ timeframe: "5m"; adjustModes: readonly ["forward"] }];
    }) => void;
    const pending = new Promise<{
      series: readonly [{ timeframe: "5m"; adjustModes: readonly ["forward"] }];
    }>((resolve) => { resolveCapabilities = resolve; });
    const deps = dependencies();
    deps.getCapabilities = vi.fn(() => pending);
    const controller = createChartController(deps);

    controller.start();
    controller.setView("intraday");
    resolveCapabilities({ series: [{ timeframe: "5m", adjustModes: ["forward"] }] });

    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    expect(controller.getState()).toMatchObject({ timeframe: "5m", view: "timeframe" });
    expect(controller.getViewModel()).toMatchObject({
      intradayView: false,
      seriesType: "candles"
    });
  });

  it("does not start a capability request invalidated synchronously by a publish listener", () => {
    const deps = dependencies();
    let controller!: ReturnType<typeof createChartController>;
    deps.onViewModelChanged = vi.fn(() => controller.destroy());
    controller = createChartController(deps);

    controller.start();

    expect(deps.getCapabilities).not.toHaveBeenCalled();
    expect(deps.dataCoordinator.destroy).toHaveBeenCalledTimes(1);
  });

  it("starts only the replacement symbol capability request after a publish-listener reentry", async () => {
    const deps = dependencies();
    let controller!: ReturnType<typeof createChartController>;
    let replaced = false;
    deps.onViewModelChanged = vi.fn(() => {
      if (!replaced) {
        replaced = true;
        controller.setSymbol(index);
      }
    });
    controller = createChartController(deps);

    controller.start();

    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    expect(deps.getCapabilities).toHaveBeenCalledTimes(1);
    expect(deps.getCapabilities).toHaveBeenCalledWith(index, expect.any(AbortSignal));
    expect(deps.dataCoordinator.start).toHaveBeenCalledWith(expect.objectContaining({ symbol: index }));
  });

  it("assigns retry only to recoverable blocking initial-data or render errors", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    controller.retry();
    expect(deps.dataCoordinator.retryInitial).not.toHaveBeenCalled();
    expect(deps.runtime.retryRender).not.toHaveBeenCalled();

    controller.handleDataEvent({ type: "initialRequestFailed", error: new Error("provider body secret") });
    expect(controller.getViewModel().status).toMatchObject({ type: "blocked", error: { code: "INITIAL_DATA_FAILED" } });
    expect(JSON.stringify(controller.getViewModel())).not.toContain("provider body secret");
    controller.retry();
    expect(deps.dataCoordinator.retryInitial).toHaveBeenCalledTimes(1);

    controller.handleRenderError(new Error("canvas failed"));
    expect(controller.getViewModel().status).toMatchObject({
      type: "blocked",
      error: { code: "INITIAL_DATA_FAILED" }
    });
    controller.retry();
    expect(deps.dataCoordinator.retryInitial).toHaveBeenCalledTimes(2);
    expect(deps.runtime.retryRender).not.toHaveBeenCalled();

    const renderDeps = dependencies();
    const renderController = createChartController(renderDeps);
    renderController.handleRenderError(new Error("canvas failed"));
    renderController.retry();
    expect(renderDeps.runtime.retryRender).toHaveBeenCalledTimes(1);

    const calculationDeps = dependencies();
    const calculationController = createChartController(calculationDeps);
    calculationController.handleRenderError(new Error("calculation failed"), "indicator");
    expect(calculationController.getViewModel().status).toMatchObject({
      type: "blocked",
      error: {
        code: "CALCULATION_FAILED",
        scope: "calculation",
        context: { calculationKind: "indicator" }
      }
    });
  });

  it("preserves typed safe data-source failures and their retry policy", async () => {
    const capabilityDeps = dependencies();
    capabilityDeps.getCapabilities = vi.fn(async () => {
      throw new ChartDatafeedError("NOT_CONFIGURED", "尚未配置授权行情源", false);
    });
    const capabilityController = createChartController(capabilityDeps);
    capabilityController.start();
    await vi.waitFor(() => expect(capabilityController.getViewModel().status.type).toBe("blocked"));
    expect(capabilityController.getViewModel().status).toMatchObject({
      error: {
        code: "INITIAL_DATA_FAILED",
        message: "尚未配置授权行情源",
        recoverable: false,
        context: { datafeedCode: "NOT_CONFIGURED" }
      }
    });
    capabilityController.retry();
    expect(capabilityDeps.getCapabilities).toHaveBeenCalledTimes(1);

    const loadDeps = dependencies();
    const loadController = createChartController(loadDeps);
    loadController.handleDataEvent({
      type: "initialRequestFailed",
      error: new ChartDatafeedError("RATE_LIMITED", "行情服务限额已用尽", true)
    });
    expect(loadController.getViewModel().status).toMatchObject({
      error: {
        code: "INITIAL_DATA_FAILED",
        message: "行情服务限额已用尽",
        recoverable: true,
        context: { datafeedCode: "RATE_LIMITED" }
      }
    });
    loadController.retry();
    expect(loadDeps.dataCoordinator.retryInitial).toHaveBeenCalledTimes(1);
  });

  it("keeps history, search, and storage errors nonblocking and ignores AbortError", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    controller.handleDataEvent({ type: "historyRequestFailed", cursor: "older", error: new Error("offline") });
    expect(controller.getViewModel().status.type).toBe("readyWithWarning");
    controller.handleSearchEvent({ type: "searchFailed", query: "x", code: "SYMBOL_SEARCH_FAILED", error: new Error("bad") });
    expect(controller.getViewModel().status.type).toBe("readyWithWarning");
    deps.onError.mockImplementationOnce(() => { throw new Error("host callback"); });
    expect(() => controller.handleStorageError({
      code: "STORAGE_WRITE_FAILED",
      scope: "storage",
      recoverable: true,
      message: "storage"
    })).not.toThrow();
    expect(controller.getViewModel().status.type).toBe("readyWithWarning");
    const before = controller.getViewModel();
    controller.handleDataEvent({ type: "initialRequestFailed", error: new DOMException("aborted", "AbortError") });
    expect(controller.getViewModel()).toEqual(before);
  });

  it("publishes search failure even when the host error callback throws", () => {
    const deps = dependencies();
    const controller = createChartController(deps);
    controller.searchSymbols("x");
    deps.onError.mockImplementationOnce(() => { throw new Error("host callback"); });

    expect(() => controller.handleSearchEvent({
      type: "searchFailed",
      query: "x",
      code: "SYMBOL_SEARCH_FAILED",
      error: new Error("bad")
    })).not.toThrow();

    expect(controller.getViewModel().search).toMatchObject({
      query: "x",
      loading: false,
      error: { code: "SYMBOL_SEARCH_FAILED" }
    });
    expect(deps.onViewModelChanged).toHaveBeenLastCalledWith(expect.objectContaining({
      search: expect.objectContaining({ error: expect.any(Object) })
    }), expect.any(Number));
  });

  it("materializes an accepted page and destroys dependencies once", () => {
    const deps = dependencies();
    const clearStore = vi.spyOn(deps.store, "clear");
    deps.onDataLoaded = vi.fn();
    const valid = validateSeriesPage({ candles: [{ time: 1, open: 10, high: 11, low: 9, close: 10.5, volume: 1, turnover: 10.5 }], hasMoreBefore: false, dataVersion: "v1" }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const controller = createChartController(deps);
    controller.handleDataEvent({ type: "initialPageAccepted", selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" }, generation: 1, dataVersion: "v1" });
    expect(deps.runtime.setMaterializedSeries).toHaveBeenCalled();
    expect(deps.onDataLoaded).toHaveBeenCalledWith({
      state: expect.objectContaining({ loading: false, view: "timeframe" }),
      dataVersion: "v1",
      phase: "initial"
    });
    expect(controller.getViewModel().status.type).toBe("ready");
    vi.mocked(deps.runtime.getVisibleRange).mockReturnValue({ from: 1, to: 1 });
    expect(controller.getVisibleRange()).toEqual({ from: 1, to: 1 });
    controller.setDrawings([{
      id: "retained",
      type: "trendLine",
      anchors: [{ time: 1, price: 10 }, { time: 2, price: 11 }]
    }]);
    controller.setMarks([{ id: "retained", time: 1, price: 10 }]);

    vi.mocked(deps.dataCoordinator.destroy).mockImplementationOnce(() => controller.destroy());
    controller.destroy();
    controller.destroy();
    expect(controller.getVisibleRange()).toBeUndefined();
    expect(controller.getViewModel().drawings).toEqual([]);
    expect(controller.getViewModel().marks).toEqual([]);
    expect(deps.runtime.destroy).toHaveBeenCalledTimes(1);
    expect(deps.dataCoordinator.destroy).toHaveBeenCalledTimes(1);
    expect(deps.searchCoordinator.destroy).toHaveBeenCalledTimes(1);
    expect(clearStore).toHaveBeenCalledTimes(1);
  });

  it("replays only accepted candles at or before the cursor and restores the full series", () => {
    const deps = dependencies();
    const valid = validateSeriesPage({
      candles: Array.from({ length: 5 }, (_, index) => ({
        time: index + 1,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      hasMoreBefore: false,
      dataVersion: "v1"
    }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.getViewModel().replay).toEqual({
      status: "paused",
      speed: 1,
      cursorTime: 3
    });
    expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].series.candles)
      .toEqual(valid.page.candles.slice(0, 3));

    expect(controller.stepReplay()).toBe(true);
    expect(controller.getViewModel().replay.cursorTime).toBe(4);
    expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].series.candles)
      .toEqual(valid.page.candles.slice(0, 4));

    controller.stopReplay();
    expect(controller.getViewModel().replay).toEqual({ status: "inactive", speed: 1 });
    expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].series.candles)
      .toEqual(valid.page.candles);

    expect(controller.startReplay(2)).toBe(true);
    controller.setSymbol(index);
    expect(controller.getViewModel().replay).toEqual({ status: "inactive", speed: 1 });
  });

  it("does not start replay for an unavailable or terminal candle", () => {
    const deps = dependencies();
    const valid = validateSeriesPage({
      candles: [1, 2].map((time) => ({
        time,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      hasMoreBefore: false,
      dataVersion: "v1"
    }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });
    const calls = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.length;

    expect(controller.startReplay(99)).toBe(false);
    expect(controller.startReplay(2)).toBe(false);
    expect(controller.getViewModel().replay).toEqual({ status: "inactive", speed: 1 });
    expect(deps.runtime.setMaterializedSeries).toHaveBeenCalledTimes(calls);
  });

  it("does not advance playback while the current calculation is pending", () => {
    vi.useFakeTimers();
    try {
      const deps = dependencies();
      const valid = validateSeriesPage({
        candles: [1, 2, 3].map((time) => ({
          time,
          open: 10,
          high: 11,
          low: 9,
          close: 10.5,
          volume: 1,
          turnover: 10.5
        })),
        hasMoreBefore: false,
        dataVersion: "v1"
      }, { seenCursors: new Set() });
      if (!valid.ok) throw new Error("fixture invalid");
      deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
      deps.store.mergePage(undefined, valid.page);
      const controller = createChartController(deps);
      controller.handleDataEvent({
        type: "initialPageAccepted",
        selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
        generation: 1,
        dataVersion: "v1"
      });
      controller.startReplay(1);
      controller.playReplay();
      controller.handleCalculationStatus({
        type: "calculating",
        kind: "indicator",
        id: "MA",
        generation: 1
      });

      vi.advanceTimersByTime(1_000);
      expect(controller.getViewModel().replay.cursorTime).toBe(1);
      controller.handleCalculationStatus({ type: "idle" });
      vi.advanceTimersByTime(1_000);
      expect(controller.getViewModel().replay.cursorTime).toBe(2);
      controller.destroy();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauses replay immediately when rendering becomes blocked", () => {
    vi.useFakeTimers();
    try {
      const deps = dependencies();
      const valid = validateSeriesPage({
        candles: [1, 4, 9].map((time) => ({
          time,
          open: 10,
          high: 11,
          low: 9,
          close: 10.5,
          volume: 1,
          turnover: 10.5
        })),
        hasMoreBefore: false,
        dataVersion: "v1"
      }, { seenCursors: new Set() });
      if (!valid.ok) throw new Error("fixture invalid");
      deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
      deps.store.mergePage(undefined, valid.page);
      const controller = createChartController(deps);
      controller.handleDataEvent({
        type: "initialPageAccepted",
        selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
        generation: 1,
        dataVersion: "v1"
      });

      expect(controller.startReplay(1)).toBe(true);
      controller.playReplay();
      controller.handleRenderError(new Error("controlled render failure"));
      expect(controller.getViewModel().replay).toEqual({
        status: "paused",
        speed: 1,
        cursorTime: 1
      });
      expect(vi.getTimerCount()).toBe(0);
      controller.playReplay();
      vi.advanceTimersByTime(2_000);
      expect(controller.getViewModel().replay.cursorTime).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rematerializes both directions inside a cached page before requesting remote history", async () => {
    const deps = dependencies();
    const candles = Array.from({ length: 2_000 }, (_, index) => ({
      time: index + 1,
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 1,
      turnover: 10.5
    }));
    const valid = validateSeriesPage(
      { candles, hasMoreBefore: false, dataVersion: "v1" },
      { seenCursors: new Set() }
    );
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const controller = createChartController(deps);

    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });
    const latest = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    expect(latest?.sourceMinTime).toBe(1_501);

    controller.handleMaterializedBoundary("before", latest?.sourceMinTime);
    await vi.waitFor(() => expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].sourceMinTime).toBe(1_251));
    await Promise.resolve();
    const older = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    controller.handleMaterializedBoundary("after", older?.sourceMaxTime);
    await vi.waitFor(() => expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].sourceMaxTime).toBe(1_999));
    await Promise.resolve();
    const newer = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    controller.handleMaterializedBoundary("after", newer?.sourceMaxTime);
    await vi.waitFor(() => expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].sourceMaxTime).toBe(2_000));
    expect(deps.dataCoordinator.loadMoreBefore).not.toHaveBeenCalled();
  });

  it("continues replay across cached materialized windows using actual candle times", async () => {
    const deps = dependencies();
    const times = Array.from({ length: 2_000 }, (_, index) => index * 3 + 1);
    const valid = validateSeriesPage({
      candles: times.map((time) => ({
        time,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      hasMoreBefore: false,
      dataVersion: "v1"
    }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const controller = createChartController(deps);

    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });
    const latest = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    controller.handleMaterializedBoundary("before", latest?.sourceMinTime);
    await vi.waitFor(() => {
      expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].sourceMinTime)
        .toBe(times[1_250]);
    });
    const older = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    const cursor = older.series.candles.at(-2)!.time;
    const next = older.series.candles.at(-1)!.time;
    const afterWindow = times[times.indexOf(next) + 1]!;

    expect(controller.startReplay(cursor)).toBe(true);
    expect(controller.stepReplay()).toBe(true);
    expect(controller.getViewModel().replay.cursorTime).toBe(next);
    expect(controller.stepReplay()).toBe(true);
    expect(controller.getViewModel().replay.cursorTime).toBe(afterWindow);
    expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].sourceMaxTime)
      .toBeGreaterThanOrEqual(afterWindow);
  });

  it("reloads an evicted newer page before advancing replay across the cache boundary", async () => {
    const { controller, deps, newest, selection } = await prepareEvictedReplay();
    deps.onDataLoaded = vi.fn();
    deps.onPresentationPending = vi.fn();
    deps.onPresentationReady = vi.fn();
    vi.mocked(deps.dataCoordinator.reloadPage).mockImplementation(async (cursor) => {
      expect(cursor).toBeUndefined();
      expect(deps.store.mergePage(undefined, newest)).toEqual({ ok: true });
      controller.handleDataEvent({
        type: "historyPageAccepted",
        selection,
        generation: 1,
        dataVersion: "v1"
      });
    });

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay(2)).toBe(true);
    expect(controller.getViewModel().replay.cursorTime).toBe(3);
    expect(
      vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0]
        .series.candles.at(-1)?.time
    ).toBe(3);
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(5));
    expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(1);
    expect(deps.store.getDiagnostics().cachedPageCount).toBe(1);
    expect(deps.onPresentationPending).toHaveBeenCalledTimes(1);
    expect(deps.onPresentationReady).toHaveBeenCalledTimes(1);
    expect(deps.onDataLoaded).toHaveBeenCalledTimes(1);
    expect(deps.onDataLoaded).toHaveBeenCalledWith(expect.objectContaining({
      phase: "history",
      dataVersion: "v1"
    }));
  });

  it("coalesces concurrent replay steps on one evicted page without losing requested steps", async () => {
    const { controller, deps, newest } = await prepareEvictedReplay();
    let resolveReload!: () => void;
    deps.dataCoordinator.reloadPage = vi.fn(() => new Promise<void>((resolve) => {
      resolveReload = () => {
        expect(deps.store.mergePage(undefined, newest)).toEqual({ ok: true });
        resolve();
      };
    }));

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay(2)).toBe(true);
    expect(controller.stepReplay()).toBe(true);
    expect(controller.stepReplay(2)).toBe(true);
    expect(controller.getViewModel().replay.cursorTime).toBe(3);
    expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(1);

    resolveReload();
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(7));
    expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(1);
    expect(deps.store.getDiagnostics().cachedPageCount).toBe(1);
  });

  it("rejects a pending replay step when the accumulated count would stop being a safe integer", async () => {
    const { controller, deps } = await prepareEvictedReplay();
    deps.dataCoordinator.reloadPage = vi.fn(() => new Promise<void>(() => undefined));

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(controller.stepReplay()).toBe(false);
    expect(controller.getViewModel().replay.cursorTime).toBe(3);
    expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(1);
  });

  it("continues one accumulated replay command across multiple evicted pages", async () => {
    const deps = dependencies();
    deps.store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
    const selection = { symbol: stock, timeframe: "1d" as const, adjustMode: "forward" as const };
    const newest = replayPage([8, 9], { beforeCursor: "middle", hasMoreBefore: true });
    const middle = replayPage([5, 6, 7], { beforeCursor: "older", hasMoreBefore: true });
    const older = replayPage([1, 2, 3, 4], { hasMoreBefore: false });
    deps.store.reset(selection, "v1");
    deps.store.mergePage(undefined, newest);
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1"
    });
    controller.setVisibleRange({ from: 1, to: 4 });
    deps.store.mergePage("middle", middle);
    deps.store.mergePage("older", older);
    controller.handleDataEvent({
      type: "historyPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1"
    });
    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith({
      from: 1,
      to: 4
    }));
    deps.dataCoordinator.reloadPage = vi.fn(async (cursor) => {
      expect(
        deps.store.mergePage(cursor, cursor === "middle" ? middle : newest)
      ).toEqual({ ok: true });
    });

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay(6)).toBe(true);
    expect(controller.getViewModel().replay.cursorTime).toBe(3);
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(9));
    expect(deps.dataCoordinator.reloadPage).toHaveBeenNthCalledWith(1, undefined);
    expect(deps.dataCoordinator.reloadPage).toHaveBeenNthCalledWith(2, "middle");
    expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(2);
    expect(deps.store.getDiagnostics().cachedPageCount).toBe(1);
  });

  it("keeps the replay cursor stable after a reload failure and allows a manual retry", async () => {
    const { controller, deps, newest } = await prepareEvictedReplay();
    deps.dataCoordinator.reloadPage = vi.fn(async () => undefined);

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay(2)).toBe(true);
    expect(controller.getViewModel().replay.cursorTime).toBe(3);
    await vi.waitFor(() => expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getViewModel().replay).toMatchObject({
      status: "paused",
      cursorTime: 3
    });

    deps.dataCoordinator.reloadPage = vi.fn(async () => {
      expect(deps.store.mergePage(undefined, newest)).toEqual({ ok: true });
    });
    expect(controller.stepReplay(2)).toBe(true);
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(5));
    expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(1);
  });

  it("suppresses an evicted-page result after stop and restart of replay", async () => {
    const { controller, deps, newest } = await prepareEvictedReplay();
    deps.onPresentationPending = vi.fn();
    deps.onPresentationReady = vi.fn();
    let resolveReload!: () => void;
    deps.dataCoordinator.reloadPage = vi.fn(() => new Promise<void>((resolve) => {
      resolveReload = () => {
        expect(deps.store.mergePage(undefined, newest)).toEqual({ ok: true });
        resolve();
      };
    }));

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay()).toBe(true);
    expect(controller.stepReplay()).toBe(true);
    expect(deps.onPresentationPending).toHaveBeenCalledTimes(1);
    expect(deps.onPresentationReady).not.toHaveBeenCalled();
    controller.stopReplay();
    expect(deps.onPresentationReady).toHaveBeenCalledTimes(1);
    expect(controller.startReplay(2)).toBe(true);
    resolveReload();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getViewModel().replay).toMatchObject({
      status: "paused",
      cursorTime: 2
    });
    expect(deps.onPresentationReady).toHaveBeenCalledTimes(1);
    expect(controller.stepReplay()).toBe(true);
    expect(controller.getViewModel().replay.cursorTime).toBe(3);
  });

  it("restores readiness when startReplay replaces a pending replay transaction", async () => {
    const { controller, deps, newest } = await prepareEvictedReplay();
    deps.onPresentationPending = vi.fn();
    deps.onPresentationReady = vi.fn();
    let resolveReload!: () => void;
    deps.dataCoordinator.reloadPage = vi.fn(() => new Promise<void>((resolve) => {
      resolveReload = () => {
        expect(deps.store.mergePage(undefined, newest)).toEqual({ ok: true });
        resolve();
      };
    }));

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay(2)).toBe(true);
    expect(deps.onPresentationPending).toHaveBeenCalledTimes(1);
    expect(controller.startReplay(2)).toBe(true);
    expect(deps.onPresentationReady).toHaveBeenCalledTimes(1);

    resolveReload();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getViewModel().replay).toMatchObject({
      status: "paused",
      cursorTime: 2
    });
    expect(deps.onPresentationReady).toHaveBeenCalledTimes(1);
  });

  it("emits accepted replay history once after a stopped page is reused synchronously", async () => {
    const { controller, deps, newest, selection } = await prepareEvictedReplay();
    deps.onDataLoaded = vi.fn();
    deps.onPresentationPending = vi.fn();
    deps.onPresentationReady = vi.fn();
    let releaseReload!: () => void;
    let pageAccepted = false;
    deps.dataCoordinator.reloadPage = vi.fn(async () => {
      expect(deps.store.mergePage(undefined, newest)).toEqual({ ok: true });
      controller.handleDataEvent({
        type: "historyPageAccepted",
        selection,
        generation: 1,
        dataVersion: "v1"
      });
      pageAccepted = true;
      await new Promise<void>((resolve) => {
        releaseReload = resolve;
      });
    });

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay(2)).toBe(true);
    await vi.waitFor(() => expect(pageAccepted).toBe(true));
    controller.stopReplay();
    expect(deps.onDataLoaded).not.toHaveBeenCalled();

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay(2)).toBe(true);
    expect(controller.getViewModel().replay.cursorTime).toBe(5);
    expect(deps.onDataLoaded).toHaveBeenCalledTimes(1);
    expect(deps.onDataLoaded).toHaveBeenCalledWith(expect.objectContaining({
      phase: "history",
      dataVersion: "v1"
    }));

    releaseReload();
    await Promise.resolve();
    await Promise.resolve();
    expect(deps.onDataLoaded).toHaveBeenCalledTimes(1);
  });

  it("does not flush the awaited replay page when another history cursor is accepted", async () => {
    const { controller, deps, newest, selection } = await prepareEvictedReplay();
    deps.onDataLoaded = vi.fn();
    let resolveReload!: () => void;
    deps.dataCoordinator.reloadPage = vi.fn(() => new Promise<void>((resolve) => {
      resolveReload = resolve;
    }));

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay(2)).toBe(true);
    expect(deps.store.mergePage(undefined, newest)).toEqual({ ok: true });
    controller.handleDataEvent({
      type: "historyPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1"
    });
    controller.handleDataEvent({
      type: "historyPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1",
      cursor: "unrelated"
    });
    expect(deps.onDataLoaded).not.toHaveBeenCalled();

    resolveReload();
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(5));
    expect(deps.onDataLoaded).toHaveBeenCalledTimes(1);
  });

  it("does not treat an unrelated cached cursor as consumed by replay materialization", async () => {
    const deps = dependencies();
    deps.store = createPagedSeriesStore({ maxPages: 3, maxEstimatedBytes: 10_000 });
    deps.onDataLoaded = vi.fn();
    vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({
      visibleCount: 2,
      overscanCount: 0
    });
    const selection = { symbol: stock, timeframe: "1d" as const, adjustMode: "forward" as const };
    const newest = replayPage([10, 11, 12], { beforeCursor: "p1", hasMoreBefore: true });
    const p1 = replayPage([7, 8, 9], { beforeCursor: "p2", hasMoreBefore: true });
    const p2 = replayPage([4, 5, 6], { beforeCursor: "p3", hasMoreBefore: true });
    const p3 = replayPage([1, 2, 3], { hasMoreBefore: false });
    deps.store.reset(selection, "v1");
    expect(deps.store.mergePage(undefined, newest)).toEqual({ ok: true });
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1"
    });
    controller.setVisibleRange({ from: 1, to: 3 });
    expect(deps.store.mergePage("p1", p1)).toEqual({ ok: true });
    expect(deps.store.mergePage("p2", p2)).toEqual({ ok: true });
    expect(deps.store.mergePage("p3", p3)).toEqual({ ok: true });
    controller.handleDataEvent({
      type: "historyPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1",
      cursor: "p3"
    });
    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith({
      from: 1,
      to: 3
    }));
    vi.mocked(deps.onDataLoaded).mockClear();

    let pageAccepted = false;
    let releaseReload!: () => void;
    deps.dataCoordinator.reloadPage = vi.fn(async (cursor) => {
      const page = cursor === undefined ? newest : cursor === "p1" ? p1 : cursor === "p2" ? p2 : p3;
      expect(deps.store.mergePage(cursor, page)).toEqual({ ok: true });
      controller.handleDataEvent({
        type: "historyPageAccepted",
        selection,
        generation: 1,
        dataVersion: "v1",
        ...(cursor === undefined ? {} : { cursor })
      });
      if (cursor === undefined) {
        pageAccepted = true;
        await new Promise<void>((resolve) => {
          releaseReload = resolve;
        });
      }
    });

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay(7)).toBe(true);
    await vi.waitFor(() => expect(pageAccepted).toBe(true));
    controller.handleDataEvent({
      type: "historyPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1",
      cursor: "p3"
    });
    expect(deps.onDataLoaded).not.toHaveBeenCalled();

    releaseReload();
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(10));
    expect(vi.mocked(deps.dataCoordinator.reloadPage).mock.calls.map(([cursor]) => cursor))
      .toEqual([undefined, "p1"]);
    expect(deps.onDataLoaded).toHaveBeenCalledTimes(2);
  });

  it("locates a distant replay target from descriptors without retaining intermediate pages", async () => {
    const deps = dependencies();
    deps.store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
    vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({
      visibleCount: 64,
      overscanCount: 0
    });
    const selection = { symbol: stock, timeframe: "1d" as const, adjustMode: "forward" as const };
    const pages = Array.from({ length: 32 }, (_, pageIndex) => {
      const oldestPageIndex = 31 - pageIndex;
      const first = oldestPageIndex * 64 + 1;
      return replayPage(
        Array.from({ length: 64 }, (_, candleIndex) => first + candleIndex),
        {
          ...(pageIndex === 31 ? {} : { beforeCursor: `page-${pageIndex + 1}` }),
          hasMoreBefore: pageIndex !== 31
        }
      );
    });
    deps.store.reset(selection, "v1");
    expect(deps.store.mergePage(undefined, pages[0]!)).toEqual({ ok: true });
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1"
    });
    controller.setVisibleRange({ from: 1, to: 64 });
    for (let index = 1; index < pages.length; index += 1) {
      expect(deps.store.mergePage(`page-${index}`, pages[index]!)).toEqual({ ok: true });
    }
    controller.handleDataEvent({
      type: "historyPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1",
      cursor: "page-31"
    });
    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith({
      from: 1,
      to: 64
    }));
    deps.dataCoordinator.reloadPage = vi.fn(async (cursor) => {
      const index = cursor === undefined ? 0 : Number(cursor.slice("page-".length));
      expect(deps.store.mergePage(cursor, pages[index]!)).toEqual({ ok: true });
    });
    vi.mocked(deps.runtime.setMaterializedSeries).mockClear();

    expect(controller.startReplay(1)).toBe(true);
    vi.mocked(deps.runtime.setMaterializedSeries).mockClear();
    expect(controller.stepReplay(2_047)).toBe(true);
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(2_048));
    expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(1);
    expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledWith(undefined);
    expect(deps.store.getDiagnostics().cachedPageCount).toBe(1);
    expect(deps.runtime.setMaterializedSeries).toHaveBeenCalledTimes(1);
  });

  it("reloads an evicted origin owner before continuing from its exact page offset", async () => {
    const deps = dependencies();
    deps.store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 40_000 });
    vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({
      visibleCount: 100,
      overscanCount: 0
    });
    const selection = { symbol: stock, timeframe: "1d" as const, adjustMode: "forward" as const };
    const newest = replayPage(
      Array.from({ length: 500 }, (_, index) => index + 501),
      { beforeCursor: "older", hasMoreBefore: true }
    );
    const older = replayPage(
      Array.from({ length: 500 }, (_, index) => index + 1),
      { hasMoreBefore: false }
    );
    deps.store.reset(selection, "v1");
    deps.store.mergePage(undefined, newest);
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1"
    });
    controller.setVisibleRange({ from: 400, to: 500 });
    deps.store.mergePage("older", older);
    controller.handleDataEvent({
      type: "historyPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1",
      cursor: "older"
    });
    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith({
      from: 400,
      to: 500
    }));
    deps.dataCoordinator.reloadPage = vi.fn(async (cursor) => {
      expect(cursor).toBeUndefined();
      expect(deps.store.mergePage(undefined, newest)).toEqual({ ok: true });
    });

    expect(controller.startReplay(450)).toBe(true);
    expect(controller.stepReplay(100)).toBe(true);
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(550));
    expect(deps.store.mergePage("older", older)).toEqual({ ok: true });
    expect(controller.stepReplay(100)).toBe(true);
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(650));
    expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(2);
  });

  it("keeps replay authoritative when a canceled visible-range request later succeeds", async () => {
    const deps = dependencies();
    const selection = { symbol: stock, timeframe: "1d" as const, adjustMode: "forward" as const };
    const newest = replayPage([5, 6, 7], { beforeCursor: "older", hasMoreBefore: true });
    const older = replayPage([1, 2, 3, 4], { hasMoreBefore: false });
    deps.store.reset(selection, "v1");
    deps.store.mergePage(undefined, newest);
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1"
    });
    let resolveRange!: () => void;
    deps.dataCoordinator.loadMoreBefore = vi.fn(() => new Promise<void>((resolve) => {
      resolveRange = () => {
        expect(deps.store.mergePage("older", older)).toEqual({ ok: true });
        controller.handleDataEvent({
          type: "historyPageAccepted",
          selection,
          generation: 1,
          dataVersion: "v1",
          cursor: "older"
        });
        resolve();
      };
    }));

    controller.setVisibleRange({ from: 1, to: 3 });
    await vi.waitFor(() => expect(deps.dataCoordinator.loadMoreBefore).toHaveBeenCalledTimes(1));
    expect(controller.startReplay(5)).toBe(true);
    resolveRange();
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getViewModel().replay).toMatchObject({
      status: "paused",
      cursorTime: 5
    });
    expect(deps.runtime.setVisibleRange).not.toHaveBeenCalledWith({ from: 1, to: 3 });
  });

  it("exits replay when an evicted-page request refreshes the data version", async () => {
    const { controller, deps, selection } = await prepareEvictedReplay();
    let resolveReload!: () => void;
    deps.dataCoordinator.reloadPage = vi.fn(() => new Promise<void>((resolve) => {
      resolveReload = resolve;
    }));

    expect(controller.startReplay(3)).toBe(true);
    expect(controller.stepReplay()).toBe(true);
    expect(controller.stepReplay()).toBe(true);
    controller.handleDataEvent({
      type: "snapshotRefreshing",
      selection,
      generation: 2
    });
    expect(controller.getViewModel().replay).toEqual({ status: "inactive", speed: 1 });

    resolveReload();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getViewModel().replay).toEqual({ status: "inactive", speed: 1 });
    expect(
      vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0]
        .series.candles.at(-1)?.time
    ).toBe(4);
  });

  it("pauses autoplay after one failed evicted-page reload without retry spinning", async () => {
    const { controller, deps } = await prepareEvictedReplay();
    deps.dataCoordinator.reloadPage = vi.fn(async () => {
      throw new Error("controlled reload failure");
    });
    expect(controller.startReplay(4)).toBe(true);

    vi.useFakeTimers();
    try {
      controller.playReplay();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(controller.getViewModel().replay).toMatchObject({
        status: "paused",
        cursorTime: 4
      });
      expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("publishes pause immediately when a manual step joins a pending autoplay reload", async () => {
    const { controller, deps, newest } = await prepareEvictedReplay();
    let resolveReload!: () => void;
    deps.dataCoordinator.reloadPage = vi.fn(() => new Promise<void>((resolve) => {
      resolveReload = () => {
        expect(deps.store.mergePage(undefined, newest)).toEqual({ ok: true });
        resolve();
      };
    }));
    expect(controller.startReplay(4)).toBe(true);

    vi.useFakeTimers();
    try {
      controller.playReplay();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(controller.getViewModel().replay).toMatchObject({
        status: "playing",
        cursorTime: 4
      });
      vi.mocked(deps.onViewModelChanged).mockClear();

      expect(controller.stepReplay()).toBe(true);
      expect(controller.getViewModel().replay).toMatchObject({
        status: "paused",
        cursorTime: 4
      });
      expect(deps.onViewModelChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          replay: expect.objectContaining({ status: "paused", cursorTime: 4 })
        }),
        expect.any(Number)
      );

      resolveReload();
      await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(6));
      expect(controller.getViewModel().replay.status).toBe("paused");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("jumps across a 20000-candle retained replay window in one commit", () => {
    const deps = dependencies();
    vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({
      visibleCount: 20_000,
      overscanCount: 0
    });
    const times = Array.from({ length: 20_000 }, (_, index) => index + 1);
    const valid = validateSeriesPage({
      candles: times.map((time) => ({
        time,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      hasMoreBefore: false,
      dataVersion: "v1"
    }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });
    vi.mocked(deps.runtime.setMaterializedSeries).mockClear();

    expect(controller.startReplay(1)).toBe(true);
    vi.mocked(deps.runtime.setMaterializedSeries).mockClear();
    expect(controller.stepReplay(19_999)).toBe(true);
    expect(controller.getViewModel().replay).toMatchObject({
      status: "paused",
      cursorTime: 20_000
    });
    expect(deps.runtime.setMaterializedSeries).toHaveBeenCalledTimes(1);
  });

  it("deduplicates wide overlapping evicted pages before choosing a replay target", async () => {
    const deps = dependencies();
    deps.store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
    const selection = { symbol: stock, timeframe: "1d" as const, adjustMode: "forward" as const };
    const newest = replayPage([300, 400, 500], {
      beforeCursor: "middle",
      hasMoreBefore: true
    });
    const middle = replayPage([200, 300, 400], {
      beforeCursor: "oldest",
      hasMoreBefore: true
    });
    const oldest = replayPage([100, 200, 300], { hasMoreBefore: false });
    deps.store.reset(selection, "v1");
    deps.store.mergePage(undefined, newest);
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1"
    });
    controller.setVisibleRange({ from: 100, to: 100 });
    deps.store.mergePage("middle", middle);
    deps.store.mergePage("oldest", oldest);
    deps.dataCoordinator.reloadPage = vi.fn(async (cursor) => {
      const page = cursor === undefined ? newest : cursor === "middle" ? middle : oldest;
      expect(deps.store.mergePage(cursor, page)).toEqual({ ok: true });
    });
    controller.handleDataEvent({
      type: "historyPageAccepted",
      selection,
      generation: 1,
      dataVersion: "v1",
      cursor: "oldest"
    });
    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith({
      from: 100,
      to: 100
    }));

    expect(controller.startReplay(100)).toBe(true);
    expect(controller.stepReplay()).toBe(true);
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(200));
    expect(controller.stepReplay(3)).toBe(true);
    await vi.waitFor(() => expect(controller.getViewModel().replay.cursorTime).toBe(500));
  });

  it("stops replay before applying an explicit visible-range command", () => {
    const deps = dependencies();
    const valid = validateSeriesPage({
      candles: [1, 4, 9].map((time) => ({
        time,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      hasMoreBefore: false,
      dataVersion: "v1"
    }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });

    expect(controller.startReplay(1)).toBe(true);
    controller.setVisibleRange({ from: 1, to: 9 });
    expect(controller.getViewModel().replay).toEqual({ status: "inactive", speed: 1 });
  });

  it("reloads a known evicted older 1m page instead of issuing a no-op chain-tail request", async () => {
    const makeCandles = (from: number) => Array.from({ length: 100 }, (_, index) => ({
      time: from + index,
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 1,
      turnover: 10.5
    }));
    const requests: Array<string | undefined> = [];
    const datafeed: ChartDatafeed = {
      async getCapabilities() {
        return { series: [{ timeframe: "1m", adjustModes: ["forward"] }] };
      },
      async searchSymbols() { return []; },
      async loadSeries(request) {
        requests.push(request.beforeCursor);
        return request.beforeCursor === undefined
          ? { candles: makeCandles(300), beforeCursor: "older", hasMoreBefore: true, dataVersion: "v1" }
          : { candles: makeCandles(200), hasMoreBefore: false, dataVersion: "v1" };
      }
    };
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
    let controller!: ReturnType<typeof createChartController>;
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.store = store;
    deps.getCapabilities = datafeed.getCapabilities;
    vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({
      visibleCount: 100,
      overscanCount: 0
    });
    deps.dataCoordinator = createDataCoordinator({
      dataSource: datafeed,
      store,
      onEvent: (event) => controller?.handleDataEvent(event)
    });
    controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(controller.getState().loading).toBe(false));

    const initialMaterializationCount = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.length;
    controller.loadMoreBefore();
    await vi.waitFor(() => expect(requests.filter((cursor) => cursor === "older")).toHaveLength(1));
    await vi.waitFor(() => {
      expect(store.getDiagnostics().descriptorCount).toBe(2);
      expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.length)
        .toBeGreaterThan(initialMaterializationCount);
      const latest = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
      expect(latest?.sourceMinTime).toBe(300);
      expect(latest?.hasKnownOlderData).toBe(true);
    });
    const latest = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];

    controller.handleMaterializedBoundary("before", latest.sourceMinTime);
    await vi.waitFor(() => {
      const moved = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
      expect(moved?.sourceMinTime).toBeLessThan(300);
    });
    expect(requests.filter((cursor) => cursor === "older")).toHaveLength(2);
    expect(store.getDiagnostics().cachedPageCount).toBe(1);
    controller.destroy();
  });

  it("uses the runtime viewport demand instead of a fixed 500-candle window", async () => {
    const deps = dependencies();
    deps.onDataLoaded = vi.fn();
    const valid = validateSeriesPage({
      candles: Array.from({ length: 2_000 }, (_, index) => ({
        time: index + 1,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      hasMoreBefore: false,
      dataVersion: "v1"
    }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const rangePublicationStates: boolean[] = [];
    let controller!: ReturnType<typeof createChartController>;
    deps.runtime.setMaterializedSeries = vi.fn(() => {
      rangePublicationStates.push(controller.shouldPublishVisibleRange());
    });
    deps.runtime.setVisibleRange = vi.fn(() => {
      rangePublicationStates.push(controller.shouldPublishVisibleRange());
      return true;
    });
    controller = createChartController(deps);

    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });
    expect(deps.onDataLoaded).toHaveBeenCalledTimes(1);
    controller.handleViewportChanged({
      visibleRange: { from: 123, to: 499 },
      candleWidth: 2,
      scrollOffset: 0,
      priceScaleMode: "linear"
    });
    vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({ visibleCount: 377, overscanCount: 100 });
    controller.handleMaterializationDemandChanged({ visibleCount: 377, overscanCount: 100 });

    const expanded = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    expect(expanded.series.candles).toHaveLength(577);
    expect(expanded.sourceMaxTime).toBe(2_000);

    rangePublicationStates.length = 0;
    controller.setVisibleRange({ from: 500, to: 1_500 });
    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith({ from: 500, to: 1_500 }));
    const ranged = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    expect(ranged.series.candles[0]?.time).toBeLessThanOrEqual(500);
    expect(ranged.series.candles.at(-1)?.time).toBeGreaterThanOrEqual(1_500);
    expect(deps.runtime.setVisibleRange).toHaveBeenLastCalledWith({ from: 500, to: 1_500 });
    expect(deps.onDataLoaded).toHaveBeenCalledTimes(1);
    expect(rangePublicationStates).toEqual([false, true]);
  });

  it("keeps intraday on the last trading day while 1m stays continuous on the same revision", async () => {
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.getCapabilities = vi.fn(async () => ({
      series: [{ timeframe: "1m" as const, adjustModes: ["forward" as const] }]
    }));
    const controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    const firstDay = Date.UTC(2026, 6, 14, 1, 30);
    const lastDay = Date.UTC(2026, 6, 15, 1, 30);
    const times = [
      ...Array.from({ length: 10 }, (_, index) => firstDay + index * 60_000),
      ...Array.from({ length: 241 }, (_, index) => lastDay + index * 60_000)
    ];
    const candles = times.map((time) => ({
      time,
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 1,
      turnover: 10.5
    }));
    const valid = validateSeriesPage(
      { candles, beforeCursor: "older", hasMoreBefore: true, dataVersion: "same-revision" },
      { seenCursors: new Set() }
    );
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1m", adjustMode: "forward" }, "same-revision");
    deps.store.mergePage(undefined, valid.page);

    controller.setIntradayView(true);
    expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1);
    const intraday = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    expect(intraday.series.candles).toHaveLength(241);
    expect(intraday.series.candles[0]?.time).toBe(lastDay);
    expect(intraday.series.candles.at(-1)?.time).toBe(lastDay + 240 * 60_000);
    expect(intraday.series.candles.some((item) => item.time < lastDay)).toBe(false);
    controller.handleMaterializedBoundary("before", lastDay);
    expect(deps.dataCoordinator.loadMoreBefore).not.toHaveBeenCalled();

    controller.setIntradayView(false);
    const continuous = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    expect(continuous.series.candles.map((item) => item.time)).toEqual(times);
    expect(intraday.series.dataVersion).toBe(continuous.series.dataVersion);
  });

  it("keeps a fixed intraday visible-range command to replay exit only", async () => {
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.getCapabilities = vi.fn(async () => ({
      series: [{ timeframe: "1m" as const, adjustModes: ["forward" as const] }]
    }));
    deps.onPresentationUnavailable = vi.fn();
    vi.mocked(deps.runtime.setVisibleRange).mockReturnValue(false);
    const controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledOnce());

    const first = Date.UTC(2026, 6, 15, 1, 30);
    const valid = validateSeriesPage({
      candles: [first, first + 60_000].map((time) => ({
        time,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      hasMoreBefore: false,
      dataVersion: "intraday-range"
    }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1m", adjustMode: "forward" }, "intraday-range");
    deps.store.mergePage(undefined, valid.page);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1m", adjustMode: "forward" },
      generation: 1,
      dataVersion: "intraday-range"
    });
    controller.setView("intraday");
    expect(controller.startReplay(first)).toBe(true);

    vi.mocked(deps.runtime.setMaterializedSeries).mockClear();
    vi.mocked(deps.runtime.setVisibleRange).mockClear();
    vi.mocked(deps.dataCoordinator.loadMoreBefore).mockClear();
    vi.mocked(deps.dataCoordinator.reloadPage).mockClear();
    vi.mocked(deps.onError).mockClear();
    vi.mocked(deps.onPresentationUnavailable).mockClear();

    controller.setVisibleRange({ from: first, to: first + 60_000 });
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getViewModel().replay.status).toBe("inactive");
    expect(deps.runtime.setMaterializedSeries).toHaveBeenCalledTimes(1);
    expect(deps.runtime.setVisibleRange).not.toHaveBeenCalled();
    expect(deps.dataCoordinator.loadMoreBefore).not.toHaveBeenCalled();
    expect(deps.dataCoordinator.reloadPage).not.toHaveBeenCalled();
    expect(deps.onPresentationUnavailable).not.toHaveBeenCalled();
    expect(deps.onError).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("exposes intraday and timeframe views without reloading an existing 1m revision", async () => {
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.getCapabilities = vi.fn(async () => ({
      series: [{ timeframe: "1m" as const, adjustModes: ["forward" as const] }]
    }));
    const controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));

    controller.setSeriesType("area");
    vi.mocked(deps.persistence.savePreferences).mockClear();
    expect(controller.getState()).toMatchObject({ timeframe: "1m", view: "timeframe" });
    controller.setView("intraday");
    expect(controller.getState()).toMatchObject({ timeframe: "1m", view: "intraday" });
    expect(controller.getViewModel().seriesType).toBe("line");
    controller.setView("timeframe");
    expect(controller.getState()).toMatchObject({ timeframe: "1m", view: "timeframe" });
    expect(controller.getViewModel().seriesType).toBe("area");
    expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1);
    expect(deps.persistence.savePreferences).not.toHaveBeenCalled();
  });

  it("expands one 1m revision from two to nine intraday days and fetches one prior-day sentinel", async () => {
    const days = Array.from({ length: 10 }, (_, index) => Date.UTC(2026, 6, index + 1, 1, 30));
    const requests: SeriesRequest[] = [];
    const datafeed: ChartDatafeed = {
      async getCapabilities() {
        return {
          series: [{ timeframe: "1m", adjustModes: ["forward"] }],
          intradayScale: { previousClose: 99, priceLimitPercent: 10 }
        };
      },
      async searchSymbols() { return []; },
      async loadSeries(request) {
        requests.push(request);
        const index = request.beforeCursor === undefined ? days.length - 1 : Number(request.beforeCursor);
        return {
          candles: [{
            time: days[index]!,
            open: 100 + index,
            high: 101 + index,
            low: 99 + index,
            close: 100 + index,
            volume: 1,
            turnover: 100 + index
          }],
          ...(index === 0 ? {} : { beforeCursor: String(index - 1) }),
          hasMoreBefore: index > 0,
          dataVersion: "multi-day-revision"
        };
      }
    };
    const store = createPagedSeriesStore();
    let controller!: ReturnType<typeof createChartController>;
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.store = store;
    deps.getCapabilities = datafeed.getCapabilities;
    deps.dataCoordinator = createDataCoordinator({
      dataSource: datafeed,
      store,
      onEvent: (event) => controller?.handleDataEvent(event)
    });
    controller = createChartController(deps);

    controller.start();
    controller.setView("intraday");
    await vi.waitFor(() => {
      expect(controller.getState()).toMatchObject({ view: "intraday", intradayDays: 1, loading: false });
      expect(requests).toHaveLength(2);
    });

    controller.setIntradayDays(2);
    await vi.waitFor(() => {
      expect(controller.getState()).toMatchObject({ intradayDays: 2, loading: false });
      expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].intradayDays).toBe(2);
      expect(requests).toHaveLength(3);
    });

    controller.setIntradayDays(9);
    await vi.waitFor(() => {
      expect(controller.getState()).toMatchObject({ intradayDays: 9, loading: false });
      expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].intradayDays).toBe(9);
      expect(requests).toHaveLength(10);
    });

    const materialized = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    expect(requests.filter((request) => request.beforeCursor === undefined)).toHaveLength(1);
    expect(new Set(requests.map((request) => `${request.symbol.id}:${request.timeframe}:${request.adjustMode}`))).toEqual(
      new Set(["stock:1m:forward"])
    );
    expect(materialized.series.dataVersion).toBe("multi-day-revision");
    expect(materialized.series.candles.map((item) => item.time)).toEqual(days.slice(1));
    expect(materialized.intradayScale).toEqual({ previousClose: 100 });
    controller.destroy();
  });

  it("becomes ready with fewer real days when nine-day intraday history is exhausted", async () => {
    const days = Array.from({ length: 5 }, (_, index) => Date.UTC(2026, 6, index + 1, 1, 30));
    const requests: SeriesRequest[] = [];
    const datafeed: ChartDatafeed = {
      async getCapabilities() {
        return { series: [{ timeframe: "1m", adjustModes: ["forward"] }] };
      },
      async searchSymbols() { return []; },
      async loadSeries(request) {
        requests.push(request);
        const index = request.beforeCursor === undefined ? days.length - 1 : Number(request.beforeCursor);
        return {
          candles: [{
            time: days[index]!, open: 10, high: 11, low: 9, close: 10,
            volume: 1, turnover: 10
          }],
          ...(index === 0 ? {} : { beforeCursor: String(index - 1) }),
          hasMoreBefore: index > 0,
          dataVersion: "five-real-days"
        };
      }
    };
    const store = createPagedSeriesStore();
    let controller!: ReturnType<typeof createChartController>;
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.store = store;
    deps.getCapabilities = datafeed.getCapabilities;
    deps.dataCoordinator = createDataCoordinator({
      dataSource: datafeed,
      store,
      onEvent: (event) => controller?.handleDataEvent(event)
    });
    controller = createChartController(deps);

    controller.start();
    controller.setView("intraday");
    await vi.waitFor(() => expect(controller.getState().loading).toBe(false));
    controller.setIntradayDays(9);
    await vi.waitFor(() => {
      expect(controller.getState()).toMatchObject({ intradayDays: 9, loading: false });
      expect(controller.getViewModel().status.type).toBe("ready");
      expect(requests).toHaveLength(5);
    });

    const materialized = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    expect(materialized.series.candles.map((item) => item.time)).toEqual(days);
    expect(materialized.intradayScale).toBeUndefined();
    expect(requests.filter((request) => request.beforeCursor === undefined)).toHaveLength(1);
    controller.destroy();
  });

  it("retains the prior-day percentage baseline while selected multi-day pages are reloaded", async () => {
    const days = Array.from({ length: 3 }, (_, index) => Date.UTC(2026, 6, index + 1, 1, 30));
    const requests: Array<string | undefined> = [];
    const datafeed: ChartDatafeed = {
      async getCapabilities() {
        return { series: [{ timeframe: "1m", adjustModes: ["forward"] }] };
      },
      async searchSymbols() { return []; },
      async loadSeries(request) {
        requests.push(request.beforeCursor);
        const index = request.beforeCursor === undefined ? 2 : Number(request.beforeCursor);
        return {
          candles: [{
            time: days[index]!,
            open: 100 + index,
            high: 101 + index,
            low: 99 + index,
            close: 100 + index,
            volume: 1,
            turnover: 100 + index
          }],
          ...(index === 0 ? {} : { beforeCursor: String(index - 1) }),
          hasMoreBefore: index > 0,
          dataVersion: "evicted-multi-day-baseline"
        };
      }
    };
    const store = createPagedSeriesStore({ maxPages: 1 });
    let controller!: ReturnType<typeof createChartController>;
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.store = store;
    deps.getCapabilities = datafeed.getCapabilities;
    deps.dataCoordinator = createDataCoordinator({
      dataSource: datafeed,
      store,
      onEvent: (event) => controller?.handleDataEvent(event)
    });
    controller = createChartController(deps);

    controller.start();
    controller.setView("intraday");
    await vi.waitFor(() => expect(controller.getState().loading).toBe(false));
    controller.setIntradayDays(2);
    await vi.waitFor(() => {
      expect(controller.getState()).toMatchObject({ intradayDays: 2, loading: false });
      const materialized = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
      expect(materialized?.series.candles.map((item) => item.time)).toEqual(days.slice(1));
      expect(materialized?.intradayScale).toEqual({ previousClose: 100 });
    });

    expect(requests.filter((cursor) => cursor === undefined).length).toBeGreaterThan(1);
    expect(store.getDiagnostics().cachedPageCount).toBe(1);
    controller.destroy();
  });

  it("joins a split Shanghai trading day before rendering intraday and stops at the day boundary", async () => {
    const lastDay = Date.UTC(2026, 6, 15, 1, 30);
    const previousDay = Date.UTC(2026, 6, 14, 7, 0);
    const minute = 60_000;
    const makeCandle = (time: number) => ({
      time,
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 1,
      turnover: 10.5
    });
    let resolveInitial!: (page: SeriesPage) => void;
    const initialPage = new Promise<SeriesPage>((resolve) => {
      resolveInitial = resolve;
    });
    const requests: Array<string | undefined> = [];
    const datafeed: ChartDatafeed = {
      async getCapabilities() {
        return { series: [{ timeframe: "1m", adjustModes: ["forward"] }] };
      },
      async searchSymbols() { return []; },
      async loadSeries(request) {
        requests.push(request.beforeCursor);
        if (request.beforeCursor === undefined) return initialPage;
        if (request.beforeCursor === "same-day") {
          return {
            candles: [
              makeCandle(previousDay),
              ...Array.from({ length: 121 }, (_, index) => makeCandle(lastDay + index * minute))
            ],
            beforeCursor: "previous-day",
            hasMoreBefore: true,
            dataVersion: "split-day"
          };
        }
        throw new Error("The intraday view requested history older than the completed day");
      }
    };
    const store = createPagedSeriesStore();
    let controller!: ReturnType<typeof createChartController>;
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.store = store;
    deps.getCapabilities = datafeed.getCapabilities;
    deps.onDataLoaded = vi.fn();
    deps.dataCoordinator = createDataCoordinator({
      dataSource: datafeed,
      store,
      onEvent: (event) => controller?.handleDataEvent(event)
    });
    controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(requests).toEqual([undefined]));
    controller.setView("intraday");
    resolveInitial({
      candles: Array.from({ length: 120 }, (_, index) =>
        makeCandle(lastDay + (index + 121) * minute)
      ),
      beforeCursor: "same-day",
      hasMoreBefore: true,
      dataVersion: "split-day"
    });

    await vi.waitFor(() => expect(controller.getState().loading).toBe(false));
    const intraday = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    expect(requests).toEqual([undefined, "same-day"]);
    expect(intraday.series.candles).toHaveLength(241);
    expect(intraday.series.candles[0]?.time).toBe(lastDay);
    expect(intraday.series.candles.at(-1)?.time).toBe(lastDay + 240 * minute);
    expect(deps.onDataLoaded).toHaveBeenNthCalledWith(1, {
      state: expect.objectContaining({ view: "intraday", loading: false }),
      dataVersion: "split-day",
      phase: "initial"
    });
    expect(deps.onDataLoaded).toHaveBeenNthCalledWith(2, {
      state: expect.objectContaining({ view: "intraday", loading: false }),
      dataVersion: "split-day",
      phase: "history"
    });

    controller.setView("timeframe");
    controller.setView("intraday");
    controller.handleMaterializationDemandChanged({ visibleCount: 1_000, overscanCount: 100 });
    await Promise.resolve();
    expect(deps.onDataLoaded).toHaveBeenCalledTimes(2);
    expect(requests).toEqual([undefined, "same-day"]);
    controller.destroy();
  });

  it("materializes a three-page intraday day with a one-page cache without requesting older days", async () => {
    const lastDay = Date.UTC(2026, 6, 15, 1, 30);
    const previousDay = Date.UTC(2026, 6, 14, 7, 0);
    const minute = 60_000;
    const makeCandle = (time: number) => ({
      time,
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 1,
      turnover: 10.5
    });
    const newestPage: SeriesPage = {
      candles: Array.from({ length: 80 }, (_, index) =>
        makeCandle(lastDay + (index + 161) * minute)
      ),
      beforeCursor: "page-2",
      hasMoreBefore: true,
      dataVersion: "three-page-day"
    };
    let resolveInitial!: (page: SeriesPage) => void;
    const initial = new Promise<SeriesPage>((resolve) => { resolveInitial = resolve; });
    let resolveNewestReload!: (page: SeriesPage) => void;
    const newestReload = new Promise<SeriesPage>((resolve) => { resolveNewestReload = resolve; });
    const requests: Array<string | undefined> = [];
    const datafeed: ChartDatafeed = {
      async getCapabilities() {
        return { series: [{ timeframe: "1m", adjustModes: ["forward"] }] };
      },
      async searchSymbols() { return []; },
      async loadSeries(request) {
        requests.push(request.beforeCursor);
        if (request.beforeCursor === undefined) return requests.length === 1 ? initial : newestReload;
        if (request.beforeCursor === "page-2") {
          return {
            candles: Array.from({ length: 80 }, (_, index) =>
              makeCandle(lastDay + (index + 81) * minute)
            ),
            beforeCursor: "page-3",
            hasMoreBefore: true,
            dataVersion: "three-page-day"
          };
        }
        if (request.beforeCursor === "page-3") {
          return {
            candles: [
              makeCandle(previousDay),
              ...Array.from({ length: 81 }, (_, index) => makeCandle(lastDay + index * minute))
            ],
            beforeCursor: "older-day",
            hasMoreBefore: true,
            dataVersion: "three-page-day"
          };
        }
        throw new Error("The completed intraday view crossed into an older day");
      }
    };
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
    let controller!: ReturnType<typeof createChartController>;
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.store = store;
    deps.getCapabilities = datafeed.getCapabilities;
    deps.onPresentationReady = vi.fn();
    deps.onPresentationUnavailable = vi.fn();
    deps.dataCoordinator = createDataCoordinator({
      dataSource: datafeed,
      store,
      onEvent: (event) => controller?.handleDataEvent(event)
    });
    controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(requests).toEqual([undefined]));
    controller.setView("intraday");
    resolveInitial(newestPage);

    await vi.waitFor(() =>
      expect(requests).toEqual([undefined, "page-2", "page-3", undefined])
    );
    expect(deps.runtime.setMaterializedSeries).not.toHaveBeenCalled();
    controller.resetToLatest(false);
    resolveNewestReload(newestPage);

    await vi.waitFor(() => {
      const materialized = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
      expect(materialized?.series.candles).toHaveLength(241);
    });
    const materialized = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    expect(materialized.series.candles[0]?.time).toBe(lastDay);
    expect(materialized.series.candles.at(-1)?.time).toBe(lastDay + 240 * minute);
    expect(requests).toEqual([undefined, "page-2", "page-3", undefined, "page-2"]);
    expect(requests).not.toContain("older-day");
    expect(deps.runtime.resetToLatest).toHaveBeenCalledTimes(1);
    expect(deps.runtime.resetToLatest).toHaveBeenCalledWith(false);
    expect(deps.onPresentationReady).toHaveBeenCalledTimes(1);
    expect(deps.onPresentationUnavailable).not.toHaveBeenCalled();
    expect(store.getDiagnostics()).toMatchObject({
      cachedPageCount: 1,
      maxPages: 1,
      maxEstimatedBytes: 10_000
    });
    expect(store.getDiagnostics().estimatedBytes).toBeLessThanOrEqual(10_000);
    controller.destroy();
  });

  it("renders accepted intraday candles and exits loading when day-completion history fails or is rejected", async () => {
    const failureEvents = [
      { type: "historyRequestFailed" as const, cursor: "same-day", error: new Error("offline") },
      {
        type: "pageRejected" as const,
        phase: "history" as const,
        code: "INVALID_CANDLE",
        message: "invalid history page"
      }
    ];

    for (const failureEvent of failureEvents) {
      const deps = dependencies();
      deps.initialTimeframe = "1m";
      deps.getCapabilities = vi.fn(async () => ({
        series: [{ timeframe: "1m" as const, adjustModes: ["forward" as const] }]
      }));
      deps.onDataLoaded = vi.fn();
      vi.mocked(deps.runtime.getVisibleRange).mockReturnValue({ from: 1, to: 2 });
      const controller = createChartController(deps);
      controller.start();
      await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
      controller.setView("intraday");
      const lastDay = Date.UTC(2026, 6, 15, 1, 30);
      const valid = validateSeriesPage({
        candles: Array.from({ length: 120 }, (_, index) => ({
          time: lastDay + index * 60_000,
          open: 10,
          high: 11,
          low: 9,
          close: 10.5,
          volume: 1,
          turnover: 10.5
        })),
        beforeCursor: "same-day",
        hasMoreBefore: true,
        dataVersion: "partial-day"
      }, { seenCursors: new Set() });
      if (!valid.ok) throw new Error("fixture invalid");
      deps.store.reset({ symbol: stock, timeframe: "1m", adjustMode: "forward" }, "partial-day");
      deps.store.mergePage(undefined, valid.page);
      controller.handleDataEvent({
        type: "initialPageAccepted",
        selection: { symbol: stock, timeframe: "1m", adjustMode: "forward" },
        generation: 1,
        dataVersion: "partial-day"
      });
      expect(controller.getState().loading).toBe(true);

      controller.handleDataEvent(failureEvent);
      expect(controller.getState().loading).toBe(false);
      expect(controller.getViewModel().status.type).toBe("readyWithWarning");
      expect(controller.getVisibleRange()).toEqual({ from: 1, to: 2 });
      expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].series.candles)
        .toHaveLength(120);
      expect(deps.onDataLoaded).toHaveBeenCalledWith({
        state: expect.objectContaining({ view: "intraday", loading: false }),
        dataVersion: "partial-day",
        phase: "initial"
      });
      if (failureEvent.type === "historyRequestFailed") {
        controller.retryHistory();
        expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledWith("same-day");
      }
      controller.destroy();
    }
  });

  it("fails closed before committing an intraday accumulator above 1440 candles", async () => {
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.getCapabilities = vi.fn(async () => ({
      series: [{ timeframe: "1m" as const, adjustModes: ["forward" as const] }]
    }));
    deps.onDataLoaded = vi.fn();
    const controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    controller.setView("intraday");
    const day = Date.UTC(2026, 6, 15, 0, 0);
    const valid = validateSeriesPage({
      candles: Array.from({ length: 1_500 }, (_, index) => ({
        time: day + index * 30_000,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      hasMoreBefore: false,
      dataVersion: "oversized-day"
    }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1m", adjustMode: "forward" }, "oversized-day");
    deps.store.mergePage(undefined, valid.page);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1m", adjustMode: "forward" },
      generation: 1,
      dataVersion: "oversized-day"
    });

    expect(deps.runtime.setMaterializedSeries).not.toHaveBeenCalled();
    expect(deps.onDataLoaded).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_DATA" }));
  });

  it("loads a remote visible range across three pages and reloads evicted descriptors", async () => {
    const base = Date.UTC(2020, 0, 1);
    const minute = 60_000;
    const candles = Array.from({ length: 3_000 }, (_, index) => ({
      time: base + index * minute,
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 1,
      turnover: 10.5
    }));
    const pages = new Map<string | undefined, { candles: typeof candles; beforeCursor?: string; hasMoreBefore: boolean; dataVersion: string }>([
      [undefined, { candles: candles.slice(2_000), beforeCursor: "c1", hasMoreBefore: true, dataVersion: "v1" }],
      ["c1", { candles: candles.slice(1_000, 2_000), beforeCursor: "c2", hasMoreBefore: true, dataVersion: "v1" }],
      ["c2", { candles: candles.slice(0, 1_000), hasMoreBefore: false, dataVersion: "v1" }]
    ]);
    const requests: Array<string | undefined> = [];
    const datafeed: ChartDatafeed = {
      async getCapabilities() {
        return { series: [{ timeframe: "1d", adjustModes: ["forward"] }] };
      },
      async searchSymbols() { return []; },
      async loadSeries(request) {
        requests.push(request.beforeCursor);
        return structuredClone(pages.get(request.beforeCursor)!);
      }
    };
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 1_000_000 });
    let controller!: ReturnType<typeof createChartController>;
    const deps = dependencies();
    deps.store = store;
    deps.getCapabilities = datafeed.getCapabilities;
    deps.dataCoordinator = createDataCoordinator({
      dataSource: datafeed,
      store,
      onEvent: (event) => controller?.handleDataEvent(event)
    });
    controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(controller.getState().loading).toBe(false));

    const farRange = { from: base + 100 * minute, to: base + 200 * minute };
    controller.setVisibleRange(farRange);
    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith(farRange));
    expect(requests.slice(0, 3)).toEqual([undefined, "c1", "c2"]);

    const evictedRange = { from: base + 1_200 * minute, to: base + 1_300 * minute };
    controller.setVisibleRange(evictedRange);
    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith(evictedRange));
    expect(requests).toContain("c1");
    expect(requests.filter((cursor) => cursor === "c1")).toHaveLength(2);

    const appliedCount = vi.mocked(deps.runtime.setVisibleRange).mock.calls.length;
    controller.setVisibleRange({ from: base - 10 * minute, to: base + 10 * minute });
    await vi.waitFor(() => expect(deps.onError).toHaveBeenCalledWith(expect.objectContaining({ code: "NO_VALID_DATA" })));
    expect(deps.runtime.setVisibleRange).toHaveBeenCalledTimes(appliedCount);
    controller.destroy();
  });

  it("does not let an older descriptor reload failure cancel the latest range", async () => {
    const makeCandles = (from: number) => Array.from({ length: 20 }, (_, index) => ({
      time: from + index,
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 1,
      turnover: 10.5
    }));
    const validate = (
      page: SeriesPage,
      requestCursor?: string,
      currentEarliestTime?: number
    ) => {
      const result = validateSeriesPage(page, {
        ...(requestCursor === undefined ? {} : { requestCursor }),
        seenCursors: new Set(),
        ...(currentEarliestTime === undefined ? {} : { currentEarliestTime })
      });
      if (!result.ok) throw new Error(`fixture invalid: ${result.code}`);
      return result.page;
    };
    const newest = validate({
      candles: makeCandles(300),
      beforeCursor: "c1",
      hasMoreBefore: true,
      dataVersion: "v1"
    });
    const middle = validate({
      candles: makeCandles(200),
      beforeCursor: "c2",
      hasMoreBefore: true,
      dataVersion: "v1"
    }, "c1", 300);
    const oldest = validate({
      candles: makeCandles(100),
      hasMoreBefore: false,
      dataVersion: "v1"
    }, "c2", 200);
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
    store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    store.mergePage(undefined, newest);

    let resolveOlder!: () => void;
    let resolveLatest!: () => void;
    const olderReload = new Promise<void>((resolve) => { resolveOlder = resolve; });
    const latestReload = new Promise<void>((resolve) => { resolveLatest = resolve; });
    const deps = dependencies();
    deps.store = store;
    vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({
      visibleCount: 10,
      overscanCount: 0
    });
    deps.dataCoordinator.reloadPage = vi.fn((cursor) =>
      cursor === "c1" ? olderReload : latestReload
    );
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });
    store.mergePage("c1", middle);
    store.mergePage("c2", oldest);
    vi.mocked(deps.runtime.setVisibleRange).mockClear();
    vi.mocked(deps.onError).mockClear();

    const olderRange = { from: 205, to: 210 };
    const latestRange = { from: 305, to: 310 };
    controller.setVisibleRange(olderRange);
    await vi.waitFor(() => expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledWith("c1"));
    controller.setVisibleRange(latestRange);
    await vi.waitFor(() => expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledWith(undefined));

    controller.handleDataEvent({
      type: "historyRequestFailed",
      cursor: "c1",
      error: new Error("older reload failed")
    });
    resolveOlder();
    expect(store.mergePage(undefined, newest)).toEqual({ ok: true });
    resolveLatest();

    await vi.waitFor(() =>
      expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith(latestRange)
    );
    expect(deps.runtime.setVisibleRange).not.toHaveBeenCalledWith(olderRange);
    expect(deps.onError).not.toHaveBeenCalled();
    expect(controller.getViewModel().status).toEqual({ type: "ready" });
    controller.destroy();
  });

  it("fails the latest range once when two commands share one rejected reload", async () => {
    const makePage = (
      from: number,
      beforeCursor?: string
    ): SeriesPage => ({
      candles: Array.from({ length: 20 }, (_, index) => ({
        time: from + index,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      ...(beforeCursor === undefined ? {} : { beforeCursor }),
      hasMoreBefore: beforeCursor !== undefined,
      dataVersion: "v1"
    });
    const newest = validateSeriesPage(makePage(300, "c1"), {
      seenCursors: new Set()
    });
    const oldest = validateSeriesPage(makePage(200), {
      requestCursor: "c1",
      currentEarliestTime: 300,
      seenCursors: new Set()
    });
    if (!newest.ok || !oldest.ok) throw new Error("fixture invalid");

    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
    store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    store.mergePage(undefined, newest.page);
    const deps = dependencies();
    deps.store = store;
    deps.onPresentationUnavailable = vi.fn();
    let resolveShared!: () => void;
    const sharedReload = new Promise<void>((resolve) => { resolveShared = resolve; });
    deps.dataCoordinator.reloadPage = vi.fn(() => sharedReload);
    vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({
      visibleCount: 10,
      overscanCount: 0
    });
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });
    store.mergePage("c1", oldest.page);
    vi.mocked(deps.runtime.setVisibleRange).mockClear();
    vi.mocked(deps.onError).mockClear();

    const firstRange = { from: 305, to: 310 };
    const latestRange = { from: 311, to: 315 };
    controller.setVisibleRange(firstRange);
    await vi.waitFor(() =>
      expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledWith(undefined)
    );
    controller.setVisibleRange(latestRange);
    await vi.waitFor(() =>
      expect(deps.dataCoordinator.reloadPage).toHaveBeenCalledTimes(2)
    );

    controller.handleDataEvent({
      type: "historyRequestFailed",
      error: new Error("shared reload failed")
    });
    resolveShared();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.runtime.setVisibleRange).not.toHaveBeenCalledWith(firstRange);
    expect(deps.runtime.setVisibleRange).not.toHaveBeenCalledWith(latestRange);
    expect(deps.onPresentationUnavailable).toHaveBeenCalledTimes(1);
    expect(deps.onError).toHaveBeenCalledTimes(1);
    expect(deps.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "HISTORY_DATA_FAILED" })
    );
    expect(controller.getViewModel().status).toEqual(
      expect.objectContaining({ type: "readyWithWarning" })
    );
    controller.destroy();
  });

  it.each(["resolved", "failed"] as const)(
    "cancels a pending range before a direct time-scale mutation when history is %s",
    async (outcome) => {
      let resolveHistory!: () => void;
      const history = new Promise<void>((resolve) => { resolveHistory = resolve; });
      const deps = dependencies();
      deps.onPresentationUnavailable = vi.fn();
      deps.dataCoordinator.loadMoreBefore = vi.fn(() => history);
      const valid = validateSeriesPage({
        candles: Array.from({ length: 100 }, (_, index) => ({
          time: index + 1_001,
          open: 10,
          high: 11,
          low: 9,
          close: 10.5,
          volume: 1,
          turnover: 10.5
        })),
        beforeCursor: "older",
        hasMoreBefore: true,
        dataVersion: "v1"
      }, { seenCursors: new Set() });
      if (!valid.ok) throw new Error("fixture invalid");
      deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
      deps.store.mergePage(undefined, valid.page);
      vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({
        visibleCount: 10,
        overscanCount: 0
      });
      const controller = createChartController(deps);
      controller.handleDataEvent({
        type: "initialPageAccepted",
        selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
        generation: 1,
        dataVersion: "v1"
      });
      vi.mocked(deps.runtime.setVisibleRange).mockClear();
      vi.mocked(deps.onError).mockClear();
      vi.mocked(deps.onPresentationUnavailable).mockClear();

      const pendingRange = { from: 1, to: 10 };
      controller.setVisibleRange(pendingRange);
      await vi.waitFor(() =>
        expect(deps.dataCoordinator.loadMoreBefore).toHaveBeenCalledOnce()
      );

      expect(controller.prepareTimeScaleMutation()).toBe(true);
      if (outcome === "failed") {
        controller.handleDataEvent({
          type: "historyRequestFailed",
          cursor: "older",
          error: new Error("stale direct-mutation history failed")
        });
      }
      resolveHistory();
      await Promise.resolve();
      await Promise.resolve();

      expect(deps.runtime.setVisibleRange).not.toHaveBeenCalledWith(pendingRange);
      expect(deps.onPresentationUnavailable).not.toHaveBeenCalled();
      expect(deps.onError).not.toHaveBeenCalled();
      expect(controller.getViewModel().status).toEqual({ type: "ready" });
      controller.destroy();
    }
  );

  it("applies only the latest reset or visible-range command", async () => {
    let resolveHistory!: () => void;
    const history = new Promise<void>((resolve) => { resolveHistory = resolve; });
    const deps = dependencies();
    deps.dataCoordinator.loadMoreBefore = vi.fn(() => history);
    const valid = validateSeriesPage({
      candles: Array.from({ length: 1_000 }, (_, index) => ({
        time: index + 1_001,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      beforeCursor: "older",
      hasMoreBefore: true,
      dataVersion: "v1"
    }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const controller = createChartController(deps);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "v1"
    });

    const resetWinner = { from: 1_500, to: 1_600 };
    controller.resetToLatest();
    controller.setVisibleRange(resetWinner);
    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith(resetWinner));
    expect(deps.runtime.resetToLatest).not.toHaveBeenCalled();

    vi.mocked(deps.runtime.setVisibleRange).mockClear();
    const stale = { from: 1, to: 10 };
    const latest = { from: 1_700, to: 1_800 };
    controller.setVisibleRange(stale);
    controller.setVisibleRange(latest);
    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith(latest));
    resolveHistory();
    await Promise.resolve();
    expect(deps.runtime.setVisibleRange).not.toHaveBeenCalledWith(stale);
  });

  it("coalesces repeated latest resets on one delayed evicted-page reload and commits once", async () => {
    let resolveNewestReload!: (page: SeriesPage) => void;
    const delayedNewestReload = new Promise<SeriesPage>((resolve) => {
      resolveNewestReload = resolve;
    });
    let newestRequests = 0;
    const requests: Array<string | undefined> = [];
    const newestPage: SeriesPage = {
      candles: Array.from({ length: 100 }, (_, index) => ({
        time: 300 + index,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      beforeCursor: "older",
      hasMoreBefore: true,
      dataVersion: "v1"
    };
    const olderPage: SeriesPage = {
      candles: Array.from({ length: 100 }, (_, index) => ({
        time: 200 + index,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      hasMoreBefore: false,
      dataVersion: "v1"
    };
    const datafeed: ChartDatafeed = {
      async getCapabilities() {
        return { series: [{ timeframe: "1m", adjustModes: ["forward"] }] };
      },
      async searchSymbols() { return []; },
      async loadSeries(request) {
        requests.push(request.beforeCursor);
        if (request.beforeCursor === "older") return olderPage;
        newestRequests += 1;
        return newestRequests === 1 ? newestPage : delayedNewestReload;
      }
    };
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
    let controller!: ReturnType<typeof createChartController>;
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.store = store;
    deps.getCapabilities = datafeed.getCapabilities;
    vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({ visibleCount: 100, overscanCount: 0 });
    deps.dataCoordinator = createDataCoordinator({
      dataSource: datafeed,
      store,
      onEvent: (event) => controller?.handleDataEvent(event)
    });
    controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(controller.getState().loading).toBe(false));
    const initialCommitCount = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.length;

    controller.loadMoreBefore();
    await vi.waitFor(() => expect(newestRequests).toBe(2));
    controller.resetToLatest();
    controller.resetToLatest();
    expect(deps.runtime.resetToLatest).not.toHaveBeenCalled();
    resolveNewestReload(newestPage);

    await vi.waitFor(() => expect(deps.runtime.resetToLatest).toHaveBeenCalledTimes(1));
    expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.length)
      .toBe(initialCommitCount + 1);
    expect(requests.filter((cursor) => cursor === undefined)).toHaveLength(2);
    controller.destroy();
  });

  it("does not let a delayed boundary reload overwrite a later latest reset", async () => {
    let resolveOlderReload!: (page: SeriesPage) => void;
    const delayedOlderReload = new Promise<SeriesPage>((resolve) => {
      resolveOlderReload = resolve;
    });
    let olderRequests = 0;
    const newestPage: SeriesPage = {
      candles: Array.from({ length: 100 }, (_, index) => ({
        time: 300 + index,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      beforeCursor: "older",
      hasMoreBefore: true,
      dataVersion: "v1"
    };
    const olderPage: SeriesPage = {
      candles: Array.from({ length: 100 }, (_, index) => ({
        time: 200 + index,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1,
        turnover: 10.5
      })),
      hasMoreBefore: false,
      dataVersion: "v1"
    };
    const datafeed: ChartDatafeed = {
      async getCapabilities() {
        return { series: [{ timeframe: "1m", adjustModes: ["forward"] }] };
      },
      async searchSymbols() { return []; },
      async loadSeries(request) {
        if (request.beforeCursor === undefined) return newestPage;
        olderRequests += 1;
        return olderRequests === 1 ? olderPage : delayedOlderReload;
      }
    };
    const store = createPagedSeriesStore({ maxPages: 1, maxEstimatedBytes: 10_000 });
    let controller!: ReturnType<typeof createChartController>;
    const deps = dependencies();
    deps.initialTimeframe = "1m";
    deps.store = store;
    deps.getCapabilities = datafeed.getCapabilities;
    vi.mocked(deps.runtime.getMaterializationDemand).mockReturnValue({ visibleCount: 100, overscanCount: 0 });
    deps.dataCoordinator = createDataCoordinator({
      dataSource: datafeed,
      store,
      onEvent: (event) => controller?.handleDataEvent(event)
    });
    controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(controller.getState().loading).toBe(false));
    controller.loadMoreBefore();
    await vi.waitFor(() => {
      const latest = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
      expect(latest?.sourceMinTime).toBe(300);
      expect(latest?.hasKnownOlderData).toBe(true);
    });

    const latest = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    controller.handleMaterializedBoundary("before", latest.sourceMinTime);
    await vi.waitFor(() => expect(olderRequests).toBe(2));
    controller.resetToLatest();
    await vi.waitFor(() => expect(deps.runtime.resetToLatest).toHaveBeenCalledTimes(1));
    const latestCommitCount = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.length;
    resolveOlderReload(olderPage);
    await vi.waitFor(() => expect(store.getDescriptorForCursor("older")?.candles).toBeDefined());
    await Promise.resolve();

    expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.length).toBe(latestCommitCount);
    expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].sourceMinTime)
      .toBe(300);
    controller.destroy();
  });

  it("isolates the old runtime while a new symbol loads and applies a queued latest reset to the new page", async () => {
    const nextSymbol: ChartSymbol = { id: "stock-2", code: "600001", name: "邯郸钢铁", exchange: "SSE", kind: "stock" };
    let resolveCapabilities!: (value: { series: readonly [{ timeframe: "1d"; adjustModes: readonly ["forward"] }] }) => void;
    const pendingCapabilities = new Promise<{ series: readonly [{ timeframe: "1d"; adjustModes: readonly ["forward"] }] }>(
      (resolve) => { resolveCapabilities = resolve; }
    );
    const deps = dependencies();
    vi.mocked(deps.runtime.getVisibleRange).mockReturnValue({ from: 100, to: 200 });
    deps.getCapabilities = vi.fn((symbol) => symbol.id === stock.id
      ? Promise.resolve({ series: [{ timeframe: "1d" as const, adjustModes: ["forward" as const] }] })
      : pendingCapabilities);
    const controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    const oldPage = validateSeriesPage({
      candles: [{ time: 1_000, open: 10, high: 11, low: 9, close: 10.5, volume: 1, turnover: 10.5 }],
      hasMoreBefore: false,
      dataVersion: "old"
    }, { seenCursors: new Set() });
    if (!oldPage.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "old");
    deps.store.mergePage(undefined, oldPage.page);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "old"
    });
    expect(controller.getVisibleRange()).toEqual({ from: 100, to: 200 });

    controller.setSymbol(nextSymbol);
    expect(controller.getVisibleRange()).toBeUndefined();
    controller.resetToLatest();
    expect(deps.runtime.resetToLatest).not.toHaveBeenCalled();

    resolveCapabilities({ series: [{ timeframe: "1d", adjustModes: ["forward"] }] });
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(2));
    const nextPage = validateSeriesPage({
      candles: [{ time: 2_000, open: 20, high: 21, low: 19, close: 20.5, volume: 2, turnover: 41 }],
      hasMoreBefore: false,
      dataVersion: "new"
    }, { seenCursors: new Set() });
    if (!nextPage.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: nextSymbol, timeframe: "1d", adjustMode: "forward" }, "new");
    deps.store.mergePage(undefined, nextPage.page);
    vi.mocked(deps.dataCoordinator.getGeneration).mockReturnValue(2);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: nextSymbol, timeframe: "1d", adjustMode: "forward" },
      generation: 2,
      dataVersion: "new"
    });

    await vi.waitFor(() => expect(deps.runtime.resetToLatest).toHaveBeenCalledTimes(1));
    expect(vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0].selection.symbol.id)
      .toBe(nextSymbol.id);
    expect(controller.getVisibleRange()).toEqual({ from: 100, to: 200 });
  });

  it("queues a new-symbol range without committing the old selection while loading", async () => {
    const nextSymbol: ChartSymbol = { id: "stock-2", code: "600001", name: "邯郸钢铁", exchange: "SSE", kind: "stock" };
    let resolveCapabilities!: (value: { series: readonly [{ timeframe: "1d"; adjustModes: readonly ["forward"] }] }) => void;
    const pendingCapabilities = new Promise<{ series: readonly [{ timeframe: "1d"; adjustModes: readonly ["forward"] }] }>(
      (resolve) => { resolveCapabilities = resolve; }
    );
    const deps = dependencies();
    deps.onDataLoaded = vi.fn();
    deps.getCapabilities = vi.fn((symbol) => symbol.id === stock.id
      ? Promise.resolve({ series: [{ timeframe: "1d" as const, adjustModes: ["forward" as const] }] })
      : pendingCapabilities);
    const controller = createChartController(deps);
    controller.start();
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(1));
    const oldPage = validateSeriesPage({
      candles: [{ time: 1_000, open: 10, high: 11, low: 9, close: 10.5, volume: 1, turnover: 10.5 }],
      hasMoreBefore: false,
      dataVersion: "old"
    }, { seenCursors: new Set() });
    if (!oldPage.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "old");
    deps.store.mergePage(undefined, oldPage.page);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" },
      generation: 1,
      dataVersion: "old"
    });
    const materializedBeforeSwitch = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.length;
    const loadedBeforeSwitch = vi.mocked(deps.onDataLoaded).mock.calls.length;

    controller.setSymbol(nextSymbol);
    const queuedRange = { from: 5_000, to: 5_100 };
    controller.setVisibleRange(queuedRange);
    controller.handleMaterializationDemandChanged({ visibleCount: 1_000, overscanCount: 100 });
    expect(deps.runtime.setMaterializedSeries).toHaveBeenCalledTimes(materializedBeforeSwitch);
    expect(deps.onDataLoaded).toHaveBeenCalledTimes(loadedBeforeSwitch);

    resolveCapabilities({ series: [{ timeframe: "1d", adjustModes: ["forward"] }] });
    await vi.waitFor(() => expect(deps.dataCoordinator.start).toHaveBeenCalledTimes(2));
    const nextPage = validateSeriesPage({
      candles: Array.from({ length: 201 }, (_, index) => ({
        time: 5_000 + index,
        open: 20,
        high: 21,
        low: 19,
        close: 20.5,
        volume: 2,
        turnover: 41
      })),
      hasMoreBefore: false,
      dataVersion: "new"
    }, { seenCursors: new Set() });
    if (!nextPage.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: nextSymbol, timeframe: "1d", adjustMode: "forward" }, "new");
    deps.store.mergePage(undefined, nextPage.page);
    vi.mocked(deps.dataCoordinator.getGeneration).mockReturnValue(2);
    controller.handleDataEvent({
      type: "initialPageAccepted",
      selection: { symbol: nextSymbol, timeframe: "1d", adjustMode: "forward" },
      generation: 2,
      dataVersion: "new"
    });

    await vi.waitFor(() => expect(deps.runtime.setVisibleRange).toHaveBeenCalledWith(queuedRange));
    const committed = vi.mocked(deps.runtime.setMaterializedSeries).mock.calls.at(-1)?.[0];
    expect(committed.selection.symbol.id).toBe(nextSymbol.id);
    expect(committed.series.dataVersion).toBe("new");
    expect(deps.onDataLoaded).toHaveBeenCalledTimes(loadedBeforeSwitch + 1);
  });
});
