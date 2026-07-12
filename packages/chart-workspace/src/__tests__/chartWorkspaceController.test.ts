import { describe, expect, it, vi } from "vitest";
import type { DrawingObject } from "@simoncharts/chart-engine";
import type { ChartSymbol } from "../index";
import {
  createChartWorkspaceController,
  type ChartWorkspaceControllerDependencies
} from "../controller/chartWorkspaceController";
import { createPagedSeriesStore } from "../data/pagedSeriesStore";
import { validateSeriesPage } from "../data/seriesPageValidation";
import { defaultLayoutState, defaultPreferences } from "../persistence/browserPersistence";

const stock: ChartSymbol = { id: "stock", code: "600000", name: "浦发银行", exchange: "SSE", kind: "stock" };
const index: ChartSymbol = { id: "index", code: "000001", name: "上证指数", exchange: "SSE", kind: "index" };

function dependencies(): ChartWorkspaceControllerDependencies {
  return {
    initialSymbol: stock,
    workspaceId: "test",
    store: createPagedSeriesStore(),
    dataCoordinator: {
      start: vi.fn(async () => undefined),
      loadMoreBefore: vi.fn(async () => undefined),
      reloadPage: vi.fn(async () => undefined),
      retryInitial: vi.fn(async () => undefined),
      getGeneration: vi.fn(() => 1),
      destroy: vi.fn()
    },
    searchCoordinator: { search: vi.fn(async () => undefined), destroy: vi.fn() },
    runtime: {
      setMaterializedSeries: vi.fn(), setSeriesType: vi.fn(), setIndicators: vi.fn(), setPriceScaleMode: vi.fn(), setDrawings: vi.fn(), setDrawingTool: vi.fn(), executeDrawingCommand: vi.fn(), undoDrawing: vi.fn(), redoDrawing: vi.fn(), setGridVisible: vi.fn(), retryRender: vi.fn(), getMetrics: vi.fn(() => ({ totalRenderCount: 0, renderCountByPass: { static: 0, dynamic: 0, overlay: 0 }, lastRenderDuration: 0, dirtyLayerCount: 0, lastInvalidationReasons: [], slowFrameCount: 0, maxMaterializedCandleCount: 0 })), destroy: vi.fn()
    },
    persistence: {
      loadLayout: vi.fn(() => structuredClone(defaultLayoutState)), saveLayout: vi.fn(),
      loadPreferences: vi.fn(() => structuredClone(defaultPreferences)), savePreferences: vi.fn(),
      loadIndicators: vi.fn(() => []), saveIndicators: vi.fn(),
      loadDrawings: vi.fn(() => [] as DrawingObject[]), saveDrawings: vi.fn()
    },
    onError: vi.fn(),
    onViewModelChanged: vi.fn()
  };
}

describe("chart workspace controller", () => {
  it("normalizes index adjustment and emits exactly one request per changed selection", () => {
    const deps = dependencies();
    const controller = createChartWorkspaceController(deps);
    controller.setAdjustMode("backward");
    expect(deps.dataCoordinator.start).toHaveBeenCalledWith(expect.objectContaining({ adjustMode: "backward" }));

    controller.setSymbol(index);
    expect(controller.getState().adjustMode).toBe("none");
    expect(deps.dataCoordinator.start).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: index, adjustMode: "none" }));
    vi.mocked(deps.dataCoordinator.start).mockClear();
    controller.setAdjustMode("forward");
    expect(controller.getState().adjustMode).toBe("none");
    expect(deps.dataCoordinator.start).not.toHaveBeenCalled();
  });

  it("assigns retry only to recoverable blocking initial-data or render errors", () => {
    const deps = dependencies();
    const controller = createChartWorkspaceController(deps);
    controller.retry();
    expect(deps.dataCoordinator.retryInitial).not.toHaveBeenCalled();
    expect(deps.runtime.retryRender).not.toHaveBeenCalled();

    controller.handleDataEvent({ type: "initialRequestFailed", error: new Error("provider body secret") });
    expect(controller.getViewModel().status).toMatchObject({ type: "blocked", error: { code: "INITIAL_DATA_FAILED" } });
    expect(JSON.stringify(controller.getViewModel())).not.toContain("provider body secret");
    controller.retry();
    expect(deps.dataCoordinator.retryInitial).toHaveBeenCalledTimes(1);

    controller.handleRenderError(new Error("canvas failed"));
    controller.retry();
    expect(deps.runtime.retryRender).toHaveBeenCalledTimes(1);
  });

  it("keeps history, search, and storage errors nonblocking and ignores AbortError", () => {
    const deps = dependencies();
    const controller = createChartWorkspaceController(deps);
    controller.handleDataEvent({ type: "historyRequestFailed", cursor: "older", error: new Error("offline") });
    expect(controller.getViewModel().status.type).toBe("readyWithWarning");
    controller.handleSearchEvent({ type: "searchFailed", query: "x", code: "SYMBOL_SEARCH_FAILED", error: new Error("bad") });
    expect(controller.getViewModel().status.type).toBe("readyWithWarning");
    controller.handleStorageError({ code: "STORAGE_WRITE_FAILED", scope: "storage", recoverable: true, message: "storage" });
    expect(controller.getViewModel().status.type).toBe("readyWithWarning");
    const before = controller.getViewModel();
    controller.handleDataEvent({ type: "initialRequestFailed", error: new DOMException("aborted", "AbortError") });
    expect(controller.getViewModel()).toEqual(before);
  });

  it("materializes an accepted page and destroys dependencies once", () => {
    const deps = dependencies();
    const valid = validateSeriesPage({ candles: [{ time: 1, open: 10, high: 11, low: 9, close: 10.5, volume: 1, turnover: 10.5 }], hasMoreBefore: false, dataVersion: "v1" }, { seenCursors: new Set() });
    if (!valid.ok) throw new Error("fixture invalid");
    deps.store.reset({ symbol: stock, timeframe: "1d", adjustMode: "forward" }, "v1");
    deps.store.mergePage(undefined, valid.page);
    const controller = createChartWorkspaceController(deps);
    controller.handleDataEvent({ type: "initialPageAccepted", selection: { symbol: stock, timeframe: "1d", adjustMode: "forward" }, generation: 1 });
    expect(deps.runtime.setMaterializedSeries).toHaveBeenCalled();
    expect(controller.getViewModel().status.type).toBe("ready");

    controller.destroy();
    controller.destroy();
    expect(deps.runtime.destroy).toHaveBeenCalledTimes(1);
    expect(deps.dataCoordinator.destroy).toHaveBeenCalledTimes(1);
    expect(deps.searchCoordinator.destroy).toHaveBeenCalledTimes(1);
  });
});
