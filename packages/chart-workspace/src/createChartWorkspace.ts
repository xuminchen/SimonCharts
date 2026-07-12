import type {
  AdjustMode,
  ChartSymbol,
  ChartWorkspace,
  ChartWorkspaceOptions,
  ChartWorkspaceState,
  Timeframe
} from "./contracts";
import { createChartWorkspaceController, type ChartWorkspaceController, type WorkspaceViewModel } from "./controller/chartWorkspaceController";
import { createCalculationCheckpointStore } from "./data/calculationCheckpointStore";
import { createDataCoordinator } from "./data/dataCoordinator";
import { createPagedSeriesStore } from "./data/pagedSeriesStore";
import { createSymbolSearchCoordinator } from "./data/symbolSearchCoordinator";
import { createWorkspaceError, type ChartWorkspaceError } from "./errors";
import { createBrowserPersistence, defaultLayoutState, defaultPreferences } from "./persistence/browserPersistence";
import { createChartEngineRuntime } from "./runtime/chartEngineRuntime";
import { createCheckpointedCalculationRuntime } from "./runtime/checkpointedCalculationRuntime";
import { createWorkspaceShell } from "./ui/workspaceShell";

function validOptions(options: ChartWorkspaceOptions): boolean {
  const symbol = options?.initialSymbol;
  return (
    typeof options?.workspaceId === "string" &&
    options.workspaceId.trim().length > 0 &&
    typeof symbol?.id === "string" && symbol.id.trim().length > 0 &&
    typeof symbol?.code === "string" && symbol.code.trim().length > 0 &&
    typeof symbol?.name === "string" && symbol.name.trim().length > 0 &&
    ["SSE", "SZSE", "BSE"].includes(symbol?.exchange) &&
    ["stock", "index"].includes(symbol?.kind) &&
    typeof options?.dataSource?.searchSymbols === "function" &&
    typeof options?.dataSource?.loadSeries === "function"
  );
}

function blockedViewModel(state: ChartWorkspaceState, error: ChartWorkspaceError): WorkspaceViewModel {
  return {
    state,
    status: { type: "blocked", error },
    seriesType: defaultPreferences.seriesType,
    priceScaleMode: defaultPreferences.priceScaleMode,
    indicators: [],
    drawings: [],
    selectedDrawingIds: [],
    bottomPanel: defaultLayoutState.bottomPanel,
    drawingPalette: defaultLayoutState.drawingPalette,
    canUndoDrawing: false,
    canRedoDrawing: false,
    gridVisible: true,
    calculationStatus: { type: "idle" },
    search: { query: "", loading: false, results: [] }
  };
}

export function createChartWorkspace(
  container: HTMLElement,
  options: ChartWorkspaceOptions
): ChartWorkspace {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("Chart workspace container must be an HTMLElement");
  }

  const shell = createWorkspaceShell();
  container.append(shell.root);
  let destroyed = false;

  if (!validOptions(options)) {
    const error = createWorkspaceError(
      "INVALID_CONFIGURATION",
      "configuration",
      false,
      "Chart workspace configuration is invalid"
    );
    const state: ChartWorkspaceState = {
      symbol: { id: "invalid", code: "--", name: "Invalid configuration", exchange: "SSE", kind: "index" },
      timeframe: "1d",
      adjustMode: "none",
      loading: false
    };
    shell.render(blockedViewModel(state, error));
    if (typeof options?.onError === "function") options.onError(error);
    return Object.freeze({
      getState: () => structuredClone(state),
      setSymbol: () => undefined,
      setTimeframe: () => undefined,
      setAdjustMode: () => undefined,
      retry: () => undefined,
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        shell.destroy();
        shell.root.remove();
      }
    });
  }

  let controller: ChartWorkspaceController | undefined;
  const pendingStorageErrors: ChartWorkspaceError[] = [];
  const persistence = createBrowserPersistence(
    options.workspaceId,
    localStorage,
    (error) => controller?.handleStorageError(error) ?? pendingStorageErrors.push(error)
  );
  const store = createPagedSeriesStore();
  const dataCoordinator = createDataCoordinator({
    dataSource: options.dataSource,
    store,
    onEvent: (event) => controller?.handleDataEvent(event)
  });
  const searchCoordinator = createSymbolSearchCoordinator({
    dataSource: options.dataSource,
    onEvent: (event) => controller?.handleSearchEvent(event)
  });
  const checkpointStore = createCalculationCheckpointStore();
  const calculationRuntime = createCheckpointedCalculationRuntime({
    store,
    checkpointStore,
    reloadPage: (cursor) => dataCoordinator.reloadPage(cursor)
  });
  const runtime = createChartEngineRuntime({
    staticCanvas: shell.staticCanvas,
    overlayCanvas: shell.overlayCanvas,
    themeRoot: shell.chartRegion,
    calculationRuntime,
    devicePixelRatio: window.devicePixelRatio,
    onViewportChanged: (viewport) => controller?.handleViewportChanged(viewport),
    onHistoryBoundary: (anchor) => controller?.handleHistoryBoundary(anchor),
    onCalculationStatusChanged: (status) => controller?.handleCalculationStatus(status),
    onDataWindowChanged: (snapshot) => controller?.handleDataWindow(snapshot),
    onDrawingsChanged: (drawings, selectedDrawingIds) => controller?.handleDrawingsChanged(drawings, selectedDrawingIds),
    onDrawingHistoryChanged: (history) => controller?.handleDrawingHistoryChanged(history),
    onRenderError: (error) => controller?.handleRenderError(error)
  });
  controller = createChartWorkspaceController({
    workspaceId: options.workspaceId,
    initialSymbol: options.initialSymbol,
    initialTimeframe: options.initialTimeframe,
    initialAdjustMode: options.initialAdjustMode,
    store,
    dataCoordinator,
    searchCoordinator,
    persistence,
    runtime,
    onError: options.onError,
    onViewModelChanged: (viewModel) => shell.render(viewModel)
  });
  const unbind = shell.bind(controller);
  shell.render(controller.getViewModel());
  for (const error of pendingStorageErrors) controller.handleStorageError(error);
  controller.start();

  return Object.freeze({
    getState: () => controller!.getState(),
    setSymbol: (symbol: ChartSymbol) => controller!.setSymbol(symbol),
    setTimeframe: (timeframe: Timeframe) => controller!.setTimeframe(timeframe),
    setAdjustMode: (adjustMode: AdjustMode) => controller!.setAdjustMode(adjustMode),
    retry: () => controller!.retry(),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      unbind();
      controller!.destroy();
      checkpointStore.clear();
      shell.destroy();
      shell.root.remove();
    }
  });
}
