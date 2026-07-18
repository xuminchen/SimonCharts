import type {
  AdjustMode,
  ChartEvent,
  ChartEventListener,
  ChartFeature,
  ChartInstance,
  ChartLocale,
  ChartOptions,
  ChartState,
  ChartStateListener,
  ChartSymbol,
  ChartTheme,
  ChartView,
  ChartVisibleRange,
  IntradayDayCount,
  Timeframe
} from "./contracts";
import { defaultChartFeatures } from "./contracts";
import { createChartController, type ChartController, type WorkspaceViewModel } from "./controller/chartController";
import { createCalculationCheckpointStore } from "./data/calculationCheckpointStore";
import { createDataCoordinator } from "./data/dataCoordinator";
import { createPagedSeriesStore } from "./data/pagedSeriesStore";
import { createSymbolSearchCoordinator } from "./data/symbolSearchCoordinator";
import { createChartError, type ChartError } from "./errors";
import { createBrowserPersistence, defaultLayoutState, defaultPreferences } from "./persistence/browserPersistence";
import { createChartEngineRuntime } from "./runtime/chartEngineRuntime";
import { createCheckpointedCalculationRuntime } from "./runtime/checkpointedCalculationRuntime";
import { createWorkspaceShell } from "./ui/workspaceShell";

const validFeatures = new Set<ChartFeature>([
  "symbol-search",
  "timeframes",
  "adjustment",
  "series-type",
  "price-scale",
  "indicators",
  "drawing-tools",
  "drawing-history",
  "settings",
  "bottom-panel"
]);
const drawingSurfaceFeatures: readonly ChartFeature[] = [
  "drawing-tools",
  "drawing-history",
  "bottom-panel"
];

function resolvedFeatures(features: unknown): ReadonlySet<ChartFeature> {
  return new Set(
    Array.isArray(features) && features.every((feature) => validFeatures.has(feature))
      ? features as readonly ChartFeature[]
      : defaultChartFeatures
  );
}

function resolvedTheme(theme: unknown): ChartTheme {
  return theme === "light" || theme === "dark" ? theme : "dark";
}

function resolvedLocale(locale: unknown): ChartLocale {
  return locale === "en-US" || locale === "zh-CN" ? locale : "zh-CN";
}

function validOptions(options: ChartOptions): boolean {
  const symbol = options?.initialSymbol;
  return (
    typeof options?.chartId === "string" &&
    options.chartId.trim().length > 0 &&
    typeof options?.persistenceScopeId === "string" &&
    options.persistenceScopeId.trim().length > 0 &&
    typeof options?.dataContextId === "string" &&
    options.dataContextId.trim().length > 0 &&
    (options.dataCutoffTime === undefined ||
      (typeof options.dataCutoffTime === "number" &&
        Number.isFinite(options.dataCutoffTime) &&
        options.dataCutoffTime > 0)) &&
    typeof symbol?.id === "string" && symbol.id.trim().length > 0 &&
    typeof symbol?.code === "string" && symbol.code.trim().length > 0 &&
    typeof symbol?.name === "string" && symbol.name.trim().length > 0 &&
    ["SSE", "SZSE", "BSE"].includes(symbol?.exchange) &&
    ["stock", "index"].includes(symbol?.kind) &&
    (options.features === undefined ||
      (Array.isArray(options.features) && options.features.every((feature) => validFeatures.has(feature)))) &&
    (options.theme === undefined || (["dark", "light"] as const).includes(options.theme)) &&
    (options.locale === undefined || (["zh-CN", "en-US"] as const).includes(options.locale)) &&
    typeof options?.datafeed?.getCapabilities === "function" &&
    typeof options?.datafeed?.searchSymbols === "function" &&
    typeof options?.datafeed?.loadSeries === "function"
  );
}

function blockedViewModel(state: ChartState, error: ChartError): WorkspaceViewModel {
  return {
    state,
    status: { type: "blocked", error },
    intradayView: false,
    seriesType: defaultPreferences.seriesType,
    favoriteTimeframes: defaultPreferences.favoriteTimeframes,
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

export function createChart(
  container: HTMLElement,
  options: ChartOptions
): ChartInstance {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("Chart container must be an HTMLElement");
  }

  const features = resolvedFeatures(options?.features);
  const shell = createWorkspaceShell({
    features,
    theme: resolvedTheme(options?.theme),
    locale: resolvedLocale(options?.locale)
  });
  container.append(shell.root);
  let destroyed = false;
  const stateListeners = new Set<ChartStateListener>();
  const eventListeners = new Set<ChartEventListener>();
  let lastNotifiedState = "";
  const emitEvent = (event: ChartEvent): void => {
    for (const listener of eventListeners) {
      try {
        listener(structuredClone(event));
      } catch {
        // Host listeners are isolated from chart events.
      }
    }
  };

  if (!validOptions(options)) {
    const error = createChartError(
      "INVALID_CONFIGURATION",
      "configuration",
      false,
      "Chart configuration is invalid"
    );
    const state: ChartState = {
      symbol: { id: "invalid", code: "--", name: "Invalid configuration", exchange: "SSE", kind: "index" },
      timeframe: "1d",
      view: "timeframe",
      intradayDays: 1,
      adjustMode: "none",
      loading: false
    };
    shell.render(blockedViewModel(state, error));
    if (typeof options?.onError === "function") options.onError(error);
    return Object.freeze({
      getState: () => structuredClone(state),
      getVisibleRange: () => undefined,
      setSymbol: () => undefined,
      setTimeframe: () => undefined,
      setView: () => undefined,
      setIntradayDays: () => undefined,
      setAdjustMode: () => undefined,
      setVisibleRange: () => undefined,
      resetToLatest: () => undefined,
      retry: () => undefined,
      subscribe: () => () => undefined,
      subscribeEvents: () => () => undefined,
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        shell.destroy();
        shell.root.remove();
      }
    });
  }

  let controller: ChartController | undefined;
  const pendingStorageErrors: ChartError[] = [];
  const persistence = createBrowserPersistence(
    options.chartId,
    options.persistenceScopeId,
    options.dataContextId,
    localStorage,
    (error) => controller?.handleStorageError(error) ?? pendingStorageErrors.push(error)
  );
  const store = createPagedSeriesStore();
  const dataCoordinator = createDataCoordinator({
    dataSource: options.datafeed,
    dataCutoffTime: options.dataCutoffTime,
    store,
    onEvent: (event) => controller?.handleDataEvent(event)
  });
  const searchCoordinator = createSymbolSearchCoordinator({
    dataSource: options.datafeed,
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
    onMaterializedBoundary: (direction, anchor) => controller?.handleMaterializedBoundary(direction, anchor),
    onMaterializationDemandChanged: (demand) => controller?.handleMaterializationDemandChanged(demand),
    onVisibleRangeChanged: (range) => {
      if (controller?.shouldPublishVisibleRange()) {
        emitEvent({ type: "visible-range", range });
      }
    },
    onCalculationStatusChanged: (status) => controller?.handleCalculationStatus(status),
    onDataWindowChanged: (snapshot) => shell.renderDataWindow(snapshot),
    onDrawingsChanged: (drawings, selectedDrawingIds) => controller?.handleDrawingsChanged(drawings, selectedDrawingIds),
    onDrawingHistoryChanged: (history) => controller?.handleDrawingHistoryChanged(history),
    onRenderError: (error) => controller?.handleRenderError(error)
  });
  controller = createChartController({
    chartId: options.chartId,
    drawingPersistenceEnabled: drawingSurfaceFeatures.some((feature) => features.has(feature)),
    seriesTypePersistenceEnabled: features.has("series-type"),
    initialSymbol: options.initialSymbol,
    initialTimeframe: options.initialTimeframe,
    initialAdjustMode: options.initialAdjustMode,
    getCapabilities: (symbol, signal) => options.datafeed.getCapabilities(symbol, signal),
    store,
    dataCoordinator,
    searchCoordinator,
    persistence,
    runtime,
    onError: options.onError,
    onDataLoaded: (event) => emitEvent({ type: "data-loaded", ...event }),
    onViewModelChanged: (viewModel) => {
      shell.render(viewModel);
      const nextState = JSON.stringify(viewModel.state);
      if (nextState === lastNotifiedState) return;
      lastNotifiedState = nextState;
      for (const listener of stateListeners) {
        try {
          listener(structuredClone(viewModel.state));
        } catch {
          // Host listeners are isolated from workspace state transitions.
        }
      }
    }
  });
  const unbind = shell.bind(controller);
  shell.render(controller.getViewModel());
  for (const error of pendingStorageErrors) controller.handleStorageError(error);
  controller.start();

  return Object.freeze({
    getState: () => controller!.getState(),
    getVisibleRange: () => controller!.getVisibleRange(),
    setSymbol: (symbol: ChartSymbol) => controller!.setSymbol(symbol),
    setTimeframe: (timeframe: Timeframe) => controller!.setTimeframe(timeframe),
    setView: (view: ChartView) => {
      if (view !== "intraday" && view !== "timeframe") {
        throw new TypeError("Chart view must be intraday or timeframe");
      }
      controller!.setView(view);
    },
    setIntradayDays: (days: IntradayDayCount) => {
      if (!Number.isInteger(days) || days < 1 || days > 9) {
        throw new RangeError("Intraday days must be an integer from 1 to 9");
      }
      controller!.setIntradayDays(days);
    },
    setAdjustMode: (adjustMode: AdjustMode) => controller!.setAdjustMode(adjustMode),
    setVisibleRange: (range: ChartVisibleRange) => {
      if (
        typeof range !== "object" ||
        range === null ||
        !Number.isFinite(range.from) ||
        !Number.isFinite(range.to) ||
        range.from > range.to
      ) throw new RangeError("Visible range must contain finite ascending timestamps");
      controller!.setVisibleRange(range);
    },
    resetToLatest: () => controller!.resetToLatest(),
    retry: () => controller!.retry(),
    subscribe: (listener: ChartStateListener) => {
      if (typeof listener !== "function") throw new TypeError("Chart listener must be a function");
      if (destroyed) return () => undefined;
      stateListeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        stateListeners.delete(listener);
      };
    },
    subscribeEvents: (listener: ChartEventListener) => {
      if (typeof listener !== "function") throw new TypeError("Chart event listener must be a function");
      if (destroyed) return () => undefined;
      eventListeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        eventListeners.delete(listener);
      };
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      controller!.deactivate();
      unbind();
      controller!.destroy();
      stateListeners.clear();
      eventListeners.clear();
      checkpointStore.clear();
      shell.destroy();
      shell.root.remove();
    }
  });
}
